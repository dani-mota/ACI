import { NextRequest, NextResponse, after } from "next/server";
import prisma from "@/lib/prisma";
import { runScoringPipeline } from "@/lib/assessment/scoring/pipeline";
import { checkRateLimitAsync, RATE_LIMITS } from "@/lib/rate-limit";
import { createLogger } from "@/lib/assessment/logger";
// Session binding disabled — re-enable behind feature flag when architecture is stable
// import { validateAssessSession } from "@/lib/session/assess-session";
import * as Sentry from "@sentry/nextjs"; // Fix: PRO-74

export const maxDuration = 300;

const log = createLogger("complete-route");

interface RouteParams {
  params: Promise<{ token: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const { token } = await params;

  // Rate limit by token
  // Fix: PRO-9 — use Redis-backed rate limiter
  const rl = await checkRateLimitAsync(`complete:${token}`, RATE_LIMITS.assessmentComplete, "assessmentComplete");
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } },
    );
  }

  const invitation = await prisma.assessmentInvitation.findUnique({
    where: { linkToken: token },
  });

  if (!invitation) {
    return NextResponse.json({ error: "Invalid token" }, { status: 404 });
  }

  // Session binding disabled for pre-pilot — token auth only

  const assessment = await prisma.assessment.findFirst({
    where: { candidateId: invitation.candidateId },
    orderBy: { startedAt: "desc" },
  });

  if (!assessment) {
    return NextResponse.json({ error: "Assessment not found" }, { status: 404 });
  }

  // Fix: PRO-5 — Idempotent response when already completed
  if (assessment.completedAt) {
    return NextResponse.json({ status: "already_complete" });
  }

  const now = new Date();
  const durationMinutes = Math.round(
    (now.getTime() - assessment.startedAt.getTime()) / 60000
  );

  // Atomic check+update to prevent TOCTOU race
  const updated = await prisma.$transaction(async (tx) => {
    // Re-check inside transaction to prevent concurrent completion
    const fresh = await tx.assessment.findUnique({
      where: { id: assessment.id },
      select: { completedAt: true },
    });
    if (fresh?.completedAt) return false;

    await tx.assessment.update({
      where: { id: assessment.id },
      data: {
        completedAt: now,
        durationMinutes,
      },
    });

    await tx.assessmentInvitation.update({
      where: { id: invitation.id },
      data: { status: "COMPLETED" },
    });

    await tx.candidate.update({
      where: { id: invitation.candidateId },
      data: { status: "SCORING" },
    });

    return true;
  });

  // Fix: PRO-5 — Idempotent response for TOCTOU race
  if (!updated) {
    return NextResponse.json({ status: "already_complete" });
  }

  // Run scoring pipeline after response is sent — ensures pipeline runs to completion
  // even after the HTTP response is delivered (Vercel background execution)
  after(() => runPipelineWithRetry(assessment.id));

  return NextResponse.json({ success: true, durationMinutes });
}

/**
 * Run scoring pipeline with exponential backoff retry (max 3 attempts).
 * Resets candidate status to ERROR on final failure.
 */
async function runPipelineWithRetry(
  assessmentId: string,
  maxRetries = 3,
) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await runScoringPipeline(assessmentId);
      return; // Success
    } catch (err) {
      log.error(`Pipeline attempt ${attempt}/${maxRetries} failed`, { assessmentId, error: String(err) });
      if (attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt - 1)));
      }
    }
  }

  // All retries exhausted — mark candidate as error state so dashboard shows it
  log.error("Pipeline exhausted all retries", { assessmentId });
  // Fix: PRO-74 — report pipeline failure to Sentry
  Sentry.captureException(new Error("Scoring pipeline exhausted all retries"), { extra: { assessmentId } });
  try {
    const assessment = await prisma.assessment.findUnique({
      where: { id: assessmentId },
      select: { candidateId: true },
    });
    if (assessment) {
      await prisma.candidate.update({
        where: { id: assessment.candidateId },
        data: { status: "ERROR" },
      });
    }
  } catch {
    // Best effort — don't throw from error handler
  }

  // Fire-and-forget webhook notification for admin alerting
  const webhookUrl = process.env.SCORING_FAILURE_WEBHOOK_URL;
  // Fix: PRO-78 — validate webhook URL to prevent SSRF
  if (webhookUrl && !isPrivateUrl(webhookUrl)) {
    fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event: "scoring_pipeline_failure",
        assessmentId,
        timestamp: new Date().toISOString(),
        message: `Scoring pipeline exhausted all ${maxRetries} retries`,
      }),
    }).catch(() => {}); // Fire-and-forget
  }
}

// Fix: PRO-78 — SSRF protection: reject private/internal URLs
function isPrivateUrl(url: string): boolean {
  try {
    const parsed = new URL(url);

    // Require HTTPS
    if (parsed.protocol !== "https:") return true;

    const hostname = parsed.hostname.toLowerCase();

    // Reject localhost
    if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1") return true;

    // Reject private IP ranges
    const parts = hostname.split(".");
    if (parts.length === 4 && parts.every((p) => /^\d+$/.test(p))) {
      const octets = parts.map(Number);
      // 10.0.0.0/8
      if (octets[0] === 10) return true;
      // 172.16.0.0/12
      if (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) return true;
      // 192.168.0.0/16
      if (octets[0] === 192 && octets[1] === 168) return true;
      // 127.0.0.0/8
      if (octets[0] === 127) return true;
      // 169.254.0.0/16 (link-local)
      if (octets[0] === 169 && octets[1] === 254) return true;
    }

    return false;
  } catch {
    // Invalid URL — treat as private
    return true;
  }
}

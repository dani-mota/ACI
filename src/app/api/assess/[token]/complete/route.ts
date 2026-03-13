import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { runScoringPipeline } from "@/lib/assessment/scoring/pipeline";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { createLogger } from "@/lib/assessment/logger";

const log = createLogger("complete-route");

interface RouteParams {
  params: Promise<{ token: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const { token } = await params;

  // Rate limit by token
  const rl = checkRateLimit(`complete:${token}`, RATE_LIMITS.assessmentComplete);
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

  const assessment = await prisma.assessment.findFirst({
    where: { candidateId: invitation.candidateId },
    orderBy: { startedAt: "desc" },
  });

  if (!assessment) {
    return NextResponse.json({ error: "Assessment not found" }, { status: 404 });
  }

  if (assessment.completedAt) {
    return NextResponse.json({ message: "Already completed" });
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

  if (!updated) {
    return NextResponse.json({ message: "Already completed" });
  }

  // Run scoring pipeline asynchronously with retry — don't block the candidate's completion response
  runPipelineWithRetry(assessment.id);

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
  try {
    const assessment = await prisma.assessment.findUnique({
      where: { id: assessmentId },
      select: { candidateId: true },
    });
    if (assessment) {
      await prisma.candidate.update({
        where: { id: assessment.candidateId },
        data: { status: "ERROR" as any },
      });
    }
  } catch {
    // Best effort — don't throw from error handler
  }

  // Fire-and-forget webhook notification for admin alerting
  const webhookUrl = process.env.SCORING_FAILURE_WEBHOOK_URL;
  if (webhookUrl) {
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

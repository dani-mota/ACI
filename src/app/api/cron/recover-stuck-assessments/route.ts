import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { runScoringPipeline } from "@/lib/assessment/scoring/pipeline";
import { createLogger } from "@/lib/assessment/logger";
import * as Sentry from "@sentry/nextjs"; // Fix: PRO-74

export const maxDuration = 300;

const log = createLogger("recover-stuck-assessments");

/**
 * GET /api/cron/recover-stuck-assessments
 * Fix: PRO-5 — Recovery cron that finds assessments stuck in split-brain state
 * (isComplete=true on AssessmentState, but completedAt=null on Assessment)
 * and triggers the scoring pipeline for each.
 */
export async function GET(request: NextRequest) {
  // Fix: PRO-65 — explicit null guard prevents "Bearer undefined" bypass
  const secret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("Authorization");
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);

  // Find assessments where the engine marked complete but the completion
  // handoff never finished (split-brain state)
  const stuck = await prisma.assessment.findMany({
    where: {
      completedAt: null,
      assessmentState: { isComplete: true },
      startedAt: { lt: twoMinutesAgo },
    },
    include: {
      candidate: true,
      assessmentState: true,
    },
  });

  if (stuck.length === 0) {
    return NextResponse.json({ recovered: 0 });
  }

  log.info("Found stuck assessments", { count: stuck.length });

  const results: { assessmentId: string; status: "recovered" | "failed" }[] = [];

  for (const assessment of stuck) {
    try {
      const now = new Date();
      const durationMinutes = Math.round(
        (now.getTime() - assessment.startedAt.getTime()) / 60000
      );

      // Atomic completion — skip if another process already completed it
      const updated = await prisma.$transaction(async (tx) => {
        const fresh = await tx.assessment.findUnique({
          where: { id: assessment.id },
          select: { completedAt: true },
        });
        if (fresh?.completedAt) return false;

        await tx.assessment.update({
          where: { id: assessment.id },
          data: { completedAt: now, durationMinutes },
        });

        // Update invitation status
        const invitation = await tx.assessmentInvitation.findFirst({
          where: { candidateId: assessment.candidateId },
        });
        if (invitation) {
          await tx.assessmentInvitation.update({
            where: { id: invitation.id },
            data: { status: "COMPLETED" },
          });
        }

        await tx.candidate.update({
          where: { id: assessment.candidateId },
          data: { status: "SCORING" },
        });

        return true;
      });

      if (!updated) {
        log.info("Assessment already recovered by another process", { assessmentId: assessment.id });
        results.push({ assessmentId: assessment.id, status: "recovered" });
        continue;
      }

      // Run scoring pipeline
      await runScoringPipeline(assessment.id);

      log.info("Successfully recovered stuck assessment", { assessmentId: assessment.id });
      results.push({ assessmentId: assessment.id, status: "recovered" });
    } catch (err) {
      log.error("Failed to recover assessment", {
        assessmentId: assessment.id,
        error: String(err),
      });
      // Fix: PRO-74 — report per-assessment recovery failure to Sentry
      Sentry.captureException(err, { extra: { assessmentId: assessment.id } });
      results.push({ assessmentId: assessment.id, status: "failed" });
    }
  }

  // Fix: PRO-19 — Also recover assessments where completedAt is set but scoring
  // never ran (Vercel after() callback was dropped). These have completedAt but
  // no CompositeScore record.
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
  const unscoredAssessments = await prisma.assessment.findMany({
    where: {
      completedAt: { not: null, lt: tenMinutesAgo },
      compositeScores: { none: {} },
    },
    take: 20, // Process in batches to avoid timeout
  });

  for (const assessment of unscoredAssessments) {
    try {
      await runScoringPipeline(assessment.id);
      log.info("Recovered unscored assessment (PRO-19)", { assessmentId: assessment.id });
      results.push({ assessmentId: assessment.id, status: "recovered" });
    } catch (err) {
      log.error("Failed to score recovered assessment", {
        assessmentId: assessment.id,
        error: String(err),
      });
      // Fix: PRO-74 — report per-assessment scoring failure to Sentry
      Sentry.captureException(err, { extra: { assessmentId: assessment.id } });
      results.push({ assessmentId: assessment.id, status: "failed" });
    }
  }

  return NextResponse.json({
    recovered: results.filter((r) => r.status === "recovered").length,
    failed: results.filter((r) => r.status === "failed").length,
    details: results,
  });
}

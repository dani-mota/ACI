import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { runScoringPipeline } from "@/lib/assessment/scoring/pipeline";
import * as Sentry from "@sentry/nextjs"; // Fix: PRO-74
import { withApiHandler } from "@/lib/api-handler";

export const maxDuration = 300;

/**
 * GET /api/cron/recover-stuck-assessments
 * Fix: PRO-5 — Recovery cron that finds assessments stuck in split-brain state
 * (isComplete=true on AssessmentState, but completedAt=null on Assessment)
 * and triggers the scoring pipeline for each.
 */
export const GET = withApiHandler(
  async (req) => {
    // Fix: PRO-65 — explicit null guard prevents "Bearer undefined" bypass
    const secret = process.env.CRON_SECRET;
    const authHeader = req.headers.get("Authorization");
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
          results.push({ assessmentId: assessment.id, status: "recovered" });
          continue;
        }

        // Run scoring pipeline
        await runScoringPipeline(assessment.id, assessment.candidate.orgId);

        results.push({ assessmentId: assessment.id, status: "recovered" });
      } catch (err) {
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
      include: { candidate: { select: { orgId: true } } },
      take: 100, // PRO-124: Fetch more, then cap per-org below
    });

    // PRO-124: Per-org batching — max 5 per org per cron run
    const perOrgCounts = new Map<string, number>();
    const cappedAssessments = unscoredAssessments.filter((a) => {
      const org = a.candidate.orgId;
      const count = perOrgCounts.get(org) ?? 0;
      if (count >= 5) return false;
      perOrgCounts.set(org, count + 1);
      return true;
    });

    for (const assessment of cappedAssessments) {
      try {
        await runScoringPipeline(assessment.id, assessment.candidate.orgId);
        results.push({ assessmentId: assessment.id, status: "recovered" });
      } catch (err) {
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
  },
  { module: "cron/recover-stuck-assessments" }
);

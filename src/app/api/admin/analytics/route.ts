import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";

/**
 * GET /api/admin/analytics
 * Returns assessment analytics: completion rates, drop-off, classification distribution, cost.
 * Restricted to TA_LEADER and ADMIN roles.
 */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!["TA_LEADER", "ADMIN"].includes(session.user.role)) {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  const orgId = session.user.orgId;
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  // 1. Completion metrics
  const [totalStarted, totalCompleted, avgDuration] = await Promise.all([
    prisma.assessment.count({
      where: {
        candidate: { orgId },
        startedAt: { gte: thirtyDaysAgo },
      },
    }),
    prisma.assessment.count({
      where: {
        candidate: { orgId },
        completedAt: { not: null },
        startedAt: { gte: thirtyDaysAgo },
      },
    }),
    prisma.assessment.aggregate({
      where: {
        candidate: { orgId },
        completedAt: { not: null },
        startedAt: { gte: thirtyDaysAgo },
      },
      _avg: { durationMinutes: true },
    }),
  ]);

  // 2. Drop-off by act (incomplete assessments)
  const incompleteStates = await prisma.assessmentState.findMany({
    where: {
      assessment: {
        candidate: { orgId },
        completedAt: null,
        startedAt: { gte: thirtyDaysAgo },
      },
    },
    select: { currentAct: true },
  });

  const dropOff: Record<string, number> = { ACT_1: 0, ACT_2: 0, ACT_3: 0 };
  for (const s of incompleteStates) {
    dropOff[s.currentAct] = (dropOff[s.currentAct] ?? 0) + 1;
  }

  // 3. Classification distribution (from message metadata)
  const classifiedMessages = await prisma.conversationMessage.findMany({
    where: {
      assessment: {
        candidate: { orgId },
        startedAt: { gte: thirtyDaysAgo },
      },
      act: "ACT_1",
      metadata: { path: ["classification"], not: "null" as any },
    },
    select: { metadata: true },
  });

  const classificationDist: Record<string, number> = { STRONG: 0, ADEQUATE: 0, WEAK: 0 };
  for (const msg of classifiedMessages) {
    const classification = (msg.metadata as Record<string, unknown>)?.classification as string;
    if (classification && classification in classificationDist) {
      classificationDist[classification]++;
    }
  }
  const classTotal = Object.values(classificationDist).reduce((a, b) => a + b, 0);

  // 4. Scoring pipeline health
  const costAgg = await prisma.assessment.aggregate({
    where: {
      candidate: { orgId },
      completedAt: { not: null },
      startedAt: { gte: thirtyDaysAgo },
      scoringCostUsd: { not: null },
    },
    _sum: { scoringCostUsd: true },
    _avg: { scoringCostUsd: true },
    _count: true,
  });

  return NextResponse.json({
    period: { from: thirtyDaysAgo.toISOString(), to: new Date().toISOString() },
    completion: {
      totalStarted,
      totalCompleted,
      completionRate: totalStarted > 0 ? Math.round((totalCompleted / totalStarted) * 100) : 0,
      avgDurationMinutes: Math.round(avgDuration._avg.durationMinutes ?? 0),
    },
    dropOff,
    classification: {
      ...classificationDist,
      total: classTotal,
      strongPct: classTotal > 0 ? Math.round((classificationDist.STRONG / classTotal) * 100) : 0,
      adequatePct: classTotal > 0 ? Math.round((classificationDist.ADEQUATE / classTotal) * 100) : 0,
      weakPct: classTotal > 0 ? Math.round((classificationDist.WEAK / classTotal) * 100) : 0,
    },
    scoring: {
      pipelineRuns: costAgg._count,
      totalCostUsd: Math.round((costAgg._sum.scoringCostUsd ?? 0) * 100) / 100,
      avgCostUsd: Math.round((costAgg._avg.scoringCostUsd ?? 0) * 100) / 100,
    },
  });
}

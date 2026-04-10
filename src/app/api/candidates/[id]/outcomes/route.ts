import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { withApiHandler } from "@/lib/api-handler";

const ALLOWED_ROLES = ["RECRUITING_MANAGER", "TA_LEADER", "ADMIN"];

export const POST = withApiHandler(
  async (req, ctx) => {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!ALLOWED_ROLES.includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id: candidateId } = await ctx.params;

    const candidate = await prisma.candidate.findUnique({ where: { id: candidateId } });
    if (!candidate) {
      return NextResponse.json({ error: "Candidate not found" }, { status: 404 });
    }
    if (candidate.orgId !== session.user.orgId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { metricType, metricValue, observedAt, notes } = body;

    if (!metricType || metricValue === undefined || !observedAt) {
      return NextResponse.json(
        { error: "metricType, metricValue, and observedAt are required" },
        { status: 400 }
      );
    }

    const outcome = await prisma.outcomeRecord.create({
      data: {
        candidateId,
        metricType,
        metricValue: parseFloat(metricValue),
        notes: notes || null,
        recordedBy: session.user.id,
        observedAt: new Date(observedAt),
      },
    });

    await prisma.activityLog.create({
      data: {
        entityType: "OutcomeRecord",
        entityId: outcome.id,
        action: "CREATE",
        actorId: session.user.id,
        metadata: { candidateId, metricType, metricValue },
      },
    });

    return NextResponse.json(outcome, { status: 201 });
  },
  { module: "candidates/[id]/outcomes" }
);

export const GET = withApiHandler(
  async (_req, ctx) => {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!ALLOWED_ROLES.includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id: candidateId } = await ctx.params;

    const candidate = await prisma.candidate.findUnique({ where: { id: candidateId } });
    if (!candidate || candidate.orgId !== session.user.orgId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const outcomes = await prisma.outcomeRecord.findMany({
      where: { candidateId },
      orderBy: { observedAt: "desc" },
    });

    return NextResponse.json(outcomes);
  },
  { module: "candidates/[id]/outcomes" }
);

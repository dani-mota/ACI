import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { canManageTeam } from "@/lib/rbac";
import { withApiHandler } from "@/lib/api-handler";

export const GET = withApiHandler(
  async (_req, ctx) => {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!canManageTeam(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id: candidateId } = await ctx.params;

    const candidate = await prisma.candidate.findUnique({
      where: { id: candidateId },
      select: { orgId: true },
    });
    if (!candidate || candidate.orgId !== session.user.orgId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const assignments = await prisma.candidateAssignment.findMany({
      where: { candidateId },
      include: { user: { select: { id: true, name: true, email: true, role: true } } },
    });

    return NextResponse.json(assignments);
  },
  { module: "candidates/[id]/assignments" }
);

export const POST = withApiHandler(
  async (req, ctx) => {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!canManageTeam(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id: candidateId } = await ctx.params;

    const candidate = await prisma.candidate.findUnique({
      where: { id: candidateId },
      select: { orgId: true },
    });
    if (!candidate || candidate.orgId !== session.user.orgId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const body = await req.json();
    const { userId } = body;

    if (!userId || typeof userId !== "string") {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    // Verify user belongs to same org
    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { orgId: true, role: true },
    });
    if (!targetUser || targetUser.orgId !== session.user.orgId) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const assignment = await prisma.candidateAssignment.upsert({
      where: { candidateId_userId: { candidateId, userId } },
      create: { candidateId, userId },
      update: {},
      include: { user: { select: { id: true, name: true, email: true, role: true } } },
    });

    return NextResponse.json(assignment, { status: 201 });
  },
  { module: "candidates/[id]/assignments" }
);

export const DELETE = withApiHandler(
  async (req, ctx) => {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!canManageTeam(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id: candidateId } = await ctx.params;

    const candidate = await prisma.candidate.findUnique({
      where: { id: candidateId },
      select: { orgId: true },
    });
    if (!candidate || candidate.orgId !== session.user.orgId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const body = await req.json();
    const { userId } = body;

    if (!userId || typeof userId !== "string") {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    await prisma.candidateAssignment.deleteMany({
      where: { candidateId, userId },
    });

    return NextResponse.json({ success: true });
  },
  { module: "candidates/[id]/assignments" }
);

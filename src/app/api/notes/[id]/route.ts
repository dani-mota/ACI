import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { isExternalCollaborator } from "@/lib/rbac";
import { withApiHandler } from "@/lib/api-handler";

export const PATCH = withApiHandler(
  async (req, ctx) => {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (isExternalCollaborator(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await ctx.params;

    // Verify note belongs to a candidate in the caller's org
    const note = await prisma.note.findUnique({
      where: { id },
      include: { candidate: { select: { orgId: true } } },
    });
    if (!note || note.candidate.orgId !== session.user.orgId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const body = await req.json();
    const { content } = body;

    if (!content?.trim()) {
      return NextResponse.json({ error: "Content is required" }, { status: 400 });
    }

    const updated = await prisma.note.update({
      where: { id },
      data: { content: content.trim() },
      include: { author: true },
    });

    return NextResponse.json(updated);
  },
  { module: "notes/[id]" }
);

export const DELETE = withApiHandler(
  async (_req, ctx) => {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (isExternalCollaborator(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await ctx.params;

    // Verify note belongs to a candidate in the caller's org
    const note = await prisma.note.findUnique({
      where: { id },
      include: { candidate: { select: { orgId: true } } },
    });
    if (!note || note.candidate.orgId !== session.user.orgId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await prisma.note.delete({ where: { id } });

    return NextResponse.json({ success: true });
  },
  { module: "notes/[id]" }
);

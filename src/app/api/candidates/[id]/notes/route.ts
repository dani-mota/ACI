import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { isExternalCollaborator } from "@/lib/rbac";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (isExternalCollaborator(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: candidateId } = await params;

  // Verify candidate belongs to the caller's org
  const candidate = await prisma.candidate.findUnique({
    where: { id: candidateId },
    select: { orgId: true },
  });
  if (!candidate || candidate.orgId !== session.user.orgId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await request.json();
  const { content } = body;

  if (!content?.trim()) {
    return NextResponse.json({ error: "Content is required" }, { status: 400 });
  }

  const note = await prisma.note.create({
    data: {
      candidateId,
      authorId: session.user.id,
      content: content.trim(),
    },
    include: { author: true },
  });

  return NextResponse.json(note, { status: 201 });
}

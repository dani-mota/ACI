import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { runScoringPipeline } from "@/lib/assessment/pipeline";

interface RouteParams {
  params: Promise<{ token: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const { token } = await params;

  const invitation = await prisma.assessmentInvitation.findUnique({
    where: { linkToken: token },
  });

  if (!invitation) {
    return NextResponse.json({ error: "Invalid token" }, { status: 404 });
  }

  const assessment = await prisma.assessment.findUnique({
    where: { candidateId: invitation.candidateId },
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

  await prisma.$transaction(async (tx) => {
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
  });

  // Run scoring pipeline asynchronously — don't block the candidate's completion response
  runScoringPipeline(assessment.id).catch((err) => {
    console.error(`Scoring pipeline failed for assessment ${assessment.id}:`, err);
  });

  return NextResponse.json({ success: true, durationMinutes });
}

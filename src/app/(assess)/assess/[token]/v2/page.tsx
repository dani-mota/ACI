import prisma from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";
import { AssessmentStage } from "@/components/assessment/stage/assessment-stage";

interface PageProps {
  params: Promise<{ token: string }>;
}

export default async function AssessmentV2Page({ params }: PageProps) {
  const { token } = await params;

  const invitation = await prisma.assessmentInvitation.findUnique({
    where: { linkToken: token },
    include: {
      candidate: { include: { org: true } },
      role: true,
    },
  });

  if (!invitation) notFound();

  // Expired — redirect back to welcome (which shows expired screen)
  if (invitation.status === "EXPIRED" || new Date() > invitation.expiresAt) {
    redirect(`/assess/${token}`);
  }

  // Must have a started assessment
  const assessment = await prisma.assessment.findUnique({
    where: { candidateId: invitation.candidateId },
  });

  if (!assessment) {
    redirect(`/assess/${token}`);
  }

  // Already completed
  if (assessment.completedAt) {
    redirect(`/assess/${token}`);
  }

  // Ensure AssessmentState exists
  const existingState = await prisma.assessmentState.findUnique({
    where: { assessmentId: assessment.id },
  });

  if (!existingState) {
    await prisma.assessmentState.create({
      data: {
        assessmentId: assessment.id,
        currentAct: "ACT_1",
        currentScenario: 0,
        currentBeat: 0,
      },
    });
  }

  return (
    <AssessmentStage
      token={token}
      assessmentId={assessment.id}
      candidateName={invitation.candidate.firstName}
      companyName={invitation.candidate.org.name}
    />
  );
}

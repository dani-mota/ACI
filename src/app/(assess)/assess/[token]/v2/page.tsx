import prisma from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";
import { AssessmentStage } from "@/components/assessment/stage/assessment-stage";
import { AssessmentErrorBoundary } from "@/components/assessment/error-boundary";
import { getReadyLibrary, selectRandomVariants } from "@/lib/assessment/content-serving";

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

  // Fix: PRO-63 — record when the candidate first opens the assessment link
  if (!invitation.linkOpenedAt) {
    prisma.assessmentInvitation.updateMany({
      where: { linkToken: token, linkOpenedAt: null },
      data: { linkOpenedAt: new Date() },
    }).catch(() => {}); // non-blocking, fire-and-forget
  }

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
    let contentLibraryId: string | undefined;
    let variantSelections: Record<string, number> | undefined;

    const readyLib = await getReadyLibrary(invitation.roleId);
    if (readyLib) {
      contentLibraryId = readyLib.id;
      variantSelections = selectRandomVariants(readyLib.content as any);
    }

    await prisma.assessmentState.create({
      data: {
        assessmentId: assessment.id,
        currentAct: "PHASE_0",
        currentScenario: 0,
        currentBeat: 0,
        ...(contentLibraryId ? { contentLibraryId, variantSelections } : {}),
      },
    });
  }

  return (
    <AssessmentErrorBoundary>
      <AssessmentStage
        token={token}
        assessmentId={assessment.id}
        candidateName={invitation.candidate.firstName}
        companyName={invitation.candidate.org.name}
      />
    </AssessmentErrorBoundary>
  );
}

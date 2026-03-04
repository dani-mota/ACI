import prisma from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";
import { ITEM_BANK } from "@/lib/assessment/items";
import { shuffleItems } from "@/lib/assessment/randomize";
import { ASSESSMENT_BLOCKS } from "@/lib/assessment/blocks";
import { AssessmentShell } from "@/components/assess/assessment-shell";

interface PageProps {
  params: Promise<{ token: string; blockIndex: string }>;
}

export default async function AssessmentBlockPage({ params }: PageProps) {
  const { token, blockIndex: blockIndexStr } = await params;
  const blockIndex = parseInt(blockIndexStr, 10);

  if (isNaN(blockIndex) || blockIndex < 0 || blockIndex >= ASSESSMENT_BLOCKS.length) {
    notFound();
  }

  const invitation = await prisma.assessmentInvitation.findUnique({
    where: { linkToken: token },
    include: { candidate: { include: { primaryRole: true } } },
  });

  if (!invitation) notFound();

  if (invitation.status === "EXPIRED" || new Date() > invitation.expiresAt) {
    redirect(`/assess/${token}`);
  }

  const assessment = await prisma.assessment.findUnique({
    where: { candidateId: invitation.candidateId },
  });

  if (!assessment) {
    redirect(`/assess/${token}`);
  }

  // Get items for this block, shuffled deterministically per candidate
  const blockItems = ITEM_BANK.filter((item) => item.blockIndex === blockIndex);
  const shuffled = shuffleItems(blockItems, `${invitation.candidateId}-${blockIndex}`);

  return (
    <AssessmentShell
      token={token}
      assessmentId={assessment.id}
      blockIndex={blockIndex}
      items={shuffled}
      roleId={invitation.candidate.primaryRole?.id}
    />
  );
}

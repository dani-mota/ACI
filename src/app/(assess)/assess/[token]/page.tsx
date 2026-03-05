import prisma from "@/lib/prisma";
import { notFound } from "next/navigation";
import { WelcomeScreen } from "@/components/assess/welcome-screen";
import { ExpiredScreen } from "@/components/assess/expired-screen";

interface PageProps {
  params: Promise<{ token: string }>;
}

export default async function AssessmentWelcomePage({ params }: PageProps) {
  const { token } = await params;

  const invitation = await prisma.assessmentInvitation.findUnique({
    where: { linkToken: token },
    include: {
      candidate: { include: { org: true } },
      role: true,
    },
  });

  if (!invitation) notFound();

  // Mark link as opened
  if (!invitation.linkOpenedAt) {
    await prisma.assessmentInvitation.update({
      where: { id: invitation.id },
      data: { linkOpenedAt: new Date() },
    });
  }

  // Check if expired
  if (invitation.status === "EXPIRED" || new Date() > invitation.expiresAt) {
    if (invitation.status !== "EXPIRED") {
      await prisma.assessmentInvitation.update({
        where: { id: invitation.id },
        data: { status: "EXPIRED" },
      });
    }
    return <ExpiredScreen companyName={invitation.candidate.org.name} />;
  }

  // Always check assessment status for this candidate (regardless of invitation status)
  const assessment = await prisma.assessment.findUnique({
    where: { candidateId: invitation.candidateId },
  });

  if (assessment?.completedAt) {
    return (
      <div className="max-w-lg mx-auto mt-24 p-8 bg-card border border-border text-center">
        <h1 className="text-lg font-bold text-foreground mb-2" style={{ fontFamily: "var(--font-dm-sans)" }}>
          Assessment Complete
        </h1>
        <p className="text-xs text-muted-foreground">
          You have already completed this assessment. Results will be shared by the recruiting team.
        </p>
      </div>
    );
  }

  // Assessment started but not completed — show continue button
  if (assessment) {
    return (
      <div className="max-w-lg mx-auto mt-24 p-8 bg-card border border-border text-center">
        <h1 className="text-lg font-bold text-foreground mb-2" style={{ fontFamily: "var(--font-dm-sans)" }}>
          Assessment In Progress
        </h1>
        <p className="text-xs text-muted-foreground mb-4">
          You have an assessment in progress. Click below to continue.
        </p>
        <a
          href={`/assess/${token}/v2`}
          className="inline-block bg-aci-gold text-aci-navy font-bold text-sm px-6 py-3 uppercase tracking-wider hover:bg-aci-gold/90 transition-colors"
        >
          Continue Assessment
        </a>
      </div>
    );
  }

  return (
    <WelcomeScreen
      token={token}
      candidateName={invitation.candidate.firstName}
      roleName={invitation.role.name}
      companyName={invitation.candidate.org.name}
    />
  );
}

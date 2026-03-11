import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const org = await prisma.organization.findFirstOrThrow({
    where: { slug: "atlas-defense", isDemo: true },
  });

  const admin = await prisma.user.findFirstOrThrow({ where: { orgId: org.id } });

  const candidate = await prisma.candidate.findFirstOrThrow({
    where: { orgId: org.id },
    include: { primaryRole: true },
  });

  // Clear any existing invitations so there's no conflict
  await prisma.assessmentInvitation.deleteMany({ where: { candidateId: candidate.id } });

  // Also clear any existing assessment so it starts fresh
  await prisma.assessment.deleteMany({ where: { candidateId: candidate.id } });

  const inv = await prisma.assessmentInvitation.create({
    data: {
      candidateId: candidate.id,
      roleId: candidate.primaryRoleId,
      invitedBy: admin.id,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });

  console.log(`\nCandidate : ${candidate.firstName} ${candidate.lastName}`);
  console.log(`Role      : ${candidate.primaryRole.name}`);
  console.log(`\nTest URL  : http://localhost:3000/assess/${inv.linkToken}\n`);
}

main().catch(console.error).finally(() => prisma.$disconnect());

import "dotenv/config";
import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const org = await prisma.organization.findFirstOrThrow({
    where: { slug: "atlas-defense", isDemo: true },
  });

  const admin = await prisma.user.findFirstOrThrow({ where: { orgId: org.id } });

  const candidate = await prisma.candidate.findFirstOrThrow({
    where: { orgId: org.id },
    include: { primaryRole: true },
  });

  // Clear existing invitations and assessment (cascade in dependency order)
  await prisma.assessmentInvitation.deleteMany({ where: { candidateId: candidate.id } });
  const existing = await prisma.assessment.findUnique({ where: { candidateId: candidate.id } });
  if (existing) {
    await prisma.aIInteraction.deleteMany({ where: { assessmentId: existing.id } });
    await prisma.redFlag.deleteMany({ where: { assessmentId: existing.id } });
    await prisma.prediction.deleteMany({ where: { assessmentId: existing.id } });
    await prisma.compositeScore.deleteMany({ where: { assessmentId: existing.id } });
    await prisma.subtestResult.deleteMany({ where: { assessmentId: existing.id } });
    await prisma.assessment.delete({ where: { id: existing.id } });
  }

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

main().catch(console.error).finally(() => prisma.$disconnect().then(() => pool.end()));

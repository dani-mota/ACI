import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const org = await prisma.organization.findFirstOrThrow({
    where: { slug: "arklight" },
  });

  const admin = await prisma.user.findFirstOrThrow({ where: { orgId: org.id } });

  const candidate = await prisma.candidate.findFirstOrThrow({
    where: {
      orgId: org.id,
      firstName: "Daniel",
      primaryRole: { name: "Factory Technician" },
    },
    include: { primaryRole: true },
    orderBy: { createdAt: "desc" },
  });

  // Clear existing assessments
  const existingAssessments = await prisma.assessment.findMany({
    where: { candidateId: candidate.id },
    select: { id: true },
  });
  const assessmentIds = existingAssessments.map((a) => a.id);

  if (assessmentIds.length > 0) {
    await prisma.aIEvaluationRun.deleteMany({ where: { assessmentId: { in: assessmentIds } } });
    await prisma.assessmentState.deleteMany({ where: { assessmentId: { in: assessmentIds } } });
    await prisma.conversationMessage.deleteMany({ where: { assessmentId: { in: assessmentIds } } });
    await prisma.postAssessmentSurvey.deleteMany({ where: { assessmentId: { in: assessmentIds } } });
    await prisma.itemResponse.deleteMany({ where: { assessmentId: { in: assessmentIds } } });
    await prisma.redFlag.deleteMany({ where: { assessmentId: { in: assessmentIds } } });
    await prisma.prediction.deleteMany({ where: { assessmentId: { in: assessmentIds } } });
    await prisma.aIInteraction.deleteMany({ where: { assessmentId: { in: assessmentIds } } });
    await prisma.compositeScore.deleteMany({ where: { assessmentId: { in: assessmentIds } } });
    await prisma.subtestResult.deleteMany({ where: { assessmentId: { in: assessmentIds } } });
    await prisma.assessment.deleteMany({ where: { id: { in: assessmentIds } } });
  }

  await prisma.assessmentInvitation.deleteMany({ where: { candidateId: candidate.id } });

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

main().catch(console.error).finally(async () => {
  await prisma.$disconnect();
  await pool.end();
});

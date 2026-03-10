import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const TOKEN = "cmmfgc0lx00097yulfpbq6ohe";

async function reset() {
  const inv = await prisma.assessmentInvitation.findUnique({
    where: { linkToken: TOKEN },
    include: { candidate: true },
  });
  if (!inv) {
    console.log("Token not found");
    process.exit(1);
  }
  console.log("Resetting:", inv.candidate.firstName, inv.candidate.lastName, "| Status:", inv.status);

  // Delete assessment and related data
  const assessment = await prisma.assessment.findUnique({ where: { candidateId: inv.candidateId } });
  if (assessment) {
    await prisma.conversationMessage.deleteMany({ where: { assessmentId: assessment.id } });
    await prisma.assessmentState.deleteMany({ where: { assessmentId: assessment.id } });
    await prisma.assessment.delete({ where: { id: assessment.id } });
    console.log("Deleted assessment + messages + state");
  }

  // Reset invitation to PENDING
  await prisma.assessmentInvitation.update({
    where: { id: inv.id },
    data: { status: "PENDING", linkOpenedAt: null },
  });

  console.log("Done — fresh assessment ready.");
  await pool.end();
}

reset().catch((e) => {
  console.error(e);
  process.exit(1);
});

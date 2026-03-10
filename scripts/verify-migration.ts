import { config } from "dotenv";
config({ path: ".env.local" });

import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

async function verify() {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  // Test ContentLibrary table exists
  const count = await prisma.contentLibrary.count();
  console.log("ContentLibrary table exists, count:", count);

  // Test AssessmentState has new columns
  const state = await prisma.assessmentState.findFirst({
    select: { contentLibraryId: true, variantSelections: true },
  });
  console.log("AssessmentState new columns accessible: YES");
  console.log("Sample state:", state);

  // List all roles
  const roles = await prisma.role.findMany({
    select: { id: true, name: true, slug: true, isGeneric: true, orgId: true },
  });
  console.log("\nRoles in system:");
  for (const r of roles) {
    console.log(`  ${r.name} (${r.slug}) - generic: ${r.isGeneric}, id: ${r.id}`);
  }

  await prisma.$disconnect();
  await pool.end();
}

verify().catch((e) => {
  console.error(e);
  process.exit(1);
});

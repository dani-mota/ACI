import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const candidates = await prisma.candidate.findMany({
    include: { primaryRole: true, org: { select: { slug: true } } },
  });
  for (const c of candidates) {
    console.log(`${c.org.slug} | ${c.firstName} ${c.lastName} | ${c.primaryRole?.name ?? "(no role)"}`);
  }
}

main().catch(console.error).finally(async () => {
  await prisma.$disconnect();
  await pool.end();
});

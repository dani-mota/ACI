import "dotenv/config";
import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  let org = await prisma.organization.findFirst({ where: { name: "Arklight" } });
  if (!org) {
    org = await prisma.organization.create({ data: { name: "Arklight" } });
    console.log("Created org:", org.id);
  } else {
    console.log("Found existing org:", org.id);
  }

  const user = await prisma.user.upsert({
    where: { supabaseId: "78eb5647-57ef-466b-8044-c73e1c596c09" },
    update: { role: "ADMIN" },
    create: {
      supabaseId: "78eb5647-57ef-466b-8044-c73e1c596c09",
      email: "dani@arklight.us",
      name: "Dani Mota",
      role: "ADMIN",
      orgId: org.id,
    },
  });

  console.log("✅ Admin user ready:", user.email, "|", user.role, "| id:", user.id);
}

main().catch(console.error).finally(() => prisma.$disconnect());

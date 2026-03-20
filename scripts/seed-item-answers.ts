/**
 * Seed script for Act2ItemAnswer table (PRO-66).
 *
 * Reads answers.json and upserts each entry into the database.
 * Run via: npx tsx scripts/seed-item-answers.ts
 */

import fs from "fs";
import path from "path";
import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";

const ANSWERS_PATH = path.resolve(__dirname, "../answers.json");

interface AnswerEntry {
  itemId: string;
  correctAnswer: string;
}

interface AnswersFile {
  items: AnswerEntry[];
}

async function main() {
  if (!fs.existsSync(ANSWERS_PATH)) {
    console.error(`answers.json not found at ${ANSWERS_PATH}`);
    console.error("Copy answers.json.example to answers.json and fill in the correct answers.");
    process.exit(1);
  }

  const raw = fs.readFileSync(ANSWERS_PATH, "utf-8");
  const data: AnswersFile = JSON.parse(raw);

  if (!data.items || !Array.isArray(data.items)) {
    console.error("Invalid answers.json format. Expected { items: [...] }");
    process.exit(1);
  }

  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    max: 1,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 5_000,
  });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  console.log(`Seeding ${data.items.length} item answers...`);

  let upserted = 0;
  for (const entry of data.items) {
    await prisma.act2ItemAnswer.upsert({
      where: { itemId: entry.itemId },
      update: { correctAnswer: entry.correctAnswer },
      create: { itemId: entry.itemId, correctAnswer: entry.correctAnswer },
    });
    upserted++;
  }

  console.log(`Done. Upserted ${upserted} item answers.`);

  await prisma.$disconnect();
  await pool.end();
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});

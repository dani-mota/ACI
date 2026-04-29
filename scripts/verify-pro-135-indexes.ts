#!/usr/bin/env -S npx tsx
/**
 * PRO-135: One-shot verification that the RoleDemandProfile table and indexes
 * (especially the functional partial index) exist as expected. Run after the
 * migration applies. Not shipped — verification artifact only.
 *
 * Usage:
 *   npx tsx scripts/verify-pro-135-indexes.ts
 */

import "dotenv/config";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local", override: true });

import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

interface IndexRow {
  indexname: string;
  indexdef: string;
}

async function main() {
  // 1. Indexes on the new table.
  const indexes = await prisma.$queryRaw<IndexRow[]>`
    SELECT indexname, indexdef
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'RoleDemandProfile'
    ORDER BY indexname;
  `;

  console.log("RoleDemandProfile indexes:");
  for (const idx of indexes) {
    console.log(`  - ${idx.indexname}`);
    console.log(`    ${idx.indexdef}`);
  }
  console.log("");

  const expected = [
    "RoleDemandProfile_pkey",
    "RoleDemandProfile_orgId_roleFamily_idx",
    "RoleDemandProfile_orgId_lowerRoleFamily_idx",
  ];
  const actual = new Set(indexes.map((i) => i.indexname));
  const missing = expected.filter((e) => !actual.has(e));

  if (missing.length > 0) {
    console.error("✗ Missing indexes:", missing);
    process.exit(1);
  }

  // 2. Confirm the partial-index predicate is on the functional index.
  const fnIdx = indexes.find((i) => i.indexname === "RoleDemandProfile_orgId_lowerRoleFamily_idx");
  if (!fnIdx?.indexdef.includes("lower")) {
    console.error("✗ Functional index does not contain LOWER() expression");
    process.exit(1);
  }
  if (!fnIdx?.indexdef.includes("isTemplate")) {
    console.error("✗ Functional index is missing the partial-index WHERE isTemplate clause");
    process.exit(1);
  }

  // 3. EXPLAIN the canonical resolver query and report the plan.
  const plan = await prisma.$queryRaw<{ "QUERY PLAN": string }[]>`
    EXPLAIN
    SELECT "id", "updatedAt", "constructScores"
    FROM "RoleDemandProfile"
    WHERE "orgId" = 'placeholder'
      AND LOWER("roleFamily") = LOWER('placeholder')
      AND "isTemplate" = false
    ORDER BY "updatedAt" DESC
    LIMIT 1;
  `;
  console.log("Resolver query plan:");
  for (const row of plan) {
    console.log("  " + row["QUERY PLAN"]);
  }
  console.log("");
  console.log("✓ All expected indexes present and functional index has LOWER() + partial predicate.");
  console.log("  (Note: with an empty table the planner may choose Seq Scan even when an index exists.");
  console.log("  At meaningful row counts, expect 'Index Scan using RoleDemandProfile_orgId_lowerRoleFamily_idx'.)");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

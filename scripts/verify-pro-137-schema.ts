/**
 * PRO-137 post-deploy gate: schema verification.
 *
 * Runbook: docs/runbooks/pro-137-prod-deploy.md
 *
 * HARD GATE. Exit non-zero on ANY discrepancy. Schema state is
 * deterministic — either the table + indexes + FK exist with the
 * expected shape, or the migration didn't land and the deploy is unsafe.
 *
 * Checks:
 *   1. EmployeeInsights table exists
 *   2. assessmentId column: TEXT, NOT NULL
 *   3. underLeverageScore column: integer, nullable
 *   4. orgId column: TEXT, NOT NULL
 *   5. roleFamily column: TEXT, nullable
 *   6. profileId column: TEXT, nullable
 *   7. profileUpdatedAt column: timestamp, nullable
 *   8. EmployeeInsights_assessmentId_key unique index exists
 *   9. EmployeeInsights_orgId_roleFamily_idx index exists
 *  10. EmployeeInsights_orgId_underLeverageScore_idx index exists
 *  11. FK EmployeeInsights_assessmentId_fkey exists with ON DELETE CASCADE
 *
 * Usage:
 *   DATABASE_URL=<target-url> npx tsx scripts/verify-pro-137-schema.ts
 *
 * Verify $DATABASE_URL points where you think it does BEFORE running.
 */

import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

interface ColumnRow {
  column_name: string;
  data_type: string;
  is_nullable: string;
}

async function main() {
  const failures: string[] = [];

  // 1. EmployeeInsights table exists
  const tableRows = await prisma.$queryRaw<Array<{ table_name: string }>>`
    SELECT table_name FROM information_schema.tables
    WHERE table_name = 'EmployeeInsights' AND table_schema = 'public'
  `;
  if (tableRows.length === 0) {
    failures.push("EmployeeInsights table does not exist");
    // Fail fast — column checks won't be meaningful if the table is missing.
    finish(failures);
    return;
  }
  console.log("EmployeeInsights table: exists");

  // 2-7. Columns + nullability
  const columns = await prisma.$queryRaw<ColumnRow[]>`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'EmployeeInsights' AND table_schema = 'public'
    ORDER BY ordinal_position
  `;
  const colByName = new Map(columns.map((c) => [c.column_name, c]));
  console.log(`EmployeeInsights columns: ${columns.map((c) => c.column_name).join(", ")}`);

  const expectedCols: Array<{
    name: string;
    dataType: string;
    nullable: "YES" | "NO";
  }> = [
    { name: "id", dataType: "text", nullable: "NO" },
    { name: "assessmentId", dataType: "text", nullable: "NO" },
    { name: "underLeverageScore", dataType: "integer", nullable: "YES" },
    { name: "orgId", dataType: "text", nullable: "NO" },
    { name: "roleFamily", dataType: "text", nullable: "YES" },
    { name: "profileId", dataType: "text", nullable: "YES" },
    { name: "profileUpdatedAt", dataType: "timestamp without time zone", nullable: "YES" },
    { name: "createdAt", dataType: "timestamp without time zone", nullable: "NO" },
    { name: "updatedAt", dataType: "timestamp without time zone", nullable: "NO" },
  ];

  for (const expected of expectedCols) {
    const actual = colByName.get(expected.name);
    if (!actual) {
      failures.push(`EmployeeInsights.${expected.name} column does not exist`);
      continue;
    }
    if (actual.data_type !== expected.dataType) {
      failures.push(
        `EmployeeInsights.${expected.name} expected data_type=${expected.dataType}, got ${actual.data_type}`,
      );
    }
    if (actual.is_nullable !== expected.nullable) {
      failures.push(
        `EmployeeInsights.${expected.name} expected is_nullable=${expected.nullable}, got ${actual.is_nullable}`,
      );
    }
  }

  // 8-10. Indexes
  const indexes = await prisma.$queryRaw<Array<{ indexname: string }>>`
    SELECT indexname FROM pg_indexes
    WHERE tablename = 'EmployeeInsights' AND schemaname = 'public'
    ORDER BY indexname
  `;
  const indexNames = new Set(indexes.map((i) => i.indexname));
  console.log(`EmployeeInsights indexes: ${[...indexNames].join(", ")}`);

  const expectedIndexes = [
    "EmployeeInsights_assessmentId_key",
    "EmployeeInsights_orgId_roleFamily_idx",
    "EmployeeInsights_orgId_underLeverageScore_idx",
  ];
  for (const idx of expectedIndexes) {
    if (!indexNames.has(idx)) {
      failures.push(`Index ${idx} does not exist`);
    }
  }

  // 11. FK constraint exists with ON DELETE CASCADE
  const fks = await prisma.$queryRaw<Array<{ conname: string; def: string }>>`
    SELECT conname, pg_get_constraintdef(oid) AS def
    FROM pg_constraint
    WHERE conname = 'EmployeeInsights_assessmentId_fkey'
  `;
  if (fks.length === 0) {
    failures.push("EmployeeInsights_assessmentId_fkey FK does not exist");
  } else {
    const def = fks[0].def;
    if (!def.includes("ON DELETE CASCADE")) {
      failures.push(`EmployeeInsights_assessmentId_fkey missing ON DELETE CASCADE — got: ${def}`);
    }
  }

  // Sanity: table is queryable
  const rowCount = await prisma.employeeInsights.count();
  console.log(`\nTotal EmployeeInsights rows readable post-migration: ${rowCount}`);

  finish(failures);
}

function finish(failures: string[]) {
  console.log("");
  console.log("────────────────────────────────────────────────────────────");
  if (failures.length === 0) {
    console.log("✅ PRO-137 schema verification PASSED");
    console.log("────────────────────────────────────────────────────────────");
    process.exitCode = 0;
  } else {
    console.log(
      `❌ PRO-137 schema verification FAILED — ${failures.length} discrepanc${failures.length === 1 ? "y" : "ies"}:`,
    );
    for (const f of failures) console.log(`   • ${f}`);
    console.log("────────────────────────────────────────────────────────────");
    console.log("DO NOT proceed with the app-code deploy. Investigate the");
    console.log("migration state before continuing the runbook.");
    process.exitCode = 1;
  }
}

main()
  .catch((err) => {
    console.error("Verification script crashed:", err);
    process.exitCode = 2;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });

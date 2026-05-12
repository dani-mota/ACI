/**
 * PRO-133 post-deploy gate: schema verification.
 *
 * Runbook: docs/runbooks/pro-133-prod-deploy.md (Step 4)
 *
 * HARD GATE. Exit non-zero on ANY discrepancy. Schema state is
 * deterministic — either the column exists with the expected default,
 * or the migration didn't land correctly and the deploy is unsafe.
 *
 * Checks:
 *   1. `EmployeeUserRole` enum exists with exactly 4 values
 *   2. `User.employeeRole` column exists, type `EmployeeUserRole`, nullable
 *   3. `Note.isPrivate` column exists, type boolean, NOT NULL, default false
 *      (or true if Step 1's audit triggered the default flip — script
 *       reports the observed default for the deployer to confirm)
 *
 * Usage:
 *   DATABASE_URL=<target-url> npx tsx scripts/verify-pro-133-schema.ts
 *
 * Verify $DATABASE_URL points where you think it does BEFORE running.
 */

import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const EXPECTED_EMPLOYEE_ROLES = ["EMPLOYEE", "PEOPLE_MANAGER", "HR_TALENT_LEADER", "EXECUTIVE"] as const;

async function main() {
  const failures: string[] = [];

  // 1. EmployeeUserRole enum
  const enumValues = await prisma.$queryRaw<Array<{ enumlabel: string }>>`
    SELECT enumlabel FROM pg_enum
    WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'EmployeeUserRole')
    ORDER BY enumsortorder
  `;
  const actualEnumValues = enumValues.map((e) => e.enumlabel).sort();
  const expectedEnumValues = [...EXPECTED_EMPLOYEE_ROLES].sort();
  console.log(`EmployeeUserRole enum: [${actualEnumValues.join(", ")}]`);
  if (JSON.stringify(actualEnumValues) !== JSON.stringify(expectedEnumValues)) {
    failures.push(
      `EmployeeUserRole enum mismatch. Expected [${expectedEnumValues.join(", ")}], got [${actualEnumValues.join(", ")}]`,
    );
  }

  // 2. User.employeeRole column
  const userCols = await prisma.$queryRaw<
    Array<{ column_name: string; data_type: string; udt_name: string; is_nullable: string }>
  >`
    SELECT column_name, data_type, udt_name, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'User' AND column_name = 'employeeRole'
  `;
  console.log(`User.employeeRole: ${JSON.stringify(userCols)}`);
  if (userCols.length === 0) {
    failures.push("User.employeeRole column does not exist");
  } else {
    const col = userCols[0];
    if (col.udt_name !== "EmployeeUserRole") {
      failures.push(`User.employeeRole expected udt_name=EmployeeUserRole, got ${col.udt_name}`);
    }
    if (col.is_nullable !== "YES") {
      failures.push(`User.employeeRole expected nullable, got is_nullable=${col.is_nullable}`);
    }
  }

  // 3. Note.isPrivate column
  const noteCols = await prisma.$queryRaw<
    Array<{ column_name: string; data_type: string; column_default: string | null; is_nullable: string }>
  >`
    SELECT column_name, data_type, column_default, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'Note' AND column_name = 'isPrivate'
  `;
  console.log(`Note.isPrivate: ${JSON.stringify(noteCols)}`);
  if (noteCols.length === 0) {
    failures.push("Note.isPrivate column does not exist");
  } else {
    const col = noteCols[0];
    if (col.data_type !== "boolean") {
      failures.push(`Note.isPrivate expected data_type=boolean, got ${col.data_type}`);
    }
    if (col.is_nullable !== "NO") {
      failures.push(`Note.isPrivate expected NOT NULL, got is_nullable=${col.is_nullable}`);
    }
    // Default is either 'false' or 'true' depending on whether Step 1's
    // audit triggered the flip. Report observed default for confirmation.
    console.log(`  → Observed Note.isPrivate default: ${col.column_default ?? "(none)"}`);
    if (col.column_default !== "false" && col.column_default !== "true") {
      failures.push(
        `Note.isPrivate default must be 'false' or 'true', got ${JSON.stringify(col.column_default)}`,
      );
    }
  }

  // 4. Sanity: existing Note rows can be queried with the new column
  const sampleNoteCount = await prisma.note.count();
  console.log(`\nTotal Note rows readable post-migration: ${sampleNoteCount}`);

  // Report
  console.log("");
  console.log("────────────────────────────────────────────────────────────");
  if (failures.length === 0) {
    console.log("✅ PRO-133 schema verification PASSED");
    console.log("────────────────────────────────────────────────────────────");
    process.exitCode = 0;
  } else {
    console.log(`❌ PRO-133 schema verification FAILED — ${failures.length} discrepanc${failures.length === 1 ? "y" : "ies"}:`);
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

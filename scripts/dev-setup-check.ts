/**
 * Developer Setup Check
 *
 * Validates that all required environment variables are set and that
 * core services (database, Supabase auth) are reachable.
 *
 * Usage:
 *   npx tsx scripts/dev-setup-check.ts
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config();

import pg from "pg";

const REQUIRED_VARS = [
  { name: "DATABASE_URL", hint: "Neon PostgreSQL connection string" },
  { name: "NEXT_PUBLIC_SUPABASE_URL", hint: "Supabase project URL (https://xxx.supabase.co)" },
  { name: "NEXT_PUBLIC_SUPABASE_ANON_KEY", hint: "Supabase public/anon key" },
  { name: "SUPABASE_SERVICE_ROLE_KEY", hint: "Supabase service role key (for admin scripts)" },
  { name: "ANTHROPIC_API_KEY", hint: "Anthropic API key (sk-ant-...)" },
  { name: "NEXT_PUBLIC_APP_URL", hint: "App URL — set to http://localhost:3000" },
];

const OPTIONAL_VARS = [
  { name: "ELEVENLABS_API_KEY", hint: "ElevenLabs TTS (falls back to browser speech)" },
  { name: "ELEVENLABS_VOICE_ID", hint: "ElevenLabs voice ID for Aria" },
  { name: "RESEND_API_KEY", hint: "Email sending (not needed for local dev)" },
  { name: "UPSTASH_REDIS_REST_URL", hint: "Rate limiting (falls back to in-memory)" },
];

let hasErrors = false;

function ok(msg: string) { console.log(`  \x1b[32m✓\x1b[0m ${msg}`); }
function warn(msg: string) { console.log(`  \x1b[33m⚠\x1b[0m ${msg}`); }
function fail(msg: string) { console.log(`  \x1b[31m✗\x1b[0m ${msg}`); hasErrors = true; }

async function main() {
  console.log("\n\x1b[1mACI Developer Setup Check\x1b[0m\n");

  // ── Step 1: Check .env.local exists ──
  console.log("\x1b[1m1. Environment file\x1b[0m");
  const fs = await import("fs");
  if (fs.existsSync(".env.local")) {
    ok(".env.local found");
  } else {
    fail(".env.local not found — copy .env.example to .env.local and fill in the values");
    console.log("\n  Run: cp .env.example .env.local\n");
    process.exit(1);
  }

  // ── Step 2: Check required vars ──
  console.log("\n\x1b[1m2. Required environment variables\x1b[0m");
  for (const v of REQUIRED_VARS) {
    if (process.env[v.name] && process.env[v.name] !== `your-${v.name.toLowerCase()}` && !process.env[v.name]!.startsWith("your-")) {
      ok(`${v.name} is set`);
    } else {
      fail(`${v.name} is missing — ${v.hint}`);
    }
  }

  // ── Step 3: Check optional vars ──
  console.log("\n\x1b[1m3. Optional environment variables\x1b[0m");
  for (const v of OPTIONAL_VARS) {
    if (process.env[v.name]) {
      ok(`${v.name} is set`);
    } else {
      warn(`${v.name} not set — ${v.hint}`);
    }
  }

  // ── Step 4: Test database connection ──
  console.log("\n\x1b[1m4. Database connection\x1b[0m");
  if (process.env.DATABASE_URL) {
    const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
    try {
      const result = await pool.query("SELECT current_database() as db, current_schema() as schema");
      ok(`Connected to database: ${result.rows[0].db} (schema: ${result.rows[0].schema})`);

      // Check for key tables
      const tables = await pool.query(
        `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('Organization', 'User', 'Assessment', 'Role') ORDER BY table_name`
      );
      const found = tables.rows.map((r: any) => r.table_name);
      if (found.length >= 4) {
        ok(`Core tables present: ${found.join(", ")}`);
      } else if (found.length > 0) {
        warn(`Some tables found (${found.join(", ")}) but expected Organization, User, Assessment, Role`);
      } else {
        fail("No core tables found — database may need migration: npx prisma migrate deploy");
      }

      // Check for Arklight org
      const org = await pool.query(`SELECT id, name FROM "Organization" WHERE slug = 'arklight' LIMIT 1`);
      if (org.rows.length > 0) {
        ok(`Arklight org exists: ${org.rows[0].name}`);
      } else {
        warn("Arklight org not found — run: npx tsx scripts/provision-org.ts");
      }
    } catch (err: any) {
      fail(`Database connection failed: ${err.message}`);
    } finally {
      await pool.end();
    }
  } else {
    fail("Skipping database check — DATABASE_URL not set");
  }

  // ── Step 5: Test Supabase connection ──
  console.log("\n\x1b[1m5. Supabase connection\x1b[0m");
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    try {
      // Use the auth health endpoint — doesn't require table access
      const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/settings`, {
        headers: {
          apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        },
      });
      if (response.ok) {
        ok("Supabase Auth API reachable");
      } else {
        fail(`Supabase Auth returned status ${response.status} — check your URL and anon key`);
      }
    } catch (err: any) {
      fail(`Supabase connection failed: ${err.message}`);
    }
  } else {
    fail("Skipping Supabase check — URL or anon key not set");
  }

  // ── Step 6: Check Prisma client ──
  console.log("\n\x1b[1m6. Prisma client\x1b[0m");
  try {
    await import("../src/generated/prisma/client.js");
    ok("Prisma client generated and importable");
  } catch {
    fail("Prisma client not generated — run: npx prisma generate");
  }

  // ── Step 7: Check Node version ──
  console.log("\n\x1b[1m7. Runtime\x1b[0m");
  const nodeVersion = process.versions.node;
  const major = parseInt(nodeVersion.split(".")[0]);
  if (major >= 20) {
    ok(`Node.js v${nodeVersion}`);
  } else {
    fail(`Node.js v${nodeVersion} — requires v20+`);
  }

  // ── Summary ──
  console.log("\n" + "─".repeat(50));
  if (hasErrors) {
    console.log("\x1b[31m\x1b[1mSetup incomplete.\x1b[0m Fix the issues above and re-run this script.");
    console.log("If you're missing credentials, ask Daniel for the .env.local values.\n");
    process.exit(1);
  } else {
    console.log("\x1b[32m\x1b[1mAll checks passed!\x1b[0m You're ready to run: npm run dev\n");
  }
}

main().catch((err) => {
  console.error("\nSetup check crashed:", err.message);
  process.exit(1);
});

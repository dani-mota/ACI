/**
 * Deletes all AccessRequests and their corresponding User records
 * (and Supabase auth accounts) EXCEPT for dani@arklight.us.
 *
 * Usage:
 *   SUPABASE_SERVICE_ROLE_KEY=<key> npx tsx scripts/cleanup-test-data.ts
 */
import "dotenv/config";
import pg from "pg";
import { createClient } from "@supabase/supabase-js";

const KEEP_EMAIL = "dani@arklight.us";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function main() {
  const client = await pool.connect();

  try {
    // 1. List all requests except the one we're keeping
    const requests = await client.query<{
      id: string;
      email: string;
      status: string;
    }>(
      `SELECT id, email, status FROM "AccessRequest" WHERE email != $1 ORDER BY "createdAt" DESC`,
      [KEEP_EMAIL]
    );

    if (requests.rows.length === 0) {
      console.log("No test records found. Nothing to delete.");
      return;
    }

    console.log("\nRecords to delete:");
    console.table(requests.rows);

    const supabase = getSupabaseAdmin();
    if (!supabase) {
      console.warn(
        "\n⚠️  SUPABASE_SERVICE_ROLE_KEY not set — skipping Supabase auth user deletion.\n   Run with: SUPABASE_SERVICE_ROLE_KEY=<key> npx tsx scripts/cleanup-test-data.ts"
      );
    }

    for (const req of requests.rows) {
      const email = req.email;

      // 2. Find User record in Neon (might exist if request was approved)
      const userRow = await client.query<{ id: string; "supabaseId": string | null }>(
        `SELECT id, "supabaseId" FROM "User" WHERE email = $1`,
        [email]
      );

      if (userRow.rows.length > 0) {
        const { id: userId, supabaseId } = userRow.rows[0];

        // 3. Delete from Supabase auth if we have the admin client + supabaseId
        if (supabase && supabaseId) {
          const { error } = await supabase.auth.admin.deleteUser(supabaseId);
          if (error) {
            console.warn(`  ⚠️  Supabase delete failed for ${email}: ${error.message}`);
          } else {
            console.log(`  ✅ Deleted Supabase auth user: ${email} (${supabaseId})`);
          }
        } else if (supabase && !supabaseId) {
          // Try to find by email via Supabase admin list
          console.log(`  ℹ️  No supabaseId stored for ${email} — checking Supabase by email...`);
          const { data } = await supabase.auth.admin.listUsers();
          const match = data?.users?.find((u) => u.email === email);
          if (match) {
            const { error } = await supabase.auth.admin.deleteUser(match.id);
            if (error) {
              console.warn(`  ⚠️  Supabase delete failed for ${email}: ${error.message}`);
            } else {
              console.log(`  ✅ Deleted Supabase auth user (found by email): ${email}`);
            }
          }
        }

        // 4. Delete Neon User
        await client.query(`DELETE FROM "User" WHERE id = $1`, [userId]);
        console.log(`  ✅ Deleted Neon User: ${email}`);
      }

      // 5. Delete AccessRequest
      await client.query(`DELETE FROM "AccessRequest" WHERE id = $1`, [req.id]);
      console.log(`  ✅ Deleted AccessRequest: ${email} (${req.status})`);
    }

    console.log("\n✅ Cleanup complete. dani@arklight.us untouched.");
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

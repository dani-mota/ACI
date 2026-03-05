import "dotenv/config";
import pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  const client = await pool.connect();
  try {
    // Check if RLS is already enabled
    const { rows: rlsCheck } = await client.query(
      `SELECT relrowsecurity FROM pg_class WHERE relname = 'TeamInvitation'`
    );

    if (rlsCheck.length === 0) {
      console.error("TeamInvitation table does not exist!");
      process.exit(1);
    }

    if (rlsCheck[0].relrowsecurity) {
      console.log("RLS already enabled on TeamInvitation — checking policies...");
      const { rows: policies } = await client.query(
        `SELECT policyname FROM pg_policies WHERE tablename = 'TeamInvitation'`
      );
      console.log("Existing policies:", policies.map((p) => p.policyname));
      console.log("Nothing to do.");
      return;
    }

    console.log("Applying TeamInvitation RLS policies...");

    await client.query(`ALTER TABLE public."TeamInvitation" ENABLE ROW LEVEL SECURITY`);

    await client.query(`CREATE POLICY "org_isolation_select" ON public."TeamInvitation"
      FOR SELECT USING ("orgId" = public.get_current_org_id())`);

    await client.query(`CREATE POLICY "org_isolation_insert" ON public."TeamInvitation"
      FOR INSERT WITH CHECK ("orgId" = public.get_current_org_id())`);

    await client.query(`CREATE POLICY "org_isolation_update" ON public."TeamInvitation"
      FOR UPDATE USING ("orgId" = public.get_current_org_id())`);

    await client.query(`CREATE POLICY "org_isolation_delete" ON public."TeamInvitation"
      FOR DELETE USING ("orgId" = public.get_current_org_id())`);

    await client.query(
      `CREATE INDEX IF NOT EXISTS "idx_TeamInvitation_orgId" ON public."TeamInvitation" ("orgId")`
    );

    console.log("TeamInvitation RLS policies applied successfully.");
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

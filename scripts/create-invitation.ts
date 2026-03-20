import pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  const client = await pool.connect();
  try {
    // Find the org
    const orgResult = await client.query(`SELECT id FROM "Organization" WHERE slug = 'arklight' LIMIT 1`);
    const orgId = orgResult.rows[0]?.id;
    if (!orgId) throw new Error("Org 'arklight' not found");

    // Find admin
    const adminResult = await client.query(`SELECT id FROM "User" WHERE "orgId" = $1 LIMIT 1`, [orgId]);
    const adminId = adminResult.rows[0]?.id;
    if (!adminId) throw new Error("No admin user found");

    // List roles for this org
    const rolesResult = await client.query(`SELECT id, name, slug FROM "Role" WHERE "orgId" = $1 ORDER BY name`, [orgId]);
    console.log("\n=== Available roles ===");
    for (const r of rolesResult.rows) {
      console.log(`  ${r.name} (${r.slug})`);
    }

    // Find the candidate (Daniel Mota)
    const candResult = await client.query(
      `SELECT c.id, c."firstName", c."lastName", c."primaryRoleId", r.name as "roleName"
       FROM "Candidate" c JOIN "Role" r ON c."primaryRoleId" = r.id
       WHERE c."orgId" = $1 AND c."firstName" = 'Daniel'
       ORDER BY c."createdAt" DESC LIMIT 1`,
      [orgId]
    );
    const candidate = candResult.rows[0];
    if (!candidate) throw new Error("Candidate Daniel not found");

    // Clean up old assessments and invitations
    const assessments = await client.query(`SELECT id FROM "Assessment" WHERE "candidateId" = $1`, [candidate.id]);
    const assessmentIds = assessments.rows.map((a: any) => a.id);

    if (assessmentIds.length > 0) {
      for (const table of [
        "AIEvaluationRun", "AssessmentState", "ConversationMessage",
        "PostAssessmentSurvey", "ItemResponse", "RedFlag", "Prediction",
        "AIInteraction", "CompositeScore", "SubtestResult"
      ]) {
        await client.query(`DELETE FROM "${table}" WHERE "assessmentId" = ANY($1)`, [assessmentIds]);
      }
      await client.query(`DELETE FROM "Assessment" WHERE "candidateId" = $1`, [candidate.id]);
    }
    await client.query(`DELETE FROM "AssessmentInvitation" WHERE "candidateId" = $1`, [candidate.id]);

    // Reset candidate status
    await client.query(`UPDATE "Candidate" SET status = 'INVITED' WHERE id = $1`, [candidate.id]);

    // Create invitation (using raw SQL to avoid Prisma schema mismatch)
    const token = `cm${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`.slice(0, 25);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await client.query(
      `INSERT INTO "AssessmentInvitation" (id, "candidateId", "roleId", "invitedBy", "expiresAt", "linkToken", "createdAt")
       VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
      [`cm${Math.random().toString(36).slice(2, 27)}`, candidate.id, candidate.primaryRoleId, adminId, expiresAt, token]
    );

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://aci-rho.vercel.app";
    console.log(`\n=== New Assessment Invitation ===`);
    console.log(`Candidate : ${candidate.firstName} ${candidate.lastName}`);
    console.log(`Role      : ${candidate.roleName}`);
    console.log(`Token     : ${token}`);
    console.log(`Expires   : ${expiresAt.toISOString()}`);
    console.log(`\nAssessment URL: ${baseUrl}/assess/${token}\n`);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(console.error);

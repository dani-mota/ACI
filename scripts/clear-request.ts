import "dotenv/config";
import pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  const list = await pool.query(
    `SELECT id, email, status, "createdAt" FROM "AccessRequest" ORDER BY "createdAt" DESC LIMIT 10`
  );
  console.table(list.rows);

  const email = process.argv[2];
  if (email) {
    const del = await pool.query(`DELETE FROM "AccessRequest" WHERE email = $1 RETURNING email`, [email]);
    console.log("Deleted:", del.rows);
  }
}

main().catch(console.error).finally(() => pool.end());

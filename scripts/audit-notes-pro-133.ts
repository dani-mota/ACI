/**
 * PRO-133 pre-deploy gate: Note table content audit.
 *
 * Runbook: docs/runbooks/pro-133-prod-deploy.md (Step 1)
 *
 * THIS SCRIPT EXITS 0 ALWAYS. The keyword regex is a soft signal — its
 * job is to surface samples for human eyeball review, not to decide
 * what's "sensitive." A regex will false-positive on benign content
 * ("Confirmed candidate handles private health information at prior
 * role") and false-negative on real risks ("Manager says this person
 * can't handle stress"). The deployer reads the output and decides.
 *
 * The decision contract:
 *   - If sampled note content looks sensitive (manager impressions,
 *     off-the-record signals, anything that wouldn't be safe to expose
 *     to the subject): STOP. Flip the migration default to `true`,
 *     push to main, redeploy. No second path.
 *   - If content is uniformly operational (scheduling, candidate-stage
 *     flags, neutral feedback): proceed with the deploy as planned.
 *   - If unsure: default `true`. Over-restriction is recoverable;
 *     leakage is not.
 *
 * Usage:
 *   DATABASE_URL=<target-url> npx tsx scripts/audit-notes-pro-133.ts
 *
 * Verify $DATABASE_URL points where you think it does BEFORE running.
 */

import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// Soft-signal regex. Matches words that COULD indicate sensitive
// content but frequently appear in benign operational notes too.
// Treat hits as "eyeball the sampled content," not "this is sensitive."
const SENSITIVE_KEYWORDS = /private|confidential|impression|concern|red flag/i;

const SAMPLE_LIMIT = 20;
const SAMPLE_CHARS = 80;

async function main() {
  const total = await prisma.note.count();
  console.log(`Total Note rows: ${total}`);
  if (total === 0) {
    console.log("No notes exist. Default `isPrivate=false` is trivially safe.");
    return;
  }

  const all = await prisma.note.findMany({
    include: {
      author: { select: { name: true, role: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  // Per-author breakdown
  console.log("\nPer-author note count:");
  const byAuthor = new Map<string, number>();
  for (const n of all) {
    const key = `${n.author.role.padEnd(22)} | ${n.author.name}`;
    byAuthor.set(key, (byAuthor.get(key) ?? 0) + 1);
  }
  for (const [k, v] of byAuthor.entries()) {
    console.log(`  ${v.toString().padStart(3)}× ${k}`);
  }

  // Keyword-flag scan across ALL notes (not just the sample)
  const flagged = all.filter((n) => SENSITIVE_KEYWORDS.test(n.content));
  console.log(
    `\nSoft-signal keyword matches: ${flagged.length}/${total} notes match /private|confidential|impression|concern|red flag/i`,
  );
  console.log(
    "(NB: regex false-positives on benign topical mentions; eyeball the actual content)",
  );

  if (flagged.length > 0) {
    console.log("\nFlagged sample (up to 20):");
    for (const n of flagged.slice(0, 20)) {
      const preview = n.content.slice(0, SAMPLE_CHARS).replace(/\s+/g, " ").trim();
      console.log(`  [${n.author.role}] ${preview}${n.content.length > SAMPLE_CHARS ? "…" : ""}`);
    }
  }

  // Most recent N notes regardless of flag — gives the deployer a
  // current-state read on what kind of content is being written.
  console.log(`\nMost recent ${Math.min(SAMPLE_LIMIT, total)} notes:`);
  for (const n of all.slice(0, SAMPLE_LIMIT)) {
    const preview = n.content.slice(0, SAMPLE_CHARS).replace(/\s+/g, " ").trim();
    const flag = SENSITIVE_KEYWORDS.test(n.content) ? " 🚩" : "";
    console.log(`  [${n.author.role}] ${preview}${n.content.length > SAMPLE_CHARS ? "…" : ""}${flag}`);
  }

  console.log("\n────────────────────────────────────────────────────────────");
  console.log("DECISION (yours, not the script's):");
  console.log("  If any content above looks sensitive → STOP. Flip migration");
  console.log("  default to `true`, push to main, redeploy.");
  console.log("  If uniformly operational → proceed to Step 2 of the runbook.");
  console.log("  If unsure → default `true`. Over-restriction is recoverable.");
  console.log("────────────────────────────────────────────────────────────");
}

main()
  .catch((err) => {
    console.error("Audit failed:", err);
    // Still exit 0 — failure to query doesn't mean content is safe;
    // the deployer should investigate before proceeding either way.
    // But a non-zero from connection errors specifically would be
    // misleading vs. the script's "always 0" contract on content.
    process.exitCode = 0;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });

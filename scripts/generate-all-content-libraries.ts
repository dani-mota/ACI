/**
 * Generate content libraries for all non-generic roles sequentially.
 * Usage: npx tsx scripts/generate-all-content-libraries.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });

async function main() {
  const { default: prisma } = await import("../src/lib/prisma");
  const { generateContentLibrary } = await import("../src/lib/assessment/content-generation");
  const { validateContentLibrary } = await import("../src/lib/assessment/content-validation");
  type ContentLibraryData = import("../src/lib/assessment/content-types").ContentLibraryData;

  // Get all non-generic roles
  const roles = await prisma.role.findMany({
    where: { isGeneric: false },
    select: { id: true, name: true, slug: true },
    orderBy: { name: "asc" },
  });

  // Check which already have READY libraries
  const readyLibs = await prisma.contentLibrary.findMany({
    where: { status: "READY" },
    select: { roleId: true },
  });
  const readyRoleIds = new Set(readyLibs.map((l) => l.roleId));

  const pending = roles.filter((r) => !readyRoleIds.has(r.id));
  console.log(`Total non-generic roles: ${roles.length}`);
  console.log(`Already have READY library: ${readyRoleIds.size}`);
  console.log(`Pending generation: ${pending.length}\n`);

  let success = 0;
  let failed = 0;

  for (const role of pending) {
    console.log(`\n${"=".repeat(60)}`);
    console.log(`Generating: ${role.name} (${role.slug}) — ${role.id}`);
    console.log(`${"=".repeat(60)}`);

    const start = Date.now();
    try {
      const libraryId = await generateContentLibrary(role.id);
      const elapsed = ((Date.now() - start) / 1000).toFixed(1);

      const library = await prisma.contentLibrary.findUnique({
        where: { id: libraryId },
        select: { content: true, status: true, version: true },
      });

      const data = library?.content as unknown as ContentLibraryData;
      const validation = validateContentLibrary(data);

      console.log(`  Status: ${library?.status} (v${library?.version}) — ${elapsed}s`);
      console.log(`  Validation: ${validation.valid ? "PASSED" : "FAILED"}`);
      console.log(`  Stats: ${JSON.stringify(validation.stats)}`);
      if (validation.errors.length > 0) {
        console.log(`  Errors: ${validation.errors.slice(0, 3).join("; ")}`);
      }
      success++;
    } catch (err) {
      const elapsed = ((Date.now() - start) / 1000).toFixed(1);
      console.log(`  FAILED after ${elapsed}s: ${err instanceof Error ? err.message : String(err)}`);
      failed++;
    }

    // Pause between roles to respect rate limits (8K output tokens/min)
    if (pending.indexOf(role) < pending.length - 1) {
      console.log(`  Pausing 90s before next role (rate limit cooldown)...`);
      await new Promise((r) => setTimeout(r, 90_000));
    }
  }

  console.log(`\n${"=".repeat(60)}`);
  console.log(`COMPLETE: ${success} succeeded, ${failed} failed out of ${pending.length} roles`);
  console.log(`${"=".repeat(60)}`);

  await prisma.$disconnect();
}

main();

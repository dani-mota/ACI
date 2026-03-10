/**
 * Generate a content library for a role.
 * Usage: npx tsx scripts/generate-content-library.ts <roleId>
 */
import { config } from "dotenv";
config({ path: ".env.local" });

const roleId = process.argv[2];

if (!roleId) {
  console.error("Usage: npx tsx scripts/generate-content-library.ts <roleId>");
  process.exit(1);
}

async function main() {
  // Dynamic imports so env vars are loaded first
  const { default: prisma } = await import("../src/lib/prisma");
  const { generateContentLibrary } = await import("../src/lib/assessment/content-generation");
  const { validateContentLibrary } = await import("../src/lib/assessment/content-validation");
  type ContentLibraryData = import("../src/lib/assessment/content-types").ContentLibraryData;

  const role = await prisma.role.findUnique({
    where: { id: roleId },
    select: { name: true, slug: true },
  });

  if (!role) {
    console.error(`Role not found: ${roleId}`);
    process.exit(1);
  }

  console.log(`Generating content library for: ${role.name} (${role.slug})`);
  console.log(`This will make ~24 API calls and take 1-3 minutes...\n`);

  const start = Date.now();

  try {
    const libraryId = await generateContentLibrary(roleId);
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    console.log(`\nGeneration complete in ${elapsed}s. Library ID: ${libraryId}`);

    const library = await prisma.contentLibrary.findUnique({
      where: { id: libraryId },
      select: { content: true, status: true, version: true },
    });

    console.log(`Status: ${library?.status}`);
    console.log(`Version: ${library?.version}`);

    if (library?.content) {
      const data = library.content as unknown as ContentLibraryData;
      const validation = validateContentLibrary(data);

      console.log(`\nValidation: ${validation.valid ? "PASSED" : "FAILED"}`);
      console.log(`Stats: ${JSON.stringify(validation.stats)}`);

      if (validation.errors.length > 0) {
        console.log(`\nErrors:`);
        validation.errors.forEach((e: string) => console.log(`  - ${e}`));
      }
      if (validation.warnings.length > 0) {
        console.log(`\nWarnings:`);
        validation.warnings.slice(0, 10).forEach((w: string) => console.log(`  - ${w}`));
        if (validation.warnings.length > 10) {
          console.log(`  ... and ${validation.warnings.length - 10} more`);
        }
      }

      // Sample content
      const beat0 = data.act1.scenarios[0]?.variants[0]?.beats[0];
      if (beat0) {
        console.log(`\nSample Beat 0 spokenText (first 200 chars):`);
        console.log(`  "${beat0.spokenText?.slice(0, 200)}"`);
        console.log(`  Reference card sections: ${beat0.referenceCard?.sections?.length}`);
      }

      const beat1 = data.act1.scenarios[0]?.variants[0]?.beats[1];
      if (beat1?.branches) {
        console.log(`\nSample Beat 1 branches present: STRONG=${!!beat1.branches.STRONG} ADEQUATE=${!!beat1.branches.ADEQUATE} WEAK=${!!beat1.branches.WEAK}`);
        console.log(`  STRONG spokenText (first 200 chars): "${beat1.branches.STRONG?.spokenText?.slice(0, 200)}"`);
      }
    }
  } catch (err) {
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    console.error(`\nGeneration FAILED after ${elapsed}s:`, err);

    const failed = await prisma.contentLibrary.findFirst({
      where: { roleId, status: "FAILED" },
      orderBy: { createdAt: "desc" },
      select: { id: true, errorLog: true },
    });
    if (failed) {
      console.error("Error log:", JSON.stringify(failed.errorLog, null, 2));
    }
  }

  await prisma.$disconnect();
}

main();

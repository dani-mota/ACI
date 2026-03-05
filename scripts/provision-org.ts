import "dotenv/config";
import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { buildOrgAdminWelcomeEmail } from "../src/lib/email/templates/org-admin-welcome.js";

// ─── CLI ARGUMENT PARSING ────────────────────────────────
function parseArgs(): {
  name: string;
  adminEmail: string;
  adminName: string;
  roles?: string[];
} {
  const args = process.argv.slice(2);
  const map: Record<string, string> = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith("--") && i + 1 < args.length) {
      map[args[i].replace(/^--/, "")] = args[i + 1];
      i++;
    }
  }

  if (!map["name"] || !map["admin-email"] || !map["admin-name"]) {
    console.error(
      "Usage: npx tsx scripts/provision-org.ts \\\n" +
        '  --name "Anduril Industries" \\\n' +
        '  --admin-email "tasha@anduril.com" \\\n' +
        '  --admin-name "Tasha Aquino Vance" \\\n' +
        '  --roles "manufacturing-engineer,cnc-machinist,generic-aptitude"  (optional)'
    );
    process.exit(1);
  }

  return {
    name: map["name"],
    adminEmail: map["admin-email"],
    adminName: map["admin-name"],
    roles: map["roles"]
      ? map["roles"].split(",").map((s) => s.trim())
      : undefined,
  };
}

function generateSlug(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
  if (slug.length < 2) {
    console.error(`ABORT: Cannot generate a valid slug from org name "${name}". Use ASCII characters.`);
    process.exit(1);
  }
  return slug;
}

// ─── MAIN ────────────────────────────────────────────────
async function main() {
  const { name, adminEmail, adminName, roles: requestedRoleSlugs } = parseArgs();
  const slug = generateSlug(name);

  // ─── Environment checks ──────────────────────────────
  const databaseUrl = process.env.DATABASE_URL;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const resendApiKey = process.env.RESEND_API_KEY;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  if (!databaseUrl || !supabaseUrl || !supabaseServiceKey) {
    console.error(
      "Missing required env vars: DATABASE_URL, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY"
    );
    process.exit(1);
  }

  // ─── Init clients ────────────────────────────────────
  const pool = new pg.Pool({ connectionString: databaseUrl });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // ─── Step 1: Validate & create organization ──────────
  console.log(`\nProvisioning organization: ${name} (${slug})\n`);

  const existingBySlug = await prisma.organization.findUnique({
    where: { slug },
  });
  if (existingBySlug) {
    console.error(`ABORT: Organization with slug "${slug}" already exists (id: ${existingBySlug.id})`);
    await cleanup(prisma, pool);
    process.exit(1);
  }

  const existingByName = await prisma.organization.findFirst({
    where: { name },
  });
  if (existingByName) {
    console.error(`ABORT: Organization with name "${name}" already exists (id: ${existingByName.id})`);
    await cleanup(prisma, pool);
    process.exit(1);
  }

  // ─── Step 2: Find template roles to clone ────────────
  const demoOrg = await prisma.organization.findFirst({
    where: { isDemo: true },
  });
  if (!demoOrg) {
    console.error("ABORT: No demo organization found to clone roles from.");
    await cleanup(prisma, pool);
    process.exit(1);
  }

  const templateRoles = await prisma.role.findMany({
    where: {
      orgId: demoOrg.id,
      sourceType: "SYSTEM_DEFAULT",
    },
    include: {
      compositeWeights: { where: { effectiveTo: null } },
      cutlines: true,
    },
  });

  // Determine which roles to clone
  let rolesToClone = templateRoles;
  const warnings: string[] = [];

  if (requestedRoleSlugs) {
    // Filter to requested slugs, warn about missing ones
    rolesToClone = [];
    for (const reqSlug of requestedRoleSlugs) {
      if (reqSlug === "generic-aptitude") continue; // Always included separately
      const found = templateRoles.find((r) => r.slug === reqSlug);
      if (found) {
        rolesToClone.push(found);
      } else {
        warnings.push(
          `WARNING: Role template "${reqSlug}" not found among system defaults — skipping.`
        );
      }
    }
  }

  // Always include generic aptitude
  const genericTemplate = templateRoles.find((r) => r.isGeneric);
  if (genericTemplate && !rolesToClone.some((r) => r.isGeneric)) {
    rolesToClone.push(genericTemplate);
  }

  if (rolesToClone.length === 0) {
    console.error("ABORT: No valid role templates to clone.");
    await cleanup(prisma, pool);
    process.exit(1);
  }

  // Print warnings
  for (const w of warnings) {
    console.warn(w);
  }

  // ─── Step 4a: Create Supabase auth user (before transaction for clean rollback) ──
  const { data: authData, error: authError } =
    await supabase.auth.admin.createUser({
      email: adminEmail,
      email_confirm: true,
      user_metadata: { name: adminName },
    });

  if (authError || !authData.user) {
    console.error(
      `ABORT: Failed to create Supabase auth user: ${authError?.message || "Unknown error"}`
    );
    await cleanup(prisma, pool);
    process.exit(1);
  }

  const supabaseUserId = authData.user.id;

  // ─── Step 4b: Transaction — create org + clone roles + create user ──
  let orgId: string;
  let clonedRoleNames: string[];

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Create org
      const org = await tx.organization.create({
        data: { name, slug, isDemo: false },
      });

      // Clone roles with weights and cutlines
      const roleNames: string[] = [];
      for (const template of rolesToClone) {
        const newRole = await tx.role.create({
          data: {
            name: template.name,
            slug: template.slug,
            description: template.description,
            orgId: org.id,
            isCustom: false,
            sourceType: "TEMPLATE_CLONE",
            complexityLevel: template.complexityLevel,
            jdContext: template.jdContext ?? undefined,
            hiringIntelligence: template.hiringIntelligence ?? undefined,
            isGeneric: template.isGeneric,
          },
        });

        // Clone composite weights
        if (template.compositeWeights.length > 0) {
          await tx.compositeWeight.createMany({
            data: template.compositeWeights.map((w) => ({
              roleId: newRole.id,
              constructId: w.constructId,
              weight: w.weight,
              version: 1,
              source: w.source,
              effectiveFrom: new Date(),
            })),
          });
        }

        // Clone cutlines
        for (const cutline of template.cutlines) {
          await tx.cutline.create({
            data: {
              roleId: newRole.id,
              orgId: org.id,
              technicalAptitude: cutline.technicalAptitude,
              behavioralIntegrity: cutline.behavioralIntegrity,
              learningVelocity: cutline.learningVelocity,
              overallMinimum: cutline.overallMinimum,
            },
          });
        }

        roleNames.push(template.name);
      }

      // Create Prisma user linked to Supabase auth
      // Note: TA_LEADER has full data access within their org but cannot
      // delete roles or access the platform admin panel (requires ADMIN).
      await tx.user.create({
        data: {
          supabaseId: supabaseUserId,
          email: adminEmail,
          name: adminName,
          role: "TA_LEADER",
          orgId: org.id,
        },
      });

      return { orgId: org.id, roleNames };
    });

    orgId = result.orgId;
    clonedRoleNames = result.roleNames;
  } catch (err) {
    console.error("ABORT: Transaction failed —", (err as Error).message);
    // Clean up the Supabase auth user since the Prisma transaction rolled back
    try {
      await supabase.auth.admin.deleteUser(supabaseUserId);
      console.log("Cleaned up Supabase auth user.");
    } catch {
      console.warn(
        `WARNING: Failed to clean up Supabase auth user (id: ${supabaseUserId}). Delete manually.`
      );
    }
    await cleanup(prisma, pool);
    process.exit(1);
  }

  // ─── Step 5: Send setup email ────────────────────────
  // Generate password reset link so admin can set their password
  const { data: linkData, error: linkError } =
    await supabase.auth.admin.generateLink({
      type: "magiclink",
      email: adminEmail,
    });

  const loginUrl = `${appUrl}/auth/login`;
  let setupUrl = loginUrl;

  if (linkError || !linkData) {
    console.warn(
      `WARNING: Could not generate setup link: ${linkError?.message || "Unknown error"}. Admin can use "Forgot password" to set up.`
    );
  } else {
    // Use the pre-built action link from Supabase (already properly encoded)
    const actionLink = linkData.properties?.action_link;
    if (actionLink) {
      setupUrl = actionLink;
    }
  }

  if (resendApiKey) {
    try {
      const resend = new Resend(resendApiKey);
      const { subject, html } = buildOrgAdminWelcomeEmail({
        adminName,
        orgName: name,
        setupUrl,
        loginUrl,
        roleNames: clonedRoleNames,
      });

      await resend.emails.send({
        from:
          process.env.EMAIL_FROM ||
          "ACI Assessments <assessments@arklight.io>",
        to: adminEmail,
        subject,
        html,
      });

      console.log(`\u2705 Setup email sent to ${adminEmail}`);
    } catch (emailErr) {
      console.warn(
        `WARNING: Email send failed: ${(emailErr as Error).message}. Org and user were still created — resend manually.`
      );
    }
  } else {
    console.warn(
      "WARNING: RESEND_API_KEY not set — skipping setup email. Admin can use 'Forgot password' on login page."
    );
  }

  // ─── Step 6: Summary ─────────────────────────────────
  console.log(
    `\n\u2705 Organization created: ${name} (id: ${orgId}, slug: ${slug})`
  );
  console.log(
    `\u2705 Roles cloned: ${clonedRoleNames.join(", ")} (${clonedRoleNames.length} roles with weights + cutlines)`
  );
  console.log(`\u2705 Admin user created: ${adminEmail} (TA_LEADER)`);
  console.log(`\uD83D\uDD17 Team invite URL: ${appUrl}/join/${slug}`);

  await cleanup(prisma, pool);
}

async function cleanup(prisma: PrismaClient, pool: pg.Pool) {
  await prisma.$disconnect();
  await pool.end();
}

main().catch((err) => {
  console.error("Unhandled error:", err);
  process.exit(1);
});

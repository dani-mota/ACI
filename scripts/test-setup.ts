/**
 * Test Infrastructure Setup
 *
 * Creates test users (one per role), pending team invitations (for onboarding
 * testing), and test candidates (at various assessment states) in the Arklight org.
 *
 * Usage:
 *   npx tsx scripts/test-setup.ts           # Create test data
 *   npx tsx scripts/test-setup.ts --reset   # Clean up all test data
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config();
import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { createClient } from "@supabase/supabase-js";

// ─── CONFIGURATION ───────────────────────────────────────
const TEST_EMAIL_BASE = "danielmotaus";
const TEST_EMAIL_DOMAIN = "gmail.com";
const ARKLIGHT_SLUG = "arklight";
const TEST_PASSWORD = process.env.TEST_USER_PASSWORD || "ACI-test-2024!";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

function testEmail(alias: string) {
  return `${TEST_EMAIL_BASE}+${alias}@${TEST_EMAIL_DOMAIN}`;
}

const TEST_USERS = [
  { alias: "recruiter", role: "RECRUITER_COORDINATOR" as const, name: "Test Recruiter" },
  { alias: "recmgr", role: "RECRUITING_MANAGER" as const, name: "Test Rec Manager" },
  { alias: "hiring", role: "HIRING_MANAGER" as const, name: "Test Hiring Mgr" },
  { alias: "taleader", role: "TA_LEADER" as const, name: "Test TA Leader" },
  { alias: "external", role: "EXTERNAL_COLLABORATOR" as const, name: "Test External" },
];

const PENDING_INVITATIONS = [
  { alias: "onboard1", role: "RECRUITER_COORDINATOR" as const, name: "Onboarding Test 1" },
  { alias: "onboard2", role: "HIRING_MANAGER" as const, name: "Onboarding Test 2" },
];

const TEST_CANDIDATES = [
  { first: "Pending", last: "Candidate", email: "pending@test.aci", status: "INVITED" as const, invStatus: "PENDING" as const },
  { first: "InProgress", last: "Candidate", email: "inprogress@test.aci", status: "INCOMPLETE" as const, invStatus: "STARTED" as const },
  { first: "Completed", last: "Candidate", email: "completed@test.aci", status: "RECOMMENDED" as const, invStatus: "COMPLETED" as const },
];

// ─── MAIN ────────────────────────────────────────────────
async function main() {
  const isReset = process.argv.includes("--reset");

  // ─── Environment checks
  const databaseUrl = process.env.DATABASE_URL;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!databaseUrl || !supabaseUrl || !supabaseServiceKey) {
    console.error("Missing required env vars: DATABASE_URL, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  // ─── Init clients
  const pool = new pg.Pool({ connectionString: databaseUrl });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    // ─── Find Arklight org
    const org = await prisma.organization.findUnique({ where: { slug: ARKLIGHT_SLUG } });
    if (!org) {
      console.error(`ABORT: Organization "${ARKLIGHT_SLUG}" not found. Run provision-org.ts first.`);
      process.exit(1);
    }

    const adminUser = await prisma.user.findFirst({
      where: { orgId: org.id, role: "ADMIN" },
    });
    if (!adminUser) {
      console.error("ABORT: No ADMIN user found in Arklight org.");
      process.exit(1);
    }

    const role = await prisma.role.findFirst({ where: { orgId: org.id } });
    if (!role) {
      console.error("ABORT: No roles found in Arklight org.");
      process.exit(1);
    }

    if (isReset) {
      await doReset(prisma, supabase, org.id);
    } else {
      await doCreate(prisma, supabase, org.id, adminUser.id, role.id);
    }
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

// ─── RESET ───────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function doReset(
  prisma: PrismaClient,
  supabase: any,
  orgId: string
) {
  console.log("\n🗑️  Resetting test data...\n");

  // 1. Find and delete Supabase auth accounts for test users
  const allAliases = [...TEST_USERS, ...PENDING_INVITATIONS].map((u) => u.alias);
  for (const alias of allAliases) {
    const email = testEmail(alias);
    const user = await prisma.user.findUnique({ where: { email } });
    if (user?.supabaseId) {
      const { error } = await supabase.auth.admin.deleteUser(user.supabaseId);
      if (error) {
        console.warn(`  ⚠️  Supabase delete failed for ${email}: ${error.message}`);
      } else {
        console.log(`  ✅ Deleted Supabase auth: ${email}`);
      }
    }
    // Also try direct lookup for onboarding users that may not have a Prisma record
    if (!user) {
      try {
        const { data } = await supabase.auth.admin.listUsers({ perPage: 1000 });
        const match = data?.users?.find((u: any) => u.email === email);
        if (match) {
          await supabase.auth.admin.deleteUser(match.id);
          console.log(`  ✅ Deleted Supabase auth (no Prisma record): ${email}`);
        }
      } catch {
        // Ignore
      }
    }
  }

  // 2. Delete test candidates and their assessments
  const testEmails = TEST_CANDIDATES.map((c) => c.email);
  const testCandidates = await prisma.candidate.findMany({
    where: { email: { in: testEmails }, orgId },
    select: { id: true },
  });
  if (testCandidates.length > 0) {
    const candidateIds = testCandidates.map((c) => c.id);
    // Delete assessment-related records first
    const assessments = await prisma.assessment.findMany({
      where: { candidateId: { in: candidateIds } },
      select: { id: true },
    });
    if (assessments.length > 0) {
      const assessmentIds = assessments.map((a) => a.id);
      await prisma.conversationMessage.deleteMany({ where: { assessmentId: { in: assessmentIds } } });
      await prisma.itemResponse.deleteMany({ where: { assessmentId: { in: assessmentIds } } });
      await prisma.assessmentState.deleteMany({ where: { assessmentId: { in: assessmentIds } } });
      await prisma.assessment.deleteMany({ where: { id: { in: assessmentIds } } });
    }
    // Delete assessment invitations
    await prisma.assessmentInvitation.deleteMany({ where: { candidateId: { in: candidateIds } } });
    // Now delete candidates
    const deletedCandidates = await prisma.candidate.deleteMany({
      where: { id: { in: candidateIds } },
    });
    console.log(`  ✅ Deleted ${deletedCandidates.count} test candidates (+ assessments)`);
  } else {
    console.log(`  ✅ No test candidates to delete`);
  }

  // 3. Delete test team invitations
  const invEmails = [...TEST_USERS, ...PENDING_INVITATIONS].map((u) => testEmail(u.alias));
  const deletedInvitations = await prisma.teamInvitation.deleteMany({
    where: { email: { in: invEmails }, orgId },
  });
  console.log(`  ✅ Deleted ${deletedInvitations.count} test team invitations`);

  // 4. Delete test candidate assignments
  const testUserRecords = await prisma.user.findMany({
    where: { email: { in: invEmails } },
    select: { id: true },
  });
  if (testUserRecords.length > 0) {
    const deletedAssignments = await prisma.candidateAssignment.deleteMany({
      where: { userId: { in: testUserRecords.map((u) => u.id) } },
    });
    console.log(`  ✅ Deleted ${deletedAssignments.count} candidate assignments`);
  }

  // 5. Delete assessment invitations created by test users (FK constraint)
  if (testUserRecords.length > 0) {
    const testUserIds = testUserRecords.map((u) => u.id);
    const deletedInvitedBy = await prisma.assessmentInvitation.deleteMany({
      where: { invitedBy: { in: testUserIds } },
    });
    if (deletedInvitedBy.count > 0) {
      console.log(`  ✅ Deleted ${deletedInvitedBy.count} assessment invitations (invitedBy test users)`);
    }
  }

  // 6. Delete test users
  const deletedUsers = await prisma.user.deleteMany({
    where: { email: { in: invEmails } },
  });
  console.log(`  ✅ Deleted ${deletedUsers.count} test users`);

  console.log("\n✅ Reset complete. Real data untouched.\n");
}

// ─── CREATE ──────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function doCreate(
  prisma: PrismaClient,
  supabase: any,
  orgId: string,
  adminUserId: string,
  roleId: string
) {
  console.log("\n🔧 Setting up test infrastructure...\n");

  // 1. Create Supabase auth accounts (idempotent)
  const supabaseIds: Record<string, string> = {};
  const allAccounts = [...TEST_USERS, ...PENDING_INVITATIONS];

  for (const account of allAccounts) {
    const email = testEmail(account.alias);

    // Try to create — handle "already registered" gracefully
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password: TEST_PASSWORD,
      email_confirm: true,
      user_metadata: { name: account.name },
    });

    if (error) {
      if (error.message?.includes("already been registered") || error.status === 422) {
        // Find existing
        const { data: listData } = await supabase.auth.admin.listUsers({ perPage: 1000 });
        const existing = listData?.users?.find((u: any) => u.email === email);
        if (existing) {
          supabaseIds[account.alias] = existing.id;
          console.log(`  ♻️  Reusing existing auth: ${email}`);
          continue;
        }
      }
      console.error(`  ❌ Failed to create auth for ${email}: ${error.message}`);
      continue;
    }

    supabaseIds[account.alias] = data.user.id;
    console.log(`  ✅ Created auth: ${email}`);
  }

  // 2. Prisma transaction for all DB records
  const linkTokens: Record<string, string> = {};

  await prisma.$transaction(async (tx) => {
    // A. Upsert test users
    let externalUserId: string | null = null;
    for (const tu of TEST_USERS) {
      const email = testEmail(tu.alias);
      const supabaseId = supabaseIds[tu.alias];
      if (!supabaseId) continue;

      const user = await tx.user.upsert({
        where: { email },
        update: { role: tu.role, supabaseId, isActive: true },
        create: {
          supabaseId,
          email,
          name: tu.name,
          role: tu.role,
          orgId,
        },
      });
      console.log(`  ✅ User: ${email} → ${tu.role}`);

      if (tu.role === "EXTERNAL_COLLABORATOR") {
        externalUserId = user.id;
      }
    }

    // B. Create pending TeamInvitations (for onboarding flow testing)
    for (const inv of PENDING_INVITATIONS) {
      const email = testEmail(inv.alias);
      const existing = await tx.teamInvitation.findFirst({
        where: { email, orgId, status: "PENDING" },
      });
      if (existing) {
        console.log(`  ♻️  TeamInvitation exists: ${email}`);
        continue;
      }
      await tx.teamInvitation.create({
        data: {
          orgId,
          email,
          name: inv.name,
          role: inv.role,
          invitedBy: adminUserId,
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      });
      console.log(`  ✅ TeamInvitation: ${email} → ${inv.role}`);
    }

    // C. Create test candidates + assessment invitations
    for (const tc of TEST_CANDIDATES) {
      const candidate = await tx.candidate.upsert({
        where: { email_orgId: { email: tc.email, orgId } },
        update: { status: tc.status },
        create: {
          firstName: tc.first,
          lastName: tc.last,
          email: tc.email,
          orgId,
          primaryRoleId: roleId,
          status: tc.status,
        },
      });

      // Create AssessmentInvitation if not exists
      let invitation = await tx.assessmentInvitation.findFirst({
        where: { candidateId: candidate.id },
      });
      if (!invitation) {
        invitation = await tx.assessmentInvitation.create({
          data: {
            candidateId: candidate.id,
            roleId,
            invitedBy: adminUserId,
            expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            status: tc.invStatus,
          },
        });
      }
      linkTokens[tc.email] = invitation.linkToken;
      console.log(`  ✅ Candidate: ${tc.first} ${tc.last} → ${tc.status}`);

      // If this is the first candidate and we have an external user, create assignment
      if (tc.email === TEST_CANDIDATES[0].email && externalUserId) {
        await tx.candidateAssignment.upsert({
          where: { candidateId_userId: { candidateId: candidate.id, userId: externalUserId } },
          update: {},
          create: { candidateId: candidate.id, userId: externalUserId },
        });
        console.log(`  ✅ Assigned "${tc.first} ${tc.last}" → External Collaborator`);
      }
    }
  });

  // 3. Print summary
  console.log(`
${"═".repeat(60)}
  TEST INFRASTRUCTURE READY
${"═".repeat(60)}

  Test Users (password: ${TEST_PASSWORD})
${"─".repeat(60)}`);

  for (const tu of TEST_USERS) {
    console.log(`  ${tu.role.padEnd(28)} ${testEmail(tu.alias)}`);
  }

  console.log(`
  Pending Team Invitations (for onboarding flow):
${"─".repeat(60)}`);

  for (const inv of PENDING_INVITATIONS) {
    console.log(`  ${testEmail(inv.alias).padEnd(42)} → ${inv.role}`);
  }

  console.log(`
  Assessment Links:
${"─".repeat(60)}`);

  for (const tc of TEST_CANDIDATES) {
    const token = linkTokens[tc.email];
    console.log(`  ${tc.status.padEnd(14)} ${APP_URL}/assess/${token}`);
  }

  console.log(`
  EC Candidate Assignment:
${"─".repeat(60)}
  "${TEST_CANDIDATES[0].first} ${TEST_CANDIDATES[0].last}" assigned to ${testEmail("external")}
${"═".repeat(60)}
`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

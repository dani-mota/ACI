import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import pg from "pg";
import { config as loadEnv } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { createClient } from "@supabase/supabase-js";

loadEnv({ path: ".env.local" });
loadEnv();

type DeleteReport = {
  label: string;
  count: number;
};

type OrgSelection = {
  id: string;
  name: string;
  slug: string;
  candidateIds: string[];
  roleIds: string[];
  userIds: string[];
  supabaseIds: string[];
};

function parseArgs(): { orgRef: string | null; dryRun: boolean } {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const orgRef = args.find((arg) => !arg.startsWith("--")) ?? null;

  if (!orgRef) {
    console.error("Usage: npx tsx scripts/deprovision-org.ts <org-slug-or-id> [--dry-run]");
    process.exit(1);
  }

  return { orgRef, dryRun };
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not configured`);
  }
  return value;
}

async function loadOrgSelection(prisma: PrismaClient, orgRef: string): Promise<OrgSelection | null> {
  const organization = await prisma.organization.findFirst({
    where: {
      OR: [{ id: orgRef }, { slug: orgRef }],
    },
    include: {
      candidates: { select: { id: true } },
      roles: { select: { id: true } },
      users: { select: { id: true, supabaseId: true } },
    },
  });

  if (!organization) {
    return null;
  }

  return {
    id: organization.id,
    name: organization.name,
    slug: organization.slug,
    candidateIds: organization.candidates.map((candidate) => candidate.id),
    roleIds: organization.roles.map((role) => role.id),
    userIds: organization.users.map((user) => user.id),
    supabaseIds: organization.users
      .map((user) => user.supabaseId)
      .filter((supabaseId): supabaseId is string => Boolean(supabaseId)),
  };
}

async function collectCounts(prisma: PrismaClient, selection: OrgSelection): Promise<Record<string, number>> {
  const { candidateIds, roleIds, userIds, id: orgId } = selection;
  const assessmentIds = candidateIds.length === 0
    ? []
    : (await prisma.assessment.findMany({
        where: { candidateId: { in: candidateIds } },
        select: { id: true },
      })).map((assessment) => assessment.id);

  const roleFilter = roleIds.length > 0 ? { in: roleIds } : { in: ["__none__"] };
  const candidateFilter = candidateIds.length > 0 ? { in: candidateIds } : { in: ["__none__"] };
  const assessmentFilter = assessmentIds.length > 0 ? { in: assessmentIds } : { in: ["__none__"] };

  const counts = await Promise.all([
    prisma.aIEvaluationRun.count({ where: { assessmentId: assessmentFilter } }),
    prisma.conversationMessage.count({ where: { assessmentId: assessmentFilter } }),
    prisma.assessmentState.count({ where: { assessmentId: assessmentFilter } }),
    prisma.itemResponse.count({ where: { assessmentId: assessmentFilter } }),
    prisma.subtestResult.count({ where: { assessmentId: assessmentFilter } }),
    prisma.compositeScore.count({ where: { assessmentId: assessmentFilter } }),
    prisma.prediction.count({ where: { assessmentId: assessmentFilter } }),
    prisma.redFlag.count({ where: { assessmentId: assessmentFilter } }),
    prisma.postAssessmentSurvey.count({ where: { assessmentId: assessmentFilter } }),
    prisma.aIInteraction.count({ where: { assessmentId: assessmentFilter } }),
    prisma.assessment.count({ where: { id: assessmentFilter } }),
    prisma.note.count({ where: { candidateId: candidateFilter } }),
    prisma.outcomeRecord.count({ where: { candidateId: candidateFilter } }),
    prisma.candidateAssignment.count({ where: { candidateId: candidateFilter } }),
    prisma.assessmentInvitation.count({ where: { candidateId: candidateFilter } }),
    prisma.candidate.count({ where: { id: candidateFilter } }),
    prisma.contentLibrary.count({ where: { roleId: roleFilter } }),
    prisma.compositeWeight.count({ where: { roleId: roleFilter } }),
    prisma.cutline.count({ where: { orgId } }),
    prisma.roleVersion.count({ where: { roleId: roleFilter } }),
    prisma.role.count({ where: { orgId } }),
    prisma.teamInvitation.count({ where: { orgId } }),
    prisma.user.count({ where: { id: { in: userIds.length > 0 ? userIds : ["__none__"] } } }),
    prisma.organization.count({ where: { id: orgId } }),
  ]);

  return {
    AIEvaluationRun: counts[0],
    ConversationMessage: counts[1],
    AssessmentState: counts[2],
    ItemResponse: counts[3],
    SubtestResult: counts[4],
    CompositeScore: counts[5],
    Prediction: counts[6],
    RedFlag: counts[7],
    PostAssessmentSurvey: counts[8],
    AIInteraction: counts[9],
    Assessment: counts[10],
    Note: counts[11],
    OutcomeRecord: counts[12],
    CandidateAssignment: counts[13],
    AssessmentInvitation: counts[14],
    Candidate: counts[15],
    ContentLibrary: counts[16],
    CompositeWeight: counts[17],
    Cutline: counts[18],
    RoleVersion: counts[19],
    Role: counts[20],
    TeamInvitation: counts[21],
    User: counts[22],
    Organization: counts[23],
  };
}

async function confirmDeletion(selection: OrgSelection, counts: Record<string, number>): Promise<void> {
  const rl = readline.createInterface({ input, output });
  const confirmation = `delete ${selection.slug}`;

  console.log(`Organization: ${selection.name} (${selection.slug})`);
  console.log(`Org ID: ${selection.id}`);
  console.log(`Candidates: ${selection.candidateIds.length}`);
  console.log(`Roles: ${selection.roleIds.length}`);
  console.log(`Users: ${selection.userIds.length}`);
  console.log("Deletion plan:");
  for (const [label, count] of Object.entries(counts)) {
    console.log(`  ${label}: ${count}`);
  }
  console.log(`Supabase auth users: ${selection.supabaseIds.length}`);

  const answer = await rl.question(`Type "${confirmation}" to continue: `);
  await rl.close();

  if (answer.trim() !== confirmation) {
    throw new Error("Confirmation aborted");
  }
}

async function deleteSupabaseUsers(selection: OrgSelection): Promise<void> {
  if (selection.supabaseIds.length === 0) {
    return;
  }

  const supabase = createClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    {
      auth: { autoRefreshToken: false, persistSession: false },
    },
  );

  for (const supabaseId of selection.supabaseIds) {
    const { error } = await supabase.auth.admin.deleteUser(supabaseId);
    if (error) {
      throw new Error(`Failed to delete Supabase auth user ${supabaseId}: ${error.message}`);
    }
  }
}

async function deleteOrgData(prisma: PrismaClient, selection: OrgSelection): Promise<DeleteReport[]> {
  const { candidateIds, roleIds, userIds, id: orgId } = selection;
  const assessmentIds = candidateIds.length === 0
    ? []
    : (await prisma.assessment.findMany({
        where: { candidateId: { in: candidateIds } },
        select: { id: true },
      })).map((assessment) => assessment.id);

  const assessmentFilter = assessmentIds.length > 0 ? { in: assessmentIds } : { in: ["__none__"] };
  const candidateFilter = candidateIds.length > 0 ? { in: candidateIds } : { in: ["__none__"] };
  const roleFilter = roleIds.length > 0 ? { in: roleIds } : { in: ["__none__"] };
  const userFilter = userIds.length > 0 ? { in: userIds } : { in: ["__none__"] };

  return prisma.$transaction(async (tx) => {
    const reports: DeleteReport[] = [];

    reports.push({ label: "AIEvaluationRun", count: (await tx.aIEvaluationRun.deleteMany({ where: { assessmentId: assessmentFilter } })).count });
    reports.push({ label: "ConversationMessage", count: (await tx.conversationMessage.deleteMany({ where: { assessmentId: assessmentFilter } })).count });
    reports.push({ label: "AssessmentState", count: (await tx.assessmentState.deleteMany({ where: { assessmentId: assessmentFilter } })).count });
    reports.push({ label: "ItemResponse", count: (await tx.itemResponse.deleteMany({ where: { assessmentId: assessmentFilter } })).count });
    reports.push({ label: "SubtestResult", count: (await tx.subtestResult.deleteMany({ where: { assessmentId: assessmentFilter } })).count });
    reports.push({ label: "CompositeScore", count: (await tx.compositeScore.deleteMany({ where: { assessmentId: assessmentFilter } })).count });
    reports.push({ label: "Prediction", count: (await tx.prediction.deleteMany({ where: { assessmentId: assessmentFilter } })).count });
    reports.push({ label: "RedFlag", count: (await tx.redFlag.deleteMany({ where: { assessmentId: assessmentFilter } })).count });
    reports.push({ label: "PostAssessmentSurvey", count: (await tx.postAssessmentSurvey.deleteMany({ where: { assessmentId: assessmentFilter } })).count });
    reports.push({ label: "AIInteraction", count: (await tx.aIInteraction.deleteMany({ where: { assessmentId: assessmentFilter } })).count });
    reports.push({ label: "Assessment", count: (await tx.assessment.deleteMany({ where: { id: assessmentFilter } })).count });
    reports.push({ label: "Note", count: (await tx.note.deleteMany({ where: { candidateId: candidateFilter } })).count });
    reports.push({ label: "OutcomeRecord", count: (await tx.outcomeRecord.deleteMany({ where: { candidateId: candidateFilter } })).count });
    reports.push({ label: "CandidateAssignment", count: (await tx.candidateAssignment.deleteMany({ where: { candidateId: candidateFilter } })).count });
    reports.push({ label: "AssessmentInvitation", count: (await tx.assessmentInvitation.deleteMany({ where: { candidateId: candidateFilter } })).count });
    reports.push({ label: "Candidate", count: (await tx.candidate.deleteMany({ where: { id: candidateFilter } })).count });
    reports.push({ label: "ContentLibrary", count: (await tx.contentLibrary.deleteMany({ where: { roleId: roleFilter } })).count });
    reports.push({ label: "CompositeWeight", count: (await tx.compositeWeight.deleteMany({ where: { roleId: roleFilter } })).count });
    reports.push({ label: "Cutline", count: (await tx.cutline.deleteMany({ where: { orgId } })).count });
    reports.push({ label: "RoleVersion", count: (await tx.roleVersion.deleteMany({ where: { roleId: roleFilter } })).count });
    reports.push({ label: "Role", count: (await tx.role.deleteMany({ where: { orgId } })).count });
    reports.push({ label: "TeamInvitation", count: (await tx.teamInvitation.deleteMany({ where: { orgId } })).count });
    reports.push({ label: "User", count: (await tx.user.deleteMany({ where: { id: userFilter } })).count });
    reports.push({ label: "Organization", count: (await tx.organization.deleteMany({ where: { id: orgId } })).count });

    return reports;
  });
}

async function main() {
  const { orgRef, dryRun } = parseArgs();
  const pool = new pg.Pool({ connectionString: requireEnv("DATABASE_URL") });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  try {
    const selection = await loadOrgSelection(prisma, orgRef);
    if (!selection) {
      console.error(`Organization "${orgRef}" not found.`);
      process.exitCode = 1;
      return;
    }

    const counts = await collectCounts(prisma, selection);

    if (dryRun) {
      console.log(`Dry run for ${selection.name} (${selection.slug})`);
      for (const [label, count] of Object.entries(counts)) {
        console.log(`  ${label}: ${count}`);
      }
      if (selection.supabaseIds.length > 0) {
        console.log("  Supabase auth users:");
        for (const supabaseId of selection.supabaseIds) {
          console.log(`    ${supabaseId}`);
        }
      }
      return;
    }

    await confirmDeletion(selection, counts);
    await deleteSupabaseUsers(selection);
    const reports = await deleteOrgData(prisma, selection);

    for (const report of reports) {
      console.log(`Deleted ${report.count} ${report.label} row(s)`);
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

void main();

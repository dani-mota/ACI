/**
 * Populate jdContext for the Factory Technician test role.
 * Usage: npx tsx scripts/update-role-jd-context.ts [roleId]
 *
 * If roleId is omitted, targets the first role with "Factory Technician" in its name.
 */
import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const jdContext = {
  title: "Factory Technician",
  level: "ENTRY",
  technicalSkills: [
    "CNC operation",
    "SPC monitoring",
    "torque wrench calibration",
    "ISO 9001 procedures",
  ],
  keyTasks: [
    "monitor production line",
    "inspect finished components",
    "log quality non-conformances",
    "escalate equipment failures",
  ],
  environment: {
    setting: "FLOOR",
    physicalDemands: "HIGH",
    shiftWork: true,
  },
  consequenceOfError: {
    safetyCritical: true,
    qualityCritical: true,
    costImpact: "HIGH",
  },
  behavioralRequirements: [
    "attention to detail",
    "process discipline",
    "safety compliance",
  ],
  supervision: {
    receivesSupervision: "MODERATE",
    providesSupervision: false,
    teamSize: null,
  },
  learningRequirements: {
    newTechnologyAdoption: true,
    continuousLearning: true,
    crossTraining: false,
  },
  outsideScope: false,
  outsideScopeReason: null,
};

async function main() {
  const roleId = process.argv[2];

  const role = roleId
    ? await prisma.role.findUnique({ where: { id: roleId } })
    : await prisma.role.findFirst({ where: { name: { contains: "Factory Technician" } } });

  if (!role) {
    // List all roles to help the user pick one
    const all = await prisma.role.findMany({ select: { id: true, name: true } });
    console.error("Role not found. Pass a roleId. Available roles:");
    all.forEach((r) => console.error(`  ${r.id}  "${r.name}"`));
    process.exit(1);
  }

  console.log(`Updating role: ${role.id} — "${role.name}"`);

  await prisma.role.update({
    where: { id: role.id },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: { jdContext: jdContext as any },
  });

  console.log("jdContext updated successfully.");
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

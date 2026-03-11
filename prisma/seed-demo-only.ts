/**
 * Targeted demo seed — replaces ONLY isDemo organizations.
 * Live orgs (Arklight, Faith and AI, Hamsa, etc.) are untouched.
 *
 * Usage:
 *   npx tsx prisma/seed-demo-only.ts
 */

import "dotenv/config";
import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// ─── Re-use all type/data definitions from seed.ts ──────────────────────────
// (duplicated here so this script is self-contained)

const CONSTRUCTS = [
  { id: "FLUID_REASONING", layer: "COGNITIVE_CORE" },
  { id: "EXECUTIVE_CONTROL", layer: "COGNITIVE_CORE" },
  { id: "COGNITIVE_FLEXIBILITY", layer: "COGNITIVE_CORE" },
  { id: "METACOGNITIVE_CALIBRATION", layer: "COGNITIVE_CORE" },
  { id: "LEARNING_VELOCITY", layer: "COGNITIVE_CORE" },
  { id: "SYSTEMS_DIAGNOSTICS", layer: "TECHNICAL_APTITUDE" },
  { id: "PATTERN_RECOGNITION", layer: "TECHNICAL_APTITUDE" },
  { id: "QUANTITATIVE_REASONING", layer: "TECHNICAL_APTITUDE" },
  { id: "SPATIAL_VISUALIZATION", layer: "TECHNICAL_APTITUDE" },
  { id: "MECHANICAL_REASONING", layer: "TECHNICAL_APTITUDE" },
  { id: "PROCEDURAL_RELIABILITY", layer: "BEHAVIORAL_INTEGRITY" },
  { id: "ETHICAL_JUDGMENT", layer: "BEHAVIORAL_INTEGRITY" },
] as const;

type ConstructId = (typeof CONSTRUCTS)[number]["id"];

type Archetype = {
  name: string;
  scores: Record<ConstructId, [number, number]>;
  flagProbability: number;
};

const ARCHETYPES: Record<string, Archetype> = {
  Star: {
    name: "Star",
    scores: {
      FLUID_REASONING: [82, 97], EXECUTIVE_CONTROL: [78, 95], COGNITIVE_FLEXIBILITY: [80, 96],
      METACOGNITIVE_CALIBRATION: [75, 92], LEARNING_VELOCITY: [85, 98],
      SYSTEMS_DIAGNOSTICS: [78, 95], PATTERN_RECOGNITION: [80, 96], QUANTITATIVE_REASONING: [82, 97],
      SPATIAL_VISUALIZATION: [80, 95], MECHANICAL_REASONING: [75, 93],
      PROCEDURAL_RELIABILITY: [70, 90], ETHICAL_JUDGMENT: [75, 95],
    },
    flagProbability: 0.05,
  },
  Specialist: {
    name: "Specialist",
    scores: {
      FLUID_REASONING: [70, 88], EXECUTIVE_CONTROL: [55, 75], COGNITIVE_FLEXIBILITY: [60, 78],
      METACOGNITIVE_CALIBRATION: [45, 65], LEARNING_VELOCITY: [65, 82],
      SYSTEMS_DIAGNOSTICS: [80, 95], PATTERN_RECOGNITION: [75, 92], QUANTITATIVE_REASONING: [82, 97],
      SPATIAL_VISUALIZATION: [78, 95], MECHANICAL_REASONING: [80, 96],
      PROCEDURAL_RELIABILITY: [55, 72], ETHICAL_JUDGMENT: [50, 68],
    },
    flagProbability: 0.15,
  },
  SteadyHand: {
    name: "Steady Hand",
    scores: {
      FLUID_REASONING: [45, 62], EXECUTIVE_CONTROL: [65, 82], COGNITIVE_FLEXIBILITY: [40, 58],
      METACOGNITIVE_CALIBRATION: [70, 88], LEARNING_VELOCITY: [58, 72],
      SYSTEMS_DIAGNOSTICS: [55, 72], PATTERN_RECOGNITION: [52, 68], QUANTITATIVE_REASONING: [55, 72],
      SPATIAL_VISUALIZATION: [50, 66], MECHANICAL_REASONING: [58, 75],
      PROCEDURAL_RELIABILITY: [82, 97], ETHICAL_JUDGMENT: [80, 96],
    },
    flagProbability: 0.05,
  },
  QuickStudy: {
    name: "Quick Study",
    scores: {
      FLUID_REASONING: [72, 90], EXECUTIVE_CONTROL: [55, 72], COGNITIVE_FLEXIBILITY: [70, 88],
      METACOGNITIVE_CALIBRATION: [60, 78], LEARNING_VELOCITY: [85, 98],
      SYSTEMS_DIAGNOSTICS: [58, 75], PATTERN_RECOGNITION: [60, 78], QUANTITATIVE_REASONING: [58, 75],
      SPATIAL_VISUALIZATION: [60, 78], MECHANICAL_REASONING: [55, 72],
      PROCEDURAL_RELIABILITY: [55, 72], ETHICAL_JUDGMENT: [58, 75],
    },
    flagProbability: 0.10,
  },
  Concern: {
    name: "Concern",
    scores: {
      FLUID_REASONING: [30, 48], EXECUTIVE_CONTROL: [25, 42], COGNITIVE_FLEXIBILITY: [28, 45],
      METACOGNITIVE_CALIBRATION: [20, 38], LEARNING_VELOCITY: [30, 48],
      SYSTEMS_DIAGNOSTICS: [28, 45], PATTERN_RECOGNITION: [30, 48], QUANTITATIVE_REASONING: [28, 45],
      SPATIAL_VISUALIZATION: [25, 42], MECHANICAL_REASONING: [28, 45],
      PROCEDURAL_RELIABILITY: [25, 42], ETHICAL_JUDGMENT: [20, 38],
    },
    flagProbability: 0.70,
  },
  DiamondInTheRough: {
    name: "Diamond in the Rough",
    scores: {
      FLUID_REASONING: [78, 95], EXECUTIVE_CONTROL: [70, 88], COGNITIVE_FLEXIBILITY: [75, 92],
      METACOGNITIVE_CALIBRATION: [65, 82], LEARNING_VELOCITY: [82, 97],
      SYSTEMS_DIAGNOSTICS: [55, 72], PATTERN_RECOGNITION: [58, 75], QUANTITATIVE_REASONING: [55, 72],
      SPATIAL_VISUALIZATION: [52, 68], MECHANICAL_REASONING: [50, 65],
      PROCEDURAL_RELIABILITY: [45, 62], ETHICAL_JUDGMENT: [48, 65],
    },
    flagProbability: 0.10,
  },
  VeteranProfile: {
    name: "Veteran",
    scores: {
      FLUID_REASONING: [62, 78], EXECUTIVE_CONTROL: [75, 92], COGNITIVE_FLEXIBILITY: [60, 78],
      METACOGNITIVE_CALIBRATION: [80, 95], LEARNING_VELOCITY: [60, 75],
      SYSTEMS_DIAGNOSTICS: [72, 88], PATTERN_RECOGNITION: [68, 85], QUANTITATIVE_REASONING: [65, 82],
      SPATIAL_VISUALIZATION: [70, 88], MECHANICAL_REASONING: [75, 92],
      PROCEDURAL_RELIABILITY: [88, 98], ETHICAL_JUDGMENT: [85, 97],
    },
    flagProbability: 0.03,
  },
  WildCard: {
    name: "Wild Card",
    scores: {
      FLUID_REASONING: [40, 92], EXECUTIVE_CONTROL: [35, 88], COGNITIVE_FLEXIBILITY: [38, 90],
      METACOGNITIVE_CALIBRATION: [30, 85], LEARNING_VELOCITY: [42, 94],
      SYSTEMS_DIAGNOSTICS: [35, 88], PATTERN_RECOGNITION: [38, 90], QUANTITATIVE_REASONING: [35, 88],
      SPATIAL_VISUALIZATION: [32, 85], MECHANICAL_REASONING: [35, 88],
      PROCEDURAL_RELIABILITY: [28, 82], ETHICAL_JUDGMENT: [30, 84],
    },
    flagProbability: 0.30,
  },
  BrightUnpolished: {
    name: "Bright but Unpolished",
    scores: {
      FLUID_REASONING: [75, 92], EXECUTIVE_CONTROL: [45, 62], COGNITIVE_FLEXIBILITY: [65, 82],
      METACOGNITIVE_CALIBRATION: [40, 58], LEARNING_VELOCITY: [78, 95],
      SYSTEMS_DIAGNOSTICS: [50, 68], PATTERN_RECOGNITION: [55, 72], QUANTITATIVE_REASONING: [52, 70],
      SPATIAL_VISUALIZATION: [48, 65], MECHANICAL_REASONING: [45, 62],
      PROCEDURAL_RELIABILITY: [38, 55], ETHICAL_JUDGMENT: [42, 60],
    },
    flagProbability: 0.20,
  },
  Borderline: {
    name: "Borderline",
    scores: {
      FLUID_REASONING: [48, 65], EXECUTIVE_CONTROL: [45, 62], COGNITIVE_FLEXIBILITY: [46, 63],
      METACOGNITIVE_CALIBRATION: [42, 60], LEARNING_VELOCITY: [48, 65],
      SYSTEMS_DIAGNOSTICS: [46, 63], PATTERN_RECOGNITION: [48, 65], QUANTITATIVE_REASONING: [46, 63],
      SPATIAL_VISUALIZATION: [44, 62], MECHANICAL_REASONING: [46, 63],
      PROCEDURAL_RELIABILITY: [44, 62], ETHICAL_JUDGMENT: [42, 60],
    },
    flagProbability: 0.30,
  },
};

function randBetween(min: number, max: number): number {
  return Math.round(min + Math.random() * (max - min));
}

function candidateStatus(_composite: number, techAvg: number, behavAvg: number, cutline: { tech: number; behav: number; lv: number }, lv: number): "RECOMMENDED" | "REVIEW_REQUIRED" | "DO_NOT_ADVANCE" {
  if (techAvg >= cutline.tech && behavAvg >= cutline.behav && lv >= cutline.lv) return "RECOMMENDED";
  if (techAvg >= cutline.tech - 8 && behavAvg >= cutline.behav - 8) return "REVIEW_REQUIRED";
  return "DO_NOT_ADVANCE";
}

type RoleSpec = {
  name: string;
  slug: string;
  description: string;
  complexityLevel: "LOW" | "MEDIUM" | "MEDIUM_HIGH" | "HIGH";
  weights: Record<ConstructId, number>;
  cutline: { tech: number; behav: number; lv: number };
};

type CandidateSpec = {
  firstName: string;
  lastName: string;
  emailPrefix: string;
  primaryRoleSlug: string;
  archetype: string;
  forcedRedFlag?: boolean;
  incomplete?: boolean;
};

type OrgSpec = {
  name: string;
  slug: string;
  domain: string;
  adminEmail: string;
  adminName: string;
  roles: RoleSpec[];
  candidates: CandidateSpec[];
};

// ─── Generic aptitude role weights (used for cross-role composites) ──────────
const GENERIC_WEIGHTS: Record<ConstructId, number> = {
  FLUID_REASONING: 0.10, EXECUTIVE_CONTROL: 0.08, COGNITIVE_FLEXIBILITY: 0.08,
  METACOGNITIVE_CALIBRATION: 0.07, LEARNING_VELOCITY: 0.10,
  SYSTEMS_DIAGNOSTICS: 0.10, PATTERN_RECOGNITION: 0.09, QUANTITATIVE_REASONING: 0.10,
  SPATIAL_VISUALIZATION: 0.08, MECHANICAL_REASONING: 0.08,
  PROCEDURAL_RELIABILITY: 0.07, ETHICAL_JUDGMENT: 0.05,
};

async function seedDemoOrg(spec: OrgSpec): Promise<void> {
  console.log(`\n  Seeding: ${spec.name}`);

  const org = await prisma.organization.create({
    data: { name: spec.name, slug: spec.slug, domain: spec.domain, isDemo: true },
  });

  const adminUser = await prisma.user.create({
    data: {
      email: spec.adminEmail,
      name: spec.adminName,
      role: "TA_LEADER",
      orgId: org.id,
    },
  });

  // Roles
  const roleRecords: Record<string, { id: string; slug: string; weights: Record<ConstructId, number>; cutline: { tech: number; behav: number; lv: number } }> = {};

  for (const r of spec.roles) {
    const role = await prisma.role.create({
      data: {
        name: r.name,
        slug: r.slug,
        description: r.description,
        orgId: org.id,
        isCustom: false,
        complexityLevel: r.complexityLevel,
        sourceType: "SYSTEM_DEFAULT",
      },
    });
    roleRecords[r.slug] = { id: role.id, slug: role.slug, weights: r.weights, cutline: r.cutline };

    await prisma.cutline.create({
      data: {
        roleId: role.id,
        orgId: org.id,
        technicalAptitude: r.cutline.tech,
        behavioralIntegrity: r.cutline.behav,
        learningVelocity: r.cutline.lv,
        overallMinimum: 30,
      },
    });

    for (const c of CONSTRUCTS) {
      await prisma.compositeWeight.create({
        data: {
          roleId: role.id,
          constructId: c.id,
          weight: r.weights[c.id],
          version: 1,
          source: "RESEARCH_VALIDATED",
        },
      });
    }
  }

  // Generic role (for cross-role composites)
  const genericRole = await prisma.role.create({
    data: {
      name: "General Aptitude",
      slug: `generic-aptitude-${spec.slug}`,
      description: "Cross-role aptitude baseline",
      orgId: org.id,
      isCustom: false,
      sourceType: "SYSTEM_DEFAULT",
    },
  });
  for (const c of CONSTRUCTS) {
    await prisma.compositeWeight.create({
      data: {
        roleId: genericRole.id,
        constructId: c.id,
        weight: GENERIC_WEIGHTS[c.id],
        version: 1,
        source: "RESEARCH_VALIDATED",
      },
    });
  }

  // Candidates
  for (const cSpec of spec.candidates) {
    if (!(cSpec.archetype in ARCHETYPES)) {
      console.warn(`    Unknown archetype: ${cSpec.archetype} — skipping ${cSpec.firstName}`);
      continue;
    }
    const arch = ARCHETYPES[cSpec.archetype];
    const primaryRole = roleRecords[cSpec.primaryRoleSlug];
    if (!primaryRole) {
      console.warn(`    Unknown role slug: ${cSpec.primaryRoleSlug} — skipping ${cSpec.firstName}`);
      continue;
    }

    // Generate subtest scores
    const subtestScores: Record<ConstructId, number> = {} as Record<ConstructId, number>;
    for (const c of CONSTRUCTS) {
      const [min, max] = arch.scores[c.id];
      subtestScores[c.id] = cSpec.incomplete && Math.random() < 0.4 ? 0 : randBetween(min, max);
    }

    // Calculate composites
    const techConstructs = CONSTRUCTS.filter(c => c.layer === "TECHNICAL_APTITUDE");
    const behavConstructs = CONSTRUCTS.filter(c => c.layer === "BEHAVIORAL_INTEGRITY");
    const techAvg = Math.round(techConstructs.reduce((s, c) => s + subtestScores[c.id], 0) / techConstructs.length);
    const behavAvg = Math.round(behavConstructs.reduce((s, c) => s + subtestScores[c.id], 0) / behavConstructs.length);
    const lv = subtestScores.LEARNING_VELOCITY;

    // Weighted composite for primary role
    let weightedSum = 0;
    for (const c of CONSTRUCTS) {
      weightedSum += subtestScores[c.id] * primaryRole.weights[c.id];
    }
    const primaryComposite = Math.round(weightedSum);

    const status = cSpec.incomplete ? "INCOMPLETE" : candidateStatus(primaryComposite, techAvg, behavAvg, primaryRole.cutline, lv);

    const candidate = await prisma.candidate.create({
      data: {
        firstName: cSpec.firstName,
        lastName: cSpec.lastName,
        email: `${cSpec.emailPrefix}@${spec.domain}`,
        orgId: org.id,
        primaryRoleId: primaryRole.id,
        status,
      },
    });

    const assessment = await prisma.assessment.create({
      data: {
        candidateId: candidate.id,
        startedAt: new Date(Date.now() - Math.random() * 30 * 86400000),
        completedAt: cSpec.incomplete ? null : new Date(Date.now() - Math.random() * 20 * 86400000),
      },
    });

    // Subtest results
    for (const c of CONSTRUCTS) {
      await prisma.subtestResult.create({
        data: {
          assessmentId: assessment.id,
          construct: c.id,
          layer: c.layer,
          percentile: subtestScores[c.id],
          rawScore: Math.round(subtestScores[c.id] * 0.85),
          itemCount: 10,
        },
      });
    }

    // Composite scores — one per role + generic
    const allRoles = [
      ...Object.values(roleRecords),
      { id: genericRole.id, slug: `generic-aptitude-${spec.slug}`, weights: GENERIC_WEIGHTS, cutline: { tech: 50, behav: 50, lv: 45 } },
    ];
    for (const r of allRoles) {
      let ws = 0;
      for (const c of CONSTRUCTS) ws += subtestScores[c.id] * r.weights[c.id];
      const compositeScore = Math.round(ws);
      const cutlineMet = techAvg >= r.cutline.tech && behavAvg >= r.cutline.behav && lv >= r.cutline.lv;
      await prisma.compositeScore.create({
        data: {
          assessmentId: assessment.id,
          roleSlug: r.slug,
          indexName: "Composite",
          score: compositeScore,
          percentile: compositeScore,
          passed: cutlineMet,
          distanceFromCutline: compositeScore - r.cutline.tech,
        },
      });
    }

    // Predictions
    if (!cSpec.incomplete) {
      const rampMonths = status === "RECOMMENDED" ? randBetween(2, 4) : randBetween(5, 9);
      await prisma.prediction.create({
        data: {
          assessmentId: assessment.id,
          rampTimeMonths: rampMonths,
          rampTimeLabel: `${rampMonths} months`,
          rampTimeFactors: { primary: arch.name },
          supervisionLoad: status === "RECOMMENDED" ? "LOW" : "HIGH",
          supervisionScore: status === "RECOMMENDED" ? randBetween(70, 90) : randBetween(40, 65),
          supervisionFactors: { behavioral: behavAvg },
          performanceCeiling: status === "RECOMMENDED" ? "HIGH" : "MEDIUM",
          ceilingFactors: { cognitive: techAvg },
          ceilingCareerPath: ["Senior", "Lead"],
          attritionRisk: status === "RECOMMENDED" ? "LOW" : "MEDIUM",
          attritionFactors: { fit: primaryComposite },
          attritionStrategies: ["Mentorship", "Clear growth path"],
        },
      });
    }

    // Red flag
    const shouldFlag = cSpec.forcedRedFlag || (!cSpec.incomplete && Math.random() < arch.flagProbability);
    if (shouldFlag) {
      await prisma.redFlag.create({
        data: {
          assessmentId: assessment.id,
          severity: "WARNING",
          category: "BEHAVIORAL",
          title: "Integrity Pattern Flag",
          description: "Response pattern inconsistency detected on behavioral integrity items.",
          constructs: ["ETHICAL_JUDGMENT"],
        },
      });
    }

    // AI interaction
    if (!cSpec.incomplete) {
      await prisma.aIInteraction.create({
        data: {
          assessmentId: assessment.id,
          construct: "ETHICAL_JUDGMENT",
          sequenceOrder: 1,
          aiPrompt: `Evaluate ${arch.name} profile with composite score of ${primaryComposite}th percentile.`,
        },
      });
    }

    // Note
    if (Math.random() < 0.4) {
      await prisma.note.create({
        data: {
          candidateId: candidate.id,
          authorId: adminUser.id,
          content: `Reviewed ${cSpec.firstName}'s assessment. ${status === "RECOMMENDED" ? "Strong candidate — schedule follow-up." : "Flag for team discussion."}`,
        },
      });
    }
  }

  const candidateCount = await prisma.candidate.count({ where: { orgId: org.id } });
  console.log(`    ✓ ${candidateCount} candidates created`);
}

// ─── Org Specs ────────────────────────────────────────────────────────────────

const atlasDefenseSpec: OrgSpec = {
  name: "Atlas Defense Corp",
  slug: "atlas-defense",
  domain: "atlasdefense.com",
  adminEmail: "demo-admin@atlasdefense.com",
  adminName: "Atlas Demo Admin",
  roles: [
    {
      name: "CNC Machinist",
      slug: "cnc-machinist",
      description: "Operates CNC equipment to produce precision defense components to tight tolerances.",
      complexityLevel: "MEDIUM",
      weights: {
        FLUID_REASONING: 0.08, EXECUTIVE_CONTROL: 0.08, COGNITIVE_FLEXIBILITY: 0.07,
        METACOGNITIVE_CALIBRATION: 0.08, LEARNING_VELOCITY: 0.07,
        SYSTEMS_DIAGNOSTICS: 0.12, PATTERN_RECOGNITION: 0.10, QUANTITATIVE_REASONING: 0.12,
        SPATIAL_VISUALIZATION: 0.12, MECHANICAL_REASONING: 0.10,
        PROCEDURAL_RELIABILITY: 0.04, ETHICAL_JUDGMENT: 0.02,
      },
      cutline: { tech: 58, behav: 50, lv: 45 },
    },
    {
      name: "Manufacturing Process Engineer",
      slug: "manufacturing-process-engineer",
      description: "Designs and optimizes production processes for high-precision aerospace and defense parts.",
      complexityLevel: "MEDIUM_HIGH",
      weights: {
        FLUID_REASONING: 0.12, EXECUTIVE_CONTROL: 0.10, COGNITIVE_FLEXIBILITY: 0.09,
        METACOGNITIVE_CALIBRATION: 0.06, LEARNING_VELOCITY: 0.08,
        SYSTEMS_DIAGNOSTICS: 0.13, PATTERN_RECOGNITION: 0.10, QUANTITATIVE_REASONING: 0.12,
        SPATIAL_VISUALIZATION: 0.09, MECHANICAL_REASONING: 0.07,
        PROCEDURAL_RELIABILITY: 0.03, ETHICAL_JUDGMENT: 0.01,
      },
      cutline: { tech: 62, behav: 52, lv: 50 },
    },
    {
      name: "Quality Engineer",
      slug: "quality-engineer",
      description: "Ensures product conformance to AS9100 and DoD requirements through inspection and SPC.",
      complexityLevel: "MEDIUM",
      weights: {
        FLUID_REASONING: 0.09, EXECUTIVE_CONTROL: 0.09, COGNITIVE_FLEXIBILITY: 0.07,
        METACOGNITIVE_CALIBRATION: 0.09, LEARNING_VELOCITY: 0.07,
        SYSTEMS_DIAGNOSTICS: 0.11, PATTERN_RECOGNITION: 0.11, QUANTITATIVE_REASONING: 0.11,
        SPATIAL_VISUALIZATION: 0.08, MECHANICAL_REASONING: 0.08,
        PROCEDURAL_RELIABILITY: 0.07, ETHICAL_JUDGMENT: 0.03,
      },
      cutline: { tech: 55, behav: 55, lv: 45 },
    },
    {
      name: "NDT Technician",
      slug: "ndt-technician",
      description: "Performs non-destructive testing on structural components using UT, RT, and PT methods.",
      complexityLevel: "MEDIUM",
      weights: {
        FLUID_REASONING: 0.07, EXECUTIVE_CONTROL: 0.07, COGNITIVE_FLEXIBILITY: 0.06,
        METACOGNITIVE_CALIBRATION: 0.10, LEARNING_VELOCITY: 0.07,
        SYSTEMS_DIAGNOSTICS: 0.12, PATTERN_RECOGNITION: 0.14, QUANTITATIVE_REASONING: 0.10,
        SPATIAL_VISUALIZATION: 0.12, MECHANICAL_REASONING: 0.08,
        PROCEDURAL_RELIABILITY: 0.05, ETHICAL_JUDGMENT: 0.02,
      },
      cutline: { tech: 55, behav: 48, lv: 42 },
    },
    {
      name: "Production Supervisor",
      slug: "production-supervisor",
      description: "Leads a shift team of 12–20 operators on the manufacturing floor.",
      complexityLevel: "MEDIUM_HIGH",
      weights: {
        FLUID_REASONING: 0.10, EXECUTIVE_CONTROL: 0.14, COGNITIVE_FLEXIBILITY: 0.10,
        METACOGNITIVE_CALIBRATION: 0.09, LEARNING_VELOCITY: 0.07,
        SYSTEMS_DIAGNOSTICS: 0.08, PATTERN_RECOGNITION: 0.08, QUANTITATIVE_REASONING: 0.08,
        SPATIAL_VISUALIZATION: 0.05, MECHANICAL_REASONING: 0.06,
        PROCEDURAL_RELIABILITY: 0.10, ETHICAL_JUDGMENT: 0.05,
      },
      cutline: { tech: 50, behav: 62, lv: 48 },
    },
  ],
  candidates: [
    { firstName: "Jordan", lastName: "Nakamura", emailPrefix: "j.nakamura", primaryRoleSlug: "manufacturing-process-engineer", archetype: "Star" },
    { firstName: "Marcus", lastName: "Webb", emailPrefix: "m.webb", primaryRoleSlug: "cnc-machinist", archetype: "SteadyHand" },
    { firstName: "Sofia", lastName: "Reyes", emailPrefix: "s.reyes", primaryRoleSlug: "quality-engineer", archetype: "Specialist" },
    { firstName: "Craig", lastName: "Hollister", emailPrefix: "c.hollister", primaryRoleSlug: "cnc-machinist", archetype: "Concern", forcedRedFlag: true },
    { firstName: "Amara", lastName: "Osei", emailPrefix: "a.osei", primaryRoleSlug: "manufacturing-process-engineer", archetype: "DiamondInTheRough" },
    { firstName: "Derek", lastName: "Finch", emailPrefix: "d.finch", primaryRoleSlug: "ndt-technician", archetype: "VeteranProfile" },
    { firstName: "Priya", lastName: "Sharma", emailPrefix: "p.sharma", primaryRoleSlug: "quality-engineer", archetype: "QuickStudy" },
    { firstName: "Luis", lastName: "Mendez", emailPrefix: "l.mendez", primaryRoleSlug: "production-supervisor", archetype: "SteadyHand" },
    { firstName: "Kenji", lastName: "Watanabe", emailPrefix: "k.watanabe", primaryRoleSlug: "cnc-machinist", archetype: "Specialist" },
    { firstName: "Rachel", lastName: "Okafor", emailPrefix: "r.okafor", primaryRoleSlug: "manufacturing-process-engineer", archetype: "Borderline" },
    { firstName: "Tom", lastName: "Briggs", emailPrefix: "t.briggs", primaryRoleSlug: "ndt-technician", archetype: "WildCard" },
    { firstName: "Nina", lastName: "Castellano", emailPrefix: "n.castellano", primaryRoleSlug: "quality-engineer", archetype: "Star" },
    { firstName: "Darius", lastName: "Cole", emailPrefix: "d.cole", primaryRoleSlug: "production-supervisor", archetype: "BrightUnpolished" },
    { firstName: "Mei", lastName: "Liu", emailPrefix: "m.liu", primaryRoleSlug: "cnc-machinist", archetype: "QuickStudy" },
    { firstName: "Patrick", lastName: "Quinn", emailPrefix: "p.quinn", primaryRoleSlug: "manufacturing-process-engineer", archetype: "Concern" },
    { firstName: "Serena", lastName: "Voss", emailPrefix: "s.voss", primaryRoleSlug: "ndt-technician", archetype: "SteadyHand" },
    { firstName: "Alex", lastName: "Tanaka", emailPrefix: "a.tanaka", primaryRoleSlug: "quality-engineer", archetype: "Borderline", incomplete: true },
    { firstName: "Omar", lastName: "Hassan", emailPrefix: "o.hassan", primaryRoleSlug: "production-supervisor", archetype: "VeteranProfile" },
  ],
};

const orbitalDynamicsSpec: OrgSpec = {
  name: "Orbital Dynamics",
  slug: "orbital-dynamics",
  domain: "orbitaldynamics.io",
  adminEmail: "demo-admin@orbitaldynamics.io",
  adminName: "Orbital Demo Admin",
  roles: [
    {
      name: "Systems Engineer",
      slug: "systems-engineer",
      description: "Owns end-to-end system architecture and integration for satellite platforms.",
      complexityLevel: "HIGH",
      weights: {
        FLUID_REASONING: 0.14, EXECUTIVE_CONTROL: 0.10, COGNITIVE_FLEXIBILITY: 0.10,
        METACOGNITIVE_CALIBRATION: 0.08, LEARNING_VELOCITY: 0.08,
        SYSTEMS_DIAGNOSTICS: 0.14, PATTERN_RECOGNITION: 0.10, QUANTITATIVE_REASONING: 0.12,
        SPATIAL_VISUALIZATION: 0.08, MECHANICAL_REASONING: 0.06,
        PROCEDURAL_RELIABILITY: 0.00, ETHICAL_JUDGMENT: 0.00,
      },
      cutline: { tech: 68, behav: 55, lv: 58 },
    },
    {
      name: "Avionics Technician",
      slug: "avionics-technician",
      description: "Builds, tests, and troubleshoots avionics harnesses and electronic assemblies.",
      complexityLevel: "MEDIUM_HIGH",
      weights: {
        FLUID_REASONING: 0.08, EXECUTIVE_CONTROL: 0.07, COGNITIVE_FLEXIBILITY: 0.07,
        METACOGNITIVE_CALIBRATION: 0.09, LEARNING_VELOCITY: 0.07,
        SYSTEMS_DIAGNOSTICS: 0.13, PATTERN_RECOGNITION: 0.12, QUANTITATIVE_REASONING: 0.11,
        SPATIAL_VISUALIZATION: 0.10, MECHANICAL_REASONING: 0.10,
        PROCEDURAL_RELIABILITY: 0.04, ETHICAL_JUDGMENT: 0.02,
      },
      cutline: { tech: 60, behav: 52, lv: 48 },
    },
    {
      name: "Quality Assurance Inspector",
      slug: "qa-inspector",
      description: "Verifies workmanship and dimensional compliance on flight hardware to AS9100 standards.",
      complexityLevel: "MEDIUM",
      weights: {
        FLUID_REASONING: 0.07, EXECUTIVE_CONTROL: 0.08, COGNITIVE_FLEXIBILITY: 0.06,
        METACOGNITIVE_CALIBRATION: 0.11, LEARNING_VELOCITY: 0.06,
        SYSTEMS_DIAGNOSTICS: 0.11, PATTERN_RECOGNITION: 0.13, QUANTITATIVE_REASONING: 0.10,
        SPATIAL_VISUALIZATION: 0.11, MECHANICAL_REASONING: 0.09,
        PROCEDURAL_RELIABILITY: 0.06, ETHICAL_JUDGMENT: 0.02,
      },
      cutline: { tech: 55, behav: 55, lv: 44 },
    },
    {
      name: "Mission Planner",
      slug: "mission-planner",
      description: "Develops orbital maneuver plans, launch windows, and contingency sequences.",
      complexityLevel: "HIGH",
      weights: {
        FLUID_REASONING: 0.13, EXECUTIVE_CONTROL: 0.11, COGNITIVE_FLEXIBILITY: 0.10,
        METACOGNITIVE_CALIBRATION: 0.09, LEARNING_VELOCITY: 0.09,
        SYSTEMS_DIAGNOSTICS: 0.11, PATTERN_RECOGNITION: 0.09, QUANTITATIVE_REASONING: 0.14,
        SPATIAL_VISUALIZATION: 0.10, MECHANICAL_REASONING: 0.04,
        PROCEDURAL_RELIABILITY: 0.00, ETHICAL_JUDGMENT: 0.00,
      },
      cutline: { tech: 70, behav: 55, lv: 60 },
    },
    {
      name: "Flight Test Engineer",
      slug: "flight-test-engineer",
      description: "Plans and executes environmental and functional test campaigns on satellite subsystems.",
      complexityLevel: "HIGH",
      weights: {
        FLUID_REASONING: 0.12, EXECUTIVE_CONTROL: 0.10, COGNITIVE_FLEXIBILITY: 0.09,
        METACOGNITIVE_CALIBRATION: 0.10, LEARNING_VELOCITY: 0.09,
        SYSTEMS_DIAGNOSTICS: 0.13, PATTERN_RECOGNITION: 0.11, QUANTITATIVE_REASONING: 0.12,
        SPATIAL_VISUALIZATION: 0.08, MECHANICAL_REASONING: 0.06,
        PROCEDURAL_RELIABILITY: 0.00, ETHICAL_JUDGMENT: 0.00,
      },
      cutline: { tech: 65, behav: 55, lv: 55 },
    },
  ],
  candidates: [
    { firstName: "Priya", lastName: "Sharma", emailPrefix: "p.sharma", primaryRoleSlug: "systems-engineer", archetype: "Star" },
    { firstName: "Marcus", lastName: "Chen", emailPrefix: "m.chen", primaryRoleSlug: "flight-test-engineer", archetype: "Specialist" },
    { firstName: "Sofia", lastName: "Okafor", emailPrefix: "s.okafor", primaryRoleSlug: "qa-inspector", archetype: "SteadyHand" },
    { firstName: "Jordan", lastName: "Wells", emailPrefix: "j.wells", primaryRoleSlug: "avionics-technician", archetype: "QuickStudy" },
    { firstName: "Craig", lastName: "Dunmore", emailPrefix: "c.dunmore", primaryRoleSlug: "mission-planner", archetype: "Concern", forcedRedFlag: true },
    { firstName: "Amara", lastName: "Diallo", emailPrefix: "a.diallo", primaryRoleSlug: "systems-engineer", archetype: "DiamondInTheRough" },
    { firstName: "Derek", lastName: "Matsuda", emailPrefix: "d.matsuda", primaryRoleSlug: "avionics-technician", archetype: "VeteranProfile" },
    { firstName: "Nina", lastName: "Petrova", emailPrefix: "n.petrova", primaryRoleSlug: "flight-test-engineer", archetype: "Borderline" },
    { firstName: "Luis", lastName: "Ferreira", emailPrefix: "l.ferreira", primaryRoleSlug: "systems-engineer", archetype: "BrightUnpolished" },
    { firstName: "Rachel", lastName: "Yun", emailPrefix: "r.yun", primaryRoleSlug: "qa-inspector", archetype: "Star" },
    { firstName: "Tom", lastName: "Easton", emailPrefix: "t.easton", primaryRoleSlug: "mission-planner", archetype: "WildCard" },
    { firstName: "Kenji", lastName: "Morales", emailPrefix: "k.morales", primaryRoleSlug: "avionics-technician", archetype: "Specialist" },
    { firstName: "Mei", lastName: "Andersen", emailPrefix: "m.andersen", primaryRoleSlug: "flight-test-engineer", archetype: "QuickStudy" },
    { firstName: "Omar", lastName: "Bakr", emailPrefix: "o.bakr", primaryRoleSlug: "systems-engineer", archetype: "Borderline", incomplete: true },
    { firstName: "Serena", lastName: "Kovacs", emailPrefix: "s.kovacs", primaryRoleSlug: "mission-planner", archetype: "SteadyHand" },
    { firstName: "Alex", lastName: "Ndiaye", emailPrefix: "a.ndiaye", primaryRoleSlug: "qa-inspector", archetype: "VeteranProfile" },
  ],
};

const nexusRoboticsSpec: OrgSpec = {
  name: "Nexus Robotics",
  slug: "nexus-robotics",
  domain: "nexusrobotics.ai",
  adminEmail: "demo-admin@nexusrobotics.ai",
  adminName: "Nexus Demo Admin",
  roles: [
    {
      name: "Robotics Systems Engineer",
      slug: "robotics-systems-engineer",
      description: "Designs and integrates multi-DOF robotic systems for industrial automation.",
      complexityLevel: "HIGH",
      weights: {
        FLUID_REASONING: 0.13, EXECUTIVE_CONTROL: 0.09, COGNITIVE_FLEXIBILITY: 0.09,
        METACOGNITIVE_CALIBRATION: 0.07, LEARNING_VELOCITY: 0.09,
        SYSTEMS_DIAGNOSTICS: 0.14, PATTERN_RECOGNITION: 0.10, QUANTITATIVE_REASONING: 0.12,
        SPATIAL_VISUALIZATION: 0.10, MECHANICAL_REASONING: 0.07,
        PROCEDURAL_RELIABILITY: 0.00, ETHICAL_JUDGMENT: 0.00,
      },
      cutline: { tech: 65, behav: 52, lv: 55 },
    },
    {
      name: "Computer Vision Engineer",
      slug: "computer-vision-engineer",
      description: "Builds perception pipelines for robot navigation and object detection.",
      complexityLevel: "HIGH",
      weights: {
        FLUID_REASONING: 0.14, EXECUTIVE_CONTROL: 0.08, COGNITIVE_FLEXIBILITY: 0.10,
        METACOGNITIVE_CALIBRATION: 0.07, LEARNING_VELOCITY: 0.10,
        SYSTEMS_DIAGNOSTICS: 0.12, PATTERN_RECOGNITION: 0.14, QUANTITATIVE_REASONING: 0.12,
        SPATIAL_VISUALIZATION: 0.10, MECHANICAL_REASONING: 0.03,
        PROCEDURAL_RELIABILITY: 0.00, ETHICAL_JUDGMENT: 0.00,
      },
      cutline: { tech: 68, behav: 50, lv: 58 },
    },
    {
      name: "Embedded Systems Engineer",
      slug: "embedded-systems-engineer",
      description: "Develops firmware and real-time control systems for robotic actuators and sensors.",
      complexityLevel: "MEDIUM_HIGH",
      weights: {
        FLUID_REASONING: 0.10, EXECUTIVE_CONTROL: 0.09, COGNITIVE_FLEXIBILITY: 0.08,
        METACOGNITIVE_CALIBRATION: 0.09, LEARNING_VELOCITY: 0.08,
        SYSTEMS_DIAGNOSTICS: 0.13, PATTERN_RECOGNITION: 0.11, QUANTITATIVE_REASONING: 0.12,
        SPATIAL_VISUALIZATION: 0.08, MECHANICAL_REASONING: 0.08,
        PROCEDURAL_RELIABILITY: 0.03, ETHICAL_JUDGMENT: 0.01,
      },
      cutline: { tech: 62, behav: 50, lv: 52 },
    },
    {
      name: "Mechatronics Technician",
      slug: "mechatronics-technician",
      description: "Assembles, calibrates, and maintains electromechanical systems on the production line.",
      complexityLevel: "MEDIUM",
      weights: {
        FLUID_REASONING: 0.07, EXECUTIVE_CONTROL: 0.07, COGNITIVE_FLEXIBILITY: 0.06,
        METACOGNITIVE_CALIBRATION: 0.09, LEARNING_VELOCITY: 0.07,
        SYSTEMS_DIAGNOSTICS: 0.12, PATTERN_RECOGNITION: 0.11, QUANTITATIVE_REASONING: 0.10,
        SPATIAL_VISUALIZATION: 0.12, MECHANICAL_REASONING: 0.12,
        PROCEDURAL_RELIABILITY: 0.05, ETHICAL_JUDGMENT: 0.02,
      },
      cutline: { tech: 55, behav: 50, lv: 45 },
    },
    {
      name: "Technical Program Manager",
      slug: "technical-program-manager",
      description: "Drives cross-functional execution of robotics product development programs.",
      complexityLevel: "HIGH",
      weights: {
        FLUID_REASONING: 0.12, EXECUTIVE_CONTROL: 0.16, COGNITIVE_FLEXIBILITY: 0.12,
        METACOGNITIVE_CALIBRATION: 0.10, LEARNING_VELOCITY: 0.08,
        SYSTEMS_DIAGNOSTICS: 0.09, PATTERN_RECOGNITION: 0.08, QUANTITATIVE_REASONING: 0.09,
        SPATIAL_VISUALIZATION: 0.05, MECHANICAL_REASONING: 0.04,
        PROCEDURAL_RELIABILITY: 0.05, ETHICAL_JUDGMENT: 0.02,
      },
      cutline: { tech: 55, behav: 62, lv: 52 },
    },
  ],
  candidates: [
    { firstName: "Zara", lastName: "Khan", emailPrefix: "z.khan", primaryRoleSlug: "robotics-systems-engineer", archetype: "Star" },
    { firstName: "Ethan", lastName: "Park", emailPrefix: "e.park", primaryRoleSlug: "computer-vision-engineer", archetype: "DiamondInTheRough" },
    { firstName: "Isabel", lastName: "Cruz", emailPrefix: "i.cruz", primaryRoleSlug: "embedded-systems-engineer", archetype: "Specialist" },
    { firstName: "Marcus", lastName: "Obi", emailPrefix: "m.obi", primaryRoleSlug: "mechatronics-technician", archetype: "SteadyHand" },
    { firstName: "Ava", lastName: "Lindqvist", emailPrefix: "a.lindqvist", primaryRoleSlug: "technical-program-manager", archetype: "QuickStudy" },
    { firstName: "Raj", lastName: "Subramaniam", emailPrefix: "r.sub", primaryRoleSlug: "robotics-systems-engineer", archetype: "Borderline" },
    { firstName: "Tyler", lastName: "Moss", emailPrefix: "t.moss", primaryRoleSlug: "computer-vision-engineer", archetype: "BrightUnpolished" },
    { firstName: "Layla", lastName: "Nasser", emailPrefix: "l.nasser", primaryRoleSlug: "embedded-systems-engineer", archetype: "Star" },
    { firstName: "Jin", lastName: "Wei", emailPrefix: "j.wei", primaryRoleSlug: "mechatronics-technician", archetype: "VeteranProfile" },
    { firstName: "Cam", lastName: "Brierly", emailPrefix: "c.brierly", primaryRoleSlug: "robotics-systems-engineer", archetype: "Concern", forcedRedFlag: true },
    { firstName: "Nadia", lastName: "Petrov", emailPrefix: "n.petrov", primaryRoleSlug: "computer-vision-engineer", archetype: "QuickStudy" },
    { firstName: "Oscar", lastName: "Delgado", emailPrefix: "o.delgado", primaryRoleSlug: "technical-program-manager", archetype: "WildCard" },
    { firstName: "Hana", lastName: "Fujimoto", emailPrefix: "h.fujimoto", primaryRoleSlug: "embedded-systems-engineer", archetype: "Borderline", incomplete: true },
    { firstName: "Leo", lastName: "Carvalho", emailPrefix: "l.carvalho", primaryRoleSlug: "mechatronics-technician", archetype: "SteadyHand" },
    { firstName: "Mia", lastName: "Johansson", emailPrefix: "m.johansson", primaryRoleSlug: "robotics-systems-engineer", archetype: "Specialist" },
    { firstName: "Ben", lastName: "Achebe", emailPrefix: "b.achebe", primaryRoleSlug: "technical-program-manager", archetype: "DiamondInTheRough" },
    { firstName: "Chloe", lastName: "Rousseau", emailPrefix: "c.rousseau", primaryRoleSlug: "computer-vision-engineer", archetype: "Star" },
  ],
};

const vertexAILabsSpec: OrgSpec = {
  name: "Vertex AI Labs",
  slug: "vertex-ai-labs",
  domain: "vertexailabs.io",
  adminEmail: "demo-admin@vertexailabs.io",
  adminName: "Vertex Demo Admin",
  roles: [
    {
      name: "Platform Engineer",
      slug: "platform-engineer",
      description: "Builds and operates the ML infrastructure platform — training, serving, and observability.",
      complexityLevel: "HIGH",
      weights: {
        FLUID_REASONING: 0.13, EXECUTIVE_CONTROL: 0.10, COGNITIVE_FLEXIBILITY: 0.10,
        METACOGNITIVE_CALIBRATION: 0.08, LEARNING_VELOCITY: 0.10,
        SYSTEMS_DIAGNOSTICS: 0.14, PATTERN_RECOGNITION: 0.10, QUANTITATIVE_REASONING: 0.12,
        SPATIAL_VISUALIZATION: 0.04, MECHANICAL_REASONING: 0.03,
        PROCEDURAL_RELIABILITY: 0.04, ETHICAL_JUDGMENT: 0.02,
      },
      cutline: { tech: 68, behav: 52, lv: 60 },
    },
    {
      name: "Data Engineer",
      slug: "data-engineer",
      description: "Designs and maintains data pipelines, feature stores, and streaming infrastructure.",
      complexityLevel: "MEDIUM_HIGH",
      weights: {
        FLUID_REASONING: 0.11, EXECUTIVE_CONTROL: 0.09, COGNITIVE_FLEXIBILITY: 0.09,
        METACOGNITIVE_CALIBRATION: 0.08, LEARNING_VELOCITY: 0.09,
        SYSTEMS_DIAGNOSTICS: 0.12, PATTERN_RECOGNITION: 0.11, QUANTITATIVE_REASONING: 0.14,
        SPATIAL_VISUALIZATION: 0.04, MECHANICAL_REASONING: 0.03,
        PROCEDURAL_RELIABILITY: 0.06, ETHICAL_JUDGMENT: 0.04,
      },
      cutline: { tech: 65, behav: 52, lv: 55 },
    },
    {
      name: "ML Infrastructure Engineer",
      slug: "ml-infra-engineer",
      description: "Optimizes distributed training, model serving latency, and GPU cluster utilization.",
      complexityLevel: "HIGH",
      weights: {
        FLUID_REASONING: 0.14, EXECUTIVE_CONTROL: 0.09, COGNITIVE_FLEXIBILITY: 0.10,
        METACOGNITIVE_CALIBRATION: 0.08, LEARNING_VELOCITY: 0.11,
        SYSTEMS_DIAGNOSTICS: 0.13, PATTERN_RECOGNITION: 0.11, QUANTITATIVE_REASONING: 0.13,
        SPATIAL_VISUALIZATION: 0.04, MECHANICAL_REASONING: 0.02,
        PROCEDURAL_RELIABILITY: 0.03, ETHICAL_JUDGMENT: 0.02,
      },
      cutline: { tech: 70, behav: 50, lv: 62 },
    },
    {
      name: "Solutions Architect",
      slug: "solutions-architect",
      description: "Designs AI product integrations and enterprise deployment patterns for customers.",
      complexityLevel: "HIGH",
      weights: {
        FLUID_REASONING: 0.13, EXECUTIVE_CONTROL: 0.12, COGNITIVE_FLEXIBILITY: 0.12,
        METACOGNITIVE_CALIBRATION: 0.09, LEARNING_VELOCITY: 0.10,
        SYSTEMS_DIAGNOSTICS: 0.12, PATTERN_RECOGNITION: 0.09, QUANTITATIVE_REASONING: 0.11,
        SPATIAL_VISUALIZATION: 0.04, MECHANICAL_REASONING: 0.02,
        PROCEDURAL_RELIABILITY: 0.04, ETHICAL_JUDGMENT: 0.02,
      },
      cutline: { tech: 65, behav: 58, lv: 58 },
    },
    {
      name: "QA Automation Engineer",
      slug: "qa-automation-engineer",
      description: "Builds automated test suites for ML pipelines, APIs, and model evaluation frameworks.",
      complexityLevel: "MEDIUM_HIGH",
      weights: {
        FLUID_REASONING: 0.10, EXECUTIVE_CONTROL: 0.10, COGNITIVE_FLEXIBILITY: 0.09,
        METACOGNITIVE_CALIBRATION: 0.10, LEARNING_VELOCITY: 0.09,
        SYSTEMS_DIAGNOSTICS: 0.12, PATTERN_RECOGNITION: 0.12, QUANTITATIVE_REASONING: 0.11,
        SPATIAL_VISUALIZATION: 0.04, MECHANICAL_REASONING: 0.03,
        PROCEDURAL_RELIABILITY: 0.07, ETHICAL_JUDGMENT: 0.03,
      },
      cutline: { tech: 62, behav: 55, lv: 52 },
    },
    {
      name: "Senior AI Engineer",
      slug: "senior-ai-engineer",
      description: "Designs and implements production AI systems — model architecture, fine-tuning, and evaluation at scale.",
      complexityLevel: "HIGH",
      weights: {
        FLUID_REASONING: 0.15, EXECUTIVE_CONTROL: 0.10, COGNITIVE_FLEXIBILITY: 0.11,
        METACOGNITIVE_CALIBRATION: 0.10, LEARNING_VELOCITY: 0.12,
        SYSTEMS_DIAGNOSTICS: 0.12, PATTERN_RECOGNITION: 0.12, QUANTITATIVE_REASONING: 0.11,
        SPATIAL_VISUALIZATION: 0.03, MECHANICAL_REASONING: 0.02,
        PROCEDURAL_RELIABILITY: 0.01, ETHICAL_JUDGMENT: 0.01,
      },
      cutline: { tech: 72, behav: 55, lv: 65 },
    },
    {
      name: "Software Engineer",
      slug: "software-engineer",
      description: "Builds reliable, scalable backend services and APIs that power AI product features.",
      complexityLevel: "MEDIUM_HIGH",
      weights: {
        FLUID_REASONING: 0.12, EXECUTIVE_CONTROL: 0.10, COGNITIVE_FLEXIBILITY: 0.10,
        METACOGNITIVE_CALIBRATION: 0.09, LEARNING_VELOCITY: 0.10,
        SYSTEMS_DIAGNOSTICS: 0.13, PATTERN_RECOGNITION: 0.11, QUANTITATIVE_REASONING: 0.12,
        SPATIAL_VISUALIZATION: 0.04, MECHANICAL_REASONING: 0.03,
        PROCEDURAL_RELIABILITY: 0.04, ETHICAL_JUDGMENT: 0.02,
      },
      cutline: { tech: 65, behav: 52, lv: 58 },
    },
  ],
  candidates: [
    { firstName: "Aiden", lastName: "Zhang", emailPrefix: "a.zhang", primaryRoleSlug: "ml-infra-engineer", archetype: "Star" },
    { firstName: "Fatima", lastName: "Al-Rashid", emailPrefix: "f.alrashid", primaryRoleSlug: "data-engineer", archetype: "Specialist" },
    { firstName: "Noah", lastName: "Bergman", emailPrefix: "n.bergman", primaryRoleSlug: "platform-engineer", archetype: "DiamondInTheRough" },
    { firstName: "Lena", lastName: "Kowalski", emailPrefix: "l.kowalski", primaryRoleSlug: "solutions-architect", archetype: "SteadyHand" },
    { firstName: "James", lastName: "Otieno", emailPrefix: "j.otieno", primaryRoleSlug: "qa-automation-engineer", archetype: "QuickStudy" },
    { firstName: "Sophie", lastName: "Laurent", emailPrefix: "s.laurent", primaryRoleSlug: "ml-infra-engineer", archetype: "BrightUnpolished" },
    { firstName: "Marcus", lastName: "Singh", emailPrefix: "m.singh", primaryRoleSlug: "platform-engineer", archetype: "Borderline" },
    { firstName: "Zoe", lastName: "Williams", emailPrefix: "z.williams", primaryRoleSlug: "data-engineer", archetype: "Star" },
    { firstName: "Ivan", lastName: "Petrov", emailPrefix: "i.petrov", primaryRoleSlug: "solutions-architect", archetype: "WildCard" },
    { firstName: "Aaliyah", lastName: "Brooks", emailPrefix: "a.brooks", primaryRoleSlug: "ml-infra-engineer", archetype: "Concern", forcedRedFlag: true },
    { firstName: "Henrik", lastName: "Olsen", emailPrefix: "h.olsen", primaryRoleSlug: "qa-automation-engineer", archetype: "VeteranProfile" },
    { firstName: "Priyanka", lastName: "Rao", emailPrefix: "p.rao", primaryRoleSlug: "data-engineer", archetype: "QuickStudy" },
    { firstName: "Sam", lastName: "Okonkwo", emailPrefix: "s.okonkwo", primaryRoleSlug: "platform-engineer", archetype: "Specialist" },
    { firstName: "Clara", lastName: "Hoffmann", emailPrefix: "c.hoffmann", primaryRoleSlug: "solutions-architect", archetype: "Star" },
    { firstName: "Diego", lastName: "Vargas", emailPrefix: "d.vargas", primaryRoleSlug: "qa-automation-engineer", archetype: "Borderline", incomplete: true },
    { firstName: "Yuna", lastName: "Kim", emailPrefix: "y.kim", primaryRoleSlug: "ml-infra-engineer", archetype: "DiamondInTheRough" },
    { firstName: "Tobias", lastName: "Müller", emailPrefix: "t.muller", primaryRoleSlug: "data-engineer", archetype: "BrightUnpolished" },
    { firstName: "Amelia", lastName: "Owens", emailPrefix: "a.owens", primaryRoleSlug: "platform-engineer", archetype: "Borderline" },
    { firstName: "Kai", lastName: "Nakamura", emailPrefix: "k.nakamura", primaryRoleSlug: "senior-ai-engineer", archetype: "Star" },
    { firstName: "Simone", lastName: "Delacroix", emailPrefix: "s.delacroix", primaryRoleSlug: "senior-ai-engineer", archetype: "BrightUnpolished" },
    { firstName: "Rafael", lastName: "Morales", emailPrefix: "r.morales", primaryRoleSlug: "software-engineer", archetype: "SteadyHand" },
    { firstName: "Ingrid", lastName: "Svensson", emailPrefix: "i.svensson", primaryRoleSlug: "software-engineer", archetype: "QuickStudy" },
  ],
};

// ─── Main — scoped delete + reseed demo orgs only ────────────────────────────

async function main() {
  console.log("🌱 Demo-only seed — live organizations will not be touched.\n");

  // Step 1: find existing demo org IDs
  const existingDemoOrgs = await prisma.organization.findMany({
    where: { isDemo: true },
    select: { id: true, slug: true },
  });

  if (existingDemoOrgs.length > 0) {
    console.log(`  Found ${existingDemoOrgs.length} existing demo org(s): ${existingDemoOrgs.map(o => o.slug).join(", ")}`);
    console.log("  Removing demo data...");

    const demoOrgIds = existingDemoOrgs.map(o => o.id);

    // Get candidate IDs in demo orgs (for cascading deletes on tables with only candidateId)
    const demoCandidates = await prisma.candidate.findMany({
      where: { orgId: { in: demoOrgIds } },
      select: { id: true },
    });
    const demoCandidateIds = demoCandidates.map(c => c.id);

    // Get assessment IDs in demo orgs (via candidateId since Assessment has no orgId)
    const demoAssessments = await prisma.assessment.findMany({
      where: { candidateId: { in: demoCandidateIds } },
      select: { id: true },
    });
    const demoAssessmentIds = demoAssessments.map(a => a.id);

    // Get role IDs in demo orgs
    const demoRoles = await prisma.role.findMany({
      where: { orgId: { in: demoOrgIds } },
      select: { id: true },
    });
    const demoRoleIds = demoRoles.map(r => r.id);

    // Get demo user IDs
    const demoUsers = await prisma.user.findMany({
      where: { orgId: { in: demoOrgIds } },
      select: { id: true },
    });
    const demoUserIds = demoUsers.map(u => u.id);

    // Delete in reverse dependency order
    if (demoCandidateIds.length > 0) {
      await prisma.note.deleteMany({ where: { candidateId: { in: demoCandidateIds } } });
    }
    if (demoAssessmentIds.length > 0) {
      await prisma.aIInteraction.deleteMany({ where: { assessmentId: { in: demoAssessmentIds } } });
      await prisma.redFlag.deleteMany({ where: { assessmentId: { in: demoAssessmentIds } } });
      await prisma.prediction.deleteMany({ where: { assessmentId: { in: demoAssessmentIds } } });
      await prisma.compositeScore.deleteMany({ where: { assessmentId: { in: demoAssessmentIds } } });
      await prisma.subtestResult.deleteMany({ where: { assessmentId: { in: demoAssessmentIds } } });
      await prisma.assessment.deleteMany({ where: { id: { in: demoAssessmentIds } } });
    }
    if (demoCandidateIds.length > 0) {
      await prisma.candidate.deleteMany({ where: { id: { in: demoCandidateIds } } });
    }
    if (demoRoleIds.length > 0) {
      await prisma.compositeWeight.deleteMany({ where: { roleId: { in: demoRoleIds } } });
      await prisma.cutline.deleteMany({ where: { roleId: { in: demoRoleIds } } });
      await prisma.roleVersion.deleteMany({ where: { roleId: { in: demoRoleIds } } });
      await prisma.role.deleteMany({ where: { id: { in: demoRoleIds } } });
    }
    if (demoUserIds.length > 0) {
      await prisma.activityLog.deleteMany({ where: { actorId: { in: demoUserIds } } });
      await prisma.note.deleteMany({ where: { authorId: { in: demoUserIds } } });
      await prisma.user.deleteMany({ where: { id: { in: demoUserIds } } });
    }
    await prisma.cutline.deleteMany({ where: { orgId: { in: demoOrgIds } } });
    await prisma.organization.deleteMany({ where: { id: { in: demoOrgIds } } });

    console.log("  ✓ Demo data cleared.\n");
  } else {
    console.log("  No existing demo orgs found — fresh seed.\n");
  }

  // Step 2: seed 4 new demo orgs
  await seedDemoOrg(atlasDefenseSpec);
  await seedDemoOrg(orbitalDynamicsSpec);
  await seedDemoOrg(nexusRoboticsSpec);
  await seedDemoOrg(vertexAILabsSpec);

  // Summary
  const counts = await Promise.all([
    prisma.organization.count({ where: { isDemo: true } }),
    prisma.role.count({ where: { org: { isDemo: true } } }),
    prisma.candidate.count({ where: { org: { isDemo: true } } }),
  ]);

  console.log("\n✅ Demo seed complete!");
  console.log(`  Demo organizations: ${counts[0]}`);
  console.log(`  Roles:              ${counts[1]}`);
  console.log(`  Candidates:         ${counts[2]}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });

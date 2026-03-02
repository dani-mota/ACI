import "dotenv/config";
import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// ─── CONSTRUCT DEFINITIONS ────────────────────────────────
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

// ─── ROLE COMPOSITE WEIGHTS (from PRD Section 6.4) ───────
// Values are PRD weights × 100 (e.g., 0.22 → 22). Sum = 100 per role.
const ROLE_WEIGHTS: Record<string, Record<ConstructId, number>> = {
  "factory-technician": {
    FLUID_REASONING: 10, EXECUTIVE_CONTROL: 10, COGNITIVE_FLEXIBILITY: 5,
    METACOGNITIVE_CALIBRATION: 8, LEARNING_VELOCITY: 22,
    SYSTEMS_DIAGNOSTICS: 3, PATTERN_RECOGNITION: 7, QUANTITATIVE_REASONING: 5,
    SPATIAL_VISUALIZATION: 2, MECHANICAL_REASONING: 3,
    PROCEDURAL_RELIABILITY: 20, ETHICAL_JUDGMENT: 5,
  },
  "cnc-machinist": {
    FLUID_REASONING: 8, EXECUTIVE_CONTROL: 10, COGNITIVE_FLEXIBILITY: 8,
    METACOGNITIVE_CALIBRATION: 5, LEARNING_VELOCITY: 8,
    SYSTEMS_DIAGNOSTICS: 5, PATTERN_RECOGNITION: 12, QUANTITATIVE_REASONING: 15,
    SPATIAL_VISUALIZATION: 15, MECHANICAL_REASONING: 12,
    PROCEDURAL_RELIABILITY: 2, ETHICAL_JUDGMENT: 0,
  },
  "cam-programmer": {
    FLUID_REASONING: 15, EXECUTIVE_CONTROL: 8, COGNITIVE_FLEXIBILITY: 5,
    METACOGNITIVE_CALIBRATION: 5, LEARNING_VELOCITY: 7,
    SYSTEMS_DIAGNOSTICS: 10, PATTERN_RECOGNITION: 5, QUANTITATIVE_REASONING: 18,
    SPATIAL_VISUALIZATION: 20, MECHANICAL_REASONING: 5,
    PROCEDURAL_RELIABILITY: 0, ETHICAL_JUDGMENT: 2,
  },
  "cmm-programmer": {
    FLUID_REASONING: 10, EXECUTIVE_CONTROL: 10, COGNITIVE_FLEXIBILITY: 5,
    METACOGNITIVE_CALIBRATION: 8, LEARNING_VELOCITY: 5,
    SYSTEMS_DIAGNOSTICS: 5, PATTERN_RECOGNITION: 15, QUANTITATIVE_REASONING: 20,
    SPATIAL_VISUALIZATION: 5, MECHANICAL_REASONING: 2,
    PROCEDURAL_RELIABILITY: 12, ETHICAL_JUDGMENT: 3,
  },
  "manufacturing-engineer": {
    FLUID_REASONING: 18, EXECUTIVE_CONTROL: 5, COGNITIVE_FLEXIBILITY: 8,
    METACOGNITIVE_CALIBRATION: 8, LEARNING_VELOCITY: 12,
    SYSTEMS_DIAGNOSTICS: 18, PATTERN_RECOGNITION: 5, QUANTITATIVE_REASONING: 8,
    SPATIAL_VISUALIZATION: 5, MECHANICAL_REASONING: 3,
    PROCEDURAL_RELIABILITY: 3, ETHICAL_JUDGMENT: 7,
  },
};

// ─── CUTLINES (minimum percentile thresholds, PRD Section 6.5) ─
const CUTLINES: Record<string, { tech: number; behav: number; lv: number }> = {
  "factory-technician": { tech: 40, behav: 60, lv: 60 },
  "cnc-machinist": { tech: 60, behav: 55, lv: 50 },
  "cam-programmer": { tech: 75, behav: 50, lv: 55 },
  "cmm-programmer": { tech: 70, behav: 75, lv: 45 },
  "manufacturing-engineer": { tech: 65, behav: 70, lv: 65 },
};

// ─── CANDIDATE ARCHETYPES ────────────────────────────────
// Each archetype defines a percentile range for each construct
type Archetype = {
  name: string;
  scores: Record<ConstructId, [number, number]>; // [min, max] percentile range
  flagProbability: number; // 0-1
};

const ARCHETYPES: Archetype[] = [
  {
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
  {
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
  {
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
  {
    name: "Quick Study",
    scores: {
      FLUID_REASONING: [72, 90], EXECUTIVE_CONTROL: [55, 72], COGNITIVE_FLEXIBILITY: [70, 88],
      METACOGNITIVE_CALIBRATION: [60, 78], LEARNING_VELOCITY: [85, 98],
      SYSTEMS_DIAGNOSTICS: [58, 75], PATTERN_RECOGNITION: [60, 78], QUANTITATIVE_REASONING: [58, 75],
      SPATIAL_VISUALIZATION: [60, 78], MECHANICAL_REASONING: [55, 72],
      PROCEDURAL_RELIABILITY: [55, 72], ETHICAL_JUDGMENT: [58, 75],
    },
    flagProbability: 0.1,
  },
  {
    name: "Concern",
    scores: {
      FLUID_REASONING: [15, 35], EXECUTIVE_CONTROL: [18, 38], COGNITIVE_FLEXIBILITY: [20, 40],
      METACOGNITIVE_CALIBRATION: [12, 32], LEARNING_VELOCITY: [15, 35],
      SYSTEMS_DIAGNOSTICS: [20, 38], PATTERN_RECOGNITION: [18, 35], QUANTITATIVE_REASONING: [15, 32],
      SPATIAL_VISUALIZATION: [20, 38], MECHANICAL_REASONING: [22, 40],
      PROCEDURAL_RELIABILITY: [15, 35], ETHICAL_JUDGMENT: [18, 38],
    },
    flagProbability: 0.7,
  },
  {
    name: "Diamond in the Rough",
    scores: {
      FLUID_REASONING: [60, 80], EXECUTIVE_CONTROL: [35, 52], COGNITIVE_FLEXIBILITY: [65, 82],
      METACOGNITIVE_CALIBRATION: [30, 48], LEARNING_VELOCITY: [70, 88],
      SYSTEMS_DIAGNOSTICS: [48, 65], PATTERN_RECOGNITION: [50, 68], QUANTITATIVE_REASONING: [45, 62],
      SPATIAL_VISUALIZATION: [48, 65], MECHANICAL_REASONING: [42, 58],
      PROCEDURAL_RELIABILITY: [45, 62], ETHICAL_JUDGMENT: [55, 72],
    },
    flagProbability: 0.25,
  },
  {
    name: "Veteran Profile",
    scores: {
      FLUID_REASONING: [42, 58], EXECUTIVE_CONTROL: [70, 88], COGNITIVE_FLEXIBILITY: [35, 52],
      METACOGNITIVE_CALIBRATION: [65, 82], LEARNING_VELOCITY: [48, 65],
      SYSTEMS_DIAGNOSTICS: [72, 90], PATTERN_RECOGNITION: [70, 88], QUANTITATIVE_REASONING: [68, 85],
      SPATIAL_VISUALIZATION: [65, 82], MECHANICAL_REASONING: [75, 92],
      PROCEDURAL_RELIABILITY: [78, 95], ETHICAL_JUDGMENT: [72, 90],
    },
    flagProbability: 0.05,
  },
  {
    name: "Wild Card",
    scores: {
      FLUID_REASONING: [55, 92], EXECUTIVE_CONTROL: [20, 85], COGNITIVE_FLEXIBILITY: [60, 95],
      METACOGNITIVE_CALIBRATION: [15, 70], LEARNING_VELOCITY: [60, 95],
      SYSTEMS_DIAGNOSTICS: [25, 80], PATTERN_RECOGNITION: [30, 85], QUANTITATIVE_REASONING: [20, 78],
      SPATIAL_VISUALIZATION: [30, 88], MECHANICAL_REASONING: [25, 80],
      PROCEDURAL_RELIABILITY: [15, 55], ETHICAL_JUDGMENT: [20, 60],
    },
    flagProbability: 0.4,
  },
];

// ─── CANDIDATE NAMES ─────────────────────────────────────
const CANDIDATES = [
  { first: "Marcus", last: "Chen", email: "m.chen", archetype: 0, role: 0 },
  { first: "Sarah", last: "Okafor", email: "s.okafor", archetype: 0, role: 2 },
  { first: "James", last: "Petrov", email: "j.petrov", archetype: 0, role: 4 },
  { first: "Elena", last: "Vasquez", email: "e.vasquez", archetype: 1, role: 1 },
  { first: "Raj", last: "Patel", email: "r.patel", archetype: 1, role: 3 },
  { first: "Tyler", last: "Morrison", email: "t.morrison", archetype: 1, role: 2 },
  { first: "Linda", last: "Nakamura", email: "l.nakamura", archetype: 2, role: 0 },
  { first: "David", last: "Okonkwo", email: "d.okonkwo", archetype: 2, role: 1 },
  { first: "Maria", last: "Santos", email: "m.santos", archetype: 2, role: 0 },
  { first: "Kevin", last: "Park", email: "k.park", archetype: 3, role: 4 },
  { first: "Aisha", last: "Mohammed", email: "a.mohammed", archetype: 3, role: 2 },
  { first: "Ryan", last: "O'Brien", email: "r.obrien", archetype: 3, role: 1 },
  { first: "Tony", last: "Rizzo", email: "t.rizzo", archetype: 4, role: 0 },
  { first: "Brenda", last: "Taylor", email: "b.taylor", archetype: 4, role: 1 },
  { first: "Derek", last: "Washington", email: "d.washington", archetype: 4, role: 3 },
  { first: "Yuki", last: "Tanaka", email: "y.tanaka", archetype: 5, role: 1 },
  { first: "Carlos", last: "Mendez", email: "c.mendez", archetype: 5, role: 0 },
  { first: "Jasmine", last: "Lewis", email: "j.lewis", archetype: 5, role: 4 },
  { first: "Frank", last: "Kowalski", email: "f.kowalski", archetype: 6, role: 1 },
  { first: "Patricia", last: "Henderson", email: "p.henderson", archetype: 6, role: 0 },
  { first: "Mike", last: "Zhang", email: "m.zhang", archetype: 6, role: 3 },
  { first: "Nina", last: "Volkov", email: "n.volkov", archetype: 7, role: 2 },
  { first: "Alex", last: "Kim", email: "a.kim", archetype: 7, role: 4 },
  { first: "Jordan", last: "Brooks", email: "j.brooks", archetype: 7, role: 0 },
  { first: "Samira", last: "Al-Rashid", email: "s.alrashid", archetype: 3, role: 3 },
];

// Candidates that should be INCOMPLETE (assessment started but not finished)
const INCOMPLETE_CANDIDATES = new Set(["n.volkov", "a.kim", "j.brooks"]);

// Candidates that must have CRITICAL red flags (passes composite but integrity issue)
const FORCED_RED_FLAG_CANDIDATES = new Set(["t.rizzo", "d.washington"]);

const ROLE_SLUGS = ["factory-technician", "cnc-machinist", "cam-programmer", "cmm-programmer", "manufacturing-engineer"];
const ROLE_NAMES = ["Factory Technician", "CNC Machinist", "CAM Programmer", "CMM Programmer", "Manufacturing Engineer"];
const ROLE_DESCRIPTIONS = [
  "Entry-level production floor role. Operates equipment, follows procedures, maintains quality standards.",
  "Operates CNC machines. Reads G-code, manages feeds/speeds, maintains tolerances.",
  "Programs toolpaths using CAM software. Requires spatial reasoning and process knowledge.",
  "Programs coordinate measuring machines. Requires precision, GD&T mastery, statistical skills.",
  "Designs and optimizes manufacturing processes. Cross-functional problem-solving role.",
];

// ─── HELPERS ─────────────────────────────────────────────
function rand(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateScores(archetype: Archetype): Record<ConstructId, number> {
  const scores: Partial<Record<ConstructId, number>> = {};
  for (const c of CONSTRUCTS) {
    const [min, max] = archetype.scores[c.id];
    scores[c.id] = rand(min, max);
  }
  return scores as Record<ConstructId, number>;
}

function calculateComposite(scores: Record<ConstructId, number>, roleSlug: string): number {
  const weights = ROLE_WEIGHTS[roleSlug];
  let weightedSum = 0;
  let totalWeight = 0;
  for (const c of CONSTRUCTS) {
    weightedSum += scores[c.id] * weights[c.id];
    totalWeight += weights[c.id];
  }
  return Math.round(weightedSum / totalWeight);
}

function evaluateCutline(scores: Record<ConstructId, number>, roleSlug: string) {
  const cutline = CUTLINES[roleSlug];
  const techConstructs = CONSTRUCTS.filter(c => c.layer === "TECHNICAL_APTITUDE");
  const behavConstructs = CONSTRUCTS.filter(c => c.layer === "BEHAVIORAL_INTEGRITY");

  const techAvg = Math.round(techConstructs.reduce((sum, c) => sum + scores[c.id], 0) / techConstructs.length);
  const behavAvg = Math.round(behavConstructs.reduce((sum, c) => sum + scores[c.id], 0) / behavConstructs.length);
  const lv = scores.LEARNING_VELOCITY;

  const passed = techAvg >= cutline.tech && behavAvg >= cutline.behav && lv >= cutline.lv;
  const distance = Math.min(techAvg - cutline.tech, behavAvg - cutline.behav, lv - cutline.lv);
  return { passed, distance };
}

function determineStatus(passed: boolean, distance: number, hasRedFlag: boolean): string {
  if (hasRedFlag) return "DO_NOT_ADVANCE";
  if (!passed) return distance >= -5 ? "REVIEW_REQUIRED" : "DO_NOT_ADVANCE";
  return "RECOMMENDED";
}

const RED_FLAG_TEMPLATES = [
  { severity: "CRITICAL", category: "Integrity", title: "Significant Ethical Concern", description: "Candidate demonstrated pattern of choosing expedient over correct actions in 3+ scenarios.", constructs: ["ETHICAL_JUDGMENT"] },
  { severity: "CRITICAL", category: "Safety", title: "Procedural Shortcutting Pattern", description: "Consistently chose to skip safety verification steps when presented with time pressure.", constructs: ["PROCEDURAL_RELIABILITY"] },
  { severity: "WARNING", category: "Calibration", title: "Overconfidence Pattern", description: "Candidate expressed high confidence on items answered incorrectly in 60%+ of flagged cases.", constructs: ["METACOGNITIVE_CALIBRATION"] },
  { severity: "WARNING", category: "Attention", title: "Sustained Attention Concern", description: "Response quality degraded significantly in final third of assessment. May indicate fatigue sensitivity.", constructs: ["EXECUTIVE_CONTROL"] },
  { severity: "WARNING", category: "Adaptability", title: "Rigidity Under Pressure", description: "Candidate struggled to shift strategies when initial approach failed, repeating unsuccessful methods.", constructs: ["COGNITIVE_FLEXIBILITY"] },
  { severity: "INFO", category: "Speed", title: "Response Time Anomaly", description: "Unusually fast response times on complex items may indicate pattern-matching rather than reasoning.", constructs: ["FLUID_REASONING", "PATTERN_RECOGNITION"] },
  { severity: "INFO", category: "Learning", title: "Inconsistent Learning Curve", description: "Performance improved non-linearly, suggesting prior exposure to some content areas.", constructs: ["LEARNING_VELOCITY"] },
];

const AI_PROMPTS: Record<string, string[]> = {
  FLUID_REASONING: [
    "Walk me through how you approached that last problem. What was your first instinct?",
    "If you had to solve a similar problem but couldn't use the same method, what would you try?",
  ],
  EXECUTIVE_CONTROL: [
    "You seemed to slow down on that section. What was going through your mind?",
    "How do you typically handle it when multiple things need your attention at once?",
  ],
  COGNITIVE_FLEXIBILITY: [
    "Your approach changed midway through. What made you switch strategies?",
    "When your first approach doesn't work, how do you decide what to try next?",
  ],
  METACOGNITIVE_CALIBRATION: [
    "How confident are you in your answer to that last question? Why?",
    "Can you tell me about a time you thought you were right but turned out to be wrong?",
  ],
  LEARNING_VELOCITY: [
    "You picked up the pattern quickly there. How did you figure it out?",
    "If you had to teach what you just learned to a coworker, how would you explain it?",
  ],
  SYSTEMS_DIAGNOSTICS: [
    "Where would you start troubleshooting if this system suddenly stopped working?",
    "What would be the ripple effects if this component failed?",
  ],
  PATTERN_RECOGNITION: [
    "What pattern did you notice in that data set?",
    "How would you know if the pattern you spotted was a real trend vs. noise?",
  ],
  QUANTITATIVE_REASONING: [
    "Walk me through how you set up that calculation.",
    "If the tolerance changed by 0.002, how would that affect your approach?",
  ],
  SPATIAL_VISUALIZATION: [
    "Describe what this part would look like from the opposite side.",
    "How would you fixture this part to access that feature?",
  ],
  MECHANICAL_REASONING: [
    "What forces are acting on this workpiece during the cut?",
    "Why do you think that material behaves differently under those conditions?",
  ],
  PROCEDURAL_RELIABILITY: [
    "You skipped a step in the process. Was that intentional? Why?",
    "Describe a situation where following procedure exactly felt unnecessary but you did it anyway.",
  ],
  ETHICAL_JUDGMENT: [
    "A part is borderline on spec and it's the end of your shift. What do you do?",
    "Your supervisor tells you to ship something you're not sure about. How do you handle it?",
  ],
};

const AI_RESPONSES_HIGH = [
  "I noticed the pattern changed after the third example, so I adjusted my approach to look for the underlying rule rather than just surface similarities.",
  "Honestly, I wasn't 100% sure, so I'd double-check with a colleague before proceeding. Better to ask than to assume.",
  "I'd start by isolating the subsystem and working backwards from the last known good state.",
  "The forces would be concentrated on the thin wall section, so I'd reduce feed rate and add support.",
  "I'd flag it immediately and document my concern, even if it means staying late to get it right.",
];

const AI_RESPONSES_LOW = [
  "I just went with my gut on that one. It felt right.",
  "I'm pretty sure I got it right. I've always been good at this kind of thing.",
  "I'd probably just restart the machine and see if it fixes itself.",
  "I think it would hold. The material is pretty strong.",
  "It's close enough to spec. Probably fine to ship.",
];

function randomDate(daysAgo: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - rand(1, daysAgo));
  d.setHours(rand(8, 17), rand(0, 59));
  return d;
}

// ─── MAIN SEED ───────────────────────────────────────────
async function main() {
  console.log("🌱 Seeding ACI database...");

  // Clean existing data
  await prisma.activityLog.deleteMany();
  await prisma.note.deleteMany();
  await prisma.aIInteraction.deleteMany();
  await prisma.redFlag.deleteMany();
  await prisma.prediction.deleteMany();
  await prisma.compositeScore.deleteMany();
  await prisma.subtestResult.deleteMany();
  await prisma.assessment.deleteMany();
  await prisma.candidate.deleteMany();
  await prisma.compositeWeight.deleteMany();
  await prisma.cutline.deleteMany();
  await prisma.role.deleteMany();
  await prisma.user.deleteMany();
  await prisma.organization.deleteMany();

  console.log("  Cleaned existing data.");

  // 1. Organization
  const org = await prisma.organization.create({
    data: { name: "Hadrian Manufacturing", isDemo: true },
  });
  console.log("  Created organization:", org.name);

  // 2. User
  const user = await prisma.user.create({
    data: {
      email: "alex.chen@arklight.io",
      name: "Alex Chen",
      role: "TA_LEADER",
      orgId: org.id,
    },
  });
  console.log("  Created user:", user.name);

  // 3. Roles
  const roleRecords: Record<string, string> = {};
  for (let i = 0; i < ROLE_SLUGS.length; i++) {
    const role = await prisma.role.create({
      data: {
        name: ROLE_NAMES[i],
        slug: ROLE_SLUGS[i],
        description: ROLE_DESCRIPTIONS[i],
        orgId: org.id,
        isCustom: false,
        sourceType: "SYSTEM_DEFAULT",
      },
    });
    roleRecords[ROLE_SLUGS[i]] = role.id;
  }
  console.log("  Created", ROLE_SLUGS.length, "roles.");

  // 4. Cutlines
  for (const slug of ROLE_SLUGS) {
    const c = CUTLINES[slug];
    await prisma.cutline.create({
      data: {
        roleId: roleRecords[slug],
        orgId: org.id,
        technicalAptitude: c.tech,
        behavioralIntegrity: c.behav,
        learningVelocity: c.lv,
        overallMinimum: 30,
      },
    });
  }
  console.log("  Created cutlines for all roles.");

  // 5. Composite Weights
  for (const slug of ROLE_SLUGS) {
    const weights = ROLE_WEIGHTS[slug];
    for (const c of CONSTRUCTS) {
      await prisma.compositeWeight.create({
        data: {
          roleId: roleRecords[slug],
          constructId: c.id,
          weight: weights[c.id],
          version: 1,
          source: "RESEARCH_VALIDATED",
          effectiveFrom: new Date(),
        },
      });
    }
  }
  console.log("  Created composite weights (", ROLE_SLUGS.length * CONSTRUCTS.length, "entries).");

  // 6. Candidates + Assessments
  let candidateCount = 0;
  for (const cand of CANDIDATES) {
    const archetype = ARCHETYPES[cand.archetype];
    const primaryRoleSlug = ROLE_SLUGS[cand.role];
    const scores = generateScores(archetype);
    const isIncomplete = INCOMPLETE_CANDIDATES.has(cand.email);
    const hasForcedRedFlag = FORCED_RED_FLAG_CANDIDATES.has(cand.email);

    // Determine status for primary role
    const { passed, distance } = evaluateCutline(scores, primaryRoleSlug);
    const hasRedFlag = hasForcedRedFlag || Math.random() < archetype.flagProbability;
    const status = isIncomplete ? "INCOMPLETE" : determineStatus(passed, distance, hasRedFlag);

    const assessmentDate = randomDate(60);
    const completedDate = isIncomplete ? null : new Date(assessmentDate.getTime() + rand(35, 75) * 60000);
    const durationMinutes = completedDate ? Math.round((completedDate.getTime() - assessmentDate.getTime()) / 60000) : null;

    const candidate = await prisma.candidate.create({
      data: {
        firstName: cand.first,
        lastName: cand.last,
        email: `${cand.email}@example.com`,
        phone: `+1${rand(200, 999)}${rand(100, 999)}${rand(1000, 9999)}`,
        orgId: org.id,
        primaryRoleId: roleRecords[primaryRoleSlug],
        status: status as "RECOMMENDED" | "REVIEW_REQUIRED" | "DO_NOT_ADVANCE" | "INCOMPLETE",
      },
    });

    // Assessment
    const assessment = await prisma.assessment.create({
      data: {
        candidateId: candidate.id,
        startedAt: assessmentDate,
        completedAt: completedDate,
        durationMinutes,
      },
    });

    // Skip scoring data for incomplete assessments
    if (isIncomplete) {
      candidateCount++;
      console.log(`  [${candidateCount}/25] Created ${cand.first} ${cand.last} (${archetype.name}) → INCOMPLETE`);
      continue;
    }

    // Subtest Results
    for (const c of CONSTRUCTS) {
      const percentile = scores[c.id];
      const rawScore = percentile * 0.8 + rand(-5, 5);
      const theta = (percentile - 50) / 25 + (Math.random() * 0.4 - 0.2);

      await prisma.subtestResult.create({
        data: {
          assessmentId: assessment.id,
          construct: c.id,
          layer: c.layer,
          rawScore: Math.round(rawScore * 10) / 10,
          percentile,
          theta: Math.round(theta * 100) / 100,
          standardError: Math.round((0.15 + Math.random() * 0.2) * 100) / 100,
          responseTimeAvgMs: rand(3000, 18000),
          itemCount: rand(8, 20),
          aiFollowUpCount: rand(1, 4),
          calibrationScore: percentile >= 50 ? Math.round((0.6 + Math.random() * 0.35) * 100) / 100 : Math.round((0.3 + Math.random() * 0.4) * 100) / 100,
          calibrationBias: percentile >= 70 ? "well-calibrated" : percentile >= 50 ? "slightly-overconfident" : "overconfident",
          narrativeInsight: `${cand.first} demonstrated ${percentile >= 75 ? "strong" : percentile >= 50 ? "adequate" : "developing"} capability in this area.`,
        },
      });
    }

    // Composite Scores for ALL roles
    for (const slug of ROLE_SLUGS) {
      const compositePercentile = calculateComposite(scores, slug);
      const { passed: p, distance: d } = evaluateCutline(scores, slug);

      await prisma.compositeScore.create({
        data: {
          assessmentId: assessment.id,
          roleSlug: slug,
          indexName: `${ROLE_NAMES[ROLE_SLUGS.indexOf(slug)]} Composite`,
          score: compositePercentile,
          percentile: compositePercentile,
          passed: p,
          distanceFromCutline: d,
        },
      });
    }

    // Predictions
    const lv = scores.LEARNING_VELOCITY;
    const rampMonths = lv >= 80 ? 0.75 : lv >= 60 ? 1.5 : lv >= 40 ? 2.5 : 3.5;
    const mc = scores.METACOGNITIVE_CALIBRATION;
    const prl = scores.PROCEDURAL_RELIABILITY;
    const fr = scores.FLUID_REASONING;

    await prisma.prediction.create({
      data: {
        assessmentId: assessment.id,
        rampTimeMonths: rampMonths,
        rampTimeLabel: rampMonths <= 1 ? "Fast Ramp" : rampMonths <= 2 ? "Standard" : "Extended",
        rampTimeFactors: { learningVelocity: lv, executiveControl: scores.EXECUTIVE_CONTROL, systemsDiagnostics: scores.SYSTEMS_DIAGNOSTICS },
        supervisionLoad: mc >= 65 && prl >= 60 ? "LOW" : mc >= 40 ? "MEDIUM" : "HIGH",
        supervisionScore: Math.round((mc * 0.4 + prl * 0.3 + scores.ETHICAL_JUDGMENT * 0.3)),
        supervisionFactors: { metacognition: mc, proceduralReliability: prl, ethicalJudgment: scores.ETHICAL_JUDGMENT },
        performanceCeiling: fr >= 75 && lv >= 70 ? "HIGH" : fr >= 50 ? "MEDIUM" : "LOW",
        ceilingFactors: { fluidReasoning: fr, learningVelocity: lv, systemsDiagnostics: scores.SYSTEMS_DIAGNOSTICS },
        ceilingCareerPath: fr >= 75 ? ["Current Role", "Senior Specialist", "Team Lead", "Technical Manager"] : fr >= 50 ? ["Current Role", "Experienced Performer", "Senior Specialist"] : ["Current Role", "Experienced Performer"],
        attritionRisk: prl < 35 || scores.ETHICAL_JUDGMENT < 35 ? "HIGH" : prl < 55 ? "MEDIUM" : "LOW",
        attritionFactors: { proceduralReliability: prl, ethicalJudgment: scores.ETHICAL_JUDGMENT, cognitiveFlexibility: scores.COGNITIVE_FLEXIBILITY },
        attritionStrategies: prl < 50 ? ["Structured onboarding", "Buddy system", "90-day check-ins", "Clear performance milestones"] : ["Standard onboarding", "Regular 1:1s"],
      },
    });

    // Red Flags
    if (hasRedFlag) {
      if (hasForcedRedFlag) {
        // Forced red flag candidates always get a CRITICAL flag
        const criticalTemplates = RED_FLAG_TEMPLATES.filter(t => t.severity === "CRITICAL");
        const template = criticalTemplates[rand(0, criticalTemplates.length - 1)];
        await prisma.redFlag.create({
          data: {
            assessmentId: assessment.id,
            severity: "CRITICAL",
            category: template.category,
            title: template.title,
            description: template.description,
            constructs: template.constructs,
          },
        });
      }
      const flagCount = rand(1, 2);
      const usedIndices = new Set<number>();
      for (let f = 0; f < flagCount; f++) {
        let flagIdx: number;
        do { flagIdx = rand(0, RED_FLAG_TEMPLATES.length - 1); } while (usedIndices.has(flagIdx));
        usedIndices.add(flagIdx);
        const template = RED_FLAG_TEMPLATES[flagIdx];
        await prisma.redFlag.create({
          data: {
            assessmentId: assessment.id,
            severity: template.severity as "CRITICAL" | "WARNING" | "INFO",
            category: template.category,
            title: template.title,
            description: template.description,
            constructs: template.constructs,
          },
        });
      }
    }

    // AI Interactions (2-3 per candidate, spread across constructs)
    const interactionCount = rand(2, 4);
    const shuffledConstructs = [...CONSTRUCTS].sort(() => Math.random() - 0.5).slice(0, interactionCount);
    for (let i = 0; i < shuffledConstructs.length; i++) {
      const c = shuffledConstructs[i];
      const prompts = AI_PROMPTS[c.id];
      const prompt = prompts[rand(0, prompts.length - 1)];
      const isHigh = scores[c.id] >= 60;
      const responses = isHigh ? AI_RESPONSES_HIGH : AI_RESPONSES_LOW;

      await prisma.aIInteraction.create({
        data: {
          assessmentId: assessment.id,
          construct: c.id,
          sequenceOrder: i + 1,
          triggerItemId: `item-${c.id.toLowerCase()}-${rand(1, 5)}`,
          triggerResponse: isHigh ? "correct" : "incorrect",
          aiPrompt: prompt,
          candidateResponse: responses[rand(0, responses.length - 1)],
          responseTimeMs: rand(8000, 45000),
          aiAnalysis: `Response ${isHigh ? "demonstrates" : "suggests limited"} ${c.id.toLowerCase().replace(/_/g, " ")} capability. ${isHigh ? "Clear reasoning and self-awareness evident." : "May benefit from structured development in this area."}`,
          evidenceFor: { construct: c.id, direction: isHigh ? "positive" : "negative", strength: isHigh ? "strong" : "moderate" },
          confidenceLevel: isHigh ? 0.8 + Math.random() * 0.15 : 0.5 + Math.random() * 0.25,
        },
      });
    }

    // Notes (1-2 per candidate)
    const noteTemplates = [
      `${cand.first} completed the assessment ${durationMinutes! < 45 ? "quickly" : "at a steady pace"}. ${status === "RECOMMENDED" ? "Strong candidate for next round." : status === "REVIEW_REQUIRED" ? "Borderline — needs hiring manager discussion." : "Significant concerns noted."}`,
      `Initial phone screen was positive. ${cand.first} has ${rand(2, 15)} years of manufacturing experience. ${archetype.name === "Star" ? "Very promising." : archetype.name === "Concern" ? "Skills may not match role requirements." : "Worth evaluating further."}`,
      `Referred by current employee. Background check in progress.`,
    ];

    const noteCount = rand(1, 2);
    for (let n = 0; n < noteCount; n++) {
      await prisma.note.create({
        data: {
          candidateId: candidate.id,
          authorId: user.id,
          content: noteTemplates[n % noteTemplates.length],
        },
      });
    }

    candidateCount++;
    console.log(`  [${candidateCount}/25] Created ${cand.first} ${cand.last} (${archetype.name}) → ${status}`);
  }

  // Summary
  const counts = await Promise.all([
    prisma.candidate.count(),
    prisma.subtestResult.count(),
    prisma.compositeScore.count(),
    prisma.prediction.count(),
    prisma.redFlag.count(),
    prisma.aIInteraction.count(),
    prisma.note.count(),
  ]);

  console.log("\n✅ Seed complete!");
  console.log(`  Candidates: ${counts[0]}`);
  console.log(`  Subtest Results: ${counts[1]}`);
  console.log(`  Composite Scores: ${counts[2]}`);
  console.log(`  Predictions: ${counts[3]}`);
  console.log(`  Red Flags: ${counts[4]}`);
  console.log(`  AI Interactions: ${counts[5]}`);
  console.log(`  Notes: ${counts[6]}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });

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

// ─── CANDIDATE ARCHETYPES ────────────────────────────────
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
    flagProbability: 0.1,
  },
  Concern: {
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
  DiamondInTheRough: {
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
  VeteranProfile: {
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
  WildCard: {
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
  BrightUnpolished: {
    name: "Bright but Unpolished",
    scores: {
      FLUID_REASONING: [75, 92], EXECUTIVE_CONTROL: [28, 48], COGNITIVE_FLEXIBILITY: [68, 85],
      METACOGNITIVE_CALIBRATION: [32, 52], LEARNING_VELOCITY: [80, 95],
      SYSTEMS_DIAGNOSTICS: [60, 78], PATTERN_RECOGNITION: [65, 82], QUANTITATIVE_REASONING: [62, 80],
      SPATIAL_VISUALIZATION: [58, 76], MECHANICAL_REASONING: [40, 60],
      PROCEDURAL_RELIABILITY: [30, 48], ETHICAL_JUDGMENT: [62, 78],
    },
    flagProbability: 0.3,
  },
  Borderline: {
    name: "Borderline",
    scores: {
      FLUID_REASONING: [48, 66], EXECUTIVE_CONTROL: [50, 68], COGNITIVE_FLEXIBILITY: [45, 62],
      METACOGNITIVE_CALIBRATION: [50, 68], LEARNING_VELOCITY: [52, 70],
      SYSTEMS_DIAGNOSTICS: [48, 65], PATTERN_RECOGNITION: [50, 68], QUANTITATIVE_REASONING: [48, 65],
      SPATIAL_VISUALIZATION: [48, 65], MECHANICAL_REASONING: [50, 68],
      PROCEDURAL_RELIABILITY: [52, 70], ETHICAL_JUDGMENT: [55, 72],
    },
    flagProbability: 0.2,
  },
};

// ─── RED FLAG TEMPLATES ───────────────────────────────────
const RED_FLAG_TEMPLATES = [
  { severity: "CRITICAL", category: "Integrity", title: "Significant Ethical Concern", description: "Candidate demonstrated pattern of choosing expedient over correct actions in 3+ scenarios.", constructs: ["ETHICAL_JUDGMENT"] },
  { severity: "CRITICAL", category: "Safety", title: "Procedural Shortcutting Pattern", description: "Consistently chose to skip safety verification steps when presented with time pressure.", constructs: ["PROCEDURAL_RELIABILITY"] },
  { severity: "CRITICAL", category: "Integrity", title: "Random Responding Pattern", description: "Response timing analysis indicates pattern inconsistent with genuine engagement. Unusually fast responses on 35% of complex items.", constructs: ["FLUID_REASONING", "PATTERN_RECOGNITION"] },
  { severity: "WARNING", category: "Calibration", title: "Overconfidence Pattern", description: "Candidate expressed high confidence on items answered incorrectly in 60%+ of flagged cases.", constructs: ["METACOGNITIVE_CALIBRATION"] },
  { severity: "WARNING", category: "Attention", title: "Sustained Attention Concern", description: "Response quality degraded significantly in final third of assessment. May indicate fatigue sensitivity.", constructs: ["EXECUTIVE_CONTROL"] },
  { severity: "WARNING", category: "Adaptability", title: "Rigidity Under Pressure", description: "Candidate struggled to shift strategies when initial approach failed, repeating unsuccessful methods.", constructs: ["COGNITIVE_FLEXIBILITY"] },
  { severity: "WARNING", category: "Engagement", title: "Scenario Disengagement", description: "Average response length in Act 1 scenarios was below threshold, suggesting limited engagement with complex situations.", constructs: ["FLUID_REASONING", "SYSTEMS_DIAGNOSTICS"] },
  { severity: "WARNING", category: "Consistency", title: "Act Consistency Failure", description: "3+ constructs showed significant divergence between Act 1 and Act 3 performance, suggesting inconsistent effort.", constructs: ["METACOGNITIVE_CALIBRATION", "EXECUTIVE_CONTROL"] },
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

function calculateComposite(scores: Record<ConstructId, number>, weights: Record<ConstructId, number>): number {
  let weightedSum = 0;
  let totalWeight = 0;
  for (const c of CONSTRUCTS) {
    weightedSum += scores[c.id] * weights[c.id];
    totalWeight += weights[c.id];
  }
  return Math.round(weightedSum / totalWeight);
}

function evaluateCutline(
  scores: Record<ConstructId, number>,
  cutline: { tech: number; behav: number; lv: number }
) {
  const techConstructs = CONSTRUCTS.filter((c) => c.layer === "TECHNICAL_APTITUDE");
  const behavConstructs = CONSTRUCTS.filter((c) => c.layer === "BEHAVIORAL_INTEGRITY");
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

function randomDate(daysAgo: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - rand(1, daysAgo));
  d.setHours(rand(8, 17), rand(0, 59));
  return d;
}

// ─── ORG SPEC TYPES ──────────────────────────────────────
interface RoleSpec {
  name: string;
  slug: string;
  description: string;
  complexityLevel: number;
  weights: Record<ConstructId, number>;
  cutline: { tech: number; behav: number; lv: number };
}

interface CandidateSpec {
  firstName: string;
  lastName: string;
  emailPrefix: string;
  primaryRoleSlug: string;
  archetype: string;
  forcedRedFlag?: boolean;
  incomplete?: boolean;
}

interface OrgSpec {
  name: string;
  slug: string;
  domain: string;
  adminEmail: string;
  adminName: string;
  roles: RoleSpec[];
  candidates: CandidateSpec[];
}

// ─── SEED FUNCTION ───────────────────────────────────────
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
  const roleRecords: Record<string, { id: string; weights: Record<ConstructId, number>; cutline: { tech: number; behav: number; lv: number } }> = {};
  for (const r of spec.roles) {
    const role = await prisma.role.create({
      data: {
        name: r.name,
        slug: r.slug,
        description: r.description,
        orgId: org.id,
        isCustom: false,
        sourceType: "SYSTEM_DEFAULT",
      },
    });
    roleRecords[r.slug] = { id: role.id, weights: r.weights, cutline: r.cutline };

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
          effectiveFrom: new Date(),
        },
      });
    }
  }

  // Generic Aptitude role
  const genericRole = await prisma.role.create({
    data: {
      name: "Generic Aptitude",
      slug: "generic-aptitude",
      description: "General cognitive and behavioral aptitude assessment. Not tied to a specific role — results can be compared across all roles.",
      orgId: org.id,
      isCustom: false,
      isGeneric: true,
      sourceType: "SYSTEM_DEFAULT",
    },
  });
  const genericWeights: Record<ConstructId, number> = {} as Record<ConstructId, number>;
  for (const c of CONSTRUCTS) {
    genericWeights[c.id] = Math.round((100 / 12) * 100) / 100;
  }
  roleRecords["generic-aptitude"] = { id: genericRole.id, weights: genericWeights, cutline: { tech: 25, behav: 25, lv: 25 } };

  await prisma.cutline.create({
    data: {
      roleId: genericRole.id,
      orgId: org.id,
      technicalAptitude: 25,
      behavioralIntegrity: 25,
      learningVelocity: 25,
      overallMinimum: 25,
    },
  });
  for (const c of CONSTRUCTS) {
    await prisma.compositeWeight.create({
      data: {
        roleId: genericRole.id,
        constructId: c.id,
        weight: genericWeights[c.id],
        version: 1,
        source: "RESEARCH_VALIDATED",
        effectiveFrom: new Date(),
      },
    });
  }

  console.log(`    Created ${spec.roles.length + 1} roles.`);

  // Candidates
  let count = 0;
  for (const cand of spec.candidates) {
    const archetype = ARCHETYPES[cand.archetype];
    if (!archetype) throw new Error(`Unknown archetype: ${cand.archetype}`);

    const primaryRole = roleRecords[cand.primaryRoleSlug];
    if (!primaryRole) throw new Error(`Unknown role slug: ${cand.primaryRoleSlug} in org ${spec.slug}`);

    const scores = generateScores(archetype);
    const isIncomplete = !!cand.incomplete;
    const { passed, distance } = evaluateCutline(scores, primaryRole.cutline);
    const hasRedFlag = cand.forcedRedFlag || Math.random() < archetype.flagProbability;
    const status = isIncomplete ? "INCOMPLETE" : determineStatus(passed, distance, hasRedFlag);

    const assessmentDate = randomDate(60);
    const completedDate = isIncomplete ? null : new Date(assessmentDate.getTime() + rand(35, 75) * 60000);
    const durationMinutes = completedDate ? Math.round((completedDate.getTime() - assessmentDate.getTime()) / 60000) : null;

    const candidate = await prisma.candidate.create({
      data: {
        firstName: cand.firstName,
        lastName: cand.lastName,
        email: `${cand.emailPrefix}@example.com`,
        phone: `+1${rand(200, 999)}${rand(100, 999)}${rand(1000, 9999)}`,
        orgId: org.id,
        primaryRoleId: primaryRole.id,
        status: status as "RECOMMENDED" | "REVIEW_REQUIRED" | "DO_NOT_ADVANCE" | "INCOMPLETE",
      },
    });

    const assessment = await prisma.assessment.create({
      data: {
        candidateId: candidate.id,
        startedAt: assessmentDate,
        completedAt: completedDate,
        durationMinutes,
      },
    });

    if (isIncomplete) {
      count++;
      continue;
    }

    // Subtest results
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
          narrativeInsight: `${cand.firstName} demonstrated ${percentile >= 75 ? "strong" : percentile >= 50 ? "adequate" : "developing"} capability in this area.`,
        },
      });
    }

    // Composite scores for ALL roles (enables Role Switcher)
    for (const [slug, roleData] of Object.entries(roleRecords)) {
      if (slug === "generic-aptitude") continue;
      const compositePercentile = calculateComposite(scores, roleData.weights);
      const { passed: p, distance: d } = evaluateCutline(scores, roleData.cutline);
      await prisma.compositeScore.create({
        data: {
          assessmentId: assessment.id,
          roleSlug: slug,
          indexName: `${spec.roles.find((r) => r.slug === slug)?.name ?? slug} Composite`,
          score: compositePercentile,
          percentile: compositePercentile,
          passed: p,
          distanceFromCutline: d,
        },
      });
    }

    // Predictions
    const lv = scores.LEARNING_VELOCITY;
    const mc = scores.METACOGNITIVE_CALIBRATION;
    const prl = scores.PROCEDURAL_RELIABILITY;
    const fr = scores.FLUID_REASONING;
    const rampMonths = lv >= 80 ? 0.75 : lv >= 60 ? 1.5 : lv >= 40 ? 2.5 : 3.5;

    await prisma.prediction.create({
      data: {
        assessmentId: assessment.id,
        rampTimeMonths: rampMonths,
        rampTimeLabel: rampMonths <= 1 ? "Fast Ramp" : rampMonths <= 2 ? "Standard" : "Extended",
        rampTimeFactors: { learningVelocity: lv, executiveControl: scores.EXECUTIVE_CONTROL, systemsDiagnostics: scores.SYSTEMS_DIAGNOSTICS },
        supervisionLoad: mc >= 65 && prl >= 60 ? "LOW" : mc >= 40 ? "MEDIUM" : "HIGH",
        supervisionScore: Math.round(mc * 0.4 + prl * 0.3 + scores.ETHICAL_JUDGMENT * 0.3),
        supervisionFactors: { metacognition: mc, proceduralReliability: prl, ethicalJudgment: scores.ETHICAL_JUDGMENT },
        performanceCeiling: fr >= 75 && lv >= 70 ? "HIGH" : fr >= 50 ? "MEDIUM" : "LOW",
        ceilingFactors: { fluidReasoning: fr, learningVelocity: lv, systemsDiagnostics: scores.SYSTEMS_DIAGNOSTICS },
        ceilingCareerPath: fr >= 75 ? ["Current Role", "Senior Specialist", "Team Lead", "Technical Manager"] : fr >= 50 ? ["Current Role", "Experienced Performer", "Senior Specialist"] : ["Current Role", "Experienced Performer"],
        attritionRisk: prl < 35 || scores.ETHICAL_JUDGMENT < 35 ? "HIGH" : prl < 55 ? "MEDIUM" : "LOW",
        attritionFactors: { proceduralReliability: prl, ethicalJudgment: scores.ETHICAL_JUDGMENT, cognitiveFlexibility: scores.COGNITIVE_FLEXIBILITY },
        attritionStrategies: prl < 50 ? ["Structured onboarding", "Buddy system", "90-day check-ins", "Clear performance milestones"] : ["Standard onboarding", "Regular 1:1s"],
      },
    });

    // Red flags
    if (hasRedFlag) {
      if (cand.forcedRedFlag) {
        const critical = RED_FLAG_TEMPLATES.filter((t) => t.severity === "CRITICAL");
        const tpl = critical[rand(0, critical.length - 1)];
        await prisma.redFlag.create({
          data: {
            assessmentId: assessment.id,
            severity: "CRITICAL",
            category: tpl.category,
            title: tpl.title,
            description: tpl.description,
            constructs: tpl.constructs,
          },
        });
      }
      const flagCount = rand(1, 2);
      const used = new Set<number>();
      for (let f = 0; f < flagCount; f++) {
        let idx: number;
        do { idx = rand(0, RED_FLAG_TEMPLATES.length - 1); } while (used.has(idx));
        used.add(idx);
        const tpl = RED_FLAG_TEMPLATES[idx];
        await prisma.redFlag.create({
          data: {
            assessmentId: assessment.id,
            severity: tpl.severity as "CRITICAL" | "WARNING" | "INFO",
            category: tpl.category,
            title: tpl.title,
            description: tpl.description,
            constructs: tpl.constructs,
          },
        });
      }
    }

    // AI interactions
    const interactionCount = rand(2, 4);
    const shuffled = [...CONSTRUCTS].sort(() => Math.random() - 0.5).slice(0, interactionCount);
    for (let i = 0; i < shuffled.length; i++) {
      const c = shuffled[i];
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

    // Notes
    const noteTemplates = [
      `${cand.firstName} completed the assessment ${durationMinutes! < 45 ? "quickly" : "at a steady pace"}. ${status === "RECOMMENDED" ? "Strong candidate for next round." : status === "REVIEW_REQUIRED" ? "Borderline — needs hiring manager discussion." : "Significant concerns noted."}`,
      `Initial screen was positive. ${cand.firstName} has relevant background for the ${roleRecords[cand.primaryRoleSlug] ? cand.primaryRoleSlug.replace(/-/g, " ") : "role"}. ${archetype.name === "Star" ? "Very promising." : archetype.name === "Concern" ? "Skills may not match role requirements." : "Worth evaluating further."}`,
    ];
    const noteCount = rand(1, 2);
    for (let n = 0; n < noteCount; n++) {
      await prisma.note.create({
        data: {
          candidateId: candidate.id,
          authorId: adminUser.id,
          content: noteTemplates[n % noteTemplates.length],
        },
      });
    }

    count++;
  }

  console.log(`    Created ${count} candidates.`);
}

// ─── ORG 1: ATLAS DEFENSE CORP ────────────────────────────
const atlasDefenseSpec: OrgSpec = {
  name: "Atlas Defense Corp",
  slug: "atlas-defense",
  domain: "atlasdefense.com",
  adminEmail: "alex.chen@arklight.io",
  adminName: "Alex Chen",
  roles: [
    {
      name: "Factory Technician",
      slug: "factory-technician",
      description: "Entry-level production floor role. Operates equipment, follows procedures, maintains quality standards.",
      complexityLevel: 2,
      weights: {
        FLUID_REASONING: 10, EXECUTIVE_CONTROL: 10, COGNITIVE_FLEXIBILITY: 5,
        METACOGNITIVE_CALIBRATION: 8, LEARNING_VELOCITY: 22,
        SYSTEMS_DIAGNOSTICS: 3, PATTERN_RECOGNITION: 7, QUANTITATIVE_REASONING: 5,
        SPATIAL_VISUALIZATION: 2, MECHANICAL_REASONING: 3,
        PROCEDURAL_RELIABILITY: 20, ETHICAL_JUDGMENT: 5,
      },
      cutline: { tech: 40, behav: 60, lv: 60 },
    },
    {
      name: "CNC Machinist",
      slug: "cnc-machinist",
      description: "Operates CNC machines. Reads G-code, manages feeds/speeds, maintains tolerances.",
      complexityLevel: 3,
      weights: {
        FLUID_REASONING: 8, EXECUTIVE_CONTROL: 10, COGNITIVE_FLEXIBILITY: 8,
        METACOGNITIVE_CALIBRATION: 5, LEARNING_VELOCITY: 8,
        SYSTEMS_DIAGNOSTICS: 5, PATTERN_RECOGNITION: 12, QUANTITATIVE_REASONING: 15,
        SPATIAL_VISUALIZATION: 15, MECHANICAL_REASONING: 12,
        PROCEDURAL_RELIABILITY: 2, ETHICAL_JUDGMENT: 0,
      },
      cutline: { tech: 60, behav: 55, lv: 50 },
    },
    {
      name: "CAM Programmer",
      slug: "cam-programmer",
      description: "Programs toolpaths using CAM software. Requires spatial reasoning and process knowledge.",
      complexityLevel: 4,
      weights: {
        FLUID_REASONING: 15, EXECUTIVE_CONTROL: 8, COGNITIVE_FLEXIBILITY: 5,
        METACOGNITIVE_CALIBRATION: 5, LEARNING_VELOCITY: 7,
        SYSTEMS_DIAGNOSTICS: 10, PATTERN_RECOGNITION: 5, QUANTITATIVE_REASONING: 18,
        SPATIAL_VISUALIZATION: 20, MECHANICAL_REASONING: 5,
        PROCEDURAL_RELIABILITY: 0, ETHICAL_JUDGMENT: 2,
      },
      cutline: { tech: 75, behav: 50, lv: 55 },
    },
    {
      name: "CMM Programmer",
      slug: "cmm-programmer",
      description: "Programs coordinate measuring machines. Requires precision, GD&T mastery, statistical skills.",
      complexityLevel: 4,
      weights: {
        FLUID_REASONING: 10, EXECUTIVE_CONTROL: 10, COGNITIVE_FLEXIBILITY: 5,
        METACOGNITIVE_CALIBRATION: 8, LEARNING_VELOCITY: 5,
        SYSTEMS_DIAGNOSTICS: 5, PATTERN_RECOGNITION: 15, QUANTITATIVE_REASONING: 20,
        SPATIAL_VISUALIZATION: 5, MECHANICAL_REASONING: 2,
        PROCEDURAL_RELIABILITY: 12, ETHICAL_JUDGMENT: 3,
      },
      cutline: { tech: 70, behav: 75, lv: 45 },
    },
    {
      name: "Manufacturing Engineer",
      slug: "manufacturing-engineer",
      description: "Designs and optimizes manufacturing processes. Cross-functional problem-solving role.",
      complexityLevel: 5,
      weights: {
        FLUID_REASONING: 18, EXECUTIVE_CONTROL: 5, COGNITIVE_FLEXIBILITY: 8,
        METACOGNITIVE_CALIBRATION: 8, LEARNING_VELOCITY: 12,
        SYSTEMS_DIAGNOSTICS: 18, PATTERN_RECOGNITION: 5, QUANTITATIVE_REASONING: 8,
        SPATIAL_VISUALIZATION: 5, MECHANICAL_REASONING: 3,
        PROCEDURAL_RELIABILITY: 3, ETHICAL_JUDGMENT: 7,
      },
      cutline: { tech: 65, behav: 70, lv: 65 },
    },
  ],
  candidates: [
    { firstName: "Jordan", lastName: "Brooks", emailPrefix: "j.brooks.atlas", primaryRoleSlug: "factory-technician", archetype: "Star" },
    { firstName: "Elena", lastName: "Vasquez", emailPrefix: "e.vasquez.atlas", primaryRoleSlug: "cnc-machinist", archetype: "Star" },
    { firstName: "Marcus", lastName: "Chen", emailPrefix: "m.chen.atlas", primaryRoleSlug: "manufacturing-engineer", archetype: "Star" },
    { firstName: "Priya", lastName: "Sharma", emailPrefix: "p.sharma.atlas", primaryRoleSlug: "cam-programmer", archetype: "Specialist" },
    { firstName: "Frank", lastName: "Kowalski", emailPrefix: "f.kowalski.atlas", primaryRoleSlug: "cnc-machinist", archetype: "Specialist" },
    { firstName: "Keisha", lastName: "Williams", emailPrefix: "k.williams.atlas", primaryRoleSlug: "cmm-programmer", archetype: "SteadyHand" },
    { firstName: "Carlos", lastName: "Mendez", emailPrefix: "c.mendez.atlas", primaryRoleSlug: "factory-technician", archetype: "QuickStudy" },
    { firstName: "Tyler", lastName: "Morrison", emailPrefix: "t.morrison.atlas", primaryRoleSlug: "factory-technician", archetype: "Borderline" },
    { firstName: "David", lastName: "Kim", emailPrefix: "d.kim.atlas", primaryRoleSlug: "cnc-machinist", archetype: "Borderline" },
    { firstName: "Sarah", lastName: "O'Brien", emailPrefix: "s.obrien.atlas", primaryRoleSlug: "manufacturing-engineer", archetype: "WildCard" },
    { firstName: "Jasmine", lastName: "Nguyen", emailPrefix: "j.nguyen.atlas", primaryRoleSlug: "cmm-programmer", archetype: "Borderline" },
    { firstName: "Aisha", lastName: "Okafor", emailPrefix: "a.okafor.atlas", primaryRoleSlug: "cam-programmer", archetype: "DiamondInTheRough" },
    { firstName: "Robert", lastName: "Hawkins", emailPrefix: "r.hawkins.atlas", primaryRoleSlug: "manufacturing-engineer", archetype: "Concern", forcedRedFlag: true },
    { firstName: "Maria", lastName: "Santos", emailPrefix: "m.santos.atlas", primaryRoleSlug: "factory-technician", archetype: "DiamondInTheRough" },
    { firstName: "Devon", lastName: "Jackson", emailPrefix: "d.jackson.atlas", primaryRoleSlug: "cam-programmer", archetype: "Concern" },
    { firstName: "Angela", lastName: "Torres", emailPrefix: "a.torres.atlas", primaryRoleSlug: "cnc-machinist", archetype: "Concern" },
    { firstName: "James", lastName: "Mitchell", emailPrefix: "j.mitchell.atlas", primaryRoleSlug: "factory-technician", archetype: "QuickStudy", incomplete: true },
    { firstName: "Samantha", lastName: "Park", emailPrefix: "s.park.atlas", primaryRoleSlug: "manufacturing-engineer", archetype: "Star", incomplete: true },
  ],
};

// ─── ORG 2: ORBITAL DYNAMICS ─────────────────────────────
const orbitalDynamicsSpec: OrgSpec = {
  name: "Orbital Dynamics",
  slug: "orbital-dynamics",
  domain: "orbitaldynamics.com",
  adminEmail: "taylor.brooks@arklight.io",
  adminName: "Taylor Brooks",
  roles: [
    {
      name: "Systems Engineer",
      slug: "systems-engineer",
      description: "Owns system-level architecture and interface definitions for spacecraft subsystems. Manages requirements traceability and integration testing.",
      complexityLevel: 5,
      weights: {
        FLUID_REASONING: 16, EXECUTIVE_CONTROL: 8, COGNITIVE_FLEXIBILITY: 10,
        METACOGNITIVE_CALIBRATION: 8, LEARNING_VELOCITY: 10,
        SYSTEMS_DIAGNOSTICS: 20, PATTERN_RECOGNITION: 8, QUANTITATIVE_REASONING: 10,
        SPATIAL_VISUALIZATION: 5, MECHANICAL_REASONING: 3,
        PROCEDURAL_RELIABILITY: 5, ETHICAL_JUDGMENT: 7,
      },
      cutline: { tech: 70, behav: 65, lv: 60 },
    },
    {
      name: "Propulsion Engineer",
      slug: "propulsion-engineer",
      description: "Designs and analyzes propulsion systems for launch vehicles and spacecraft. Strong math and mechanics background required.",
      complexityLevel: 5,
      weights: {
        FLUID_REASONING: 12, EXECUTIVE_CONTROL: 7, COGNITIVE_FLEXIBILITY: 5,
        METACOGNITIVE_CALIBRATION: 7, LEARNING_VELOCITY: 6,
        SYSTEMS_DIAGNOSTICS: 10, PATTERN_RECOGNITION: 8, QUANTITATIVE_REASONING: 20,
        SPATIAL_VISUALIZATION: 12, MECHANICAL_REASONING: 15,
        PROCEDURAL_RELIABILITY: 8, ETHICAL_JUDGMENT: 5,
      },
      cutline: { tech: 75, behav: 60, lv: 55 },
    },
    {
      name: "Avionics Engineer",
      slug: "avionics-engineer",
      description: "Develops and validates avionics systems including flight computers, sensor integration, and communication links.",
      complexityLevel: 5,
      weights: {
        FLUID_REASONING: 10, EXECUTIVE_CONTROL: 10, COGNITIVE_FLEXIBILITY: 8,
        METACOGNITIVE_CALIBRATION: 7, LEARNING_VELOCITY: 8,
        SYSTEMS_DIAGNOSTICS: 15, PATTERN_RECOGNITION: 18, QUANTITATIVE_REASONING: 12,
        SPATIAL_VISUALIZATION: 6, MECHANICAL_REASONING: 4,
        PROCEDURAL_RELIABILITY: 8, ETHICAL_JUDGMENT: 5,
      },
      cutline: { tech: 72, behav: 65, lv: 55 },
    },
    {
      name: "Test Engineer",
      slug: "test-engineer",
      description: "Plans and executes environmental, functional, and system-level tests. Generates test reports and interfaces with integration teams.",
      complexityLevel: 4,
      weights: {
        FLUID_REASONING: 8, EXECUTIVE_CONTROL: 8, COGNITIVE_FLEXIBILITY: 7,
        METACOGNITIVE_CALIBRATION: 12, LEARNING_VELOCITY: 7,
        SYSTEMS_DIAGNOSTICS: 10, PATTERN_RECOGNITION: 10, QUANTITATIVE_REASONING: 15,
        SPATIAL_VISUALIZATION: 5, MECHANICAL_REASONING: 5,
        PROCEDURAL_RELIABILITY: 18, ETHICAL_JUDGMENT: 5,
      },
      cutline: { tech: 65, behav: 78, lv: 50 },
    },
    {
      name: "Integration Technician",
      slug: "integration-technician",
      description: "Performs hands-on integration of spacecraft hardware. Follows detailed work instructions and performs functional checkouts.",
      complexityLevel: 3,
      weights: {
        FLUID_REASONING: 6, EXECUTIVE_CONTROL: 8, COGNITIVE_FLEXIBILITY: 5,
        METACOGNITIVE_CALIBRATION: 7, LEARNING_VELOCITY: 15,
        SYSTEMS_DIAGNOSTICS: 8, PATTERN_RECOGNITION: 7, QUANTITATIVE_REASONING: 8,
        SPATIAL_VISUALIZATION: 18, MECHANICAL_REASONING: 15,
        PROCEDURAL_RELIABILITY: 12, ETHICAL_JUDGMENT: 5,
      },
      cutline: { tech: 55, behav: 70, lv: 65 },
    },
  ],
  candidates: [
    { firstName: "Jordan", lastName: "Nakamura", emailPrefix: "j.nakamura.orbital", primaryRoleSlug: "systems-engineer", archetype: "Star" },
    { firstName: "Priya", lastName: "Deshpande", emailPrefix: "p.deshpande.orbital", primaryRoleSlug: "propulsion-engineer", archetype: "Star" },
    { firstName: "Marcus", lastName: "Webb", emailPrefix: "m.webb.orbital", primaryRoleSlug: "test-engineer", archetype: "SteadyHand" },
    { firstName: "Elena", lastName: "Petrov", emailPrefix: "e.petrov.orbital", primaryRoleSlug: "systems-engineer", archetype: "Specialist" },
    { firstName: "David", lastName: "Okonkwo", emailPrefix: "d.okonkwo.orbital", primaryRoleSlug: "test-engineer", archetype: "Star" },
    { firstName: "Amara", lastName: "Osei", emailPrefix: "a.osei.orbital", primaryRoleSlug: "integration-technician", archetype: "DiamondInTheRough" },
    { firstName: "Sofia", lastName: "Reyes", emailPrefix: "s.reyes.orbital", primaryRoleSlug: "avionics-engineer", archetype: "Borderline" },
    { firstName: "Kenji", lastName: "Watanabe", emailPrefix: "k.watanabe.orbital", primaryRoleSlug: "propulsion-engineer", archetype: "Borderline" },
    { firstName: "Thomas", lastName: "Chen", emailPrefix: "t.chen.orbital", primaryRoleSlug: "integration-technician", archetype: "QuickStudy" },
    { firstName: "Alex", lastName: "Rivera", emailPrefix: "a.rivera.orbital", primaryRoleSlug: "systems-engineer", archetype: "WildCard" },
    { firstName: "Rachel", lastName: "Kim", emailPrefix: "r.kim.orbital", primaryRoleSlug: "avionics-engineer", archetype: "Concern" },
    { firstName: "Isabelle", lastName: "Moreau", emailPrefix: "i.moreau.orbital", primaryRoleSlug: "propulsion-engineer", archetype: "Concern" },
    { firstName: "Craig", lastName: "Hollister", emailPrefix: "c.hollister.orbital", primaryRoleSlug: "systems-engineer", archetype: "Concern", forcedRedFlag: true },
    { firstName: "Nadia", lastName: "Hassan", emailPrefix: "n.hassan.orbital", primaryRoleSlug: "avionics-engineer", archetype: "Concern" },
    { firstName: "James", lastName: "Kofi", emailPrefix: "j.kofi.orbital", primaryRoleSlug: "test-engineer", archetype: "VeteranProfile", incomplete: true },
    { firstName: "Mei", lastName: "Lin", emailPrefix: "m.lin.orbital", primaryRoleSlug: "integration-technician", archetype: "QuickStudy", incomplete: true },
  ],
};

// ─── ORG 3: NEXUS ROBOTICS ───────────────────────────────
const nexusRoboticsSpec: OrgSpec = {
  name: "Nexus Robotics",
  slug: "nexus-robotics",
  domain: "nexusrobotics.com",
  adminEmail: "morgan.patel@arklight.io",
  adminName: "Morgan Patel",
  roles: [
    {
      name: "Robotics Engineer",
      slug: "robotics-engineer",
      description: "Designs and implements robotic systems including kinematics, perception, and motion planning. Bridges hardware and software.",
      complexityLevel: 5,
      weights: {
        FLUID_REASONING: 14, EXECUTIVE_CONTROL: 8, COGNITIVE_FLEXIBILITY: 8,
        METACOGNITIVE_CALIBRATION: 7, LEARNING_VELOCITY: 10,
        SYSTEMS_DIAGNOSTICS: 18, PATTERN_RECOGNITION: 10, QUANTITATIVE_REASONING: 8,
        SPATIAL_VISUALIZATION: 15, MECHANICAL_REASONING: 10,
        PROCEDURAL_RELIABILITY: 5, ETHICAL_JUDGMENT: 5,
      },
      cutline: { tech: 68, behav: 60, lv: 60 },
    },
    {
      name: "Firmware Engineer",
      slug: "firmware-engineer",
      description: "Develops embedded software for robotic hardware platforms. Owns real-time control loops, sensor drivers, and communication protocols.",
      complexityLevel: 5,
      weights: {
        FLUID_REASONING: 8, EXECUTIVE_CONTROL: 12, COGNITIVE_FLEXIBILITY: 8,
        METACOGNITIVE_CALIBRATION: 8, LEARNING_VELOCITY: 8,
        SYSTEMS_DIAGNOSTICS: 10, PATTERN_RECOGNITION: 18, QUANTITATIVE_REASONING: 15,
        SPATIAL_VISUALIZATION: 5, MECHANICAL_REASONING: 5,
        PROCEDURAL_RELIABILITY: 8, ETHICAL_JUDGMENT: 5,
      },
      cutline: { tech: 72, behav: 55, lv: 55 },
    },
    {
      name: "ML Engineer",
      slug: "ml-engineer",
      description: "Builds and deploys machine learning models for perception, planning, and control. Works across research and production.",
      complexityLevel: 5,
      weights: {
        FLUID_REASONING: 20, EXECUTIVE_CONTROL: 6, COGNITIVE_FLEXIBILITY: 10,
        METACOGNITIVE_CALIBRATION: 8, LEARNING_VELOCITY: 12,
        SYSTEMS_DIAGNOSTICS: 8, PATTERN_RECOGNITION: 10, QUANTITATIVE_REASONING: 18,
        SPATIAL_VISUALIZATION: 4, MECHANICAL_REASONING: 2,
        PROCEDURAL_RELIABILITY: 5, ETHICAL_JUDGMENT: 5,
      },
      cutline: { tech: 70, behav: 50, lv: 65 },
    },
    {
      name: "Controls Engineer",
      slug: "controls-engineer",
      description: "Designs feedback control systems for robotic actuators and motion systems. Background in control theory and dynamics required.",
      complexityLevel: 5,
      weights: {
        FLUID_REASONING: 10, EXECUTIVE_CONTROL: 10, COGNITIVE_FLEXIBILITY: 6,
        METACOGNITIVE_CALIBRATION: 7, LEARNING_VELOCITY: 7,
        SYSTEMS_DIAGNOSTICS: 18, PATTERN_RECOGNITION: 10, QUANTITATIVE_REASONING: 16,
        SPATIAL_VISUALIZATION: 8, MECHANICAL_REASONING: 12,
        PROCEDURAL_RELIABILITY: 5, ETHICAL_JUDGMENT: 4,
      },
      cutline: { tech: 70, behav: 60, lv: 55 },
    },
    {
      name: "Test Engineer",
      slug: "test-engineer-hw",
      description: "Plans and executes hardware-in-the-loop and system-level tests for robotic platforms. Generates test reports and tracks defects.",
      complexityLevel: 4,
      weights: {
        FLUID_REASONING: 8, EXECUTIVE_CONTROL: 8, COGNITIVE_FLEXIBILITY: 7,
        METACOGNITIVE_CALIBRATION: 12, LEARNING_VELOCITY: 8,
        SYSTEMS_DIAGNOSTICS: 10, PATTERN_RECOGNITION: 15, QUANTITATIVE_REASONING: 10,
        SPATIAL_VISUALIZATION: 5, MECHANICAL_REASONING: 8,
        PROCEDURAL_RELIABILITY: 18, ETHICAL_JUDGMENT: 7,
      },
      cutline: { tech: 60, behav: 72, lv: 50 },
    },
  ],
  candidates: [
    { firstName: "Yuki", lastName: "Tanaka", emailPrefix: "y.tanaka.nexus", primaryRoleSlug: "robotics-engineer", archetype: "Star" },
    { firstName: "Nina", lastName: "Volkov", emailPrefix: "n.volkov.nexus", primaryRoleSlug: "ml-engineer", archetype: "Star" },
    { firstName: "Devon", lastName: "Wallace", emailPrefix: "d.wallace.nexus", primaryRoleSlug: "test-engineer-hw", archetype: "SteadyHand" },
    { firstName: "Shreya", lastName: "Iyer", emailPrefix: "s.iyer.nexus", primaryRoleSlug: "firmware-engineer", archetype: "Specialist" },
    { firstName: "Liam", lastName: "O'Sullivan", emailPrefix: "l.osullivan.nexus", primaryRoleSlug: "controls-engineer", archetype: "Star" },
    { firstName: "Fatima", lastName: "Al-Rashid", emailPrefix: "f.alrashid.nexus", primaryRoleSlug: "ml-engineer", archetype: "BrightUnpolished" },
    { firstName: "Andre", lastName: "Baptiste", emailPrefix: "a.baptiste.nexus", primaryRoleSlug: "robotics-engineer", archetype: "QuickStudy" },
    { firstName: "Chloe", lastName: "Martinez", emailPrefix: "c.martinez.nexus", primaryRoleSlug: "firmware-engineer", archetype: "Borderline" },
    { firstName: "Omar", lastName: "Hassan", emailPrefix: "o.hassan.nexus", primaryRoleSlug: "controls-engineer", archetype: "Borderline" },
    { firstName: "Isabella", lastName: "Russo", emailPrefix: "i.russo.nexus", primaryRoleSlug: "ml-engineer", archetype: "WildCard" },
    { firstName: "Patrick", lastName: "O'Brien", emailPrefix: "p.obrien.nexus", primaryRoleSlug: "test-engineer-hw", archetype: "Concern" },
    { firstName: "Leila", lastName: "Nazari", emailPrefix: "l.nazari.nexus", primaryRoleSlug: "robotics-engineer", archetype: "Concern" },
    { firstName: "Victor", lastName: "Santos", emailPrefix: "v.santos.nexus", primaryRoleSlug: "controls-engineer", archetype: "Concern", forcedRedFlag: true },
    { firstName: "Hannah", lastName: "Berg", emailPrefix: "h.berg.nexus", primaryRoleSlug: "firmware-engineer", archetype: "Concern" },
    { firstName: "Rafael", lastName: "Diaz", emailPrefix: "r.diaz.nexus", primaryRoleSlug: "ml-engineer", archetype: "DiamondInTheRough" },
    { firstName: "Akira", lastName: "Yamamoto", emailPrefix: "a.yamamoto.nexus", primaryRoleSlug: "robotics-engineer", archetype: "VeteranProfile", incomplete: true },
    { firstName: "Sofia", lastName: "Lindgren", emailPrefix: "s.lindgren.nexus", primaryRoleSlug: "controls-engineer", archetype: "QuickStudy", incomplete: true },
  ],
};

// ─── ORG 4: VERTEX AI LABS ───────────────────────────────
const vertexAILabsSpec: OrgSpec = {
  name: "Vertex AI Labs",
  slug: "vertex-ai-labs",
  domain: "vertexailabs.com",
  adminEmail: "riley.foster@arklight.io",
  adminName: "Riley Foster",
  roles: [
    {
      name: "ML Engineer",
      slug: "ml-engineer-ai",
      description: "Builds, fine-tunes, and deploys large-scale ML models. Works across research and production infrastructure.",
      complexityLevel: 5,
      weights: {
        FLUID_REASONING: 18, EXECUTIVE_CONTROL: 6, COGNITIVE_FLEXIBILITY: 10,
        METACOGNITIVE_CALIBRATION: 8, LEARNING_VELOCITY: 12,
        SYSTEMS_DIAGNOSTICS: 8, PATTERN_RECOGNITION: 8, QUANTITATIVE_REASONING: 18,
        SPATIAL_VISUALIZATION: 4, MECHANICAL_REASONING: 2,
        PROCEDURAL_RELIABILITY: 5, ETHICAL_JUDGMENT: 5,
      },
      cutline: { tech: 72, behav: 50, lv: 65 },
    },
    {
      name: "AI Research Scientist",
      slug: "ai-researcher",
      description: "Leads original research on model architectures, training methods, and alignment. Publishes and presents findings.",
      complexityLevel: 5,
      weights: {
        FLUID_REASONING: 22, EXECUTIVE_CONTROL: 5, COGNITIVE_FLEXIBILITY: 10,
        METACOGNITIVE_CALIBRATION: 12, LEARNING_VELOCITY: 15,
        SYSTEMS_DIAGNOSTICS: 8, PATTERN_RECOGNITION: 8, QUANTITATIVE_REASONING: 10,
        SPATIAL_VISUALIZATION: 3, MECHANICAL_REASONING: 2,
        PROCEDURAL_RELIABILITY: 3, ETHICAL_JUDGMENT: 5,
      },
      cutline: { tech: 78, behav: 48, lv: 70 },
    },
    {
      name: "Full-Stack Engineer",
      slug: "fullstack-engineer",
      description: "Builds AI-native products end-to-end. Owns features from API design through frontend delivery, integrating ML capabilities throughout.",
      complexityLevel: 4,
      weights: {
        FLUID_REASONING: 12, EXECUTIVE_CONTROL: 12, COGNITIVE_FLEXIBILITY: 14,
        METACOGNITIVE_CALIBRATION: 8, LEARNING_VELOCITY: 10,
        SYSTEMS_DIAGNOSTICS: 16, PATTERN_RECOGNITION: 10, QUANTITATIVE_REASONING: 8,
        SPATIAL_VISUALIZATION: 3, MECHANICAL_REASONING: 2,
        PROCEDURAL_RELIABILITY: 8, ETHICAL_JUDGMENT: 5,
      },
      cutline: { tech: 65, behav: 55, lv: 55 },
    },
    {
      name: "Data Engineer",
      slug: "data-engineer",
      description: "Designs and maintains data pipelines for training, evaluation, and production serving. Owns data quality and lineage.",
      complexityLevel: 4,
      weights: {
        FLUID_REASONING: 10, EXECUTIVE_CONTROL: 10, COGNITIVE_FLEXIBILITY: 7,
        METACOGNITIVE_CALIBRATION: 7, LEARNING_VELOCITY: 8,
        SYSTEMS_DIAGNOSTICS: 16, PATTERN_RECOGNITION: 12, QUANTITATIVE_REASONING: 18,
        SPATIAL_VISUALIZATION: 3, MECHANICAL_REASONING: 2,
        PROCEDURAL_RELIABILITY: 10, ETHICAL_JUDGMENT: 5,
      },
      cutline: { tech: 70, behav: 60, lv: 55 },
    },
    {
      name: "Platform Engineer",
      slug: "platform-engineer",
      description: "Builds and maintains ML infrastructure including training clusters, model serving, and experiment tracking systems.",
      complexityLevel: 4,
      weights: {
        FLUID_REASONING: 12, EXECUTIVE_CONTROL: 14, COGNITIVE_FLEXIBILITY: 8,
        METACOGNITIVE_CALIBRATION: 7, LEARNING_VELOCITY: 8,
        SYSTEMS_DIAGNOSTICS: 18, PATTERN_RECOGNITION: 8, QUANTITATIVE_REASONING: 10,
        SPATIAL_VISUALIZATION: 3, MECHANICAL_REASONING: 2,
        PROCEDURAL_RELIABILITY: 10, ETHICAL_JUDGMENT: 5,
      },
      cutline: { tech: 68, behav: 62, lv: 55 },
    },
  ],
  candidates: [
    { firstName: "Alex", lastName: "Park", emailPrefix: "a.park.vertex", primaryRoleSlug: "ai-researcher", archetype: "Star" },
    { firstName: "Zara", lastName: "Ahmed", emailPrefix: "z.ahmed.vertex", primaryRoleSlug: "ml-engineer-ai", archetype: "Star" },
    { firstName: "Marcus", lastName: "Liu", emailPrefix: "m.liu.vertex", primaryRoleSlug: "platform-engineer", archetype: "SteadyHand" },
    { firstName: "Priya", lastName: "Kapoor", emailPrefix: "p.kapoor.vertex", primaryRoleSlug: "data-engineer", archetype: "Specialist" },
    { firstName: "Dylan", lastName: "Torres", emailPrefix: "d.torres.vertex", primaryRoleSlug: "fullstack-engineer", archetype: "Star" },
    { firstName: "Mei", lastName: "Zhang", emailPrefix: "m.zhang.vertex", primaryRoleSlug: "ai-researcher", archetype: "BrightUnpolished" },
    { firstName: "Eli", lastName: "Goldberg", emailPrefix: "e.goldberg.vertex", primaryRoleSlug: "ml-engineer-ai", archetype: "QuickStudy" },
    { firstName: "Sana", lastName: "Mirza", emailPrefix: "s.mirza.vertex", primaryRoleSlug: "data-engineer", archetype: "Borderline" },
    { firstName: "Tariq", lastName: "Johnson", emailPrefix: "t.johnson.vertex", primaryRoleSlug: "platform-engineer", archetype: "Borderline" },
    { firstName: "Ava", lastName: "Chen", emailPrefix: "a.chen.vertex", primaryRoleSlug: "fullstack-engineer", archetype: "WildCard" },
    { firstName: "Noah", lastName: "Okafor", emailPrefix: "n.okafor.vertex", primaryRoleSlug: "fullstack-engineer", archetype: "Concern" },
    { firstName: "Layla", lastName: "Hassan", emailPrefix: "l.hassan.vertex", primaryRoleSlug: "ml-engineer-ai", archetype: "Concern" },
    { firstName: "Ryan", lastName: "Nakamura", emailPrefix: "r.nakamura.vertex", primaryRoleSlug: "data-engineer", archetype: "Concern", forcedRedFlag: true },
    { firstName: "Aisha", lastName: "Williams", emailPrefix: "a.williams.vertex", primaryRoleSlug: "ai-researcher", archetype: "Concern" },
    { firstName: "Lucas", lastName: "Ferreira", emailPrefix: "l.ferreira.vertex", primaryRoleSlug: "platform-engineer", archetype: "DiamondInTheRough" },
    { firstName: "Sophie", lastName: "Dupont", emailPrefix: "s.dupont.vertex", primaryRoleSlug: "data-engineer", archetype: "VeteranProfile" },
    { firstName: "Omar", lastName: "Sheikh", emailPrefix: "o.sheikh.vertex", primaryRoleSlug: "ml-engineer-ai", archetype: "BrightUnpolished", incomplete: true },
    { firstName: "Ingrid", lastName: "Svensson", emailPrefix: "i.svensson.vertex", primaryRoleSlug: "platform-engineer", archetype: "QuickStudy", incomplete: true },
  ],
};

// ─── MAIN ─────────────────────────────────────────────────
async function main() {
  console.log("🌱 Seeding ACI database (4 demo organizations)...");

  // Clean all existing data
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

  await seedDemoOrg(atlasDefenseSpec);
  await seedDemoOrg(orbitalDynamicsSpec);
  await seedDemoOrg(nexusRoboticsSpec);
  await seedDemoOrg(vertexAILabsSpec);

  // Summary
  const counts = await Promise.all([
    prisma.organization.count(),
    prisma.role.count(),
    prisma.candidate.count(),
    prisma.subtestResult.count(),
    prisma.compositeScore.count(),
    prisma.prediction.count(),
    prisma.redFlag.count(),
    prisma.aIInteraction.count(),
    prisma.note.count(),
  ]);

  console.log("\n✅ Seed complete!");
  console.log(`  Organizations: ${counts[0]}`);
  console.log(`  Roles: ${counts[1]}`);
  console.log(`  Candidates: ${counts[2]}`);
  console.log(`  Subtest Results: ${counts[3]}`);
  console.log(`  Composite Scores: ${counts[4]}`);
  console.log(`  Predictions: ${counts[5]}`);
  console.log(`  Red Flags: ${counts[6]}`);
  console.log(`  AI Interactions: ${counts[7]}`);
  console.log(`  Notes: ${counts[8]}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });

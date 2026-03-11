import type {
  RoleBuilderPipelineResult,
  ExtractedJD,
  GeneratedWeights,
  ResearchRationale,
  HiringIntelligence,
} from "@/lib/role-builder/pipeline";

const MOCK_OCCUPATION = {
  soc: "17-2112.00",
  title: "Industrial Engineers",
  jobZone: 4 as const,
  abilities: [
    { id: "1.A.1.b.2", name: "Deductive Reasoning", importance: 78, level: 72 },
    { id: "1.A.1.b.3", name: "Inductive Reasoning", importance: 72, level: 68 },
    { id: "1.A.1.g.1", name: "Mathematical Reasoning", importance: 70, level: 65 },
  ],
  skills: [
    { id: "2.C.3.a", name: "Mathematics", importance: 80, level: 72 },
    { id: "2.C.3.e", name: "Systems Analysis", importance: 76, level: 68 },
  ],
  workStyles: [
    { id: "1.C.3.a", name: "Dependability", importance: 82 },
    { id: "1.C.3.c", name: "Attention to Detail", importance: 80 },
  ],
  keywords: ["engineer", "technical", "systems", "analysis", "manufacturing", "industrial"],
};

function slugify(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export async function generateMockRoleAnalysis(
  title: string,
  sourceType: "JD_UPLOAD" | "TEMPLATE_CLONE" | "MANUAL_ENTRY" = "MANUAL_ENTRY"
): Promise<RoleBuilderPipelineResult> {
  const delay = 1500 + Math.random() * 1000;
  await new Promise((r) => setTimeout(r, delay));

  const isTechnical = /engineer|machinist|technician|analyst|developer|architect|scientist|operator/i.test(title);
  const isBehavioral = /coordinator|officer|manager|director|safety|compliance|quality/i.test(title);

  const extracted: ExtractedJD = {
    title,
    description: `${title} role requiring strong technical aptitude, systems thinking, and procedural reliability in a high-performance environment.`,
    level: "MID",
    technicalSkills: ["Systems analysis", "Technical documentation", "Problem-solving methodologies", "Data-driven decision making"],
    behavioralRequirements: ["Attention to detail", "Dependability under pressure", "Collaborative communication", "Ethical judgment"],
    environment: {
      setting: "MIXED",
      physicalDemands: "MODERATE",
      shiftWork: false,
    },
    supervision: {
      receivesSupervision: "MODERATE",
      providesSupervision: false,
      teamSize: 8,
    },
    consequenceOfError: {
      safetyCritical: isTechnical,
      qualityCritical: true,
      costImpact: "HIGH",
    },
    learningRequirements: {
      newTechnologyAdoption: true,
      continuousLearning: true,
      crossTraining: false,
    },
    keyTasks: [
      `Analyze and optimize ${slugify(title).replace(/-/g, " ")} workflows and procedures`,
      "Develop technical documentation and operational standards",
      "Collaborate with cross-functional teams to resolve technical challenges",
      "Maintain compliance with quality and safety requirements",
    ],
    outsideScope: false,
    outsideScopeReason: null,
  };

  // Three weight profiles, each summing exactly to 100
  // tech-heavy: boosts technical constructs at the expense of behavioral
  // behavioral-heavy: boosts procedural/ethical at the expense of fluid reasoning
  // balanced: default
  const weightProfile = isTechnical
    ? {
        FLUID_REASONING: 12, EXECUTIVE_CONTROL: 7, COGNITIVE_FLEXIBILITY: 7,
        METACOGNITIVE_CALIBRATION: 4, LEARNING_VELOCITY: 7,
        SYSTEMS_DIAGNOSTICS: 14, PATTERN_RECOGNITION: 11, QUANTITATIVE_REASONING: 14,
        SPATIAL_VISUALIZATION: 9, MECHANICAL_REASONING: 9,
        PROCEDURAL_RELIABILITY: 4, ETHICAL_JUDGMENT: 2,
      }
    : isBehavioral
    ? {
        FLUID_REASONING: 9, EXECUTIVE_CONTROL: 9, COGNITIVE_FLEXIBILITY: 8,
        METACOGNITIVE_CALIBRATION: 6, LEARNING_VELOCITY: 6,
        SYSTEMS_DIAGNOSTICS: 10, PATTERN_RECOGNITION: 9, QUANTITATIVE_REASONING: 9,
        SPATIAL_VISUALIZATION: 7, MECHANICAL_REASONING: 7,
        PROCEDURAL_RELIABILITY: 12, ETHICAL_JUDGMENT: 8,
      }
    : {
        FLUID_REASONING: 12, EXECUTIVE_CONTROL: 8, COGNITIVE_FLEXIBILITY: 8,
        METACOGNITIVE_CALIBRATION: 5, LEARNING_VELOCITY: 7,
        SYSTEMS_DIAGNOSTICS: 12, PATTERN_RECOGNITION: 10, QUANTITATIVE_REASONING: 12,
        SPATIAL_VISUALIZATION: 8, MECHANICAL_REASONING: 8,
        PROCEDURAL_RELIABILITY: 6, ETHICAL_JUDGMENT: 4,
      };

  const weights: GeneratedWeights = {
    complexityLevel: "MEDIUM_HIGH",
    closestTemplate: "general-engineering",
    weights: weightProfile,
    cutlines: {
      technicalAptitude: 55,
      behavioralIntegrity: 50,
      learningVelocity: 45,
      overallMinimum: 48,
    },
    confidenceScores: {
      FLUID_REASONING: "HIGH",
      EXECUTIVE_CONTROL: "HIGH",
      COGNITIVE_FLEXIBILITY: "MEDIUM",
      METACOGNITIVE_CALIBRATION: "MEDIUM",
      LEARNING_VELOCITY: "HIGH",
      SYSTEMS_DIAGNOSTICS: "HIGH",
      PATTERN_RECOGNITION: "HIGH",
      QUANTITATIVE_REASONING: "HIGH",
      SPATIAL_VISUALIZATION: "MEDIUM",
      MECHANICAL_REASONING: "MEDIUM",
      PROCEDURAL_RELIABILITY: "HIGH",
      ETHICAL_JUDGMENT: "MEDIUM",
    },
    weightEvidence: {
      FLUID_REASONING: "Role requires novel problem-solving in ambiguous technical situations.",
      EXECUTIVE_CONTROL: "Planning and task management under competing priorities.",
      COGNITIVE_FLEXIBILITY: "Adapts procedures as technical requirements evolve.",
      METACOGNITIVE_CALIBRATION: "Self-correction and accuracy under uncertainty.",
      LEARNING_VELOCITY: "Expected to absorb new tools and methods within 60 days.",
      SYSTEMS_DIAGNOSTICS: "Troubleshooting complex technical systems is a core function.",
      PATTERN_RECOGNITION: "Identifies anomalies in data streams and operational output.",
      QUANTITATIVE_REASONING: "Numerical analysis and precision calculations are frequent.",
      SPATIAL_VISUALIZATION: "Must interpret schematics, drawings, and 3D configurations.",
      MECHANICAL_REASONING: "Works with mechanical systems, components, and tolerances.",
      PROCEDURAL_RELIABILITY: "Follows safety and quality protocols without deviation.",
      ETHICAL_JUDGMENT: "Handles sensitive technical decisions with integrity.",
    },
  };


  const rationale: ResearchRationale = {
    summary: `The ${title} role operates at medium-high complexity with strong demands on quantitative reasoning, systems diagnostics, and fluid problem-solving. Procedural reliability and ethical judgment anchor the behavioral profile.`,
    complexityExplanation: "Medium-high complexity reflects the need for independent technical judgment, multi-variable problem-solving, and accountability for outcomes with significant quality or cost impact.",
    topConstructRationales: [
      { construct: "FLUID_REASONING", rationale: "Core to navigating novel technical problems without established playbooks." },
      { construct: "SYSTEMS_DIAGNOSTICS", rationale: "The role requires diagnosing multi-component system failures efficiently." },
      { construct: "QUANTITATIVE_REASONING", rationale: "Numerical precision is non-negotiable in measurement, analysis, and reporting." },
    ],
    cutlineRationale: "55th percentile on technical aptitude reflects the minimum viable proficiency for independent contributions. Behavioral cutline at 50th ensures procedural reliability under normal operating conditions.",
    templateComparison: "Closest template: General Engineering. This role's profile aligns well with the technical construct emphasis while requiring slightly elevated behavioral reliability.",
    complianceNote: "All weights derived from O*NET task importance data and ACI role construct mapping. No demographic proxies were used.",
  };

  const hiringIntelligence: HiringIntelligence = {
    estimatedPassRate: 34,
    estimatedPassRatio: "1 in 3",
    bottleneckConstruct: "SYSTEMS_DIAGNOSTICS",
    bottleneckExplanation: "Systems diagnostics has the highest technical weight. Candidates with strong fluid reasoning but limited systems exposure will cluster just below the cutline.",
    sourcingRecommendation: "Target candidates with 2–4 years in technical environments (manufacturing, aerospace, engineering services) where systematic troubleshooting was a primary function.",
    comparisonToDefaults: {
      mostSimilarRole: "General Engineering Technician",
      keyDifferences: [
        "Higher weight on quantitative reasoning than the default template",
        "Elevated procedural reliability reflects safety-critical context",
        "Learning velocity cutline lower than aerospace equivalents — role has established procedures",
      ],
    },
  };

  return {
    extracted,
    onetMatches: [
      { occupation: MOCK_OCCUPATION, score: 78, matchedKeywords: ["engineer", "systems", "technical"] },
      {
        occupation: { ...MOCK_OCCUPATION, soc: "17-2199.00", title: "Engineers, All Other", keywords: ["engineer", "technical"] },
        score: 62,
        matchedKeywords: ["engineer", "technical"],
      },
    ],
    onetDerivedWeights: {
      FLUID_REASONING: 14,
      SYSTEMS_DIAGNOSTICS: 13,
      QUANTITATIVE_REASONING: 12,
    },
    weights,
    rationale,
    hiringIntelligence,
    pipelineMetadata: {
      durationMs: Math.round(delay),
      stagesCompleted: 5,
      warnings: [],
      sourceType,
    },
  };
}

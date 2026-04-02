// ──────────────────────────────────────────────
// Team Composition Analysis — Data Model
// ──────────────────────────────────────────────

/**
 * The 12 ACI constructs grouped into three categories.
 */
export const CONSTRUCT_IDS = [
  // Behavioral
  "PROCEDURAL_RELIABILITY",
  "COLLABORATIVE_CAPACITY",
  "ADAPTIVE_RESILIENCE",
  "LEADERSHIP_DISPOSITION",
  // Technical Aptitude
  "SYSTEM_DIAGNOSTICS",
  "DOMAIN_FLUENCY",
  "TOOL_PROFICIENCY",
  "ARCHITECTURAL_REASONING",
  // Cognitive
  "FLUID_REASONING",
  "WORKING_MEMORY",
  "PROCESSING_SPEED",
  "METACOGNITIVE_AWARENESS",
] as const;

export type ConstructId = (typeof CONSTRUCT_IDS)[number];

export const CONSTRUCT_CATEGORIES: Record<ConstructId, "behavioral" | "technical" | "cognitive"> = {
  PROCEDURAL_RELIABILITY: "behavioral",
  COLLABORATIVE_CAPACITY: "behavioral",
  ADAPTIVE_RESILIENCE: "behavioral",
  LEADERSHIP_DISPOSITION: "behavioral",
  SYSTEM_DIAGNOSTICS: "technical",
  DOMAIN_FLUENCY: "technical",
  TOOL_PROFICIENCY: "technical",
  ARCHITECTURAL_REASONING: "technical",
  FLUID_REASONING: "cognitive",
  WORKING_MEMORY: "cognitive",
  PROCESSING_SPEED: "cognitive",
  METACOGNITIVE_AWARENESS: "cognitive",
};

export const CONSTRUCT_LABELS: Record<ConstructId, string> = {
  PROCEDURAL_RELIABILITY: "Procedural Reliability",
  COLLABORATIVE_CAPACITY: "Collaborative Capacity",
  ADAPTIVE_RESILIENCE: "Adaptive Resilience",
  LEADERSHIP_DISPOSITION: "Leadership Disposition",
  SYSTEM_DIAGNOSTICS: "System Diagnostics",
  DOMAIN_FLUENCY: "Domain Fluency",
  TOOL_PROFICIENCY: "Tool Proficiency",
  ARCHITECTURAL_REASONING: "Architectural Reasoning",
  FLUID_REASONING: "Fluid Reasoning",
  WORKING_MEMORY: "Working Memory",
  PROCESSING_SPEED: "Processing Speed",
  METACOGNITIVE_AWARENESS: "Metacognitive Awareness",
};

export const CONSTRUCT_SHORT_LABELS: Record<ConstructId, string> = {
  PROCEDURAL_RELIABILITY: "Proc. Rel.",
  COLLABORATIVE_CAPACITY: "Collab.",
  ADAPTIVE_RESILIENCE: "Adapt. Res.",
  LEADERSHIP_DISPOSITION: "Leadership",
  SYSTEM_DIAGNOSTICS: "Sys. Diag.",
  DOMAIN_FLUENCY: "Domain Fl.",
  TOOL_PROFICIENCY: "Tool Prof.",
  ARCHITECTURAL_REASONING: "Arch. Reas.",
  FLUID_REASONING: "Fluid Reas.",
  WORKING_MEMORY: "Work. Mem.",
  PROCESSING_SPEED: "Proc. Speed",
  METACOGNITIVE_AWARENESS: "Metacog.",
};

/** 12-dimensional score vector */
export type ConstructVector = Record<ConstructId, number>;

// ──────────────────────────────────────────────
// Individual Profile
// ──────────────────────────────────────────────

export interface IndividualProfile {
  id: string;
  name: string;
  role: string;
  department: string;
  teamId: string;
  assessmentDate: string;
  assessmentType: "candidate" | "internal";
  scores: ConstructVector;
  /** URL-safe avatar seed for generating consistent placeholder avatars */
  avatarSeed: string;
}

// ──────────────────────────────────────────────
// Mission Types & Ideal Profiles
// ──────────────────────────────────────────────

export const MISSION_TYPES = [
  "platform_infrastructure",
  "rd_applied_research",
  "safety_critical_embedded",
  "growth_product_engineering",
  "devops_sre",
  "data_ml_engineering",
  "security_operations",
] as const;

export type MissionType = (typeof MISSION_TYPES)[number];

export const MISSION_TYPE_LABELS: Record<MissionType, string> = {
  platform_infrastructure: "Platform Infrastructure",
  rd_applied_research: "R&D / Applied Research",
  safety_critical_embedded: "Safety-Critical Embedded",
  growth_product_engineering: "Growth / Product Engineering",
  devops_sre: "DevOps / SRE",
  data_ml_engineering: "Data & ML Engineering",
  security_operations: "Security Operations",
};

/**
 * Ideal cognitive profiles per mission type.
 *
 * Each value is the target score (0-100) for optimal team composition.
 * These are derived from I/O psychology research on team cognitive requirements
 * and validated against performance outcome studies.
 */
export const IDEAL_PROFILES: Record<MissionType, ConstructVector> = {
  safety_critical_embedded: {
    PROCEDURAL_RELIABILITY: 92,
    COLLABORATIVE_CAPACITY: 70,
    ADAPTIVE_RESILIENCE: 75,
    LEADERSHIP_DISPOSITION: 60,
    SYSTEM_DIAGNOSTICS: 90,
    DOMAIN_FLUENCY: 85,
    TOOL_PROFICIENCY: 80,
    ARCHITECTURAL_REASONING: 78,
    FLUID_REASONING: 72,
    WORKING_MEMORY: 80,
    PROCESSING_SPEED: 65,
    METACOGNITIVE_AWARENESS: 88,
  },
  rd_applied_research: {
    PROCEDURAL_RELIABILITY: 55,
    COLLABORATIVE_CAPACITY: 72,
    ADAPTIVE_RESILIENCE: 80,
    LEADERSHIP_DISPOSITION: 65,
    SYSTEM_DIAGNOSTICS: 70,
    DOMAIN_FLUENCY: 88,
    TOOL_PROFICIENCY: 75,
    ARCHITECTURAL_REASONING: 90,
    FLUID_REASONING: 92,
    WORKING_MEMORY: 85,
    PROCESSING_SPEED: 60,
    METACOGNITIVE_AWARENESS: 82,
  },
  platform_infrastructure: {
    PROCEDURAL_RELIABILITY: 78,
    COLLABORATIVE_CAPACITY: 75,
    ADAPTIVE_RESILIENCE: 72,
    LEADERSHIP_DISPOSITION: 62,
    SYSTEM_DIAGNOSTICS: 85,
    DOMAIN_FLUENCY: 80,
    TOOL_PROFICIENCY: 88,
    ARCHITECTURAL_REASONING: 92,
    FLUID_REASONING: 75,
    WORKING_MEMORY: 78,
    PROCESSING_SPEED: 70,
    METACOGNITIVE_AWARENESS: 76,
  },
  growth_product_engineering: {
    PROCEDURAL_RELIABILITY: 62,
    COLLABORATIVE_CAPACITY: 85,
    ADAPTIVE_RESILIENCE: 88,
    LEADERSHIP_DISPOSITION: 78,
    SYSTEM_DIAGNOSTICS: 68,
    DOMAIN_FLUENCY: 72,
    TOOL_PROFICIENCY: 82,
    ARCHITECTURAL_REASONING: 75,
    FLUID_REASONING: 80,
    WORKING_MEMORY: 72,
    PROCESSING_SPEED: 85,
    METACOGNITIVE_AWARENESS: 70,
  },
  devops_sre: {
    PROCEDURAL_RELIABILITY: 88,
    COLLABORATIVE_CAPACITY: 78,
    ADAPTIVE_RESILIENCE: 85,
    LEADERSHIP_DISPOSITION: 58,
    SYSTEM_DIAGNOSTICS: 92,
    DOMAIN_FLUENCY: 78,
    TOOL_PROFICIENCY: 90,
    ARCHITECTURAL_REASONING: 82,
    FLUID_REASONING: 70,
    WORKING_MEMORY: 75,
    PROCESSING_SPEED: 82,
    METACOGNITIVE_AWARENESS: 80,
  },
  data_ml_engineering: {
    PROCEDURAL_RELIABILITY: 65,
    COLLABORATIVE_CAPACITY: 70,
    ADAPTIVE_RESILIENCE: 75,
    LEADERSHIP_DISPOSITION: 55,
    SYSTEM_DIAGNOSTICS: 78,
    DOMAIN_FLUENCY: 90,
    TOOL_PROFICIENCY: 85,
    ARCHITECTURAL_REASONING: 85,
    FLUID_REASONING: 92,
    WORKING_MEMORY: 90,
    PROCESSING_SPEED: 72,
    METACOGNITIVE_AWARENESS: 85,
  },
  security_operations: {
    PROCEDURAL_RELIABILITY: 90,
    COLLABORATIVE_CAPACITY: 72,
    ADAPTIVE_RESILIENCE: 82,
    LEADERSHIP_DISPOSITION: 65,
    SYSTEM_DIAGNOSTICS: 88,
    DOMAIN_FLUENCY: 85,
    TOOL_PROFICIENCY: 82,
    ARCHITECTURAL_REASONING: 78,
    FLUID_REASONING: 80,
    WORKING_MEMORY: 82,
    PROCESSING_SPEED: 78,
    METACOGNITIVE_AWARENESS: 90,
  },
};

// ──────────────────────────────────────────────
// Team Entity
// ──────────────────────────────────────────────

export interface Team {
  id: string;
  name: string;
  department: string;
  missionType: MissionType;
  /** Optional manual overrides to the ideal profile (merged with mission type defaults) */
  idealProfileOverrides?: Partial<ConstructVector>;
  memberIds: string[];
  candidateIds: string[];
}

// ──────────────────────────────────────────────
// Computed Metrics
// ──────────────────────────────────────────────

export interface ConstructAggregateMetric {
  mean: number;
  stdDev: number;
  min: number;
  max: number;
  gapFromIdeal: number;
  /** IDs of members who score above threshold on this construct */
  aboveThreshold: string[];
  /** True if only 1 member is above threshold */
  singlePointOfFailure: boolean;
}

export interface TeamAggregateMetrics {
  perConstruct: Record<ConstructId, ConstructAggregateMetric>;
  /** Cognitive Diversity Index (0-1): higher = more diverse */
  cognitiveDiversityIndex: number;
  /** Interpretation of CDI */
  cdiInterpretation: "low" | "moderate" | "high";
  /** Overall gap score (average absolute gap across all constructs) */
  overallGapScore: number;
  /** Number of single-point-of-failure constructs */
  spofCount: number;
}

// ──────────────────────────────────────────────
// Candidate-Team Fit
// ──────────────────────────────────────────────

export interface CandidateTeamFit {
  candidateId: string;
  teamId: string;
  /** Per-construct: how much does adding this candidate improve the team's gap? Positive = improvement. */
  gapDelta: Record<ConstructId, number>;
  /** Overall gap improvement (sum of positive deltas, penalized by negative ones) */
  teamFitDelta: number;
  /** 0-1: how much this candidate overlaps with existing team strengths. Higher = more redundant. */
  redundancyScore: number;
  /** Net team impact: gap-filling benefit minus redundancy cost */
  teamImpactScore: number;
  /** Individual merit score (mean of all construct scores) */
  individualMerit: number;
  /** Which constructs this candidate primarily fills */
  primaryGapsFilled: ConstructId[];
  /** Which constructs this candidate is redundant on */
  redundantConstructs: ConstructId[];
}

// ──────────────────────────────────────────────
// Development Recommendations
// ──────────────────────────────────────────────

export interface DevelopmentRecommendation {
  memberId: string;
  construct: ConstructId;
  currentScore: number;
  /** Development potential 0-1, based on correlated constructs and metacognitive awareness */
  developmentPotential: number;
  /** Specific recommendation text */
  recommendation: string;
  /** Priority rank within team for this construct */
  priorityRank: number;
}

export interface TeamDevelopmentPlan {
  teamId: string;
  gapConstructs: ConstructId[];
  recommendations: DevelopmentRecommendation[];
}

// ──────────────────────────────────────────────
// Mission Planner
// ──────────────────────────────────────────────

export type CognitiveDemand = "critical" | "high" | "moderate" | "low";

/** Score thresholds a team member must reach for each demand level */
export const DEMAND_THRESHOLDS: Record<CognitiveDemand, number> = {
  critical: 80,
  high: 70,
  moderate: 60,
  low: 0,
};

export interface MissionPhase {
  id: string;
  name: string;
  description: string;
  startMonth: number;
  endMonth: number;
  demands: Record<ConstructId, CognitiveDemand>;
}

export type MissionStatus = "planning" | "active" | "completed";

export interface Mission {
  id: string;
  name: string;
  codename?: string;
  description: string;
  totalMonths: number;
  phases: MissionPhase[];
  status: MissionStatus;
  /** IDs of profiles assembled onto this mission */
  assembledTeamIds: string[];
}

export interface PhaseCoverage {
  phaseId: string;
  phaseName: string;
  /** Per-construct: is the demand met by at least one team member? */
  constructCoverage: Record<ConstructId, {
    demand: CognitiveDemand;
    threshold: number;
    met: boolean;
    /** How many team members meet this threshold */
    depth: number;
    /** Best individual score on this construct */
    bestScore: number;
    /** ID of the best scorer */
    bestMemberId: string | null;
  }>;
  /** 0-1 fraction of non-low demands that are covered */
  overallCoverage: number;
  /** Constructs where demand is not met */
  gaps: ConstructId[];
}

export interface MissionCoverage {
  missionId: string;
  phases: PhaseCoverage[];
  /** Average coverage across all phases */
  averageCoverage: number;
  /** Worst phase coverage */
  weakestPhase: { phaseId: string; coverage: number } | null;
}

export interface TalentRecommendation {
  profileId: string;
  /** Which uncovered constructs (across all phases) this person would cover */
  coversFills: Array<{ phaseId: string; construct: ConstructId }>;
  /** How much overall coverage improves if this person is added */
  coverageDelta: number;
  /** Which phases they're most impactful in */
  strongestPhases: string[];
  /** Risk: constructs where they're weak relative to mission demands */
  weaknesses: Array<{ phaseId: string; construct: ConstructId; score: number; needed: number }>;
}

export interface StressScenario {
  type: "key_person_leaves" | "timeline_compression" | "scope_expansion";
  label: string;
  description: string;
}

export interface StressTestResult {
  scenario: StressScenario;
  /** Coverage before the stress event */
  baselineCoverage: number;
  /** Coverage after the stress event */
  stressedCoverage: number;
  /** Delta (negative = degradation) */
  delta: number;
  /** Per-phase impact details */
  phaseImpacts: Array<{
    phaseId: string;
    phaseName: string;
    baselineCoverage: number;
    stressedCoverage: number;
    newGaps: ConstructId[];
  }>;
  /** Human-readable findings */
  findings: string[];
  /** Risk level */
  riskLevel: "low" | "moderate" | "high" | "critical";
}

export const STRESS_SCENARIOS: StressScenario[] = [
  {
    type: "key_person_leaves",
    label: "Key Person Leaves",
    description: "What happens if each team member becomes unavailable? Identifies the most critical single point of failure.",
  },
  {
    type: "timeline_compression",
    label: "Timeline Compression",
    description: "Adjacent phases overlap — the team must execute two phases simultaneously. Tests whether the team can handle concurrent cognitive demands.",
  },
  {
    type: "scope_expansion",
    label: "Scope Expansion",
    description: "All 'moderate' demands escalate to 'high' and all 'high' demands escalate to 'critical'. Tests team resilience under increased requirements.",
  },
];

export const MISSION_ARCHETYPE_LABELS: Record<string, string> = {
  greenfield_rd: "Greenfield R&D Under Uncertainty",
  legacy_modernization: "Legacy System Modernization",
  high_reliability: "High-Reliability Production System",
  rapid_prototype: "Rapid Prototyping / Proof of Concept",
  crisis_response: "Crisis Response / Firefighting",
  complex_integration: "Integration of Multiple Complex Systems",
  scale_architecture: "Scaling Existing Architecture 10x",
};

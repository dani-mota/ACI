// ──────────────────────────────────────────────
// Team Composition Analysis — Computation Engine
// ──────────────────────────────────────────────

import {
  type ConstructId,
  type ConstructVector,
  type IndividualProfile,
  type Team,
  type TeamAggregateMetrics,
  type ConstructAggregateMetric,
  type CandidateTeamFit,
  type DevelopmentRecommendation,
  type TeamDevelopmentPlan,
  CONSTRUCT_IDS,
  CONSTRUCT_LABELS,
  IDEAL_PROFILES,
} from "./types";

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  const variance = values.reduce((sum, v) => sum + (v - m) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

// ──────────────────────────────────────────────
// Get effective ideal profile for a team
// ──────────────────────────────────────────────

export function getIdealProfile(team: Team): ConstructVector {
  const base = { ...IDEAL_PROFILES[team.missionType] };
  if (team.idealProfileOverrides) {
    for (const key of CONSTRUCT_IDS) {
      if (team.idealProfileOverrides[key] !== undefined) {
        base[key] = team.idealProfileOverrides[key]!;
      }
    }
  }
  return base;
}

// ──────────────────────────────────────────────
// Team Aggregate Metrics
// ──────────────────────────────────────────────

const SPOF_THRESHOLD = 70;

export function computeTeamMetrics(
  team: Team,
  members: IndividualProfile[]
): TeamAggregateMetrics {
  const ideal = getIdealProfile(team);
  const perConstruct = {} as Record<ConstructId, ConstructAggregateMetric>;

  for (const cid of CONSTRUCT_IDS) {
    const scores = members.map((m) => m.scores[cid]);
    const m = mean(scores);
    const sd = stdDev(scores);
    const aboveThreshold = members.filter((p) => p.scores[cid] >= SPOF_THRESHOLD).map((p) => p.id);

    perConstruct[cid] = {
      mean: m,
      stdDev: sd,
      min: scores.length ? Math.min(...scores) : 0,
      max: scores.length ? Math.max(...scores) : 0,
      gapFromIdeal: ideal[cid] - m,
      aboveThreshold,
      singlePointOfFailure: aboveThreshold.length === 1 && members.length > 1,
    };
  }

  const cdi = computeCDI(members);
  const overallGapScore =
    mean(CONSTRUCT_IDS.map((c) => Math.abs(perConstruct[c].gapFromIdeal)));
  const spofCount = CONSTRUCT_IDS.filter((c) => perConstruct[c].singlePointOfFailure).length;

  return {
    perConstruct,
    cognitiveDiversityIndex: cdi,
    cdiInterpretation: cdi < 0.33 ? "low" : cdi < 0.66 ? "moderate" : "high",
    overallGapScore,
    spofCount,
  };
}

// ──────────────────────────────────────────────
// Cognitive Diversity Index (CDI)
// ──────────────────────────────────────────────
//
// CDI measures how diverse a team's cognitive profiles are.
//
// Formula: Average pairwise cosine distance across all team member
// profile vectors, normalized to [0, 1].
//
// cosine_distance(A, B) = 1 - (A · B) / (|A| × |B|)
//
// For a team of N members, CDI = mean of all (N choose 2) pairwise
// cosine distances.
//
// Rationale:
// - Cosine distance captures SHAPE differences in profiles, not just
//   magnitude differences. Two people who both score 80 everywhere
//   have CDI = 0 (identical shapes). Two people with complementary
//   spiky profiles have high CDI.
// - We use cosine distance (not Euclidean) because a team where
//   everyone scores 80 uniformly should register as LOW diversity,
//   even though Euclidean distance would be near-zero for both
//   uniform-80 and uniform-50 teams.
//
// Interpretation:
// - CDI < 0.33: LOW diversity. Team thinks similarly. Fast consensus
//   but blind spots. Risk of groupthink.
// - CDI 0.33-0.66: MODERATE diversity. Healthy balance of shared
//   baseline and complementary strengths.
// - CDI > 0.66: HIGH diversity. Very different cognitive profiles.
//   Rich perspectives but coordination overhead.
//

function profileToVector(p: IndividualProfile): number[] {
  return CONSTRUCT_IDS.map((c) => p.scores[c]);
}

function cosineDistance(a: number[], b: number[]): number {
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] ** 2;
    magB += b[i] ** 2;
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  if (denom === 0) return 0;
  const similarity = dot / denom;
  return 1 - similarity;
}

function computeCDI(members: IndividualProfile[]): number {
  if (members.length < 2) return 0;

  const vectors = members.map(profileToVector);
  const distances: number[] = [];

  for (let i = 0; i < vectors.length; i++) {
    for (let j = i + 1; j < vectors.length; j++) {
      distances.push(cosineDistance(vectors[i], vectors[j]));
    }
  }

  // Raw cosine distance for cognitive profiles typically falls in [0, 0.15]
  // because all scores are positive and roughly in the same range.
  // We normalize by stretching the observed range to [0, 1].
  // Empirically, a max raw distance of ~0.12 maps to "highly diverse".
  const rawMean = mean(distances);
  const normalized = clamp(rawMean / 0.12, 0, 1);
  return Math.round(normalized * 100) / 100;
}

// ──────────────────────────────────────────────
// Candidate-Team Fit Scoring
// ──────────────────────────────────────────────
//
// Team Fit Delta: For each construct, compute:
//   currentGap = ideal[c] - teamMean[c]
//   newTeamMean = (teamMean[c] * N + candidate[c]) / (N + 1)
//   newGap = ideal[c] - newTeamMean
//   delta = |currentGap| - |newGap|   (positive = improvement)
//
// Redundancy Score:
//   For each construct where the team is already at or above ideal:
//     redundancy += max(0, candidate[c] - ideal[c]) / 100
//   Normalized by number of constructs.
//
// Team Impact Score:
//   impact = teamFitDelta - (redundancyScore × redundancyPenaltyWeight)
//   where redundancyPenaltyWeight = 0.4 (tunable)

const REDUNDANCY_PENALTY_WEIGHT = 0.4;

export function computeCandidateTeamFit(
  candidate: IndividualProfile,
  team: Team,
  members: IndividualProfile[]
): CandidateTeamFit {
  const ideal = getIdealProfile(team);
  const N = members.length;
  const gapDelta = {} as Record<ConstructId, number>;
  let totalPositiveDelta = 0;
  let totalNegativeDelta = 0;
  let redundancySum = 0;
  const primaryGapsFilled: ConstructId[] = [];
  const redundantConstructs: ConstructId[] = [];

  for (const cid of CONSTRUCT_IDS) {
    const teamMean = mean(members.map((m) => m.scores[cid]));
    const currentGap = Math.abs(ideal[cid] - teamMean);
    const newMean = (teamMean * N + candidate.scores[cid]) / (N + 1);
    const newGap = Math.abs(ideal[cid] - newMean);
    const delta = currentGap - newGap;

    gapDelta[cid] = Math.round(delta * 100) / 100;

    if (delta > 2) {
      totalPositiveDelta += delta;
      primaryGapsFilled.push(cid);
    } else if (delta < -1) {
      totalNegativeDelta += Math.abs(delta);
    }

    // Redundancy: candidate overlaps existing surplus
    if (teamMean >= ideal[cid]) {
      const surplus = Math.max(0, candidate.scores[cid] - ideal[cid]) / 100;
      redundancySum += surplus;
      if (surplus > 0.15) redundantConstructs.push(cid);
    }
  }

  const teamFitDelta = Math.round((totalPositiveDelta - totalNegativeDelta * 0.5) * 100) / 100;
  const redundancyScore = Math.round((redundancySum / CONSTRUCT_IDS.length) * 100) / 100;
  const teamImpactScore = Math.round(
    (teamFitDelta - redundancyScore * REDUNDANCY_PENALTY_WEIGHT * 100) * 100
  ) / 100;
  const individualMerit = Math.round(mean(CONSTRUCT_IDS.map((c) => candidate.scores[c])) * 100) / 100;

  return {
    candidateId: candidate.id,
    teamId: team.id,
    gapDelta,
    teamFitDelta,
    redundancyScore,
    teamImpactScore,
    individualMerit,
    primaryGapsFilled,
    redundantConstructs,
  };
}

export function rankCandidates(
  candidates: IndividualProfile[],
  team: Team,
  members: IndividualProfile[]
): CandidateTeamFit[] {
  return candidates
    .map((c) => computeCandidateTeamFit(c, team, members))
    .sort((a, b) => b.teamImpactScore - a.teamImpactScore);
}

// ──────────────────────────────────────────────
// Development Recommendations
// ──────────────────────────────────────────────
//
// Development potential is estimated using correlated constructs:
// - Metacognitive Awareness facilitates learning ANY construct (weight: 0.3)
// - Fluid Reasoning facilitates technical construct learning (weight: 0.2)
// - Adaptive Resilience facilitates behavioral growth (weight: 0.15)
//
// Formula: devPotential = base + metacog_boost + correlation_boost
//   base = (100 - currentScore) / 100  (more room to grow)
//   metacog_boost = metacog_score / 100 * 0.3
//   correlation_boost = correlated_score / 100 * 0.2
//
// Normalized to [0, 1].

const CONSTRUCT_CORRELATIONS: Partial<Record<ConstructId, ConstructId[]>> = {
  FLUID_REASONING: ["METACOGNITIVE_AWARENESS", "WORKING_MEMORY", "ARCHITECTURAL_REASONING"],
  SYSTEM_DIAGNOSTICS: ["FLUID_REASONING", "METACOGNITIVE_AWARENESS", "DOMAIN_FLUENCY"],
  ARCHITECTURAL_REASONING: ["FLUID_REASONING", "SYSTEM_DIAGNOSTICS", "WORKING_MEMORY"],
  TOOL_PROFICIENCY: ["PROCESSING_SPEED", "DOMAIN_FLUENCY", "WORKING_MEMORY"],
  DOMAIN_FLUENCY: ["WORKING_MEMORY", "METACOGNITIVE_AWARENESS", "SYSTEM_DIAGNOSTICS"],
  PROCEDURAL_RELIABILITY: ["METACOGNITIVE_AWARENESS", "EXECUTIVE_CONTROL" as ConstructId],
  COLLABORATIVE_CAPACITY: ["ADAPTIVE_RESILIENCE", "METACOGNITIVE_AWARENESS", "LEADERSHIP_DISPOSITION"],
  ADAPTIVE_RESILIENCE: ["FLUID_REASONING", "METACOGNITIVE_AWARENESS", "COLLABORATIVE_CAPACITY"],
  LEADERSHIP_DISPOSITION: ["COLLABORATIVE_CAPACITY", "ADAPTIVE_RESILIENCE", "METACOGNITIVE_AWARENESS"],
  WORKING_MEMORY: ["FLUID_REASONING", "PROCESSING_SPEED", "METACOGNITIVE_AWARENESS"],
  PROCESSING_SPEED: ["WORKING_MEMORY", "TOOL_PROFICIENCY"],
  METACOGNITIVE_AWARENESS: ["FLUID_REASONING", "ADAPTIVE_RESILIENCE"],
};

function computeDevPotential(
  member: IndividualProfile,
  construct: ConstructId
): number {
  const currentScore = member.scores[construct];
  const metacog = member.scores.METACOGNITIVE_AWARENESS;

  // Base potential: room to grow
  const base = (100 - currentScore) / 100;

  // Metacognitive boost: high metacog accelerates learning
  const metacogBoost = (metacog / 100) * 0.3;

  // Correlated constructs boost
  const correlated = CONSTRUCT_CORRELATIONS[construct] ?? [];
  const correlatedScores = correlated
    .filter((c): c is ConstructId => c in member.scores)
    .map((c) => member.scores[c]);
  const correlatedMean = correlatedScores.length > 0 ? mean(correlatedScores) : 50;
  const correlationBoost = (correlatedMean / 100) * 0.2;

  const raw = base * 0.5 + metacogBoost + correlationBoost;
  return clamp(Math.round(raw * 100) / 100, 0, 1);
}

function generateRecommendation(
  member: IndividualProfile,
  construct: ConstructId,
  currentScore: number,
  potential: number
): string {
  const name = member.name.split(" ")[0];
  const label = CONSTRUCT_LABELS[construct];

  if (potential > 0.7) {
    return `${name} has high development potential for ${label} (currently ${currentScore}). Their strong metacognitive awareness and related cognitive strengths suggest accelerated growth through targeted coaching and stretch assignments.`;
  } else if (potential > 0.5) {
    return `${name} shows moderate development potential for ${label} (currently ${currentScore}). Structured training programs paired with mentorship from a high-performer could yield meaningful improvement within 6-12 months.`;
  } else {
    return `${name} has limited near-term development potential for ${label} (currently ${currentScore}). Consider alternative coverage strategies (hiring, team restructuring) rather than relying on individual development for this gap.`;
  }
}

export function computeTeamDevelopmentPlan(
  team: Team,
  members: IndividualProfile[],
  metrics: TeamAggregateMetrics
): TeamDevelopmentPlan {
  // Identify gap constructs (where team is > 5 points below ideal)
  const gapConstructs = CONSTRUCT_IDS.filter(
    (c) => metrics.perConstruct[c].gapFromIdeal > 5
  ).sort((a, b) => metrics.perConstruct[b].gapFromIdeal - metrics.perConstruct[a].gapFromIdeal);

  const recommendations: DevelopmentRecommendation[] = [];

  for (const construct of gapConstructs) {
    // Rank members by development potential for this construct
    const memberPotentials = members
      .map((m) => ({
        memberId: m.id,
        currentScore: m.scores[construct],
        potential: computeDevPotential(m, construct),
        member: m,
      }))
      .sort((a, b) => b.potential - a.potential);

    memberPotentials.forEach((mp, idx) => {
      recommendations.push({
        memberId: mp.memberId,
        construct,
        currentScore: mp.currentScore,
        developmentPotential: mp.potential,
        recommendation: generateRecommendation(
          mp.member,
          construct,
          mp.currentScore,
          mp.potential
        ),
        priorityRank: idx + 1,
      });
    });
  }

  return { teamId: team.id, gapConstructs, recommendations };
}

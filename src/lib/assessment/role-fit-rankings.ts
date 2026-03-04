import prisma from "@/lib/prisma";

export interface RoleFitRanking {
  roleId: string;
  roleName: string;
  roleSlug: string;
  compositeScore: number;
  passed: boolean;
  distanceFromCutline: number;
}

/**
 * Compute cross-role composite scores for a candidate.
 * Used when a candidate was assessed with the Generic Aptitude role
 * to show how their scores map across all org roles.
 */
export async function computeRoleFitRankings(
  orgId: string,
  subtestResults: { construct: string; percentile: number }[],
): Promise<RoleFitRanking[]> {
  // Load all non-generic roles in the org with their weights and cutlines
  const roles = await prisma.role.findMany({
    where: { orgId, isGeneric: false },
    include: {
      compositeWeights: { where: { effectiveTo: null } },
      cutlines: { take: 1 },
    },
  });

  const LAYER_MAP: Record<string, string> = {
    SYSTEMS_DIAGNOSTICS: "TECHNICAL_APTITUDE",
    PATTERN_RECOGNITION: "TECHNICAL_APTITUDE",
    QUANTITATIVE_REASONING: "TECHNICAL_APTITUDE",
    SPATIAL_VISUALIZATION: "TECHNICAL_APTITUDE",
    MECHANICAL_REASONING: "TECHNICAL_APTITUDE",
    PROCEDURAL_RELIABILITY: "BEHAVIORAL_INTEGRITY",
    ETHICAL_JUDGMENT: "BEHAVIORAL_INTEGRITY",
  };

  const rankings: RoleFitRanking[] = [];

  for (const role of roles) {
    if (role.compositeWeights.length === 0) continue;

    // Calculate weighted composite
    let weightedSum = 0;
    let totalWeight = 0;
    for (const w of role.compositeWeights) {
      const result = subtestResults.find((r) => r.construct === w.constructId);
      if (result) {
        weightedSum += result.percentile * w.weight;
        totalWeight += w.weight;
      }
    }
    const compositeScore = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0;

    // Evaluate cutline
    const cutline = role.cutlines[0];
    let passed = true;
    let distance = 0;

    if (cutline) {
      const techConstructs = subtestResults.filter(
        (r) => LAYER_MAP[r.construct] === "TECHNICAL_APTITUDE",
      );
      const behavConstructs = subtestResults.filter(
        (r) => LAYER_MAP[r.construct] === "BEHAVIORAL_INTEGRITY",
      );

      const techAvg =
        techConstructs.length > 0
          ? Math.round(techConstructs.reduce((s, r) => s + r.percentile, 0) / techConstructs.length)
          : 0;
      const behavAvg =
        behavConstructs.length > 0
          ? Math.round(behavConstructs.reduce((s, r) => s + r.percentile, 0) / behavConstructs.length)
          : 0;
      const lv = subtestResults.find((r) => r.construct === "LEARNING_VELOCITY")?.percentile ?? 0;

      passed =
        techAvg >= cutline.technicalAptitude &&
        behavAvg >= cutline.behavioralIntegrity &&
        lv >= cutline.learningVelocity;
      distance = Math.min(
        techAvg - cutline.technicalAptitude,
        behavAvg - cutline.behavioralIntegrity,
        lv - cutline.learningVelocity,
      );
    }

    rankings.push({
      roleId: role.id,
      roleName: role.name,
      roleSlug: role.slug,
      compositeScore,
      passed,
      distanceFromCutline: distance,
    });
  }

  return rankings.sort((a, b) => b.compositeScore - a.compositeScore);
}

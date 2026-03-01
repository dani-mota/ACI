import prisma from "@/lib/prisma";
import { ITEM_BANK } from "./items";
import { scoreItem } from "./item-scoring";
import { scoreConstructs } from "./construct-scoring";
import { calculateComposite, evaluateCutline, determineStatus } from "@/lib/scoring";
import { generateAllPredictions } from "@/lib/predictions";
import { getNarrativeInsight } from "./narratives";

/**
 * Full scoring pipeline: takes an assessment's item responses and produces
 * SubtestResults, CompositeScores, Predictions, RedFlags, and final status.
 */
export async function runScoringPipeline(assessmentId: string) {
  // 1. Fetch assessment and item responses
  const assessment = await prisma.assessment.findUnique({
    where: { id: assessmentId },
    include: {
      itemResponses: true,
      aiInteractions: true,
      candidate: {
        include: { primaryRole: true },
      },
    },
  });

  if (!assessment) throw new Error("Assessment not found");

  // 2. Score each item
  const itemMap = new Map(ITEM_BANK.map((i) => [i.id, i]));
  const scoredItems = assessment.itemResponses
    .map((resp) => {
      const item = itemMap.get(resp.itemId);
      if (!item) return null;
      return scoreItem(item, resp.response, resp.responseTimeMs || undefined);
    })
    .filter((s): s is NonNullable<typeof s> => s !== null);

  // 3. Aggregate into construct scores
  const constructScores = scoreConstructs(scoredItems);

  // 4. Save SubtestResults (with narrative insights and calibration)
  for (const cs of constructScores) {
    // Calibration: find confidence check item for this construct
    const confidenceItemId = `confidence-${cs.construct.toLowerCase().replace(/_/g, "-")}`;
    const confidenceResponse = assessment.itemResponses.find(
      (r) => r.itemId === confidenceItemId
    );

    let calibrationScore: number | null = null;
    let calibrationBias: string | null = null;

    if (confidenceResponse) {
      const confidenceValue = parseFloat(confidenceResponse.response);
      const maxScale = 5;
      const normalizedConfidence = confidenceValue / maxScale;
      const actualAccuracy = cs.rawScore; // rawScore is 0–1 accuracy

      calibrationScore = Math.pow(normalizedConfidence - actualAccuracy, 2);
      const diff = normalizedConfidence - actualAccuracy;
      if (diff > 0.3) calibrationBias = "OVERCONFIDENT";
      else if (diff < -0.3) calibrationBias = "UNDERCONFIDENT";
      else calibrationBias = "CALIBRATED";
    }

    const narrativeInsight = getNarrativeInsight(cs.construct, cs.percentile);

    await prisma.subtestResult.upsert({
      where: {
        assessmentId_construct: {
          assessmentId,
          construct: cs.construct as any,
        },
      },
      create: {
        assessmentId,
        construct: cs.construct as any,
        layer: cs.layer as any,
        rawScore: cs.rawScore,
        percentile: cs.percentile,
        itemCount: cs.itemCount,
        responseTimeAvgMs: cs.avgResponseTimeMs,
        narrativeInsight,
        calibrationScore,
        calibrationBias,
      },
      update: {
        rawScore: cs.rawScore,
        percentile: cs.percentile,
        itemCount: cs.itemCount,
        responseTimeAvgMs: cs.avgResponseTimeMs,
        narrativeInsight,
        calibrationScore,
        calibrationBias,
      },
    });
  }

  // Update item raw scores
  for (const scored of scoredItems) {
    await prisma.itemResponse.updateMany({
      where: { assessmentId, itemId: scored.itemId },
      data: { rawScore: scored.rawScore },
    });
  }

  // 5. Calculate composites for the primary role (active weights only)
  const subtestResults = constructScores.map((cs) => ({
    construct: cs.construct,
    layer: cs.layer,
    percentile: cs.percentile,
  }));

  const role = assessment.candidate.primaryRole;
  const weights = await prisma.compositeWeight.findMany({
    where: { roleId: role.id, effectiveTo: null },
  });
  const cutline = await prisma.cutline.findFirst({
    where: { roleId: role.id },
  });

  const composite = calculateComposite(
    subtestResults,
    weights.map((w) => ({ constructId: w.constructId, weight: w.weight }))
  );

  const { passed, distance } = cutline
    ? evaluateCutline(subtestResults, {
        technicalAptitude: cutline.technicalAptitude,
        behavioralIntegrity: cutline.behavioralIntegrity,
        learningVelocity: cutline.learningVelocity,
      })
    : { passed: true, distance: 0 };

  await prisma.compositeScore.upsert({
    where: {
      assessmentId_roleSlug: {
        assessmentId,
        roleSlug: role.slug,
      },
    },
    create: {
      assessmentId,
      roleSlug: role.slug,
      indexName: `${role.name} Index`,
      score: composite,
      percentile: Math.round(composite),
      passed,
      distanceFromCutline: distance,
    },
    update: {
      score: composite,
      percentile: Math.round(composite),
      passed,
      distanceFromCutline: distance,
    },
  });

  // 6. Generate red flags
  const totalResponses = assessment.itemResponses.length;
  const fastResponses = assessment.itemResponses.filter(
    (r) => r.responseTimeMs !== null && r.responseTimeMs < 2000
  ).length;

  const totalAiInteractions = assessment.aiInteractions.length;
  const refusedAiInteractions = assessment.aiInteractions.filter((ai) => {
    if (!ai.candidateResponse) return true;
    return ai.candidateResponse.trim().split(/\s+/).length < 10;
  }).length;

  const constructsWithNoItems = constructScores.filter((cs) => cs.itemCount === 0);

  // Calibration overconfidence check: how many constructs are OVERCONFIDENT
  const overconfidentConstructs = constructScores.filter((cs) => {
    const confidenceItemId = `confidence-${cs.construct.toLowerCase().replace(/_/g, "-")}`;
    const cr = assessment.itemResponses.find((r) => r.itemId === confidenceItemId);
    if (!cr) return false;
    const diff = parseFloat(cr.response) / 5 - cs.rawScore;
    return diff > 0.3;
  });

  const redFlagChecks = [
    // Original checks
    {
      check: constructScores.some((cs) => cs.percentile < 10),
      severity: "CRITICAL" as const,
      category: "Extreme Low Score",
      title: "Critical performance deficit detected",
      description: `Constructs: ${constructScores.filter((cs) => cs.percentile < 10).map((cs) => cs.construct).join(", ")}`,
      constructs: constructScores.filter((cs) => cs.percentile < 10).map((cs) => cs.construct),
    },
    {
      check: constructScores.some((cs) => cs.percentile < 25 && cs.layer === "BEHAVIORAL_INTEGRITY"),
      severity: "WARNING" as const,
      category: "Behavioral Concern",
      title: "Below-threshold behavioral integrity score",
      description: `Constructs: ${constructScores.filter((cs) => cs.percentile < 25 && cs.layer === "BEHAVIORAL_INTEGRITY").map((cs) => cs.construct).join(", ")}`,
      constructs: constructScores.filter((cs) => cs.percentile < 25 && cs.layer === "BEHAVIORAL_INTEGRITY").map((cs) => cs.construct),
    },
    // Enhanced checks
    {
      check: constructScores.some(
        (cs) => cs.percentile < 30 && cs.avgResponseTimeMs !== undefined && cs.avgResponseTimeMs < 3000
      ),
      severity: "WARNING" as const,
      category: "Speed-Accuracy Mismatch",
      title: "Unusually fast responses with low accuracy detected",
      description: "Candidate answered quickly on constructs where accuracy was also low, which may indicate guessing or disengagement.",
      constructs: constructScores
        .filter((cs) => cs.percentile < 30 && cs.avgResponseTimeMs !== undefined && cs.avgResponseTimeMs < 3000)
        .map((cs) => cs.construct),
    },
    {
      check: constructsWithNoItems.length > 2,
      severity: "CRITICAL" as const,
      category: "Incomplete Assessment",
      title: "Assessment was not completed for multiple constructs",
      description: `No responses recorded for: ${constructsWithNoItems.map((cs) => cs.construct).join(", ")}`,
      constructs: constructsWithNoItems.map((cs) => cs.construct),
    },
    {
      check: totalResponses > 0 && fastResponses / totalResponses > 0.3,
      severity: "CRITICAL" as const,
      category: "Random Responding",
      title: "Potential random or disengaged responding detected",
      description: `${Math.round((fastResponses / totalResponses) * 100)}% of responses were submitted in under 2 seconds, suggesting possible random selection.`,
      constructs: [],
    },
    {
      check: totalAiInteractions > 0 && refusedAiInteractions / totalAiInteractions > 0.5,
      severity: "WARNING" as const,
      category: "AI Interaction Refusal",
      title: "Minimal engagement with follow-up questions",
      description: `More than half of AI follow-up responses were under 10 words, limiting the depth of behavioral assessment.`,
      constructs: [],
    },
    {
      check: overconfidentConstructs.length > 3,
      severity: "WARNING" as const,
      category: "Overconfidence Pattern",
      title: "Systematic overconfidence across multiple constructs",
      description: `Candidate's self-assessed confidence exceeded actual accuracy by more than 30% on ${overconfidentConstructs.length} constructs.`,
      constructs: overconfidentConstructs.map((cs) => cs.construct),
    },
  ];

  const redFlags = redFlagChecks.filter((rf) => rf.check);

  // Clear existing red flags and create new ones
  await prisma.redFlag.deleteMany({ where: { assessmentId } });
  for (const rf of redFlags) {
    await prisma.redFlag.create({
      data: {
        assessmentId,
        severity: rf.severity,
        category: rf.category,
        title: rf.title,
        description: rf.description,
        constructs: rf.constructs,
      },
    });
  }

  // 7. Determine final status
  const status = determineStatus(passed, distance, redFlags);

  // 8. Generate predictions
  const predictions = generateAllPredictions(subtestResults);

  await prisma.prediction.upsert({
    where: { assessmentId },
    create: {
      assessmentId,
      rampTimeMonths: predictions.rampTime.weeks / 4,
      rampTimeLabel: predictions.rampTime.label,
      rampTimeFactors: { description: predictions.rampTime.description },
      supervisionLoad: mapSupervisionLevel(predictions.supervision.level),
      supervisionScore: Math.round(predictions.supervision.confidence),
      supervisionFactors: { description: predictions.supervision.description },
      performanceCeiling: mapCeilingLevel(predictions.ceiling.level),
      ceilingFactors: { description: predictions.ceiling.description },
      ceilingCareerPath: [],
      attritionRisk: mapRiskLevel(predictions.attrition.risk),
      attritionFactors: { description: predictions.attrition.description },
      attritionStrategies: predictions.attrition.factors,
    },
    update: {
      rampTimeMonths: predictions.rampTime.weeks / 4,
      rampTimeLabel: predictions.rampTime.label,
      rampTimeFactors: { description: predictions.rampTime.description },
      supervisionLoad: mapSupervisionLevel(predictions.supervision.level),
      supervisionScore: Math.round(predictions.supervision.confidence),
      supervisionFactors: { description: predictions.supervision.description },
      performanceCeiling: mapCeilingLevel(predictions.ceiling.level),
      ceilingFactors: { description: predictions.ceiling.description },
      attritionRisk: mapRiskLevel(predictions.attrition.risk),
      attritionFactors: { description: predictions.attrition.description },
      attritionStrategies: predictions.attrition.factors,
    },
  });

  // 9. Update candidate status
  await prisma.candidate.update({
    where: { id: assessment.candidateId },
    data: { status: status as any },
  });

  return { status, composite, constructScores };
}

function mapSupervisionLevel(level: string): "LOW" | "MEDIUM" | "HIGH" {
  if (level === "MINIMAL" || level === "LOW") return "LOW";
  if (level === "STANDARD" || level === "MEDIUM") return "MEDIUM";
  return "HIGH";
}

function mapCeilingLevel(level: string): "HIGH" | "MEDIUM" | "LOW" {
  if (level === "SENIOR_SPECIALIST" || level === "HIGH") return "HIGH";
  if (level === "TEAM_LEAD" || level === "MEDIUM") return "MEDIUM";
  return "LOW";
}

function mapRiskLevel(risk: string): "LOW" | "MEDIUM" | "HIGH" {
  if (risk === "LOW") return "LOW";
  if (risk === "MODERATE" || risk === "MEDIUM") return "MEDIUM";
  return "HIGH";
}

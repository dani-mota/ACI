import prisma from "@/lib/prisma";
import type { Construct, CandidateStatus } from "@/generated/prisma/client";
import { calculateComposite, evaluateCutline, determineStatus } from "@/lib/scoring";
import { generateAllPredictions } from "@/lib/predictions";
import { getRoleContext } from "../role-context";
import { CONSTRUCT_LAYERS } from "../construct-scoring";
import { rawScoreToPercentile } from "../norm-tables";
import { computeRoleFitRankings } from "../role-fit-rankings";
import { scoreItem, aggregateLayerA } from "./layer-a";
import { evaluateConstruct, getTokenUsage, resetTokenUsage } from "./layer-b";
import { characterizeCeilings, getCeilingImplications } from "./layer-c";
import { aggregateConstructScore, getConstructWeightingType } from "./aggregation";
import { validateConsistency, countConsistencyFailures } from "./consistency";
import { detectRedFlags } from "./red-flags";
import { computeAdaptiveScore } from "../adaptive-loop";
import { ITEM_BANK } from "../item-bank";
import { AI_CONFIG } from "../config";
import type { AdaptiveLoopState, LayerBScore, ConsistencyResult, ConstructLayeredScore } from "../types";
import { createLogger } from "../logger";

const log = createLogger("scoring-pipeline");

/**
 * V2 Scoring Pipeline: processes a completed conversational assessment.
 *
 * Steps:
 * 1. Fetch assessment + messages + state
 * 2. Layer A: score deterministic items from Act 2 + Act 3
 * 3. Layer B: AI-evaluate conversational responses (parallel)
 * 4. Layer C: ceiling characterization from Act 2 diagnostic probes
 * 5. Construct aggregation (weighted A+B)
 * 6. Consistency validation (Act 1 vs Act 3)
 * 7. Populate SubtestResults (scoringVersion=2)
 * 8. Calculate composites — REUSE existing scoring.ts
 * 9. Evaluate cutlines — REUSE existing scoring.ts
 * 10. Red flags V2
 * 11. Predictions — REUSE existing predictions.ts
 * 12. Status determination — REUSE existing scoring.ts
 * 13. Update candidate status
 */
export async function runScoringPipeline(assessmentId: string) {
  const pipelineStart = Date.now();
  log.info("Pipeline started", { assessmentId });

  // ── 1. Fetch data ─────────────────────────────────────────────
  const assessment = await prisma.assessment.findUnique({
    where: { id: assessmentId },
    include: {
      messages: { orderBy: { sequenceOrder: "asc" } },
      assessmentState: true,
      candidate: { include: { primaryRole: true } },
      itemResponses: true,
    },
  });

  if (!assessment) throw new Error("Assessment not found");
  if (!assessment.assessmentState) throw new Error("Assessment state not found");

  const role = assessment.candidate.primaryRole;
  const roleContext = await getRoleContext(role.id);
  const state = assessment.assessmentState;
  const act2Progress = (state.act2Progress as Record<string, AdaptiveLoopState> | null) ?? {};

  // Exclude Phase 0 messages from scoring — they are non-assessed warmup
  assessment.messages = assessment.messages.filter((m) => m.act !== "PHASE_0");

  // ── 2. Layer A: Deterministic scoring ──────────────────────────
  const itemBankMap = new Map(ITEM_BANK.map((i) => [i.id, i]));
  const layerAScores = [];

  // Score Act 2 structured items from item responses
  for (const resp of assessment.itemResponses) {
    if (!resp.act || resp.act === "ACT_1" || resp.act === "PHASE_0") continue; // Phase 0 & Act 1 are non-scored
    const item = itemBankMap.get(resp.itemId);
    if (!item) continue;

    layerAScores.push(
      scoreItem({
        itemId: resp.itemId,
        construct: item.construct,
        difficulty: item.difficulty,
        correct: resp.response === item.correctAnswer,
        responseTimeMs: resp.responseTimeMs ?? undefined,
        act: resp.act,
      }),
    );
  }

  const layerAAggregated = aggregateLayerA(layerAScores);

  // ── 2b. Brier Score: Confidence calibration from Act 3 (P1-8) ──
  // Pairs each Act 3 confidence rating with the correctness of its preceding item
  const confidencePairs: { confidence: number; isCorrect: boolean }[] = [];
  const act3Messages = assessment.messages.filter((m) => m.act === "ACT_3");
  for (let i = 0; i < act3Messages.length; i++) {
    const msg = act3Messages[i];
    if (msg.elementType !== "CONFIDENCE_RATING" || !msg.candidateInput) continue;
    // Map confidence label to numeric value
    const confValue = msg.candidateInput === "Very confident" ? 1.0
      : msg.candidateInput === "Somewhat confident" ? 0.5
      : msg.candidateInput === "Not sure" ? 0.0
      : null;
    if (confValue === null) continue;
    // Find the preceding item response (the MCQ this confidence rates)
    for (let j = i - 1; j >= 0; j--) {
      const prev = act3Messages[j];
      if (prev.elementType && prev.elementType !== "CONFIDENCE_RATING") {
        // Found the paired item — check correctness from ItemResponse
        const meta = prev.metadata as Record<string, unknown> | null;
        const itemId = meta?.itemId as string | undefined;
        if (itemId) {
          const item = itemBankMap.get(itemId);
          const resp = assessment.itemResponses.find((r) => r.itemId === itemId);
          if (item && resp) {
            confidencePairs.push({
              confidence: confValue,
              isCorrect: resp.response === item.correctAnswer,
            });
          }
        }
        break;
      }
    }
  }

  let brierScore: number | null = null;
  let calibrationBias: string | null = null;
  if (confidencePairs.length >= 3) {
    brierScore = confidencePairs.reduce((sum, p) => {
      const actual = p.isCorrect ? 1.0 : 0.0;
      return sum + Math.pow(p.confidence - actual, 2);
    }, 0) / confidencePairs.length;
    // Classify calibration bias
    if (brierScore > 0.30) calibrationBias = "POORLY_CALIBRATED";
    else if (brierScore < 0.15) calibrationBias = "WELL_CALIBRATED";
    else calibrationBias = "MODERATELY_CALIBRATED";
    log.info("Brier score computed", { brierScore: Math.round(brierScore * 1000) / 1000, pairs: confidencePairs.length, calibrationBias });
  }

  // ── 3. Layer B: AI-evaluated rubric scoring ────────────────────
  resetTokenUsage();
  const layerBStart = Date.now();
  // Build a map from agent message → construct tags (metadata is on AGENT messages)
  const agentMessages = assessment.messages.filter((m) => m.role === "AGENT");
  const candidateMessages = assessment.messages.filter((m) => m.role === "CANDIDATE" && m.content);
  const allLayerBScores: LayerBScore[] = [];

  // Build construct → candidate message mapping using AGENT message metadata
  // Each candidate message is tagged with the constructs of the PRECEDING agent message
  const msgConstructMap = new Map<string, { primary: string[]; secondary: string[] }>();
  for (let i = 0; i < assessment.messages.length; i++) {
    const msg = assessment.messages[i];
    if (msg.role !== "CANDIDATE" || !msg.content) continue;
    // Look backward to find the preceding AGENT message with construct metadata
    for (let j = i - 1; j >= 0; j--) {
      const prev = assessment.messages[j];
      if (prev.role === "AGENT") {
        const metadata = prev.metadata as Record<string, unknown> | null;
        const primary = (metadata?.primaryConstructs as string[] | undefined) ?? [];
        const secondary = (metadata?.secondaryConstructs as string[] | undefined) ?? [];
        if (primary.length > 0 || secondary.length > 0) {
          msgConstructMap.set(msg.id, { primary, secondary });
        }
        break;
      }
    }
  }

  // Identify constructs with conversational evidence
  const constructsWithConvoData = new Set<string>();
  for (const { primary, secondary } of msgConstructMap.values()) {
    for (const c of primary) constructsWithConvoData.add(c);
    for (const c of secondary) constructsWithConvoData.add(c);
  }

  // For each construct, evaluate relevant candidate messages (with idempotency guard)
  const allConstructs = Object.keys(CONSTRUCT_LAYERS);
  for (const construct of allConstructs) {
    // Find candidate messages relevant to this construct (via preceding agent metadata)
    const relevantMessages = candidateMessages.filter((msg) => {
      const tags = msgConstructMap.get(msg.id);
      if (!tags) return false;
      return tags.primary.includes(construct) || tags.secondary.includes(construct);
    });

    if (relevantMessages.length === 0) continue;

    // ── Idempotency guard: reuse existing AI evaluation runs on retry ──
    // Prevents duplicate API calls, cost explosion, and non-deterministic rescoring
    const existingRuns = await prisma.aIEvaluationRun.findMany({
      where: { assessmentId, construct: construct as Construct },
    });

    if (existingRuns.length >= relevantMessages.length * AI_CONFIG.evaluationRunCount) {
      log.info("Reusing existing Layer B evaluations (idempotent retry)", {
        construct,
        existingRunCount: String(existingRuns.length),
      });
      // Reconstruct LayerBScores from stored runs
      const byMessage = new Map<string, typeof existingRuns>();
      for (const run of existingRuns) {
        const arr = byMessage.get(run.messageId) ?? [];
        arr.push(run);
        byMessage.set(run.messageId, arr);
      }
      for (const [messageId, runs] of byMessage) {
        const msg = relevantMessages.find((m) => m.id === messageId);
        if (!msg) continue;
        const sortedRuns = runs.sort((a, b) => a.aggregateScore - b.aggregateScore);
        const medianIdx = Math.floor((sortedRuns.length - 1) / 2);
        const scores = sortedRuns.map((r) => r.aggregateScore);
        const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
        const stdDev = Math.sqrt(scores.reduce((sum, s) => sum + Math.pow(s - mean, 2), 0) / scores.length);
        const highVariance = stdDev > AI_CONFIG.highVarianceThreshold;

        allLayerBScores.push({
          messageId,
          construct: construct as Construct,
          indicators: ((sortedRuns[medianIdx].indicatorScores as unknown) as { indicatorId?: string; id?: string; present?: boolean; reasoning?: string }[]).map((ind) => ({
            indicatorId: ind.indicatorId ?? ind.id ?? "",
            present: ind.present ?? false,
            reasoning: ind.reasoning ?? "",
          })),
          aggregateScore: sortedRuns[medianIdx].aggregateScore,
          runs: sortedRuns.map((r) => ({
            runIndex: r.runIndex,
            indicators: ((r.indicatorScores as unknown) as { indicatorId?: string; id?: string; present?: boolean; reasoning?: string }[]).map((ind) => ({
              indicatorId: ind.indicatorId ?? ind.id ?? "",
              present: ind.present ?? false,
              reasoning: ind.reasoning ?? "",
            })),
            aggregateScore: r.aggregateScore,
            modelId: r.modelId,
            latencyMs: r.latencyMs,
            rawOutput: r.rawOutput,
          })),
          medianScore: sortedRuns[medianIdx].aggregateScore,
          variance: stdDev,
          highVarianceFlag: highVariance,
          downweighted: highVariance,
          act: msg.act,
        });
      }
      continue; // Skip API calls — reuse existing evaluations
    }

    // Build conversation context for each message
    const responses = relevantMessages.map((msg) => {
      const msgIndex = assessment.messages.findIndex((m) => m.id === msg.id);
      const contextMessages = assessment.messages
        .slice(Math.max(0, msgIndex - 4), msgIndex)
        .map((m) => `${m.role}: ${m.content.slice(0, 200)}`)
        .join("\n");

      return {
        messageId: msg.id,
        content: msg.content,
        construct: construct as Construct,
        act: msg.act,
        conversationContext: contextMessages,
      };
    });

    const result = await evaluateConstruct(responses);
    allLayerBScores.push(...result.scores);
  }

  const tokenUsage = getTokenUsage();
  log.info("Layer B completed", {
    assessmentId,
    durationMs: Date.now() - layerBStart,
    tokenCount: tokenUsage.inputTokens + tokenUsage.outputTokens,
    cost: (tokenUsage.inputTokens * 0.8 + tokenUsage.outputTokens * 4) / 1_000_000,
    responseCount: allLayerBScores.length,
  });

  // Aggregate Layer B per construct (honoring high-variance downweight)
  const layerBAggregated = new Map<string, number>();
  const layerBWeightSums = new Map<string, number>();
  for (const score of allLayerBScores) {
    const key = score.construct as string;
    const weight = score.downweighted ? AI_CONFIG.highVarianceDownweight : 1;
    const currentWeighted = layerBAggregated.get(key) ?? 0;
    const currentWeight = layerBWeightSums.get(key) ?? 0;
    layerBAggregated.set(key, currentWeighted + score.medianScore * weight);
    layerBWeightSums.set(key, currentWeight + weight);
  }
  for (const [key, total] of layerBAggregated) {
    const weightSum = layerBWeightSums.get(key) ?? 1;
    layerBAggregated.set(key, weightSum > 0 ? total / weightSum : 0);
  }

  // ── 4. Layer C: Ceiling characterization ───────────────────────
  const ceilingResults = await characterizeCeilings(act2Progress);

  // ── 5. Consistency validation ──────────────────────────────────
  // Compare Act 1 vs Act 3 Layer B scores per construct (proper mean)
  const act1BSums = new Map<string, { sum: number; count: number }>();
  const act3BSums = new Map<string, { sum: number; count: number }>();
  for (const score of allLayerBScores) {
    const map = score.act === "ACT_1" ? act1BSums : score.act === "ACT_3" ? act3BSums : null;
    if (map) {
      const key = score.construct as string;
      const prev = map.get(key) ?? { sum: 0, count: 0 };
      map.set(key, { sum: prev.sum + score.medianScore, count: prev.count + 1 });
    }
  }
  const act1BScores = new Map<string, number>();
  const act3BScores = new Map<string, number>();
  for (const [key, { sum, count }] of act1BSums) act1BScores.set(key, sum / count);
  for (const [key, { sum, count }] of act3BSums) act3BScores.set(key, sum / count);

  const consistencySignals = Array.from(act1BScores.entries())
    .filter(([construct]) => act3BScores.has(construct))
    .map(([construct, act1Score]) => ({
      construct,
      act1Score,
      act3Score: act3BScores.get(construct)!,
      act1DataPoints: act1BSums.get(construct)?.count ?? 0,
      act3DataPoints: act3BSums.get(construct)?.count ?? 0,
    }));

  const consistencyResults: ConsistencyResult[] = validateConsistency(consistencySignals);

  // ── 6. Construct aggregation ───────────────────────────────────
  const constructScores: ConstructLayeredScore[] = [];

  for (const construct of allConstructs) {
    const layerA = layerAAggregated.get(construct);
    const layerB = layerBAggregated.get(construct);
    const ceiling = ceilingResults.get(construct);
    const consistency = consistencyResults.find((r) => r.construct === construct);

    // Also use adaptive loop score if available
    const adaptiveState = act2Progress[construct];
    const adaptiveScore = adaptiveState ? computeAdaptiveScore(adaptiveState) : null;

    // Use adaptive score as Layer A if available and no item responses
    const effectiveLayerA = layerA?.score ?? adaptiveScore;

    const score = aggregateConstructScore({
      construct,
      layerAScore: effectiveLayerA ?? null,
      layerBScore: layerB ?? null,
      layerAItemCount: layerA?.itemCount ?? (adaptiveState ? adaptiveState.itemsServed.length : 0),
      layerBResponseCount: layerBWeightSums.get(construct) ? Math.round(layerBWeightSums.get(construct)!) : 0,
      avgResponseTimeMs: layerA?.avgResponseTimeMs ?? 0,
      consistencyLevel: consistency?.agreement ?? null,
      consistencyDownweightApplied: consistency?.agreement === "LOW",
      ceilingCharacterization: ceiling ?? null,
    });

    constructScores.push(score);
  }

  // ── 7-8. Prepare scoring data (composites, cutlines) before transaction ──
  const subtestResults = constructScores
    .filter((cs) => cs.itemCount > 0 || cs.combinedRawScore > 0)
    .map((cs) => ({
      construct: cs.construct as string,
      layer: cs.layer,
      percentile: cs.percentile,
    }));

  const weights = await prisma.compositeWeight.findMany({
    where: { roleId: role.id, effectiveTo: null },
  });
  const cutline = await prisma.cutline.findFirst({
    where: { roleId: role.id },
  });

  const composite = calculateComposite(
    subtestResults,
    weights.map((w) => ({ constructId: w.constructId, weight: w.weight })),
  );

  // ── 9. Evaluate cutlines ───────────────────────────────────────
  const { passed, distance } = cutline
    ? evaluateCutline(subtestResults, {
        technicalAptitude: cutline.technicalAptitude,
        behavioralIntegrity: cutline.behavioralIntegrity,
        learningVelocity: cutline.learningVelocity,
      })
    : { passed: true, distance: 0 };

  // ── 10. Red flags V2 ───────────────────────────────────────────
  const redFlags = detectRedFlags({
    constructScores,
    messages: assessment.messages,
    consistencyResults,
    layerBScores: allLayerBScores,
  });

  // ── 11. Predictions ────────────────────────────────────────────
  const ceilingCharacterizations = Array.from(ceilingResults.entries()).map(([construct, ceiling]) => ({
    construct,
    ceilingType: ceiling.ceilingType,
    narrative: ceiling.narrative,
  }));
  const predictions = generateAllPredictions(subtestResults, roleContext, ceilingCharacterizations);

  // ── 12. Status determination ───────────────────────────────────
  // Check for insufficient data — >2 constructs with no data forces REVIEW_REQUIRED
  const insufficientCount = constructScores.filter((cs) => cs.insufficientData).length;
  if (insufficientCount > 2) {
    redFlags.push({
      triggered: true,
      severity: "CRITICAL",
      category: "Incomplete Assessment",
      title: "Insufficient data for multiple constructs",
      description: `${insufficientCount} constructs have insufficient scoring data.`,
      constructs: constructScores.filter((cs) => cs.insufficientData).map((cs) => cs.construct as string),
    });
  }
  const status = determineStatus(passed, distance, redFlags);

  // Cross-role rankings (pre-compute before transaction)
  let crossRoleRankings: { roleSlug: string; roleName: string; compositeScore: number; passed: boolean; distanceFromCutline: number }[] = [];
  if (role.isGeneric) {
    crossRoleRankings = await computeRoleFitRankings(
      assessment.candidate.orgId,
      subtestResults,
    );
  }

  const costUsd = (tokenUsage.inputTokens * 0.8 + tokenUsage.outputTokens * 4) / 1_000_000;

  // ── 13. Atomic transactional save (steps 7-13) ─────────────────
  // All scoring data committed or none — prevents partial scoring states
  await prisma.$transaction(async (tx) => {
    // Step 7: SubtestResults
    for (const cs of constructScores) {
      if (cs.itemCount === 0 && cs.combinedRawScore === 0) continue;
      const ceiling = cs.ceilingCharacterization;

      // Brier score fields for METACOGNITIVE_CALIBRATION
      const isMetacog = cs.construct === "METACOGNITIVE_CALIBRATION";
      const calibrationFields = isMetacog && brierScore !== null
        ? { calibrationScore: brierScore, calibrationBias }
        : {};

      await tx.subtestResult.upsert({
        where: {
          assessmentId_construct: { assessmentId, construct: cs.construct as any },
        },
        create: {
          assessmentId,
          construct: cs.construct as any,
          layer: cs.layer as any,
          rawScore: cs.combinedRawScore,
          percentile: cs.percentile,
          itemCount: cs.itemCount,
          responseTimeAvgMs: cs.avgResponseTimeMs,
          layerARawScore: cs.layerAScore,
          layerBRawScore: cs.layerBScore,
          layerAWeight: cs.layerAWeight,
          layerBWeight: cs.layerBWeight,
          consistencyLevel: cs.consistencyLevel ?? null,
          consistencyDownweighted: cs.consistencyDownweightApplied,
          ceilingType: ceiling?.ceilingType ?? null,
          ceilingNarrative: ceiling?.narrative ?? null,
          scoringVersion: 2,
          ...calibrationFields,
        },
        update: {
          rawScore: cs.combinedRawScore,
          percentile: cs.percentile,
          itemCount: cs.itemCount,
          responseTimeAvgMs: cs.avgResponseTimeMs,
          layerARawScore: cs.layerAScore,
          layerBRawScore: cs.layerBScore,
          layerAWeight: cs.layerAWeight,
          layerBWeight: cs.layerBWeight,
          consistencyLevel: cs.consistencyLevel ?? null,
          consistencyDownweighted: cs.consistencyDownweightApplied,
          ceilingType: ceiling?.ceilingType ?? null,
          ceilingNarrative: ceiling?.narrative ?? null,
          scoringVersion: 2,
          ...calibrationFields,
        },
      });
    }

    // AIEvaluationRun upserts (idempotent via unique constraint)
    for (const score of allLayerBScores) {
      for (const run of score.runs) {
        await tx.aIEvaluationRun.upsert({
          where: {
            assessmentId_messageId_construct_runIndex: {
              assessmentId,
              messageId: score.messageId,
              construct: score.construct as any,
              runIndex: run.runIndex,
            },
          },
          create: {
            assessmentId,
            messageId: score.messageId,
            construct: score.construct as any,
            runIndex: run.runIndex,
            indicatorScores: run.indicators as any,
            aggregateScore: run.aggregateScore,
            modelId: run.modelId,
            latencyMs: run.latencyMs,
            rawOutput: run.rawOutput,
          },
          update: {
            indicatorScores: run.indicators as any,
            aggregateScore: run.aggregateScore,
            modelId: run.modelId,
            latencyMs: run.latencyMs,
            rawOutput: run.rawOutput,
          },
        });
      }
    }

    // CompositeScore (primary role)
    await tx.compositeScore.upsert({
      where: {
        assessmentId_roleSlug: { assessmentId, roleSlug: role.slug },
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

    // Cross-role rankings
    for (const ranking of crossRoleRankings) {
      await tx.compositeScore.upsert({
        where: {
          assessmentId_roleSlug: { assessmentId, roleSlug: ranking.roleSlug },
        },
        create: {
          assessmentId,
          roleSlug: ranking.roleSlug,
          indexName: `${ranking.roleName} Index`,
          score: ranking.compositeScore,
          percentile: ranking.compositeScore,
          passed: ranking.passed,
          distanceFromCutline: ranking.distanceFromCutline,
        },
        update: {
          score: ranking.compositeScore,
          percentile: ranking.compositeScore,
          passed: ranking.passed,
          distanceFromCutline: ranking.distanceFromCutline,
        },
      });
    }

    // Red flags (atomic delete + recreate)
    await tx.redFlag.deleteMany({ where: { assessmentId } });
    for (const rf of redFlags) {
      await tx.redFlag.create({
        data: {
          assessmentId,
          severity: rf.severity as any,
          category: rf.category,
          title: rf.title,
          description: rf.description,
          constructs: rf.constructs,
        },
      });
    }

    // Predictions
    await tx.prediction.upsert({
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

    // Candidate status + cost tracking (last — atomic commit point)
    await tx.candidate.update({
      where: { id: assessment.candidateId },
      data: { status: status as CandidateStatus },
    });

    await tx.assessment.update({
      where: { id: assessmentId },
      data: {
        scoringCostUsd: costUsd,
        scoringTokensIn: tokenUsage.inputTokens,
        scoringTokensOut: tokenUsage.outputTokens,
      },
    });
  });

  const totalMs = Date.now() - pipelineStart;
  log.info("Pipeline completed", {
    assessmentId,
    durationMs: totalMs,
    status,
    composite: Math.round(composite),
    constructCount: constructScores.filter((c) => c.itemCount > 0).length,
    layerBCount: allLayerBScores.length,
    redFlagCount: redFlags.length,
    costUsd,
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

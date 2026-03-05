import type { Construct } from "@/generated/prisma/client";
import type { ConstructLayeredScore, LayerCCharacterization } from "../types";
import { ASSESSMENT_STRUCTURE } from "../config";
import { CONSTRUCT_LAYERS } from "../construct-scoring";
import { rawScoreToPercentile } from "../norm-tables";

/**
 * Construct aggregation: combines Layer A and Layer B scores.
 *
 * Construct Score = (w_A × Layer_A) + (w_B × Layer_B)
 *
 * Default weights:
 * - w_A = 0.55, w_B = 0.45 when both layers present
 * - w_B = 1.0 for Act-1-only constructs (behavioral, measured only through conversation)
 * - w_A = 1.0 for constructs with only structured items (e.g., Spatial Visualization)
 */

/** Constructs measured only through conversation (no structured items in Act 2) */
const CONVERSATION_ONLY_CONSTRUCTS = new Set([
  "SYSTEMS_DIAGNOSTICS",
  "PROCEDURAL_RELIABILITY",
  "ETHICAL_JUDGMENT",
  "EXECUTIVE_CONTROL",
  "COGNITIVE_FLEXIBILITY",
  "METACOGNITIVE_CALIBRATION",
  "LEARNING_VELOCITY",
]);

/** Constructs measured primarily through structured items */
const ACT2_CONSTRUCTS = new Set(ASSESSMENT_STRUCTURE.act2Constructs);

interface AggregationInput {
  construct: string;
  layerAScore: number | null; // null if no structured items for this construct
  layerBScore: number | null; // null if no conversational evaluation for this construct
  layerAItemCount: number;
  layerBResponseCount: number;
  avgResponseTimeMs: number;
  consistencyLevel?: "HIGH" | "LOW" | null;
  consistencyDownweightApplied: boolean;
  ceilingCharacterization?: LayerCCharacterization | null;
}

/**
 * Aggregate Layer A and Layer B scores for a construct.
 */
export function aggregateConstructScore(input: AggregationInput): ConstructLayeredScore {
  let layerAWeight: number;
  let layerBWeight: number;

  if (input.layerAScore === null && input.layerBScore === null) {
    // No data for this construct
    return {
      construct: input.construct as Construct,
      layer: CONSTRUCT_LAYERS[input.construct] || "COGNITIVE_CORE",
      layerAScore: null,
      layerBScore: null,
      layerAWeight: 0,
      layerBWeight: 0,
      combinedRawScore: 0,
      percentile: 1,
      itemCount: 0,
      avgResponseTimeMs: 0,
      consistencyLevel: input.consistencyLevel,
      consistencyDownweightApplied: input.consistencyDownweightApplied,
      ceilingCharacterization: input.ceilingCharacterization,
    };
  }

  if (input.layerAScore !== null && input.layerBScore !== null) {
    // Both layers present — use default weights
    layerAWeight = ASSESSMENT_STRUCTURE.defaultLayerAWeight;
    layerBWeight = ASSESSMENT_STRUCTURE.defaultLayerBWeight;
  } else if (input.layerAScore !== null) {
    // Only structured items (Layer A)
    layerAWeight = 1.0;
    layerBWeight = 0;
  } else {
    // Only conversational (Layer B)
    layerAWeight = 0;
    layerBWeight = 1.0;
  }

  const a = input.layerAScore ?? 0;
  const b = input.layerBScore ?? 0;
  let combinedRawScore = layerAWeight * a + layerBWeight * b;

  // Apply consistency downweight if applicable
  if (input.consistencyDownweightApplied && input.consistencyLevel === "LOW") {
    combinedRawScore *= ASSESSMENT_STRUCTURE.consistencyDownweightFactor;
  }

  const percentile = rawScoreToPercentile(input.construct, combinedRawScore);
  const itemCount = input.layerAItemCount + input.layerBResponseCount;

  return {
    construct: input.construct as Construct,
    layer: CONSTRUCT_LAYERS[input.construct] || "COGNITIVE_CORE",
    layerAScore: input.layerAScore,
    layerBScore: input.layerBScore,
    layerAWeight,
    layerBWeight,
    combinedRawScore: Math.round(combinedRawScore * 1000) / 1000,
    percentile,
    itemCount,
    avgResponseTimeMs: input.avgResponseTimeMs,
    consistencyLevel: input.consistencyLevel,
    consistencyDownweightApplied: input.consistencyDownweightApplied,
    ceilingCharacterization: input.ceilingCharacterization,
  };
}

/**
 * Determine the appropriate weighting for a construct based on data availability.
 */
export function getConstructWeightingType(construct: string): "BOTH" | "LAYER_A_ONLY" | "LAYER_B_ONLY" {
  if (CONVERSATION_ONLY_CONSTRUCTS.has(construct)) return "LAYER_B_ONLY";
  if (ACT2_CONSTRUCTS.has(construct as typeof ASSESSMENT_STRUCTURE.act2Constructs[number])) return "BOTH";
  return "LAYER_B_ONLY";
}

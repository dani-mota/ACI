import type { CeilingTypeEnum, Construct } from "@/generated/prisma/client";
import type { LayerCCharacterization, AdaptiveLoopState } from "../types";
import { classifyCeiling } from "../diagnostic-probe";
import { createLogger } from "../logger";

const log = createLogger("layer-c");

/**
 * Layer C: Ceiling characterization from Act 2 diagnostic probes.
 *
 * Does NOT produce a numeric score — produces a qualitative classification
 * that feeds narrative reports and predictions.
 */

/**
 * Generate ceiling characterizations for all completed Act 2 adaptive loops.
 */
export async function characterizeCeilings(
  loopStates: Record<string, AdaptiveLoopState>,
): Promise<Map<string, LayerCCharacterization>> {
  const results = new Map<string, LayerCCharacterization>();

  const entries = Object.entries(loopStates).filter(
    ([_, state]) => state.phase === "DIAGNOSTIC_PROBE" && state.probeExchanges.length > 0,
  );

  // Process ceiling classifications in parallel
  const classifications = await Promise.allSettled(
    entries.map(async ([construct, state]) => {
      const result = await classifyCeiling(state);
      return { construct, result };
    }),
  );

  for (let i = 0; i < classifications.length; i++) {
    const outcome = classifications[i];
    const construct = entries[i][0];
    if (outcome.status === "fulfilled") {
      results.set(outcome.value.construct, outcome.value.result);
    } else {
      // Log but also provide a fallback instead of silently dropping
      log.warn("Ceiling classification failed, defaulting to INSUFFICIENT_DATA", {
        construct,
        error: String(outcome.reason),
      });
      results.set(construct, {
        construct: construct as any,
        ceilingType: "INSUFFICIENT_DATA" as CeilingTypeEnum,
        narrative: "Ceiling classification could not be determined due to an evaluation error.",
        trainingRecommendation: "Insufficient data to determine training needs.",
        supervisionImplication: "Standard supervision appropriate.",
        evidenceStrength: 0,
      });
    }
  }

  return results;
}

/**
 * Get ceiling implications for predictions and reports.
 */
export function getCeilingImplications(ceiling: LayerCCharacterization): {
  capsPerformanceCeiling: boolean;
  trainingPriority: "HIGH" | "MEDIUM" | "LOW";
  supervisionAdjustment: string;
} {
  switch (ceiling.ceilingType) {
    case "HARD_CEILING":
      return {
        capsPerformanceCeiling: true,
        trainingPriority: "LOW", // Training unlikely to help
        supervisionAdjustment: "Structured support needed for tasks requiring this ability",
      };
    case "SOFT_CEILING_TRAINABLE":
      return {
        capsPerformanceCeiling: false,
        trainingPriority: "HIGH",
        supervisionAdjustment: "Standard supervision with targeted development plan",
      };
    case "SOFT_CEILING_CONTEXT_DEPENDENT":
      return {
        capsPerformanceCeiling: false,
        trainingPriority: "MEDIUM",
        supervisionAdjustment: "Monitor across different task contexts; may excel in some but not others",
      };
    case "STRESS_INDUCED":
      return {
        capsPerformanceCeiling: false,
        trainingPriority: "MEDIUM",
        supervisionAdjustment: "Reduce time pressure and provide calm working conditions when possible",
      };
    case "INSUFFICIENT_DATA":
    default:
      return {
        capsPerformanceCeiling: false,
        trainingPriority: "LOW",
        supervisionAdjustment: "Standard supervision appropriate",
      };
  }
}

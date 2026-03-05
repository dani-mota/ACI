import type { Construct } from "@/generated/prisma/client";
import type { ConsistencyResult } from "../types";
import { ASSESSMENT_STRUCTURE } from "../config";

/**
 * Consistency validation: compares Act 1 vs Act 3 construct signals.
 *
 * Act 3 parallel scenarios re-test constructs from Act 1 with different surface content.
 * If the construct signals diverge significantly, the lower-confidence source is downweighted.
 *
 * Delta < threshold → HIGH consistency (score stands)
 * Delta >= threshold → LOW consistency (flag, downweight lower source by 0.75x)
 */

interface ConstructSignals {
  construct: string;
  act1Score: number; // Layer B aggregate from Act 1 responses
  act3Score: number; // Layer B aggregate from Act 3 parallel scenario responses
  act1DataPoints?: number; // Number of Act 1 responses for this construct
  act3DataPoints?: number; // Number of Act 3 responses for this construct
}

/**
 * Validate consistency between Act 1 and Act 3 construct signals.
 */
export function validateConsistency(
  signals: ConstructSignals[],
): ConsistencyResult[] {
  return signals.map((signal) => {
    const delta = Math.abs(signal.act1Score - signal.act3Score);
    const agreement: "HIGH" | "LOW" =
      delta < ASSESSMENT_STRUCTURE.consistencyThreshold ? "HIGH" : "LOW";

    // Lower-confidence source is the one with fewer data points
    const act1Count = signal.act1DataPoints ?? 0;
    const act3Count = signal.act3DataPoints ?? 0;
    const lowerConfidenceSource: "ACT_1" | "ACT_3" =
      act3Count < act1Count ? "ACT_3" : act1Count < act3Count ? "ACT_1" : "ACT_3";

    return {
      construct: signal.construct as Construct,
      act1Score: signal.act1Score,
      act3Score: signal.act3Score,
      agreement,
      delta: Math.round(delta * 1000) / 1000,
      lowerConfidenceSource,
      downweightFactor: agreement === "HIGH" ? 1.0 : ASSESSMENT_STRUCTURE.consistencyDownweightFactor,
    };
  });
}

/**
 * Check if a construct has a consistency flag.
 */
export function hasConsistencyFlag(
  results: ConsistencyResult[],
  construct: string,
): boolean {
  return results.some((r) => r.construct === construct && r.agreement === "LOW");
}

/**
 * Count how many constructs have LOW consistency.
 */
export function countConsistencyFailures(results: ConsistencyResult[]): number {
  return results.filter((r) => r.agreement === "LOW").length;
}

/**
 * PRO-139: Promotion Fit — per-construct comparison of an employee's scores
 * against the role's *next-level* demand profile, plus a single-string
 * developmental verdict.
 *
 * Pure compute. No I/O. Rows are produced by delegating to
 * `computeRoleFitDelta` — Promotion Fit reuses the same shape comparison,
 * just against next-level demands instead of current. The verdict is layered
 * on top.
 *
 * Verdict thresholds are quarantined in
 * `./promotion-fit-thresholds.ts` (calibration pending — see follow-up).
 *
 * Vocabulary discipline (PRO-134): the three verdict strings are
 * developmentally framed. Never "not ready / failed / insufficient." A
 * snapshot test in `__tests__/promotion-fit.test.ts` locks the exact strings.
 */

import {
  computeRoleFitDelta,
  type RoleFitDeltaEntry,
} from "./role-fit-delta";
import {
  ALIGNED_NOW_MAX_GAPS,
  LATERAL_TRIGGER_GAP_COUNT,
  LATERAL_TRIGGER_MAGNITUDE,
  STRETCH_MONTHS_PER_GAP,
} from "./promotion-fit-thresholds";
import { stretchContextFor } from "@/lib/assessment/stretch-contexts";
import type { RoleDemandProfileEntry } from "@/lib/assessment/role-demand-resolution";

export type PromotionVerdictKind = "aligned_now" | "stretch" | "lateral";

export interface PromotionFitResult {
  rows: RoleFitDeltaEntry[];
  verdict: PromotionVerdictKind;
  /** Number of under-spec gaps (`direction === "growth_edge"`). */
  gapCount: number;
  /** Months-of-stretch figure for the middle verdict. Defined iff
   *  `verdict === "stretch"`. */
  monthsStretch?: number;
  /** Stretch-context phrase for the middle verdict. Defined iff
   *  `verdict === "stretch"`. */
  stretchContext?: string;
  /** Construct key driving the stretch-context phrase (largest under-spec
   *  gap). Useful for the panel's "driven by" callout. Defined iff
   *  `verdict === "stretch"`. */
  stretchConstruct?: string;
}

/**
 * Classify and compose a Promotion Fit result.
 *
 * Order of classification matters: lateral is checked first because a single
 * very-large gap should dominate even if the gap count would otherwise place
 * the case in the "stretch" range.
 */
export function computePromotionFit(
  employeeScores: { construct: string; percentile: number }[],
  nextLevelDemand: RoleDemandProfileEntry[],
): PromotionFitResult {
  const rows = computeRoleFitDelta(employeeScores, nextLevelDemand);

  const underSpec = rows.filter((r) => r.direction === "growth_edge");
  const gapCount = underSpec.length;

  // Largest under-spec gap by magnitude. `delta` is signed (negative for
  // growth_edge); we compare by absolute value to find the deepest gap.
  // null deltas are filtered out by the growth_edge direction guard above.
  const largestGap = underSpec.reduce<RoleFitDeltaEntry | null>((acc, r) => {
    if (acc === null) return r;
    if (r.delta === null || acc.delta === null) return acc;
    return Math.abs(r.delta) > Math.abs(acc.delta) ? r : acc;
  }, null);

  const largestMagnitude =
    largestGap && largestGap.delta !== null ? Math.abs(largestGap.delta) : 0;

  // Lateral wins over stretch — one dominant gap or a wide spread of gaps
  // both signal a different trajectory is the cleaner read.
  if (
    gapCount >= LATERAL_TRIGGER_GAP_COUNT ||
    largestMagnitude >= LATERAL_TRIGGER_MAGNITUDE
  ) {
    return { rows, verdict: "lateral", gapCount };
  }

  if (gapCount <= ALIGNED_NOW_MAX_GAPS) {
    return { rows, verdict: "aligned_now", gapCount };
  }

  // Middle case: stretch path. N = gapCount * monthsPerGap, context from the
  // deepest under-spec construct. `stretchContextFor` returns undefined only
  // when the construct key isn't in CONSTRUCTS — which `computeRoleFitDelta`
  // already filters. Defensive fallback keeps the verdict renderable.
  const monthsStretch = gapCount * STRETCH_MONTHS_PER_GAP;
  const stretchConstruct = largestGap?.construct;
  const stretchContext =
    (stretchConstruct && stretchContextFor(stretchConstruct)) ??
    "targeted stretch development";

  return {
    rows,
    verdict: "stretch",
    gapCount,
    monthsStretch,
    stretchContext,
    stretchConstruct,
  };
}

/**
 * AC-verbatim verdict strings. Centralized here so the panel never inlines
 * the copy and the snapshot test in `__tests__/promotion-fit.test.ts` can
 * lock them as the single source of truth.
 *
 * Vocabulary discipline (PRO-134): developmental framing only.
 */
export function renderVerdictString(result: PromotionFitResult): string {
  switch (result.verdict) {
    case "aligned_now":
      return "Profile aligns with next-level demands now";
    case "stretch":
      return `Profile aligns with approximately ${result.monthsStretch} months of ${result.stretchContext}`;
    case "lateral":
      return "A lateral trajectory may be a stronger fit — see Trajectory Readiness";
  }
}

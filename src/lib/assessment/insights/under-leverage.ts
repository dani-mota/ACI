/**
 * PRO-137: Under-Leverage Score.
 *
 * AC formula text (Dani 2026-05-01: "the formula in the AC is unambiguous…
 * do not improve or normalize differently"):
 *
 *   (sum(max(delta, 0) per construct) / (12 * 10)) * 100
 *
 * AC assumes deltas on a 1–10 scale. PRO-136 (`role-fit-delta.ts`) emits
 * deltas on a 0–100 scale. Reconciliation: convert inputs (delta / 10)
 * before applying the formula verbatim. Denominator stays `12 * 10` as
 * written. The validation cohort sees the formula exactly as in the spec.
 *
 * Mathematically equivalent to a `12 * 100` substitution but preserves
 * the AC formula text.
 *
 * Pure compute. No Prisma. No I/O.
 *
 * Returns null when:
 *   - Fewer than 12 deltas are present (caller didn't pass a full set), OR
 *   - Zero rows carry a non-null delta (no resolvable role-demand profile).
 *
 * Returns an integer 0-100 otherwise.
 */

import type { RoleFitDeltaEntry } from "@/lib/assessment/insights/role-fit-delta";
import { CONSTRUCTS } from "@/lib/constructs";

const NUM_CONSTRUCTS = 12;
/** AC formula assumes 1–10 scale. PRO-136 emits 0–100 — see header. */
const MAX_DELTA_PER_CONSTRUCT = 10;

export function computeUnderLeverageScore(
  deltas: RoleFitDeltaEntry[],
): number | null {
  // Defensive: fail loud if CONSTRUCTS ever changes count. Silent drift
  // would shift the denominator and quietly corrupt the validation cohort.
  if (Object.keys(CONSTRUCTS).length !== NUM_CONSTRUCTS) {
    throw new Error(
      `PRO-137 expects ${NUM_CONSTRUCTS} constructs; CONSTRUCTS has ${Object.keys(CONSTRUCTS).length}`,
    );
  }
  if (deltas.length !== NUM_CONSTRUCTS) return null;

  let hasAnyDelta = false;
  let positiveSumOn1To10 = 0;
  for (const row of deltas) {
    if (row.delta == null) continue;
    hasAnyDelta = true;
    // PRO-136 emits 0–100; AC formula expects 1–10. Convert inputs, not formula.
    const deltaOn1To10 = row.delta / 10;
    if (deltaOn1To10 > 0) positiveSumOn1To10 += deltaOn1To10;
  }
  if (!hasAnyDelta) return null;

  // Formula verbatim per AC. Explicit parentheses.
  const score =
    (positiveSumOn1To10 / (NUM_CONSTRUCTS * MAX_DELTA_PER_CONSTRUCT)) * 100;
  return Math.round(score);
}

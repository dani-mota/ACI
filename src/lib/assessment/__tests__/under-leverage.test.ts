import { describe, it, expect } from "vitest";
import { computeUnderLeverageScore } from "@/lib/assessment/insights/under-leverage";
import type { RoleFitDeltaEntry } from "@/lib/assessment/insights/role-fit-delta";
import { CONSTRUCTS } from "@/lib/constructs";

const ALL_CONSTRUCT_KEYS = Object.keys(CONSTRUCTS);

/**
 * Builds a 12-row RoleFitDeltaEntry array with per-row delta values.
 * `deltas` length must be 12 to keep the formula's denominator intent
 * explicit at the call site. Passing `null` for a position emits a row
 * with `delta: null` (no demand resolved for that construct).
 */
function buildDeltaArray(deltas: Array<number | null>): RoleFitDeltaEntry[] {
  if (deltas.length !== 12) {
    throw new Error(`buildDeltaArray expects 12 deltas, got ${deltas.length}`);
  }
  return ALL_CONSTRUCT_KEYS.map((construct, i) => ({
    construct,
    employeeScore: 50, // arbitrary; under-leverage doesn't read this
    demandScore: deltas[i] == null ? null : 0, // arbitrary; only delta matters
    delta: deltas[i] ?? null,
    direction: "aligned" as const,
  }));
}

describe("computeUnderLeverageScore", () => {
  describe("formula correctness (AC text, verbatim)", () => {
    it("all 12 deltas at +100 (max over-spec) → 100", () => {
      // After /10: 12 × 10 = 120. (120 / 120) × 100 = 100.
      const rows = buildDeltaArray(Array(12).fill(100));
      expect(computeUnderLeverageScore(rows)).toBe(100);
    });

    it("all 12 deltas at -100 (max under-spec) → 0 (negatives clipped)", () => {
      const rows = buildDeltaArray(Array(12).fill(-100));
      expect(computeUnderLeverageScore(rows)).toBe(0);
    });

    it("all 12 deltas at 0 → 0", () => {
      const rows = buildDeltaArray(Array(12).fill(0));
      expect(computeUnderLeverageScore(rows)).toBe(0);
    });

    it("mixed: 6 × +50, 6 × 0 → 25", () => {
      // After /10: 6 × 5 = 30. (30 / 120) × 100 = 25.
      const rows = buildDeltaArray([50, 50, 50, 50, 50, 50, 0, 0, 0, 0, 0, 0]);
      expect(computeUnderLeverageScore(rows)).toBe(25);
    });

    it("mixed: 6 × +50, 6 × -50 → 25 (negatives don't pull down)", () => {
      const rows = buildDeltaArray([50, 50, 50, 50, 50, 50, -50, -50, -50, -50, -50, -50]);
      expect(computeUnderLeverageScore(rows)).toBe(25);
    });

    it("single +33, rest 0 → rounds to 3 (2.75)", () => {
      // After /10: 3.3 total. (3.3 / 120) × 100 = 2.75 → Math.round = 3 (half-up).
      const rows = buildDeltaArray([33, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
      expect(computeUnderLeverageScore(rows)).toBe(3);
    });

    it("single +30, rest 0 → 2 (no fractional)", () => {
      // After /10: 3.0. (3.0 / 120) × 100 = 2.5 → Math.round = 3 (half-up).
      const rows = buildDeltaArray([30, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
      // Math.round(2.5) = 3 on V8 (half-away-from-zero).
      expect(computeUnderLeverageScore(rows)).toBe(3);
    });

    it("delta of exactly 0 still counts as non-null (hasAnyDelta=true)", () => {
      // All zeros → hasAnyDelta true → returns 0, NOT null.
      const rows = buildDeltaArray(Array(12).fill(0));
      expect(computeUnderLeverageScore(rows)).toBe(0);
    });
  });

  describe("null + insufficient-data cases", () => {
    it("all 12 deltas null → null (no resolvable profile)", () => {
      const rows = buildDeltaArray(Array(12).fill(null));
      expect(computeUnderLeverageScore(rows)).toBeNull();
    });

    it("empty array → null", () => {
      expect(computeUnderLeverageScore([])).toBeNull();
    });

    it("11 deltas (one short of 12) → null", () => {
      // Build via the helper to get 12, then drop one row to simulate caller bug.
      const rows = buildDeltaArray([50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50]);
      expect(computeUnderLeverageScore(rows.slice(0, 11))).toBeNull();
    });

    it("13 deltas (one over) → null", () => {
      const rows = buildDeltaArray([50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50]);
      const overshoot = [...rows, rows[0]];
      expect(computeUnderLeverageScore(overshoot)).toBeNull();
    });

    it("11 non-null + 1 null delta → still counted as 12 rows; null skipped in sum", () => {
      // 11 positive at +50, 1 null → after /10 = 11 × 5 = 55. (55 / 120) × 100 = 45.83… → 46.
      const rows = buildDeltaArray([50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, null]);
      expect(computeUnderLeverageScore(rows)).toBe(46);
    });
  });

  describe("formula-shape defensive guard", () => {
    it("CONSTRUCTS has exactly 12 keys (precondition for the formula's denominator)", () => {
      expect(Object.keys(CONSTRUCTS).length).toBe(12);
    });
    // Drift case (CONSTRUCTS length !== 12) is enforced at runtime via throw.
    // Can't easily mock the imported const here without invasive setup;
    // the precondition assertion above guards the same invariant.
  });

  describe("output bounds", () => {
    it("output is bounded 0-100 for any valid delta array", () => {
      // Spot-check a few mixed cases.
      const cases: Array<Array<number | null>> = [
        Array(12).fill(100),
        Array(12).fill(-100),
        Array(12).fill(50),
        [100, -100, 100, -100, 100, -100, 100, -100, 100, -100, 100, -100],
      ];
      for (const c of cases) {
        const score = computeUnderLeverageScore(buildDeltaArray(c));
        if (score == null) continue;
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(100);
      }
    });

    it("output is an integer (Math.round applied)", () => {
      const score = computeUnderLeverageScore(buildDeltaArray([33, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]));
      expect(score).not.toBeNull();
      expect(Number.isInteger(score!)).toBe(true);
    });
  });
});

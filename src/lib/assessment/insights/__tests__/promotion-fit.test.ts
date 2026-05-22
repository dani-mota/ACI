import { describe, it, expect } from "vitest";
import {
  computePromotionFit,
  renderVerdictString,
  type PromotionFitResult,
} from "@/lib/assessment/insights/promotion-fit";
import { CONSTRUCTS } from "@/lib/constructs";
import {
  LATERAL_TRIGGER_GAP_COUNT,
  LATERAL_TRIGGER_MAGNITUDE,
  STRETCH_MONTHS_PER_GAP,
} from "@/lib/assessment/insights/promotion-fit-thresholds";

const CK = Object.keys(CONSTRUCTS);
const [C1, C2, C3, C4] = [CK[0]!, CK[1]!, CK[2]!, CK[3]!];

/** Every construct at percentile p; lets us produce a "no gaps anywhere"
 *  baseline that we can then perturb construct-by-construct. */
function allAt(p: number) {
  return Object.keys(CONSTRUCTS).map((construct) => ({
    construct,
    percentile: p,
  }));
}
function demandAt(p: number) {
  return Object.keys(CONSTRUCTS).map((construct) => ({
    construct,
    demandScore: p,
  }));
}

describe("computePromotionFit", () => {
  describe("aligned_now verdict", () => {
    it("0 gaps → aligned_now", () => {
      const res = computePromotionFit(allAt(80), demandAt(80));
      expect(res.verdict).toBe("aligned_now");
      expect(res.gapCount).toBe(0);
      expect(res.monthsStretch).toBeUndefined();
      expect(res.stretchContext).toBeUndefined();
    });

    it("over-spec gaps do not count toward gapCount", () => {
      // Employee well above demand everywhere → all over_spec, no growth_edge.
      const res = computePromotionFit(allAt(90), demandAt(70));
      expect(res.verdict).toBe("aligned_now");
      expect(res.gapCount).toBe(0);
    });
  });

  describe("stretch verdict (middle case)", () => {
    it("1 small gap → stretch with N = 1 * STRETCH_MONTHS_PER_GAP", () => {
      // Employee aligned everywhere except C1: percentile 70 vs demand 80
      // → delta -10 → growth_edge, magnitude 10 (below LATERAL_TRIGGER_MAGNITUDE).
      const emp = allAt(80).map((s) =>
        s.construct === C1 ? { ...s, percentile: 70 } : s,
      );
      const res = computePromotionFit(emp, demandAt(80));
      expect(res.verdict).toBe("stretch");
      expect(res.gapCount).toBe(1);
      expect(res.monthsStretch).toBe(1 * STRETCH_MONTHS_PER_GAP);
      expect(res.stretchConstruct).toBe(C1);
      expect(res.stretchContext).toBeDefined();
      expect(res.stretchContext!.length).toBeGreaterThan(0);
    });

    it("2 small gaps → stretch with N = 2 * STRETCH_MONTHS_PER_GAP", () => {
      const emp = allAt(80).map((s) => {
        if (s.construct === C1 || s.construct === C2)
          return { ...s, percentile: 65 }; // delta -15, magnitude < 30
        return s;
      });
      const res = computePromotionFit(emp, demandAt(80));
      expect(res.verdict).toBe("stretch");
      expect(res.gapCount).toBe(2);
      expect(res.monthsStretch).toBe(2 * STRETCH_MONTHS_PER_GAP);
    });
  });

  describe("lateral verdict", () => {
    it("gapCount >= LATERAL_TRIGGER_GAP_COUNT → lateral", () => {
      // Three small gaps (none individually large) → lateral by count.
      const emp = allAt(80).map((s) => {
        if (s.construct === C1 || s.construct === C2 || s.construct === C3)
          return { ...s, percentile: 65 }; // delta -15
        return s;
      });
      const res = computePromotionFit(emp, demandAt(80));
      expect(res.gapCount).toBeGreaterThanOrEqual(LATERAL_TRIGGER_GAP_COUNT);
      expect(res.verdict).toBe("lateral");
      expect(res.monthsStretch).toBeUndefined();
      expect(res.stretchContext).toBeUndefined();
    });

    it("single very-large gap → lateral via magnitude", () => {
      // One gap of magnitude >= LATERAL_TRIGGER_MAGNITUDE dominates.
      const emp = allAt(80).map((s) =>
        s.construct === C1
          ? { ...s, percentile: 80 - LATERAL_TRIGGER_MAGNITUDE }
          : s,
      );
      const res = computePromotionFit(emp, demandAt(80));
      expect(res.gapCount).toBe(1);
      expect(res.verdict).toBe("lateral");
      expect(res.monthsStretch).toBeUndefined();
    });
  });

  describe("verdict strings (PRO-134 vocabulary lock)", () => {
    // Snapshot-style assertion of the three exact AC strings. If a future
    // refactor accidentally rewords any of these, this test fails — that's
    // the lock. Don't change these strings without also updating the AC.
    it("aligned_now string is AC verbatim", () => {
      const res: PromotionFitResult = {
        rows: [],
        verdict: "aligned_now",
        gapCount: 0,
      };
      expect(renderVerdictString(res)).toBe(
        "Profile aligns with next-level demands now",
      );
    });

    it("stretch string interpolates N and context, AC verbatim shape", () => {
      const res: PromotionFitResult = {
        rows: [],
        verdict: "stretch",
        gapCount: 2,
        monthsStretch: 6,
        stretchContext: "leading novel troubleshooting work",
        stretchConstruct: "FLUID_REASONING",
      };
      expect(renderVerdictString(res)).toBe(
        "Profile aligns with approximately 6 months of leading novel troubleshooting work",
      );
    });

    it("lateral string is AC verbatim", () => {
      const res: PromotionFitResult = {
        rows: [],
        verdict: "lateral",
        gapCount: 5,
      };
      expect(renderVerdictString(res)).toBe(
        "A lateral trajectory may be a stronger fit — see Trajectory Readiness",
      );
    });

    it("no verdict string contains evaluative vocabulary", () => {
      // PRO-134 rail: no "not ready", "failed", "insufficient", "deficit", etc.
      const banned = [
        "not ready",
        "failed",
        "failure",
        "insufficient",
        "deficit",
        "weak",
        "lack",
      ];
      const strings = [
        renderVerdictString({ rows: [], verdict: "aligned_now", gapCount: 0 }),
        renderVerdictString({
          rows: [],
          verdict: "stretch",
          gapCount: 1,
          monthsStretch: 3,
          stretchContext: "leading novel troubleshooting work",
          stretchConstruct: C1,
        }),
        renderVerdictString({ rows: [], verdict: "lateral", gapCount: 5 }),
      ];
      for (const s of strings) {
        for (const word of banned) {
          expect(s.toLowerCase()).not.toContain(word);
        }
      }
    });
  });

  describe("largest-gap selection (drives stretch context)", () => {
    it("picks the construct with the deepest under-spec gap", () => {
      // C1 gap -10 (small), C4 gap -25 (largest). stretchConstruct should be C4.
      // Two gaps total, none ≥ LATERAL_TRIGGER_MAGNITUDE (30) → stretch.
      const emp = allAt(80).map((s) => {
        if (s.construct === C1) return { ...s, percentile: 70 }; // -10
        if (s.construct === C4) return { ...s, percentile: 55 }; // -25
        return s;
      });
      const res = computePromotionFit(emp, demandAt(80));
      expect(res.verdict).toBe("stretch");
      expect(res.stretchConstruct).toBe(C4);
    });
  });
});

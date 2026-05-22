import { describe, it, expect } from "vitest";
import {
  computeTrajectoryReadiness,
  type ArchetypeFit,
} from "@/lib/assessment/insights/trajectory-readiness";
import type { RoleArchetype } from "@/lib/assessment/archetypes";
import { CONSTRUCTS } from "@/lib/constructs";

const ALL_CONSTRUCT_KEYS = Object.keys(CONSTRUCTS);

/** Builds a 12-row subtest result with a uniform percentile across all
 *  constructs. Override specific constructs via `overrides`. */
function buildScores(
  uniformPercentile: number,
  overrides: Partial<Record<string, number>> = {},
): { construct: string; percentile: number }[] {
  return ALL_CONSTRUCT_KEYS.map((construct) => ({
    construct,
    percentile: overrides[construct] ?? uniformPercentile,
  }));
}

/** Builds an archetype that demands `demand1to10` on every construct. */
function uniformArchetype(id: string, demand1to10: number): RoleArchetype {
  return {
    id,
    name: id,
    description: id,
    demands: Object.fromEntries(
      ALL_CONSTRUCT_KEYS.map((c) => [c, demand1to10]),
    ),
  };
}

/** Library of 10 uniform archetypes spanning the 1-10 demand scale. */
function uniformLibrary(): RoleArchetype[] {
  return Array.from({ length: 10 }, (_, i) =>
    uniformArchetype(`arch_${i + 1}`, i + 1),
  );
}

describe("computeTrajectoryReadiness", () => {
  describe("defensive bounds", () => {
    it("returns null when employee has fewer than 12 subtest results", () => {
      const scores = buildScores(50).slice(0, 11);
      const result = computeTrajectoryReadiness(scores, uniformLibrary());
      expect(result).toBeNull();
    });

    it("returns null when library has fewer than 7 archetypes", () => {
      const scores = buildScores(50);
      const library = uniformLibrary().slice(0, 6);
      const result = computeTrajectoryReadiness(scores, library);
      expect(result).toBeNull();
    });

    it("returns a result at exactly 12 scores + 7 archetypes (boundary)", () => {
      const scores = buildScores(50);
      const library = uniformLibrary().slice(0, 7);
      const result = computeTrajectoryReadiness(scores, library);
      expect(result).not.toBeNull();
      expect(result!.top).toHaveLength(5);
      expect(result!.bottom).toHaveLength(2);
    });
  });

  describe("output shape", () => {
    it("returns exactly 5 top + 2 bottom archetypes for a library of 10", () => {
      const result = computeTrajectoryReadiness(buildScores(50), uniformLibrary());
      expect(result).not.toBeNull();
      expect(result!.top).toHaveLength(5);
      expect(result!.bottom).toHaveLength(2);
    });

    it("top is sorted descending by fitScore", () => {
      const result = computeTrajectoryReadiness(buildScores(50), uniformLibrary())!;
      for (let i = 0; i < result.top.length - 1; i++) {
        expect(result.top[i].fitScore).toBeGreaterThanOrEqual(
          result.top[i + 1].fitScore,
        );
      }
    });

    it("bottom is sorted ascending — least aligned first", () => {
      const result = computeTrajectoryReadiness(buildScores(50), uniformLibrary())!;
      expect(result.bottom[0].fitScore).toBeLessThanOrEqual(
        result.bottom[1].fitScore,
      );
    });

    it("top and bottom never overlap with a 10-archetype library", () => {
      const result = computeTrajectoryReadiness(buildScores(50), uniformLibrary())!;
      const topIds = new Set(result.top.map((a) => a.archetypeId));
      const bottomIds = new Set(result.bottom.map((a) => a.archetypeId));
      for (const id of bottomIds) expect(topIds.has(id)).toBe(false);
    });
  });

  describe("fit score math (Euclidean)", () => {
    it("perfect match → fit score 100", () => {
      // Employee uniform at 70; archetype demands uniform 7 (× 10 = 70).
      const scores = buildScores(70);
      const library = uniformLibrary();
      const result = computeTrajectoryReadiness(scores, library)!;
      const perfect = result.top.concat(result.bottom).find(
        (a) => a.archetypeId === "arch_7",
      ) as ArchetypeFit;
      expect(perfect.fitScore).toBe(100);
    });

    it("max distance → fit score near 0", () => {
      // Employee uniform at 0; archetype demands uniform 10 (× 10 = 100).
      // Per construct diff = 100, max diff per construct = 100 → fit = 0.
      const scores = buildScores(0);
      const result = computeTrajectoryReadiness(scores, uniformLibrary())!;
      const worst = result.bottom.find((a) => a.archetypeId === "arch_10");
      expect(worst).toBeDefined();
      expect(worst!.fitScore).toBe(0);
    });

    it("ranks closer archetype higher than farther archetype", () => {
      // Employee uniform at 50; arch_5 (demand 5 → 50) should be the perfect fit.
      const scores = buildScores(50);
      const result = computeTrajectoryReadiness(scores, uniformLibrary())!;
      expect(result.top[0].archetypeId).toBe("arch_5");
      expect(result.top[0].fitScore).toBe(100);
    });
  });

  describe("driving constructs", () => {
    it("top rows surface 3 best-matching constructs (smallest |diff|)", () => {
      // Employee mostly at 50, except construct 0 spikes to 90.
      // Against arch_5 (demand 50 across), construct 0 has biggest diff (40);
      // other 11 have diff 0. Top row's drivers should be the 3 closest →
      // constructs other than ALL_CONSTRUCT_KEYS[0].
      const overrides = { [ALL_CONSTRUCT_KEYS[0]]: 90 };
      const scores = buildScores(50, overrides);
      const result = computeTrajectoryReadiness(scores, uniformLibrary())!;
      const arch5 = result.top.find((a) => a.archetypeId === "arch_5");
      expect(arch5).toBeDefined();
      expect(arch5!.drivingConstructs).toHaveLength(3);
      expect(arch5!.drivingConstructs).not.toContain(ALL_CONSTRUCT_KEYS[0]);
    });

    it("bottom rows surface 3 worst-matching constructs (largest |diff|)", () => {
      // Employee uniform at 50; arch_1 (demand 10) is the worst fit overall.
      // For arch_1, every construct has the same diff (40), so any 3 are
      // valid drivers. Just verify there are 3.
      const result = computeTrajectoryReadiness(buildScores(50), uniformLibrary())!;
      const worst = result.bottom[0];
      expect(worst.drivingConstructs).toHaveLength(3);
    });
  });
});

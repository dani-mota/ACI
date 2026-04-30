import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  computeRoleFitDelta,
  type FitDirection,
} from "@/lib/assessment/insights/role-fit-delta";
import { CONSTRUCTS } from "@/lib/constructs";

const ALL_CONSTRUCT_KEYS = Object.keys(CONSTRUCTS);
const FIRST = ALL_CONSTRUCT_KEYS[0]!;       // FLUID_REASONING
const SECOND = ALL_CONSTRUCT_KEYS[1]!;      // EXECUTIVE_CONTROL

function directionFor(rows: ReturnType<typeof computeRoleFitDelta>, construct: string): FitDirection {
  const row = rows.find((r) => r.construct === construct);
  if (!row) throw new Error(`row for ${construct} not found`);
  return row.direction;
}

describe("computeRoleFitDelta", () => {
  // ─── threshold boundaries ─────────────────────────────────────────────
  describe("threshold boundaries (>= semantics)", () => {
    it("delta = +9 → aligned", () => {
      const rows = computeRoleFitDelta(
        [{ construct: FIRST, percentile: 79 }],
        [{ construct: FIRST, demandScore: 70 }],
      );
      expect(directionFor(rows, FIRST)).toBe("aligned");
    });

    it("delta = +10 (exactly threshold) → over_spec", () => {
      const rows = computeRoleFitDelta(
        [{ construct: FIRST, percentile: 80 }],
        [{ construct: FIRST, demandScore: 70 }],
      );
      expect(directionFor(rows, FIRST)).toBe("over_spec");
    });

    it("delta = +11 → over_spec", () => {
      const rows = computeRoleFitDelta(
        [{ construct: FIRST, percentile: 81 }],
        [{ construct: FIRST, demandScore: 70 }],
      );
      expect(directionFor(rows, FIRST)).toBe("over_spec");
    });

    it("delta = -9 → aligned", () => {
      const rows = computeRoleFitDelta(
        [{ construct: FIRST, percentile: 61 }],
        [{ construct: FIRST, demandScore: 70 }],
      );
      expect(directionFor(rows, FIRST)).toBe("aligned");
    });

    it("delta = -10 (exactly threshold) → growth_edge", () => {
      const rows = computeRoleFitDelta(
        [{ construct: FIRST, percentile: 60 }],
        [{ construct: FIRST, demandScore: 70 }],
      );
      expect(directionFor(rows, FIRST)).toBe("growth_edge");
    });

    it("delta = -11 → growth_edge", () => {
      const rows = computeRoleFitDelta(
        [{ construct: FIRST, percentile: 59 }],
        [{ construct: FIRST, demandScore: 70 }],
      );
      expect(directionFor(rows, FIRST)).toBe("growth_edge");
    });
  });

  // ─── always 12 rows ──────────────────────────────────────────────────
  describe("always returns 12 rows in CONSTRUCTS order", () => {
    it("empty roleDemandProfile → 12 no_demand rows", () => {
      const rows = computeRoleFitDelta([], []);
      expect(rows).toHaveLength(12);
      expect(rows.every((r) => r.direction === "no_demand")).toBe(true);
      expect(rows.every((r) => r.demandScore === null)).toBe(true);
      expect(rows.every((r) => r.delta === null)).toBe(true);
    });

    it("single-entry profile → 1 classified row, 11 no_demand", () => {
      const rows = computeRoleFitDelta(
        [{ construct: FIRST, percentile: 80 }],
        [{ construct: FIRST, demandScore: 70 }],
      );
      expect(rows).toHaveLength(12);
      expect(rows.filter((r) => r.direction === "no_demand")).toHaveLength(11);
      expect(directionFor(rows, FIRST)).toBe("over_spec");
    });

    it("row order matches Object.keys(CONSTRUCTS) exactly", () => {
      const rows = computeRoleFitDelta([], []);
      const keys = rows.map((r) => r.construct);
      expect(keys).toEqual(ALL_CONSTRUCT_KEYS);
    });
  });

  // ─── partial profile (Decision #5) ───────────────────────────────────
  describe("partial profile (Decision #5)", () => {
    it("8 of 12 scored → 8 classified rows + 4 no_demand", () => {
      const eightConstructs = ALL_CONSTRUCT_KEYS.slice(0, 8);
      const rows = computeRoleFitDelta(
        eightConstructs.map((c) => ({ construct: c, percentile: 70 })),
        eightConstructs.map((c) => ({ construct: c, demandScore: 70 })),
      );
      expect(rows).toHaveLength(12);
      const classified = rows.filter((r) => r.direction !== "no_demand");
      const unscored = rows.filter((r) => r.direction === "no_demand");
      expect(classified).toHaveLength(8);
      expect(unscored).toHaveLength(4);
    });

    it("no_demand rows still report employee score", () => {
      // Profile only specifies FIRST. Employee was scored on SECOND too.
      const rows = computeRoleFitDelta(
        [
          { construct: FIRST, percentile: 80 },
          { construct: SECOND, percentile: 60 },
        ],
        [{ construct: FIRST, demandScore: 70 }],
      );
      const secondRow = rows.find((r) => r.construct === SECOND)!;
      expect(secondRow.direction).toBe("no_demand");
      expect(secondRow.employeeScore).toBe(60);
      expect(secondRow.demandScore).toBeNull();
      expect(secondRow.delta).toBeNull();
    });
  });

  // ─── missing employee score ──────────────────────────────────────────
  describe("missing employee score", () => {
    it("demand specified, no employee score → employeeScore defaults to 0", () => {
      const rows = computeRoleFitDelta(
        [],
        [{ construct: FIRST, demandScore: 70 }],
      );
      const row = rows.find((r) => r.construct === FIRST)!;
      expect(row.employeeScore).toBe(0);
      expect(row.delta).toBe(-70);
      expect(row.direction).toBe("growth_edge");
    });
  });

  // ─── unknown construct filter (Decision #6) ──────────────────────────
  describe("unknown construct filtering (Decision #6)", () => {
    let warnSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    });

    afterEach(() => {
      warnSpy.mockRestore();
      vi.unstubAllEnvs();
    });

    it("filters unknown construct from demand profile", () => {
      const rows = computeRoleFitDelta(
        [{ construct: FIRST, percentile: 80 }],
        [
          { construct: FIRST, demandScore: 70 },
          { construct: "FOO_BAR_NOT_REAL", demandScore: 50 },
        ],
      );
      // FOO_BAR_NOT_REAL is dropped — 12 rows from CONSTRUCTS, no extras.
      expect(rows).toHaveLength(12);
      expect(rows.find((r) => r.construct === "FOO_BAR_NOT_REAL")).toBeUndefined();
    });

    it("warns in non-production when an unknown construct is dropped", () => {
      vi.stubEnv("NODE_ENV", "test");
      computeRoleFitDelta(
        [],
        [{ construct: "FOO_BAR_NOT_REAL", demandScore: 50 }],
      );
      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy.mock.calls[0]?.[0]).toContain("FOO_BAR_NOT_REAL");
    });

    it("does NOT warn in production", () => {
      vi.stubEnv("NODE_ENV", "production");
      computeRoleFitDelta(
        [],
        [{ construct: "FOO_BAR_NOT_REAL", demandScore: 50 }],
      );
      expect(warnSpy).not.toHaveBeenCalled();
    });
  });
});

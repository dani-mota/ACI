import { describe, it, expect } from "vitest";
import { rawScoreToPercentile } from "../norm-tables";
import { computeAdaptiveScore } from "../adaptive-loop";
import type { ItemResult } from "../types";

function makeResult(correct: boolean, difficulty: number): ItemResult {
  return {
    itemId: `test-${Math.random().toString(36).slice(2)}`,
    construct: "QUANTITATIVE_REASONING" as any,
    correct,
    responseTimeMs: 20000,
    difficulty,
    candidateResponse: correct ? "A" : "B",
  };
}

describe("rawScoreToPercentile", () => {
  it("maps 0 raw score to a low percentile", () => {
    const pct = rawScoreToPercentile("QUANTITATIVE_REASONING", 0);
    expect(pct).toBeGreaterThanOrEqual(1);
    expect(pct).toBeLessThanOrEqual(10);
  });

  it("maps 1.0 raw score to a high percentile", () => {
    const pct = rawScoreToPercentile("QUANTITATIVE_REASONING", 1.0);
    expect(pct).toBeGreaterThanOrEqual(90);
    expect(pct).toBeLessThanOrEqual(99);
  });

  it("maps 0.5 raw score near the 50th percentile", () => {
    const pct = rawScoreToPercentile("QUANTITATIVE_REASONING", 0.5);
    // With -0.05 offset for QR, adjusted score = 0.45
    // Should be below 50th percentile
    expect(pct).toBeGreaterThan(30);
    expect(pct).toBeLessThan(60);
  });

  it("always returns percentile between 1 and 99", () => {
    for (const score of [-0.5, 0, 0.1, 0.5, 0.9, 1.0, 1.5]) {
      const pct = rawScoreToPercentile("QUANTITATIVE_REASONING", score);
      expect(pct).toBeGreaterThanOrEqual(1);
      expect(pct).toBeLessThanOrEqual(99);
    }
  });

  it("returns higher percentile for higher raw score (monotonic)", () => {
    const scores = [0.1, 0.3, 0.5, 0.7, 0.9];
    const percentiles = scores.map((s) => rawScoreToPercentile("SPATIAL_VISUALIZATION", s));
    for (let i = 1; i < percentiles.length; i++) {
      expect(percentiles[i]).toBeGreaterThanOrEqual(percentiles[i - 1]);
    }
  });

  it("applies difficulty offset for FLUID_REASONING (harder items)", () => {
    // FR has -0.05 offset → adjusted = rawScore - (-0.05) = rawScore + 0.05
    // Higher adjusted score → higher percentile (compensates for harder items)
    const frPct = rawScoreToPercentile("FLUID_REASONING", 0.5);
    const svPct = rawScoreToPercentile("SPATIAL_VISUALIZATION", 0.5); // 0 offset
    expect(frPct).toBeGreaterThanOrEqual(svPct);
  });

  it("applies positive offset for PROCEDURAL_RELIABILITY (Likert bias)", () => {
    // PR has +0.1 offset → adjusted score lower → lower percentile
    const prPct = rawScoreToPercentile("PROCEDURAL_RELIABILITY", 0.6);
    const svPct = rawScoreToPercentile("SPATIAL_VISUALIZATION", 0.6);
    expect(prPct).toBeLessThanOrEqual(svPct);
  });
});

describe("scoring integration", () => {
  it("adaptive score feeds correctly into percentile", () => {
    const state = {
      construct: "QUANTITATIVE_REASONING" as any,
      phase: "CALIBRATION" as any,
      calibrationResults: [
        makeResult(true, 0.3),
        makeResult(true, 0.5),
        makeResult(false, 0.7),
      ],
      boundaryResults: [],
      pressureResults: [],
      probeExchanges: [],
      boundary: null,
      itemsServed: [],
    };

    const score = computeAdaptiveScore(state);
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThan(1);

    const percentile = rawScoreToPercentile("QUANTITATIVE_REASONING", score);
    expect(percentile).toBeGreaterThanOrEqual(1);
    expect(percentile).toBeLessThanOrEqual(99);
  });

  it("perfect score maps to high percentile", () => {
    const state = {
      construct: "SPATIAL_VISUALIZATION" as any,
      phase: "CALIBRATION" as any,
      calibrationResults: [
        makeResult(true, 0.3),
        makeResult(true, 0.5),
        makeResult(true, 0.7),
        makeResult(true, 0.9),
      ],
      boundaryResults: [],
      pressureResults: [],
      probeExchanges: [],
      boundary: null,
      itemsServed: [],
    };

    const score = computeAdaptiveScore(state);
    expect(score).toBeCloseTo(1.0);

    const percentile = rawScoreToPercentile("SPATIAL_VISUALIZATION", score);
    expect(percentile).toBeGreaterThanOrEqual(90);
  });
});

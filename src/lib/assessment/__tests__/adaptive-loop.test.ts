import { describe, it, expect } from "vitest";
import { initLoopState, getNextItem, recordResult, computeAdaptiveScore } from "../adaptive-loop";
import type { ItemResult } from "../types";

function makeResult(itemId: string, correct: boolean, difficulty: number): ItemResult {
  return {
    itemId,
    construct: "QUANTITATIVE_REASONING" as any,
    correct,
    responseTimeMs: 15000,
    difficulty,
    candidateResponse: correct ? "A" : "B",
  };
}

describe("initLoopState", () => {
  it("initializes with CALIBRATION phase", () => {
    const state = initLoopState("QUANTITATIVE_REASONING" as any);
    expect(state.phase).toBe("CALIBRATION");
    expect(state.construct).toBe("QUANTITATIVE_REASONING");
    expect(state.calibrationResults).toHaveLength(0);
    expect(state.boundaryResults).toHaveLength(0);
    expect(state.pressureResults).toHaveLength(0);
    expect(state.itemsServed).toHaveLength(0);
    expect(state.boundary).toBeNull();
  });
});

describe("getNextItem", () => {
  it("returns an item for CALIBRATION phase", () => {
    const state = initLoopState("QUANTITATIVE_REASONING" as any);
    const item = getNextItem(state);
    expect(item).not.toBeNull();
    expect(item!.construct).toBe("QUANTITATIVE_REASONING");
  });

  it("returns null for DIAGNOSTIC_PROBE phase", () => {
    const state = { ...initLoopState("QUANTITATIVE_REASONING" as any), phase: "DIAGNOSTIC_PROBE" as any };
    const item = getNextItem(state);
    expect(item).toBeNull();
  });

  it("does not re-serve items already served", () => {
    const state = initLoopState("QUANTITATIVE_REASONING" as any);
    const item1 = getNextItem(state);
    expect(item1).not.toBeNull();

    const state2 = { ...state, itemsServed: [item1!.id] };
    const item2 = getNextItem(state2);
    expect(item2).not.toBeNull();
    expect(item2!.id).not.toBe(item1!.id);
  });
});

describe("recordResult", () => {
  it("transitions from CALIBRATION to BOUNDARY_MAPPING after 3 items", () => {
    let state = initLoopState("QUANTITATIVE_REASONING" as any);

    // Record 3 calibration results
    for (let i = 0; i < 3; i++) {
      const result = makeResult(`qr-e${i + 1}`, true, 0.25);
      const { state: next, phaseTransition, nextPhase } = recordResult(state, result);
      state = next;
      if (i < 2) {
        expect(phaseTransition).toBe(false);
      } else {
        expect(phaseTransition).toBe(true);
        expect(nextPhase).toBe("BOUNDARY_MAPPING");
      }
    }

    expect(state.phase).toBe("BOUNDARY_MAPPING");
    expect(state.calibrationResults).toHaveLength(3);
  });

  it("adds results to the correct phase array", () => {
    const state = initLoopState("QUANTITATIVE_REASONING" as any);
    const result = makeResult("qr-e1", true, 0.25);
    const { state: next } = recordResult(state, result);
    expect(next.calibrationResults).toHaveLength(1);
    expect(next.calibrationResults[0].itemId).toBe("qr-e1");
  });

  it("tracks served items", () => {
    const state = initLoopState("QUANTITATIVE_REASONING" as any);
    const result = makeResult("qr-e1", true, 0.25);
    const { state: next } = recordResult(state, result);
    expect(next.itemsServed).toContain("qr-e1");
  });
});

describe("computeAdaptiveScore", () => {
  it("returns 0 for empty results", () => {
    const state = initLoopState("QUANTITATIVE_REASONING" as any);
    expect(computeAdaptiveScore(state)).toBe(0);
  });

  it("returns 1.0 for all correct answers", () => {
    const state = {
      ...initLoopState("QUANTITATIVE_REASONING" as any),
      calibrationResults: [
        makeResult("q1", true, 0.5),
        makeResult("q2", true, 0.5),
        makeResult("q3", true, 0.5),
      ],
    };
    expect(computeAdaptiveScore(state)).toBeCloseTo(1.0);
  });

  it("returns 0 for all incorrect answers", () => {
    const state = {
      ...initLoopState("QUANTITATIVE_REASONING" as any),
      calibrationResults: [
        makeResult("q1", false, 0.5),
        makeResult("q2", false, 0.5),
      ],
    };
    expect(computeAdaptiveScore(state)).toBe(0);
  });

  it("weights harder items more", () => {
    // 1 correct hard item (difficulty 0.8) vs 1 correct easy item (difficulty 0.2)
    const stateHard = {
      ...initLoopState("QUANTITATIVE_REASONING" as any),
      calibrationResults: [makeResult("q1", true, 0.8)],
    };
    const stateEasy = {
      ...initLoopState("QUANTITATIVE_REASONING" as any),
      calibrationResults: [makeResult("q1", true, 0.2)],
    };
    // Both should be 1.0 since they got it right
    expect(computeAdaptiveScore(stateHard)).toBe(1.0);
    expect(computeAdaptiveScore(stateEasy)).toBe(1.0);

    // Mixed: correct hard + incorrect easy should score higher than
    // correct easy + incorrect hard
    const stateMixed1 = {
      ...initLoopState("QUANTITATIVE_REASONING" as any),
      calibrationResults: [
        makeResult("q1", true, 0.8),
        makeResult("q2", false, 0.2),
      ],
    };
    const stateMixed2 = {
      ...initLoopState("QUANTITATIVE_REASONING" as any),
      calibrationResults: [
        makeResult("q1", false, 0.8),
        makeResult("q2", true, 0.2),
      ],
    };
    expect(computeAdaptiveScore(stateMixed1)).toBeGreaterThan(computeAdaptiveScore(stateMixed2));
  });

  it("combines results from all phases", () => {
    const state = {
      ...initLoopState("QUANTITATIVE_REASONING" as any),
      calibrationResults: [makeResult("q1", true, 0.3)],
      boundaryResults: [makeResult("q2", false, 0.6)],
      pressureResults: [makeResult("q3", true, 0.8)],
    };
    const score = computeAdaptiveScore(state);
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThan(1);
  });
});

// Fix: PRO-18 — contradiction window calibration tests
describe("pressure test contradiction window", () => {
  it("correct answer at difficulty=0.55 with boundary=0.7 does NOT trigger contradiction", () => {
    const state = {
      ...initLoopState("QUANTITATIVE_REASONING" as any),
      phase: "PRESSURE_TEST" as const,
      boundary: { estimatedBoundary: 0.7, confirmedCeiling: 0.9, confirmedFloor: 0.3, confidence: 0.5, itemResults: [], construct: "QUANTITATIVE_REASONING" as any },
      pressureResults: [] as ItemResult[],
      calibrationResults: [makeResult("c1", true, 0.3)],
      boundaryResults: [makeResult("b1", false, 0.7)],
    };
    // Difficulty 0.55 is 0.15 away from boundary 0.7 — outside ±0.1 window
    const result = recordResult(state, makeResult("p1", true, 0.55));
    // Should not loop back to BOUNDARY_MAPPING (contradiction)
    expect(result.state.phase).not.toBe("BOUNDARY_MAPPING");
  });

  it("wrong answer at difficulty=0.75 with boundary=0.7 IS within contradiction window", () => {
    const state = {
      ...initLoopState("QUANTITATIVE_REASONING" as any),
      phase: "PRESSURE_TEST" as const,
      boundary: { estimatedBoundary: 0.7, confirmedCeiling: 0.9, confirmedFloor: 0.3, confidence: 0.5, itemResults: [], construct: "QUANTITATIVE_REASONING" as any },
      pressureResults: [makeResult("p0", true, 0.65)] as ItemResult[],
      calibrationResults: [makeResult("c1", true, 0.3)],
      boundaryResults: [makeResult("b1", false, 0.7)],
    };
    // Difficulty 0.75 is 0.05 away from boundary 0.7 — inside ±0.1 window
    const result = recordResult(state, makeResult("p1", true, 0.75));
    // Two results at boundary with 100% correct rate → should flag contradiction
    expect(result.state.phase).toBe("BOUNDARY_MAPPING");
  });
});

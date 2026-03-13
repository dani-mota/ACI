import { describe, it, expect } from "vitest";
import { computeProgress, buildGreetingPrompt } from "../engine";

// Mock AssessmentState for testing
function mockState(overrides: Record<string, unknown> = {}) {
  return {
    id: "test-state",
    assessmentId: "test-assessment",
    currentAct: "ACT_1",
    currentScenario: 0,
    currentBeat: 0,
    currentConstruct: null,
    currentPhase: null,
    branchPath: null,
    act2Progress: null,
    act3Progress: null,
    contentLibraryId: null,
    variantSelections: null,
    phase0Complete: true,
    isComplete: false,
    realtimeTokensIn: 0,
    realtimeTokensOut: 0,
    act1CompletedAt: null,
    act2CompletedAt: null,
    act3CompletedAt: null,
    updatedAt: new Date(),
    createdAt: new Date(),
    ...overrides,
  } as any;
}

describe("computeProgress", () => {
  it("returns 0 progress at start of assessment", () => {
    const state = mockState();
    const progress = computeProgress(state);
    expect(progress.act1).toBe(0);
    expect(progress.act2).toBe(0);
    expect(progress.act3).toBe(0);
  });

  it("computes act1 progress correctly", () => {
    // 4 scenarios × 6 beats = 24 total steps
    // At scenario 1, beat 3 = (1*6 + 3) / 24 = 9/24 = 0.375
    const state = mockState({ currentScenario: 1, currentBeat: 3 });
    const progress = computeProgress(state);
    expect(progress.act1).toBeCloseTo(0.375);
  });

  it("caps act1 progress at 1", () => {
    const state = mockState({ currentScenario: 10, currentBeat: 5 });
    const progress = computeProgress(state);
    expect(progress.act1).toBe(1);
  });

  it("computes act2 progress from completed constructs", () => {
    const state = mockState({
      act2Progress: {
        QUANTITATIVE_REASONING: {
          phase: "DIAGNOSTIC_PROBE",
          probeExchanges: [{ role: "complete" }],
        },
        SPATIAL_VISUALIZATION: {
          phase: "CALIBRATION",
          probeExchanges: [],
        },
      },
    });
    const progress = computeProgress(state);
    // 1 of 5 constructs complete = 0.2
    expect(progress.act2).toBeCloseTo(0.2);
  });

  it("computes act3 progress from confidence, parallel, self-assessment", () => {
    const state = mockState({
      act3Progress: {
        confidenceItemsComplete: 2, // of 3 → 0.667 × 0.4 = 0.267
        parallelScenariosComplete: 1, // of 2 → 0.5 × 0.35 = 0.175
        selfAssessmentTurn: 1, // of 3 → 0.333 × 0.25 = 0.083
        selfAssessmentComplete: false,
      },
    });
    const progress = computeProgress(state);
    expect(progress.act3).toBeCloseTo(0.525, 1);
  });

  it("gives full act3 progress when everything is complete", () => {
    const state = mockState({
      act3Progress: {
        confidenceItemsComplete: 3,
        parallelScenariosComplete: 2,
        selfAssessmentComplete: true,
        selfAssessmentTurn: 3,
      },
    });
    const progress = computeProgress(state);
    expect(progress.act3).toBeCloseTo(1.0);
  });
});

describe("buildGreetingPrompt", () => {
  it("includes candidate name", () => {
    const prompt = buildGreetingPrompt("Alice", "ACME Corp");
    expect(prompt).toContain("Alice");
  });

  it("includes company name", () => {
    const prompt = buildGreetingPrompt("Bob", "Arklight");
    expect(prompt).toContain("Arklight");
  });

  it("returns a non-empty string", () => {
    const prompt = buildGreetingPrompt("Charlie", "TestCo");
    expect(prompt.length).toBeGreaterThan(50);
  });
});

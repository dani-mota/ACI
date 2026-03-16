import { describe, it, expect } from "vitest";
import { validateTurn, AssessmentTurnResponseSchema } from "@/lib/assessment/validation/turn-schema";
import type { AssessmentTurnResponse } from "@/lib/types/turn";

function makeTurn(overrides: Partial<AssessmentTurnResponse> = {}): AssessmentTurnResponse {
  return {
    type: "turn",
    delivery: { sentences: ["Hello, let's begin."] },
    input: { type: "voice-or-text" },
    signal: {
      format: "OPEN_PROBE",
      act: "ACT_1",
      primaryConstructs: ["COGNITIVE_FLEXIBILITY"],
      secondaryConstructs: [],
      scenarioIndex: 0,
      beatIndex: 1,
      beatType: "INITIAL_RESPONSE",
    },
    meta: {
      progress: { act1: 0.1, act2: 0, act3: 0 },
      generationMethod: "hybrid",
    },
    ...overrides,
  };
}

describe("AssessmentTurnResponseSchema", () => {
  it("accepts a valid Open Probe turn", () => {
    const result = validateTurn(makeTurn());
    expect(result.success).toBe(true);
  });

  it("accepts a valid Scenario Setup turn with reference card", () => {
    const turn = makeTurn({
      delivery: {
        sentences: ["You're a lead maintenance technician."],
        referenceCard: {
          role: "Lead Maintenance Technician",
          context: "Night shift, skeleton crew",
          sections: [{ label: "System", items: ["Coolant loop", "8% pressure drop"] }],
          question: "What's your first move?",
        },
      },
      input: { type: "none" },
      signal: {
        format: "SCENARIO_SETUP",
        act: "ACT_1",
        primaryConstructs: ["SYSTEMS_DIAGNOSTICS"],
        secondaryConstructs: ["FLUID_REASONING"],
        scenarioIndex: 0,
        beatIndex: 0,
        beatType: "INITIAL_SITUATION",
      },
      meta: {
        progress: { act1: 0.04, act2: 0, act3: 0 },
        generationMethod: "scripted",
      },
    });
    const result = validateTurn(turn);
    expect(result.success).toBe(true);
  });

  it("accepts a valid Act 2 Multiple Choice turn", () => {
    const turn = makeTurn({
      delivery: {
        sentences: ["What is the tolerance stack-up?"],
        interactiveElement: {
          elementType: "MULTIPLE_CHOICE_INLINE",
          prompt: "What is the tolerance stack-up?",
          options: ["0.002", "0.004", "0.006", "0.008"],
          itemId: "qr-003",
          construct: "QUANTITATIVE_REASONING",
        },
      },
      input: { type: "select", options: ["A", "B", "C", "D"] },
      signal: {
        format: "MULTIPLE_CHOICE",
        act: "ACT_2",
        primaryConstructs: ["QUANTITATIVE_REASONING"],
        secondaryConstructs: [],
        constructId: "QUANTITATIVE_REASONING",
        itemId: "qr-003",
        difficulty: 0.6,
        phase: "RAPID_CONVERGENCE",
      },
      meta: {
        progress: { act1: 1, act2: 0.2, act3: 0 },
        generationMethod: "scripted",
      },
    });
    const result = validateTurn(turn);
    expect(result.success).toBe(true);
  });

  it("rejects Act 2 structured format missing itemId", () => {
    const turn = makeTurn({
      signal: {
        format: "MULTIPLE_CHOICE",
        act: "ACT_2",
        primaryConstructs: ["QUANTITATIVE_REASONING"],
        secondaryConstructs: [],
        // Missing: itemId, constructId, difficulty
      },
      meta: {
        progress: { act1: 1, act2: 0.1, act3: 0 },
        generationMethod: "scripted",
      },
    });
    const result = validateTurn(turn);
    expect(result.success).toBe(false);
  });

  it("rejects invalid type field", () => {
    const result = AssessmentTurnResponseSchema.safeParse({ type: "message" });
    expect(result.success).toBe(false);
  });

  it("rejects invalid format", () => {
    const turn = makeTurn();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (turn.signal as any).format = "INVALID_FORMAT";
    const result = validateTurn(turn);
    expect(result.success).toBe(false);
  });

  it("rejects invalid construct", () => {
    const turn = makeTurn();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (turn.signal as any).primaryConstructs = ["NOT_A_CONSTRUCT"];
    const result = validateTurn(turn);
    expect(result.success).toBe(false);
  });

  it("accepts a Transition turn", () => {
    const turn = makeTurn({
      delivery: { sentences: ["You handled those well. Now we shift gears."] },
      input: { type: "none" },
      signal: {
        format: "TRANSITION",
        act: "ACT_1",
        primaryConstructs: [],
        secondaryConstructs: [],
      },
      meta: {
        progress: { act1: 1, act2: 0, act3: 0 },
        generationMethod: "scripted",
        transition: { from: "ACT_1", to: "ACT_2" },
      },
    });
    const result = validateTurn(turn);
    expect(result.success).toBe(true);
  });

  it("accepts a Completion turn", () => {
    const turn = makeTurn({
      delivery: { sentences: ["That's everything. Thank you."] },
      input: { type: "none" },
      signal: {
        format: "COMPLETION",
        act: "ACT_3",
        primaryConstructs: [],
        secondaryConstructs: [],
      },
      meta: {
        progress: { act1: 1, act2: 1, act3: 1 },
        generationMethod: "scripted",
        isComplete: true,
      },
    });
    const result = validateTurn(turn);
    expect(result.success).toBe(true);
  });

  it("rejects progress values outside 0-1", () => {
    const turn = makeTurn();
    turn.meta.progress.act1 = 1.5;
    const result = validateTurn(turn);
    expect(result.success).toBe(false);
  });
});

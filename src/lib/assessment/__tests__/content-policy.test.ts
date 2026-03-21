import { describe, it, expect } from "vitest";
import { applyContentPolicy, jaccardSimilarity } from "../content-policy";
import type { AssessmentTurnResponse } from "@/lib/types/turn";
import type { TurnBuilderContext } from "../turn-builders/context";

// ── Test helpers ────────────────────────────────────────

function makeTurn(overrides: Partial<AssessmentTurnResponse> = {}): AssessmentTurnResponse {
  return {
    type: "turn",
    delivery: {
      sentences: ["This is a test sentence about the situation.", "What would you do first?"],
      ...(overrides.delivery ?? {}),
    },
    input: { type: "voice-or-text", ...(overrides.input ?? {}) },
    signal: {
      format: "OPEN_PROBE" as any,
      act: "ACT_1" as any,
      primaryConstructs: ["FLUID_REASONING"],
      secondaryConstructs: [],
      scenarioIndex: 0,
      beatIndex: 1,
      beatType: "INITIAL_RESPONSE",
      ...(overrides.signal ?? {}),
    },
    meta: {
      progress: { act1: 10, act2: 0, act3: 0 },
      generationMethod: "streamed" as any,
      isComplete: false,
      ...(overrides.meta ?? {}),
    },
  };
}

function makeCtx(overrides: Partial<TurnBuilderContext> = {}): TurnBuilderContext {
  return {
    action: { type: "AGENT_MESSAGE" } as any,
    state: {
      id: "test-state",
      assessmentId: "test-assessment",
      currentAct: "ACT_1" as any,
      currentScenario: 0,
      currentBeat: 1,
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
    } as any,
    messages: [],
    isSentinel: false,
    roleContext: null,
    assessmentId: "test-assessment",
    ...overrides,
  };
}

// ── Jaccard Similarity ──────────────────────────────────

describe("jaccardSimilarity", () => {
  it("returns 1.0 for identical strings", () => {
    expect(jaccardSimilarity("hello world", "hello world")).toBe(1.0);
  });

  it("returns 0.0 for completely different strings", () => {
    expect(jaccardSimilarity("hello world", "foo bar baz")).toBe(0.0);
  });

  it("returns partial overlap correctly", () => {
    const sim = jaccardSimilarity("the quick brown fox", "the slow brown dog");
    // intersection: {the, brown} = 2, union: {the, quick, brown, fox, slow, dog} = 6
    expect(sim).toBeCloseTo(2 / 6, 2);
  });

  it("ignores punctuation", () => {
    expect(jaccardSimilarity("hello, world!", "hello world")).toBe(1.0);
  });

  it("is case-insensitive", () => {
    expect(jaccardSimilarity("Hello World", "hello world")).toBe(1.0);
  });
});

// ── Rule 1: Question enforcement ────────────────────────

describe("Rule 1: question enforcement", () => {
  it("appends probe when Turn has no question", () => {
    const turn = makeTurn({
      delivery: { sentences: ["Here is some information about the situation.", "The pressure is mounting."] },
    });
    const result = applyContentPolicy(turn, makeCtx());
    const lastSentence = result.delivery.sentences[result.delivery.sentences.length - 1];
    expect(lastSentence).toContain("?");
  });

  it("leaves Turn unchanged when last sentence has question", () => {
    const turn = makeTurn({
      delivery: { sentences: ["Here is information.", "What would you do first?"] },
    });
    const result = applyContentPolicy(turn, makeCtx());
    expect(result.delivery.sentences).toHaveLength(2);
  });

  it("leaves Turn unchanged when second-to-last has question", () => {
    const turn = makeTurn({
      delivery: { sentences: ["What do you think?", "Take your time."] },
    });
    const result = applyContentPolicy(turn, makeCtx());
    expect(result.delivery.sentences).toHaveLength(2);
  });

  it("skips for INITIAL_SITUATION (Beat 0 narration)", () => {
    const turn = makeTurn({
      delivery: { sentences: ["You are in a factory.", "The machines are running."] },
      signal: { format: "SCENARIO_SETUP" as any, act: "ACT_1" as any, primaryConstructs: [], secondaryConstructs: [], beatType: "INITIAL_SITUATION", scenarioIndex: 0, beatIndex: 0 },
    });
    const result = applyContentPolicy(turn, makeCtx({ state: { ...makeCtx().state, currentBeat: 0 } as any }));
    expect(result.delivery.sentences).toHaveLength(2); // unchanged
  });

  it("skips for input.type === 'none' (auto-advance)", () => {
    const turn = makeTurn({
      delivery: { sentences: ["Moving to the next section."] },
      input: { type: "none" },
    });
    const result = applyContentPolicy(turn, makeCtx());
    expect(result.delivery.sentences).toHaveLength(1); // unchanged
  });
});

// ── Rule 2: Acknowledgment enforcement ──────────────────

describe("Rule 2: acknowledgment enforcement", () => {
  it("prepends acknowledgment when first sentence is long and ack available", () => {
    const longFirstSentence = "The injection molding process involves multiple stages of heating and cooling that require precise temperature control and monitoring of various parameters throughout the entire production cycle to ensure consistent quality across all output stations on the factory floor.";
    const turn = makeTurn({
      delivery: { sentences: [longFirstSentence, "What would you do?"] },
    });
    const ctx = makeCtx({ acknowledgment: "That's an insightful observation." });
    const result = applyContentPolicy(turn, ctx);
    expect(result.delivery.sentences[0]).toBe("That's an insightful observation.");
    expect(result.delivery.sentences).toHaveLength(3);
  });

  it("leaves unchanged when first sentence is short (likely already acknowledging)", () => {
    const turn = makeTurn({
      delivery: { sentences: ["Good point about the timing.", "What would you do?"] },
    });
    const ctx = makeCtx({ acknowledgment: "That's interesting." });
    const result = applyContentPolicy(turn, ctx);
    expect(result.delivery.sentences).toHaveLength(2); // unchanged
  });

  it("skips for sentinel turns", () => {
    const turn = makeTurn({
      delivery: { sentences: ["Let me continue.", "What next?"] },
    });
    const ctx = makeCtx({ isSentinel: true, acknowledgment: "Great point." });
    const result = applyContentPolicy(turn, ctx);
    expect(result.delivery.sentences[0]).not.toBe("Great point.");
  });

  it("skips when no acknowledgment in context", () => {
    const longSentence = "The injection molding process involves multiple stages of heating and cooling that require precise control.";
    const turn = makeTurn({ delivery: { sentences: [longSentence, "What next?"] } });
    const ctx = makeCtx(); // no acknowledgment
    const result = applyContentPolicy(turn, ctx);
    expect(result.delivery.sentences).toHaveLength(2); // unchanged
  });
});

// ── Rule 3: Deduplication ───────────────────────────────

describe("Rule 3: deduplication", () => {
  it("replaces Turn when >80% similar to recent agent message", () => {
    const turn = makeTurn({
      delivery: { sentences: ["What would you do in this situation?", "How would you approach it?"] },
    });
    const ctx = makeCtx({
      messages: [
        { role: "AGENT", act: "ACT_1", content: "What would you do in this situation? How would you approach it?" } as any,
      ],
    });
    const result = applyContentPolicy(turn, ctx);
    // Should be replaced with redirect + probe
    expect(result.delivery.sentences.join(" ")).not.toContain("What would you do in this situation");
    expect(result.delivery.sentences.some((s) => s.includes("?"))).toBe(true);
  });

  it("leaves unchanged when similarity is low", () => {
    const turn = makeTurn({
      delivery: { sentences: ["The temperature readings show a concerning pattern.", "What do you make of that?"] },
    });
    const ctx = makeCtx({
      messages: [
        { role: "AGENT", act: "ACT_1", content: "Welcome to the factory floor. The machines are running." } as any,
      ],
    });
    const result = applyContentPolicy(turn, ctx);
    expect(result.delivery.sentences[0]).toContain("temperature");
  });
});

// ── Rule 4: Hardcoded fallback catch ────────────────────

describe("Rule 4: hardcoded fallback catch", () => {
  it("replaces Turn containing 'Let me rephrase that'", () => {
    const turn = makeTurn({
      delivery: { sentences: ["Let me rephrase that.", "Tell me more about how you'd approach this situation."] },
    });
    const result = applyContentPolicy(turn, makeCtx());
    const joined = result.delivery.sentences.join(" ");
    expect(joined).not.toContain("Let me rephrase that");
    expect(joined).toContain("?"); // Should have a real probe question
  });

  it("leaves normal Turn unchanged", () => {
    const turn = makeTurn({
      delivery: { sentences: ["The situation has changed.", "How does that affect your plan?"] },
    });
    const result = applyContentPolicy(turn, makeCtx());
    expect(result.delivery.sentences[0]).toBe("The situation has changed.");
  });
});

// ── Rule 5: Silence recovery ────────────────────────────

describe("Rule 5: silence recovery", () => {
  it("replaces directive first sentence after [NO_RESPONSE]", () => {
    const turn = makeTurn({
      delivery: { sentences: ["Tell me more about the approach.", "What would you do?"] },
    });
    const ctx = makeCtx({ isSentinel: true, lastCandidateMessage: "[NO_RESPONSE]" });
    const result = applyContentPolicy(turn, ctx);
    expect(result.delivery.sentences[0]).not.toContain("Tell me more");
    // Supportive phrase selected by beatIndex % 3 — beatIndex=1 selects "That's okay..."
    expect(result.delivery.sentences[0]).toMatch(/No worries|That's okay|I know there's a lot/);
  });

  it("leaves non-directive first sentence unchanged after [NO_RESPONSE]", () => {
    const turn = makeTurn({
      delivery: { sentences: ["Here's another angle on this.", "What would you do?"] },
    });
    const ctx = makeCtx({ isSentinel: true, lastCandidateMessage: "[NO_RESPONSE]" });
    const result = applyContentPolicy(turn, ctx);
    expect(result.delivery.sentences[0]).toBe("Here's another angle on this.");
  });

  it("skips for non-sentinel turns", () => {
    const turn = makeTurn({
      delivery: { sentences: ["Tell me more about the approach.", "What next?"] },
    });
    const ctx = makeCtx({ isSentinel: false });
    const result = applyContentPolicy(turn, ctx);
    expect(result.delivery.sentences[0]).toBe("Tell me more about the approach.");
  });
});

// ── Integration: Multiple rules ─────────────────────────

describe("Integration: multiple rules applied", () => {
  it("applies silence recovery + question enforcement together", () => {
    const turn = makeTurn({
      delivery: { sentences: ["Tell me more about this.", "The pressure is increasing."] },
    });
    const ctx = makeCtx({ isSentinel: true, lastCandidateMessage: "[NO_RESPONSE]" });
    const result = applyContentPolicy(turn, ctx);
    // Rule 5: first sentence replaced (supportive)
    expect(result.delivery.sentences[0]).not.toContain("Tell me more");
    // Rule 1: question appended (no ? in original)
    const lastSentence = result.delivery.sentences[result.delivery.sentences.length - 1];
    expect(lastSentence).toContain("?");
  });
});

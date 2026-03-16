import { describe, it, expect } from "vitest";
import { checkLeakage } from "@/lib/assessment/filters/leakage";

describe("checkLeakage", () => {
  it("passes clean conversational text", () => {
    const text = "That's a strong approach. You mentioned checking the calibration logs — that shows good instinct.";
    const result = checkLeakage(text);
    expect(result.leaked).toBe(false);
    expect(result.matches).toHaveLength(0);
  });

  it("catches construct name: fluid reasoning", () => {
    const text = "Your fluid reasoning score indicates strong performance.";
    const result = checkLeakage(text);
    expect(result.leaked).toBe(true);
    expect(result.matches.some((m) => m.category === "construct-name")).toBe(true);
  });

  it("catches construct name: metacognitive calibration (case-insensitive)", () => {
    const text = "This tests your Metacognitive Calibration abilities.";
    const result = checkLeakage(text);
    expect(result.leaked).toBe(true);
  });

  it("catches construct ID in SCREAMING_SNAKE_CASE", () => {
    const text = "The COGNITIVE_FLEXIBILITY construct was measured here.";
    const result = checkLeakage(text);
    expect(result.leaked).toBe(true);
    expect(result.matches.some((m) => m.category === "construct-id")).toBe(true);
  });

  it("catches uppercase classification token STRONG", () => {
    const text = "Your response was classified as STRONG.";
    const result = checkLeakage(text);
    expect(result.leaked).toBe(true);
    expect(result.matches.some((m) => m.category === "classification")).toBe(true);
  });

  it("catches uppercase ADEQUATE", () => {
    const text = "Classification result: ADEQUATE.";
    const result = checkLeakage(text);
    expect(result.leaked).toBe(true);
  });

  it("allows lowercase 'strong' in natural speech", () => {
    const text = "That's a strong approach — you clearly thought it through.";
    const result = checkLeakage(text);
    // "strong" lowercase should NOT trigger classification leak
    const classificationMatches = result.matches.filter((m) => m.category === "classification");
    expect(classificationMatches).toHaveLength(0);
  });

  it("allows lowercase 'weak' in natural speech", () => {
    const text = "The weak point in the system was the pressure valve.";
    const result = checkLeakage(text);
    const classificationMatches = result.matches.filter((m) => m.category === "classification");
    expect(classificationMatches).toHaveLength(0);
  });

  it("catches rubric vocabulary: rubric score", () => {
    const text = "Based on the rubric score, you performed well.";
    const result = checkLeakage(text);
    expect(result.leaked).toBe(true);
    expect(result.matches.some((m) => m.category === "rubric-vocabulary")).toBe(true);
  });

  it("catches rubric vocabulary: composite score", () => {
    const text = "Your composite score exceeds the cutline.";
    const result = checkLeakage(text);
    expect(result.leaked).toBe(true);
  });

  it("catches rubric vocabulary: percentile", () => {
    const text = "You scored in the 80th percentile.";
    const result = checkLeakage(text);
    expect(result.leaked).toBe(true);
  });

  it("catches rubric vocabulary: behavioral indicator", () => {
    const text = "The behavioral indicator for this construct was present.";
    const result = checkLeakage(text);
    expect(result.leaked).toBe(true);
  });

  it("catches multiple leakages at once", () => {
    const text = "Your FLUID_REASONING score shows STRONG classification on the rubric score.";
    const result = checkLeakage(text);
    expect(result.leaked).toBe(true);
    expect(result.matches.length).toBeGreaterThanOrEqual(2);
  });

  it("passes normal assessment conversation", () => {
    const texts = [
      "You mentioned cross-referencing the flow sensors with the pressure data — that's a solid diagnostic instinct.",
      "Here's the thing though: your secondary coolant pump was last serviced fourteen months ago.",
      "Does that change how you'd approach this?",
      "Walk me through your thinking on those last few problems.",
      "Good. Let's look at a completely different situation.",
      "Take your time — there's no rush.",
    ];
    for (const text of texts) {
      const result = checkLeakage(text);
      expect(result.leaked).toBe(false);
    }
  });
});

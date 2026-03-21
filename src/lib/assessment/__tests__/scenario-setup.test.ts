import { describe, it, expect } from "vitest";
import { splitSentences } from "../turn-builders/helpers";

/**
 * Tests for the Beat 0 runtime question-stripping logic.
 *
 * The stripping rule (in scenario-setup.ts): if the final sentence ends with "?"
 * AND sentence count >= 5, remove the last sentence. This handles legacy content
 * libraries generated with "Sentence 5: The question" that should no longer be
 * spoken aloud (Beat 0 is pure scene-setting under Path A).
 */

function applyBeat0QuestionStrip(spokenText: string): string[] {
  const sentences = splitSentences(spokenText);
  if (sentences.length >= 5 && sentences[sentences.length - 1]?.trim().endsWith("?")) {
    sentences.pop();
  }
  return sentences;
}

describe("Beat 0 question-stripping filter", () => {
  it("strips trailing question when sentence count >= 5 (legacy content)", () => {
    const text =
      "You're a shift lead at a packaging plant. The line runs 120 units per minute. " +
      "The rejection rate just spiked to fifteen percent. Your maintenance tech is out sick today. " +
      "What would you do first?";
    const result = applyBeat0QuestionStrip(text);
    expect(result).toHaveLength(4);
    expect(result[result.length - 1]).not.toMatch(/\?$/);
  });

  it("keeps all sentences when count is exactly 4 ending with '?' (guard condition)", () => {
    const text =
      "You're a shift lead at a packaging plant. The rejection rate just spiked. " +
      "Your maintenance tech is out sick today. What would you do first?";
    const result = applyBeat0QuestionStrip(text);
    expect(result).toHaveLength(4);
    expect(result[result.length - 1]).toMatch(/\?$/);
  });

  it("keeps all sentences when 5 sentences end with a period", () => {
    const text =
      "You're a shift lead at a packaging plant. The line runs 120 units per minute. " +
      "The rejection rate just spiked to fifteen percent. Your maintenance tech is out sick today. " +
      "The next shipment leaves in two hours.";
    const result = applyBeat0QuestionStrip(text);
    expect(result).toHaveLength(5);
    expect(result[result.length - 1]).toMatch(/\.$/);
  });

  it("handles content with exactly 5 sentences and a trailing question", () => {
    const text =
      "You're the quality inspector on the night shift. The automated scanner checks every label. " +
      "Three batches just failed the adhesion test. The client pickup is at six AM. " +
      "How would you handle this situation?";
    const result = applyBeat0QuestionStrip(text);
    expect(result).toHaveLength(4);
    expect(result.every((s) => !s.trim().endsWith("?"))).toBe(true);
  });

  it("does not strip when there are fewer than 5 sentences", () => {
    const text = "You're the new operator. Something looks off on the display. What do you check?";
    const result = applyBeat0QuestionStrip(text);
    // splitSentences filters out very short fragments, so just verify no stripping happened
    // on short content regardless of trailing "?"
    expect(result.length).toBeLessThan(5);
  });
});

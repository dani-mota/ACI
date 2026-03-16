import { describe, it, expect } from "vitest";
import { sanitizeAriaOutput, stripSensitiveFields } from "@/lib/assessment/sanitize";

describe("sanitizeAriaOutput", () => {
  it("returns unmodified text when clean", () => {
    const text = "That's a solid approach. Let me introduce a complication.";
    const { cleaned, modified } = sanitizeAriaOutput(text);
    expect(cleaned).toBe(text);
    expect(modified).toBe(false);
  });

  it("strips stage directions in asterisks", () => {
    const text = "That's interesting. *she pauses thoughtfully* What would you do next?";
    const { cleaned, modified, strippedPatterns } = sanitizeAriaOutput(text);
    expect(cleaned).not.toContain("*she pauses thoughtfully*");
    expect(cleaned).toContain("That's interesting.");
    expect(cleaned).toContain("What would you do next?");
    expect(modified).toBe(true);
    expect(strippedPatterns).toContain("stage-directions-asterisk");
  });

  it("strips stage directions in parentheses", () => {
    const text = "Good thinking. (Aria nods) Tell me more.";
    const { cleaned } = sanitizeAriaOutput(text);
    expect(cleaned).not.toContain("(Aria nods)");
    expect(cleaned).toContain("Good thinking.");
  });

  it("strips third-person Aria narration", () => {
    const text = "Aria considers for a moment. What if the sensor was wrong?";
    const { cleaned } = sanitizeAriaOutput(text);
    expect(cleaned).not.toContain("Aria considers");
    expect(cleaned).toContain("What if the sensor was wrong?");
  });

  it("strips third-person 'She' narration", () => {
    const text = "She pauses before continuing. Here's the thing though.";
    const { cleaned } = sanitizeAriaOutput(text);
    expect(cleaned).not.toContain("She pauses");
  });

  it("strips XML tags like <construct_check>", () => {
    const text = "That's a good point. <construct_check>COGNITIVE_FLEXIBILITY</construct_check> Now tell me.";
    const { cleaned, strippedPatterns } = sanitizeAriaOutput(text);
    expect(cleaned).not.toContain("<construct_check>");
    expect(cleaned).not.toContain("</construct_check>");
    expect(strippedPatterns).toContain("xml-tags");
  });

  it("strips bracket tags like [BEAT: 2]", () => {
    const text = "[BEAT: 2] Here's what happened next.";
    const { cleaned } = sanitizeAriaOutput(text);
    expect(cleaned).not.toContain("[BEAT: 2]");
    expect(cleaned).toContain("Here's what happened next.");
  });

  it("strips markdown headers", () => {
    const text = "## BEAT 2: COMPLICATION\nSomething changed.";
    const { cleaned } = sanitizeAriaOutput(text);
    expect(cleaned).not.toContain("## BEAT 2");
    expect(cleaned).toContain("Something changed.");
  });

  it("strips template labels", () => {
    const text = "SPOKEN TEXT: Here is what Aria says.";
    const { cleaned } = sanitizeAriaOutput(text);
    expect(cleaned).not.toContain("SPOKEN TEXT:");
    expect(cleaned).toContain("Here is what Aria says.");
  });

  it("strips embedded JSON blocks", () => {
    const text = 'Good. {"role": "Technician", "context": "Night shift", "sections": []} What do you think?';
    const { cleaned } = sanitizeAriaOutput(text);
    expect(cleaned).not.toContain('"role"');
    expect(cleaned).toContain("Good.");
  });

  it("strips beat type labels on their own line", () => {
    const text = "COMPLICATION\nThe pump just failed.";
    const { cleaned } = sanitizeAriaOutput(text);
    expect(cleaned).toContain("The pump just failed.");
  });

  it("collapses excessive whitespace", () => {
    const text = "First sentence.\n\n\n\n\nSecond sentence.";
    const { cleaned } = sanitizeAriaOutput(text);
    // After collapsing 5 newlines → 2 newlines, then \s{2,} → single space (TTS-ready)
    expect(cleaned).toBe("First sentence. Second sentence.");
  });

  it("handles multiple contamination types at once", () => {
    const text = "## BEAT 3\n*pauses* SPOKEN TEXT: Here's the thing. <construct_check>test</construct_check>";
    const { cleaned, strippedPatterns } = sanitizeAriaOutput(text);
    expect(strippedPatterns.length).toBeGreaterThanOrEqual(3);
    expect(cleaned).toContain("Here's the thing.");
  });
});

describe("stripSensitiveFields", () => {
  it("removes correctAnswer from flat object", () => {
    const data = { prompt: "What is 2+2?", options: ["3", "4"], correctAnswer: "4" };
    const result = stripSensitiveFields(data);
    expect(result).not.toHaveProperty("correctAnswer");
    expect(result).toHaveProperty("prompt");
    expect(result).toHaveProperty("options");
  });

  it("removes distractorRationale", () => {
    const data = { prompt: "test", distractorRationale: { A: "common error" } };
    const result = stripSensitiveFields(data);
    expect(result).not.toHaveProperty("distractorRationale");
  });

  it("removes rubricIndicators", () => {
    const data = { text: "hello", rubricIndicators: [{ id: "1" }] };
    const result = stripSensitiveFields(data);
    expect(result).not.toHaveProperty("rubricIndicators");
  });

  it("removes sensitive fields from nested objects", () => {
    const data: Record<string, unknown> = {
      elementData: {
        prompt: "What is X?",
        correctAnswer: "42",
        options: ["40", "42"],
      },
    };
    const result = stripSensitiveFields(data);
    const elementData = result.elementData as Record<string, unknown>;
    expect(elementData).not.toHaveProperty("correctAnswer");
    expect(elementData).toHaveProperty("prompt");
  });

  it("preserves non-sensitive fields", () => {
    const data = { prompt: "test", options: ["a", "b"], itemId: "qr-001" };
    const result = stripSensitiveFields(data);
    expect(result).toEqual(data);
  });
});

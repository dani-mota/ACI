import { describe, it, expect } from "vitest";
import { normalizeInput, isSentinelMessage } from "@/lib/assessment/validation/input-schema";

describe("normalizeInput", () => {
  it("passes through normal text", () => {
    const result = normalizeInput("I would check the calibration logs first.");
    expect(result.content).toBe("I would check the calibration logs first.");
    expect(result.isSentinel).toBe(false);
    expect(result.inputTruncated).toBe(false);
  });

  it("trims whitespace", () => {
    const result = normalizeInput("  hello world  ");
    expect(result.content).toBe("hello world");
  });

  it("converts null to [NO_RESPONSE] sentinel", () => {
    const result = normalizeInput(null);
    expect(result.content).toBe("[NO_RESPONSE]");
    expect(result.isSentinel).toBe(true);
  });

  it("converts undefined to [NO_RESPONSE] sentinel", () => {
    const result = normalizeInput(undefined);
    expect(result.content).toBe("[NO_RESPONSE]");
    expect(result.isSentinel).toBe(true);
  });

  it("converts empty string to [NO_RESPONSE] sentinel", () => {
    const result = normalizeInput("");
    expect(result.content).toBe("[NO_RESPONSE]");
    expect(result.isSentinel).toBe(true);
  });

  it("converts whitespace-only to [NO_RESPONSE] sentinel", () => {
    const result = normalizeInput("   \n\t  ");
    expect(result.content).toBe("[NO_RESPONSE]");
    expect(result.isSentinel).toBe(true);
  });

  it("recognizes known sentinel messages", () => {
    expect(normalizeInput("[BEGIN_ASSESSMENT]").isSentinel).toBe(true);
    expect(normalizeInput("[BEGIN_ACT_2]").isSentinel).toBe(true);
    expect(normalizeInput("[BEGIN_ACT_3]").isSentinel).toBe(true);
    expect(normalizeInput("[NO_RESPONSE]").isSentinel).toBe(true);
  });

  it("truncates input beyond 3000 characters", () => {
    const longInput = "a".repeat(5000);
    const result = normalizeInput(longInput);
    expect(result.content.length).toBe(3000);
    expect(result.inputTruncated).toBe(true);
    expect(result.originalLength).toBe(5000);
  });

  it("does not truncate at exactly 3000 characters", () => {
    const input = "a".repeat(3000);
    const result = normalizeInput(input);
    expect(result.content.length).toBe(3000);
    expect(result.inputTruncated).toBe(false);
  });

  it("strips control characters but keeps newlines and tabs", () => {
    const input = "Hello\x00World\nNew line\tTab";
    const result = normalizeInput(input);
    expect(result.content).toBe("Hello\x00World\nNew line\tTab".replace(/\x00/g, ""));
    expect(result.content).toContain("\n");
    expect(result.content).toContain("\t");
  });

  it("strips null bytes", () => {
    const input = "Hello\x00World";
    const result = normalizeInput(input);
    expect(result.content).toBe("HelloWorld");
  });
});

describe("isSentinelMessage", () => {
  it("identifies bracket-wrapped messages as sentinels", () => {
    expect(isSentinelMessage("[NO_RESPONSE]")).toBe(true);
    expect(isSentinelMessage("[BEGIN_ASSESSMENT]")).toBe(true);
    expect(isSentinelMessage("[ANYTHING]")).toBe(true);
  });

  it("rejects normal text", () => {
    expect(isSentinelMessage("I would check the logs")).toBe(false);
    expect(isSentinelMessage("Hello world")).toBe(false);
  });

  it("handles whitespace around sentinels", () => {
    expect(isSentinelMessage("  [NO_RESPONSE]  ")).toBe(true);
  });
});

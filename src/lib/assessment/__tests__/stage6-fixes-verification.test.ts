/**
 * Stage 6 Fixes Verification — probeConfig, probe verification, constructIndicators
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { verifyProbePresent, addProbeReinforcement } from "@/lib/assessment/probe-verification";

const PROJECT_ROOT = path.resolve(__dirname, "../../../..");
function readFile(rel: string): string {
  return fs.readFileSync(path.join(PROJECT_ROOT, rel), "utf-8");
}

// ════════════════════════════════════════════════
// GROUP 1: Probe Verification — Unit Tests
// ════════════════════════════════════════════════

describe("Group 1: Probe Verification", () => {
  const config = {
    primaryProbe: "How does that change your approach?",
    approvedVariants: [
      "What does that mean for your plan?",
      "How would you adjust given this?",
    ],
    constructTarget: "COGNITIVE_FLEXIBILITY",
  };

  it("1.1: Primary probe found", () => {
    const result = verifyProbePresent(
      "Great point. How does that change your approach?",
      config,
    );
    expect(result.found).toBe(true);
    expect(result.matchedVariant).toBe("How does that change your approach?");
  });

  it("1.2: Approved variant found", () => {
    const result = verifyProbePresent(
      "Interesting. What does that mean for your plan?",
      config,
    );
    expect(result.found).toBe(true);
    expect(result.matchedVariant).toBe("What does that mean for your plan?");
  });

  it("1.3: Probe missing", () => {
    const result = verifyProbePresent(
      "That's a really thoughtful answer. I can see your reasoning.",
      config,
    );
    expect(result.found).toBe(false);
    expect(result.matchedVariant).toBeNull();
  });

  it("1.4: Probe found with punctuation differences", () => {
    const result = verifyProbePresent(
      "How does that change your approach",
      config,
    );
    expect(result.found).toBe(true);
  });

  it("1.5: Case insensitive", () => {
    const result = verifyProbePresent(
      "HOW DOES THAT CHANGE YOUR APPROACH?",
      config,
    );
    expect(result.found).toBe(true);
  });

  it("1.6: Probe embedded in longer text", () => {
    const result = verifyProbePresent(
      "You mentioned checking the sensors first — good instinct. The secondary pump just failed though. How does that change your approach?",
      config,
    );
    expect(result.found).toBe(true);
  });

  it("1.7: addProbeReinforcement appends instruction", () => {
    const reinforced = addProbeReinforcement("Base prompt.", "What's your first move?");
    expect(reinforced).toContain("Base prompt.");
    expect(reinforced).toContain("CRITICAL");
    expect(reinforced).toContain("What's your first move?");
  });
});

// ════════════════════════════════════════════════
// GROUP 2: probeConfig in Content Types
// ════════════════════════════════════════════════

describe("Group 2: probeConfig Structure", () => {
  const contentTypesSource = readFile("src/lib/assessment/content-types.ts");

  it("2.1: ProbeConfig interface exists", () => {
    expect(contentTypesSource).toContain("export interface ProbeConfig");
    expect(contentTypesSource).toContain("primaryProbe: string");
    expect(contentTypesSource).toContain("approvedVariants: string[]");
    expect(contentTypesSource).toContain("constructTarget: string");
  });

  it("2.2: ConstructIndicators interface exists", () => {
    expect(contentTypesSource).toContain("export interface ConstructIndicators");
    expect(contentTypesSource).toContain("strongIndicators: string[]");
    expect(contentTypesSource).toContain("weakIndicators: string[]");
  });

  it("2.3: Act1BeatContent has probeConfig and constructIndicators fields", () => {
    expect(contentTypesSource).toContain("probeConfig?: ProbeConfig");
    expect(contentTypesSource).toContain("constructIndicators?: ConstructIndicators");
  });
});

// ════════════════════════════════════════════════
// GROUP 3: Scenario Probe Extraction
// ════════════════════════════════════════════════

describe("Group 3: Scenario Probes", () => {
  const probesSource = readFile("src/lib/assessment/scenario-probes.ts");

  it("3.1: Default probes defined for all 6 beat types", () => {
    expect(probesSource).toContain("INITIAL_SITUATION");
    expect(probesSource).toContain("INITIAL_RESPONSE");
    expect(probesSource).toContain("COMPLICATION");
    expect(probesSource).toContain("SOCIAL_PRESSURE");
    expect(probesSource).toContain("CONSEQUENCE_REVEAL");
    expect(probesSource).toContain("REFLECTIVE_SYNTHESIS");
  });

  it("3.2: Beat 0 (INITIAL_SITUATION) returns no probe", () => {
    expect(probesSource).toContain("INITIAL_SITUATION");
    // Beat 0 is narration — primaryProbe is empty
    expect(probesSource).toContain('primaryProbe: ""');
  });

  it("3.3: getProbeConfig and getConstructIndicators exported", () => {
    expect(probesSource).toContain("export function getProbeConfig");
    expect(probesSource).toContain("export function getConstructIndicators");
  });

  it("3.4: Construct indicators extracted from scenario rubricIndicators", () => {
    expect(probesSource).toContain("beat.rubricIndicators");
    expect(probesSource).toContain("positiveCriteria");
    expect(probesSource).toContain("negativeCriteria");
  });
});

// ════════════════════════════════════════════════
// GROUP 4: Probe Verification Wired into TurnBuilder
// ════════════════════════════════════════════════

describe("Group 4: Open Probe TurnBuilder Integration", () => {
  const openProbeSource = readFile("src/lib/assessment/turn-builders/open-probe.ts");

  it("4.1: Imports probe verification utilities", () => {
    expect(openProbeSource).toContain("import { getProbeConfig");
    expect(openProbeSource).toContain("import { verifyProbePresent, addProbeReinforcement }");
  });

  it("4.2: Gets probeConfig for current beat", () => {
    expect(openProbeSource).toContain("getProbeConfig(scenarioIndex, beatIndex)");
  });

  it("4.3: Verifies probe present in Haiku response", () => {
    expect(openProbeSource).toContain("verifyProbePresent(response, probeConfig)");
  });

  it("4.4: Retries at temperature 0.3 when probe missing", () => {
    expect(openProbeSource).toContain("retrying at temp 0.3");
    expect(openProbeSource).toContain("addProbeReinforcement");
  });

  it("4.5: Falls back to content library when retry also fails", () => {
    expect(openProbeSource).toContain("Probe verification failed after retry");
  });

  it("4.6: Fallback uses probe as question when no content library", () => {
    expect(openProbeSource).toContain("probeConfig?.primaryProbe");
    expect(openProbeSource).toContain("Let me ask you this:");
  });

  it("4.7: generateFromHaiku accepts temperature parameter", () => {
    expect(openProbeSource).toContain("temperature = 0.7");
    expect(openProbeSource).toContain("temperature,");
  });
});

// ════════════════════════════════════════════════
// GROUP 5: constructIndicators in Prompt Assembly
// ════════════════════════════════════════════════

describe("Group 5: Construct Indicators in Prompts", () => {
  const promptSource = readFile("src/lib/assessment/prompts/prompt-assembly.ts");

  it("5.1: buildBeatInstruction accepts constructIndicators parameter", () => {
    expect(promptSource).toContain("constructIndicators?:");
  });

  it("5.2: Strong/weak signals included in prompt when available", () => {
    expect(promptSource).toContain("STRONG SIGNALS:");
    expect(promptSource).toContain("WEAK SIGNALS:");
    expect(promptSource).toContain("constructIndicators.strongIndicators");
    expect(promptSource).toContain("constructIndicators.weakIndicators");
  });
});

// ════════════════════════════════════════════════
// GROUP 6: Regression
// ════════════════════════════════════════════════

describe("Group 6: Regression", () => {
  it("6.1: All new files exist", () => {
    expect(fs.existsSync(path.join(PROJECT_ROOT, "src/lib/assessment/probe-verification.ts"))).toBe(true);
    expect(fs.existsSync(path.join(PROJECT_ROOT, "src/lib/assessment/scenario-probes.ts"))).toBe(true);
  });

  it("6.2: Existing content types file still has original interfaces", () => {
    const src = readFile("src/lib/assessment/content-types.ts");
    expect(src).toContain("interface ContentLibraryData");
    expect(src).toContain("interface Act1ScenarioContent");
    expect(src).toContain("interface BranchContent");
  });
});

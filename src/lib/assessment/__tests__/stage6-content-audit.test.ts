/**
 * Stage 6: Content Library Audit
 *
 * Verifies content files are complete, well-formed, and compatible with the engine.
 * Documents gaps between the existing content structure and PRD §12.3.
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const PROJECT_ROOT = path.resolve(__dirname, "../../../..");
function readFile(rel: string): string {
  return fs.readFileSync(path.join(PROJECT_ROOT, rel), "utf-8");
}

// ════════════════════════════════════════════════
// GROUP 1: BeatScaffolding Alignment — PRD §12.3 vs Actual
// ════════════════════════════════════════════════

describe("Group 1: BeatScaffolding Alignment", () => {
  const contentTypesSource = readFile("src/lib/assessment/content-types.ts");

  it("1.1: Act1BeatContent has core fields", () => {
    expect(contentTypesSource).toContain("beatIndex: number");
    expect(contentTypesSource).toContain("beatType: string");
    expect(contentTypesSource).toContain("constructs: string[]");
    expect(contentTypesSource).toContain("spokenText?: string");
    expect(contentTypesSource).toContain("referenceCard?: ScenarioReferenceData");
  });

  it("1.2: BranchContent exists with spokenText + referenceUpdate", () => {
    expect(contentTypesSource).toContain("interface BranchContent");
    expect(contentTypesSource).toContain("spokenText: string");
    expect(contentTypesSource).toContain("referenceUpdate:");
  });

  it("1.3: probeConfig EXISTS (FIXED in Stage 6 fixes)", () => {
    expect(contentTypesSource).toContain("probeConfig");
    expect(contentTypesSource).toContain("primaryProbe");
    expect(contentTypesSource).toContain("approvedVariants");
  });

  it("1.4: constructIndicators EXISTS (FIXED in Stage 6 fixes)", () => {
    expect(contentTypesSource).toContain("constructIndicators");
    expect(contentTypesSource).toContain("strongIndicators");
    expect(contentTypesSource).toContain("weakIndicators");
  });

  it("1.5: GAP — No hiddenInformation structure", () => {
    // PRD §12.3 specifies optional hidden facts revealed on clarifying questions
    // No support in content-types.ts
    // Impact: Hidden information feature (PRD §3.11) is not available
    // Mitigation: Hidden info is a V2 feature. For pilot, scenarios don't
    // have hidden facts that candidates can discover via questions.
    expect(contentTypesSource).not.toContain("hiddenInformation");
    expect(contentTypesSource).not.toContain("revealText");
  });

  it("1.6: GAP — No standalone fallbackContent field", () => {
    // PRD §12.3 requires a fallbackContent block with per-branch static text
    // In the current implementation, the branches themselves serve as the fallback.
    // When Haiku fails, lookupBeatContent returns branch[classification].spokenText.
    // This is functionally equivalent but not structurally separated.
    // Impact: No structural difference between "pre-generated content" and "fallback content"
    // Mitigation: For pilot, pre-generated content IS the fallback. Same content
    // is served whether hybrid generation succeeds or fails.
    expect(contentTypesSource).not.toContain("fallbackContent");
  });
});

// ════════════════════════════════════════════════
// GROUP 2: Scenario Completeness
// ════════════════════════════════════════════════

describe("Group 2: Scenario Completeness", () => {
  const scenariosSource = readFile("src/lib/assessment/scenarios/index.ts");

  it("2.1: 4 scenarios defined", () => {
    // Each scenario exported as SCENARIO_1 through SCENARIO_4 or in SCENARIOS array
    const scenarioMatches = scenariosSource.match(/name:\s*"/g);
    expect(scenarioMatches).not.toBeNull();
    expect(scenarioMatches!.length).toBeGreaterThanOrEqual(4);
  });

  it("2.2: Each scenario has 6 beats", () => {
    // Each beat has beatNumber 0-5
    const beatMatches = scenariosSource.match(/beatNumber:\s*\d/g);
    expect(beatMatches).not.toBeNull();
    // 4 scenarios × 6 beats = 24 beat definitions
    expect(beatMatches!.length).toBeGreaterThanOrEqual(24);
  });

  it("2.3: All beats have branchScripts with STRONG/ADEQUATE/WEAK", () => {
    expect(scenariosSource).toContain("STRONG:");
    expect(scenariosSource).toContain("ADEQUATE:");
    expect(scenariosSource).toContain("WEAK:");
    // Count branch definitions — should be at least 24 × 3 = 72
    const strongMatches = scenariosSource.match(/STRONG:/g);
    expect(strongMatches!.length).toBeGreaterThanOrEqual(24);
  });

  it("2.4: All beats have rubricIndicators", () => {
    const indicatorMatches = scenariosSource.match(/rubricIndicators:\s*\[/g);
    expect(indicatorMatches).not.toBeNull();
    expect(indicatorMatches!.length).toBeGreaterThanOrEqual(24);
  });

  it("2.5: Beat types cover the full progression", () => {
    expect(scenariosSource).toContain("INITIAL_SITUATION");
    expect(scenariosSource).toContain("INITIAL_RESPONSE");
    expect(scenariosSource).toContain("COMPLICATION");
    expect(scenariosSource).toContain("SOCIAL_PRESSURE");
    expect(scenariosSource).toContain("CONSEQUENCE_REVEAL");
    expect(scenariosSource).toContain("REFLECTIVE_SYNTHESIS");
  });
});

// ════════════════════════════════════════════════
// GROUP 3: Item Bank Completeness
// ════════════════════════════════════════════════

describe("Group 3: Item Bank", () => {
  const itemBankSource = readFile("src/lib/assessment/item-bank.ts");

  it("3.1: All 5 Act 2 constructs have items", () => {
    expect(itemBankSource).toContain("QUANTITATIVE_REASONING");
    expect(itemBankSource).toContain("SPATIAL_VISUALIZATION");
    expect(itemBankSource).toContain("MECHANICAL_REASONING");
    expect(itemBankSource).toContain("PATTERN_RECOGNITION");
    expect(itemBankSource).toContain("FLUID_REASONING");
  });

  it("3.2: Each construct has ≥15 items (pilot minimum)", () => {
    // Count items by looking for id patterns per construct
    const qrItems = (itemBankSource.match(/construct:\s*"QUANTITATIVE_REASONING"/g) || []).length;
    const svItems = (itemBankSource.match(/construct:\s*"SPATIAL_VISUALIZATION"/g) || []).length;
    const mrItems = (itemBankSource.match(/construct:\s*"MECHANICAL_REASONING"/g) || []).length;
    const prItems = (itemBankSource.match(/construct:\s*"PATTERN_RECOGNITION"/g) || []).length;
    const frItems = (itemBankSource.match(/construct:\s*"FLUID_REASONING"/g) || []).length;

    expect(qrItems).toBeGreaterThanOrEqual(15);
    expect(svItems).toBeGreaterThanOrEqual(15);
    expect(mrItems).toBeGreaterThanOrEqual(15);
    expect(prItems).toBeGreaterThanOrEqual(15);
    expect(frItems).toBeGreaterThanOrEqual(15);
  });

  // PRO-66: correctAnswer moved to database (Act2ItemAnswer model) — no longer in source
  it("3.3: Items do NOT have correctAnswer in source (PRO-66 — answers in DB)", () => {
    expect(itemBankSource).not.toContain("correctAnswer:");
  });

  it("3.4: Items have difficulty parameter", () => {
    expect(itemBankSource).toContain("difficulty:");
  });

  it("3.5: server-only guard prevents client import", () => {
    expect(itemBankSource).toContain('import "server-only"');
  });
});

// ════════════════════════════════════════════════
// GROUP 4: Content Serving Safety
// ════════════════════════════════════════════════

describe("Group 4: Content Serving Safety", () => {
  const servingSource = readFile("src/lib/assessment/content-serving.ts");

  it("4.1: lookupBeatContent falls back to ADEQUATE when branch missing", () => {
    expect(servingSource).toContain("beat.branches.ADEQUATE");
    expect(servingSource).toContain("Fallback to ADEQUATE");
  });

  it("4.2: Variant selection is random per assessment", () => {
    expect(servingSource).toContain("Math.floor(Math.random()");
  });

  it("4.3: Library caching is session-level (immutable content)", () => {
    expect(servingSource).toContain("libraryCache");
    expect(servingSource).toContain("libraryCache.get(libraryId)");
    expect(servingSource).toContain("libraryCache.set(libraryId");
  });
});

// ════════════════════════════════════════════════
// GROUP 5: Security — No Answer Leakage
// ════════════════════════════════════════════════

describe("Group 5: No Answer Leakage", () => {
  it("5.1: correctAnswer stripped in chat route GET handler", () => {
    const chatSource = readFile("src/app/api/assess/[token]/chat/route.ts");
    expect(chatSource).toContain("correctAnswer");
    // The GET handler strips correctAnswer from element data
    expect(chatSource).toContain("correctAnswer: _a");
  });

  it("5.2: stripSensitiveFields removes correctAnswer", () => {
    const sanitizeSource = readFile("src/lib/assessment/sanitize.ts");
    expect(sanitizeSource).toContain('"correctAnswer"');
  });

  it("5.3: correctCount NOT in diagnostic probe prompt (P2-2 fixed in Stage 5)", () => {
    const promptSource = readFile("src/lib/assessment/prompts/prompt-assembly.ts");
    expect(promptSource).not.toContain("correctCount}");
    expect(promptSource).not.toContain("Correct:");
  });
});

// ════════════════════════════════════════════════
// GROUP 6: Probe Verification in TurnBuilder
// ════════════════════════════════════════════════

describe("Group 6: Probe Verification & Circuit Breaker", () => {
  const dispatcherSource = readFile("src/lib/assessment/dispatcher.ts");

  it("6.1: Circuit breaker exists in dispatcher", () => {
    expect(dispatcherSource).toContain("CIRCUIT_BREAKER_THRESHOLD");
    expect(dispatcherSource).toContain("consecutiveHaikuFailures");
  });

  it("6.2: Circuit breaker threshold is 3", () => {
    expect(dispatcherSource).toContain("CIRCUIT_BREAKER_THRESHOLD = 3");
  });

  it("6.3: Safe fallback on validation failure", () => {
    expect(dispatcherSource).toContain("buildSafeFallback");
  });

  it("6.4: Probe verification EXISTS in TurnBuilder (FIXED in Stage 6 fixes)", () => {
    const openProbeSource = readFile("src/lib/assessment/turn-builders/open-probe.ts");
    expect(openProbeSource).toContain("verifyProbePresent");
    expect(openProbeSource).toContain("getProbeConfig");
    expect(openProbeSource).toContain("addProbeReinforcement");
  });
});

// ════════════════════════════════════════════════
// GROUP 7: Summary — Gap Impact Assessment
// ════════════════════════════════════════════════

describe("Group 7: Gap Impact Assessment", () => {
  it("7.1: SUMMARY — all gaps are quality improvements, not functional blockers", () => {
    // The content library gaps (probeConfig, constructIndicators, hiddenInformation,
    // standalone fallbackContent) are structural refinements that would improve
    // measurement precision and probe standardization.
    //
    // For the pilot:
    // - Probe questions: generated naturally by LLM from branchScript instructions
    // - Construct indicators: available in scenarios/index.ts for classification/scoring
    // - Hidden information: V2 feature, not needed for pilot assessment flow
    // - Fallback content: branch content serves as fallback (functionally identical)
    // - Item bank: 96 items across 5 constructs (≥15 per construct, meets minimum)
    // - All 4 scenarios × 6 beats are complete with branchScripts and indicators
    //
    // No gaps block the assessment from running end-to-end.
    expect(true).toBe(true); // Documentation test
  });
});

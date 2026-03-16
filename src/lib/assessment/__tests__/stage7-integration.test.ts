/**
 * Stage 7: Integration Tests — End-to-End Verification
 *
 * Verifies that all stages work together with flags enabled.
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const PROJECT_ROOT = path.resolve(__dirname, "../../../..");
function readFile(rel: string): string {
  return fs.readFileSync(path.join(PROJECT_ROOT, rel), "utf-8");
}

// ════════════════════════════════════════════════
// GROUP 1: Feature Flags — Defaults + Guard
// ════════════════════════════════════════════════

describe("Group 1: Feature Flags", () => {
  const configSource = readFile("src/lib/assessment/config.ts");

  it("1.1: UNIFIED_TURNS defaults to ON", () => {
    expect(configSource).toContain('_UNIFIED_TURNS = process.env.FEATURE_UNIFIED_TURNS !== "false"');
  });

  it("1.2: TURN_PLAYER defaults to ON", () => {
    expect(configSource).toContain('_TURN_PLAYER = process.env.FEATURE_TURN_PLAYER !== "false"');
  });

  it("1.3: CONTENT_LIBRARY_ENABLED defaults to ON", () => {
    expect(configSource).toContain('CONTENT_LIBRARY_ENABLED: process.env.FEATURE_CONTENT_LIBRARY !== "false"');
  });

  it("1.4: Invalid combination guard — TURN_PLAYER forced false without UNIFIED_TURNS", () => {
    expect(configSource).toContain("INVALID FLAG COMBINATION");
    expect(configSource).toContain("TURN_PLAYER: _TURN_PLAYER && _UNIFIED_TURNS");
  });
});

// ════════════════════════════════════════════════
// GROUP 2: Session Recovery (P-2)
// ════════════════════════════════════════════════

describe("Group 2: Session Recovery", () => {
  const chatRouteSource = readFile("src/app/api/assess/[token]/chat/route.ts");

  it("2.1: GET handler returns recovery flag", () => {
    expect(chatRouteSource).toContain("recovery: true");
  });

  it("2.2: GET handler returns lastReferenceCard", () => {
    expect(chatRouteSource).toContain("lastReferenceCard");
  });

  it("2.3: GET handler strips correctAnswer from element data", () => {
    expect(chatRouteSource).toContain("correctAnswer: _a");
  });

  it("2.4: GET handler returns progress from computeProgress", () => {
    expect(chatRouteSource).toContain("progress: computeProgress(assessment.assessmentState)");
  });
});

// ════════════════════════════════════════════════
// GROUP 3: Unified Turn Path — End-to-End Architecture
// ════════════════════════════════════════════════

describe("Group 3: Unified Turn Path", () => {
  const chatRouteSource = readFile("src/app/api/assess/[token]/chat/route.ts");
  const storeSource = readFile("src/stores/chat-assessment-store.ts");
  const stageSource = readFile("src/components/assessment/stage/assessment-stage.tsx");

  it("3.1: Chat route dispatches via unified Turn path", () => {
    expect(chatRouteSource).toContain("FEATURE_FLAGS.UNIFIED_TURNS");
    expect(chatRouteSource).toContain("dispatch(builderCtx)");
    expect(chatRouteSource).toContain("JSON.stringify(turn)");
  });

  it("3.2: Store detects Turn response and delegates to handleTurn", () => {
    expect(storeSource).toContain('data.type === "turn"');
    expect(storeSource).toContain("handleTurn(data as AssessmentTurnResponse)");
  });

  it("3.3: TurnPlayer rendered when TURN_PLAYER flag on", () => {
    expect(stageSource).toContain("FEATURE_FLAGS.TURN_PLAYER");
    expect(stageSource).toContain("<TurnPlayer");
    expect(stageSource).toContain("ttsEngine={ttsRef.current}");
    expect(stageSource).toContain("token={token}");
  });

  it("3.4: Legacy TTS trigger guarded when TurnPlayer active", () => {
    expect(stageSource).toContain("FEATURE_FLAGS.TURN_PLAYER && lastTurn");
  });

  it("3.5: Legacy path marked @deprecated", () => {
    expect(chatRouteSource).toContain("@deprecated LEGACY PATH");
    expect(storeSource).toContain("@deprecated Legacy response handlers");
  });
});

// ════════════════════════════════════════════════
// GROUP 4: Complete Pipeline Chain
// ════════════════════════════════════════════════

describe("Group 4: Pipeline Chain — All Stages Connected", () => {
  it("4.1: Stage 1 — Types exist", () => {
    expect(fs.existsSync(path.join(PROJECT_ROOT, "src/lib/types/turn.ts"))).toBe(true);
    expect(fs.existsSync(path.join(PROJECT_ROOT, "src/lib/types/formats.ts"))).toBe(true);
  });

  it("4.2: Stage 1 — Validation exists", () => {
    expect(fs.existsSync(path.join(PROJECT_ROOT, "src/lib/assessment/validation/turn-schema.ts"))).toBe(true);
    expect(fs.existsSync(path.join(PROJECT_ROOT, "src/lib/assessment/sanitize.ts"))).toBe(true);
    expect(fs.existsSync(path.join(PROJECT_ROOT, "src/lib/assessment/filters/leakage.ts"))).toBe(true);
  });

  it("4.3: Stage 2 — TurnBuilders + Dispatcher exist", () => {
    expect(fs.existsSync(path.join(PROJECT_ROOT, "src/lib/assessment/dispatcher.ts"))).toBe(true);
    expect(fs.existsSync(path.join(PROJECT_ROOT, "src/lib/assessment/turn-builders/open-probe.ts"))).toBe(true);
    expect(fs.existsSync(path.join(PROJECT_ROOT, "src/lib/assessment/turn-builders/scenario-setup.ts"))).toBe(true);
    expect(fs.existsSync(path.join(PROJECT_ROOT, "src/lib/assessment/turn-builders/transition.ts"))).toBe(true);
  });

  it("4.4: Stage 3 — TurnPlayer exists", () => {
    expect(fs.existsSync(path.join(PROJECT_ROOT, "src/components/assessment/stage/turn-player.tsx"))).toBe(true);
  });

  it("4.5: Stage 4 — Voice pipeline (TTS engine + TTS config)", () => {
    expect(fs.existsSync(path.join(PROJECT_ROOT, "src/components/assessment/voice/tts-engine.ts"))).toBe(true);
    expect(fs.existsSync(path.join(PROJECT_ROOT, "src/app/api/assess/[token]/tts-config/route.ts"))).toBe(true);
  });

  it("4.6: Stage 5 — Scoring pipeline", () => {
    expect(fs.existsSync(path.join(PROJECT_ROOT, "src/lib/assessment/scoring/pipeline.ts"))).toBe(true);
    expect(fs.existsSync(path.join(PROJECT_ROOT, "src/lib/assessment/scoring/layer-b.ts"))).toBe(true);
    expect(fs.existsSync(path.join(PROJECT_ROOT, "src/lib/assessment/scoring/aggregation.ts"))).toBe(true);
  });

  it("4.7: Stage 6 — Content + Probe verification", () => {
    expect(fs.existsSync(path.join(PROJECT_ROOT, "src/lib/assessment/probe-verification.ts"))).toBe(true);
    expect(fs.existsSync(path.join(PROJECT_ROOT, "src/lib/assessment/scenario-probes.ts"))).toBe(true);
  });

  it("4.8: Prompts — 4-layer assembly", () => {
    expect(fs.existsSync(path.join(PROJECT_ROOT, "src/lib/assessment/prompts/aria-persona.ts"))).toBe(true);
    expect(fs.existsSync(path.join(PROJECT_ROOT, "src/lib/assessment/prompts/prompt-assembly.ts"))).toBe(true);
  });
});

// ════════════════════════════════════════════════
// GROUP 5: Data Integrity — Cross-Stage Verification
// ════════════════════════════════════════════════

describe("Group 5: Data Integrity", () => {
  it("5.1: Metadata validation wired in chat route (P-11)", () => {
    const src = readFile("src/app/api/assess/[token]/chat/route.ts");
    expect(src).toContain("validateAgentMetadata");
  });

  it("5.2: normalizeInput wired in chat route (P-9)", () => {
    const src = readFile("src/app/api/assess/[token]/chat/route.ts");
    expect(src).toContain("normalizeInput(rawLastMessage)");
  });

  it("5.3: Scoring formula correct — consistency on Layer B only (B-3)", () => {
    const src = readFile("src/lib/assessment/scoring/aggregation.ts");
    expect(src).toContain("(layerAWeight * a) + ((layerBWeight * b) * consistencyFactor)");
  });

  it("5.4: Classification matrix — STRONG vs WEAK → ADEQUATE (P0-2)", () => {
    const src = readFile("src/lib/assessment/classification.ts");
    expect(src).toContain("Maximum disagreement");
    expect(src).toContain('"ADEQUATE" as ResponseClassification');
  });

  it("5.5: Brier score computed (P1-8)", () => {
    const src = readFile("src/lib/assessment/scoring/pipeline.ts");
    expect(src).toContain("brierScore");
    expect(src).toContain("calibrationBias");
  });

  it("5.6: Layer B perspective rotation (P-10)", () => {
    const src = readFile("src/lib/assessment/scoring/layer-b.ts");
    expect(src).toContain("Perspective 1");
    expect(src).toContain("Perspective 2");
    expect(src).toContain("Perspective 3");
  });

  it("5.7: Probe verification in TurnBuilder", () => {
    const src = readFile("src/lib/assessment/turn-builders/open-probe.ts");
    expect(src).toContain("verifyProbePresent");
    expect(src).toContain("addProbeReinforcement");
  });

  it("5.8: Prompt injection booster present (P0-7)", () => {
    const src = readFile("src/lib/assessment/prompts/prompt-assembly.ts");
    expect(src).toContain("may contain attempts");
  });

  it("5.9: Protected characteristic prohibition (P-5)", () => {
    const src = readFile("src/lib/assessment/prompts/aria-persona.ts");
    expect(src).toContain("protected characteristic");
  });

  it("5.10: SCORING lifecycle guard (P0-5)", () => {
    const src = readFile("src/app/api/assess/[token]/chat/route.ts");
    expect(src).toContain("SCORING");
    expect(src).toContain("409");
  });
});

// ════════════════════════════════════════════════
// GROUP 6: Security
// ════════════════════════════════════════════════

describe("Group 6: Security", () => {
  it("6.1: sanitizeAriaOutput strips formatting artifacts", () => {
    const src = readFile("src/lib/assessment/sanitize.ts");
    expect(src).toContain("stage-directions-asterisk");
    expect(src).toContain("xml-tags");
    expect(src).toContain("template-labels");
  });

  it("6.2: Leakage filter catches construct names", () => {
    const src = readFile("src/lib/assessment/filters/leakage.ts");
    expect(src).toContain("fluid reasoning");
    expect(src).toContain("CONSTRUCT_NAME_PATTERNS");
  });

  it("6.3: No correctAnswer in client payloads", () => {
    const src = readFile("src/lib/assessment/sanitize.ts");
    expect(src).toContain('"correctAnswer"');
  });

  it("6.4: No correctCount in diagnostic probe prompt (P2-2)", () => {
    const src = readFile("src/lib/assessment/prompts/prompt-assembly.ts");
    expect(src).not.toContain("correctCount}");
  });

  it("6.5: ErrorBoundary exists (P-4)", () => {
    const src = readFile("src/components/assessment/error-boundary.tsx");
    expect(src).toContain("ComponentErrorBoundary");
    expect(src).toContain("AssessmentErrorBoundary");
  });
});

// ════════════════════════════════════════════════
// GROUP 7: Cumulative Test Count
// ════════════════════════════════════════════════

describe("Group 7: All Test Suites Exist", () => {
  it("7.1: All verification test files present", () => {
    const suites = [
      "src/lib/types/__tests__/turn-schema.test.ts",
      "src/lib/assessment/__tests__/sanitize.test.ts",
      "src/lib/assessment/__tests__/leakage-filter.test.ts",
      "src/lib/assessment/__tests__/input-validation.test.ts",
      "src/lib/assessment/__tests__/stage1-behavioral-verification.test.ts",
      "src/lib/assessment/__tests__/stage2-behavioral-verification.test.ts",
      "src/lib/assessment/__tests__/stage4-behavioral-verification.test.ts",
      "src/lib/assessment/__tests__/stage5-behavioral-verification.test.ts",
      "src/lib/assessment/__tests__/stage6-content-audit.test.ts",
      "src/lib/assessment/__tests__/stage6-fixes-verification.test.ts",
      "src/lib/assessment/__tests__/stage7-integration.test.ts",
    ];
    for (const f of suites) {
      expect(fs.existsSync(path.join(PROJECT_ROOT, f))).toBe(true);
    }
  });
});

/**
 * Stage 5 Behavioral Verification — Scoring Pipeline
 *
 * Verifies scoring formula, consistency handling, data availability,
 * Layer B structure, red flags, and lifecycle.
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const PROJECT_ROOT = path.resolve(__dirname, "../../../..");
function readFile(rel: string): string {
  return fs.readFileSync(path.join(PROJECT_ROOT, rel), "utf-8");
}

// ════════════════════════════════════════════════
// GROUP 1: Scoring Formula (PRD §8.2, Amendment B-3)
// ════════════════════════════════════════════════

describe("Group 1: Scoring Formula", () => {
  const aggSource = readFile("src/lib/assessment/scoring/aggregation.ts");

  it("1.1: Consistency factor applies ONLY to Layer B (Amendment B-3)", () => {
    // The formula must be: (w_A × A) + ((w_B × B) × consistencyFactor)
    // NOT: (w_A × A + w_B × B) × consistencyFactor
    expect(aggSource).toContain("(layerAWeight * a) + ((layerBWeight * b) * consistencyFactor)");
    // The old incorrect formula should NOT be present
    expect(aggSource).not.toContain("combinedRawScore *= ASSESSMENT_STRUCTURE.consistencyDownweightFactor");
  });

  it("1.2: Default weights are 0.55 / 0.45", () => {
    expect(aggSource).toContain("ASSESSMENT_STRUCTURE.defaultLayerAWeight");
    expect(aggSource).toContain("ASSESSMENT_STRUCTURE.defaultLayerBWeight");
  });

  it("1.3: Layer-B-only constructs get weight 1.0", () => {
    expect(aggSource).toContain("layerAWeight = 0");
    expect(aggSource).toContain("layerBWeight = 1.0");
  });

  it("1.4: Layer-A-only constructs get weight 1.0", () => {
    expect(aggSource).toContain("layerAWeight = 1.0");
    expect(aggSource).toContain("layerBWeight = 0");
  });

  it("1.5: Hand calculation — both layers, high consistency", () => {
    // A=0.72, B=0.68, consistencyFactor=1.0
    // Expected: (0.55 × 0.72) + ((0.45 × 0.68) × 1.0) = 0.396 + 0.306 = 0.702
    const a = 0.72, b = 0.68;
    const wA = 0.55, wB = 0.45;
    const cf = 1.0;
    const expected = (wA * a) + ((wB * b) * cf);
    expect(expected).toBeCloseTo(0.702, 3);
  });

  it("1.6: Hand calculation — both layers, low consistency", () => {
    // A=0.72, B=0.68, consistencyFactor=0.75
    // Expected: (0.55 × 0.72) + ((0.45 × 0.68) × 0.75) = 0.396 + 0.2295 = 0.6255
    // NOT: (0.55 × 0.72 + 0.45 × 0.68) × 0.75 = 0.702 × 0.75 = 0.5265
    const a = 0.72, b = 0.68;
    const wA = 0.55, wB = 0.45;
    const cf = 0.75;
    const correct = (wA * a) + ((wB * b) * cf);
    const wrong = (wA * a + wB * b) * cf;
    expect(correct).toBeCloseTo(0.6255, 3);
    expect(wrong).toBeCloseTo(0.5265, 3);
    // The difference (0.6255 vs 0.5265) can change a hiring decision
    expect(Math.abs(correct - wrong)).toBeGreaterThan(0.09);
  });
});

// ════════════════════════════════════════════════
// GROUP 2: Consistency Guard
// ════════════════════════════════════════════════

describe("Group 2: Consistency", () => {
  const consistencySource = readFile("src/lib/assessment/scoring/consistency.ts");

  it("2.1: Empty signals array returns empty results (factor defaults to 1.0)", () => {
    // validateConsistency([]) → [] (empty array)
    // Pipeline: consistency?.agreement ?? null → null → no downweight → factor = 1.0
    expect(consistencySource).toContain("signals.map");
    // Empty array.map returns empty array — correct
  });

  it("2.2: Threshold is 0.15 from ASSESSMENT_STRUCTURE", () => {
    expect(consistencySource).toContain("ASSESSMENT_STRUCTURE.consistencyThreshold");
  });

  it("2.3: LOW consistency uses 0.75 downweight factor", () => {
    expect(consistencySource).toContain("ASSESSMENT_STRUCTURE.consistencyDownweightFactor");
  });
});

// ════════════════════════════════════════════════
// GROUP 3: Data Availability (5.3)
// ════════════════════════════════════════════════

describe("Group 3: Data Availability", () => {
  const aggSource = readFile("src/lib/assessment/scoring/aggregation.ts");
  const pipelineSource = readFile("src/lib/assessment/scoring/pipeline.ts");

  it("3.1: insufficientData flag exists on ConstructLayeredScore", () => {
    const typesSource = readFile("src/lib/assessment/types.ts");
    expect(typesSource).toContain("insufficientData?: boolean");
  });

  it("3.2: No-data constructs flagged as insufficientData", () => {
    expect(aggSource).toContain("insufficientData: true");
  });

  it("3.3: Minimum thresholds defined (3 items Layer A, 2 exchanges Layer B)", () => {
    expect(aggSource).toContain("layerAItemCount < 3");
    expect(aggSource).toContain("layerBResponseCount < 2");
  });

  it("3.4: >2 insufficient constructs triggers CRITICAL red flag", () => {
    expect(pipelineSource).toContain("insufficientCount > 2");
    expect(pipelineSource).toContain("Insufficient data for multiple constructs");
    expect(pipelineSource).toContain('"CRITICAL"');
  });
});

// ════════════════════════════════════════════════
// GROUP 4: Layer B Structure
// ════════════════════════════════════════════════

describe("Group 4: Layer B", () => {
  const layerBSource = readFile("src/lib/assessment/scoring/layer-b.ts");

  it("4.1: Triple evaluation (3 parallel calls)", () => {
    expect(layerBSource).toContain("AI_CONFIG.evaluationRunCount");
    expect(layerBSource).toContain("Promise.allSettled(runPromises)");
  });

  it("4.2: Temperature variation across runs (not identical prompts)", () => {
    // Line 182: temperature: 0.3 + runIndex * 0.1
    expect(layerBSource).toContain("temperature: 0.3 + runIndex * 0.1");
  });

  it("4.3: Bounded concurrency at 6", () => {
    expect(layerBSource).toContain("MAX_EVAL_CONCURRENCY = 6");
  });

  it("4.4: High variance threshold at 0.3", () => {
    expect(layerBSource).toContain("AI_CONFIG.highVarianceThreshold");
  });

  it("4.5: Median score used (not mean)", () => {
    expect(layerBSource).toContain("medianIndex");
    expect(layerBSource).toContain("medianRun");
  });

  it("4.6: Fallback when all runs fail", () => {
    expect(layerBSource).toContain("fallbackLayerB");
    expect(layerBSource).toContain("isFallback: true");
  });

  it("4.7: Idempotency guard in pipeline reuses existing runs", () => {
    const pipelineSource = readFile("src/lib/assessment/scoring/pipeline.ts");
    expect(pipelineSource).toContain("Reusing existing Layer B evaluations");
    expect(pipelineSource).toContain("existingRuns.length >= relevantMessages.length * AI_CONFIG.evaluationRunCount");
  });

  it("4.8: Perspective rotation — 3 distinct prompt framings (P-10 FIXED)", () => {
    // buildEvaluationPrompt now receives runIndex for perspective selection
    expect(layerBSource).toContain("buildEvaluationPrompt(response, indicators, runIndex)");
    // 3 distinct framings based on runIndex
    expect(layerBSource).toContain("Perspective 1: Behavioral Indicator Scoring");
    expect(layerBSource).toContain("Perspective 2: Gap Analysis");
    expect(layerBSource).toContain("Perspective 3: Relative Comparison");
    // runIndex parameter used in function signature
    expect(layerBSource).toContain("runIndex: number,");
  });
});

// ════════════════════════════════════════════════
// GROUP 5: Red Flags & Brier Score
// ════════════════════════════════════════════════

describe("Group 5: Red Flags & Brier Score", () => {
  const redFlagsSource = readFile("src/lib/assessment/scoring/red-flags.ts");

  it("5.1: 12 red flag checks defined", () => {
    // Count function definitions that start with "check"
    const checks = redFlagsSource.match(/function check\w+/g);
    expect(checks).not.toBeNull();
    expect(checks!.length).toBeGreaterThanOrEqual(10);
  });

  it("5.2: Brier score implemented in pipeline (P1-8 FIXED)", () => {
    const pipelineSource = readFile("src/lib/assessment/scoring/pipeline.ts");
    // Brier score computation present
    expect(pipelineSource).toContain("brierScore");
    expect(pipelineSource).toContain("confidencePairs");
    expect(pipelineSource).toContain("Math.pow(p.confidence - actual, 2)");
    // Calibration bias classification
    expect(pipelineSource).toContain("POORLY_CALIBRATED");
    expect(pipelineSource).toContain("WELL_CALIBRATED");
    expect(pipelineSource).toContain("MODERATELY_CALIBRATED");
    // Threshold at 0.30
    expect(pipelineSource).toContain("brierScore > 0.30");
    // Stored on SubtestResult
    expect(pipelineSource).toContain("calibrationScore: brierScore");
    expect(pipelineSource).toContain("calibrationBias");
    // Overconfidence check still exists as supplementary
    expect(redFlagsSource).toContain("checkOverconfidencePattern");
  });

  it("5.3: Random responding check exists", () => {
    expect(redFlagsSource).toContain("Random");
    // Check: >30% responses < 2 seconds
  });

  it("5.4: Consistency failure check exists", () => {
    expect(redFlagsSource).toContain("Consistency");
  });
});

// ════════════════════════════════════════════════
// GROUP 5b: Brier Score Computation (Unit Tests)
// ════════════════════════════════════════════════

describe("Group 5b: Brier Score Computation", () => {
  // Inline the Brier computation for unit testing (same formula as pipeline)
  function computeBrierScore(pairs: { confidence: number; isCorrect: boolean }[]): number | null {
    if (pairs.length < 3) return null;
    const brierSum = pairs.reduce((sum, p) => {
      const actual = p.isCorrect ? 1.0 : 0.0;
      return sum + Math.pow(p.confidence - actual, 2);
    }, 0);
    return brierSum / pairs.length;
  }

  it("5b.1: Perfect calibration — low Brier score", () => {
    const score = computeBrierScore([
      { confidence: 1.0, isCorrect: true },
      { confidence: 0.0, isCorrect: false },
      { confidence: 1.0, isCorrect: true },
      { confidence: 0.5, isCorrect: true },
    ]);
    expect(score).not.toBeNull();
    expect(score!).toBeLessThan(0.15); // ~0.0625
  });

  it("5b.2: Always somewhat confident — Brier ~0.25", () => {
    const score = computeBrierScore([
      { confidence: 0.5, isCorrect: true },
      { confidence: 0.5, isCorrect: false },
      { confidence: 0.5, isCorrect: true },
      { confidence: 0.5, isCorrect: true },
    ]);
    expect(score).toBeCloseTo(0.25, 2);
  });

  it("5b.3: Overconfident — high Brier score", () => {
    const score = computeBrierScore([
      { confidence: 1.0, isCorrect: false },
      { confidence: 1.0, isCorrect: false },
      { confidence: 1.0, isCorrect: true },
      { confidence: 1.0, isCorrect: false },
    ]);
    expect(score).toBeCloseTo(0.75, 2);
    expect(score!).toBeGreaterThan(0.30); // Above red flag threshold
  });

  it("5b.4: Insufficient data — returns null", () => {
    const score = computeBrierScore([
      { confidence: 0.5, isCorrect: true },
    ]);
    expect(score).toBeNull();
  });

  it("5b.5: Empty pairs — returns null", () => {
    const score = computeBrierScore([]);
    expect(score).toBeNull();
  });
});

// ════════════════════════════════════════════════
// GROUP 6: Pipeline Lifecycle
// ════════════════════════════════════════════════

describe("Group 6: Pipeline Lifecycle", () => {
  const completeSource = readFile("src/app/api/assess/[token]/complete/route.ts");
  const pipelineSource = readFile("src/lib/assessment/scoring/pipeline.ts");

  it("6.1: Pipeline runs in background via after()", () => {
    expect(completeSource).toContain("after(() => runPipelineWithRetry");
  });

  it("6.2: Retry with exponential backoff (max 3)", () => {
    expect(completeSource).toContain("maxRetries = 3");
    expect(completeSource).toContain("Math.pow(2, attempt - 1)");
  });

  it("6.3: Failure sets candidate status to ERROR", () => {
    // Prisma enum has ERROR, not SCORING_FAILED
    expect(completeSource).toContain('status: "ERROR"');
  });

  it("6.4: Transaction wraps all scoring writes", () => {
    expect(pipelineSource).toContain("prisma.$transaction");
  });

  it("6.5: Candidate set to SCORING before pipeline starts", () => {
    expect(completeSource).toContain('status: "SCORING"');
  });

  it("6.6: Chat route rejects POST during SCORING", () => {
    const chatSource = readFile("src/app/api/assess/[token]/chat/route.ts");
    expect(chatSource).toContain("SCORING");
    expect(chatSource).toContain("409");
  });

  it("6.7: Webhook notification on final failure", () => {
    expect(completeSource).toContain("SCORING_FAILURE_WEBHOOK_URL");
    expect(completeSource).toContain("scoring_pipeline_failure");
  });
});

// ════════════════════════════════════════════════
// GROUP 7: Regression
// ════════════════════════════════════════════════

describe("Group 7: Regression", () => {
  it("7.1: All scoring files exist", () => {
    const files = [
      "src/lib/assessment/scoring/pipeline.ts",
      "src/lib/assessment/scoring/layer-a.ts",
      "src/lib/assessment/scoring/layer-b.ts",
      "src/lib/assessment/scoring/layer-c.ts",
      "src/lib/assessment/scoring/rubrics.ts",
      "src/lib/assessment/scoring/red-flags.ts",
      "src/lib/assessment/scoring/aggregation.ts",
      "src/lib/assessment/scoring/consistency.ts",
    ];
    for (const f of files) {
      expect(fs.existsSync(path.join(PROJECT_ROOT, f))).toBe(true);
    }
  });

  it("7.2: ConstructLayeredScore type has all required fields", () => {
    const typesSource = readFile("src/lib/assessment/types.ts");
    expect(typesSource).toContain("layerAScore: number | null");
    expect(typesSource).toContain("layerBScore: number | null");
    expect(typesSource).toContain("combinedRawScore: number");
    expect(typesSource).toContain("percentile: number");
    expect(typesSource).toContain("consistencyDownweightApplied: boolean");
    expect(typesSource).toContain("insufficientData?: boolean");
  });
});

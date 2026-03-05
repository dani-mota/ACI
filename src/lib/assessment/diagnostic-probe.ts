import type { CeilingTypeEnum, Construct } from "@/generated/prisma/client";
import type { AdaptiveLoopState, LayerCCharacterization, ProbeExchange } from "./types";
import { AI_CONFIG } from "./config";

/**
 * Generates diagnostic probe questions for Act 2 Phase 4.
 *
 * Probes investigate the NATURE of the candidate's performance ceiling:
 * - Hard ceiling vs. soft ceiling (trainable)
 * - Domain-specific vs. general
 * - Stress-induced vs. competence-limited
 * - Self-aware vs. blind spot
 */

/**
 * Generate a diagnostic probe question based on the candidate's item performance.
 */
export async function generateDiagnosticProbe(
  state: AdaptiveLoopState,
  previousProbes: ProbeExchange[],
): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return getFallbackProbe(state, previousProbes.length);
  }

  const prompt = buildProbePrompt(state, previousProbes);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), AI_CONFIG.realtimeTimeoutMs);

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: AI_CONFIG.realtimeModel,
        max_tokens: 200,
        messages: [{ role: "user", content: prompt }],
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      return getFallbackProbe(state, previousProbes.length);
    }

    const data = await response.json();
    return data.content?.[0]?.text || getFallbackProbe(state, previousProbes.length);
  } catch {
    return getFallbackProbe(state, previousProbes.length);
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Classify the ceiling type based on diagnostic probe exchanges and item performance.
 */
export async function classifyCeiling(
  state: AdaptiveLoopState,
): Promise<LayerCCharacterization> {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  const allResults = [
    ...state.calibrationResults,
    ...state.boundaryResults,
    ...state.pressureResults,
  ];

  // If no API key or insufficient data, use heuristic
  if (!apiKey || state.probeExchanges.length === 0) {
    return heuristicCeilingClassification(state);
  }

  const prompt = buildCeilingPrompt(state);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), AI_CONFIG.realtimeTimeoutMs);

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: AI_CONFIG.realtimeModel,
        max_tokens: 500,
        messages: [{ role: "user", content: prompt }],
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      return heuristicCeilingClassification(state);
    }

    const data = await response.json();
    const text = data.content?.[0]?.text || "";

    try {
      const parsed = JSON.parse(text);
      const validTypes: CeilingTypeEnum[] = [
        "HARD_CEILING",
        "SOFT_CEILING_TRAINABLE",
        "SOFT_CEILING_CONTEXT_DEPENDENT",
        "STRESS_INDUCED",
        "INSUFFICIENT_DATA",
      ];
      const ceilingType = validTypes.includes(parsed.ceilingType)
        ? parsed.ceilingType as CeilingTypeEnum
        : "INSUFFICIENT_DATA";

      return {
        construct: state.construct,
        ceilingType,
        narrative: parsed.narrative || "",
        trainingRecommendation: parsed.trainingRecommendation || "",
        supervisionImplication: parsed.supervisionImplication || "",
        evidenceStrength: typeof parsed.evidenceStrength === "number" ? parsed.evidenceStrength : 0.5,
      };
    } catch {
      return heuristicCeilingClassification(state);
    }
  } catch {
    return heuristicCeilingClassification(state);
  } finally {
    clearTimeout(timeoutId);
  }
}

function buildProbePrompt(state: AdaptiveLoopState, previousProbes: ProbeExchange[]): string {
  const allResults = [
    ...state.calibrationResults,
    ...state.boundaryResults,
    ...state.pressureResults,
  ];

  const correctItems = allResults.filter((r) => r.correct);
  const incorrectItems = allResults.filter((r) => !r.correct);
  const boundary = state.boundary;

  const previousExchangeSummary = previousProbes
    .map((p) => `Q: ${p.question}\nA: ${p.candidateResponse}`)
    .join("\n\n");

  const probeNumber = previousProbes.length + 1;
  const probeTargets = [
    "Hard vs. soft ceiling: Can they solve it with more time, a hint, or a different approach?",
    "Domain-specific vs. general: Is the difficulty isolated to a particular sub-type of problem?",
    "Stress-induced: Did time pressure or test anxiety cause failures they wouldn't normally have?",
  ];
  const target = probeTargets[previousProbes.length % probeTargets.length];

  return `You are generating a diagnostic follow-up question for ${formatConstruct(state.construct)}.

PERFORMANCE SUMMARY:
- Total items: ${allResults.length}
- Correct: ${correctItems.length}/${allResults.length}
- Estimated boundary: difficulty ${boundary?.estimatedBoundary?.toFixed(2) ?? "unknown"}
- Highest correct: ${correctItems.length > 0 ? Math.max(...correctItems.map((r) => r.difficulty)).toFixed(2) : "none"}
- Lowest incorrect: ${incorrectItems.length > 0 ? Math.min(...incorrectItems.map((r) => r.difficulty)).toFixed(2) : "none"}

${previousExchangeSummary ? `PREVIOUS PROBES:\n${previousExchangeSummary}\n` : ""}

DIAGNOSTIC TARGET (probe ${probeNumber}):
${target}

Generate ONE natural conversational question (1-2 sentences) that probes this diagnostic target. The question should feel like a curious follow-up, not a test. Output ONLY the question, nothing else.`;
}

function buildCeilingPrompt(state: AdaptiveLoopState): string {
  const allResults = [...state.calibrationResults, ...state.boundaryResults, ...state.pressureResults];
  const probeHistory = state.probeExchanges
    .map((p) => `Q: ${p.question}\nA: ${p.candidateResponse}`)
    .join("\n\n");

  return `Classify the performance ceiling for ${formatConstruct(state.construct)}.

ITEM PERFORMANCE:
- ${allResults.length} items served
- ${allResults.filter((r) => r.correct).length} correct
- Estimated boundary: ${state.boundary?.estimatedBoundary?.toFixed(2) ?? "unknown"}
- Pressure test results: ${state.pressureResults.map((r) => r.correct ? "pass" : "fail").join(", ") || "none"}

DIAGNOSTIC PROBE EXCHANGES:
${probeHistory || "No diagnostic probes were completed"}

CEILING TYPES:
- HARD_CEILING: Fundamental limit — cannot solve at this level even with time/support
- SOFT_CEILING_TRAINABLE: Gap that can be closed with targeted training/practice
- SOFT_CEILING_CONTEXT_DEPENDENT: Can solve in some contexts but not others
- STRESS_INDUCED: Failure is stress/pressure-related, not competence-limited
- INSUFFICIENT_DATA: Not enough evidence to classify

Return JSON only:
{
  "ceilingType": "one of the types above",
  "narrative": "2-3 sentence description of the ceiling finding",
  "trainingRecommendation": "1-2 sentences on what training could help",
  "supervisionImplication": "1 sentence on supervision needs",
  "evidenceStrength": 0.0-1.0
}`;
}

function heuristicCeilingClassification(state: AdaptiveLoopState): LayerCCharacterization {
  const allResults = [...state.calibrationResults, ...state.boundaryResults, ...state.pressureResults];

  if (allResults.length < 3) {
    return {
      construct: state.construct,
      ceilingType: "INSUFFICIENT_DATA" as CeilingTypeEnum,
      narrative: "Not enough data points to characterize the performance ceiling.",
      trainingRecommendation: "Further assessment recommended.",
      supervisionImplication: "Standard supervision appropriate.",
      evidenceStrength: 0.2,
    };
  }

  const correctRate = allResults.filter((r) => r.correct).length / allResults.length;
  const pressureCorrectRate = state.pressureResults.length > 0
    ? state.pressureResults.filter((r) => r.correct).length / state.pressureResults.length
    : correctRate;

  // Stress-induced: pressure test results significantly worse than calibration
  const calCorrectRate = state.calibrationResults.length > 0
    ? state.calibrationResults.filter((r) => r.correct).length / state.calibrationResults.length
    : correctRate;

  if (pressureCorrectRate < calCorrectRate - 0.3) {
    return {
      construct: state.construct,
      ceilingType: "STRESS_INDUCED" as CeilingTypeEnum,
      narrative: `Performance dropped significantly under pressure conditions for ${formatConstruct(state.construct)}. Calibration accuracy was ${(calCorrectRate * 100).toFixed(0)}% but dropped to ${(pressureCorrectRate * 100).toFixed(0)}% under timed/pressure conditions.`,
      trainingRecommendation: "Practice under timed conditions. Build stress resilience through graduated exposure.",
      supervisionImplication: "May need reduced-pressure environment for optimal performance.",
      evidenceStrength: 0.6,
    };
  }

  // Hard ceiling: consistently fails above a certain difficulty
  const boundary = state.boundary?.estimatedBoundary ?? 0.5;
  if (boundary < 0.4) {
    return {
      construct: state.construct,
      ceilingType: "HARD_CEILING" as CeilingTypeEnum,
      narrative: `Consistent difficulty with ${formatConstruct(state.construct)} items above the basic level. The performance boundary appears around difficulty ${boundary.toFixed(2)}.`,
      trainingRecommendation: "Foundational skill building recommended before advanced application.",
      supervisionImplication: "May need structured support for tasks requiring this ability.",
      evidenceStrength: 0.65,
    };
  }

  // Default: soft ceiling trainable
  return {
    construct: state.construct,
    ceilingType: "SOFT_CEILING_TRAINABLE" as CeilingTypeEnum,
    narrative: `${formatConstruct(state.construct)} shows a performance boundary around difficulty ${boundary.toFixed(2)} that appears amenable to training.`,
    trainingRecommendation: "Targeted practice at the boundary level should help push through this ceiling.",
    supervisionImplication: "Standard supervision with growth-oriented coaching.",
    evidenceStrength: 0.55,
  };
}

function getFallbackProbe(state: AdaptiveLoopState, probeIndex: number): string {
  const construct = formatConstruct(state.construct);
  const probes = [
    `When you came across the harder ${construct.toLowerCase()} problems, what specifically felt different about them? Was it that you didn't know the approach, or that you knew the approach but couldn't execute it?`,
    `If I gave you unlimited time on the ones you found difficult, do you think you'd eventually get them? Or do they feel like a fundamentally different kind of problem?`,
    `Thinking about ${construct.toLowerCase()} in your day-to-day work — are there situations where you feel confident versus situations where you tend to ask for help?`,
  ];
  return probes[probeIndex % probes.length];
}

function formatConstruct(construct: Construct | string): string {
  return String(construct)
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

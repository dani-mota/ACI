/**
 * Shared helpers for TurnBuilders — sentence splitting, progress, silence thresholds.
 */
import type { AssessmentState } from "@/generated/prisma/client";
import { computeProgress } from "../engine";
import { sanitizeAriaOutput, stripSensitiveFields } from "../sanitize";
import { checkLeakage } from "../filters/leakage";
import type { AssessmentTurnResponse, TurnMeta, GenerationMethod } from "@/lib/types/turn";

/**
 * Split text into sentences for TTS delivery.
 * Same logic as parse-scenario-response.ts splitSentences, but standalone.
 */
export function splitSentences(text: string): string[] {
  if (!text || text.trim().length === 0) return [];
  const raw = text.split(
    /(?<![0-9])(?<!\b[A-Z])(?<!\b(?:e\.g|i\.e|vs|etc|approx|Dr|Mr|Ms|Mrs|Jr|Sr|St))(?<=[.!?])\s+(?=[A-Z"])/
  );
  return raw
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && s.split(/\s+/).length >= 2);
}

/** Default silence thresholds per act. */
export function getSilenceThresholds(act: string): { first: number; second: number; final: number } {
  switch (act) {
    case "ACT_1": return { first: 30, second: 55, final: 90 };
    case "ACT_2": return { first: 15, second: 30, final: 45 };
    case "ACT_3": return { first: 25, second: 50, final: 75 };
    default: return { first: 30, second: 55, final: 90 };
  }
}

/** Build TurnMeta from current state. */
export function buildMeta(
  state: AssessmentState,
  generationMethod: GenerationMethod,
  opts?: { isComplete?: boolean; transition?: { from: string; to: string }; latencyMs?: number },
): TurnMeta {
  const progress = computeProgress(state);
  return {
    progress,
    generationMethod,
    ...(opts?.isComplete != null ? { isComplete: opts.isComplete } : {}),
    ...(opts?.transition ? { transition: opts.transition as TurnMeta["transition"] } : {}),
    ...(opts?.latencyMs != null ? { systemLatencyMs: opts.latencyMs } : {}),
  };
}

/**
 * Post-build pipeline: sanitize → leakage check → strip sensitive fields → return.
 * If leakage is detected, returns null (caller should use fallback content).
 */
export function postBuildPipeline(
  turn: AssessmentTurnResponse,
): { turn: AssessmentTurnResponse; leaked: boolean; sanitized: boolean } {
  let sanitized = false;

  // Sanitize all sentences
  const cleanedSentences = turn.delivery.sentences.map((s) => {
    const result = sanitizeAriaOutput(s);
    if (result.modified) sanitized = true;
    return result.cleaned;
  }).filter((s) => s.length > 0);

  // Check leakage on combined text
  const combinedText = cleanedSentences.join(" ");
  const leakage = checkLeakage(combinedText);

  // Strip sensitive fields from the entire Turn (deep)
  const stripped = stripSensitiveFields(turn as unknown as Record<string, unknown>) as unknown as AssessmentTurnResponse;

  // Apply cleaned sentences
  stripped.delivery.sentences = cleanedSentences;

  return { turn: stripped, leaked: leakage.leaked, sanitized };
}

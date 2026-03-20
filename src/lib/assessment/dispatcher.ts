/**
 * Turn Dispatcher — maps EngineAction → TurnBuilder → post-build pipeline.
 * PRD §4.3. This is the single entry point for the unified Turn architecture.
 *
 * Flow: getNextAction() → dispatch() → TurnBuilder → sanitize → filter → validate → Turn JSON
 */
import type { AssessmentTurnResponse } from "@/lib/types/turn";
import type { EngineAction, InteractiveElementAction } from "./types";
import type { TurnBuilderContext } from "./turn-builders/context";
import { postBuildPipeline, splitSentences, buildMeta } from "./turn-builders/helpers";
import { validateTurn } from "./validation/turn-schema";
import { createLogger } from "./logger";

// TurnBuilder imports
import { buildScenarioSetup } from "./turn-builders/scenario-setup";
import { buildOpenProbe } from "./turn-builders/open-probe";
import { buildMultipleChoice } from "./turn-builders/multiple-choice";
import { buildNumericInput } from "./turn-builders/numeric-input";
import { buildTimedChallenge } from "./turn-builders/timed-challenge";
import { buildDiagnosticProbe } from "./turn-builders/diagnostic-probe";
import { buildConfidenceRating } from "./turn-builders/confidence-rating";
import { buildParallelScenario } from "./turn-builders/parallel-scenario";
import { buildReflective } from "./turn-builders/reflective";
import { buildTransition } from "./turn-builders/transition";

const log = createLogger("dispatcher");

/** Circuit breaker state for Haiku failures. */
let consecutiveHaikuFailures = 0;
let circuitBreakerTripTime: number | null = null;
const CIRCUIT_BREAKER_THRESHOLD = 3;
/** After tripping, auto-reset after this cooldown and retry Haiku. */
const CIRCUIT_BREAKER_COOLDOWN_MS = 2 * 60 * 1000; // 2 minutes

/**
 * Dispatch an EngineAction to the appropriate TurnBuilder, run the post-build
 * pipeline (sanitize, filter, validate), and return the Turn.
 */
export async function dispatch(ctx: TurnBuilderContext): Promise<AssessmentTurnResponse> {
  const startTime = Date.now();
  const { action } = ctx;

  // Short-circuit immediately if breaker is tripped — avoids burning 15s per Haiku timeout
  // on every turn for all concurrent sessions. isCircuitBreakerTripped() auto-resets after
  // CIRCUIT_BREAKER_COOLDOWN_MS so the next call after cooldown retries Haiku normally.
  if (isHaikuFormat(action) && isCircuitBreakerTripped()) {
    log.warn("Circuit breaker active — returning safe fallback immediately", {
      failures: consecutiveHaikuFailures,
      tripAgeMs: circuitBreakerTripTime ? Date.now() - circuitBreakerTripTime : 0,
    });
    return buildSafeFallback(ctx);
  }

  try {
    // Select and run the appropriate TurnBuilder
    const turn = await selectAndBuild(ctx);

    // Post-build pipeline: sanitize → leakage check → strip sensitive fields
    const { turn: processed, leaked, sanitized } = postBuildPipeline(turn);

    if (sanitized) {
      log.warn("Sanitization modified Aria output", { format: processed.signal.format });
    }

    // If leakage detected, fall back to a safe default Turn
    if (leaked) {
      log.warn("Leakage detected — falling back to safe content", {
        format: processed.signal.format,
        act: processed.signal.act,
      });
      return buildSafeFallback(ctx, processed);
    }

    // Validate the Turn against Zod schema
    const validation = validateTurn(processed);
    if (!validation.success) {
      log.error("Turn validation failed", {
        format: action.type,
        errors: validation.error.issues.map((i) => i.message),
      });
      return buildSafeFallback(ctx, processed);
    }

    // Reset circuit breaker on success
    if (isHaikuFormat(action)) {
      consecutiveHaikuFailures = 0;
      circuitBreakerTripTime = null;
    }

    const latencyMs = Date.now() - startTime;
    processed.meta.systemLatencyMs = latencyMs;

    return processed;
  } catch (err) {
    log.error("TurnBuilder threw", {
      actionType: action.type,
      error: err instanceof Error ? err.message : String(err),
    });

    // Track Haiku failures for circuit breaker
    if (isHaikuFormat(action)) {
      consecutiveHaikuFailures++;
      if (consecutiveHaikuFailures >= CIRCUIT_BREAKER_THRESHOLD) {
        if (circuitBreakerTripTime === null) {
          circuitBreakerTripTime = Date.now(); // record when breaker first tripped
        }
        log.error("Circuit breaker tripped — disabling hybrid generation for cooldown", {
          failures: consecutiveHaikuFailures,
          cooldownMs: CIRCUIT_BREAKER_COOLDOWN_MS,
        });
      }
    }

    return buildSafeFallback(ctx);
  }
}

/**
 * Select the TurnBuilder based on EngineAction type and context.
 */
async function selectAndBuild(ctx: TurnBuilderContext): Promise<AssessmentTurnResponse> {
  const { action, state } = ctx;

  switch (action.type) {
    case "COMPLETE":
    case "TRANSITION":
      return buildTransition(ctx);

    case "INTERACTIVE_ELEMENT": {
      const elAction = action as InteractiveElementAction;
      const elType = String(elAction.elementType);

      if (elType === "CONFIDENCE_RATING") return buildConfidenceRating(ctx);
      if (elType === "TIMED_CHALLENGE") return buildTimedChallenge(ctx);
      if (elType === "NUMERIC_INPUT") return buildNumericInput(ctx);
      // Default interactive: multiple choice
      return buildMultipleChoice(ctx);
    }

    case "AGENT_MESSAGE": {
      const act = state.currentAct;
      const meta = action.metadata as Record<string, unknown> | undefined;
      const beatIndex = (meta?.beatIndex as number) ?? state.currentBeat;

      // Act 1
      if (act === "ACT_1") {
        // Beat 0 = Scenario Setup
        if (beatIndex === 0) return buildScenarioSetup(ctx);
        // Beats 1-5 = Open Probe
        return buildOpenProbe(ctx);
      }

      // Act 2 — Diagnostic Probe (phase 3)
      if (act === "ACT_2") return buildDiagnosticProbe(ctx);

      // Act 3
      if (act === "ACT_3") {
        const act3Progress = state.act3Progress as Record<string, unknown> | null;
        const parallelComplete = !!(act3Progress?.parallelScenariosComplete);

        if (!parallelComplete) return buildParallelScenario(ctx);
        return buildReflective(ctx);
      }

      // Fallback
      return buildOpenProbe(ctx);
    }

    default:
      return buildTransition(ctx);
  }
}

/** Check if the action type involves Haiku generation. */
function isHaikuFormat(action: EngineAction): boolean {
  return action.type === "AGENT_MESSAGE";
}

/**
 * Whether the circuit breaker is currently tripped.
 * Auto-resets after CIRCUIT_BREAKER_COOLDOWN_MS so the next dispatch()
 * call after cooldown retries Haiku instead of permanently falling back.
 */
export function isCircuitBreakerTripped(): boolean {
  if (consecutiveHaikuFailures < CIRCUIT_BREAKER_THRESHOLD) return false;
  // Auto-reset after cooldown — allows recovery without a cold start
  if (circuitBreakerTripTime !== null && Date.now() - circuitBreakerTripTime >= CIRCUIT_BREAKER_COOLDOWN_MS) {
    consecutiveHaikuFailures = 0;
    circuitBreakerTripTime = null;
    log.info("Circuit breaker auto-reset after cooldown — retrying Haiku");
    return false;
  }
  return true;
}

/** Reset circuit breaker (for testing or manual recovery). */
export function resetCircuitBreaker(): void {
  consecutiveHaikuFailures = 0;
  circuitBreakerTripTime = null;
}

/**
 * Build a safe fallback Turn when the builder or validation fails.
 * Uses generic safe content that won't leak internals.
 */
function buildSafeFallback(
  ctx: TurnBuilderContext,
  partial?: AssessmentTurnResponse,
): AssessmentTurnResponse {
  const { state } = ctx;
  const format = partial?.signal?.format ?? "OPEN_PROBE";
  const act = partial?.signal?.act ?? state.currentAct;

  return {
    type: "turn",
    delivery: {
      sentences: splitSentences(
        "Let me rephrase that. Tell me more about how you'd approach this situation."
      ),
    },
    input: {
      type: "voice-or-text",
    },
    signal: {
      format: format as any,
      act: act as any,
      primaryConstructs: partial?.signal?.primaryConstructs ?? [],
      secondaryConstructs: [],
    },
    meta: buildMeta(state, "pre-generated"),
  };
}

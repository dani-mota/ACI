import type { Construct } from "@/generated/prisma/client";
import type {
  Act2Item,
  AdaptiveLoopState,
  AdaptivePhase,
  ItemResult,
  BoundaryDetection,
  PressureTestResult,
} from "./types";
import { getItemsForConstruct, getAvailableItems } from "./item-bank";

/**
 * Adaptive Investigation Loop for Act 2.
 *
 * NOTE: The PRD (§11.1-11.2) describes a step-based algorithm (±0.15/±0.10 difficulty steps).
 * The implementation below uses binary search and fixed-tier calibration, which is more
 * psychometrically efficient. This comment documents what the code ACTUALLY does.
 *
 * ── Phase 1: CALIBRATION ──────────────────────────────────────────────────────
 * Purpose: Rough ability placement before search begins.
 * Item selection: Three fixed difficulty tiers served in order:
 *   - Item 1: easy      [0.15 – 0.35]
 *   - Item 2: medium    [0.40 – 0.60]
 *   - Item 3: hard      [0.65 – 0.85]
 *   Items are picked randomly within each band from unserved items for the construct.
 * Advancement trigger: After 3 items. Early exit after 2 items if an easy item
 *   (difficulty < 0.30) is missed — indicates a low ceiling, start boundary search earlier.
 *
 * ── Phase 2: BOUNDARY_MAPPING ─────────────────────────────────────────────────
 * Purpose: Locate the difficulty level where accuracy transitions from correct to incorrect.
 * Item selection: Binary search — target difficulty = (maxCorrect + minIncorrect) / 2.
 *   Items within ±0.1 of target are candidates; sorted by proximity, first is served.
 *   SubType diversity preferred: expand candidates beyond already-tested subTypes first.
 * Advancement trigger: Boundary confidence ≥ 0.7 (maxCorrect < minIncorrect - 0.1
 *   with enough data to be confident), OR ≥ 5 items served without convergence.
 * Boundary value: stored in `state.boundary` as the midpoint difficulty.
 *
 * ── Phase 3: PRESSURE_TEST ────────────────────────────────────────────────────
 * Purpose: Validate the boundary from a different angle to rule out construct-specific noise.
 * Item selection: Items within ±0.15 of the mapped boundary, prioritising subTypes not
 *   yet tested (tests the same difficulty from a different cognitive angle).
 * Advancement trigger: Boundary confirmed without contradiction (all results consistent
 *   with mapped boundary), OR 2+ results collected and contradiction is resolved.
 *
 * ── Phase 4: DIAGNOSTIC_PROBE ─────────────────────────────────────────────────
 * Purpose: Conversational characterisation of the ability ceiling — qualitative context
 *   the structured items can't capture (strategies, confidence, metacognitive awareness).
 * Item selection: getNextItem() returns null. Engine generates AGENT_MESSAGE.
 *   buildDiagnosticProbe() calls Haiku with a performance summary (itemCount, correctCount,
 *   avgResponseTimeMs) to generate a construct-specific reflection prompt.
 * Up to 3 probe exchanges per construct. After 3, engine sets constructComplete=true.
 */

/**
 * Initialize a new adaptive loop state for a construct.
 */
export function initLoopState(construct: Construct): AdaptiveLoopState {
  return {
    construct,
    phase: "CALIBRATION",
    calibrationResults: [],
    boundaryResults: [],
    pressureResults: [],
    probeExchanges: [],
    boundary: null,
    itemsServed: [],
  };
}

/**
 * Get the next item to serve based on the current loop state.
 * Returns null if the current phase's items are complete (should transition to next phase).
 */
export function getNextItem(state: AdaptiveLoopState): Act2Item | null {
  switch (state.phase) {
    case "CALIBRATION":
      return getCalibrationItem(state);
    case "BOUNDARY_MAPPING":
      return getBoundaryItem(state);
    case "PRESSURE_TEST":
      return getPressureTestItem(state);
    case "DIAGNOSTIC_PROBE":
      return null; // Diagnostic probes are conversational, not structured items
    default:
      return null;
  }
}

/**
 * Record an item result and advance the loop state.
 * Returns the updated state and whether a phase transition occurred.
 */
export function recordResult(
  state: AdaptiveLoopState,
  result: ItemResult,
): { state: AdaptiveLoopState; phaseTransition: boolean; nextPhase?: AdaptivePhase } {
  const updated = { ...state, itemsServed: [...state.itemsServed, result.itemId] };

  switch (state.phase) {
    case "CALIBRATION": {
      updated.calibrationResults = [...state.calibrationResults, result];

      // After 3 calibration items (or 2 if one was clearly wrong), compute rough placement
      if (updated.calibrationResults.length >= 3) {
        return {
          state: { ...updated, phase: "BOUNDARY_MAPPING" },
          phaseTransition: true,
          nextPhase: "BOUNDARY_MAPPING",
        };
      }
      // Early exit on 2 items if one easy item was missed
      if (updated.calibrationResults.length === 2) {
        const missedEasy = updated.calibrationResults.some(
          (r) => !r.correct && r.difficulty < 0.3,
        );
        if (missedEasy) {
          return {
            state: { ...updated, phase: "BOUNDARY_MAPPING" },
            phaseTransition: true,
            nextPhase: "BOUNDARY_MAPPING",
          };
        }
      }
      return { state: updated, phaseTransition: false };
    }

    case "BOUNDARY_MAPPING": {
      updated.boundaryResults = [...state.boundaryResults, result];

      // Compute boundary after each result
      const boundary = computeBoundary(
        [...updated.calibrationResults, ...updated.boundaryResults],
      );
      updated.boundary = boundary;

      // Continue until boundary is confident enough or we've served enough items
      if (boundary.confidence >= 0.7 || updated.boundaryResults.length >= 5) {
        return {
          state: { ...updated, phase: "PRESSURE_TEST" },
          phaseTransition: true,
          nextPhase: "PRESSURE_TEST",
        };
      }
      return { state: updated, phaseTransition: false };
    }

    case "PRESSURE_TEST": {
      updated.pressureResults = [...state.pressureResults, result];
      const pressureResult = evaluatePressureTest(updated);

      if (pressureResult.needsResolution && updated.pressureResults.length < 3) {
        // Serve one more item to resolve contradiction
        return { state: updated, phaseTransition: false };
      }

      if (pressureResult.contradiction && updated.pressureResults.length >= 2) {
        // Boundary needs revision — loop back to boundary mapping
        return {
          state: { ...updated, phase: "BOUNDARY_MAPPING", boundary: null },
          phaseTransition: true,
          nextPhase: "BOUNDARY_MAPPING",
        };
      }

      // Boundary confirmed, move to diagnostic probe
      return {
        state: { ...updated, phase: "DIAGNOSTIC_PROBE" },
        phaseTransition: true,
        nextPhase: "DIAGNOSTIC_PROBE",
      };
    }

    default:
      return { state: updated, phaseTransition: false };
  }
}

// ──────────────────────────────────────────────
// Phase-specific item selection
// ──────────────────────────────────────────────

function getCalibrationItem(state: AdaptiveLoopState): Act2Item | null {
  const construct = state.construct as string;
  const served = state.itemsServed;
  const calibrationCount = state.calibrationResults.length;

  // Serve items at mixed difficulty: easy, medium, hard
  const targetDifficulties: [number, number][] = [
    [0.15, 0.35], // Item 1: easy
    [0.4, 0.6],   // Item 2: medium
    [0.65, 0.85], // Item 3: hard
  ];

  const [min, max] = targetDifficulties[calibrationCount] ?? [0.4, 0.6];
  const candidates = getAvailableItems(construct, min, max, served);

  if (candidates.length === 0) {
    // Fallback: get any unserved item
    const all = getAvailableItems(construct, 0, 1, served);
    return all[0] ?? null;
  }

  // Pick randomly from candidates for variety
  return candidates[Math.floor(Math.random() * candidates.length)];
}

function getBoundaryItem(state: AdaptiveLoopState): Act2Item | null {
  const construct = state.construct as string;
  const served = state.itemsServed;
  const allResults = [...state.calibrationResults, ...state.boundaryResults];

  if (allResults.length === 0) {
    // No data yet — start at medium
    const items = getAvailableItems(construct, 0.4, 0.6, served);
    return items[0] ?? null;
  }

  // Binary search: find the highest difficulty they got right and lowest they got wrong
  const correctDifficulties = allResults.filter((r) => r.correct).map((r) => r.difficulty);
  const incorrectDifficulties = allResults.filter((r) => !r.correct).map((r) => r.difficulty);

  const maxCorrect = correctDifficulties.length > 0 ? Math.max(...correctDifficulties) : 0;
  const minIncorrect = incorrectDifficulties.length > 0 ? Math.min(...incorrectDifficulties) : 1;

  // Target the midpoint between confirmed floor and confirmed ceiling
  const targetDifficulty = (maxCorrect + minIncorrect) / 2;
  const margin = 0.1;

  const candidates = getAvailableItems(
    construct,
    Math.max(0, targetDifficulty - margin),
    Math.min(1, targetDifficulty + margin),
    served,
  );

  if (candidates.length === 0) {
    // Expand search range
    const expanded = getAvailableItems(construct, 0, 1, served);
    // Pick the closest to target difficulty
    expanded.sort((a, b) =>
      Math.abs(a.difficulty - targetDifficulty) - Math.abs(b.difficulty - targetDifficulty),
    );
    return expanded[0] ?? null;
  }

  // Pick the item closest to target difficulty
  candidates.sort((a, b) =>
    Math.abs(a.difficulty - targetDifficulty) - Math.abs(b.difficulty - targetDifficulty),
  );
  return candidates[0];
}

function getPressureTestItem(state: AdaptiveLoopState): Act2Item | null {
  if (!state.boundary) return null;

  const construct = state.construct as string;
  const served = state.itemsServed;
  const boundaryDifficulty = state.boundary.estimatedBoundary;

  // Get items near the boundary but from a different subType
  const previousSubTypes = new Set(
    [...state.calibrationResults, ...state.boundaryResults]
      .map((r) => {
        const allItems = getItemsForConstruct(construct);
        const item = allItems.find((i) => i.id === r.itemId);
        return item?.subType;
      })
      .filter(Boolean),
  );

  const candidates = getAvailableItems(
    construct,
    Math.max(0, boundaryDifficulty - 0.15),
    Math.min(1, boundaryDifficulty + 0.15),
    served,
  );

  // Prefer items with a different subType (tests from a different angle)
  const differentSubType = candidates.filter((c) => !previousSubTypes.has(c.subType));
  if (differentSubType.length > 0) {
    return differentSubType[Math.floor(Math.random() * differentSubType.length)];
  }

  return candidates[0] ?? null;
}

// ──────────────────────────────────────────────
// Boundary computation
// ──────────────────────────────────────────────

function computeBoundary(results: ItemResult[]): BoundaryDetection {
  if (results.length === 0) {
    return {
      construct: "FLUID_REASONING" as Construct,
      estimatedBoundary: 0.5,
      confirmedFloor: 0,
      confirmedCeiling: 1,
      confidence: 0,
      itemResults: [],
    };
  }

  const correct = results.filter((r) => r.correct);
  const incorrect = results.filter((r) => !r.correct);

  const confirmedFloor = correct.length > 0 ? Math.max(...correct.map((r) => r.difficulty)) : 0;
  const confirmedCeiling = incorrect.length > 0 ? Math.min(...incorrect.map((r) => r.difficulty)) : 1;
  const estimatedBoundary = (confirmedFloor + confirmedCeiling) / 2;

  // Confidence increases with more data points and narrower boundary gap
  const gapWidth = confirmedCeiling - confirmedFloor;
  const dataConfidence = Math.min(results.length / 6, 1); // Max at 6 items
  const gapConfidence = gapWidth < 0.3 ? 1 : gapWidth < 0.5 ? 0.6 : 0.3;
  const confidence = dataConfidence * gapConfidence;

  return {
    construct: results[0].construct,
    estimatedBoundary,
    confirmedFloor,
    confirmedCeiling,
    confidence,
    itemResults: results,
  };
}

function evaluatePressureTest(state: AdaptiveLoopState): PressureTestResult {
  if (!state.boundary || state.pressureResults.length === 0) {
    return { confirmed: false, contradiction: false, needsResolution: true };
  }

  const boundary = state.boundary.estimatedBoundary;

  // Check if pressure test results are consistent with boundary
  // Fix: PRO-18 — narrowed from ±0.2 to ±0.1 to avoid false contradictions
  // from items well below boundary that candidates correctly answer
  const atBoundaryResults = state.pressureResults.filter(
    (r) => Math.abs(r.difficulty - boundary) < 0.1,
  );

  if (atBoundaryResults.length === 0) {
    return { confirmed: false, contradiction: false, needsResolution: true };
  }

  const correctAtBoundary = atBoundaryResults.filter((r) => r.correct).length;
  const correctRate = correctAtBoundary / atBoundaryResults.length;

  // If they're getting 70%+ correct at the boundary, boundary may be too low
  if (correctRate >= 0.7) {
    return { confirmed: false, contradiction: true, needsResolution: false };
  }

  // If they're getting 30% or less correct, boundary is confirmed
  if (correctRate <= 0.3) {
    return { confirmed: true, contradiction: false, needsResolution: false };
  }

  // Ambiguous — need more data if we haven't maxed out
  if (state.pressureResults.length < 3) {
    return { confirmed: false, contradiction: false, needsResolution: true };
  }

  // With enough data, accept the boundary
  return { confirmed: true, contradiction: false, needsResolution: false };
}

/**
 * Compute the raw score for a construct based on all adaptive loop results.
 * Score is accuracy weighted by item difficulty.
 */
export function computeAdaptiveScore(state: AdaptiveLoopState): number {
  const allResults = [
    ...state.calibrationResults,
    ...state.boundaryResults,
    ...state.pressureResults,
  ];

  if (allResults.length === 0) return 0;

  let weightedSum = 0;
  let weightSum = 0;

  for (const result of allResults) {
    // Harder items are worth more: weight = 1 + (difficulty - 0.5) * 0.3
    const weight = 1 + (result.difficulty - 0.5) * 0.3;
    weightedSum += (result.correct ? 1 : 0) * weight;
    weightSum += weight;
  }

  return weightSum > 0 ? weightedSum / weightSum : 0;
}

/**
 * Format Resolver — maps assessment state to one of 9 screen formats.
 *
 * Format 1: Conversational / Open Voice (Phase 0, Act 2 diagnostic, Act 3 open)
 * Format 2: Conversational + Reference Card Build (Act 1 Beat 0)
 * Format 3: Reference Card Update (Act 1 Beats 1-5)
 * Format 4: Multiple Choice (Act 2 MC/tradeoff items)
 * Format 5: Timed Challenge (Act 2 timed items)
 * Format 6: Numeric Input (Act 2 numeric items)
 * Format 7: Confidence Rating (Act 3 confidence items)
 * Format 8: Act Transition (all TRANSITION_* phases)
 * Format 9: Completion (assessment complete)
 */

import type { OrchestratorPhase } from "@/lib/assessment/transitions";

export type AssessmentFormat = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

interface ActiveElementInfo {
  elementType: string;
  responded: boolean;
}

export function resolveFormat(
  phase: OrchestratorPhase,
  activeElement: ActiveElementInfo | null,
  referenceRevealCount: number,
  isComplete: boolean,
): AssessmentFormat {
  // Format 9: Completion
  if (isComplete || phase === "COMPLETING") return 9;

  // Format 8: Transitions
  if (
    phase === "TRANSITION_0_1" ||
    phase === "TRANSITION_1_2" ||
    phase === "TRANSITION_2_3"
  ) {
    return 8;
  }

  // Act 1: Reference card formats
  if (phase === "ACT_1") {
    // Format 2: Beat 0 progressive reveal (revealCount === 0 means card just appeared)
    if (referenceRevealCount === 0) return 2;
    // Format 3: Card already built, subsequent beats
    return 3;
  }

  // Act 2: Interactive element formats
  if (phase === "ACT_2") {
    if (activeElement && !activeElement.responded) {
      switch (activeElement.elementType) {
        case "MULTIPLE_CHOICE_INLINE":
        case "TRADEOFF_SELECTION":
          return 4;
        case "TIMED_CHALLENGE":
          return 5;
        case "NUMERIC_INPUT":
          return 6;
      }
    }
    // Diagnostic probe or no element — conversational
    return 1;
  }

  // Act 3: Confidence or conversational
  if (phase === "ACT_3") {
    if (activeElement && !activeElement.responded && activeElement.elementType === "CONFIDENCE_RATING") {
      return 7;
    }
    return 1;
  }

  // Phase 0 or fallback
  return 1;
}

/** Human-readable format label for debugging */
export const FORMAT_LABELS: Record<AssessmentFormat, string> = {
  1: "Conversational",
  2: "Reference Card Build",
  3: "Reference Card Update",
  4: "Multiple Choice",
  5: "Timed Challenge",
  6: "Numeric Input",
  7: "Confidence Rating",
  8: "Transition",
  9: "Completion",
};

/**
 * Turn format enums and beat types for the unified architecture.
 * PRD §3.1, §9.2.
 */

// ──────────────────────────────────────────────
// Turn Formats (the 9 assessment formats + control)
// ──────────────────────────────────────────────

export const TURN_FORMATS = [
  "SCENARIO_SETUP",       // F1: Act 1 Beat 0
  "OPEN_PROBE",           // F2: Act 1 Beats 1-5
  "MULTIPLE_CHOICE",      // F3: Act 2
  "NUMERIC_INPUT",        // F4: Act 2
  "TIMED_CHALLENGE",      // F5: Act 2
  "DIAGNOSTIC_PROBE",     // F6: Act 2 Phase 4
  "CONFIDENCE_RATING",    // F7: Act 3 Phase 1
  "PARALLEL_SCENARIO",    // F8: Act 3 Phase 2
  "REFLECTIVE_ASSESSMENT",// F9: Act 3 Phase 3
  "TRANSITION",           // Act transitions (B-4)
  "COMPLETION",           // Assessment done (B-4)
] as const;

export type TurnFormat = (typeof TURN_FORMATS)[number];

// ──────────────────────────────────────────────
// Beat Types (Act 1 scenario structure)
// ──────────────────────────────────────────────

export const BEAT_TYPES = [
  "INITIAL_SITUATION",
  "INITIAL_RESPONSE",
  "COMPLICATION",
  "SOCIAL_PRESSURE",
  "CONSEQUENCE_REVEAL",
  "REFLECTIVE_SYNTHESIS",
] as const;

export type BeatType = (typeof BEAT_TYPES)[number];

// ──────────────────────────────────────────────
// Adaptive Phases (Act 2 item selection)
// ──────────────────────────────────────────────

export const ADAPTIVE_PHASES = [
  "RAPID_CONVERGENCE",
  "PRECISION_NARROWING",
  "BOUNDARY_MAPPING",
  "DIAGNOSTIC_PROBE",
] as const;

export type AdaptivePhase = (typeof ADAPTIVE_PHASES)[number];

// ──────────────────────────────────────────────
// Response Classification (Act 1 branching)
// ──────────────────────────────────────────────

export const RESPONSE_CLASSIFICATIONS = ["STRONG", "ADEQUATE", "WEAK"] as const;

export type ResponseClassification = (typeof RESPONSE_CLASSIFICATIONS)[number];

// ──────────────────────────────────────────────
// Confidence Levels (Act 3)
// ──────────────────────────────────────────────

export const CONFIDENCE_LEVELS = ["VERY_CONFIDENT", "SOMEWHAT_CONFIDENT", "NOT_SURE"] as const;

export type ConfidenceLevel = (typeof CONFIDENCE_LEVELS)[number];

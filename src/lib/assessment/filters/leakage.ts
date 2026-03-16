/**
 * Construct/rubric leakage filter — prevents Aria from accidentally revealing
 * assessment internals to the candidate.
 *
 * PRD §14.1, Pilot blocker P-6, Appendix B Cluster 3.
 *
 * Checks Aria's output for:
 * 1. All 12 construct names (as standalone words)
 * 2. Classification tokens (STRONG/ADEQUATE/WEAK as standalone capitalized words)
 * 3. Rubric vocabulary (behavioral indicators, scoring terms)
 * 4. Internal assessment structure terms
 *
 * Pure function, fully unit-testable. On hit: logs and returns { leaked: true }.
 * Caller should fall back to content library.
 */

// ──────────────────────────────────────────────
// Blocklist Definitions
// ──────────────────────────────────────────────

/** All 12 construct names — match as whole words, case-insensitive. */
const CONSTRUCT_NAMES = [
  "fluid reasoning",
  "executive control",
  "cognitive flexibility",
  "metacognitive calibration",
  "learning velocity",
  "systems diagnostics",
  "pattern recognition",
  "quantitative reasoning",
  "spatial visualization",
  "mechanical reasoning",
  "procedural reliability",
  "ethical judgment",
];

/**
 * Construct identifiers in SCREAMING_SNAKE_CASE.
 * These should never appear in candidate-facing text.
 */
const CONSTRUCT_IDS = [
  "FLUID_REASONING",
  "EXECUTIVE_CONTROL",
  "COGNITIVE_FLEXIBILITY",
  "METACOGNITIVE_CALIBRATION",
  "LEARNING_VELOCITY",
  "SYSTEMS_DIAGNOSTICS",
  "PATTERN_RECOGNITION",
  "QUANTITATIVE_REASONING",
  "SPATIAL_VISUALIZATION",
  "MECHANICAL_REASONING",
  "PROCEDURAL_RELIABILITY",
  "ETHICAL_JUDGMENT",
];

/**
 * Classification tokens — only match as standalone CAPITALIZED words.
 * "strong" in lowercase is fine ("That's a strong approach").
 * "STRONG" or "ADEQUATE" or "WEAK" as standalone tokens = leaked.
 */
const CLASSIFICATION_TOKENS = ["STRONG", "ADEQUATE", "WEAK", "NEEDS_DEVELOPMENT"];

/**
 * Rubric and assessment vocabulary that should never reach the candidate.
 */
const RUBRIC_VOCABULARY = [
  "rubric score",
  "rubric indicator",
  "behavioral indicator",
  "construct signal",
  "signal strength",
  "layer a",
  "layer b",
  "layer c",
  "scoring pipeline",
  "classification result",
  "branch rationale",
  "difficulty parameter",
  "adaptive phase",
  "boundary mapping",
  "pressure test",
  "calibration phase",
  "diagnostic probe phase",
  "construct target",
  "downweight",
  "percentile",
  "composite score",
  "cutline",
  "red flag",
];

// ──────────────────────────────────────────────
// Compiled Patterns
// ──────────────────────────────────────────────

/** Construct names as case-insensitive whole-word patterns. Allows optional trailing 's' for plurals. */
const CONSTRUCT_NAME_PATTERNS = CONSTRUCT_NAMES.map(
  (name) => new RegExp(`\\b${name.replace(/\s+/g, "\\s+")}s?\\b`, "i")
);

/** Construct IDs as whole-word patterns (case-sensitive — they're SCREAMING_SNAKE). */
const CONSTRUCT_ID_PATTERNS = CONSTRUCT_IDS.map(
  (id) => new RegExp(`\\b${id}\\b`)
);

/**
 * Classification tokens as standalone UPPERCASE words.
 * Uses word boundary + case-sensitive match to avoid false positives
 * on normal English ("strong", "weak", "adequate").
 */
const CLASSIFICATION_PATTERNS = CLASSIFICATION_TOKENS.map(
  (token) => new RegExp(`\\b${token}\\b`)
);

/** Rubric vocabulary as case-insensitive whole-phrase patterns. Allows optional trailing 's' for plurals. */
const RUBRIC_PATTERNS = RUBRIC_VOCABULARY.map(
  (phrase) => new RegExp(`\\b${phrase.replace(/\s+/g, "\\s+")}s?\\b`, "i")
);

// ──────────────────────────────────────────────
// Leakage Detection
// ──────────────────────────────────────────────

export interface LeakageResult {
  /** True if any leakage was detected. */
  leaked: boolean;
  /** Which patterns matched. */
  matches: LeakageMatch[];
}

export interface LeakageMatch {
  category: "construct-name" | "construct-id" | "classification" | "rubric-vocabulary";
  matched: string;
}

/**
 * Check Aria's output text for construct/rubric leakage.
 *
 * @param text - Aria's generated response (after sanitization).
 * @returns LeakageResult with matches. If leaked=true, caller should use fallback content.
 */
export function checkLeakage(text: string): LeakageResult {
  const matches: LeakageMatch[] = [];

  for (const pattern of CONSTRUCT_NAME_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      matches.push({ category: "construct-name", matched: match[0] });
    }
  }

  for (const pattern of CONSTRUCT_ID_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      matches.push({ category: "construct-id", matched: match[0] });
    }
  }

  for (const pattern of CLASSIFICATION_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      matches.push({ category: "classification", matched: match[0] });
    }
  }

  for (const pattern of RUBRIC_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      matches.push({ category: "rubric-vocabulary", matched: match[0] });
    }
  }

  const leaked = matches.length > 0;
  if (leaked) {
    console.warn("[leakage-filter] Construct/rubric leakage detected:", matches);
  }

  return { leaked, matches };
}

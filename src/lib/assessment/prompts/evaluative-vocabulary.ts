/**
 * PRO-134: Shared evaluative-vocabulary list for Employee Mode prompts.
 *
 * Two tiers:
 *
 * 1. FORBIDDEN_PATTERNS — hard regex block. AI output containing any of these
 *    8 verbatim phrases is discarded and the deterministic fallback fires.
 *    These are the AC's verbatim list; the regex is intentionally narrow to
 *    avoid false-positive whack-a-mole.
 *
 * 2. SOFT_AVOID_TERMS — prompt-level soft guidance. Listed in the prompt
 *    "AVOID" section so Haiku steers away from them, but NOT regex-blocked.
 *    Banning them outright forces awkward circumlocutions in legitimate
 *    descriptive phrasing.
 *
 * Known false-positive: "threshold" matches legitimate developmental uses
 * like "low threshold for ambiguity." Acceptable trade-off — context-aware
 * handling is a future ticket.
 */

export const FORBIDDEN_PATTERNS: RegExp[] = [
  /\bred[ -]?flag\b/i,
  /\bconcern\b/i, // matches "concern" / "concerns" but NOT "concerning" by design
  /\brisk\b/i,
  /\bnot[ -]?recommended\b/i,
  /\bdecline\b/i,
  /\bcutline\b/i,
  /\bthreshold\b/i,
  /\bpercentile\s+of\s+candidates\b/i,
];

export function containsForbiddenLanguage(text: string): boolean {
  return FORBIDDEN_PATTERNS.some((re) => re.test(text));
}

export const SOFT_AVOID_TERMS = [
  "weak",
  "poor",
  "deficient",
  "worrying",
  "inadequate",
  "good",
  "bad",
  "excellent",
  "concerning",
] as const;

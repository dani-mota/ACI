/**
 * Output sanitization utilities for Aria's speech.
 * PRD Appendix B (Cluster 3), §14.1.
 *
 * Three functions:
 * - sanitizeAriaOutput() — strips LLM artifacts before TTS (defense-in-depth)
 * - stripSensitiveFields() — removes correctAnswer etc. from Turn data
 * - normalizeInput() — re-exported from validation/input-schema.ts
 */

// Re-export input normalization for convenience
export { normalizeInput } from "./validation/input-schema";
export type { NormalizedInput } from "./validation/input-schema";

/**
 * Strip LLM artifacts from Aria's generated text before it reaches TTS.
 *
 * This is a defense-in-depth safety net — the prompts are the primary defense.
 * In normal operation this function should have nothing to strip. Every
 * modification is logged so we can track prompt effectiveness.
 *
 * Runs AFTER Haiku generation, BEFORE probe verification, BEFORE sentence
 * splitting, BEFORE TTS delivery.
 *
 * Fixed regex from audit P1-7: uses /<\/?[a-zA-Z][^>]*>/g for proper HTML/XML
 * tag matching (not the overly broad /<[^>]+>/g which matches legitimate text
 * like "temperature < threshold > baseline").
 */
export function sanitizeAriaOutput(text: string): { cleaned: string; modified: boolean; strippedPatterns: string[] } {
  const strippedPatterns: string[] = [];
  let result = text;

  function apply(regex: RegExp, label: string): void {
    const before = result;
    result = result.replace(regex, "");
    if (result !== before) {
      strippedPatterns.push(label);
    }
  }

  // Stage directions: *anything in asterisks*
  apply(/\*[^*]+\*/g, "stage-directions-asterisk");

  // Stage directions in parentheses: (Aria nods), (pauses)
  apply(/\([^)]*(?:pauses?|nods?|smiles?|leans?|looks?|turns?|gestures?|considers?|thinks?|takes?\s+a|waits?)[^)]*\)/gi, "stage-directions-parens");

  // Third-person Aria references: "Aria pauses.", "She considers."
  apply(/\bAria\s+(?:pauses?|nods?|smiles?|leans?|looks?|turns?|gestures?|considers?|thinks?|takes?|waits?)\b[^.]*\.\s*/gi, "third-person-aria");
  apply(/\bShe\s+(?:pauses?|nods?|smiles?|leans?|looks?|turns?|gestures?|considers?|thinks?|takes?|waits?)\b[^.]*\.\s*/gi, "third-person-she");

  // XML/HTML-like tags (fixed regex per audit P1-7)
  apply(/<\/?[a-zA-Z][a-zA-Z0-9_]*[^>]*>/g, "xml-tags");

  // Bracket tags: [anything in uppercase brackets], [pause], [silence], [BEAT:], etc.
  apply(/\[[A-Z_]{2,}[^\]]*\]/g, "bracket-tags-upper");
  apply(/\[(?:pause|silence|thinking|beat|spoken\s*text|reference)[^\]]*\]/gi, "bracket-tags-known");

  // Markdown headers: ## anything
  apply(/^#{1,6}\s+.+$/gm, "markdown-headers");

  // Markdown bold/italic
  apply(/\*{1,3}([^*]+)\*{1,3}/g, "markdown-emphasis");

  // Template/structural labels: SPOKEN TEXT:, BEAT TYPE:, etc.
  // Match at start of line OR after whitespace (handles post-strip residual)
  apply(/(?:^|\s)(?:PART\s+\d+\s*[-—–:]+\s*)?(?:SPOKEN\s+TEXT|REFERENCE\s*(?:CARD|UPDATE)?|BEAT\s*TYPE|TEMPLATE|BRANCH\s*SCRIPT|CONSTRUCT|CLASSIFICATION)\s*[:—–-]+\s*/gim, "template-labels");

  // Beat headers: # BEAT 1: INITIAL_SITUATION
  apply(/^#+\s+BEAT\s+\d+[:\s].*$/gm, "beat-headers");

  // Standalone beat type labels
  apply(/^(?:INITIAL[_\s]SITUATION|COMPLICATION|SOCIAL[_\s]PRESSURE|CONSEQUENCE[_\s]REVEAL|REFLECTIVE[_\s]SYNTHESIS)\s*$/gm, "beat-type-labels");

  // Delimiter lines: ---REFERENCE---, --- (horizontal rules)
  apply(/-{3,}\s*(?:REFERENCE[_\s]*UPDATE?|REFERENCE)?\s*-{0,}/g, "delimiter-lines");

  // JSON blocks embedded in speech
  apply(/\{[\s\S]*?"(?:role|context|sections|newInformation)"[\s\S]*?\}/g, "embedded-json");

  // Collapse excessive whitespace
  result = result.replace(/\n{3,}/g, "\n\n").replace(/\s{2,}/g, " ").trim();

  const modified = strippedPatterns.length > 0;
  if (modified) {
    console.warn("[sanitize] Aria output modified — stripped patterns:", strippedPatterns);
  }

  return { cleaned: result, modified, strippedPatterns };
}

/**
 * Strip sensitive fields from data before sending to client.
 * Uses a whitelist approach per audit P0-4.
 *
 * Removes: correctAnswer, distractorRationale, rubricIndicators,
 * constructSignals (internal), branchRationale.
 */
export function stripSensitiveFields(data: Record<string, unknown>): Record<string, unknown> {
  const SENSITIVE_KEYS = new Set([
    "correctAnswer",
    "distractorRationale",
    "rubricIndicators",
    "branchRationale",
    "rubricScore",
    "constructSignals",
    "scoringNotes",
    "positiveCriteria",
    "negativeCriteria",
  ]);

  const result: Record<string, unknown> = { ...data };

  for (const key of Object.keys(result)) {
    if (SENSITIVE_KEYS.has(key)) {
      delete result[key];
    } else if (typeof result[key] === "object" && result[key] !== null && !Array.isArray(result[key])) {
      result[key] = stripSensitiveFields(result[key] as Record<string, unknown>);
    }
  }

  return result;
}

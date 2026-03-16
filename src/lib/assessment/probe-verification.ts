/**
 * Probe verification — checks that Aria's response contains the required probe question.
 * PRD §3.2 Step 5.
 *
 * Uses case-insensitive substring matching with punctuation normalization.
 * If the probe is missing, the TurnBuilder retries at temperature 0.3,
 * then falls back to content library.
 */
import type { ProbeConfig } from "./content-types";

export interface ProbeCheckResult {
  /** Whether the probe (or an approved variant) was found. */
  found: boolean;
  /** Which probe text matched, or null if not found. */
  matchedVariant: string | null;
}

/**
 * Normalize text for probe matching — lowercase, strip punctuation.
 */
function normalize(text: string): string {
  return text.toLowerCase().replace(/[^\w\s]/g, "").replace(/\s+/g, " ").trim();
}

/**
 * Check if a response contains the primary probe or an approved variant.
 */
export function verifyProbePresent(
  response: string,
  probeConfig: ProbeConfig,
): ProbeCheckResult {
  const normalizedResponse = normalize(response);
  const allProbes = [probeConfig.primaryProbe, ...probeConfig.approvedVariants];

  for (const probe of allProbes) {
    const normalizedProbe = normalize(probe);
    if (normalizedProbe.length > 0 && normalizedResponse.includes(normalizedProbe)) {
      return { found: true, matchedVariant: probe };
    }
  }

  return { found: false, matchedVariant: null };
}

/**
 * Add a reinforcement instruction to the prompt for retry attempts.
 * Appended when the first Haiku call missed the probe.
 */
export function addProbeReinforcement(prompt: string, primaryProbe: string): string {
  return `${prompt}\n\nCRITICAL: You MUST end your response with this exact question: "${primaryProbe}"`;
}

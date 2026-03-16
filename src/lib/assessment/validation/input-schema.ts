/**
 * Input normalization and validation for candidate responses.
 * PRD §3.2, Pilot blocker P-9.
 *
 * - Empty/whitespace → [NO_RESPONSE] sentinel
 * - Strips control characters
 * - Caps at 3000 characters with truncation flag
 */

/** Maximum allowed input length. Inputs beyond this are truncated. */
const MAX_INPUT_LENGTH = 3000;

/** Known sentinel messages that bypass classification. */
export const SENTINEL_MESSAGES = new Set([
  "[NO_RESPONSE]",
  "[BEGIN_ASSESSMENT]",
  "[BEGIN_ACT_2]",
  "[BEGIN_ACT_3]",
]);

export interface NormalizedInput {
  /** The cleaned input text. */
  content: string;
  /** True if the input is a sentinel control message. */
  isSentinel: boolean;
  /** True if the input was truncated from its original length. */
  inputTruncated: boolean;
  /** Original length before truncation (only set if truncated). */
  originalLength?: number;
}

/**
 * Normalize candidate input for processing.
 *
 * 1. Trim whitespace
 * 2. Strip control characters (keep newlines and tabs)
 * 3. Empty → [NO_RESPONSE] sentinel
 * 4. Cap at MAX_INPUT_LENGTH with truncation flag
 */
export function normalizeInput(raw: string | null | undefined): NormalizedInput {
  if (raw == null) {
    return { content: "[NO_RESPONSE]", isSentinel: true, inputTruncated: false };
  }

  // Strip control characters except newline (\n), tab (\t), carriage return (\r)
  let cleaned = raw.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");

  // Trim
  cleaned = cleaned.trim();

  // Empty → sentinel
  if (cleaned.length === 0) {
    return { content: "[NO_RESPONSE]", isSentinel: true, inputTruncated: false };
  }

  // Check if it's a known sentinel
  if (SENTINEL_MESSAGES.has(cleaned)) {
    return { content: cleaned, isSentinel: true, inputTruncated: false };
  }

  // Truncate if too long
  if (cleaned.length > MAX_INPUT_LENGTH) {
    return {
      content: cleaned.slice(0, MAX_INPUT_LENGTH),
      isSentinel: false,
      inputTruncated: true,
      originalLength: cleaned.length,
    };
  }

  return { content: cleaned, isSentinel: false, inputTruncated: false };
}

/**
 * Check if a message content string is a sentinel control message.
 */
export function isSentinelMessage(content: string): boolean {
  return /^\[.+\]$/.test(content.trim()) || SENTINEL_MESSAGES.has(content.trim());
}

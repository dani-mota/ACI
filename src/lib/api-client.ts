/**
 * Resilient HTTP client with retry, exponential backoff, and 429 handling.
 *
 * Replaces bare fetch() calls across the codebase to provide consistent
 * error handling for external API calls (Anthropic, ElevenLabs, etc.).
 */

import { createLogger } from "@/lib/assessment/logger";

const log = createLogger("api-client");

export interface RetryConfig {
  /** Maximum number of retry attempts (default: 3) */
  maxRetries: number;
  /** Base delay in milliseconds for exponential backoff (default: 1000) */
  baseDelayMs: number;
  /** HTTP status codes that trigger a retry (default: [429, 502, 503, 504]) */
  retryableStatuses: number[];
}

const DEFAULT_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelayMs: 1000,
  retryableStatuses: [429, 502, 503, 504],
};

/**
 * Fetch with automatic retry on transient failures.
 *
 * - Exponential backoff: baseDelay × 2^attempt
 * - Honors Retry-After header on 429 responses
 * - Throws after all retries exhausted
 * - Respects caller's AbortSignal for timeout control
 */
export async function resilientFetch(
  url: string,
  init: RequestInit,
  config?: Partial<RetryConfig>,
): Promise<Response> {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  let lastError: Error | null = null;
  let lastResponse: Response | null = null;

  for (let attempt = 0; attempt <= cfg.maxRetries; attempt++) {
    try {
      const response = await fetch(url, init);

      if (response.ok) {
        return response;
      }

      // Non-retryable status — throw immediately
      if (!cfg.retryableStatuses.includes(response.status)) {
        throw new Error(`API returned ${response.status}: ${response.statusText}`);
      }

      lastResponse = response;

      // Last attempt — don't retry
      if (attempt === cfg.maxRetries) {
        throw new Error(`API returned ${response.status} after ${cfg.maxRetries + 1} attempts`);
      }

      // Calculate delay
      let delayMs = cfg.baseDelayMs * Math.pow(2, attempt);

      // Honor Retry-After header on 429
      if (response.status === 429) {
        const retryAfter = response.headers.get("retry-after");
        if (retryAfter) {
          const retryAfterMs = parseInt(retryAfter, 10) * 1000;
          if (!isNaN(retryAfterMs) && retryAfterMs > 0) {
            delayMs = Math.max(delayMs, retryAfterMs);
          }
        }
      }

      log.warn("Retrying request", {
        attempt: String(attempt + 1),
        maxRetries: String(cfg.maxRetries),
        status: String(response.status),
        delayMs: String(delayMs),
        url: url.replace(/key=.*/, "key=***"),
      });

      await sleep(delayMs);
    } catch (err) {
      // AbortError (timeout) — don't retry
      if (err instanceof DOMException && err.name === "AbortError") {
        throw err;
      }

      lastError = err instanceof Error ? err : new Error(String(err));

      if (attempt === cfg.maxRetries) {
        throw lastError;
      }

      const delayMs = cfg.baseDelayMs * Math.pow(2, attempt);
      log.warn("Retrying after error", {
        attempt: String(attempt + 1),
        error: lastError.message,
        delayMs: String(delayMs),
      });
      await sleep(delayMs);
    }
  }

  // Unreachable but TypeScript needs it
  throw lastError ?? new Error(`Request failed after ${cfg.maxRetries + 1} attempts`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

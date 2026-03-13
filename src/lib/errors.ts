/**
 * Client-side error mapping utility.
 *
 * Single source of truth for converting API/network errors into
 * user-friendly messages. Used by sendMessage and sendElementResponse
 * in the Zustand store.
 */

export function mapApiError(err: unknown): string {
  // Timeout (AbortSignal.timeout or manual AbortController)
  if (err instanceof DOMException && err.name === "AbortError") {
    return "The response timed out. Please try again.";
  }
  if (err instanceof DOMException && err.name === "TimeoutError") {
    return "The response timed out. Please try again.";
  }

  const raw = err instanceof Error ? err.message : String(err);

  // Guard: silent block from concurrent-send check
  if (raw === "SEND_BLOCKED_LOADING") return "";

  // HTTP status codes embedded in error messages
  if (raw.includes("500"))
    return "Something went wrong on our end. Please try again in a moment.";
  if (raw.includes("502"))
    return "The AI service is temporarily unavailable. Please try again.";
  if (raw.includes("429"))
    return "Too many requests. Please wait a moment and try again.";

  return "Something went wrong. Please try again.";
}

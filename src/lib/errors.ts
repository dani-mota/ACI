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

  // Fix: PRO-44 — Map all HTTP status codes to user-friendly messages
  if (raw.includes("401") || raw.includes("Unauthorized"))
    return "Your session has expired. Please refresh the page.";
  if (raw.includes("403") || raw.includes("Forbidden"))
    return "Your session has expired. Please refresh the page.";
  if (raw.includes("429"))
    return "Too many requests. Please wait a moment and try again.";
  if (raw.includes("500"))
    return "Something went wrong on our end. Please try again in a moment.";
  if (raw.includes("502") || raw.includes("503") || raw.includes("504"))
    return "The service is temporarily unavailable. Please try again.";

  // Catch-all: never expose raw technical messages to candidates
  return "Something went wrong. Please try again.";
}

/**
 * Simple in-memory sliding-window rate limiter for serverless routes.
 *
 * Uses a Map of IP → timestamps. Each check prunes stale entries and counts
 * hits within the window. Not suitable for multi-instance deployments without
 * a shared store (Redis), but sufficient for Vercel's single-region serverless.
 */

interface RateLimitEntry {
  timestamps: number[];
}

const store = new Map<string, RateLimitEntry>();

// Periodically prune stale entries to prevent unbounded memory growth
const PRUNE_INTERVAL_MS = 60_000;
let lastPrune = Date.now();

function pruneStaleEntries(windowMs: number) {
  const now = Date.now();
  if (now - lastPrune < PRUNE_INTERVAL_MS) return;
  lastPrune = now;

  const cutoff = now - windowMs;
  for (const [key, entry] of store) {
    entry.timestamps = entry.timestamps.filter((t) => t > cutoff);
    if (entry.timestamps.length === 0) store.delete(key);
  }
}

interface RateLimitConfig {
  /** Maximum number of requests allowed within the window */
  maxRequests: number;
  /** Window duration in milliseconds */
  windowMs: number;
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
}

/**
 * Check rate limit for a given identifier (typically IP or token).
 */
export function checkRateLimit(
  identifier: string,
  config: RateLimitConfig,
): RateLimitResult {
  const now = Date.now();
  const cutoff = now - config.windowMs;

  pruneStaleEntries(config.windowMs);

  let entry = store.get(identifier);
  if (!entry) {
    entry = { timestamps: [] };
    store.set(identifier, entry);
  }

  // Remove timestamps outside the window
  entry.timestamps = entry.timestamps.filter((t) => t > cutoff);

  if (entry.timestamps.length >= config.maxRequests) {
    const oldestInWindow = entry.timestamps[0];
    const retryAfterMs = oldestInWindow + config.windowMs - now;
    return {
      allowed: false,
      remaining: 0,
      retryAfterMs: Math.max(retryAfterMs, 0),
    };
  }

  entry.timestamps.push(now);
  return {
    allowed: true,
    remaining: config.maxRequests - entry.timestamps.length,
    retryAfterMs: 0,
  };
}

/**
 * Pre-configured rate limit configs for different route types.
 */
export const RATE_LIMITS = {
  /** Assessment chat: 30 requests per minute per token */
  assessmentChat: { maxRequests: 30, windowMs: 60_000 },
  /** Assessment completion: 5 per minute per token */
  assessmentComplete: { maxRequests: 5, windowMs: 60_000 },
  /** AI probe: 20 per minute per token */
  aiProbe: { maxRequests: 20, windowMs: 60_000 },
  /** Item response: 60 per minute per token */
  itemResponse: { maxRequests: 60, windowMs: 60_000 },
  /** TTS (ElevenLabs proxy): 60 per minute per token */
  tts: { maxRequests: 60, windowMs: 60_000 },
} as const;

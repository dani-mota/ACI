/**
 * Rate limiter with Redis-backed distributed enforcement (Upstash) and
 * in-memory fallback for local development or when Redis isn't configured.
 *
 * Redis mode: Effective across serverless isolates via Upstash sliding window.
 * In-memory mode: Per-isolate only — sufficient for dev/single-region.
 */

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// ── Types ──────────────────────────────────────────

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

// ── Redis rate limiter (if configured) ─────────────

let redisLimiters: Map<string, Ratelimit> | null = null;

const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

if (redisUrl && redisToken) {
  const redis = new Redis({ url: redisUrl, token: redisToken });
  redisLimiters = new Map();

  for (const [key, config] of Object.entries(RATE_LIMITS)) {
    const windowSecs = `${Math.ceil(config.windowMs / 1000)} s` as `${number} s`;
    redisLimiters.set(
      key,
      new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(config.maxRequests, windowSecs),
        prefix: `rl:${key}`,
      }),
    );
  }
}

// ── In-memory fallback ─────────────────────────────

interface RateLimitEntry {
  timestamps: number[];
}

const store = new Map<string, RateLimitEntry>();

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

function checkRateLimitInMemory(
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

// ── Public API ─────────────────────────────────────

/**
 * Check rate limit (synchronous — in-memory only).
 * Kept for backward compatibility with existing call sites.
 */
export function checkRateLimit(
  identifier: string,
  config: RateLimitConfig,
): RateLimitResult {
  return checkRateLimitInMemory(identifier, config);
}

/**
 * Async rate limit check — uses Redis when available, in-memory fallback.
 * Prefer this in new code for distributed rate limiting.
 */
export async function checkRateLimitAsync(
  identifier: string,
  config: RateLimitConfig,
  configKey?: string,
): Promise<RateLimitResult> {
  if (redisLimiters && configKey) {
    const limiter = redisLimiters.get(configKey);
    if (limiter) {
      try {
        const { success, remaining, reset } = await limiter.limit(identifier);
        return {
          allowed: success,
          remaining,
          retryAfterMs: success ? 0 : Math.max(reset - Date.now(), 0),
        };
      } catch {
        // Redis failure — fall through to in-memory
      }
    }
  }

  return checkRateLimitInMemory(identifier, config);
}

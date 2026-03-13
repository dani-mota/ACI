/**
 * Server-side environment validation.
 *
 * Validated once at import time — missing or malformed variables cause a clear
 * startup error instead of cryptic runtime crashes deep in business logic.
 *
 * NEXT_PUBLIC_* vars are left as process.env reads since Next.js inlines them
 * at build time. NODE_ENV checks are also left as-is (Next.js convention).
 */

import { z } from "zod";

const serverSchema = z.object({
  // ── Database ──────────────────────────────────────────
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  DIRECT_URL: z.string().optional(),

  // ── AI (Anthropic) ───────────────────────────────────
  ANTHROPIC_API_KEY: z.string().min(1, "ANTHROPIC_API_KEY is required"),

  // ── Supabase (server-side service role) ──────────────
  NEXT_PUBLIC_SUPABASE_URL: z.string().url("NEXT_PUBLIC_SUPABASE_URL must be a valid URL"),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, "SUPABASE_SERVICE_ROLE_KEY is required"),

  // ── App URL (required — no silent fallback to hardcoded URL) ──
  NEXT_PUBLIC_APP_URL: z.string().min(1, "NEXT_PUBLIC_APP_URL is required — no fallback"),

  // ── ElevenLabs TTS (optional — browser SpeechSynthesis fallback) ──
  ELEVENLABS_API_KEY: z.string().optional(),
  ELEVENLABS_VOICE_ID: z.string().optional(),

  // ── Email ─────────────────────────────────────────────
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default("ACI Assessments <assessments@arklight.io>"),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),

  // ── Cron / webhooks ──────────────────────────────────
  CRON_SECRET: z.string().optional(),
  SCORING_FAILURE_WEBHOOK_URL: z.string().url().optional(),

  // ── Admin / monitoring ────────────────────────────────
  HEALTH_SECRET: z.string().optional(),
  NEXT_PUBLIC_SENTRY_DSN: z.string().optional(),

  // ── Rate limiting (optional — falls back to in-memory) ──
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),

  // ── Feature flags ────────────────────────────────────
  ASSESSMENT_V2: z
    .string()
    .default("false")
    .transform((v) => v === "true"),
  ASSESSMENT_TEST_MODE: z
    .string()
    .default("false")
    .transform((v) => v === "true"),
  FEATURE_CONTENT_LIBRARY: z
    .string()
    .default("false")
    .transform((v) => v === "true"),
  FEATURE_CLASSIFICATION_FEW_SHOT: z
    .string()
    .default("true")
    .transform((v) => v !== "false"),
});

export type ServerEnv = z.infer<typeof serverSchema>;

function validateEnv(): ServerEnv {
  const result = serverSchema.safeParse(process.env);

  if (!result.success) {
    const formatted = result.error.issues
      .map((issue) => `  • ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");

    console.error(
      `\n❌ Environment validation failed:\n${formatted}\n\nCheck your .env file against .env.example.\n`,
    );
    throw new Error(`Environment validation failed: ${result.error.issues.length} issue(s)`);
  }

  return result.data;
}

export const env = validateEnv();

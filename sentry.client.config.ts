// Fix: PRO-73 — client-side Sentry initialization
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Client-side: sample 10% of transactions to control volume
  tracesSampleRate: 0.1,

  // Capture replays on every error for debugging
  replaysOnErrorSampleRate: 1.0,

  // Only send errors in production
  enabled: process.env.NODE_ENV === "production",
});

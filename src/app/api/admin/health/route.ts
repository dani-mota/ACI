import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withApiHandler } from "@/lib/api-handler";

/**
 * GET /api/admin/health
 * Health check: DB connectivity + env var presence.
 * Protected by HEALTH_SECRET bearer token — returns 404 if missing/wrong (stealth).
 */
export const GET = withApiHandler(async (req) => {
  // Bearer token check — return 404 (not 401) to avoid confirming route exists
  const healthSecret = process.env.HEALTH_SECRET;
  if (healthSecret) {
    const authHeader = req.headers.get("authorization");
    if (authHeader !== `Bearer ${healthSecret}`) {
      return new Response(null, { status: 404 });
    }
  }

  const checks: Record<string, { status: string; latencyMs?: number }> = {};
  let overallStatus = "ok";

  // Database connectivity
  try {
    const dbStart = Date.now();
    await prisma.$queryRawUnsafe("SELECT 1");
    checks.database = { status: "ok", latencyMs: Date.now() - dbStart };
  } catch {
    checks.database = { status: "error" };
    overallStatus = "degraded";
  }

  // Environment variables (presence only — never expose values)
  checks.anthropicKey = { status: process.env.ANTHROPIC_API_KEY ? "ok" : "missing" };
  checks.elevenLabsKey = { status: process.env.ELEVENLABS_API_KEY ? "ok" : "missing" };
  checks.sentryDsn = { status: process.env.NEXT_PUBLIC_SENTRY_DSN ? "ok" : "missing" };
  checks.databaseUrl = { status: process.env.DATABASE_URL ? "ok" : "missing" };

  if (!process.env.ANTHROPIC_API_KEY || !process.env.DATABASE_URL) {
    overallStatus = "degraded";
  }

  return NextResponse.json({
    status: overallStatus,
    timestamp: new Date().toISOString(),
    checks,
  });
}, { module: "health" });

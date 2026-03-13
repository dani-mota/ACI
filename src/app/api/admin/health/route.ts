import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

/**
 * GET /api/admin/health
 * Lightweight health check: DB connectivity + env var presence.
 * No auth required — used by uptime monitors.
 */
export async function GET() {
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

  // Environment variables
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
}

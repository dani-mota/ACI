import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { checkRateLimitAsync, RATE_LIMITS } from "@/lib/rate-limit";
// Session binding disabled — re-enable behind feature flag when architecture is stable
// import { validateAssessSession } from "@/lib/session/assess-session";

interface RouteParams {
  params: Promise<{ token: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const { token } = await params;

  // Rate limit by token
  // Fix: PRO-9 — use Redis-backed rate limiter
  const rl = await checkRateLimitAsync(`response:${token}`, RATE_LIMITS.itemResponse, "itemResponse");
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } },
    );
  }

  // Fix: PRO-25 — wrap all DB operations in try/catch to return JSON errors
  try {
    const body = await request.json();
    const { itemId, itemType, response, responseTimeMs, confidence, act } = body;

    if (!itemId || !response) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    // Validate itemId format (CUID-like: alphanumeric, reasonable length)
    if (typeof itemId !== "string" || itemId.length > 100 || !/^[\w-]+$/.test(itemId)) {
      return NextResponse.json({ error: "Invalid itemId" }, { status: 400 });
    }

    const invitation = await prisma.assessmentInvitation.findUnique({
      where: { linkToken: token },
    });

    if (!invitation || invitation.status === "EXPIRED" || invitation.status === "COMPLETED"
      || (invitation.expiresAt && new Date() > invitation.expiresAt)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Session binding disabled for pre-pilot — token auth only

    const assessment = await prisma.assessment.findFirst({
      where: { candidateId: invitation.candidateId },
      orderBy: { startedAt: "desc" },
    });

    if (!assessment) {
      return NextResponse.json({ error: "Assessment not found" }, { status: 404 });
    }

    // Completion guard
    if (assessment.completedAt) {
      return NextResponse.json({ error: "Assessment already completed" }, { status: 400 });
    }

    // Fix: PRO-76 — first-submission lock: reject answer overwrites after 10s window
    const existingResponse = await prisma.itemResponse.findUnique({
      where: {
        assessmentId_itemId: {
          assessmentId: assessment.id,
          itemId,
        },
      },
      select: { createdAt: true },
    });

    if (existingResponse) {
      const ageMs = Date.now() - existingResponse.createdAt.getTime();
      if (ageMs > 10_000) {
        return NextResponse.json({ error: "Already submitted" }, { status: 409 });
      }
    }

    // Upsert the response (idempotent within retry window)
    const itemResponse = await prisma.itemResponse.upsert({
      where: {
        assessmentId_itemId: {
          assessmentId: assessment.id,
          itemId,
        },
      },
      create: {
        assessmentId: assessment.id,
        itemId,
        itemType: itemType || "MULTIPLE_CHOICE",
        response,
        responseTimeMs: responseTimeMs || null,
        confidence: confidence || null,
        act: act || null,
      },
      update: {
        response,
        responseTimeMs: responseTimeMs || null,
        confidence: confidence || null,
        act: act || null,
      },
    });

    return NextResponse.json({ id: itemResponse.id });
  } catch (err) {
    console.error("[response-route] Error:", err);
    return NextResponse.json({ error: "Failed to save response" }, { status: 500 });
  }
}

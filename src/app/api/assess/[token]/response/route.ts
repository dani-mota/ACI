import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { checkRateLimitAsync, RATE_LIMITS } from "@/lib/rate-limit";
import { validateAssessSession } from "@/lib/session/assess-session";
import { env } from "@/lib/env";
import { withApiHandler } from "@/lib/api-handler";

export const POST = withApiHandler(
  async (req, ctx) => {
    const { token } = await ctx.params;

    // Rate limit by token
    // Fix: PRO-9 — use Redis-backed rate limiter
    const rl = await checkRateLimitAsync(`response:${token}`, RATE_LIMITS.itemResponse, "itemResponse");
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Too many requests" },
        { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } },
      );
    }

    const body = await req.json();
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

    // Session binding — validate if enabled
    if (env.ENABLE_SESSION_BINDING) {
      const session = validateAssessSession(invitation, req);
      if (!session.valid) {
        return NextResponse.json({ error: "session_invalid" }, { status: 401 });
      }
    }

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

    // PRO-114: Compute server-side response time from questionDeliveredAt
    let serverSideResponseTimeMs: number | null = null;
    const linkedMessage = await prisma.conversationMessage.findFirst({
      where: {
        assessmentId: assessment.id,
        elementType: { not: null },
        questionDeliveredAt: { not: null },
      },
      orderBy: { sequenceOrder: "desc" },
      select: { questionDeliveredAt: true },
    });
    if (linkedMessage?.questionDeliveredAt) {
      serverSideResponseTimeMs = Math.round(Date.now() - linkedMessage.questionDeliveredAt.getTime());
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
        clientResponseTimeMs: responseTimeMs || null,
        serverSideResponseTimeMs,
        confidence: confidence || null,
        act: act || null,
      },
      update: {
        response,
        clientResponseTimeMs: responseTimeMs || null,
        serverSideResponseTimeMs,
        confidence: confidence || null,
        act: act || null,
      },
    });

    return NextResponse.json({ id: itemResponse.id });
  },
  { module: "assess/[token]/response" },
);

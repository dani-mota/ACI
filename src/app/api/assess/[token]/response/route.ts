import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";

interface RouteParams {
  params: Promise<{ token: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const { token } = await params;

  // Rate limit by token
  const rl = checkRateLimit(`response:${token}`, RATE_LIMITS.itemResponse);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } },
    );
  }

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

  // Upsert the response (idempotent)
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
}

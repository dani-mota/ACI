import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { checkRateLimitAsync } from "@/lib/rate-limit";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  // Rate limit: 5/min per token
  // Fix: PRO-9 — use Redis-backed rate limiter
  const rl = await checkRateLimitAsync(`survey:${token}`, { maxRequests: 5, windowMs: 60_000 }, "assessmentComplete");
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }
  // Fix: PRO-25 — wrap all DB operations in try/catch to return JSON errors
  try {
    const body = await request.json();
    const { assessmentId, difficulty, fairness, faceValidity, openFeedback } = body;

    // Fix: PRO-79 — validate Likert fields
    for (const field of [difficulty, fairness, faceValidity]) {
      if (typeof field !== "number" || field < 1 || field > 5 || !Number.isInteger(field)) {
        return NextResponse.json({ error: "Likert values must be integers 1-5" }, { status: 400 });
      }
    }
    if (typeof openFeedback === "string" && openFeedback.length > 2000) {
      return NextResponse.json({ error: "Feedback too long" }, { status: 400 });
    }

    // Validate token matches assessment via candidate
    const invitation = await prisma.assessmentInvitation.findFirst({
      where: { linkToken: token },
      include: {
        candidate: {
          include: { assessment: true },
        },
      },
    });

    if (
      !invitation ||
      !invitation.candidate.assessment ||
      invitation.candidate.assessment.id !== assessmentId
    ) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    // Check for existing survey
    const existing = await prisma.postAssessmentSurvey.findUnique({
      where: { assessmentId },
    });

    if (existing) {
      return NextResponse.json({ error: "Survey already submitted" }, { status: 409 });
    }

    await prisma.postAssessmentSurvey.create({
      data: {
        assessmentId,
        difficulty,
        fairness,
        faceValidity,
        openFeedback,
      },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[survey-route] Error:", err);
    return NextResponse.json({ error: "Failed to save survey" }, { status: 500 });
  }
}

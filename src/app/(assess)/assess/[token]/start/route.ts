import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { env } from "@/lib/env";
import { bindAssessSession } from "@/lib/session/assess-session";
import { createLogger } from "@/lib/assessment/logger";

interface RouteParams {
  params: Promise<{ token: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const log = createLogger("assessment/start");
  const { token } = await params;

  // Log IP + User-Agent for audit trail (regardless of session binding flag)
  log.info("Assessment start request", {
    ip: request.headers.get("x-forwarded-for") ?? request.headers.get("x-real-ip") ?? "unknown",
    userAgent: request.headers.get("user-agent") ?? "unknown",
    token: token.slice(0, 8) + "...",
  });

  const invitation = await prisma.assessmentInvitation.findUnique({
    where: { linkToken: token },
    include: { candidate: true },
  });

  if (!invitation) {
    return NextResponse.json({ error: "Invalid token" }, { status: 404 });
  }

  if (invitation.status === "EXPIRED" || new Date() > invitation.expiresAt) {
    return NextResponse.json({ error: "Invitation expired" }, { status: 410 });
  }

  if (invitation.status === "COMPLETED") {
    return NextResponse.json({ error: "Assessment already completed" }, { status: 400 });
  }

  try {
    // Create assessment idempotently — handles concurrent requests (PRO-121)
    const result = await prisma.$transaction(async (tx) => {
      // Re-check inside transaction to close the TOCTOU gap
      const existing = await tx.assessment.findUnique({
        where: { candidateId: invitation.candidateId },
      });

      if (existing) {
        return { assessment: existing, created: false };
      }

      const assessment = await tx.assessment.create({
        data: {
          candidateId: invitation.candidateId,
          startedAt: new Date(),
        },
      });

      await tx.assessmentInvitation.update({
        where: { id: invitation.id },
        data: { status: "STARTED" },
      });

      await tx.candidate.update({
        where: { id: invitation.candidateId },
        data: { status: "INCOMPLETE" },
      });

      return { assessment, created: true };
    });

    if (!result.created && result.assessment.completedAt) {
      return NextResponse.json({ error: "Assessment already completed" }, { status: 400 });
    }

    // Bind session after successful assessment creation
    if (env.ENABLE_SESSION_BINDING && result.created) {
      const { setCookieHeader } = await bindAssessSession(invitation.id);
      return NextResponse.json(
        { assessmentId: result.assessment.id },
        { headers: { "Set-Cookie": setCookieHeader } },
      );
    }

    return NextResponse.json({ assessmentId: result.assessment.id });
  } catch (err) {
    // P2002 = unique constraint violation — another concurrent request created the record first
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      const existing = await prisma.assessment.findUnique({
        where: { candidateId: invitation.candidateId },
      });
      if (existing) {
        return NextResponse.json({ assessmentId: existing.id });
      }
    }

    log.error("Assessment start failed", { error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json(
      { error: "Failed to start assessment. Please try again." },
      { status: 500 },
    );
  }
}

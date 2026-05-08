import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { canConvertCandidate } from "@/lib/rbac";
import { withApiHandler } from "@/lib/api-handler";

export const POST = withApiHandler(
  async (req, ctx) => {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    // PRO-133: session-based check covers both Candidate Mode (TA_LEADER /
    // RECRUITING_MANAGER / ADMIN) and Employee Mode (PEOPLE_MANAGER /
    // HR_TALENT_LEADER) authorities additively.
    if (!canConvertCandidate(session)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const params = await ctx.params;
    const assessmentId = params.id;
    if (!assessmentId) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }
    const body = await req.json();
    const department = typeof body.department === "string" ? body.department.trim() : "";
    const roleFamily = typeof body.roleFamily === "string" ? body.roleFamily.trim() : "";

    if (!department || !roleFamily) {
      return NextResponse.json(
        { error: "department and roleFamily are required" },
        { status: 400 },
      );
    }

    const now = new Date();

    const result = await prisma.$transaction(async (tx) => {
      // Atomic guard: only convert if still in CANDIDATE mode and in this org.
      // No TOCTOU race — the WHERE clause is the guard.
      const update = await tx.assessment.updateMany({
        where: {
          id: assessmentId,
          assessmentMode: "CANDIDATE",
          candidate: { orgId: session.user.orgId },
        },
        data: {
          assessmentMode: "EMPLOYEE",
          department,
          roleFamily,
          convertedAt: now,
          convertedBy: session.user.id,
          employeeStatus: "ACTIVE",
        },
      });

      if (update.count === 0) {
        // Either the assessment doesn't exist, isn't in this org, or is already converted.
        return { converted: false as const };
      }

      // Look up the candidateId so we can update the linked candidate by its unique id.
      const assessment = await tx.assessment.findUnique({
        where: { id: assessmentId },
        select: { candidateId: true },
      });

      if (!assessment) {
        // Should not happen given the updateMany succeeded, but guard for safety.
        throw new Error("Assessment vanished mid-transaction");
      }

      await tx.candidate.update({
        where: { id: assessment.candidateId },
        data: { status: "HIRED" },
      });

      // Soft-archive evaluative outputs. updateMany is no-op-safe when zero rows match.
      await tx.redFlag.updateMany({
        where: { assessmentId },
        data: { archivedAt: now },
      });

      await tx.prediction.updateMany({
        where: { assessmentId },
        data: { archivedAt: now },
      });

      return { converted: true as const };
    });

    if (!result.converted) {
      return NextResponse.json(
        { error: "Assessment not found or already converted" },
        { status: 409 },
      );
    }

    return NextResponse.json({ ok: true });
  },
  { module: "assessments/convert" },
);

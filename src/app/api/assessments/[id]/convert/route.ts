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
    // PRO-133 PR#2: optional managerId. When provided AND a User is
    // lazy-linked to the converted Candidate (by email match), set the
    // linked User's managerId so PEOPLE_MANAGER scoping works for this
    // employee. If no User linkage happens, managerId is silently dropped
    // (no User to set it on; not an error).
    const managerId = typeof body.managerId === "string" && body.managerId.trim().length > 0
      ? body.managerId.trim()
      : null;

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
        return { converted: false as const, linkedUserId: null as string | null };
      }

      // Look up the candidateId so we can update the linked candidate by its unique id.
      const assessment = await tx.assessment.findUnique({
        where: { id: assessmentId },
        select: { candidateId: true, candidate: { select: { email: true } } },
      });

      if (!assessment || !assessment.candidate) {
        // Should not happen given the updateMany succeeded, but guard for safety.
        throw new Error("Assessment vanished mid-transaction");
      }

      await tx.candidate.update({
        where: { id: assessment.candidateId },
        data: { status: "HIRED" },
      });

      // PRO-133 PR#2: lazy email-match. If a User exists with this
      // Candidate's email + same orgId, link them. User.email is globally
      // unique (schema.prisma:33) but `findFirst` with explicit orgId
      // filter is defensive against future schema changes.
      // External hires without a prior User account get null — PRO-182
      // (auto-create-User on convert) closes that gap.
      const linkedUser = await tx.user.findFirst({
        where: { email: assessment.candidate.email, orgId: session.user.orgId },
        select: { id: true },
      });
      let linkedUserId: string | null = null;
      if (linkedUser) {
        await tx.candidate.update({
          where: { id: assessment.candidateId },
          data: { userId: linkedUser.id },
        });
        await tx.user.update({
          where: { id: linkedUser.id },
          data: {
            employeeRole: "EMPLOYEE",
            ...(managerId ? { managerId } : {}),
          },
        });
        linkedUserId = linkedUser.id;
      }

      // Soft-archive evaluative outputs. updateMany is no-op-safe when zero rows match.
      await tx.redFlag.updateMany({
        where: { assessmentId },
        data: { archivedAt: now },
      });

      await tx.prediction.updateMany({
        where: { assessmentId },
        data: { archivedAt: now },
      });

      return { converted: true as const, linkedUserId };
    });

    if (!result.converted) {
      return NextResponse.json(
        { error: "Assessment not found or already converted" },
        { status: 409 },
      );
    }

    return NextResponse.json({ ok: true, linkedUserId: result.linkedUserId });
  },
  { module: "assessments/convert" },
);

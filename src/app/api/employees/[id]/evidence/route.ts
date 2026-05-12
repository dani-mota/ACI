/**
 * PRO-132: Page-level Evidence Layer fetch.
 *
 * GET /api/employees/[id]/evidence
 *
 * Returns the full 12-construct evidence map for an employee. Used by the
 * client component to decide which constructs need lazy generation on
 * accordion expand.
 *
 * Page server-component already calls getEvidenceLayerData directly, but
 * this GET endpoint is here so the client can re-fetch after mutations
 * (e.g., after a per-construct POST returns) without a full page reload.
 *
 * PRO-133: canAccessMode now takes session and checks both role +
 * employeeRole additively. Per-target capability is gated via
 * `getEmployeeDataVisibility("evidence", ctx)` after fetching the
 * Candidate's user linkage — EMPLOYEE sees self only, PEOPLE_MANAGER
 * sees direct reports only, HR/TA/ADMIN see org-wide.
 */

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { canAccessMode } from "@/lib/rbac";
import { getEmployeeDataVisibility } from "@/lib/employee-permissions";
import { withApiHandler } from "@/lib/api-handler";
import { getEvidenceLayerData } from "@/lib/data";
import { CURRENT_PROMPT_VERSION } from "@/lib/assessment/prompts/evidence-annotation";

export const GET = withApiHandler(
  async (_req, ctx) => {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!canAccessMode(session, "employees")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const params = await ctx.params;
    const candidateId = params.id;
    if (!candidateId) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }

    // PR#2: fetch user-linkage context for the visibility gate.
    const candidate = await prisma.candidate.findFirst({
      where: {
        id: candidateId,
        orgId: session.user.orgId,
        assessment: { assessmentMode: "EMPLOYEE" },
      },
      select: {
        assessment: { select: { id: true } },
        userId: true,
        user: { select: { managerId: true } },
      },
    });
    if (!candidate?.assessment) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Per-target capability gate. "none" means the requester has no
    // applicable visibility for this employee (not self, not their report,
    // not an org-wide reader).
    const visibility = getEmployeeDataVisibility("evidence", {
      session,
      targetEmployeeUserId: candidate.userId,
      targetEmployeeManagerId: candidate.user?.managerId ?? null,
    });
    if (visibility === "none") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const entries = await getEvidenceLayerData(
      candidate.assessment.id,
      CURRENT_PROMPT_VERSION,
    );
    return NextResponse.json({ entries });
  },
  { module: "employees/evidence/list" },
);

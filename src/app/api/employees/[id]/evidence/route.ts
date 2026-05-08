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
 * employeeRole additively. PEOPLE_MANAGER and HR_TALENT_LEADER access
 * to this endpoint is governed by canViewAnyEmployee — see commit 3.
 */

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { canAccessMode } from "@/lib/rbac";
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

    const candidate = await prisma.candidate.findFirst({
      where: {
        id: candidateId,
        orgId: session.user.orgId,
        assessment: { assessmentMode: "EMPLOYEE" },
      },
      select: { assessment: { select: { id: true } } },
    });
    if (!candidate?.assessment) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const entries = await getEvidenceLayerData(
      candidate.assessment.id,
      CURRENT_PROMPT_VERSION,
    );
    return NextResponse.json({ entries });
  },
  { module: "employees/evidence/list" },
);

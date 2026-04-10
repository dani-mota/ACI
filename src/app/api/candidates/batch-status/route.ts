import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { canView, isExternalCollaborator } from "@/lib/rbac";
import { withApiHandler } from "@/lib/api-handler";

const VALID_STATUSES = ["RECOMMENDED", "REVIEW_REQUIRED", "DO_NOT_ADVANCE", "INCOMPLETE", "SCORING"];

export const PATCH = withApiHandler(
  async (req) => {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (isExternalCollaborator(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (!canView(session.user.role, "bulkActions")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { candidateIds, status } = body;

    if (!Array.isArray(candidateIds) || candidateIds.length === 0) {
      return NextResponse.json({ error: "candidateIds array is required" }, { status: 400 });
    }

    if (!VALID_STATUSES.includes(status)) {
      return NextResponse.json({ error: `Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}` }, { status: 400 });
    }

    const result = await prisma.candidate.updateMany({
      where: { id: { in: candidateIds }, orgId: session.user.orgId },
      data: { status },
    });

    return NextResponse.json({ updated: result.count });
  },
  { module: "candidates/batch-status" }
);

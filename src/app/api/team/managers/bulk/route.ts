import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { canManageTeam, ROLE_LEVEL } from "@/lib/rbac";
import type { AppUserRole } from "@/lib/rbac";
import { withApiHandler } from "@/lib/api-handler";

// PRO-184: atomic bulk manager reassignment. AC requires "single
// operation" — interpreted as one transaction. If any single assignment
// fails validation (cross-org, self-as-manager, inactive, EXTERNAL_
// COLLABORATOR), the whole transaction rolls back including any audit
// log rows already inserted. Audit log inserts live INSIDE the
// transaction so log truth-tracks actual state.
//
// All N audit rows share a `bulkOperationId` UUID so the operation can
// be reconstructed by a future query. The single-user PATCH at
// /api/team/[userId] sets bulkOperationId to null, distinguishing it.
export const PATCH = withApiHandler(
  async (req: NextRequest) => {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!canManageTeam(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { assignments } = body as {
      assignments?: Array<{ userId: string; managerId: string | null }>;
    };

    if (!Array.isArray(assignments) || assignments.length === 0) {
      return NextResponse.json(
        { error: "assignments must be a non-empty array" },
        { status: 400 }
      );
    }

    // Resolve target users + propose-manager records up front so all
    // validation happens before any write. Single round-trip per group.
    const targetIds = Array.from(new Set(assignments.map((a) => a.userId)));
    const managerIds = Array.from(
      new Set(
        assignments
          .map((a) => a.managerId)
          .filter((id): id is string => typeof id === "string" && id.length > 0)
      )
    );

    const [targetUsers, proposedManagers] = await Promise.all([
      prisma.user.findMany({
        where: { id: { in: targetIds } },
        select: { id: true, orgId: true, role: true, managerId: true, email: true },
      }),
      managerIds.length > 0
        ? prisma.user.findMany({
            where: { id: { in: managerIds } },
            select: { id: true, orgId: true, isActive: true, role: true },
          })
        : Promise.resolve([] as Array<{ id: string; orgId: string; isActive: boolean; role: string }>),
    ]);

    const targetMap = new Map(targetUsers.map((u) => [u.id, u]));
    const managerMap = new Map(proposedManagers.map((u) => [u.id, u]));

    // Pre-flight validation. Reject the entire batch on the first failure;
    // partial-success would make the audit trail confusing.
    for (const assignment of assignments) {
      const target = targetMap.get(assignment.userId);
      if (!target || target.orgId !== session.user.orgId) {
        return NextResponse.json(
          { error: `User not found: ${assignment.userId}` },
          { status: 404 }
        );
      }
      if (target.id === session.user.id) {
        return NextResponse.json(
          { error: "You cannot modify your own account" },
          { status: 403 }
        );
      }
      if (target.role === "ADMIN") {
        return NextResponse.json(
          { error: "Cannot modify platform admin users" },
          { status: 403 }
        );
      }
      if (ROLE_LEVEL[session.user.role] <= ROLE_LEVEL[target.role as AppUserRole]) {
        return NextResponse.json(
          { error: `Cannot modify ${target.email}: at or above your role level` },
          { status: 403 }
        );
      }
      if (assignment.managerId !== null) {
        if (assignment.managerId === target.id) {
          return NextResponse.json(
            { error: `User ${target.email} cannot be their own manager` },
            { status: 400 }
          );
        }
        const proposed = managerMap.get(assignment.managerId);
        if (!proposed || proposed.orgId !== session.user.orgId) {
          return NextResponse.json(
            { error: `Proposed manager not found in this organization: ${assignment.managerId}` },
            { status: 400 }
          );
        }
        if (!proposed.isActive) {
          return NextResponse.json(
            { error: "Proposed manager is inactive" },
            { status: 400 }
          );
        }
        if (proposed.role === "EXTERNAL_COLLABORATOR") {
          return NextResponse.json(
            { error: "External collaborators cannot be assigned as managers" },
            { status: 400 }
          );
        }
      }
    }

    const bulkOperationId = crypto.randomUUID();

    // Single atomic transaction. Each user.update + activityLog.create
    // is inside the same tx callback — if any update fails, all log rows
    // roll back too, so the audit trail truth-tracks actual state.
    await prisma.$transaction(async (tx) => {
      for (const assignment of assignments) {
        const target = targetMap.get(assignment.userId)!;
        await tx.user.update({
          where: { id: assignment.userId },
          data: { managerId: assignment.managerId },
        });
        await tx.activityLog.create({
          data: {
            entityType: "User",
            entityId: assignment.userId,
            action: "MANAGER_CHANGED",
            actorId: session.user.id,
            metadata: {
              targetEmail: target.email,
              orgId: session.user.orgId,
              oldManagerId: target.managerId,
              newManagerId: assignment.managerId,
              bulkOperationId,
            },
          },
        });
      }
    });

    return NextResponse.json({
      bulkOperationId,
      updated: assignments.length,
    });
  },
  { module: "team" }
);

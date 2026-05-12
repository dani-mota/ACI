import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { canManageTeam, canAssignRole, ROLE_LEVEL } from "@/lib/rbac";
import type { AppUserRole } from "@/lib/rbac";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { withApiHandler } from "@/lib/api-handler";

export const PATCH = withApiHandler(
  async (req: NextRequest, ctx) => {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!canManageTeam(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { userId } = await ctx.params;
    const body = await req.json();
    // PRO-184: extends existing role/active PATCH with optional managerId.
    // `managerId === undefined` means "not in body, don't change";
    // `managerId === null` means "explicitly unassign manager"; a string
    // means "set to this user". Three-state distinction is load-bearing —
    // conflating undefined and null would null the manager on any PATCH
    // that didn't include it.
    const { role, active, managerId } = body as {
      role?: string;
      active?: boolean;
      managerId?: string | null;
    };

    // Find the target user
    const targetUser = await prisma.user.findUnique({ where: { id: userId } });
    if (!targetUser || targetUser.orgId !== session.user.orgId) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Prevent self-modification
    if (targetUser.id === session.user.id) {
      return NextResponse.json(
        { error: "You cannot modify your own account" },
        { status: 403 }
      );
    }

    // Prevent modifying ADMIN users
    if (targetUser.role === "ADMIN") {
      return NextResponse.json({ error: "Cannot modify platform admin users" }, { status: 403 });
    }

    const updates: Record<string, unknown> = {};
    const logActions: string[] = [];

    // Prevent modifying users at or above your role level
    if (ROLE_LEVEL[session.user.role] <= ROLE_LEVEL[targetUser.role as AppUserRole]) {
      return NextResponse.json(
        { error: "You cannot modify a user at or above your role level" },
        { status: 403 }
      );
    }

    // Handle role change
    if (role !== undefined) {
      if (!canAssignRole(session.user.role, role as AppUserRole)) {
        return NextResponse.json({ error: "You cannot assign this role" }, { status: 403 });
      }

      // Prevent demoting the last TA_LEADER
      if (targetUser.role === "TA_LEADER" && role !== "TA_LEADER") {
        const activeLeaderCount = await prisma.user.count({
          where: {
            orgId: session.user.orgId,
            role: "TA_LEADER",
            isActive: true,
            id: { not: targetUser.id },
          },
        });
        if (activeLeaderCount === 0) {
          return NextResponse.json(
            { error: "Cannot demote the last active TA Leader in this organization" },
            { status: 409 }
          );
        }
      }

      updates.role = role;
      logActions.push(`ROLE_CHANGED:${targetUser.role}->${role}`);
    }

    // Handle activation/deactivation
    if (active !== undefined) {
      if (!active) {
        // Deactivation — check we don't leave org with zero TA_LEADERs
        if (targetUser.role === "TA_LEADER") {
          const activeLeaderCount = await prisma.user.count({
            where: {
              orgId: session.user.orgId,
              role: "TA_LEADER",
              isActive: true,
              id: { not: targetUser.id },
            },
          });
          if (activeLeaderCount === 0) {
            return NextResponse.json(
              { error: "Cannot deactivate the last active TA Leader in this organization" },
              { status: 409 }
            );
          }
        }

        // Ban in Supabase — must succeed before updating Prisma
        if (targetUser.supabaseId) {
          const { error: banError } = await getSupabaseAdmin().auth.admin.updateUserById(
            targetUser.supabaseId,
            { ban_duration: "876000h" }
          );
          if (banError) {
            return NextResponse.json(
              { error: "Failed to update user access. Please try again." },
              { status: 500 }
            );
          }
        }
        updates.isActive = false;
        logActions.push("USER_DEACTIVATED");
      } else {
        // Reactivation — unban in Supabase — must succeed before updating Prisma
        if (targetUser.supabaseId) {
          const { error: unbanError } = await getSupabaseAdmin().auth.admin.updateUserById(
            targetUser.supabaseId,
            { ban_duration: "none" }
          );
          if (unbanError) {
            return NextResponse.json(
              { error: "Failed to update user access. Please try again." },
              { status: 500 }
            );
          }
        }
        updates.isActive = true;
        logActions.push("USER_REACTIVATED");
      }
    }

    // PRO-184: managerId change. Has its own guards — see the existing
    // guards above (self-mod, ADMIN target, ROLE_LEVEL hierarchy) which
    // already apply to any team-management mutation. The additive guards
    // here cover managerId-specific failure modes.
    let oldManagerId: string | null = null;
    if (managerId !== undefined) {
      oldManagerId = targetUser.managerId;

      if (managerId === null) {
        // Explicit unassign — valid, no further validation needed.
        updates.managerId = null;
        logActions.push("MANAGER_CHANGED");
      } else if (typeof managerId === "string" && managerId.length > 0) {
        if (managerId === targetUser.id) {
          return NextResponse.json(
            { error: "A user cannot be their own manager" },
            { status: 400 }
          );
        }
        const proposedManager = await prisma.user.findUnique({
          where: { id: managerId },
          select: { id: true, orgId: true, isActive: true, role: true },
        });
        if (!proposedManager || proposedManager.orgId !== session.user.orgId) {
          return NextResponse.json(
            { error: "Proposed manager not found in this organization" },
            { status: 400 }
          );
        }
        if (!proposedManager.isActive) {
          return NextResponse.json(
            { error: "Proposed manager is inactive" },
            { status: 400 }
          );
        }
        if (proposedManager.role === "EXTERNAL_COLLABORATOR") {
          return NextResponse.json(
            { error: "External collaborators cannot be assigned as managers" },
            { status: 400 }
          );
        }
        updates.managerId = managerId;
        logActions.push("MANAGER_CHANGED");
      } else {
        return NextResponse.json(
          { error: "Invalid managerId value" },
          { status: 400 }
        );
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No changes specified" }, { status: 400 });
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updates,
      select: { id: true, name: true, email: true, role: true, isActive: true },
    });

    // Log the action(s)
    for (const action of logActions) {
      // PRO-184: MANAGER_CHANGED carries before/after managerId + null
      // bulkOperationId to distinguish from bulk operations (which set
      // a non-null bulkOperationId in their own audit rows).
      const metadata =
        action === "MANAGER_CHANGED"
          ? {
              targetEmail: targetUser.email,
              orgId: session.user.orgId,
              oldManagerId,
              newManagerId: (updates.managerId as string | null | undefined) ?? null,
              bulkOperationId: null,
            }
          : { targetEmail: targetUser.email, orgId: session.user.orgId };
      await prisma.activityLog.create({
        data: {
          entityType: "User",
          entityId: userId,
          action,
          actorId: session.user.id,
          metadata,
        },
      });
    }

    return NextResponse.json({ user: updatedUser });
  },
  { module: "team" }
);

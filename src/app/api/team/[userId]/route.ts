import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { canManageTeam, canAssignRole, ROLE_LEVEL } from "@/lib/rbac";
import type { AppUserRole } from "@/lib/rbac";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageTeam(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { userId } = await params;
  const body = await request.json();
  const { role, active } = body as { role?: string; active?: boolean };

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
          console.error("Failed to ban Supabase user:", banError);
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
          console.error("Failed to unban Supabase user:", unbanError);
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
    await prisma.activityLog.create({
      data: {
        entityType: "User",
        entityId: userId,
        action,
        actorId: session.user.id,
        metadata: { targetEmail: targetUser.email, orgId: session.user.orgId },
      },
    });
  }

  return NextResponse.json({ user: updatedUser });
}

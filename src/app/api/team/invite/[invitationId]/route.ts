import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { canManageTeam, canAssignRole } from "@/lib/rbac";
import type { AppUserRole } from "@/lib/rbac";
import { checkRateLimit } from "@/lib/rate-limit";
import { sendEmail } from "@/lib/email/resend";
import { buildTeamInviteEmail } from "@/lib/email/templates/team-invite";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://aci-rho.vercel.app";

/**
 * DELETE /api/team/invite/[invitationId] — Revoke invitation
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ invitationId: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageTeam(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { invitationId } = await params;

  const invitation = await prisma.teamInvitation.findUnique({
    where: { id: invitationId },
  });
  if (!invitation || invitation.orgId !== session.user.orgId) {
    return NextResponse.json({ error: "Invitation not found" }, { status: 404 });
  }
  if (invitation.status !== "PENDING") {
    return NextResponse.json({ error: "Invitation is not pending" }, { status: 409 });
  }

  await prisma.teamInvitation.update({
    where: { id: invitationId },
    data: { status: "REVOKED" },
  });

  await prisma.activityLog.create({
    data: {
      entityType: "TeamInvitation",
      entityId: invitationId,
      action: "TEAM_INVITE_REVOKED",
      actorId: session.user.id,
      metadata: { email: invitation.email, orgId: session.user.orgId },
    },
  });

  return NextResponse.json({ success: true });
}

/**
 * POST /api/team/invite/[invitationId] — Resend invitation
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ invitationId: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageTeam(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Rate limit resends: 5 per hour per user
  const resendLimit = checkRateLimit(`team-resend:${session.user.id}`, { maxRequests: 5, windowMs: 3_600_000 });
  if (!resendLimit.allowed) {
    return NextResponse.json({ error: "Rate limit exceeded. Please try again later." }, { status: 429 });
  }

  const { invitationId } = await params;

  const invitation = await prisma.teamInvitation.findUnique({
    where: { id: invitationId },
    include: { org: { select: { slug: true, name: true } } },
  });
  if (!invitation || invitation.orgId !== session.user.orgId) {
    return NextResponse.json({ error: "Invitation not found" }, { status: 404 });
  }

  let activeInvitation = invitation;

  // Re-validate role assignment for the current user
  if (!canAssignRole(session.user.role, invitation.role as AppUserRole)) {
    return NextResponse.json({ error: "You cannot assign this role" }, { status: 403 });
  }

  // If expired or not pending, revoke old and create new
  if (invitation.status !== "PENDING" || invitation.expiresAt <= new Date()) {
    if (invitation.status === "PENDING") {
      await prisma.teamInvitation.update({
        where: { id: invitationId },
        data: { status: "REVOKED" },
      });
    }

    const newInvitation = await prisma.teamInvitation.create({
      data: {
        orgId: session.user.orgId,
        email: invitation.email,
        name: invitation.name,
        role: invitation.role,
        invitedBy: session.user.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
      include: { org: { select: { slug: true, name: true } } },
    });

    activeInvitation = newInvitation;
  }

  // Send the email
  const acceptUrl = `${APP_URL}/join/${activeInvitation.org.slug}/accept?token=${activeInvitation.token}`;
  try {
    const { subject, html } = buildTeamInviteEmail({
      inviterName: session.user.name,
      inviterEmail: session.user.email,
      inviterRole: session.user.role,
      orgName: activeInvitation.org.name,
      role: activeInvitation.role,
      acceptUrl,
      expiresAt: activeInvitation.expiresAt,
    });
    await sendEmail({ to: activeInvitation.email, subject, html });
  } catch (emailErr) {
    console.error("Failed to resend team invite email:", emailErr);
    return NextResponse.json({ error: "Failed to send email" }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    invitation: {
      id: activeInvitation.id,
      email: activeInvitation.email,
      expiresAt: activeInvitation.expiresAt,
    },
  });
}

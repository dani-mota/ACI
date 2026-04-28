import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { canManageTeam, canAssignRole } from "@/lib/rbac";
import type { AppUserRole } from "@/lib/rbac";
import { sendEmail } from "@/lib/email/resend";
import { buildTeamInviteEmail } from "@/lib/email/templates/team-invite";
import { withApiHandler } from "@/lib/api-handler";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://aci-rho.vercel.app";
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const POST = withApiHandler(
  async (req: NextRequest) => {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!canManageTeam(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { email, name, role } = body as { email?: string; name?: string; role?: string };

    // Validate email
    if (!email?.trim() || !EMAIL_REGEX.test(email.trim())) {
      return NextResponse.json({ error: "Valid email is required" }, { status: 400 });
    }
    const normalizedEmail = email.trim().toLowerCase();

    // Validate role
    if (!role) {
      return NextResponse.json({ error: "Role is required" }, { status: 400 });
    }
    if (!canAssignRole(session.user.role, role as AppUserRole)) {
      return NextResponse.json({ error: "You cannot assign this role" }, { status: 403 });
    }

    // Domain check: auto-detect internal vs external.
    // PRO-173: when org.domain is null we cannot prove the invitee is internal,
    // so treat every domain as external (safest default). Otherwise a TA_LEADER
    // at a domain-less org could invite any external email at full privilege.
    const org = await prisma.organization.findUnique({
      where: { id: session.user.orgId },
      select: { domain: true },
    });
    const emailDomain = normalizedEmail.split("@")[1];
    const isExternal = org?.domain ? emailDomain !== org.domain : true;
    const effectiveRole = isExternal ? "EXTERNAL_COLLABORATOR" : (role as AppUserRole);

    // Check if user already exists in this org
    const existingUser = await prisma.user.findFirst({
      where: { email: normalizedEmail, orgId: session.user.orgId },
    });
    if (existingUser) {
      return NextResponse.json(
        { error: "User already exists in this organization" },
        { status: 409 }
      );
    }

    // Rate limit: 20 invitations per hour per user
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentCount = await prisma.teamInvitation.count({
      where: { invitedBy: session.user.id, createdAt: { gt: oneHourAgo } },
    });
    if (recentCount >= 20) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Maximum 20 invitations per hour." },
        { status: 429 }
      );
    }

    // Revoke any existing PENDING invitation for this email+org
    await prisma.teamInvitation.updateMany({
      where: {
        email: normalizedEmail,
        orgId: session.user.orgId,
        status: "PENDING",
      },
      data: { status: "REVOKED" },
    });

    // Create invitation
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const invitation = await prisma.teamInvitation.create({
      data: {
        orgId: session.user.orgId,
        email: normalizedEmail,
        name: name?.trim() || null,
        role: effectiveRole,
        invitedBy: session.user.id,
        expiresAt,
      },
      include: { org: { select: { slug: true, name: true } } },
    });

    // Send invitation email
    const acceptUrl = `${APP_URL}/join/${invitation.org.slug}/accept?token=${invitation.token}`;
    try {
      const { subject, html } = buildTeamInviteEmail({
        inviterName: session.user.name,
        inviterEmail: session.user.email,
        inviterRole: session.user.role,
        orgName: invitation.org.name,
        role: effectiveRole,
        acceptUrl,
        expiresAt,
      });
      await sendEmail({ to: normalizedEmail, subject, html });
    } catch {
      // Don't fail the invitation — it was created successfully
    }

    // Log the action
    await prisma.activityLog.create({
      data: {
        entityType: "TeamInvitation",
        entityId: invitation.id,
        action: "TEAM_INVITE_SENT",
        actorId: session.user.id,
        metadata: { email: normalizedEmail, role: effectiveRole, orgId: session.user.orgId, isExternal },
      },
    });

    // Return invitation without the token (security)
    return NextResponse.json({
      invitation: {
        id: invitation.id,
        email: invitation.email,
        name: invitation.name,
        role: invitation.role,
        expiresAt: invitation.expiresAt,
        createdAt: invitation.createdAt,
        isExternal,
      },
    }, { status: 201 });
  },
  { module: "team-invite" }
);

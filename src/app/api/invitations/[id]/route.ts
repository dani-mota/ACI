import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { isExternalCollaborator } from "@/lib/rbac";
import { sendEmail } from "@/lib/email/resend";
import { buildInvitationEmail } from "@/lib/email/templates/invitation";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (isExternalCollaborator(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();
  const { action } = body; // "resend" | "cancel"

  const invitation = await prisma.assessmentInvitation.findUnique({
    where: { id },
    include: {
      candidate: { include: { org: true } },
      role: true,
    },
  });

  if (!invitation || invitation.candidate.orgId !== session.user.orgId) {
    return NextResponse.json({ error: "Invitation not found" }, { status: 404 });
  }

  if (action === "resend") {
    if (invitation.status !== "PENDING") {
      return NextResponse.json({ error: "Can only resend pending invitations" }, { status: 400 });
    }

    const newExpiry = new Date();
    newExpiry.setDate(newExpiry.getDate() + 7);

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://aci-rho.vercel.app";
    const assessmentLink = `${baseUrl}/assess/${invitation.linkToken}`;

    const { subject, html } = buildInvitationEmail({
      candidateName: invitation.candidate.firstName,
      roleName: invitation.role.name,
      companyName: invitation.candidate.org.name,
      assessmentLink,
      expiresAt: newExpiry,
    });

    try {
      await sendEmail({ to: invitation.candidate.email, subject, html });
    } catch (err) {
      console.error("Failed to resend invitation:", err);
      return NextResponse.json({ error: "Failed to send email" }, { status: 500 });
    }

    const updated = await prisma.assessmentInvitation.update({
      where: { id },
      data: {
        expiresAt: newExpiry,
        emailSentAt: new Date(),
        reminderCount: { increment: 1 },
      },
    });

    return NextResponse.json(updated);
  }

  if (action === "cancel") {
    if (invitation.status !== "PENDING") {
      return NextResponse.json({ error: "Can only cancel pending invitations" }, { status: 400 });
    }

    const updated = await prisma.assessmentInvitation.update({
      where: { id },
      data: { status: "EXPIRED" },
    });

    return NextResponse.json(updated);
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  // Fix: PRO-80 — block external collaborators from deleting invitations
  if (isExternalCollaborator(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  const invitation = await prisma.assessmentInvitation.findUnique({
    where: { id },
    include: { candidate: true },
  });

  if (!invitation || invitation.candidate.orgId !== session.user.orgId) {
    return NextResponse.json({ error: "Invitation not found" }, { status: 404 });
  }

  await prisma.assessmentInvitation.delete({ where: { id } });

  return NextResponse.json({ success: true });
}

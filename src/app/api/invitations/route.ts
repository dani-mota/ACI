import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { isExternalCollaborator } from "@/lib/rbac";
import { sendEmail } from "@/lib/email/resend";
import { buildInvitationEmail } from "@/lib/email/templates/invitation";

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (isExternalCollaborator(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { firstName, lastName, email, phone, roleId } = body;

  if (!firstName || !lastName || !email || !roleId) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!EMAIL_REGEX.test(email)) {
    return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
  }

  if (firstName.length > 100 || lastName.length > 100) {
    return NextResponse.json({ error: "Name exceeds maximum length" }, { status: 400 });
  }

  const role = await prisma.role.findUnique({
    where: { id: roleId },
    include: { org: true },
  });

  if (!role || role.orgId !== session.user.orgId) {
    return NextResponse.json({ error: "Role not found" }, { status: 404 });
  }

  // Check if candidate with this email already exists in the org
  const existingCandidate = await prisma.candidate.findUnique({
    where: { email_orgId: { email, orgId: session.user.orgId! } },
    select: { id: true, firstName: true, lastName: true, status: true },
  });

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  let result;
  try {
    result = await prisma.$transaction(async (tx) => {
      // Reuse existing candidate or create new one
      const candidate = existingCandidate
        ? existingCandidate
        : await tx.candidate.create({
            data: {
              firstName,
              lastName,
              email,
              phone: phone || null,
              orgId: session.user.orgId!,
              primaryRoleId: roleId,
              status: "INVITED",
            },
          });

      const invitation = await tx.assessmentInvitation.create({
        data: {
          candidateId: candidate.id,
          roleId,
          invitedBy: session.user.id,
          expiresAt,
        },
      });

      return { candidate, invitation, reused: !!existingCandidate };
    });
  } catch (err: unknown) {
    console.error("Failed to create invitation:", err);
    return NextResponse.json(
      { error: "Failed to create invitation" },
      { status: 500 },
    );
  }

  // Send invitation email
  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://aci-rho.vercel.app").trim();
  const assessmentLink = `${baseUrl}/assess/${result.invitation.linkToken}`;

  const { subject, html } = buildInvitationEmail({
    candidateName: firstName,
    roleName: role.name,
    companyName: role.org.name,
    assessmentLink,
    expiresAt,
  });

  try {
    await sendEmail({ to: email, subject, html });
    await prisma.assessmentInvitation.update({
      where: { id: result.invitation.id },
      data: { emailSentAt: new Date() },
    });
  } catch (err) {
    console.error("Failed to send invitation email:", err);
    // Don't fail the request — invitation is created, email can be resent
  }

  return NextResponse.json({
    candidateId: result.candidate.id,
    invitationId: result.invitation.id,
    status: "sent",
    existingCandidate: result.reused,
  });
}

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const invitations = await prisma.assessmentInvitation.findMany({
    where: {
      candidate: { orgId: session.user.orgId! },
    },
    select: {
      id: true,
      status: true,
      expiresAt: true,
      createdAt: true,
      emailSentAt: true,
      reminderCount: true,
      candidate: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
      role: { select: { id: true, name: true, slug: true } },
      inviter: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(invitations);
}

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { isExternalCollaborator } from "@/lib/rbac";
import { sendEmail } from "@/lib/email/resend";
import { buildInvitationEmail } from "@/lib/email/templates/invitation";
import { parseCsv, validateCsvRows } from "@/lib/csv-templates";

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (isExternalCollaborator(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { csvContent } = body;

  if (!csvContent) {
    return NextResponse.json({ error: "CSV content is required" }, { status: 400 });
  }

  // Get valid roles for the org
  const roles = await prisma.role.findMany({
    where: { orgId: session.user.orgId! },
    include: { org: true },
  });
  const roleMap = new Map(roles.map((r) => [r.slug, r]));
  const validSlugs = roles.map((r) => r.slug);

  // Parse and validate
  const { rows } = parseCsv(csvContent);

  const MAX_BATCH_SIZE = 200;
  if (rows.length > MAX_BATCH_SIZE) {
    return NextResponse.json(
      { error: `Batch size cannot exceed ${MAX_BATCH_SIZE} rows` },
      { status: 400 }
    );
  }

  const validated = validateCsvRows(rows, validSlugs);

  const errors = validated.filter((r) => r.errors.length > 0);
  if (errors.length > 0) {
    return NextResponse.json(
      { error: "Validation errors", rows: validated },
      { status: 400 }
    );
  }

  // Create candidates and invitations in transaction
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  // Fix: PRO-26 — process rows individually with upsert to handle duplicates gracefully
  const genericRole = roles.find((r) => r.isGeneric);
  const results: { candidate: any; invitation: any; role: any }[] = [];
  const skipped: { row: number; email: string; reason: string }[] = [];

  for (let i = 0; i < validated.length; i++) {
    const row = validated[i];
    try {
      const role = row.role_slug
        ? roleMap.get(row.role_slug)
        : genericRole;
      if (!role) {
        skipped.push({ row: i + 1, email: row.email, reason: `Role "${row.role_slug || "generic-aptitude"}" not found` });
        continue;
      }

      const candidate = await prisma.candidate.upsert({
        where: {
          email_orgId: {
            email: row.email,
            orgId: session.user.orgId!,
          },
        },
        create: {
          firstName: row.first_name,
          lastName: row.last_name,
          email: row.email,
          phone: row.phone || null,
          orgId: session.user.orgId!,
          primaryRoleId: role.id,
          status: "INVITED",
        },
        update: {
          firstName: row.first_name,
          lastName: row.last_name,
          phone: row.phone || null,
          primaryRoleId: role.id,
        },
      });

      const invitation = await prisma.assessmentInvitation.create({
        data: {
          candidateId: candidate.id,
          roleId: role.id,
          invitedBy: session.user.id,
          expiresAt,
        },
      });

      results.push({ candidate, invitation, role });
    } catch (err) {
      skipped.push({ row: i + 1, email: row.email, reason: err instanceof Error ? err.message : "Unknown error" });
    }
  }

  // Send emails (non-blocking — don't fail the batch if some emails fail)
  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://aci-rho.vercel.app").trim();
  const emailResults = await Promise.allSettled(
    results.map(async ({ candidate, invitation, role }) => {
      const assessmentLink = `${baseUrl}/assess/${invitation.linkToken}`;
      const { subject, html } = buildInvitationEmail({
        candidateName: candidate.firstName,
        roleName: role.isGeneric ? "General Aptitude Assessment" : role.name,
        companyName: role.org.name,
        assessmentLink,
        expiresAt,
      });

      await sendEmail({ to: candidate.email, subject, html });
      await prisma.assessmentInvitation.update({
        where: { id: invitation.id },
        data: { emailSentAt: new Date() },
      });
    })
  );

  const sent = emailResults.filter((r) => r.status === "fulfilled").length;
  const failed = emailResults.filter((r) => r.status === "rejected").length;

  return NextResponse.json({
    imported: results.length,
    skipped: skipped.length,
    emailsSent: sent,
    emailsFailed: failed,
    errors: skipped,
    candidates: results.map((r) => ({
      id: r.candidate.id,
      firstName: r.candidate.firstName,
      lastName: r.candidate.lastName,
      email: r.candidate.email,
    })),
  });
}

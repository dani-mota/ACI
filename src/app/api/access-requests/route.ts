import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { sendEmail } from "@/lib/email/resend";
import { accessRequestNotificationEmail } from "@/lib/email/templates/access-request-notification";
import { buildOrgAccessRequestNotificationEmail } from "@/lib/email/templates/org-access-request-notification";
import { checkRateLimit } from "@/lib/rate-limit";

const VALID_ROLES = [
  "RECRUITER_COORDINATOR",
  "RECRUITING_MANAGER",
  "HIRING_MANAGER",
  "TA_LEADER",
];

const ADMIN_EMAIL =
  process.env.ADMIN_NOTIFICATION_EMAIL ?? "dani@arklight.us";
const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL || "https://aci-rho.vercel.app";
const ADMIN_URL = `${APP_URL}/admin`;

async function notifyPlatformAdmin(data: {
  firstName: string;
  lastName: string;
  email: string;
  companyName: string;
  requestedRole: string;
}) {
  try {
    const { subject, html } = accessRequestNotificationEmail({
      ...data,
      submittedAt: new Date().toLocaleString("en-US", {
        dateStyle: "long",
        timeStyle: "short",
        timeZone: "America/New_York",
      }),
      adminUrl: ADMIN_URL,
    });
    await sendEmail({ to: ADMIN_EMAIL, subject, html });
  } catch (err) {
    console.error("Failed to send admin notification email:", err);
  }
}

async function notifyOrgLeaders(data: {
  orgId: string;
  orgName: string;
  requesterName: string;
  requesterEmail: string;
  requesterJobTitle: string;
  requesterReason?: string;
}) {
  try {
    // Find all active TA_LEADERs in the org
    const leaders = await prisma.user.findMany({
      where: { orgId: data.orgId, role: "TA_LEADER", isActive: true },
      select: { email: true },
    });

    if (leaders.length === 0) return;

    const { subject, html } = buildOrgAccessRequestNotificationEmail({
      requesterName: data.requesterName,
      requesterEmail: data.requesterEmail,
      requesterJobTitle: data.requesterJobTitle,
      requesterReason: data.requesterReason,
      orgName: data.orgName,
      settingsUrl: `${APP_URL}/settings/team`,
    });

    // Send to all TA_LEADERs (non-blocking on individual failures)
    await Promise.allSettled(
      leaders.map((leader) => sendEmail({ to: leader.email, subject, html }))
    );
  } catch (err) {
    console.error("Failed to send org leader notification email:", err);
  }
}

/**
 * POST /api/access-requests (public — no auth required)
 */
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { email, firstName, lastName, companyName, requestedRole, orgId, jobTitle, reason } = body;

  if (!email || !firstName || !lastName || !companyName || !requestedRole) {
    return NextResponse.json({ error: "All fields are required" }, { status: 400 });
  }

  if (!VALID_ROLES.includes(requestedRole)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  // Input length validation
  const MAX_NAME = 100;
  const MAX_FIELD = 200;
  const MAX_REASON = 2000;
  if (firstName.length > MAX_NAME || lastName.length > MAX_NAME) {
    return NextResponse.json({ error: "Name is too long" }, { status: 400 });
  }
  if (companyName.length > MAX_FIELD || (jobTitle && jobTitle.length > MAX_FIELD)) {
    return NextResponse.json({ error: "Input is too long" }, { status: 400 });
  }
  if (reason && reason.length > MAX_REASON) {
    return NextResponse.json({ error: "Reason is too long" }, { status: 400 });
  }

  // IP-based rate limit for all requests: 10 per hour
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const ipLimit = checkRateLimit(`access-req:ip:${ip}`, { maxRequests: 10, windowMs: 3_600_000 });
  if (!ipLimit.allowed) {
    return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });
  }

  // Rate limit org-scoped requests: 5 per email per 24 hours
  if (orgId) {
    // Org-scoped requests must use RECRUITER_COORDINATOR role
    if (requestedRole !== "RECRUITER_COORDINATOR") {
      return NextResponse.json({ error: "Invalid role for org request" }, { status: 400 });
    }

    const limit = checkRateLimit(`access-req:${email}:${orgId}`, { maxRequests: 5, windowMs: 86_400_000 });
    if (!limit.allowed) {
      return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });
    }

    // Validate org exists
    const org = await prisma.organization.findUnique({ where: { id: orgId }, select: { id: true } });
    if (!org) {
      return NextResponse.json({ error: "Invalid organization" }, { status: 400 });
    }
  }

  // Check for existing pending request (scoped to orgId for org requests, null for platform)
  const existingWhere = orgId
    ? { email, orgId, status: "PENDING" as const }
    : { email, orgId: null, status: "PENDING" as const };

  const existing = await prisma.accessRequest.findFirst({ where: existingWhere });

  if (existing) {
    return NextResponse.json(
      { error: "A request for this email is already pending review." },
      { status: 409 }
    );
  }

  // Check if user already exists in this org (or globally for platform requests)
  if (orgId) {
    const existingUser = await prisma.user.findFirst({
      where: { email, orgId },
    });
    if (existingUser) {
      return NextResponse.json(
        { error: "This email already has an account. Please sign in instead." },
        { status: 409 }
      );
    }
  }

  // Check for previously rejected request and allow resubmission
  if (orgId) {
    const rejected = await prisma.accessRequest.findFirst({
      where: { email, orgId, status: "REJECTED" },
    });
    if (rejected) {
      const updated = await prisma.accessRequest.update({
        where: { id: rejected.id },
        data: {
          firstName,
          lastName,
          companyName,
          requestedRole: requestedRole as any,
          reason: reason || null,
          jobTitle: jobTitle || null,
          status: "PENDING",
          reviewedBy: null,
          reviewedAt: null,
          rejectionReason: null,
        },
      });
      await notifyOrgLeaders({
        orgId,
        orgName: companyName,
        requesterName: `${firstName} ${lastName}`,
        requesterEmail: email,
        requesterJobTitle: jobTitle || requestedRole,
        requesterReason: reason,
      });
      return NextResponse.json({ id: updated.id, status: "PENDING" });
    }
  } else {
    // Platform-level: check for existing by email (original behavior)
    const existingByEmail = await prisma.accessRequest.findFirst({
      where: { email, orgId: null },
    });
    if (existingByEmail) {
      if (existingByEmail.status === "PENDING") {
        return NextResponse.json(
          { error: "A request for this email is already pending admin review." },
          { status: 409 }
        );
      }
      if (existingByEmail.status === "REJECTED") {
        const updated = await prisma.accessRequest.update({
          where: { id: existingByEmail.id },
          data: {
            firstName,
            lastName,
            companyName,
            requestedRole: requestedRole as any,
            status: "PENDING",
            reviewedBy: null,
            reviewedAt: null,
            rejectionReason: null,
          },
        });
        await notifyPlatformAdmin({ firstName, lastName, email, companyName, requestedRole });
        return NextResponse.json({ id: updated.id, status: "PENDING" });
      }
      // Already approved
      return NextResponse.json(
        { error: "This email already has an account. Please sign in instead." },
        { status: 409 }
      );
    }
  }

  const accessRequest = await prisma.accessRequest.create({
    data: {
      email,
      firstName,
      lastName,
      companyName,
      requestedRole: requestedRole as any,
      jobTitle: jobTitle || null,
      reason: reason || null,
      orgId: orgId || null,
      supabaseId: null,
    },
  });

  // Notify appropriate people
  if (orgId) {
    await notifyOrgLeaders({
      orgId,
      orgName: companyName,
      requesterName: `${firstName} ${lastName}`,
      requesterEmail: email,
      requesterJobTitle: jobTitle || requestedRole,
      requesterReason: reason,
    });
  } else {
    await notifyPlatformAdmin({ firstName, lastName, email, companyName, requestedRole });
  }

  return NextResponse.json({ id: accessRequest.id, status: "PENDING" });
}

/**
 * GET /api/access-requests (admin only)
 * Returns all access requests, filterable by status.
 */
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");

  // Platform admin only sees requests without an org (new company inquiries)
  const where: Record<string, unknown> = { orgId: null };
  if (status) where.status = status;

  const requests = await prisma.accessRequest.findMany({
    where,
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(requests);
}

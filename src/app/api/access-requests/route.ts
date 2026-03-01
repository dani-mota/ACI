import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { sendEmail } from "@/lib/email/resend";
import { accessRequestNotificationEmail } from "@/lib/email/templates/access-request-notification";

const VALID_ROLES = [
  "RECRUITER_COORDINATOR",
  "RECRUITING_MANAGER",
  "HIRING_MANAGER",
  "TA_LEADER",
];

const ADMIN_EMAIL =
  process.env.ADMIN_NOTIFICATION_EMAIL ?? "dani@arklight.us";
const ADMIN_URL =
  process.env.NEXT_PUBLIC_APP_URL
    ? `${process.env.NEXT_PUBLIC_APP_URL}/admin`
    : "https://aci-rho.vercel.app/admin";

async function notifyAdmin(data: {
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
    // Email failure must never block the form submission
    console.error("Failed to send admin notification email:", err);
  }
}

/**
 * POST /api/access-requests (public — no auth required)
 */
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { email, firstName, lastName, companyName, requestedRole, supabaseId } = body;

  if (!email || !firstName || !lastName || !companyName || !requestedRole) {
    return NextResponse.json({ error: "All fields are required" }, { status: 400 });
  }

  if (!VALID_ROLES.includes(requestedRole)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  // Check for existing request
  const existing = await prisma.accessRequest.findUnique({ where: { email } });

  if (existing) {
    if (existing.status === "PENDING") {
      return NextResponse.json(
        { error: "A request for this email is already pending admin review." },
        { status: 409 }
      );
    }
    if (existing.status === "REJECTED") {
      // Allow resubmission
      const updated = await prisma.accessRequest.update({
        where: { email },
        data: {
          firstName,
          lastName,
          companyName,
          requestedRole: requestedRole as any,
          supabaseId,
          status: "PENDING",
          reviewedBy: null,
          reviewedAt: null,
          rejectionReason: null,
        },
      });
      await notifyAdmin({ firstName, lastName, email, companyName, requestedRole });
      return NextResponse.json({ id: updated.id, status: "PENDING" });
    }
    // Already approved
    return NextResponse.json(
      { error: "This email already has an account. Please sign in instead." },
      { status: 409 }
    );
  }

  const accessRequest = await prisma.accessRequest.create({
    data: {
      email,
      firstName,
      lastName,
      companyName,
      requestedRole: requestedRole as any,
      supabaseId,
    },
  });

  await notifyAdmin({ firstName, lastName, email, companyName, requestedRole });

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

  const requests = await prisma.accessRequest.findMany({
    where: status ? { status: status as any } : undefined,
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(requests);
}

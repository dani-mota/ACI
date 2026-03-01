import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";

const VALID_ROLES = [
  "RECRUITER_COORDINATOR",
  "RECRUITING_MANAGER",
  "HIRING_MANAGER",
  "TA_LEADER",
];

/**
 * POST /api/access-requests (public — no auth required)
 * Called after Supabase signUp() succeeds.
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
      return NextResponse.json({ error: "Request already pending" }, { status: 409 });
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
      return NextResponse.json({ id: updated.id, status: "PENDING" });
    }
    // Already approved
    return NextResponse.json({ error: "Already approved" }, { status: 409 });
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

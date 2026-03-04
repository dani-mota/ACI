import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import type { Notification } from "@/lib/notifications";

/**
 * GET /api/notifications
 * Returns up to 20 live notifications based on real DB state, scoped to the user's org.
 */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { orgId, role } = session.user;
  const notifications: Notification[] = [];
  const now = Date.now();
  const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
  const threeDaysAgo = new Date(now - 3 * 24 * 60 * 60 * 1000);
  const twoDaysAgo = new Date(now - 2 * 24 * 60 * 60 * 1000);

  // 1. Completed assessments (last 7 days)
  const completed = await prisma.candidate.findMany({
    where: {
      orgId,
      assessment: { completedAt: { gte: sevenDaysAgo } },
    },
    include: {
      assessment: { select: { completedAt: true } },
      primaryRole: { select: { name: true } },
    },
    orderBy: { assessment: { completedAt: "desc" } },
    take: 5,
  });

  for (const c of completed) {
    notifications.push({
      id: `notif-completed-${c.id}`,
      type: "ASSESSMENT_COMPLETED",
      title: "Assessment Completed",
      message: `${c.firstName} ${c.lastName} completed their ${c.primaryRole.name} assessment.`,
      timestamp: c.assessment?.completedAt ?? new Date(),
      read: false,
      candidateId: c.id,
    });
  }

  // 2. Awaiting decision >48h
  const awaiting = await prisma.candidate.findMany({
    where: {
      orgId,
      status: "REVIEW_REQUIRED",
      updatedAt: { lt: twoDaysAgo },
    },
    include: { primaryRole: { select: { name: true } } },
    orderBy: { updatedAt: "asc" },
    take: 3,
  });

  for (const c of awaiting) {
    const daysSince = Math.floor((now - c.updatedAt.getTime()) / (1000 * 60 * 60 * 24));
    notifications.push({
      id: `notif-awaiting-${c.id}`,
      type: "AWAITING_DECISION",
      title: "Awaiting Decision",
      message: `${c.firstName} ${c.lastName} has been awaiting decision for ${daysSince} day${daysSince !== 1 ? "s" : ""}.`,
      timestamp: c.updatedAt,
      read: false,
      candidateId: c.id,
    });
  }

  // 3. Assessment started (last 3 days)
  const started = await prisma.assessmentInvitation.findMany({
    where: {
      status: "STARTED",
      invitedAt: { gte: threeDaysAgo },
      candidate: { orgId },
    },
    include: {
      candidate: { select: { id: true, firstName: true, lastName: true } },
      role: { select: { name: true } },
    },
    orderBy: { invitedAt: "desc" },
    take: 3,
  });

  for (const inv of started) {
    notifications.push({
      id: `notif-started-${inv.id}`,
      type: "NEW_CANDIDATE",
      title: "Assessment Started",
      message: `${inv.candidate.firstName} ${inv.candidate.lastName} started their ${inv.role.name} assessment.`,
      timestamp: inv.invitedAt,
      read: true,
      candidateId: inv.candidate.id,
    });
  }

  // 4. Red flags — CRITICAL severity (last 7 days)
  const redFlags = await prisma.redFlag.findMany({
    where: {
      severity: "CRITICAL",
      createdAt: { gte: sevenDaysAgo },
      assessment: { candidate: { orgId } },
    },
    include: {
      assessment: {
        select: {
          candidate: { select: { id: true, firstName: true, lastName: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 3,
  });

  for (const flag of redFlags) {
    const c = flag.assessment.candidate;
    notifications.push({
      id: `notif-redflag-${flag.id}`,
      type: "RED_FLAG_DETECTED",
      title: "Red Flag Detected",
      message: `${c.firstName} ${c.lastName}: ${flag.title}`,
      timestamp: flag.createdAt,
      read: false,
      candidateId: c.id,
    });
  }

  // 5. ADMIN only: pending access requests
  if (role === "ADMIN") {
    const pendingRequests = await prisma.accessRequest.findMany({
      where: { status: "PENDING" },
      orderBy: { createdAt: "desc" },
      take: 3,
    });

    for (const req of pendingRequests) {
      notifications.push({
        id: `notif-access-${req.id}`,
        type: "ACCESS_REQUEST_PENDING",
        title: "Access Request",
        message: `${req.firstName} ${req.lastName} (${req.companyName}) requested access.`,
        timestamp: req.createdAt,
        read: false,
        linkTo: "/admin",
      });
    }
  }

  // Sort by timestamp desc, limit to 20
  notifications.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return NextResponse.json(notifications.slice(0, 20));
}

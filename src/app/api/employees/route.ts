import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { canAccessMode } from "@/lib/rbac";
import { canViewAnyEmployee, PR2_PENDING_REASON } from "@/lib/employee-permissions";
import { withApiHandler } from "@/lib/api-handler";

export const GET = withApiHandler(
  async () => {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // PRO-133 mode-level gate: can this user enter Employee Mode at all?
    if (!canAccessMode(session, "employees")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    // PRO-133 capability gate: PR#1 grants org-wide read to TA_LEADER,
    // ADMIN, HIRING_MANAGER, HR_TALENT_LEADER. EMPLOYEE/PEOPLE_MANAGER
    // get a stub-403 with `reason: PR2_PENDING_REASON` until PR#2 wires
    // their data linkages (Candidate.userId, User.managerId).
    if (!canViewAnyEmployee(session)) {
      return NextResponse.json(
        { error: "Forbidden", reason: PR2_PENDING_REASON },
        { status: 403 },
      );
    }

    const employees = await prisma.candidate.findMany({
      where: {
        orgId: session.user.orgId,
        assessment: {
          assessmentMode: "EMPLOYEE",
        },
      },
      include: {
        primaryRole: { select: { name: true, slug: true } },
        assessment: {
          select: {
            id: true,
            completedAt: true,
            convertedAt: true,
            department: true,
            roleFamily: true,
            employeeStatus: true,
          },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    return NextResponse.json({ employees });
  },
  { module: "employees/list" },
);

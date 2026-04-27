import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { canAccessMode } from "@/lib/rbac";
import { withApiHandler } from "@/lib/api-handler";

export const GET = withApiHandler(
  async () => {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Same gate as the Employees dashboard tab (PRO-128 MODE_ACCESS).
    // TODO(PRO-133): expand to PEOPLE_MANAGER and HR_TALENT_LEADER once those roles land.
    if (!canAccessMode(session.user.role, "employees")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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

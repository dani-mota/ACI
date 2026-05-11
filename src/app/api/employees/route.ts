import { NextResponse } from "next/server";
import type { Prisma } from "@/generated/prisma/client";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { canAccessMode } from "@/lib/rbac";
import { canViewAnyEmployee } from "@/lib/employee-permissions";
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

    // PRO-133 PR#2 role-scoped filtering. Org-wide viewers (TA_LEADER,
    // ADMIN, HIRING_MANAGER, HR_TALENT_LEADER) see all employees. EMPLOYEE
    // sees only their own dossier (list of one). PEOPLE_MANAGER sees only
    // direct reports (User.managerId === session.user.id). EXECUTIVE has
    // no individual-list access — returns 403 here.
    const baseWhere: Prisma.CandidateWhereInput = {
      orgId: session.user.orgId,
      assessment: { assessmentMode: "EMPLOYEE" },
    };
    let scopedWhere: Prisma.CandidateWhereInput = baseWhere;
    if (!canViewAnyEmployee(session)) {
      const empRole = session.user.employeeRole;
      if (empRole === "EMPLOYEE") {
        scopedWhere = { ...baseWhere, userId: session.user.id };
      } else if (empRole === "PEOPLE_MANAGER") {
        scopedWhere = { ...baseWhere, user: { managerId: session.user.id } };
      } else {
        // EXECUTIVE (individual list not allowed) and Candidate-Mode-only
        // roles without employees-mode access (already gated by canAccessMode
        // above, but guard against future MODE_ACCESS expansion).
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    const employees = await prisma.candidate.findMany({
      where: scopedWhere,
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

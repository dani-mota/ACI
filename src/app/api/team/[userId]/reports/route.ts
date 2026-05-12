import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { canManageTeam } from "@/lib/rbac";
import { withApiHandler } from "@/lib/api-handler";

// PRO-184: inverse-direct-reports query. Returns Users whose
// `managerId === [userId]`. Single-hop only — matches PR#2's
// isDirectReport() semantics (src/lib/employee-permissions.ts:278-290).
// A manager's manager's reports are NOT returned; they don't have
// managerId === [userId], so the flat findMany excludes them.
//
// RBAC:
//   - canManageTeam roles (ADMIN, TA_LEADER) — may query any userId.
//   - PEOPLE_MANAGER — may only query their own userId; a request for
//     someone else's reports returns 403.
//   - Everyone else — 403.
export const GET = withApiHandler(
  async (_req: NextRequest, ctx) => {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { userId } = await ctx.params;

    const isTeamManager = canManageTeam(session.user.role);
    // PEOPLE_MANAGER lives on AppEmployeeUserRole; the Employee Mode
    // role slot is checked separately. The same "may view own reports
    // only" rule applies to anyone who isn't a canManageTeam role.
    const isViewingSelf = session.user.id === userId;

    if (!isTeamManager && !isViewingSelf) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const reports = await prisma.user.findMany({
      where: {
        managerId: userId,
        orgId: session.user.orgId,
        isActive: true,
      },
      select: { id: true, name: true, email: true, role: true, isActive: true },
      orderBy: { name: "asc" },
    });

    return NextResponse.json({ reports });
  },
  { module: "team" }
);

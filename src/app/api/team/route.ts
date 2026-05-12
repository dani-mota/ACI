import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { canManageTeam, canConvertCandidate } from "@/lib/rbac";
import { withApiHandler } from "@/lib/api-handler";

export const GET = withApiHandler(
  async (req) => {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    // PRO-133 PR#2: also allow anyone with conversion authority to read the
    // team list — they need it for the convert modal's manager picker.
    // canConvertCandidate already covers RECRUITING_MANAGER/TA_LEADER/ADMIN
    // + Employee Mode PEOPLE_MANAGER/HR_TALENT_LEADER, so this widens the
    // gate to the union without inventing a new permission.
    if (!canManageTeam(session.user.role) && !canConvertCandidate(session)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // PRO-133 PR#2: optional matchEmail query param. When provided, return
    // the User row (if any) in the requester's org whose email matches.
    // Used by the convert-to-employee modal to surface the User-match
    // indicator BEFORE the converter submits — prevents the silent-failure
    // UX where the converter expects linkage but lazy-match returned null.
    const matchEmail = new URL(req.url).searchParams.get("matchEmail")?.trim() ?? null;

    const [members, pendingInvitations, matchedByEmail] = await Promise.all([
      prisma.user.findMany({
        where: { orgId: session.user.orgId, role: { not: "ADMIN" } },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isActive: true,
          createdAt: true,
          // PRO-184: managerId needed by the team-management UI to
          // default the edit-manager modal to the current value.
          managerId: true,
        },
        orderBy: { createdAt: "asc" },
      }),
      prisma.teamInvitation.findMany({
        where: {
          orgId: session.user.orgId,
          status: "PENDING",
          expiresAt: { gt: new Date() },
        },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          createdAt: true,
          expiresAt: true,
          status: true,
          inviter: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
      matchEmail
        ? prisma.user.findFirst({
            where: { email: matchEmail, orgId: session.user.orgId },
            select: { id: true, name: true, email: true },
          })
        : Promise.resolve(null),
    ]);

    return NextResponse.json({ members, pendingInvitations, matchedByEmail });
  },
  { module: "team" }
);

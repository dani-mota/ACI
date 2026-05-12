/**
 * PRO-135: Single role demand profile — read, update, delete.
 *
 * GET    /api/role-profiles/[id]    — read (canAccessMode "employees")
 * PUT    /api/role-profiles/[id]    — update (canView "roleProfiles")
 * DELETE /api/role-profiles/[id]    — hard delete (canView "roleProfiles")
 *
 * Cross-org access returns 404 (not 403) — don't leak existence.
 */

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { canAccessMode, canView } from "@/lib/rbac";
import { withApiHandler } from "@/lib/api-handler";
import { CONSTRUCTS } from "@/lib/constructs";
import { batchInvalidateByRoleFamily } from "@/lib/assessment/insights/employee-insights-persistence";

interface UpdateBody {
  name?: unknown;
  roleFamily?: unknown;
  constructScores?: unknown;
}

const VALID_CONSTRUCTS = new Set(Object.keys(CONSTRUCTS));

function validateConstructScores(value: unknown): { ok: true; scores: Record<string, number> } | { ok: false; error: string } {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return { ok: false, error: "constructScores must be an object" };
  }
  const out: Record<string, number> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (!VALID_CONSTRUCTS.has(key)) {
      return { ok: false, error: `Unknown construct key: ${key}` };
    }
    if (raw === null || raw === undefined) continue;
    if (typeof raw !== "number" || !Number.isInteger(raw) || raw < 1 || raw > 10) {
      return { ok: false, error: `Score for ${key} must be an integer 1-10` };
    }
    out[key] = raw;
  }
  return { ok: true, scores: out };
}

export const GET = withApiHandler(
  async (_req, ctx) => {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!canAccessMode(session, "employees")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await ctx.params;
    const profile = await prisma.roleDemandProfile.findFirst({
      where: { id, orgId: session.user.orgId },
      select: {
        id: true,
        name: true,
        roleFamily: true,
        constructScores: true,
        isTemplate: true,
        updatedAt: true,
        createdAt: true,
      },
    });
    if (!profile) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ profile });
  },
  { module: "role-profiles/[id]" },
);

export const PUT = withApiHandler(
  async (req, ctx) => {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    // PRO-133: HR_TALENT_LEADER (Employee Mode) also gets write access here
    // alongside the existing TA_LEADER + ADMIN (Candidate Mode) authority.
    const allowedToWrite =
      canView(session.user.role, "roleProfiles") ||
      session.user.employeeRole === "HR_TALENT_LEADER";
    if (!allowedToWrite) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await ctx.params;

    // Cross-org guard: 404 (not 403) — don't leak existence.
    const existing = await prisma.roleDemandProfile.findFirst({
      where: { id, orgId: session.user.orgId },
      select: { id: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const body = (await req.json().catch(() => null)) as UpdateBody | null;
    if (!body) {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    if (typeof body.name !== "string" || body.name.trim().length === 0) {
      return NextResponse.json({ error: "name required" }, { status: 400 });
    }
    if (typeof body.roleFamily !== "string" || body.roleFamily.trim().length === 0) {
      return NextResponse.json({ error: "roleFamily required" }, { status: 400 });
    }
    const validated = validateConstructScores(body.constructScores);
    if (!validated.ok) {
      return NextResponse.json({ error: validated.error }, { status: 400 });
    }

    await prisma.roleDemandProfile.update({
      where: { id },
      data: {
        name: body.name.trim(),
        roleFamily: body.roleFamily.trim(),
        constructScores: validated.scores,
      },
    });

    // PRO-137: invalidate cached under-leverage scores for every employee
    // in this (orgId, roleFamily). Lazy recompute fires on next dossier
    // read. People Table sort uses stale scores until then — documented
    // sort-accuracy trade-off; mitigation via refresh cron is out of scope.
    await batchInvalidateByRoleFamily(session.user.orgId, body.roleFamily.trim());

    return NextResponse.json({ ok: true });
  },
  { module: "role-profiles/[id]" },
);

export const DELETE = withApiHandler(
  async (_req, ctx) => {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    // PRO-133: HR_TALENT_LEADER (Employee Mode) also gets write access here
    // alongside the existing TA_LEADER + ADMIN (Candidate Mode) authority.
    const allowedToWrite =
      canView(session.user.role, "roleProfiles") ||
      session.user.employeeRole === "HR_TALENT_LEADER";
    if (!allowedToWrite) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await ctx.params;
    const existing = await prisma.roleDemandProfile.findFirst({
      where: { id, orgId: session.user.orgId },
      select: { id: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await prisma.roleDemandProfile.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  },
  { module: "role-profiles/[id]" },
);

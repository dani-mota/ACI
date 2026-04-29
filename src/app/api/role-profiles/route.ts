/**
 * PRO-135: List + create role demand profiles for the current org.
 *
 * GET  /api/role-profiles    — list all profiles for the session's org
 * POST /api/role-profiles    — create a new profile (TA_LEADER / ADMIN only)
 *
 * RBAC:
 *   - Read uses canAccessMode("employees") — anyone with employee-mode access
 *     can list profiles (the radar overlay needs them server-side anyway).
 *   - Write uses canView(role, "roleProfiles") — only TA_LEADER + ADMIN.
 *
 * Validation policy: lightweight. Construct keys MUST be in CONSTRUCTS;
 * values MUST be integers 1-10 when present. Unknown keys → 400. Allowing
 * partial maps is intentional — Dani's polish item #2 covers the "N of 12
 * scored" UX for unfinished profiles.
 */

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { canAccessMode, canView } from "@/lib/rbac";
import { withApiHandler } from "@/lib/api-handler";
import { CONSTRUCTS } from "@/lib/constructs";

interface CreateBody {
  name?: unknown;
  roleFamily?: unknown;
  constructScores?: unknown;
  isTemplate?: unknown;
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
  async () => {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!canAccessMode(session.user.role, "employees")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const profiles = await prisma.roleDemandProfile.findMany({
      where: { orgId: session.user.orgId, isTemplate: false },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        name: true,
        roleFamily: true,
        constructScores: true,
        updatedAt: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ profiles });
  },
  { module: "role-profiles" },
);

export const POST = withApiHandler(
  async (req) => {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!canView(session.user.role, "roleProfiles")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = (await req.json().catch(() => null)) as CreateBody | null;
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

    const profile = await prisma.roleDemandProfile.create({
      data: {
        name: body.name.trim(),
        roleFamily: body.roleFamily.trim(),
        orgId: session.user.orgId,
        constructScores: validated.scores,
        isTemplate: false,
        createdById: session.user.id,
      },
      select: { id: true },
    });

    return NextResponse.json({ id: profile.id }, { status: 201 });
  },
  { module: "role-profiles" },
);

/**
 * PRO-133 / PR#1 — STUB endpoint for org-level aggregated insights.
 *
 * Why this stub exists:
 *   Dani's 2026-05-07 guardrail #3 requires the EXECUTIVE role to have
 *   at least one endpoint that returns 200 alongside the 403s on
 *   individual-level endpoints. Otherwise EXECUTIVE looks like a broken
 *   role to anyone testing it. This route is that paired positive.
 *
 * Contract — PRO-145 must not regress this:
 *   - Returns 200 with `{}` body for HR_TALENT_LEADER, EXECUTIVE,
 *     TA_LEADER, ADMIN
 *   - Returns 403 for everyone else (including EMPLOYEE, PEOPLE_MANAGER,
 *     EXTERNAL_COLLABORATOR, RECRUITER_COORDINATOR, RECRUITING_MANAGER,
 *     HIRING_MANAGER)
 *   - Returns 401 when no session
 *
 * PRO-145 (Cognitive Inventory) will replace the body of GET with the
 * real aggregated org-level construct distributions. The gate stays
 * exactly as-is — `canViewOrgInsights` is the contract. Do NOT change
 * the gate when filling in the body.
 */

import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { canViewOrgInsights } from "@/lib/employee-permissions";
import { withApiHandler } from "@/lib/api-handler";

export const GET = withApiHandler(
  async () => {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!canViewOrgInsights(session)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    // PRO-145 will replace this body with real aggregated org-level
    // distributions. Keep the gate above; only the response body changes.
    return NextResponse.json({});
  },
  { module: "org/insights" },
);

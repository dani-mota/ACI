/**
 * PRO-133: integration test for /api/org/insights stub endpoint.
 *
 * Closes Dani's 2026-05-07 guardrail #3: EXECUTIVE 403 on individual
 * endpoints needs a paired positive test confirming aggregated org
 * endpoints DO return data — otherwise EXECUTIVE looks broken.
 *
 * This test is the paired positive. The endpoint returns 200 with `{}`
 * in PR#1; PRO-145 will fill in the real aggregated body without
 * regressing the gate.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { invokeRoute } from "@/lib/__tests__/test-helpers/route-handler";
import {
  candidateOnlyUser,
  employeeOnlyUser,
  userWithRoles,
} from "@/lib/__tests__/test-helpers/fixtures";

vi.mock("@/lib/auth", () => ({
  getSession: vi.fn(),
  requireAuth: vi.fn(),
}));

import { getSession } from "@/lib/auth";
import { GET } from "@/app/api/org/insights/route";

describe("GET /api/org/insights — stub endpoint gate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(getSession).mockResolvedValue(null);
    const res = await invokeRoute(GET);
    expect(res.status).toBe(401);
  });

  // ─── PAIRED POSITIVE TESTS (Dani guardrail #3) ────────────────

  it("EXECUTIVE → 200 with `{}` body (the paired positive Dani required)", async () => {
    vi.mocked(getSession).mockResolvedValue(employeeOnlyUser("EXECUTIVE"));
    const res = await invokeRoute(GET);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({});
  });

  it("HR_TALENT_LEADER → 200 with `{}` body", async () => {
    vi.mocked(getSession).mockResolvedValue(employeeOnlyUser("HR_TALENT_LEADER"));
    const res = await invokeRoute(GET);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({});
  });

  it.each(["TA_LEADER", "ADMIN"] as const)(
    "%s (Candidate Mode admin) → 200 with `{}` body",
    async (role) => {
      vi.mocked(getSession).mockResolvedValue(candidateOnlyUser(role));
      const res = await invokeRoute(GET);
      expect(res.status).toBe(200);
    },
  );

  // ─── NEGATIVES ────────────────────────────────────────────────

  it.each([
    "EXTERNAL_COLLABORATOR",
    "RECRUITER_COORDINATOR",
    "RECRUITING_MANAGER",
    "HIRING_MANAGER",
  ] as const)("%s (Candidate Mode non-admin) → 403", async (role) => {
    vi.mocked(getSession).mockResolvedValue(candidateOnlyUser(role));
    const res = await invokeRoute(GET);
    expect(res.status).toBe(403);
  });

  it.each(["EMPLOYEE", "PEOPLE_MANAGER"] as const)(
    "%s (Employee Mode without HR/EXEC/admin) → 403",
    async (employeeRole) => {
      vi.mocked(getSession).mockResolvedValue(
        userWithRoles({ role: "EXTERNAL_COLLABORATOR", employeeRole }),
      );
      const res = await invokeRoute(GET);
      expect(res.status).toBe(403);
    },
  );
});

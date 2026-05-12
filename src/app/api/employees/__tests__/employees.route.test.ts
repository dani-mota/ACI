/**
 * PRO-133: integration test for /api/employees gate behavior.
 *
 * Closes Dani's 2026-05-07 guardrail #1: server-side enforcement
 * tested against the real route handler, not just helpers.
 *
 * Scope is gate-behavior only (status codes per role config). Full
 * data-flow / payload-shape tests are deferred to feature-specific
 * tickets that wire actual employee data through the response.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { invokeRoute } from "@/lib/__tests__/test-helpers/route-handler";
import {
  candidateOnlyUser,
  employeeOnlyUser,
  crossModeUser,
  userWithRoles,
} from "@/lib/__tests__/test-helpers/fixtures";

vi.mock("@/lib/auth", () => ({
  getSession: vi.fn(),
  requireAuth: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  default: {
    candidate: {
      findMany: vi.fn().mockResolvedValue([]),
    },
  },
}));

import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { GET } from "@/app/api/employees/route";

describe("GET /api/employees — gate behavior", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getSession).mockResolvedValue(null);
  });

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(getSession).mockResolvedValue(null);
    const res = await invokeRoute(GET);
    expect(res.status).toBe(401);
  });

  it.each([
    "EXTERNAL_COLLABORATOR",
    "RECRUITER_COORDINATOR",
    "RECRUITING_MANAGER",
  ] as const)(
    "%s (no employees-mode access) → 403",
    async (role) => {
      vi.mocked(getSession).mockResolvedValue(candidateOnlyUser(role));
      const res = await invokeRoute(GET);
      expect(res.status).toBe(403);
    },
  );

  it.each(["HIRING_MANAGER", "TA_LEADER", "ADMIN"] as const)(
    "%s (Candidate Mode admin) → 200, org-wide query (no scoping filter)",
    async (role) => {
      vi.mocked(getSession).mockResolvedValue(candidateOnlyUser(role));
      const res = await invokeRoute(GET);
      expect(res.status).toBe(200);
      // Org-wide viewers: where clause has no userId / managerId filter.
      const call = vi.mocked(prisma.candidate.findMany).mock.calls.at(-1)?.[0];
      expect(call?.where).not.toHaveProperty("userId");
      expect(call?.where).not.toHaveProperty("user");
    },
  );

  it("HR_TALENT_LEADER (Employee Mode) → 200, org-wide query", async () => {
    vi.mocked(getSession).mockResolvedValue(employeeOnlyUser("HR_TALENT_LEADER"));
    const res = await invokeRoute(GET);
    expect(res.status).toBe(200);
    const call = vi.mocked(prisma.candidate.findMany).mock.calls.at(-1)?.[0];
    expect(call?.where).not.toHaveProperty("userId");
    expect(call?.where).not.toHaveProperty("user");
  });

  // PR#2: EMPLOYEE and PEOPLE_MANAGER now get scoped 200s, not blanket 403s.
  it("EMPLOYEE → 200 with userId-scoped query (own dossier only)", async () => {
    vi.mocked(getSession).mockResolvedValue(
      userWithRoles({
        id: "user_emp_self",
        role: "EXTERNAL_COLLABORATOR",
        employeeRole: "EMPLOYEE",
      }),
    );
    const res = await invokeRoute(GET);
    expect(res.status).toBe(200);
    const call = vi.mocked(prisma.candidate.findMany).mock.calls.at(-1)?.[0];
    expect(call?.where).toMatchObject({ userId: "user_emp_self" });
  });

  it("PEOPLE_MANAGER → 200 with managerId-scoped query (direct reports only)", async () => {
    vi.mocked(getSession).mockResolvedValue(
      userWithRoles({
        id: "user_mgr_001",
        role: "EXTERNAL_COLLABORATOR",
        employeeRole: "PEOPLE_MANAGER",
      }),
    );
    const res = await invokeRoute(GET);
    expect(res.status).toBe(200);
    const call = vi.mocked(prisma.candidate.findMany).mock.calls.at(-1)?.[0];
    expect(call?.where).toMatchObject({ user: { managerId: "user_mgr_001" } });
  });

  it("EXECUTIVE → 403 (no individual-list access; aggregated only via /api/org/insights)", async () => {
    vi.mocked(getSession).mockResolvedValue(
      userWithRoles({
        id: "user_exec",
        role: "EXTERNAL_COLLABORATOR",
        employeeRole: "EXECUTIVE",
      }),
    );
    const res = await invokeRoute(GET);
    expect(res.status).toBe(403);
  });

  it("Cross-mode user (TA_LEADER + HR_TALENT_LEADER) → 200, org-wide query", async () => {
    vi.mocked(getSession).mockResolvedValue(crossModeUser());
    const res = await invokeRoute(GET);
    expect(res.status).toBe(200);
    const call = vi.mocked(prisma.candidate.findMany).mock.calls.at(-1)?.[0];
    expect(call?.where).not.toHaveProperty("userId");
  });

  it("Cross-mode EMPLOYEE + TA_LEADER → 200, org-wide query (admin bypasses self-scope)", async () => {
    // canViewAnyEmployee picks up TA_LEADER, so the scoping branch is skipped.
    vi.mocked(getSession).mockResolvedValue(
      userWithRoles({
        id: "user_ta_emp",
        role: "TA_LEADER",
        employeeRole: "EMPLOYEE",
      }),
    );
    const res = await invokeRoute(GET);
    expect(res.status).toBe(200);
    const call = vi.mocked(prisma.candidate.findMany).mock.calls.at(-1)?.[0];
    expect(call?.where).not.toHaveProperty("userId");
  });
});

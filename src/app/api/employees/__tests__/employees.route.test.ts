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
} from "@/lib/__tests__/test-helpers/fixtures";
import { PR2_PENDING_REASON } from "@/lib/employee-permissions";

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
      const body = await res.json();
      // Mode-level 403 — no PR2_PENDING_REASON
      expect(body.reason).toBeUndefined();
    },
  );

  it.each(["HIRING_MANAGER", "TA_LEADER", "ADMIN"] as const)(
    "%s (Candidate Mode admin) → 200",
    async (role) => {
      vi.mocked(getSession).mockResolvedValue(candidateOnlyUser(role));
      const res = await invokeRoute(GET);
      expect(res.status).toBe(200);
    },
  );

  it("HR_TALENT_LEADER (Employee Mode) → 200", async () => {
    vi.mocked(getSession).mockResolvedValue(employeeOnlyUser("HR_TALENT_LEADER"));
    const res = await invokeRoute(GET);
    expect(res.status).toBe(200);
  });

  it.each(["EMPLOYEE", "PEOPLE_MANAGER", "EXECUTIVE"] as const)(
    "%s (Employee Mode without HR/admin) → 403 with PR2_PENDING_REASON",
    async (employeeRole) => {
      // Pair with EXTERNAL_COLLABORATOR so Candidate Mode doesn't grant access.
      vi.mocked(getSession).mockResolvedValue({
        user: {
          id: "user_test",
          supabaseId: "supa_test",
          email: "test@example.com",
          name: "Test User",
          role: "EXTERNAL_COLLABORATOR",
          employeeRole,
          orgId: "org_test",
        },
      });
      const res = await invokeRoute(GET);
      // EMPLOYEE/PEOPLE_MANAGER hit canEnterEmployeeMode → true (Employee
      // Mode role grants), then canViewAnyEmployee → false → stub-403.
      // EXECUTIVE same path.
      // EXTERNAL_COLLABORATOR base role would 403 at mode-level, but
      // since employeeRole grants employees mode, we pass the mode gate
      // and hit the capability gate instead.
      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.reason).toBe(PR2_PENDING_REASON);
    },
  );

  it("Cross-mode user (TA_LEADER + HR_TALENT_LEADER) → 200", async () => {
    vi.mocked(getSession).mockResolvedValue(crossModeUser());
    const res = await invokeRoute(GET);
    expect(res.status).toBe(200);
  });
});

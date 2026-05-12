/**
 * PRO-184: integration tests for GET /api/team/[userId]/reports.
 *
 * Load-bearing invariants:
 *   - Single-hop guarantee: a grandmanager's reports query returns only
 *     their direct reports, NOT their reports' reports. A 3-level
 *     fixture asserts this explicitly.
 *   - PEOPLE_MANAGER may only request their own userId; a request for
 *     someone else's reports returns 403.
 *   - canManageTeam roles (ADMIN, TA_LEADER) may request any userId.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { invokeRoute } from "@/lib/__tests__/test-helpers/route-handler";
import { candidateOnlyUser, employeeOnlyUser } from "@/lib/__tests__/test-helpers/fixtures";

vi.mock("@/lib/auth", () => ({
  getSession: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  default: {
    user: { findMany: vi.fn() },
  },
}));

import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { GET } from "@/app/api/team/[userId]/reports/route";

const SESSION_ORG = "org_test_001";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/team/[userId]/reports", () => {
  it("returns direct reports for ADMIN querying any userId", async () => {
    vi.mocked(getSession).mockResolvedValue(
      candidateOnlyUser("ADMIN", { id: "user_admin_001", orgId: SESSION_ORG })
    );
    vi.mocked(prisma.user.findMany).mockResolvedValue([
      { id: "ic_1", name: "IC One", email: "ic1@example.com", role: "RECRUITING_MANAGER", isActive: true },
    ] as unknown as Awaited<ReturnType<typeof prisma.user.findMany>>);

    const res = await invokeRoute(GET, {
      method: "GET",
      params: { userId: "user_manager_001" },
    });
    expect(res.status).toBe(200);
    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          managerId: "user_manager_001",
          orgId: SESSION_ORG,
        }),
      })
    );
  });

  it("preserves single-hop: only direct reports, not transitive reports", async () => {
    // Fixture: grandmanager → manager → IC. Querying grandmanager's
    // reports must return ONLY manager, not the IC.
    vi.mocked(getSession).mockResolvedValue(
      candidateOnlyUser("ADMIN", { id: "user_admin_001", orgId: SESSION_ORG })
    );
    const allUsers = [
      { id: "manager", name: "Manager", email: "manager@example.com", role: "TA_LEADER", isActive: true, managerId: "grandmanager", orgId: SESSION_ORG },
      { id: "ic", name: "IC", email: "ic@example.com", role: "RECRUITING_MANAGER", isActive: true, managerId: "manager", orgId: SESSION_ORG },
    ];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (prisma.user.findMany as any).mockImplementation(async (args: { where: { managerId: string } }) => {
      return allUsers.filter((u) => u.managerId === args.where.managerId);
    });

    const res = await invokeRoute(GET, {
      method: "GET",
      params: { userId: "grandmanager" },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    // Manager is in the results; IC is not (IC's managerId is "manager",
    // not "grandmanager" — the flat findMany excludes them).
    expect(body.reports).toHaveLength(1);
    expect(body.reports[0].id).toBe("manager");
  });

  it("403 when PEOPLE_MANAGER queries someone else's reports", async () => {
    vi.mocked(getSession).mockResolvedValue(
      employeeOnlyUser("PEOPLE_MANAGER", { id: "user_pm_001", orgId: SESSION_ORG })
    );
    const res = await invokeRoute(GET, {
      method: "GET",
      params: { userId: "user_other_999" },
    });
    expect(res.status).toBe(403);
    expect(prisma.user.findMany).not.toHaveBeenCalled();
  });

  it("PEOPLE_MANAGER can query own reports", async () => {
    vi.mocked(getSession).mockResolvedValue(
      employeeOnlyUser("PEOPLE_MANAGER", { id: "user_pm_001", orgId: SESSION_ORG })
    );
    vi.mocked(prisma.user.findMany).mockResolvedValue([] as unknown as Awaited<ReturnType<typeof prisma.user.findMany>>);
    const res = await invokeRoute(GET, {
      method: "GET",
      params: { userId: "user_pm_001" },
    });
    expect(res.status).toBe(200);
  });

  it("401 when no session", async () => {
    vi.mocked(getSession).mockResolvedValue(null);
    const res = await invokeRoute(GET, {
      method: "GET",
      params: { userId: "user_pm_001" },
    });
    expect(res.status).toBe(401);
  });
});

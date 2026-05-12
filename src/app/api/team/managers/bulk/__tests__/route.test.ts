/**
 * PRO-184: integration tests for PATCH /api/team/managers/bulk.
 *
 * Load-bearing invariants:
 *   - Atomicity: any single validation failure rejects the whole batch
 *     (no partial writes).
 *   - Same-org constraint: cross-org targets or managers → 400/404.
 *   - RBAC: canManageTeam roles only.
 *   - Audit trail: one ActivityLog row per affected user, all sharing
 *     a single bulkOperationId UUID.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { invokeRoute } from "@/lib/__tests__/test-helpers/route-handler";
import { candidateOnlyUser } from "@/lib/__tests__/test-helpers/fixtures";

vi.mock("@/lib/auth", () => ({
  getSession: vi.fn(),
}));

const txMock = {
  user: { update: vi.fn() },
  activityLog: { create: vi.fn() },
};

vi.mock("@/lib/prisma", () => ({
  default: {
    user: { findMany: vi.fn() },
    $transaction: vi.fn(async (cb: (tx: typeof txMock) => Promise<unknown>) => cb(txMock)),
  },
}));

import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { PATCH } from "@/app/api/team/managers/bulk/route";

const SESSION_ORG = "org_test_001";

function setupAdminSession() {
  vi.mocked(getSession).mockResolvedValue(
    candidateOnlyUser("ADMIN", { id: "user_admin_001", orgId: SESSION_ORG })
  );
}

// Both findMany calls in the route can be satisfied from a single
// stubbed implementation that pattern-matches on the `where.id.in`
// shape and returns the appropriate slice of fixture data.
function setupUsers(
  targets: Array<{ id: string; orgId?: string; role?: string; managerId?: string | null }>,
  managers: Array<{ id: string; orgId?: string; isActive?: boolean; role?: string }>
) {
  const targetRecords = targets.map((t) => ({
    id: t.id,
    email: `${t.id}@example.com`,
    orgId: t.orgId ?? SESSION_ORG,
    role: t.role ?? "RECRUITING_MANAGER",
    managerId: t.managerId ?? null,
  }));
  const managerRecords = managers.map((m) => ({
    id: m.id,
    orgId: m.orgId ?? SESSION_ORG,
    isActive: m.isActive ?? true,
    role: m.role ?? "TA_LEADER",
  }));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (prisma.user.findMany as any).mockImplementation(async (args: { where: { id: { in: string[] } } }) => {
    const ids = args.where.id.in;
    const targetHits = targetRecords.filter((r) => ids.includes(r.id));
    if (targetHits.length > 0) return targetHits;
    return managerRecords.filter((r) => ids.includes(r.id));
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  txMock.user.update.mockResolvedValue({});
  txMock.activityLog.create.mockResolvedValue({});
});

describe("PATCH /api/team/managers/bulk", () => {
  it("writes N user updates + N audit log rows sharing one bulkOperationId", async () => {
    setupAdminSession();
    setupUsers(
      [{ id: "u1" }, { id: "u2" }],
      [{ id: "m1" }]
    );
    const res = await invokeRoute(PATCH, {
      method: "PATCH",
      body: {
        assignments: [
          { userId: "u1", managerId: "m1" },
          { userId: "u2", managerId: "m1" },
        ],
      },
    });
    expect(res.status).toBe(200);
    expect(txMock.user.update).toHaveBeenCalledTimes(2);
    expect(txMock.activityLog.create).toHaveBeenCalledTimes(2);
    const ids = txMock.activityLog.create.mock.calls.map(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (c: any[]) => c[0].data.metadata.bulkOperationId
    );
    expect(ids[0]).toBeTruthy();
    expect(ids[0]).toBe(ids[1]);
  });

  it("rolls back atomically when one target is cross-org", async () => {
    setupAdminSession();
    setupUsers(
      [
        { id: "u1" },
        { id: "u2", orgId: "org_other_999" },
      ],
      [{ id: "m1" }]
    );
    const res = await invokeRoute(PATCH, {
      method: "PATCH",
      body: {
        assignments: [
          { userId: "u1", managerId: "m1" },
          { userId: "u2", managerId: "m1" },
        ],
      },
    });
    expect(res.status).toBe(404);
    // Pre-flight validation failed → transaction never ran.
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(txMock.user.update).not.toHaveBeenCalled();
  });

  it("rejects self-as-manager in any assignment", async () => {
    setupAdminSession();
    setupUsers([{ id: "u1" }], []);
    const res = await invokeRoute(PATCH, {
      method: "PATCH",
      body: { assignments: [{ userId: "u1", managerId: "u1" }] },
    });
    expect(res.status).toBe(400);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("forbids non-team-management roles", async () => {
    vi.mocked(getSession).mockResolvedValue(
      candidateOnlyUser("RECRUITER_COORDINATOR", { id: "user_other_001", orgId: SESSION_ORG })
    );
    const res = await invokeRoute(PATCH, {
      method: "PATCH",
      body: { assignments: [{ userId: "u1", managerId: "m1" }] },
    });
    expect(res.status).toBe(403);
  });

  it("rejects empty assignments array", async () => {
    setupAdminSession();
    const res = await invokeRoute(PATCH, {
      method: "PATCH",
      body: { assignments: [] },
    });
    expect(res.status).toBe(400);
  });
});

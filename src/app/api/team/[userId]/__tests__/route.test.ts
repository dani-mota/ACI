/**
 * PRO-184: integration tests for the managerId path through
 * PATCH /api/team/[userId]. The existing role/active paths are
 * covered by their original tests (PRO-133 PR#1 baseline); this file
 * only exercises the new managerId behavior + its specific guards.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { invokeRoute } from "@/lib/__tests__/test-helpers/route-handler";
import { candidateOnlyUser } from "@/lib/__tests__/test-helpers/fixtures";

vi.mock("@/lib/auth", () => ({
  getSession: vi.fn(),
  requireAuth: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  default: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    activityLog: {
      create: vi.fn(),
    },
  },
}));

vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdmin: vi.fn(),
}));

import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { PATCH } from "@/app/api/team/[userId]/route";

const SESSION_ORG = "org_test_001";
const TARGET_ID = "user_target_001";
const MANAGER_ID = "user_manager_001";

function setupAdminSession() {
  vi.mocked(getSession).mockResolvedValue(
    candidateOnlyUser("ADMIN", { id: "user_admin_001", orgId: SESSION_ORG })
  );
}

function setupTarget(overrides: Partial<{ orgId: string; role: string; managerId: string | null }> = {}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (prisma.user.findUnique as any).mockImplementation(async (args: { where: { id: string } }) => {
    if (args.where.id === TARGET_ID) {
      return {
        id: TARGET_ID,
        email: "target@example.com",
        orgId: overrides.orgId ?? SESSION_ORG,
        role: overrides.role ?? "RECRUITING_MANAGER",
        managerId: overrides.managerId ?? null,
        isActive: true,
      } as unknown as Awaited<ReturnType<typeof prisma.user.findUnique>>;
    }
    if (args.where.id === MANAGER_ID) {
      return {
        id: MANAGER_ID,
        orgId: SESSION_ORG,
        isActive: true,
        role: "TA_LEADER",
      } as unknown as Awaited<ReturnType<typeof prisma.user.findUnique>>;
    }
    return null;
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.user.update).mockResolvedValue({
    id: TARGET_ID,
    name: "Target",
    email: "target@example.com",
    role: "RECRUITING_MANAGER",
    isActive: true,
  } as unknown as Awaited<ReturnType<typeof prisma.user.update>>);
  vi.mocked(prisma.activityLog.create).mockResolvedValue(
    {} as unknown as Awaited<ReturnType<typeof prisma.activityLog.create>>
  );
});

describe("PATCH /api/team/[userId] — managerId path", () => {
  it("accepts a valid managerId and logs MANAGER_CHANGED", async () => {
    setupAdminSession();
    setupTarget();
    const res = await invokeRoute(PATCH, {
      method: "PATCH",
      params: { userId: TARGET_ID },
      body: { managerId: MANAGER_ID },
    });
    expect(res.status).toBe(200);
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { managerId: MANAGER_ID } })
    );
    expect(prisma.activityLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "MANAGER_CHANGED",
          metadata: expect.objectContaining({
            oldManagerId: null,
            newManagerId: MANAGER_ID,
            bulkOperationId: null,
          }),
        }),
      })
    );
  });

  it("accepts managerId: null (explicit unassign)", async () => {
    setupAdminSession();
    setupTarget({ managerId: MANAGER_ID });
    const res = await invokeRoute(PATCH, {
      method: "PATCH",
      params: { userId: TARGET_ID },
      body: { managerId: null },
    });
    expect(res.status).toBe(200);
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { managerId: null } })
    );
  });

  it("rejects self-as-manager", async () => {
    setupAdminSession();
    setupTarget();
    const res = await invokeRoute(PATCH, {
      method: "PATCH",
      params: { userId: TARGET_ID },
      body: { managerId: TARGET_ID },
    });
    expect(res.status).toBe(400);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("rejects cross-org manager", async () => {
    setupAdminSession();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (prisma.user.findUnique as any).mockImplementation(async (args: { where: { id: string } }) => {
      if (args.where.id === TARGET_ID) {
        return {
          id: TARGET_ID,
          email: "target@example.com",
          orgId: SESSION_ORG,
          role: "RECRUITING_MANAGER",
          managerId: null,
          isActive: true,
        } as unknown as Awaited<ReturnType<typeof prisma.user.findUnique>>;
      }
      if (args.where.id === MANAGER_ID) {
        return {
          id: MANAGER_ID,
          orgId: "org_other_999",
          isActive: true,
          role: "TA_LEADER",
        } as unknown as Awaited<ReturnType<typeof prisma.user.findUnique>>;
      }
      return null;
    });
    const res = await invokeRoute(PATCH, {
      method: "PATCH",
      params: { userId: TARGET_ID },
      body: { managerId: MANAGER_ID },
    });
    expect(res.status).toBe(400);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("rejects EXTERNAL_COLLABORATOR as manager", async () => {
    setupAdminSession();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (prisma.user.findUnique as any).mockImplementation(async (args: { where: { id: string } }) => {
      if (args.where.id === TARGET_ID) {
        return {
          id: TARGET_ID,
          email: "target@example.com",
          orgId: SESSION_ORG,
          role: "RECRUITING_MANAGER",
          managerId: null,
          isActive: true,
        } as unknown as Awaited<ReturnType<typeof prisma.user.findUnique>>;
      }
      return {
        id: MANAGER_ID,
        orgId: SESSION_ORG,
        isActive: true,
        role: "EXTERNAL_COLLABORATOR",
      } as unknown as Awaited<ReturnType<typeof prisma.user.findUnique>>;
    });
    const res = await invokeRoute(PATCH, {
      method: "PATCH",
      params: { userId: TARGET_ID },
      body: { managerId: MANAGER_ID },
    });
    expect(res.status).toBe(400);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("forbids non-team-management roles", async () => {
    vi.mocked(getSession).mockResolvedValue(
      candidateOnlyUser("RECRUITER_COORDINATOR", { id: "user_other_001", orgId: SESSION_ORG })
    );
    const res = await invokeRoute(PATCH, {
      method: "PATCH",
      params: { userId: TARGET_ID },
      body: { managerId: MANAGER_ID },
    });
    expect(res.status).toBe(403);
  });
});

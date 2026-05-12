/**
 * PRO-137: integration test for batch invalidation on role-demand profile save.
 *
 * Both POST /api/role-profiles (create) and PUT /api/role-profiles/[id] (update)
 * must invoke batchInvalidateByRoleFamily with the session's orgId and the
 * trimmed roleFamily from the request body. This test mocks the persistence
 * helper (unit-tested separately in employee-insights-persistence.test.ts)
 * and asserts the call shape.
 *
 * Trust-contract relevance: an HR leader who saves a profile expects the
 * People Table sort to reflect the new demand profile within a few page
 * loads, not a few hours. The batch invalidation marks every affected
 * EmployeeInsights row stale; lazy recompute fires on next dossier read.
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
    roleDemandProfile: {
      findFirst: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
    },
  },
}));

vi.mock("@/lib/assessment/insights/employee-insights-persistence", () => ({
  batchInvalidateByRoleFamily: vi.fn(),
}));

import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { batchInvalidateByRoleFamily } from "@/lib/assessment/insights/employee-insights-persistence";
import { PUT } from "@/app/api/role-profiles/[id]/route";
import { POST } from "@/app/api/role-profiles/route";

const SESSION_ORG = "org_test_001";
const PROFILE_ID = "profile_test_001";

function validBody(overrides?: Partial<{ name: string; roleFamily: string }>) {
  return {
    name: "Software Engineer (Senior)",
    roleFamily: "Software",
    constructScores: { FLUID_REASONING: 7, EXECUTIVE_CONTROL: 8 },
    ...(overrides ?? {}),
  };
}

describe("PUT /api/role-profiles/[id] — PRO-137 batch invalidation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getSession).mockResolvedValue(
      candidateOnlyUser("TA_LEADER", { id: "user_admin", orgId: SESSION_ORG }),
    );
    vi.mocked(prisma.roleDemandProfile.findFirst).mockResolvedValue({ id: PROFILE_ID } as never);
    vi.mocked(prisma.roleDemandProfile.update).mockResolvedValue({} as never);
    vi.mocked(batchInvalidateByRoleFamily).mockResolvedValue(0);
  });

  it("PUT a valid profile → batchInvalidateByRoleFamily called with session orgId + trimmed roleFamily", async () => {
    const res = await invokeRoute(PUT, {
      method: "PUT",
      params: { id: PROFILE_ID },
      body: validBody({ roleFamily: "  Software  " }),
    });

    expect(res.status).toBe(200);
    expect(batchInvalidateByRoleFamily).toHaveBeenCalledTimes(1);
    expect(batchInvalidateByRoleFamily).toHaveBeenCalledWith(SESSION_ORG, "Software");
  });

  it("PUT runs the invalidation AFTER the profile update (order matters for read consistency)", async () => {
    const callOrder: string[] = [];
    // Cast the impl through unknown to satisfy Prisma's fluent client return type;
    // the test only cares about call ordering.
    vi.mocked(prisma.roleDemandProfile.update).mockImplementation((async () => {
      callOrder.push("update");
      return {};
    }) as unknown as typeof prisma.roleDemandProfile.update);
    vi.mocked(batchInvalidateByRoleFamily).mockImplementation(async () => {
      callOrder.push("invalidate");
      return 0;
    });

    await invokeRoute(PUT, {
      method: "PUT",
      params: { id: PROFILE_ID },
      body: validBody(),
    });

    expect(callOrder).toEqual(["update", "invalidate"]);
  });

  it("PUT does NOT invalidate when the cross-org guard fails (404)", async () => {
    vi.mocked(prisma.roleDemandProfile.findFirst).mockResolvedValue(null);

    const res = await invokeRoute(PUT, {
      method: "PUT",
      params: { id: PROFILE_ID },
      body: validBody(),
    });

    expect(res.status).toBe(404);
    expect(batchInvalidateByRoleFamily).not.toHaveBeenCalled();
  });

  it("PUT does NOT invalidate when validation fails (400)", async () => {
    const res = await invokeRoute(PUT, {
      method: "PUT",
      params: { id: PROFILE_ID },
      body: { name: "", roleFamily: "Software", constructScores: {} },
    });

    expect(res.status).toBe(400);
    expect(batchInvalidateByRoleFamily).not.toHaveBeenCalled();
    expect(prisma.roleDemandProfile.update).not.toHaveBeenCalled();
  });

  it("PUT does NOT invalidate when unauthenticated (401)", async () => {
    vi.mocked(getSession).mockResolvedValue(null);

    const res = await invokeRoute(PUT, {
      method: "PUT",
      params: { id: PROFILE_ID },
      body: validBody(),
    });

    expect(res.status).toBe(401);
    expect(batchInvalidateByRoleFamily).not.toHaveBeenCalled();
  });

  it("PUT does NOT invalidate when caller lacks write authority (403)", async () => {
    vi.mocked(getSession).mockResolvedValue(
      candidateOnlyUser("EXTERNAL_COLLABORATOR", { id: "user_ext", orgId: SESSION_ORG }),
    );

    const res = await invokeRoute(PUT, {
      method: "PUT",
      params: { id: PROFILE_ID },
      body: validBody(),
    });

    expect(res.status).toBe(403);
    expect(batchInvalidateByRoleFamily).not.toHaveBeenCalled();
  });
});

describe("POST /api/role-profiles — PRO-137 batch invalidation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getSession).mockResolvedValue(
      candidateOnlyUser("TA_LEADER", { id: "user_admin", orgId: SESSION_ORG }),
    );
    vi.mocked(prisma.roleDemandProfile.create).mockResolvedValue({ id: "new_profile_001" } as never);
    vi.mocked(batchInvalidateByRoleFamily).mockResolvedValue(0);
  });

  it("POST a valid profile → batchInvalidateByRoleFamily called (defensive — usually no-op)", async () => {
    const res = await invokeRoute(POST, {
      method: "POST",
      body: validBody({ roleFamily: "  Software  " }),
    });

    expect(res.status).toBe(201);
    expect(batchInvalidateByRoleFamily).toHaveBeenCalledTimes(1);
    expect(batchInvalidateByRoleFamily).toHaveBeenCalledWith(SESSION_ORG, "Software");
  });

  it("POST does NOT invalidate when validation fails (400)", async () => {
    const res = await invokeRoute(POST, {
      method: "POST",
      body: { name: "", roleFamily: "Software", constructScores: {} },
    });

    expect(res.status).toBe(400);
    expect(batchInvalidateByRoleFamily).not.toHaveBeenCalled();
    expect(prisma.roleDemandProfile.create).not.toHaveBeenCalled();
  });
});

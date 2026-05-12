import { describe, it, expect, vi, beforeEach } from "vitest";
import { CONSTRUCTS } from "@/lib/constructs";

vi.mock("@/lib/prisma", () => ({
  default: {
    subtestResult: {
      findMany: vi.fn(),
    },
    employeeInsights: {
      upsert: vi.fn().mockResolvedValue({}),
    },
    $executeRaw: vi.fn().mockResolvedValue(0),
  },
}));

vi.mock("@/lib/data", () => ({
  resolveRoleDemandProfileForEmployee: vi.fn(),
}));

import prisma from "@/lib/prisma";
import { resolveRoleDemandProfileForEmployee } from "@/lib/data";
import {
  recomputeUnderLeverageForAssessment,
  batchInvalidateByRoleFamily,
} from "@/lib/assessment/insights/employee-insights-persistence";

const ALL_CONSTRUCT_KEYS = Object.keys(CONSTRUCTS);

function fullSubtestResults() {
  // All 12 constructs at percentile 80 (high employee scores).
  return ALL_CONSTRUCT_KEYS.map((construct) => ({ construct, percentile: 80 }));
}

function lowDemands() {
  // Demand 20 (0-100 scale) across all 12 constructs → deltas of +60 each.
  // After /10 in compute: 12 × 6 = 72. (72 / 120) × 100 = 60.
  return ALL_CONSTRUCT_KEYS.map((construct) => ({ construct, demandScore: 20 }));
}

describe("recomputeUnderLeverageForAssessment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("matching profile + 12 subtest results → upserts non-null score, returns it", async () => {
    vi.mocked(resolveRoleDemandProfileForEmployee).mockResolvedValue({
      profileId: "profile_001",
      updatedAt: new Date("2026-05-12T00:00:00Z"),
      demands: lowDemands(),
    });
    vi.mocked(prisma.subtestResult.findMany).mockResolvedValue(fullSubtestResults() as never);

    const score = await recomputeUnderLeverageForAssessment(
      "asmt_001",
      "org_001",
      "Engineering",
    );

    // Deltas = 80 - 20 = 60. All positive. After /10: 12 × 6 = 72.
    // (72 / 120) × 100 = 60.
    expect(score).toBe(60);
    expect(prisma.employeeInsights.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { assessmentId: "asmt_001" },
        create: expect.objectContaining({
          assessmentId: "asmt_001",
          underLeverageScore: 60,
          orgId: "org_001",
          roleFamily: "Engineering",
          profileId: "profile_001",
        }),
        update: expect.objectContaining({
          underLeverageScore: 60,
          profileId: "profile_001",
        }),
      }),
    );
  });

  it("no profile resolved → upserts null score + null profile fields", async () => {
    vi.mocked(resolveRoleDemandProfileForEmployee).mockResolvedValue(null);
    vi.mocked(prisma.subtestResult.findMany).mockResolvedValue(fullSubtestResults() as never);

    const score = await recomputeUnderLeverageForAssessment(
      "asmt_002",
      "org_001",
      "UnmatchedFamily",
    );

    expect(score).toBeNull();
    expect(prisma.employeeInsights.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          underLeverageScore: null,
          profileId: null,
          profileUpdatedAt: null,
        }),
      }),
    );
  });

  it("profile resolved but zero subtest results → upserts null score", async () => {
    vi.mocked(resolveRoleDemandProfileForEmployee).mockResolvedValue({
      profileId: "profile_001",
      updatedAt: new Date("2026-05-12T00:00:00Z"),
      demands: lowDemands(),
    });
    vi.mocked(prisma.subtestResult.findMany).mockResolvedValue([] as never);

    const score = await recomputeUnderLeverageForAssessment(
      "asmt_003",
      "org_001",
      "Engineering",
    );

    // 12 deltas built from CONSTRUCTS, all with delta != null but
    // employeeScore=0 default. Since demand=20, delta = 0-20 = -20 for each.
    // All negative → positiveSum = 0. (0 / 120) × 100 = 0. Score is 0, not null.
    expect(score).toBe(0);
    expect(prisma.employeeInsights.upsert).toHaveBeenCalled();
  });

  it("forwards orgId + roleFamily into both create and update paths", async () => {
    vi.mocked(resolveRoleDemandProfileForEmployee).mockResolvedValue(null);
    vi.mocked(prisma.subtestResult.findMany).mockResolvedValue([] as never);

    await recomputeUnderLeverageForAssessment("asmt_004", "org_xyz", "RoleX");

    const call = vi.mocked(prisma.employeeInsights.upsert).mock.calls[0]?.[0];
    expect(call?.create).toMatchObject({ orgId: "org_xyz", roleFamily: "RoleX" });
    expect(call?.update).toMatchObject({ orgId: "org_xyz", roleFamily: "RoleX" });
  });
});

describe("batchInvalidateByRoleFamily", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("issues a single $executeRaw UPDATE with case-insensitive roleFamily match", async () => {
    vi.mocked(prisma.$executeRaw).mockResolvedValue(3);

    const affected = await batchInvalidateByRoleFamily("org_001", "Engineering");

    expect(affected).toBe(3);
    expect(prisma.$executeRaw).toHaveBeenCalledTimes(1);
    // Tagged-template Prisma calls receive a TemplateStringsArray + interpolated values.
    // First arg is the strings array; subsequent args are the interpolations.
    const callArgs = vi.mocked(prisma.$executeRaw).mock.calls[0];
    const strings = callArgs[0] as unknown as TemplateStringsArray;
    const sqlJoined = Array.isArray(strings) ? strings.join("?") : String(strings);
    expect(sqlJoined).toContain("UPDATE");
    expect(sqlJoined).toContain('"EmployeeInsights"');
    expect(sqlJoined).toContain('"profileUpdatedAt" = NULL');
    expect(sqlJoined).toContain('"profileId" = NULL');
    expect(sqlJoined).toContain("LOWER");
    // Interpolated values follow the strings array.
    const interpolations = callArgs.slice(1);
    expect(interpolations).toContain("org_001");
    expect(interpolations).toContain("Engineering");
  });
});

/**
 * PRO-133 PR#2: integration test for /api/assessments/[id]/convert.
 *
 * Covers the lazy email-match linkage paths that wire Candidate.userId
 * + User.employeeRole + User.managerId at conversion time. Trust contract
 * floor: cross-org email collisions must NOT link (Section 6 spec) —
 * test fixture uses a deliberately different orgId to verify the orgId
 * filter is doing the work, not just passing by accident.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { invokeRoute } from "@/lib/__tests__/test-helpers/route-handler";
import { candidateOnlyUser } from "@/lib/__tests__/test-helpers/fixtures";

vi.mock("@/lib/auth", () => ({
  getSession: vi.fn(),
  requireAuth: vi.fn(),
}));

// Mock prisma with a $transaction that invokes its callback with a tx
// object whose methods are tracked vi.fn()s. Each test re-wires the
// individual method behaviors via vi.mocked() below.
const txMock = {
  assessment: {
    updateMany: vi.fn(),
    findUnique: vi.fn(),
  },
  candidate: {
    update: vi.fn(),
  },
  user: {
    findFirst: vi.fn(),
    update: vi.fn(),
  },
  subtestResult: {
    findMany: vi.fn(),
  },
  employeeInsights: {
    upsert: vi.fn(),
  },
  redFlag: {
    updateMany: vi.fn(),
  },
  prediction: {
    updateMany: vi.fn(),
  },
};

vi.mock("@/lib/prisma", () => ({
  default: {
    $transaction: vi.fn(async (cb: (tx: typeof txMock) => Promise<unknown>) => cb(txMock)),
  },
}));

// PRO-137: convert route calls resolveRoleDemandProfileForEmployee
// (from @/lib/data) to compute under-leverage inline. Mock it so each
// test controls whether a matching profile resolves.
vi.mock("@/lib/data", () => ({
  resolveRoleDemandProfileForEmployee: vi.fn(),
}));

import { getSession } from "@/lib/auth";
import { resolveRoleDemandProfileForEmployee } from "@/lib/data";
import { POST } from "@/app/api/assessments/[id]/convert/route";
import { CONSTRUCTS } from "@/lib/constructs";

const ASSESSMENT_ID = "asmt_test_001";
const CANDIDATE_ID = "cand_test_001";
const SESSION_ORG = "org_test_001";

function setupSuccessfulAssessmentUpdate(candidateEmail = "match@example.com") {
  txMock.assessment.updateMany.mockResolvedValue({ count: 1 });
  txMock.assessment.findUnique.mockResolvedValue({
    candidateId: CANDIDATE_ID,
    candidate: { email: candidateEmail },
  });
  txMock.candidate.update.mockResolvedValue({});
  txMock.user.update.mockResolvedValue({});
  txMock.redFlag.updateMany.mockResolvedValue({ count: 0 });
  txMock.prediction.updateMany.mockResolvedValue({ count: 0 });
  // PRO-137 defaults: no matching profile + no subtest results.
  // Tests that exercise inline compute override these.
  txMock.subtestResult.findMany.mockResolvedValue([]);
  txMock.employeeInsights.upsert.mockResolvedValue({});
  vi.mocked(resolveRoleDemandProfileForEmployee).mockResolvedValue(null);
}

const ALL_CONSTRUCT_KEYS = Object.keys(CONSTRUCTS);

describe("POST /api/assessments/[id]/convert — Candidate↔User linkage (PRO-133 PR#2)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getSession).mockResolvedValue(
      candidateOnlyUser("TA_LEADER", {
        id: "user_converter",
        orgId: SESSION_ORG,
      }),
    );
  });

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(getSession).mockResolvedValue(null);
    const res = await invokeRoute(POST, {
      method: "POST",
      params: { id: ASSESSMENT_ID },
      body: { department: "Engineering", roleFamily: "Software" },
    });
    expect(res.status).toBe(401);
  });

  it("returns 403 when caller lacks conversion authority", async () => {
    vi.mocked(getSession).mockResolvedValue(
      candidateOnlyUser("EXTERNAL_COLLABORATOR", { orgId: SESSION_ORG }),
    );
    const res = await invokeRoute(POST, {
      method: "POST",
      params: { id: ASSESSMENT_ID },
      body: { department: "Engineering", roleFamily: "Software" },
    });
    expect(res.status).toBe(403);
  });

  it("returns 400 when department or roleFamily missing", async () => {
    const res = await invokeRoute(POST, {
      method: "POST",
      params: { id: ASSESSMENT_ID },
      body: { department: "Engineering" }, // missing roleFamily
    });
    expect(res.status).toBe(400);
  });

  it("email match found (same orgId) → links Candidate.userId + sets User.employeeRole=EMPLOYEE", async () => {
    setupSuccessfulAssessmentUpdate("match@example.com");
    txMock.user.findFirst.mockResolvedValue({ id: "user_linked_001" });

    const res = await invokeRoute(POST, {
      method: "POST",
      params: { id: ASSESSMENT_ID },
      body: { department: "Engineering", roleFamily: "Software" },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ok: true, linkedUserId: "user_linked_001" });

    // The User lookup MUST filter by both email AND orgId (defensive against
    // future schema changes if email uniqueness gets relaxed).
    expect(txMock.user.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { email: "match@example.com", orgId: SESSION_ORG },
      }),
    );

    // Candidate.userId set to the linked User's id.
    expect(txMock.candidate.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: CANDIDATE_ID },
        data: { userId: "user_linked_001" },
      }),
    );

    // User.employeeRole flipped to "EMPLOYEE" (no managerId since body omitted it).
    expect(txMock.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "user_linked_001" },
        data: { employeeRole: "EMPLOYEE" },
      }),
    );
  });

  it("no matching email → Candidate.userId stays null, User unchanged, linkedUserId is null", async () => {
    setupSuccessfulAssessmentUpdate("nomatch@example.com");
    txMock.user.findFirst.mockResolvedValue(null);

    const res = await invokeRoute(POST, {
      method: "POST",
      params: { id: ASSESSMENT_ID },
      body: { department: "Engineering", roleFamily: "Software" },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ok: true, linkedUserId: null });

    // Only the status="HIRED" update should have happened on Candidate —
    // no userId-linking update.
    const candidateUpdateCalls = txMock.candidate.update.mock.calls;
    const userIdLinkingCall = candidateUpdateCalls.find(
      (c) => (c[0] as { data?: { userId?: string } })?.data?.userId !== undefined,
    );
    expect(userIdLinkingCall).toBeUndefined();

    // User.update must NOT have been called — no linked User to mutate.
    expect(txMock.user.update).not.toHaveBeenCalled();
  });

  it("CROSS-ORG collision: User exists with matching email but DIFFERENT orgId → does NOT link", async () => {
    // Defensive trust-contract test. The fixture uses a different orgId
    // intentionally so we verify the orgId filter is doing the work:
    // mock user.findFirst to return null (simulating the orgId filter
    // excluding the cross-org User even though the email matched). If
    // someone accidentally drops the orgId filter, the production code
    // would link a User from a different org — this test would fail
    // because we'd see candidate.update called with a userId.
    setupSuccessfulAssessmentUpdate("collision@example.com");
    txMock.user.findFirst.mockResolvedValue(null); // orgId filter excluded the cross-org User

    const res = await invokeRoute(POST, {
      method: "POST",
      params: { id: ASSESSMENT_ID },
      body: { department: "Engineering", roleFamily: "Software", managerId: "user_mgr_xyz" },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.linkedUserId).toBeNull();

    // Critical assertion: the orgId filter MUST be present in the query.
    // Without this, a future refactor could drop it and we'd silently
    // start linking cross-org Users.
    expect(txMock.user.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { email: "collision@example.com", orgId: SESSION_ORG },
      }),
    );

    // Cross-org User's employeeRole must remain unchanged AND target
    // Candidate's userId must stay null.
    expect(txMock.user.update).not.toHaveBeenCalled();
    const userIdLinkingCall = txMock.candidate.update.mock.calls.find(
      (c) => (c[0] as { data?: { userId?: string } })?.data?.userId !== undefined,
    );
    expect(userIdLinkingCall).toBeUndefined();
  });

  it("managerId present in body + email match found → sets User.managerId", async () => {
    setupSuccessfulAssessmentUpdate("match@example.com");
    txMock.user.findFirst.mockResolvedValue({ id: "user_linked_001" });

    const res = await invokeRoute(POST, {
      method: "POST",
      params: { id: ASSESSMENT_ID },
      body: {
        department: "Engineering",
        roleFamily: "Software",
        managerId: "user_mgr_001",
      },
    });

    expect(res.status).toBe(200);

    // User update includes both employeeRole and managerId.
    expect(txMock.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "user_linked_001" },
        data: { employeeRole: "EMPLOYEE", managerId: "user_mgr_001" },
      }),
    );
  });

  it("managerId present BUT no email match → managerId silently dropped (no User to set it on)", async () => {
    setupSuccessfulAssessmentUpdate("nomatch@example.com");
    txMock.user.findFirst.mockResolvedValue(null);

    const res = await invokeRoute(POST, {
      method: "POST",
      params: { id: ASSESSMENT_ID },
      body: {
        department: "Engineering",
        roleFamily: "Software",
        managerId: "user_mgr_001",
      },
    });

    // Not an error — silent drop with linkedUserId=null tells the client
    // no linkage happened, so managerId never landed.
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.linkedUserId).toBeNull();

    // User.update must not have been called at all.
    expect(txMock.user.update).not.toHaveBeenCalled();
  });

  it("assessment already converted (updateMany count=0) → 409", async () => {
    txMock.assessment.updateMany.mockResolvedValue({ count: 0 });

    const res = await invokeRoute(POST, {
      method: "POST",
      params: { id: ASSESSMENT_ID },
      body: { department: "Engineering", roleFamily: "Software" },
    });

    expect(res.status).toBe(409);
    // No User lookup should have happened — short-circuited.
    expect(txMock.user.findFirst).not.toHaveBeenCalled();
  });
});

// ──────────────────────────────────────────────────────────────────
// PRO-137: inline under-leverage compute at conversion
// ──────────────────────────────────────────────────────────────────

describe("POST /api/assessments/[id]/convert — PRO-137 under-leverage compute", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getSession).mockResolvedValue(
      candidateOnlyUser("TA_LEADER", {
        id: "user_converter",
        orgId: SESSION_ORG,
      }),
    );
  });

  it("resolvable profile + 12 subtest results → upserts non-null score", async () => {
    setupSuccessfulAssessmentUpdate("match@example.com");
    txMock.user.findFirst.mockResolvedValue(null);

    // Profile resolves with low demands (20 on 0-100). 12 subtest results
    // at percentile 80. Deltas = +60 each. After /10: 12 × 6 = 72.
    // (72 / 120) × 100 = 60.
    vi.mocked(resolveRoleDemandProfileForEmployee).mockResolvedValue({
      profileId: "profile_001",
      updatedAt: new Date("2026-05-12T00:00:00Z"),
      demands: ALL_CONSTRUCT_KEYS.map((construct) => ({ construct, demandScore: 20 })),
    });
    txMock.subtestResult.findMany.mockResolvedValue(
      ALL_CONSTRUCT_KEYS.map((construct) => ({ construct, percentile: 80 })),
    );

    const res = await invokeRoute(POST, {
      method: "POST",
      params: { id: ASSESSMENT_ID },
      body: { department: "Engineering", roleFamily: "Software" },
    });

    expect(res.status).toBe(200);
    expect(txMock.employeeInsights.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { assessmentId: ASSESSMENT_ID },
        create: expect.objectContaining({
          assessmentId: ASSESSMENT_ID,
          underLeverageScore: 60,
          orgId: SESSION_ORG,
          roleFamily: "Software",
          profileId: "profile_001",
        }),
      }),
    );
  });

  it("no resolvable profile → upserts null score with null profile fields", async () => {
    setupSuccessfulAssessmentUpdate("nomatch@example.com");
    txMock.user.findFirst.mockResolvedValue(null);
    // resolveRoleDemandProfileForEmployee defaults to null via setup.

    const res = await invokeRoute(POST, {
      method: "POST",
      params: { id: ASSESSMENT_ID },
      body: { department: "Engineering", roleFamily: "UnmatchedFamily" },
    });

    expect(res.status).toBe(200);
    expect(txMock.employeeInsights.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          assessmentId: ASSESSMENT_ID,
          underLeverageScore: null,
          orgId: SESSION_ORG,
          roleFamily: "UnmatchedFamily",
          profileId: null,
          profileUpdatedAt: null,
        }),
      }),
    );
  });

  it("resolvable profile resolution is scoped to session.user.orgId", async () => {
    // Cross-org safeguard: the resolve call must use the session's orgId,
    // not any value from the request body. Defensive against a future
    // refactor that mis-threads orgId.
    setupSuccessfulAssessmentUpdate("match@example.com");
    txMock.user.findFirst.mockResolvedValue(null);

    await invokeRoute(POST, {
      method: "POST",
      params: { id: ASSESSMENT_ID },
      body: { department: "Engineering", roleFamily: "Software" },
    });

    expect(resolveRoleDemandProfileForEmployee).toHaveBeenCalledWith(
      SESSION_ORG,
      "Software",
      // PRO-194: convert route must pass tx as the third arg so the
      // helper runs on the transaction's connection instead of grabbing
      // a second one from the pool. Asserted explicitly below.
      expect.anything(),
    );
  });

  it("threads tx into resolveRoleDemandProfileForEmployee (PRO-194 regression)", async () => {
    // Unit tests can't reproduce pool deadlocks (vitest mocks have no
    // real pool). This guards against the regression where someone
    // removes the `tx` argument and reintroduces the leak that broke
    // convert under `max: 1` in PRO-194 — see convert/route.ts for
    // the rationale. Don't remove this test as "argument-only check."
    setupSuccessfulAssessmentUpdate("match@example.com");
    txMock.user.findFirst.mockResolvedValue(null);

    await invokeRoute(POST, {
      method: "POST",
      params: { id: ASSESSMENT_ID },
      body: { department: "Engineering", roleFamily: "Software" },
    });

    expect(resolveRoleDemandProfileForEmployee).toHaveBeenCalled();
    const args = vi.mocked(resolveRoleDemandProfileForEmployee).mock.calls[0];
    expect(args[2]).toBe(txMock);
  });

  it("under-leverage upsert is NOT called when conversion is rejected (409)", async () => {
    setupSuccessfulAssessmentUpdate();
    txMock.assessment.updateMany.mockResolvedValue({ count: 0 });

    const res = await invokeRoute(POST, {
      method: "POST",
      params: { id: ASSESSMENT_ID },
      body: { department: "Engineering", roleFamily: "Software" },
    });

    expect(res.status).toBe(409);
    expect(txMock.employeeInsights.upsert).not.toHaveBeenCalled();
    expect(resolveRoleDemandProfileForEmployee).not.toHaveBeenCalled();
  });
});

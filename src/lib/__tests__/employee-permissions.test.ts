/**
 * PRO-133: employee-permissions.ts unit tests.
 *
 * Trust contract is non-negotiable per Section 6 of the spec:
 *   "If an employee discovers that their manager saw a score they
 *    weren't shown, ACI loses the account."
 *
 * The trust-contract tests in this file are the floor — every cell must
 * pass. The cross-mode collision tests close Dani's 2026-05-07 guardrail
 * #2. The blind-spot wrapper tests close guardrail #4.
 */

import { describe, it, expect } from "vitest";
import {
  getUserRoles,
  getEmployeeDataVisibility,
  canViewAnyEmployee,
  canViewManagerNotes,
  canViewOrgInsights,
  canEnterEmployeeMode,
  isSelfView,
  isDirectReport,
  stripBlindSpotForVisibility,
  type EmployeeDataLayer,
  type EmployeeAccessContext,
} from "@/lib/employee-permissions";
import {
  ALL_CANDIDATE_ROLES,
  ALL_EMPLOYEE_ROLES,
  candidateOnlyUser,
  employeeOnlyUser,
  crossModeUser,
  userWithRoles,
  noteFixture,
} from "./test-helpers/fixtures";

const ALL_DATA_LAYERS: EmployeeDataLayer[] = [
  "constructs",
  "compositeScores",
  "blindSpots",
  "developmentPlan",
  "evidence",
  "cognitiveSignature",
  "roleFitRadar",
  "trajectoryReadiness",
];

// ────────────────────────────────────────────────────────────────
// Trust-contract: managerNotes (CRITICAL — non-negotiable)
// ────────────────────────────────────────────────────────────────

describe("canViewManagerNotes — trust-contract floor", () => {
  it.each([...ALL_CANDIDATE_ROLES, ...ALL_EMPLOYEE_ROLES])(
    "%s NEVER sees a private note authored by someone else",
    (role) => {
      const session =
        ALL_CANDIDATE_ROLES.includes(role as never)
          ? candidateOnlyUser(role as never, { id: "user_viewer" })
          : employeeOnlyUser(role as never, { id: "user_viewer" });
      const note = noteFixture("user_other_author", { isPrivate: true });
      expect(canViewManagerNotes({ session }, note)).toBe(false);
    },
  );

  it("note author always sees their OWN private notes regardless of role", () => {
    const session = userWithRoles({
      id: "user_author_01",
      role: "RECRUITER_COORDINATOR",
      employeeRole: "PEOPLE_MANAGER",
    });
    const note = noteFixture("user_author_01", { isPrivate: true });
    expect(canViewManagerNotes({ session }, note)).toBe(true);
  });

  it("public notes (isPrivate=false) follow canViewAnyEmployee", () => {
    const note = noteFixture("user_other_author", { isPrivate: false });

    // HR_TALENT_LEADER (has org-wide read) → can see public note from another author
    expect(
      canViewManagerNotes(
        { session: employeeOnlyUser("HR_TALENT_LEADER", { id: "user_hr" }) },
        note,
      ),
    ).toBe(true);

    // RECRUITER_COORDINATOR (no Employee Mode access) → cannot see
    expect(
      canViewManagerNotes(
        { session: candidateOnlyUser("RECRUITER_COORDINATOR", { id: "user_rc" }) },
        note,
      ),
    ).toBe(false);
  });
});

// ────────────────────────────────────────────────────────────────
// Cross-mode collision (Dani guardrail #2)
// ────────────────────────────────────────────────────────────────

describe("Cross-mode collision — TA_LEADER + HR_TALENT_LEADER", () => {
  it("cross-mode user passes canViewAnyEmployee", () => {
    expect(canViewAnyEmployee(crossModeUser())).toBe(true);
  });

  it("Candidate-Mode-only TA_LEADER passes canViewAnyEmployee (existing behavior)", () => {
    expect(canViewAnyEmployee(candidateOnlyUser("TA_LEADER"))).toBe(true);
  });

  it("Employee-Mode-only HR_TALENT_LEADER (paired with RECRUITER_COORDINATOR) passes canViewAnyEmployee", () => {
    expect(canViewAnyEmployee(employeeOnlyUser("HR_TALENT_LEADER"))).toBe(true);
  });

  it("RECRUITER_COORDINATOR alone fails canViewAnyEmployee", () => {
    expect(canViewAnyEmployee(candidateOnlyUser("RECRUITER_COORDINATOR"))).toBe(false);
  });

  it("getEmployeeDataVisibility takes the highest-visibility role across slots", () => {
    // TA_LEADER (Candidate Mode admin) maps to HR_TALENT_LEADER-equivalent.
    // HR_TALENT_LEADER on blindSpots returns "summary" in PR#1.
    // Cross-mode user has both → still "summary" (no higher available).
    const ctx: EmployeeAccessContext = { session: crossModeUser() };
    expect(getEmployeeDataVisibility("blindSpots", ctx)).toBe("summary");

    // For "constructs" the Candidate-Mode-as-HR mapping returns "full",
    // so cross-mode user gets "full" (highest wins).
    expect(getEmployeeDataVisibility("constructs", ctx)).toBe("full");
  });
});

// ────────────────────────────────────────────────────────────────
// canViewAnyEmployee per role
// ────────────────────────────────────────────────────────────────

describe("canViewAnyEmployee — org-wide capability gate", () => {
  it.each(["TA_LEADER", "ADMIN", "HIRING_MANAGER"] as const)(
    "%s (Candidate Mode admin) → true",
    (role) => {
      expect(canViewAnyEmployee(candidateOnlyUser(role))).toBe(true);
    },
  );

  it.each(["EXTERNAL_COLLABORATOR", "RECRUITER_COORDINATOR", "RECRUITING_MANAGER"] as const)(
    "%s (Candidate Mode non-admin) → false",
    (role) => {
      expect(canViewAnyEmployee(candidateOnlyUser(role))).toBe(false);
    },
  );

  it("HR_TALENT_LEADER alone → true", () => {
    expect(canViewAnyEmployee(employeeOnlyUser("HR_TALENT_LEADER"))).toBe(true);
  });

  it.each(["EMPLOYEE", "PEOPLE_MANAGER", "EXECUTIVE"] as const)(
    "%s (Employee Mode without HR) → false (their access is per-target, not org-wide)",
    (employeeRole) => {
      // EMPLOYEE / PEOPLE_MANAGER access is gated per-target via
      // getEmployeeDataVisibility's self-view / direct-report checks —
      // not via this org-wide capability gate. EXECUTIVE has aggregated
      // org-insights access only, not individual-employee read.
      // Use EXTERNAL_COLLABORATOR as the Candidate Mode slot to ensure the
      // false answer comes from the Employee Mode role, not from a permissive
      // Candidate Mode role.
      const session = userWithRoles({ role: "EXTERNAL_COLLABORATOR", employeeRole });
      expect(canViewAnyEmployee(session)).toBe(false);
    },
  );
});

// ────────────────────────────────────────────────────────────────
// canEnterEmployeeMode (mode-level gate, paired with capability gate)
// ────────────────────────────────────────────────────────────────

describe("canEnterEmployeeMode — mode-level gate", () => {
  it.each(["HIRING_MANAGER", "TA_LEADER", "ADMIN"] as const)(
    "%s (Candidate Mode with employees access) → true",
    (role) => {
      expect(canEnterEmployeeMode(candidateOnlyUser(role))).toBe(true);
    },
  );

  it.each(ALL_EMPLOYEE_ROLES)(
    "%s (any Employee Mode role) → true",
    (employeeRole) => {
      expect(canEnterEmployeeMode(employeeOnlyUser(employeeRole))).toBe(true);
    },
  );

  it.each(["EXTERNAL_COLLABORATOR", "RECRUITER_COORDINATOR", "RECRUITING_MANAGER"] as const)(
    "%s alone → false",
    (role) => {
      expect(canEnterEmployeeMode(candidateOnlyUser(role))).toBe(false);
    },
  );
});

// ────────────────────────────────────────────────────────────────
// Visibility matrix
// ────────────────────────────────────────────────────────────────

describe("getEmployeeDataVisibility — PR#2 matrix", () => {
  it.each(ALL_DATA_LAYERS)(
    "HR_TALENT_LEADER gets non-'none' visibility on %s",
    (layer) => {
      const ctx = { session: employeeOnlyUser("HR_TALENT_LEADER") };
      expect(getEmployeeDataVisibility(layer, ctx)).not.toBe("none");
    },
  );

  it("HR_TALENT_LEADER on blindSpots → 'summary' (Dani guardrail #4 enforcement target)", () => {
    expect(
      getEmployeeDataVisibility("blindSpots", { session: employeeOnlyUser("HR_TALENT_LEADER") }),
    ).toBe("summary");
  });

  it("EXECUTIVE gets 'aggregated' on org-shape layers, 'none' on individual-only ones", () => {
    const ctx = { session: employeeOnlyUser("EXECUTIVE") };
    expect(getEmployeeDataVisibility("constructs", ctx)).toBe("aggregated");
    expect(getEmployeeDataVisibility("blindSpots", ctx)).toBe("none");
    expect(getEmployeeDataVisibility("developmentPlan", ctx)).toBe("none");
  });

  // ── EMPLOYEE: gated by isSelfView ──
  describe("EMPLOYEE — self-view applicability gate", () => {
    it.each(ALL_DATA_LAYERS)(
      "EMPLOYEE viewing own dossier (userId matches) → matrix value on %s",
      (layer) => {
        const session = userWithRoles({
          id: "user_emp_self",
          role: "EXTERNAL_COLLABORATOR",
          employeeRole: "EMPLOYEE",
        });
        const ctx: EmployeeAccessContext = {
          session,
          targetEmployeeUserId: "user_emp_self",
        };
        // Every layer's EMPLOYEE cell is "full" in the PR#2 matrix.
        expect(getEmployeeDataVisibility(layer, ctx)).toBe("full");
      },
    );

    it.each(ALL_DATA_LAYERS)(
      "EMPLOYEE viewing someone else's dossier (userId mismatch) → 'none' on %s",
      (layer) => {
        const session = userWithRoles({
          id: "user_emp_self",
          role: "EXTERNAL_COLLABORATOR",
          employeeRole: "EMPLOYEE",
        });
        const ctx: EmployeeAccessContext = {
          session,
          targetEmployeeUserId: "user_some_other_employee",
        };
        expect(getEmployeeDataVisibility(layer, ctx)).toBe("none");
      },
    );

    it("EMPLOYEE on a Candidate with no User linkage (targetEmployeeUserId=null) → 'none'", () => {
      const session = userWithRoles({
        id: "user_emp_self",
        role: "EXTERNAL_COLLABORATOR",
        employeeRole: "EMPLOYEE",
      });
      const ctx: EmployeeAccessContext = { session, targetEmployeeUserId: null };
      expect(getEmployeeDataVisibility("constructs", ctx)).toBe("none");
    });
  });

  // ── PEOPLE_MANAGER: gated by isDirectReport ──
  describe("PEOPLE_MANAGER — direct-report applicability gate", () => {
    it("PEOPLE_MANAGER viewing direct report → matrix value (e.g. 'full' on constructs)", () => {
      const session = userWithRoles({
        id: "user_mgr_001",
        role: "EXTERNAL_COLLABORATOR",
        employeeRole: "PEOPLE_MANAGER",
      });
      const ctx: EmployeeAccessContext = {
        session,
        targetEmployeeManagerId: "user_mgr_001",
      };
      expect(getEmployeeDataVisibility("constructs", ctx)).toBe("full");
    });

    it("PEOPLE_MANAGER on blindSpots for direct report → 'summary' (raw confidence stripped)", () => {
      const session = userWithRoles({
        id: "user_mgr_001",
        role: "EXTERNAL_COLLABORATOR",
        employeeRole: "PEOPLE_MANAGER",
      });
      const ctx: EmployeeAccessContext = {
        session,
        targetEmployeeManagerId: "user_mgr_001",
      };
      expect(getEmployeeDataVisibility("blindSpots", ctx)).toBe("summary");
    });

    it.each(ALL_DATA_LAYERS)(
      "PEOPLE_MANAGER viewing non-direct-report (managerId mismatch) → 'none' on %s",
      (layer) => {
        const session = userWithRoles({
          id: "user_mgr_001",
          role: "EXTERNAL_COLLABORATOR",
          employeeRole: "PEOPLE_MANAGER",
        });
        const ctx: EmployeeAccessContext = {
          session,
          targetEmployeeManagerId: "user_some_other_manager",
        };
        expect(getEmployeeDataVisibility(layer, ctx)).toBe("none");
      },
    );

    it("PEOPLE_MANAGER on Candidate with no User linkage (no managerId path) → 'none'", () => {
      const session = userWithRoles({
        id: "user_mgr_001",
        role: "EXTERNAL_COLLABORATOR",
        employeeRole: "PEOPLE_MANAGER",
      });
      const ctx: EmployeeAccessContext = { session, targetEmployeeManagerId: null };
      expect(getEmployeeDataVisibility("constructs", ctx)).toBe("none");
    });
  });

  it("Cross-mode TA_LEADER + EMPLOYEE on non-self dossier → still 'full' via HR-equivalent path", () => {
    // Candidate-Mode admins bypass the self-view gate — their HR-equivalent
    // visibility applies regardless of target. Confirms the admin path is
    // independent of the new self-view check.
    const session = userWithRoles({
      id: "user_ta_emp",
      role: "TA_LEADER",
      employeeRole: "EMPLOYEE",
    });
    const ctx: EmployeeAccessContext = {
      session,
      targetEmployeeUserId: "user_some_other_employee",
    };
    expect(getEmployeeDataVisibility("constructs", ctx)).toBe("full");
  });
});

// ────────────────────────────────────────────────────────────────
// stripBlindSpotForVisibility (Dani guardrail #4 — closed in PR#1)
// ────────────────────────────────────────────────────────────────

describe("stripBlindSpotForVisibility — API-layer enforcement", () => {
  const fullData = {
    construct: "FLUID_REASONING",
    confidence: 0.85,
    rawScore: 142,
    label: "High",
  };

  it("returns empty object for visibility='none'", () => {
    expect(stripBlindSpotForVisibility(fullData, "none")).toEqual({});
  });

  it("strips confidence and rawScore for visibility='summary'", () => {
    const out = stripBlindSpotForVisibility(fullData, "summary");
    expect(out).not.toHaveProperty("confidence");
    expect(out).not.toHaveProperty("rawScore");
  });

  it("preserves non-stripped fields under summary", () => {
    const out = stripBlindSpotForVisibility(fullData, "summary");
    expect(out.construct).toBe("FLUID_REASONING");
    expect(out.label).toBe("High");
  });

  it("returns input unchanged for visibility='full'", () => {
    expect(stripBlindSpotForVisibility(fullData, "full")).toEqual(fullData);
  });

  it("returns input unchanged for visibility='aggregated'", () => {
    expect(stripBlindSpotForVisibility(fullData, "aggregated")).toEqual(fullData);
  });
});

// ────────────────────────────────────────────────────────────────
// Org-insights gate
// ────────────────────────────────────────────────────────────────

describe("canViewOrgInsights — EXECUTIVE positive (Dani guardrail #3)", () => {
  it.each(["HR_TALENT_LEADER", "EXECUTIVE"] as const)(
    "%s → true (Employee Mode org-insights viewers)",
    (employeeRole) => {
      expect(canViewOrgInsights(employeeOnlyUser(employeeRole))).toBe(true);
    },
  );

  it.each(["TA_LEADER", "ADMIN"] as const)(
    "%s → true (Candidate Mode admins retain org-insights access)",
    (role) => {
      expect(canViewOrgInsights(candidateOnlyUser(role))).toBe(true);
    },
  );

  it.each(["EMPLOYEE", "PEOPLE_MANAGER"] as const)(
    "%s → false (no org-insights access)",
    (employeeRole) => {
      const session = userWithRoles({ role: "EXTERNAL_COLLABORATOR", employeeRole });
      expect(canViewOrgInsights(session)).toBe(false);
    },
  );

  it("EXTERNAL_COLLABORATOR → false", () => {
    expect(canViewOrgInsights(candidateOnlyUser("EXTERNAL_COLLABORATOR"))).toBe(false);
  });
});

// ────────────────────────────────────────────────────────────────
// isSelfView / isDirectReport — PR#2 real implementations
// ────────────────────────────────────────────────────────────────

describe("isSelfView — Candidate.userId match", () => {
  it("returns true when targetEmployeeUserId matches session user id", () => {
    const session = employeeOnlyUser("EMPLOYEE", { id: "user_emp_xyz" });
    expect(isSelfView({ session, targetEmployeeUserId: "user_emp_xyz" })).toBe(true);
  });

  it("returns false when targetEmployeeUserId differs from session user id", () => {
    const session = employeeOnlyUser("EMPLOYEE", { id: "user_emp_xyz" });
    expect(isSelfView({ session, targetEmployeeUserId: "user_some_other" })).toBe(false);
  });

  it("returns false when targetEmployeeUserId is null (Candidate not linked to a User)", () => {
    const session = employeeOnlyUser("EMPLOYEE");
    expect(isSelfView({ session, targetEmployeeUserId: null })).toBe(false);
  });

  it("returns false when targetEmployeeUserId is undefined (route didn't populate context)", () => {
    // Defensive: a route that forgets to populate the target context must
    // NOT accidentally grant self-view via undefined-undefined equality.
    const session = employeeOnlyUser("EMPLOYEE");
    expect(isSelfView({ session })).toBe(false);
  });
});

describe("isDirectReport — User.managerId match", () => {
  it("returns true when targetEmployeeManagerId matches session user id", () => {
    const session = employeeOnlyUser("PEOPLE_MANAGER", { id: "user_mgr_001" });
    expect(isDirectReport({ session, targetEmployeeManagerId: "user_mgr_001" })).toBe(true);
  });

  it("returns false when targetEmployeeManagerId differs from session user id", () => {
    const session = employeeOnlyUser("PEOPLE_MANAGER", { id: "user_mgr_001" });
    expect(
      isDirectReport({ session, targetEmployeeManagerId: "user_some_other_manager" }),
    ).toBe(false);
  });

  it("returns false when targetEmployeeManagerId is null (employee has no manager)", () => {
    const session = employeeOnlyUser("PEOPLE_MANAGER");
    expect(isDirectReport({ session, targetEmployeeManagerId: null })).toBe(false);
  });

  it("returns false when targetEmployeeManagerId is undefined", () => {
    const session = employeeOnlyUser("PEOPLE_MANAGER");
    expect(isDirectReport({ session })).toBe(false);
  });

  it("single-hop only: a manager's manager is NOT a direct report", () => {
    // Confirms no transitive walk. If user A manages B, and B manages C,
    // A does NOT see C via isDirectReport (C.managerId = B, not A).
    const sessionA = employeeOnlyUser("PEOPLE_MANAGER", { id: "user_A" });
    // C's managerId is "user_B" — not user_A.
    expect(isDirectReport({ session: sessionA, targetEmployeeManagerId: "user_B" })).toBe(false);
  });
});

// ────────────────────────────────────────────────────────────────
// getUserRoles helper
// ────────────────────────────────────────────────────────────────

describe("getUserRoles — slot union", () => {
  it("returns single-role array for Candidate-only user", () => {
    expect(getUserRoles(candidateOnlyUser("TA_LEADER"))).toEqual(["TA_LEADER"]);
  });

  it("returns two-role array for cross-mode user", () => {
    const session = crossModeUser();
    expect(getUserRoles(session)).toEqual(["TA_LEADER", "HR_TALENT_LEADER"]);
  });

  it("filters null employeeRole", () => {
    const session = userWithRoles({ role: "ADMIN", employeeRole: null });
    expect(getUserRoles(session)).toEqual(["ADMIN"]);
  });
});

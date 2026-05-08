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
  PR2_PENDING_REASON,
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

describe("canViewAnyEmployee — PR#1 stub posture", () => {
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
    "%s (Employee Mode without HR) → false (PR#2 wires self-view + scoping)",
    (employeeRole) => {
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

describe("getEmployeeDataVisibility — PR#1 matrix", () => {
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

  it.each(["EMPLOYEE", "PEOPLE_MANAGER"] as const)(
    "%s returns 'none' on every layer in PR#1 stub posture",
    (employeeRole) => {
      const session = userWithRoles({ role: "EXTERNAL_COLLABORATOR", employeeRole });
      for (const layer of ALL_DATA_LAYERS) {
        expect(getEmployeeDataVisibility(layer, { session })).toBe("none");
      }
    },
  );
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
// PR#1 stubs (PR#2 will replace)
// ────────────────────────────────────────────────────────────────

describe("PR#1 stubs", () => {
  it("isSelfView is false in PR#1 (PR#2 wires Candidate.userId)", () => {
    expect(isSelfView({ session: employeeOnlyUser("EMPLOYEE") })).toBe(false);
  });

  it("isDirectReport is false in PR#1 (PR#2 wires User.managerId)", () => {
    expect(isDirectReport({ session: employeeOnlyUser("PEOPLE_MANAGER") })).toBe(false);
  });

  it("PR2_PENDING_REASON is grep-able for PR#2 to find stub-403 sites", () => {
    expect(PR2_PENDING_REASON).toBe("PRO-133-PR2-pending");
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

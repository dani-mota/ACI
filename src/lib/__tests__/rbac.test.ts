/**
 * PRO-133: rbac.ts unit tests.
 *
 * Covers:
 * - Map exhaustiveness for both AppUserRole + AppEmployeeUserRole
 * - canAccessMode signature change to (session, mode) — both slots
 * - getAccessibleModes union across slots
 * - canConvertCandidate overloads (session-based + role-based)
 * - canAssignRole + getAssignableEmployeeRoles
 * - getRoleLabel for both unions
 */

import { describe, it, expect } from "vitest";
import {
  MODE_ACCESS,
  EMPLOYEE_MODE_ACCESS,
  ASSIGNABLE_EMPLOYEE_ROLES,
  getAccessibleModes,
  canAccessMode,
  canConvertCandidate,
  canAssignRole,
  getAssignableEmployeeRoles,
  getRoleLabel,
  type AppUserRole,
  type AppEmployeeUserRole,
} from "@/lib/rbac";
import {
  ALL_CANDIDATE_ROLES,
  ALL_EMPLOYEE_ROLES,
  candidateOnlyUser,
  employeeOnlyUser,
  crossModeUser,
  userWithRoles,
} from "./test-helpers/fixtures";

describe("Map exhaustiveness", () => {
  it("MODE_ACCESS has an entry for every AppUserRole", () => {
    const mapKeys = Object.keys(MODE_ACCESS).sort();
    expect(mapKeys).toEqual([...ALL_CANDIDATE_ROLES].sort());
  });

  it("EMPLOYEE_MODE_ACCESS has an entry for every AppEmployeeUserRole", () => {
    const mapKeys = Object.keys(EMPLOYEE_MODE_ACCESS).sort();
    expect(mapKeys).toEqual([...ALL_EMPLOYEE_ROLES].sort());
  });

  it("ASSIGNABLE_EMPLOYEE_ROLES excludes EMPLOYEE (auto-assigned at conversion)", () => {
    expect(ASSIGNABLE_EMPLOYEE_ROLES).not.toContain("EMPLOYEE");
    expect(ASSIGNABLE_EMPLOYEE_ROLES).toContain("PEOPLE_MANAGER");
    expect(ASSIGNABLE_EMPLOYEE_ROLES).toContain("HR_TALENT_LEADER");
    expect(ASSIGNABLE_EMPLOYEE_ROLES).toContain("EXECUTIVE");
  });
});

describe("getAccessibleModes — additive across slots", () => {
  it("returns Candidate Mode modes for a Candidate-only user", () => {
    const session = candidateOnlyUser("TA_LEADER");
    expect(getAccessibleModes(session)).toEqual(["candidates", "employees"]);
  });

  it("returns Employee Mode modes for an Employee-only user", () => {
    const session = employeeOnlyUser("HR_TALENT_LEADER");
    // RECRUITER_COORDINATOR (Candidate Mode) + HR_TALENT_LEADER → union has both
    expect(getAccessibleModes(session)).toEqual(
      expect.arrayContaining(["candidates", "employees"]),
    );
  });

  it("union across both slots — TA_LEADER + HR_TALENT_LEADER", () => {
    const session = crossModeUser();
    const modes = getAccessibleModes(session);
    expect(modes).toEqual(expect.arrayContaining(["candidates", "employees"]));
  });

  it("falls back to ['candidates'] for unknown role", () => {
    const session = userWithRoles({ role: "EXTERNAL_COLLABORATOR" });
    expect(getAccessibleModes(session)).toEqual(["candidates"]);
  });
});

describe("canAccessMode", () => {
  it("EXTERNAL_COLLABORATOR cannot access employees", () => {
    expect(canAccessMode(candidateOnlyUser("EXTERNAL_COLLABORATOR"), "employees")).toBe(false);
  });

  it("RECRUITER_COORDINATOR cannot access employees (Candidate Mode only)", () => {
    expect(canAccessMode(candidateOnlyUser("RECRUITER_COORDINATOR"), "employees")).toBe(false);
  });

  it.each(["HIRING_MANAGER", "TA_LEADER", "ADMIN"] as const)(
    "%s can access employees via Candidate Mode (existing behavior)",
    (role) => {
      expect(canAccessMode(candidateOnlyUser(role), "employees")).toBe(true);
    },
  );

  it.each(ALL_EMPLOYEE_ROLES)(
    "%s (Employee Mode) can access employees regardless of Candidate Mode role",
    (employeeRole) => {
      const session = employeeOnlyUser(employeeRole);
      expect(canAccessMode(session, "employees")).toBe(true);
    },
  );

  it("cross-mode user (TA_LEADER + HR_TALENT_LEADER) accesses both modes", () => {
    const session = crossModeUser();
    expect(canAccessMode(session, "candidates")).toBe(true);
    expect(canAccessMode(session, "employees")).toBe(true);
  });
});

describe("canConvertCandidate — additive check across slots", () => {
  it("RECRUITING_MANAGER (Candidate Mode) can convert", () => {
    expect(canConvertCandidate(candidateOnlyUser("RECRUITING_MANAGER"))).toBe(true);
  });

  it("EXTERNAL_COLLABORATOR cannot convert", () => {
    expect(canConvertCandidate(candidateOnlyUser("EXTERNAL_COLLABORATOR"))).toBe(false);
  });

  it("PEOPLE_MANAGER (Employee Mode) can convert", () => {
    expect(canConvertCandidate(employeeOnlyUser("PEOPLE_MANAGER"))).toBe(true);
  });

  it("HR_TALENT_LEADER (Employee Mode) can convert", () => {
    expect(canConvertCandidate(employeeOnlyUser("HR_TALENT_LEADER"))).toBe(true);
  });

  it("EMPLOYEE alone cannot convert", () => {
    expect(canConvertCandidate(employeeOnlyUser("EMPLOYEE"))).toBe(false);
  });

  it("EXECUTIVE alone cannot convert", () => {
    expect(canConvertCandidate(employeeOnlyUser("EXECUTIVE"))).toBe(false);
  });

  it("cross-mode (RECRUITER_COORDINATOR + HR_TALENT_LEADER) can convert via Employee Mode", () => {
    const session = userWithRoles({ role: "RECRUITER_COORDINATOR", employeeRole: "HR_TALENT_LEADER" });
    expect(canConvertCandidate(session)).toBe(true);
  });

  it("legacy role-only overload (for client component) works", () => {
    expect(canConvertCandidate("RECRUITING_MANAGER")).toBe(true);
    expect(canConvertCandidate("RECRUITER_COORDINATOR")).toBe(false);
    expect(canConvertCandidate(null)).toBe(false);
    expect(canConvertCandidate(undefined)).toBe(false);
  });
});

describe("canAssignRole — Candidate Mode unchanged by PRO-133", () => {
  it("EMPLOYEE Mode roles are not assignable via canAssignRole (Candidate-Mode-only function)", () => {
    // canAssignRole only deals with AppUserRole — Employee Mode is governed by getAssignableEmployeeRoles.
    expect(canAssignRole("ADMIN", "TA_LEADER")).toBe(true);
    expect(canAssignRole("RECRUITER_COORDINATOR", "TA_LEADER")).toBe(false);
  });
});

describe("getAssignableEmployeeRoles", () => {
  it("TA_LEADER can assign all Employee Mode roles", () => {
    expect(getAssignableEmployeeRoles("TA_LEADER")).toEqual(
      expect.arrayContaining(["PEOPLE_MANAGER", "HR_TALENT_LEADER", "EXECUTIVE"]),
    );
  });

  it("ADMIN can assign all Employee Mode roles", () => {
    expect(getAssignableEmployeeRoles("ADMIN")).toEqual(
      expect.arrayContaining(["PEOPLE_MANAGER", "HR_TALENT_LEADER", "EXECUTIVE"]),
    );
  });

  it("RECRUITER_COORDINATOR cannot assign any Employee Mode role", () => {
    expect(getAssignableEmployeeRoles("RECRUITER_COORDINATOR")).toEqual([]);
  });

  it("HIRING_MANAGER cannot assign any Employee Mode role (silent permission expansion guard)", () => {
    expect(getAssignableEmployeeRoles("HIRING_MANAGER")).toEqual([]);
  });
});

describe("getRoleLabel — accepts both unions", () => {
  it.each(ALL_CANDIDATE_ROLES)("returns a non-empty label for %s", (role: AppUserRole) => {
    const label = getRoleLabel(role);
    expect(label).toBeTruthy();
    expect(label).not.toBe(role); // i.e., a friendly label, not just the enum string
  });

  it.each(ALL_EMPLOYEE_ROLES)("returns a non-empty label for %s", (role: AppEmployeeUserRole) => {
    const label = getRoleLabel(role);
    expect(label).toBeTruthy();
  });

  it("HR_TALENT_LEADER → 'HR / Talent Leader'", () => {
    expect(getRoleLabel("HR_TALENT_LEADER")).toBe("HR / Talent Leader");
  });
});

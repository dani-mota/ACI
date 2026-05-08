/**
 * PRO-133: shared test fixtures for RBAC / employee-permissions tests.
 *
 * The cross-mode case (TA_LEADER + HR_TALENT_LEADER) is naturally
 * expressed via `userWithRoles({ role, employeeRole })`. Single-mode
 * cases are covered by `candidateOnlyUser` and `employeeOnlyUser`
 * convenience builders.
 */

import type { AppSession } from "@/lib/auth";
import type { AppUserRole, AppEmployeeUserRole } from "@/lib/rbac";

interface UserFixtureOpts {
  id?: string;
  email?: string;
  name?: string;
  orgId?: string;
  /** Candidate Mode role — required (every user has one) */
  role: AppUserRole;
  /** Employee Mode role — optional. Cross-mode case is when both are set. */
  employeeRole?: AppEmployeeUserRole | null;
}

export function userWithRoles(opts: UserFixtureOpts): AppSession {
  return {
    user: {
      id: opts.id ?? "user_test_001",
      supabaseId: `supa_${opts.id ?? "test_001"}`,
      email: opts.email ?? "test@example.com",
      name: opts.name ?? "Test User",
      role: opts.role,
      employeeRole: opts.employeeRole ?? null,
      orgId: opts.orgId ?? "org_test_001",
    },
  };
}

/** Cross-mode user — TA_LEADER (Candidate) + HR_TALENT_LEADER (Employee). */
export const crossModeUser = (overrides: Partial<UserFixtureOpts> = {}): AppSession =>
  userWithRoles({ role: "TA_LEADER", employeeRole: "HR_TALENT_LEADER", ...overrides });

/** Pure Candidate Mode user — single role, no employeeRole. */
export const candidateOnlyUser = (
  role: AppUserRole,
  overrides: Partial<UserFixtureOpts> = {},
): AppSession => userWithRoles({ role, employeeRole: null, ...overrides });

/** Pure Employee Mode user — RECRUITER_COORDINATOR (no Candidate Mode admin) + employeeRole. */
export const employeeOnlyUser = (
  employeeRole: AppEmployeeUserRole,
  overrides: Partial<UserFixtureOpts> = {},
): AppSession =>
  userWithRoles({ role: "RECRUITER_COORDINATOR", employeeRole, ...overrides });

/** Note fixture for trust-contract tests. */
export function noteFixture(
  authorId: string,
  opts: { isPrivate?: boolean; content?: string; candidateId?: string } = {},
): { id: string; candidateId: string; authorId: string; content: string; isPrivate: boolean; createdAt: Date; updatedAt: Date } {
  const now = new Date();
  return {
    id: `note_${authorId}_${Math.random().toString(36).slice(2, 7)}`,
    candidateId: opts.candidateId ?? "candidate_test_001",
    authorId,
    content: opts.content ?? "Test note content.",
    isPrivate: opts.isPrivate ?? false,
    createdAt: now,
    updatedAt: now,
  };
}

/** Convenience: every Candidate Mode role for parametrized tests. */
export const ALL_CANDIDATE_ROLES: AppUserRole[] = [
  "EXTERNAL_COLLABORATOR",
  "RECRUITER_COORDINATOR",
  "RECRUITING_MANAGER",
  "HIRING_MANAGER",
  "TA_LEADER",
  "ADMIN",
];

/** Convenience: every Employee Mode role for parametrized tests. */
export const ALL_EMPLOYEE_ROLES: AppEmployeeUserRole[] = [
  "EMPLOYEE",
  "PEOPLE_MANAGER",
  "HR_TALENT_LEADER",
  "EXECUTIVE",
];

/**
 * PRO-133: Employee Mode permission helpers.
 *
 * Trust contract (non-negotiable per Section 6 of the spec):
 *   "If an employee discovers that their manager saw a score they
 *    weren't shown, ACI loses the account."
 *
 * This file is the single source of truth for Employee Mode access
 * decisions. Trust-contract enforcement lives here exclusively;
 * filterCandidateForRole stays Candidate-Mode-only and is never
 * invoked by Employee Mode routes.
 *
 * PR#2 active: EMPLOYEE and PEOPLE_MANAGER cells in VISIBILITY_MATRIX
 * are populated with real visibility levels. The applicability gate
 * (self-view for EMPLOYEE, direct-report for PEOPLE_MANAGER) lives in
 * `getEmployeeDataVisibility` — the matrix returns the visibility
 * level IF the role applies; the helper enforces applicability.
 *
 * Routes call `getEmployeeDataVisibility(layer, ctx)` and treat a
 * return of "none" as 403 / redirect. Routes that need per-row note
 * privacy use `canViewManagerNotes(ctx, note)` separately — notes are
 * NOT in the visibility matrix.
 */

import type { AppSession } from "@/lib/auth";
import type { AppUserRole, AppEmployeeUserRole } from "@/lib/rbac";

// ─── Public types ──────────────────────────────────────────────

/**
 * Data layers that have visibility levels (full | summary | aggregated | none).
 *
 * NOTE: `managerNotes` is intentionally NOT in this union. Notes are
 * gated per-row via `canViewManagerNotes(ctx, note)` against
 * `note.authorId` and `note.isPrivate` — that's a different access
 * shape than visibility levels, and conflating them would route a
 * private-note read through the matrix and accidentally permit it.
 * The type system enforces the distinction: callers asking about
 * notes are forced to use the right helper.
 */
export type EmployeeDataLayer =
  | "constructs"
  | "compositeScores"
  | "blindSpots"
  | "developmentPlan"
  | "evidence"
  | "cognitiveSignature"
  | "roleFitRadar";

export type Visibility = "full" | "summary" | "aggregated" | "none";

export interface EmployeeAccessContext {
  session: AppSession;
  /** PR#2: Candidate.userId — populated for self-view checks. */
  targetEmployeeUserId?: string | null;
  /** PR#2: User.managerId — populated for direct-report-scoping checks. */
  targetEmployeeManagerId?: string | null;
}

/**
 * @deprecated PR#2 commit 5 removes this constant. It existed as a
 * stub-403 discriminator for PR#1; no routes reference it anymore.
 * Kept exported here only so tests still compile during the commit
 * boundary between commit 3 (route changes) and commit 5 (test inversion).
 */
export const PR2_PENDING_REASON = "PRO-133-PR2-pending";

// ─── Visibility matrix (Spec Section 6) ────────────────────────

/**
 * Spec-to-code translation as a literal const so the matrix is auditable
 * at a glance. PR#2 flipped the EMPLOYEE and PEOPLE_MANAGER cells from
 * "none" — these roles now have real access, gated by `isSelfView` and
 * `isDirectReport` respectively in `getEmployeeDataVisibility` below.
 *
 * The matrix returns the visibility level IF the role applies. The
 * applicability check (self-view for EMPLOYEE, direct-report for
 * PEOPLE_MANAGER) is enforced in the helper, not the matrix.
 */
const VISIBILITY_MATRIX: Record<EmployeeDataLayer, Record<AppEmployeeUserRole, Visibility>> = {
  constructs: {
    EMPLOYEE: "full",
    PEOPLE_MANAGER: "full",
    HR_TALENT_LEADER: "full",
    EXECUTIVE: "aggregated",
  },
  compositeScores: {
    EMPLOYEE: "full",
    PEOPLE_MANAGER: "full",
    HR_TALENT_LEADER: "full",
    EXECUTIVE: "aggregated",
  },
  blindSpots: {
    EMPLOYEE: "full",            // gentle framing for self (consumer obligation: PRO-143)
    PEOPLE_MANAGER: "summary",   // no raw confidence — strip at API layer
    HR_TALENT_LEADER: "summary", // PRO-143 must call stripBlindSpotForVisibility
    EXECUTIVE: "none",
  },
  developmentPlan: {
    EMPLOYEE: "full",
    PEOPLE_MANAGER: "full",
    HR_TALENT_LEADER: "full",
    EXECUTIVE: "none",
  },
  evidence: {
    EMPLOYEE: "full",
    PEOPLE_MANAGER: "full",
    HR_TALENT_LEADER: "full",
    EXECUTIVE: "aggregated",
  },
  cognitiveSignature: {
    EMPLOYEE: "full",
    PEOPLE_MANAGER: "full",
    HR_TALENT_LEADER: "full",
    EXECUTIVE: "aggregated",
  },
  roleFitRadar: {
    EMPLOYEE: "full",
    PEOPLE_MANAGER: "full",
    HR_TALENT_LEADER: "full",
    EXECUTIVE: "aggregated",
  },
};

const VISIBILITY_RANK: Record<Visibility, number> = {
  none: 0,
  aggregated: 1,
  summary: 2,
  full: 3,
};

// ─── Cross-mode role union ─────────────────────────────────────

/**
 * Returns the union of all roles assigned to this user across role slots.
 * Mixed array of Candidate-Mode and Employee-Mode role strings.
 *
 * Behaves identically to a future `roles[]` migration if Option A becomes
 * preferable later — call sites consume an array, so the storage shape
 * (dual-column vs array column) is encapsulated here.
 */
export function getUserRoles(session: AppSession): (AppUserRole | AppEmployeeUserRole)[] {
  const out: (AppUserRole | AppEmployeeUserRole)[] = [session.user.role];
  if (session.user.employeeRole) out.push(session.user.employeeRole);
  return out;
}

// ─── Per-layer visibility ──────────────────────────────────────

/**
 * Cross-mode users: highest visibility wins across both role slots.
 * Candidate-Mode roles (TA_LEADER / ADMIN / HIRING_MANAGER) are mapped
 * to HR_TALENT_LEADER-equivalent visibility for Employee Mode layers via
 * a small adapter — keeps the matrix Employee-Mode-keyed for clarity.
 */
const CANDIDATE_MODE_ADMINS_AS_HR: readonly AppUserRole[] = [
  "TA_LEADER",
  "ADMIN",
  "HIRING_MANAGER",
] as const;

export function getEmployeeDataVisibility(
  layer: EmployeeDataLayer,
  ctx: EmployeeAccessContext,
): Visibility {
  const candidates: Visibility[] = [];

  // Candidate-Mode admins (TA_LEADER, ADMIN, HIRING_MANAGER) act as
  // HR-equivalent. No self-view / direct-report gating — they have org-wide
  // read by virtue of their Candidate Mode role.
  if ((CANDIDATE_MODE_ADMINS_AS_HR as readonly string[]).includes(ctx.session.user.role)) {
    candidates.push(VISIBILITY_MATRIX[layer]["HR_TALENT_LEADER"]);
  }

  // Employee Mode role with PR#2 applicability gates:
  // - HR_TALENT_LEADER and EXECUTIVE: matrix value applies unconditionally
  //   (org-wide / aggregated authority — no per-target check)
  // - EMPLOYEE: matrix value applies ONLY when viewing own dossier
  // - PEOPLE_MANAGER: matrix value applies ONLY when target is a direct report
  const empRole = ctx.session.user.employeeRole;
  if (empRole === "HR_TALENT_LEADER" || empRole === "EXECUTIVE") {
    candidates.push(VISIBILITY_MATRIX[layer][empRole]);
  } else if (empRole === "EMPLOYEE") {
    if (isSelfView(ctx)) candidates.push(VISIBILITY_MATRIX[layer]["EMPLOYEE"]);
  } else if (empRole === "PEOPLE_MANAGER") {
    if (isDirectReport(ctx)) candidates.push(VISIBILITY_MATRIX[layer]["PEOPLE_MANAGER"]);
  }

  if (candidates.length === 0) return "none";

  // Highest visibility wins across the additive role slots.
  return candidates.reduce<Visibility>(
    (best, v) => (VISIBILITY_RANK[v] > VISIBILITY_RANK[best] ? v : best),
    "none",
  );
}

// ─── Mode-level + capability gates ─────────────────────────────

/**
 * `as const` narrows the includes() check to known role strings, so a
 * typo like "HR_TALENT_LEADR" fails at compile time. Trust-contract code;
 * the extra strictness is worth the noise.
 */
const ALLOWED_EMPLOYEE_VIEWERS = [
  "TA_LEADER",
  "ADMIN",
  "HIRING_MANAGER",
  "HR_TALENT_LEADER",
] as const;

/**
 * Capability gate: can this user view ANY employee's data right now
 * (org-wide read, with note-author filter applied separately)?
 *
 * PR#1 posture:
 *   - true:  TA_LEADER, ADMIN, HIRING_MANAGER, HR_TALENT_LEADER
 *   - false: EMPLOYEE (PR#2 wires Candidate.userId for self-view),
 *            PEOPLE_MANAGER (PR#2 wires User.managerId for scoping),
 *            EXECUTIVE (no individual-level access; aggregated only),
 *            EXTERNAL_COLLABORATOR / RECRUITER_COORDINATOR / RECRUITING_MANAGER
 *            (no Employee Mode access at all)
 */
export function canViewAnyEmployee(session: AppSession): boolean {
  const roles = getUserRoles(session);
  return roles.some((r) => (ALLOWED_EMPLOYEE_VIEWERS as readonly string[]).includes(r));
}

const ALLOWED_ORG_INSIGHTS_VIEWERS = [
  "HR_TALENT_LEADER",
  "EXECUTIVE",
  "TA_LEADER",
  "ADMIN",
] as const;

/**
 * Capability gate for the org-aggregated insights endpoint.
 * EXECUTIVE gets access here (and ONLY here in PR#1) — that's the
 * paired positive Dani's guardrail #3 calls for.
 */
export function canViewOrgInsights(session: AppSession): boolean {
  const roles = getUserRoles(session);
  return roles.some((r) => (ALLOWED_ORG_INSIGHTS_VIEWERS as readonly string[]).includes(r));
}

// ─── Trust-contract: manager notes ─────────────────────────────

/**
 * CRITICAL trust-contract gate. Operates per-row.
 *
 * Public notes (`isPrivate: false`) follow `canViewAnyEmployee` —
 * anyone with general read access sees them.
 *
 * Private notes (`isPrivate: true`) are author-only. ROLE IS IGNORED:
 * even an ADMIN doesn't see another author's private note. This is
 * deliberate — the trust contract floor is "the author of the note
 * is the only person who can see it."
 *
 * The function takes the requesting context and the note's metadata
 * (authorId + isPrivate). Callers fetching a list of notes should
 * filter the list with this gate before serializing the response.
 */
export function canViewManagerNotes(
  ctx: EmployeeAccessContext,
  note: { authorId: string; isPrivate: boolean },
): boolean {
  if (!note.isPrivate) return canViewAnyEmployee(ctx.session);
  return ctx.session.user.id === note.authorId;
}

// ─── Self-view + direct-report checks (PR#2 active) ────────────

/**
 * True when the session's user is viewing their own dossier — i.e., the
 * target Candidate.userId matches session.user.id. Null-safe: returns
 * false if either side is missing (no User linkage for the Candidate, or
 * unauthenticated session).
 *
 * Populated by routes that have a Candidate ID: fetch
 * `candidate.userId` and pass it as `ctx.targetEmployeeUserId`.
 */
export function isSelfView(ctx: EmployeeAccessContext): boolean {
  if (!ctx.targetEmployeeUserId) return false;
  return ctx.targetEmployeeUserId === ctx.session.user.id;
}

/**
 * True when the session's user is the direct manager of the target
 * employee — i.e., the target User.managerId matches session.user.id.
 * Single-hop only (no recursive team tree; a manager's manager is NOT
 * a direct report). Null-safe.
 *
 * Populated by routes that have a Candidate ID: fetch
 * `candidate.user?.managerId` (walk Candidate → User → managerId) and
 * pass it as `ctx.targetEmployeeManagerId`.
 */
export function isDirectReport(ctx: EmployeeAccessContext): boolean {
  if (!ctx.targetEmployeeManagerId) return false;
  return ctx.targetEmployeeManagerId === ctx.session.user.id;
}

// ─── Blind-spot stripping wrapper (Dani guardrail #4) ──────────

/**
 * Strips raw confidence/score data from a blind-spot payload based on
 * the visibility level. Closes Dani's 2026-05-07 guardrail #4:
 *
 *   "Blind-spot map summary vs. full reframing logic: confirm the data
 *    shape returned to PEOPLE_MANAGER strips raw confidence scores at
 *    the API layer, not just hides them in the UI."
 *
 * This wrapper enforces the API-layer strip. PRO-143 (the Blind-Spot
 * Map ticket) MUST call this helper at its API endpoint. If a future
 * PR misses calling this, that's visible at PR review (no other place
 * where stripping happens).
 *
 * Behavior:
 *   - "none":       returns an empty object (caller should 403 or omit)
 *   - "summary":    strips `confidence` and `rawScore`
 *   - "full":       returns the input unchanged
 *   - "aggregated": returns the input unchanged (caller is responsible
 *                   for shaping the aggregate envelope before passing in)
 */
export function stripBlindSpotForVisibility<T extends { confidence?: number; rawScore?: number }>(
  data: T,
  visibility: Visibility,
): Partial<T> {
  if (visibility === "none") return {};
  if (visibility === "summary") {
    const stripped = { ...data };
    delete stripped.confidence;
    delete stripped.rawScore;
    return stripped;
  }
  return data;
}

// ─── Mode-level gate (paired with canAccessMode in rbac.ts) ────

/**
 * Re-export of `canAccessMode` semantics keyed to the Employee Mode
 * surface. Call sites use this paired with `canViewAnyEmployee`:
 *
 *   if (!canEnterEmployeeMode(session)) return 403;          // mode gate
 *   if (!canViewAnyEmployee(session)) return 403 PR2_PENDING; // capability gate
 *
 * Two checks, two intents: "are you allowed in this surface?" vs.
 * "can you actually see employee data, or are you a PR#2-pending stub?"
 *
 * Implemented as a thin wrapper to keep `rbac.ts` clean of Employee
 * Mode semantics — `canAccessMode` takes (session, mode) and answers
 * "any mode" generically; the Employee-specific helper makes the
 * intent visible at gate sites.
 */
export function canEnterEmployeeMode(session: AppSession): boolean {
  // Inline the check rather than import from rbac.ts to avoid the
  // circular-dependency risk that motivated the SessionLike interface
  // duplication in rbac.ts. Both files conceptually own this gate.
  const role = session.user.role;
  const empRole = session.user.employeeRole;

  // Candidate Mode roles that grant employees-mode access via MODE_ACCESS:
  if (role === "HIRING_MANAGER" || role === "TA_LEADER" || role === "ADMIN") return true;
  // Employee Mode roles all grant employees-mode access:
  if (empRole) return true;
  return false;
}

# PRO-133 PR#1 — Employee Mode RBAC: permission model + multi-role schema + helpers

## Context

Employee Mode (PRO-125 epic) is shipped as code but ungated for its real audience. Five API routes and one server-rendered page sit behind `canAccessMode(role, "employees")`, which today only returns true for `TA_LEADER`, `ADMIN`, and `HIRING_MANAGER`. No `EMPLOYEE`, `PEOPLE_MANAGER`, `HR_TALENT_LEADER`, or `EXECUTIVE` user can exist because the enum doesn't define them. Dossier work in PRO-127, 130, 131, 132, 135, 136 is gated on PRO-133 — spec marks this **P1-Urgent / security / compliance**.

The trust contract is non-negotiable: *"If an employee discovers that their manager saw a score they weren't shown, ACI loses the account."*

**Sequencing decision (locked with Joel):** two PRs. PR#1 (this plan) lands the permission model + the multi-role schema needed for Dani's cross-mode collision test. EMPLOYEE/PEOPLE_MANAGER stub to 403 because their data linkages (`Candidate.userId`, `User.managerId`) are PR#2 territory. HR_TALENT_LEADER works fully org-wide. EXECUTIVE has the enum + a stub aggregated endpoint so its 403 on individual endpoints has a paired positive test.

## Acceptance Criteria status (as of 2026-05-03)

Branch state: **not yet created.** No commits. Linear flag has been "In Progress" since 2026-04-28; that span was spent clearing a P1 candidate-mode bug (PRO-87, PR ready to merge) and recon'ing PRO-137's architecture decisions (escalated to Dani separately).

| # | AC (from spec) | Status | Lands in |
|---|---|---|---|
| 1 | 4 new role enum values exist in auth system | 🟡 Open | PR#1 commit 1 |
| 2 | EMPLOYEE: `GET /api/employees/[id]` returns full data only if `userId === employeeId`; 403 otherwise | 🔴 Stub-403 in PR#1 | PR#2 (needs `Candidate.userId`) |
| 3 | PEOPLE_MANAGER: `GET /api/employees/[id]` returns full data for direct reports; 403 outside team | 🔴 Stub-403 in PR#1 | PR#2 (needs `User.managerId`) |
| 4 | HR_TALENT_LEADER: `GET /api/employees/[id]` returns full data for any employee in org | 🟡 Open | PR#1 commit 3 |
| 5 | EXECUTIVE: `GET /api/employees/[id]` returns 403; aggregated org endpoints return data | 🟡 Open | PR#1 commit 3 (stub `/api/org/insights`) |
| 6 | Manager private notes returned only to PEOPLE_MANAGER for own notes; never to EMPLOYEE | 🟡 Open | PR#1 commit 3 (`Note.isPrivate` + `canViewManagerNotes`) |
| 7 | Blind-spot map: developmental framing for EMPLOYEE; summary (no raw confidence) for PEOPLE_MANAGER + HR | 🟡 Open in PR#1 (helper returns `"summary"`); consumer logic ships in PRO-143 | PR#1 (helper) + PRO-143 (consumer) |
| 8 | Candidate Mode roles cannot access employee-mode routes — 403 | 🟢 Already enforced via `canAccessMode`; PR#1 preserves | — |
| 9 | Existing Candidate Mode permission checks are unaffected | 🟡 Open (verified by no-touch + tests) | PR#1 |
| 10 | All permission checks enforced server-side, not only UI | 🟡 Open (integration tests assert) | PR#1 commit 4 |
| 11 | `npx tsc --noEmit` passes; `npm run build` no warnings | 🟡 Open | PR#1 verification |

**Net:** of 11 ACs, PR#1 lands 8 fully + the helper-side of #7. PR#2 lands the remaining 2 (EMPLOYEE self-view + PEOPLE_MANAGER scoping) once `Candidate.userId` and `User.managerId` are added. AC #7's UI consumer ships separately in PRO-143.

## Dani's 2026-05-01 reply — 4 explicit guardrails baked into this plan

Dani didn't pick the architecture — he set behavioral guardrails that constrain the plan:

1. **Server-side enforcement requires integration tests** against real route handlers, not just unit tests on permission helpers
2. **Cross-mode collision test** — a user holding TA_LEADER (Candidate Mode) AND HR_TALENT_LEADER (Employee Mode) simultaneously must work additively
3. **EXECUTIVE 403 needs paired positive test** — must have at least one endpoint that returns data, otherwise the role looks broken
4. **Blind-spot map summary vs. full** — strip raw confidence scores at the API layer, not just hide in the UI

Requirement (2) forces the multi-role schema decision into PR#1 — you can't write a cross-mode collision test if the schema can't represent dual roles. Requirement (3) forces a stub `/api/org/insights` endpoint into PR#1.

## Architectural recommendations — AWAITING DANI CONFIRMATION

Honest read of Dani's 2026-05-01 reply: he set behavioral guardrails (4 items above) but **did not engage with the 6 architecture decisions** from the prior escalation. Two interpretations:

- **Charitable:** he saw my recommendations as obvious, didn't push back, considers them implicitly approved
- **Less charitable:** he skimmed the architecture doc and responded only at the ticket level

Tag legend:
- **[REC]** — recommendation pending Dani's confirmation; can override
- **[ENG]** — engineering call within Joel's authority; flagged here for Dani's visibility, still override-able at PR review
- **[OPEN]** — needs Dani's explicit answer before code lands

1. **[REC] Multi-role: dual-column with TWO ENUMS (Option B').** Refinement of Option B. Keep existing `UserRole` enum (6 Candidate-Mode values) unchanged. Create new `EmployeeUserRole` enum (4 Employee-Mode values: `EMPLOYEE`, `PEOPLE_MANAGER`, `HR_TALENT_LEADER`, `EXECUTIVE`). User schema gains `employeeRole EmployeeUserRole?`. Why two enums:
   - **3 migrations instead of 6** — single `CREATE TYPE EmployeeUserRole` + 1 `User.employeeRole` column add + 1 `Note.isPrivate` add. No `ALTER TYPE ADD VALUE` transactions required.
   - **Type-system tells the story** — `EXECUTIVE` is structurally a different *kind* of role than `TA_LEADER`; the type system reflects that. Helpers that take `AppUserRole` are operating on Candidate-Mode roles; helpers that take `AppEmployeeUserRole` are operating on Employee-Mode roles.
   - **Prevents nonsensical combinations** — under one shared enum, `role: TA_LEADER + employeeRole: TA_LEADER` is technically representable. Under two enums, the type system rejects it.
   - **Existing maps stay 6-entry** — `ACCESS_MAP`, `ROLE_LEVEL`, `ASSIGNABLE_ROLES` remain Candidate-Mode-only with no all-false padding entries for Employee-Mode roles. Cleaner.
   - **Cost:** parallel maps (`EMPLOYEE_MODE_ACCESS`, etc.) and `canAccessMode` signature change from `(role, mode)` to `(session, mode)` so it checks both slots. Mechanical refactor, not a redesign.

   If Dani picks Option A (`roles UserRole[]`), the schema simplifies but every existing role check in the codebase becomes `roles.includes(X)` — ~100+ call sites. Audit blast radius is wrong for a P1 security ticket.

2. **[ENG] `filterCandidateForRole` stays Candidate-Mode-only.** Employee-Mode routes never call it; HR's full-access read goes through `getEmployeeDataVisibility` only. Trust contract lives in exactly one helper file. Engineering call — flagging for Dani's visibility, can override at PR review.

3. **[ENG] Per-layer visibility helper, not binary boolean.** Returns `Visibility` per layer (`full | summary | aggregated | none`). Lets PR#2 + PRO-136/137/143 extend the matrix without changing every call site. Engineering call — flagging for visibility.

4. **[ENG] `reason: "PRO-133-PR2-pending"` discriminator on stub 403s.** Grep-able in logs; lets PR#2 tests find the stubs. Engineering call — flagging for visibility.

5. **[ENG] All-false `FieldAccess` for the 4 new roles.** They never go through `filterCandidateForRole`; if they ever do, defense-in-depth strips everything. Engineering call — flagging for visibility.

6. **[REC — confirmed by audit] Note privacy: `Note.isPrivate Boolean @default(false)`.** Audit completed 2026-05-04: all 25 dev-DB notes are TA_LEADER-authored operational text (review scheduling, team discussion flags). No sensitive content found. Backwards-compat is safe. **Production-deploy caveat:** the dev audit doesn't cover real customer orgs; pre-deploy, run the same audit against prod and flip the default to `true` if sensitive content exists. The migration default is changeable via a follow-up if needed.

7. **[REC] EXECUTIVE ships with stub `/api/org/insights` returning `{}`.** Satisfies Dani's "paired positive test" guardrail with the minimum viable surface. **Caveat for the status note:** the test asserts EXECUTIVE gets 200, but `{}` doesn't actually verify EXECUTIVE sees aggregated data. Real verification ships with PRO-145. If Dani wants real verification in PRO-133, this becomes a much bigger ticket.

8. **[OPEN — needs Dani]** Auto-grant migration: should existing `ADMIN` users automatically receive `employeeRole = "HR_TALENT_LEADER"` so they get the additive behavior? `TA_LEADER` is more sensitive — auto-granting them HR access is a permission expansion. Not auto-granted by default in the current plan.

9. **[OPEN — needs Dani]** HR_TALENT_LEADER subsumes EMPLOYEE-level self-view: an HR leader looking at their own dossier hits the org-wide read path, never the EMPLOYEE self-view path. Confirming this is intended (cleanest) vs. needing a distinct self-view code path even when subsumed.

10. **[REC] Schema additions to PR#1: `User.employeeRole`, `Note.isPrivate`. Schema deferred to PR#2: `Candidate.userId`, `User.managerId`.** Per the recommended Option B + ship-soon-with-stubs pattern.

## Scope of PR#1

**In scope:**
- Migrations: 4 separate `ALTER TYPE "UserRole" ADD VALUE` (each in its own folder, matching PRO-127's HIRED pattern); add `User.employeeRole` nullable column; add `Note.isPrivate` boolean default false
- TS union: extend `AppUserRole` with 4 values
- Extend 5 RBAC maps (`ACCESS_MAP`, `ROLE_LEVEL`, `MODE_ACCESS`, `getRoleLabel`, `ASSIGNABLE_ROLES`)
- Update `CONVERT_CANDIDATE_ROLES`
- Update `AppSession.user` to include `employeeRole`; update `getSession()` to fetch it
- New `src/lib/employee-permissions.ts` with `getUserRoles(session)`, `getEmployeeDataVisibility`, `canViewAnyEmployee(session)`, `canViewManagerNotes`, stubs `isSelfView`, `isDirectReport`
- Apply gates to 6 PRO-133 TODO sites + write-gate to 2 role-profiles routes
- Stub `/api/org/insights/route.ts` returning `{}` for EXECUTIVE/HR_TALENT_LEADER (200), 403 otherwise — gives EXECUTIVE its paired positive test
- New `src/lib/__tests__/test-helpers/route-handler.ts` — thin harness for testing Next.js route handlers directly
- New unit tests: `src/lib/__tests__/rbac.test.ts`, `src/lib/__tests__/employee-permissions.test.ts`
- New integration tests: `src/app/api/employees/__tests__/employees.route.test.ts`, `src/app/api/org/insights/__tests__/insights.route.test.ts`

**Explicitly NOT in PR#1** (call out in PR description):
- No `Candidate.userId` column or backfill
- No `User.managerId` self-FK
- No conversion-flow integration creating EMPLOYEE-role users on convert
- EMPLOYEE self-view route returns 403 with `reason: "PRO-133-PR2-pending"`
- PEOPLE_MANAGER scoping returns same 403 stub
- Real EXECUTIVE org-wide aggregations come from PRO-145; PR#1 ships a stub returning `{}`
- No invite-flow dropdown UI for the new roles (file follow-up ticket)
- No audit-log events for role assignment changes (PRO-134 territory)

## Files to modify / create

**Schema (3 migrations under Option B'):**
- `prisma/schema.prisma` — leave `UserRole` enum unchanged; add new `EmployeeUserRole` enum with 4 values; add `User.employeeRole EmployeeUserRole?`; add `Note.isPrivate Boolean @default(false)` (default value pending recon item #2)
- `prisma/migrations/20260504_pro_133_create_employee_user_role/migration.sql` (new) — `CREATE TYPE "EmployeeUserRole" AS ENUM ('EMPLOYEE', 'PEOPLE_MANAGER', 'HR_TALENT_LEADER', 'EXECUTIVE')`
- `prisma/migrations/20260504_pro_133_add_employee_role_column/migration.sql` (new) — `ALTER TABLE "User" ADD COLUMN "employeeRole" "EmployeeUserRole"`
- `prisma/migrations/20260504_pro_133_add_note_is_private/migration.sql` (new) — `ALTER TABLE "Note" ADD COLUMN "isPrivate" BOOLEAN NOT NULL DEFAULT false` (audit 2026-05-04 confirmed dev-DB notes are operational, not sensitive)

**Auth + RBAC core (two-enum approach):**
- `src/lib/rbac.ts`:
  - Add new TS type `AppEmployeeUserRole = "EMPLOYEE" | "PEOPLE_MANAGER" | "HR_TALENT_LEADER" | "EXECUTIVE"` (line 2 area)
  - `AppUserRole` stays unchanged (6 values, Candidate Mode)
  - `ACCESS_MAP`, `ROLE_LEVEL`, `ASSIGNABLE_ROLES`, existing `MODE_ACCESS` — **no changes** (stay 6-entry, Candidate-Mode only)
  - Add new `EMPLOYEE_MODE_ACCESS: Record<AppEmployeeUserRole, DashboardMode[]>` parallel to `MODE_ACCESS`
  - Add new `ASSIGNABLE_EMPLOYEE_ROLES: AppEmployeeUserRole[]` (PEOPLE_MANAGER, HR_TALENT_LEADER, EXECUTIVE — NOT EMPLOYEE)
  - Update `canAccessMode` signature from `(role, mode)` to `(session, mode)` — checks both `session.user.role` and `session.user.employeeRole`
  - Update `getRoleLabel` to accept `AppUserRole | AppEmployeeUserRole` (union)
  - Update `CONVERT_CANDIDATE_ROLES` — keep as `AppUserRole[]` (RECRUITING_MANAGER, TA_LEADER, ADMIN), but `canConvertCandidate` now takes session and additionally checks `session.user.employeeRole === "PEOPLE_MANAGER" || session.user.employeeRole === "HR_TALENT_LEADER"`
- `src/lib/auth.ts` — extend `AppSession.user` with `employeeRole: AppEmployeeUserRole | null`; update `getSession()` to select and pass it from Prisma

**New helper:**
- `src/lib/employee-permissions.ts` (new)

**New stub endpoint:**
- `src/app/api/org/insights/route.ts` (new) — returns `{}` for EXECUTIVE/HR_TALENT_LEADER, 403 otherwise (stub for PRO-145 to replace)

**Gate sites (6 PRO-133 TODOs + 2 role-profiles writes):**
- `src/app/api/employees/route.ts` (line 15-16)
- `src/app/(dashboard)/employees/[id]/page.tsx` (line 21-22)
- `src/app/api/employees/[id]/evidence/route.ts` (line 14)
- `src/app/api/employees/[id]/evidence/[construct]/route.ts` (line 23)
- `src/app/api/employees/[id]/cognitive-signature/route.ts` (line 14)
- `src/lib/rbac.ts:294` — `CONVERT_CANDIDATE_ROLES` extension
- `src/app/api/role-profiles/route.ts` (line 58 + 86) — write-gate (HR_TALENT_LEADER + TA_LEADER + ADMIN only on POST/PUT/DELETE)
- `src/app/api/role-profiles/[id]/route.ts` (line 50) — same write-gate

**Test infrastructure (new):**
- `src/lib/__tests__/test-helpers/route-handler.ts` — `invokeRoute(handler, { session, body, params })` returns `Response`
- `src/lib/__tests__/test-helpers/route-handler.test.ts` — **harness self-test** against a known-trivial route handler so failures in integration tests can be diagnosed as route-bug vs. harness-bug
- `src/lib/__tests__/test-helpers/fixtures.ts` — user-fixture helpers including the cross-mode `userWithRoles(roleA, roleB)` builder
- `src/lib/__tests__/rbac.test.ts`
- `src/lib/__tests__/employee-permissions.test.ts`
- `src/app/api/employees/__tests__/employees.route.test.ts` (integration)
- `src/app/api/org/insights/__tests__/insights.route.test.ts` (integration)

## Concrete map values (two-enum approach)

```ts
// New type union — Employee Mode roles only
export type AppEmployeeUserRole =
  | "EMPLOYEE"
  | "PEOPLE_MANAGER"
  | "HR_TALENT_LEADER"
  | "EXECUTIVE";

// New parallel map — Employee Mode mode access
const EMPLOYEE_MODE_ACCESS: Record<AppEmployeeUserRole, DashboardMode[]> = {
  EMPLOYEE: ["employees"],
  PEOPLE_MANAGER: ["employees"],
  HR_TALENT_LEADER: ["candidates", "employees"],
  EXECUTIVE: ["employees"],
};

// New parallel list — Employee Mode roles assignable by org admins
const ASSIGNABLE_EMPLOYEE_ROLES: AppEmployeeUserRole[] = [
  "PEOPLE_MANAGER", "HR_TALENT_LEADER", "EXECUTIVE",
  // NOT EMPLOYEE — auto-assigned at conversion in PR#2 (mirrors EXTERNAL_COLLABORATOR pattern)
];

// getRoleLabel(role: AppUserRole | AppEmployeeUserRole)
//   "Employee", "People Manager", "HR / Talent Leader", "Executive"

// canConvertCandidate(session) — now checks both slots:
//   session.user.role ∈ {RECRUITING_MANAGER, TA_LEADER, ADMIN} OR
//   session.user.employeeRole ∈ {PEOPLE_MANAGER, HR_TALENT_LEADER}

// canAccessMode(session, mode) — also checks both slots:
//   MODE_ACCESS[session.user.role]?.includes(mode) OR
//   (session.user.employeeRole && EMPLOYEE_MODE_ACCESS[session.user.employeeRole]?.includes(mode))

// EXISTING MAPS UNCHANGED:
//   ACCESS_MAP — 6-entry Candidate-Mode FieldAccess (no padding)
//   ROLE_LEVEL — 6-entry Candidate-Mode admin-power (no padding)
//   ASSIGNABLE_ROLES — 6-entry Candidate-Mode (no padding)
//   Employee-Mode access lives in employee-permissions.ts only
```

## Multi-role helper API

```ts
// src/lib/employee-permissions.ts

/**
 * Returns the union of all roles assigned to this user across role slots.
 * Returns a mixed array of Candidate-Mode and Employee-Mode roles.
 * Behaves identically to a future `roles[]` migration if Option A becomes
 * preferable later — call sites consume an array, so the storage shape
 * (dual-column vs array column) is encapsulated here.
 */
export function getUserRoles(session: AppSession): (AppUserRole | AppEmployeeUserRole)[] {
  const out: (AppUserRole | AppEmployeeUserRole)[] = [session.user.role];
  if (session.user.employeeRole) out.push(session.user.employeeRole);
  return out;
}

/**
 * Data layers that have visibility levels (full | summary | aggregated | none).
 *
 * NOTE: `managerNotes` is intentionally NOT in this union. Notes are gated
 * per-row via `canViewManagerNotes(ctx, note)` against `note.authorId` and
 * `note.isPrivate` — that's a different access shape than visibility levels,
 * and conflating them is the kind of mistake that would route a private-note
 * read through the matrix and accidentally permit it. Type system enforces
 * the distinction: callers asking about notes are forced to use the right
 * helper.
 */
export type EmployeeDataLayer =
  | "constructs" | "compositeScores" | "blindSpots" | "developmentPlan"
  | "evidence" | "cognitiveSignature" | "roleFitRadar";

export type Visibility = "full" | "summary" | "aggregated" | "none";

export interface EmployeeAccessContext {
  session: AppSession;
  targetEmployeeUserId?: string | null;       // PR#2: Candidate.userId
  targetEmployeeManagerId?: string | null;    // PR#2: User.managerId
}

/**
 * Spec Section 6 matrix encoded as a literal const so the spec-to-code
 * translation is auditable at a glance. PR#1 ships this matrix; PR#2
 * unlocks EMPLOYEE/PEOPLE_MANAGER cells once their data linkages exist.
 *
 * Cells marked with PR#1 stub posture (currently "none") are flagged
 * inline; flip them in PR#2.
 */
const VISIBILITY_MATRIX: Record<EmployeeDataLayer, Record<AppEmployeeUserRole, Visibility>> = {
  constructs: {
    EMPLOYEE: "none",         // PR#2: → "full" (self-view)
    PEOPLE_MANAGER: "none",   // PR#2: → "full" (own reports)
    HR_TALENT_LEADER: "full",
    EXECUTIVE: "aggregated",
  },
  compositeScores: { /* same shape */ EMPLOYEE: "none", PEOPLE_MANAGER: "none", HR_TALENT_LEADER: "full", EXECUTIVE: "aggregated" },
  blindSpots: {
    EMPLOYEE: "none",         // PR#2: → "full" (gentle framing for self)
    PEOPLE_MANAGER: "none",   // PR#2: → "summary" (no raw confidence)
    HR_TALENT_LEADER: "summary",  // ← PR#1 active. PRO-143 must call stripBlindSpotForVisibility
    EXECUTIVE: "none",
  },
  developmentPlan: { EMPLOYEE: "none", PEOPLE_MANAGER: "none", HR_TALENT_LEADER: "full", EXECUTIVE: "none" },
  // managerNotes is NOT in this matrix — per-row author check via canViewManagerNotes
  evidence: { EMPLOYEE: "none", PEOPLE_MANAGER: "none", HR_TALENT_LEADER: "full", EXECUTIVE: "aggregated" },
  cognitiveSignature: { EMPLOYEE: "none", PEOPLE_MANAGER: "none", HR_TALENT_LEADER: "full", EXECUTIVE: "aggregated" },
  roleFitRadar: { EMPLOYEE: "none", PEOPLE_MANAGER: "none", HR_TALENT_LEADER: "full", EXECUTIVE: "aggregated" },
};

const VISIBILITY_RANK: Record<Visibility, number> = {
  none: 0, aggregated: 1, summary: 2, full: 3,
};

export function getEmployeeDataVisibility(
  layer: EmployeeDataLayer,
  ctx: EmployeeAccessContext,
): Visibility {
  // Cross-mode users: highest visibility wins across both role slots.
  // Candidate-Mode roles (TA_LEADER/ADMIN/HIRING_MANAGER) are mapped to
  // HR_TALENT_LEADER-equivalent visibility for Employee-Mode layers via
  // a small adapter — keeps the matrix Employee-Mode-keyed for clarity.
  const employeeRole = ctx.session.user.employeeRole;
  const candidateRoleAsEmployeeEquivalent: AppEmployeeUserRole | null =
    (["TA_LEADER", "ADMIN", "HIRING_MANAGER"] as const).includes(ctx.session.user.role as never)
      ? "HR_TALENT_LEADER"
      : null;

  const candidates: Visibility[] = [];
  if (employeeRole) candidates.push(VISIBILITY_MATRIX[layer][employeeRole]);
  if (candidateRoleAsEmployeeEquivalent) candidates.push(VISIBILITY_MATRIX[layer][candidateRoleAsEmployeeEquivalent]);
  if (candidates.length === 0) return "none";

  return candidates.reduce((best, v) => VISIBILITY_RANK[v] > VISIBILITY_RANK[best] ? v : best, "none" as Visibility);
}

// `as const` narrows the includes() check to known role strings, so a typo
// like "HR_TALENT_LEADR" fails at compile time. Trust-contract code; the
// extra strictness is worth the noise.
const ALLOWED_EMPLOYEE_VIEWERS = [
  "TA_LEADER", "ADMIN", "HIRING_MANAGER", "HR_TALENT_LEADER",
] as const;

export function canViewAnyEmployee(session: AppSession): boolean {
  const roles = getUserRoles(session);
  // PR#1: any of TA_LEADER, ADMIN, HIRING_MANAGER, HR_TALENT_LEADER → true
  // EMPLOYEE/PEOPLE_MANAGER/EXECUTIVE → false (PR#2 wires self-view + scoping)
  return roles.some(r => (ALLOWED_EMPLOYEE_VIEWERS as readonly string[]).includes(r));
}

export function canViewManagerNotes(
  ctx: EmployeeAccessContext,
  note: { authorId: string; isPrivate: boolean },
): boolean {
  // CRITICAL trust-contract gate
  if (!note.isPrivate) return canViewAnyEmployee(ctx.session); // public notes follow general read
  return ctx.session.user.id === note.authorId; // private notes: author only
}

const ALLOWED_ORG_INSIGHTS_VIEWERS = [
  "HR_TALENT_LEADER", "EXECUTIVE", "TA_LEADER", "ADMIN",
] as const;

export function canViewOrgInsights(session: AppSession): boolean {
  const roles = getUserRoles(session);
  return roles.some(r => (ALLOWED_ORG_INSIGHTS_VIEWERS as readonly string[]).includes(r));
}

export function isSelfView(_ctx: EmployeeAccessContext): boolean { return false; } // PR#1 stub
export function isDirectReport(_ctx: EmployeeAccessContext): boolean { return false; } // PR#1 stub

/**
 * Strip blind-spot data based on visibility level. Closes Dani's guardrail #4
 * at the API layer in PR#1: PRO-143 (Blind-Spot Map ticket) MUST call this
 * helper at the API-layer endpoint — never hide raw confidence scores in the
 * UI alone. If a future PR misses calling this, that's visible at PR review
 * (no obvious place where raw confidence gets stripped).
 */
export function stripBlindSpotForVisibility<T extends { confidence?: number; rawScore?: number }>(
  data: T,
  visibility: Visibility,
): Partial<T> {
  if (visibility === "none") return {};
  if (visibility === "summary") {
    const { confidence: _c, rawScore: _r, ...rest } = data;
    return rest;
  }
  return data; // "full" or "aggregated" — full returns everything; aggregated unreachable here in PR#1
}
```

## Gate-site change shape

Two helpers, one responsibility each:

```ts
// src/lib/employee-permissions.ts

/** Mode-level gate: can this user enter Employee Mode at all (any role slot)? */
export function canEnterEmployeeMode(session: AppSession): boolean {
  return getUserRoles(session).some(r => MODE_ACCESS[r]?.includes("employees"));
}

/** Stub-403 marker for routes EMPLOYEE/PEOPLE_MANAGER hit pre-PR#2. */
export const PR2_PENDING_REASON = "PRO-133-PR2-pending";
```

```ts
// At every gate site:
import { canEnterEmployeeMode, canViewAnyEmployee, PR2_PENDING_REASON } from "@/lib/employee-permissions";

if (!canEnterEmployeeMode(session)) {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}
if (!canViewAnyEmployee(session)) {
  return NextResponse.json(
    { error: "Forbidden", reason: PR2_PENDING_REASON },
    { status: 403 },
  );
}
```

Two checks, two intents: mode-level gate (Are you allowed in this surface?) and capability gate (Can you actually see employee data, or are you a PR#2-pending stub?). Each forbidden response shape is distinct.

## Stub aggregated endpoint

`src/app/api/org/insights/route.ts`:

```ts
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { canViewOrgInsights } from "@/lib/employee-permissions";

export const GET = async () => {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canViewOrgInsights(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  // PRO-145 will replace this body with real aggregated org-level distributions.
  return NextResponse.json({});
};
```

This satisfies Dani's requirement (3): EXECUTIVE has at least one endpoint that returns 200, so the role doesn't look broken.

## Test plan — addressing all 4 of Dani's guardrails

**`src/lib/__tests__/test-helpers/route-handler.ts`** — establishes the integration test pattern Dani required:

```ts
export async function invokeRoute(
  handler: (req: Request, ctx?: { params: Promise<Record<string, string>> }) => Promise<Response>,
  opts: { session: AppSession | null; body?: unknown; params?: Record<string, string>; searchParams?: Record<string, string> },
): Promise<Response> {
  // mock getSession() via vi.mock
  // construct Request with body/searchParams
  // invoke handler with params Promise
  // return response
}
```

**Unit tests** (`src/lib/__tests__/rbac.test.ts`):
- Exhaustiveness: every `Record<AppUserRole, …>` map has all 10 keys
- `MODE_ACCESS` parametrized per role
- `canConvertCandidate`: PEOPLE_MANAGER ✓, HR_TALENT_LEADER ✓, EMPLOYEE ✗, EXECUTIVE ✗
- `canAssignRole`: EMPLOYEE never assignable; HR_TALENT_LEADER assignable by ADMIN; PEOPLE_MANAGER by TA_LEADER+
- `filterCandidateForRole`: confirms 4 new roles get fully-stripped Candidate-Mode payloads

**Unit tests** (`src/lib/__tests__/employee-permissions.test.ts`):
- **Trust-contract (non-negotiable):**
  - `test.each(allRoles)("%s never sees private managerNotes from another author")`
  - `it("note author always sees own private notes regardless of role")`
  - `it("public notes follow canViewAnyEmployee")`
- **Cross-mode collision (Dani requirement #2):**
  - `it("user with role=TA_LEADER + employeeRole=HR_TALENT_LEADER passes canViewAnyEmployee")`
  - `it("user with role=TA_LEADER + employeeRole=null passes canViewAnyEmployee via Candidate Mode")`
  - `it("user with role=RECRUITER_COORDINATOR + employeeRole=HR_TALENT_LEADER passes via Employee Mode")`
  - `it("user with role=RECRUITER_COORDINATOR + employeeRole=null fails canViewAnyEmployee")`
  - `it("getEmployeeDataVisibility takes the highest-visibility role across both")`
- `getEmployeeDataVisibility` per layer:
  - HR_TALENT_LEADER returns `"full"` for every layer except `managerNotes`
  - EMPLOYEE/PEOPLE_MANAGER/EXECUTIVE return `"none"` everywhere in PR#1 stub posture
  - `getEmployeeDataVisibility("blindSpots", PEOPLE_MANAGER)` returns `"summary"`
- **`stripBlindSpotForVisibility` (Dani requirement #4 — closed in PR#1):**
  - `it("returns empty object for visibility='none'")`
  - `it("strips confidence and rawScore for visibility='summary'")` — verifies API-layer enforcement
  - `it("returns full object for visibility='full'")`
  - `it("preserves non-stripped fields under summary")`
  - PR description must explicitly call out: "PRO-143 endpoint MUST call `stripBlindSpotForVisibility(data, getEmployeeDataVisibility('blindSpots', ctx))`. PR review check: grep PRO-143's blind-spot route for the wrapper call."

**Integration tests** (Dani requirement #1):

`src/app/api/employees/__tests__/employees.route.test.ts`:
- All 10 roles → expected status code on `GET /api/employees`
- All 10 roles → expected status code on `GET /api/employees/[id]`
- Cross-mode user (TA_LEADER + HR_TALENT_LEADER) → 200 with full payload
- EMPLOYEE → 403 with `reason: "PRO-133-PR2-pending"` in body
- HR_TALENT_LEADER → 200, response payload contains expected employee data
- HR_TALENT_LEADER → 200, but `notes` array filtered to exclude `isPrivate: true` notes
- Note author → 200, `notes` includes their own private notes only

`src/app/api/org/insights/__tests__/insights.route.test.ts` (Dani requirement #3 — the EXECUTIVE positive test):
- EXECUTIVE → 200 with `{}` body (paired positive)
- HR_TALENT_LEADER → 200 with `{}` body
- EMPLOYEE/PEOPLE_MANAGER/RECRUITER_COORDINATOR → 403
- TA_LEADER → 200 (Candidate-Mode admin retains org-insights)

Test runner: `npx vitest run src/lib/__tests__/ src/app/api/`.

## Verification

1. `npx tsc --noEmit` — exhaustiveness on `Record<AppUserRole, …>` will fail loudly on any missed role
2. `npx prisma migrate dev --name pro_133_employee_mode_rbac` (Joel runs — write op)
3. `npx prisma generate`
4. `npx vitest run src/lib/__tests__/ src/app/api/`
5. `npm run build`
6. Manual via dev-mode role impersonation cookie:
   - `__dev_role=HR_TALENT_LEADER` → `GET /api/employees` returns 200
   - `__dev_role=EMPLOYEE` → `GET /api/employees/[id]` returns 403 with `reason: "PRO-133-PR2-pending"`
   - `__dev_role=EXECUTIVE` → `GET /api/employees/[id]` returns 403; `GET /api/org/insights` returns 200 with `{}`
7. Existing PRO-134 audit script (`scripts/audit-employee-mode-vocabulary.ts`) — run to confirm no vocabulary regressions
8. Postgres version check: `SELECT version()`; need ≥12 for `ALTER TYPE ADD VALUE`. Prisma 7.4.1 handles transaction-wrapping automatically per release notes.

## Branch + PR

- **Branch:** `feat/pro-133-employee-mode-rbac` (matches `feat/pro-NNN-…` convention)
- **Commits (4, logical units):**
  1. `feat(rbac): add EmployeeUserRole enum + employeeRole column + Note.isPrivate (PRO-133)` — schema + 3 migrations only; no hand-written TS code touches yet. **Run `npx prisma generate` as part of this commit's verification** so the generated client picks up the new fields and existing call sites (e.g., `prisma.user.findUnique({ select: ... })`) compile against the new shape. Without the regenerate, commit 2's signature changes can't reach the actual data.
  2. `feat(rbac): add EMPLOYEE_MODE_ACCESS, ASSIGNABLE_EMPLOYEE_ROLES, update canAccessMode signature, propagate to all callers (PRO-133)` — RBAC maps + signature change + every existing call site updated to pass session in the same commit (so `tsc --noEmit` stays green at every commit boundary)
  3. `feat(rbac): add employee-permissions helper (incl. VISIBILITY_MATRIX + stripBlindSpotForVisibility) + AppSession.employeeRole + stub /api/org/insights + apply gates to 8 PRO-133 callsites (PRO-133)` — helpers + stub endpoint + replace TODO(PRO-133) sites with new gate shape
  4. `test(rbac): integration test harness + harness self-test + cross-mode collision + EXECUTIVE positive + trust-contract suite (PRO-133)` — full test surface

  Note: each commit must independently pass `npx tsc --noEmit`. Commit 2 in particular must update **every** caller of `canAccessMode` in the same commit — incomplete signature changes break the build at the commit boundary.
- **PR title:** `FEAT(PRO-133): Employee Mode RBAC — permission model + multi-role schema (PR 1/2)`
- **PR body** must call out:
  - Trust-contract guarantee (link to `canViewManagerNotes` test)
  - Two-PR strategy with explicit "NOT in PR#1" list
  - Reviewers should grep `PRO-133-PR2-pending` to find intentional stubs
  - Dani's 4 guardrails + which test addresses each
  - **Cross-link to PRO-87** (separate, smaller PR awaiting merge — independent of this work; merge order doesn't matter)

## Risks

1. **Trust-contract leak via cross-mode user.** A TA_LEADER + HR_TALENT_LEADER user must NOT see other authors' private notes via the additive role check. Mitigation: `canViewManagerNotes` ignores roles entirely for `isPrivate: true` notes, only checks `viewerId === authorId`. Test: parametrized over all 10 roles.
2. **Trust-contract typo class.** `roles.some(r => ["TA_LEADER", ...].includes(r))` patterns silently accept typos because the literal array widens to `string[]`. Mitigation: every role-list literal in `employee-permissions.ts` uses `as const` so `.includes()` narrows to known members. Catches typos at compile time.
3. **Missed exhaustiveness in `Record<AppEmployeeUserRole, …>` somewhere.** Mitigation: TS strict mode catches at compile time; runtime sanity test asserts `Object.keys(map).sort()` equals expected list. Two-enum shape adds parallel exhaustiveness checks for each map.
4. **`CREATE TYPE EmployeeUserRole` collision** if a previous migration accidentally created the type. Unlikely (no prior PRO-133 work has landed) but worth verifying with `\dT EmployeeUserRole` against the dev DB before running the migration.
5. **Existing TA_LEADER/ADMIN/HIRING_MANAGER lose Employee Mode access.** They DON'T in PR#1 — they retain access via existing `MODE_ACCESS` + `canViewAnyEmployee` includes them. **No rollout migration needed for PR#1.** PR#2 is when they may need to be granted explicit `employeeRole` values; defer that decision.
6. **Dev-impersonation cookie** (`auth.ts:53-56`) currently uses `Object.keys(ROLE_LEVEL)` — under two-enum approach this only includes Candidate-Mode roles. Need to extend to also accept Employee-Mode role values from `EMPLOYEE_MODE_ACCESS`. Add to commit 3 scope.
7. **Stub `/api/org/insights` returning `{}` ships behavior PRO-145 must not regress.** Document in stub file: "PRO-145 replaces body, must keep gate as-is."

(Removed the previous "Postgres ALTER TYPE in transaction" risk — under the two-enum approach there are zero `ALTER TYPE ADD VALUE` migrations. `CREATE TYPE` and `ALTER TABLE ADD COLUMN` work on every PG version Prisma supports.)

## Recon while waiting (do today regardless of Dani's answers)

These items are useful no matter which architectural path Dani picks. Run in parallel with the status note going out.

**Critical ordering:** recon item #2 (Note table audit) MUST complete before the migration file is written. The audit result determines the `Note.isPrivate` default. Migration commits should not be drafted until that data is in hand.

1. ✅ **Enumerate every `TODO(PRO-133)` callsite** — done. 6 explicit + 2 implicit (role-profiles writes).
2. ✅ **Audit existing `Note` rows in dev DB** — done 2026-05-04. **Verdict: `isPrivate` default = `false`.** All 25 notes in dev DB are TA_LEADER-authored operational text (`"Reviewed X's assessment. Strong candidate — schedule follow-up."` / `"Flag for team discussion."`). No sensitive content. Backwards-compat wins; authors can opt private new notes via `isPrivate: true`. **Caveat to ship in PR description:** dev-DB audit only — production note audit should happen pre-deploy. If real customer orgs have sensitive note content, the default may need to flip.
3. ⏸️ **Sketch the cross-mode test fixture** — a `User` with `role = "TA_LEADER"` and `employeeRole = "HR_TALENT_LEADER"` simultaneously. Even before schema lands, the fixture API shape informs the schema. Goes in `src/lib/__tests__/test-helpers/fixtures.ts`.
4. ⏸️ **Map the route × role × data-layer matrix** — ~50 cells per spec Section 6. Some collapse (EXECUTIVE 403 on every individual route is one parametrized test, not 5). The list IS the test plan; produce it before writing any test code.

These are 2-3 hours of work that won't be wasted. Send the status note, run recon in parallel, and PR#1 is ready to write the moment Dani confirms decisions.

## Status note for Dani (paste-ready)

> @dani — progress note as requested.
>
> **Current branch state:** no code yet. PRO-133 is the active piece; have spent the past several days on architecture review and PRO-87/PRO-137 unblock work, all converging on this ticket now.
>
> **What's landed:** 0/11 ACs in code. The bottleneck is the architecture confirmation below, not the implementation — schema shape changes the migration shape.
>
> **What's still open:** all 11 ACs. Mapped to ship targets in the plan (8 in PR#1, 2 in PR#2, 1 spans PR#1 helper + PRO-143 consumer).
>
> **Plan for the next 24 hours:**
> - **Recon I can do without your input** (~2-3 hours, starting now): audit existing `Note` rows in the dev DB to inform the `isPrivate` default (recon completes BEFORE any migration file is written), sketch the cross-mode test fixture API, map the full route × role × data-layer test matrix.
> - **If I have your decisions on the 6 questions below by EOD tomorrow (2026-05-04):** PR#1 (schema + helpers + stub aggregated endpoint + integration test harness + gates on existing routes) ships by EOW. PR#2 (Candidate.userId + User.managerId + EMPLOYEE/PEOPLE_MANAGER scoping) early next week.
> - **If I don't have decisions by EOD tomorrow:** I'll proceed against my recommendations and document the assumptions in the PR description. Faster path; rework risk if you wanted differently.
>
> **6 decisions still open from the architecture doc:**
> 1. **Roles model** — Option (A) `User.roles UserRole[]` vs. Option (B) dual-column `User.role + User.employeeRole`. **My rec: B** with a refinement: **two separate Prisma enums** (existing `UserRole` unchanged, new `EmployeeUserRole` with 4 values). Reduces 6 migrations → 3, prevents nonsensical pairs like `role=TA_LEADER, employeeRole=TA_LEADER` at the type system level. Trade-off: parallel maps for Employee Mode (`EMPLOYEE_MODE_ACCESS`, `ASSIGNABLE_EMPLOYEE_ROLES`) and `canAccessMode` signature changes from `(role, mode)` to `(session, mode)`. Mechanical refactor, not a redesign.
> 2. **EXECUTIVE in PR#1** — ship the gate empty-handed (stub `/api/org/insights` returning `{}` so the role has a 200 to prove against), or defer EXECUTIVE entirely until PRO-145 endpoints land? **My rec: ship the gate.** Caveat: the test asserts EXECUTIVE gets 200 but `{}` doesn't verify aggregated data shape — real verification ships with PRO-145.
> 3. **Auto-grant migration** — should existing ADMIN users automatically receive `employeeRole = "HR_TALENT_LEADER"` on deploy? TA_LEADER is more sensitive (silent permission expansion). **My rec: don't auto-grant either.** Existing roles retain Employee Mode access via the existing `MODE_ACCESS` map; explicit grant happens via the team-management flow.
> 4. **`Note.isPrivate` default** — audit done. **Recommend `false`.** All 25 dev-DB notes are TA_LEADER-authored operational text (review scheduling / team discussion flags); no sensitive content. Pre-prod-deploy I'll re-run the audit against prod; if real customer notes look sensitive there, we flip via a follow-up migration. Default approval: `false`.
> 5. **HR_TALENT_LEADER subsumes EMPLOYEE self-view?** An HR leader viewing their own dossier hits the org-wide path, not a distinct self-view path. Confirming this is intended (cleanest), vs. needing a separate self-view code path even when subsumed.
> 6. **Schema additions for PR#1** — confirming `User.employeeRole EmployeeUserRole?` + `Note.isPrivate Boolean default ???` are approved for this PR. (`Candidate.userId` and `User.managerId` deferred to PR#2 per the two-PR plan.)
>
> **Your 4 feedback items — all noted, folding into the plan:**
> 1. Integration tests on real route handlers — building a thin `invokeRoute(handler, { session, body, params })` harness in `src/lib/__tests__/test-helpers/`. Includes a harness self-test so failures can be diagnosed as route-bug vs. harness-bug. Pattern doesn't exist in the repo yet; PR#1 ships it for PRO-133 + future tickets reuse it.
> 2. Cross-mode collision tests — adding TA_LEADER + HR_TALENT_LEADER and three other dual-role combinations to the matrix. Two-enum schema (#1 above) makes the fixture cleaner.
> 3. EXECUTIVE 403 paired with positive — caveat per #2 above: stub returns `{}`, real verification ships with PRO-145. Flagging now to avoid surprise at PR review.
> 4. **Blind-spot map summary-vs-full at API layer — actually closing this guardrail in PR#1, not deferring.** Shipping `stripBlindSpotForVisibility(data, visibility)` wrapper helper in `employee-permissions.ts` plus a unit test asserting confidence/rawScore strip under "summary" visibility. PRO-143's blind-spot route MUST call this wrapper at the API layer — if it doesn't, that's visible at PR review (no other place where stripping happens).
>
> Will ping you tomorrow if I haven't heard back on the 6 decisions.

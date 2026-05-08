-- PRO-133: Employee Mode RBAC — multi-role schema + Note privacy
--
-- Three schema changes (atomic, in one migration):
--   1. CREATE TYPE EmployeeUserRole — 4 Employee Mode role values
--   2. ALTER TABLE User ADD COLUMN employeeRole — nullable; existing
--      users are unchanged. Population happens via the team-management
--      flow (separate UI ticket); no auto-grant on deploy.
--   3. ALTER TABLE Note ADD COLUMN isPrivate — defaults to false for
--      backwards compatibility with existing notes.
--
-- ┌──────────────────────────────────────────────────────────────────────┐
-- │ PROD-DEPLOY GATE (Dani 2026-05-07):                                  │
-- │                                                                      │
-- │ Re-run the Note table audit against PRODUCTION before this migration │
-- │ runs in prod. If any production note contains sensitive content      │
-- │ ("manager's private impressions" rather than operational text),      │
-- │ ship a follow-up migration flipping the default to TRUE before this  │
-- │ column-add lands in prod.                                            │
-- │                                                                      │
-- │ Dev-DB audit 2026-05-04 found only 25 rows of benign TA_LEADER       │
-- │ operational text (review scheduling, team discussion flags); the     │
-- │ default=false migration is safe for dev. Prod state is unverified.   │
-- │                                                                      │
-- │ DO NOT MERGE PR#1 TO PROD WITHOUT THIS AUDIT.                        │
-- └──────────────────────────────────────────────────────────────────────┘

-- ─── 1. New enum: Employee Mode roles ──────────────────────────
CREATE TYPE "EmployeeUserRole" AS ENUM (
  'EMPLOYEE',
  'PEOPLE_MANAGER',
  'HR_TALENT_LEADER',
  'EXECUTIVE'
);

-- ─── 2. User.employeeRole: nullable Employee Mode slot ─────────
ALTER TABLE "User" ADD COLUMN "employeeRole" "EmployeeUserRole";

-- ─── 3. Note.isPrivate: per-row author-private flag ────────────
ALTER TABLE "Note" ADD COLUMN "isPrivate" BOOLEAN NOT NULL DEFAULT false;

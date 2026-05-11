-- PRO-133 PR#2: Candidate↔User linkage + manager hierarchy
--
-- ⚠️ DO NOT APPLY TO PROD WITHOUT FOLLOWING THE RUNBOOK:
--    docs/runbooks/pro-133-prod-deploy.md (covers both PR#1 and PR#2)
--
-- Two schema changes (atomic, in one migration):
--   1. ALTER TABLE Candidate ADD COLUMN userId — nullable, unique FK to User.
--      Populated at conversion time via lazy email-match (PR#2 commit 4).
--      One Candidate maps to at most one User → UNIQUE constraint.
--   2. ALTER TABLE User ADD COLUMN managerId — nullable self-FK to User.
--      Single-hop manager pointer for PEOPLE_MANAGER direct-report scoping.
--      Indexed for query performance on PEOPLE_MANAGER list filtering.
--
-- Both columns are nullable + additive — old code is forward-compatible.
-- Schema rollback drops both columns + indexes; safe.

-- ─── 1. Candidate.userId: nullable unique FK to User ───────────
ALTER TABLE "Candidate" ADD COLUMN "userId" TEXT;
ALTER TABLE "Candidate" ADD CONSTRAINT "Candidate_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL;
CREATE UNIQUE INDEX "Candidate_userId_key" ON "Candidate"("userId");

-- ─── 2. User.managerId: nullable self-FK + index ───────────────
ALTER TABLE "User" ADD COLUMN "managerId" TEXT;
ALTER TABLE "User" ADD CONSTRAINT "User_managerId_fkey"
  FOREIGN KEY ("managerId") REFERENCES "User"("id") ON DELETE SET NULL;
CREATE INDEX "User_managerId_idx" ON "User"("managerId");

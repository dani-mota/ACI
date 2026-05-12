-- PRO-137: EmployeeInsights table.
--
-- ⚠️ DO NOT APPLY TO PROD WITHOUT FOLLOWING THE RUNBOOK:
--    docs/runbooks/pro-137-prod-deploy.md
--
-- Adds a single derivative-scores table for PRO-137 (under-leverage),
-- PRO-138 (trajectory readiness), and PRO-139 (fit panels). Sets the
-- pattern: each future ticket adds a sibling Int? column on this table
-- instead of accumulating columns on Assessment.
--
-- All columns nullable + additive. Old code is forward-compatible (no
-- existing code references the table). No backfill — rows are created
-- lazily on first conversion / dossier read / profile-save touch.
-- Schema rollback drops the table + indexes; safe.

CREATE TABLE "EmployeeInsights" (
  "id"                  TEXT NOT NULL,
  "assessmentId"        TEXT NOT NULL,
  -- PRO-137: under-leverage score on 0-100 scale. Null when no resolvable
  -- role-demand profile exists for the employee's roleFamily.
  "underLeverageScore"  INTEGER,
  -- Denormalized from Assessment.candidate.orgId + Assessment.roleFamily.
  -- The duplication is intentional — see schema.prisma EmployeeInsights
  -- header comment for the trade-off.
  "orgId"               TEXT NOT NULL,
  "roleFamily"          TEXT,
  -- Staleness signal compared against ResolvedRoleDemand at read time.
  -- NULL after profile save → next dossier read recomputes.
  "profileId"           TEXT,
  "profileUpdatedAt"    TIMESTAMP(3),
  "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"           TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EmployeeInsights_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EmployeeInsights_assessmentId_key"
  ON "EmployeeInsights"("assessmentId");

ALTER TABLE "EmployeeInsights"
  ADD CONSTRAINT "EmployeeInsights_assessmentId_fkey"
  FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE CASCADE;

-- Batch invalidation hot path: UPDATE ... WHERE orgId = ? AND LOWER(roleFamily) = LOWER(?)
CREATE INDEX "EmployeeInsights_orgId_roleFamily_idx"
  ON "EmployeeInsights"("orgId", "roleFamily");

-- List-sort hot path: People Table sort by underLeverageScore within an org.
CREATE INDEX "EmployeeInsights_orgId_underLeverageScore_idx"
  ON "EmployeeInsights"("orgId", "underLeverageScore");

-- PRO-135: Role Cognitive Demand Profiles
--
-- Org-scoped table holding per-role 1-10 construct demand maps. Drives the
-- Construct Map dual-polygon overlay on Employee Dossier (Layer 2). Resolved
-- case-insensitively against Assessment.roleFamily; the functional partial
-- index below keeps that resolution off a sequential scan.

CREATE TABLE "RoleDemandProfile" (
  "id"              TEXT      NOT NULL,
  "name"            TEXT      NOT NULL,
  "roleFamily"      TEXT      NOT NULL,
  "orgId"           TEXT      NOT NULL,
  "constructScores" JSONB     NOT NULL,
  "isTemplate"      BOOLEAN   NOT NULL DEFAULT false,
  "createdById"     TEXT      NOT NULL,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL,

  CONSTRAINT "RoleDemandProfile_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "RoleDemandProfile_orgId_fkey"
    FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "RoleDemandProfile_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE NO ACTION ON UPDATE CASCADE
);

-- Plain compound index for list-page scans by org and case-sensitive lookups.
CREATE INDEX "RoleDemandProfile_orgId_roleFamily_idx"
  ON "RoleDemandProfile" ("orgId", "roleFamily");

-- Functional partial index for case-insensitive resolution.
-- Without this, the resolver's `roleFamily: { equals, mode: "insensitive" }`
-- query degrades to a seq scan — the regular index can't satisfy LOWER()
-- comparisons. Partial-index excludes templates because the resolver always
-- filters them out (and templates are rarely > 10 rows anyway).
CREATE INDEX "RoleDemandProfile_orgId_lowerRoleFamily_idx"
  ON "RoleDemandProfile" ("orgId", LOWER("roleFamily"))
  WHERE "isTemplate" = false;

-- ============================================================================
-- ACI Row Level Security (RLS) Policies
-- ============================================================================
--
-- Architecture context:
--   - Database: Neon PostgreSQL (neondb_owner role)
--   - Auth: Supabase Auth (separate service, NOT on this database)
--   - Data access: Prisma ORM connects as neondb_owner (table owner)
--   - Table owner BYPASSES RLS by default in PostgreSQL
--
-- Purpose:
--   RLS acts as a defense-in-depth safety net. Since Prisma connects as the
--   table owner, it naturally bypasses RLS — application-layer org-scoping in
--   Prisma queries remains the primary enforcement. These policies protect
--   against any future non-owner database connections (PostgREST, direct SQL
--   access with restricted roles, analytics tools, etc.).
--
-- How it works:
--   1. A session variable `app.current_org_id` must be SET before queries
--      by non-owner connections: SET LOCAL app.current_org_id = 'org_cuid';
--   2. The helper function reads this variable to scope all policies
--   3. If the variable is not set, the function returns NULL → no rows visible
--      (fail-secure by default)
--
-- ============================================================================


-- ============================================================================
-- Step 1: Org-ID resolution function
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_current_org_id()
RETURNS TEXT AS $$
  SELECT NULLIF(current_setting('app.current_org_id', true), '')::text;
$$ LANGUAGE sql VOLATILE SET search_path = public;

COMMENT ON FUNCTION public.get_current_org_id() IS
  'Returns the current org ID from the session variable app.current_org_id. '
  'Returns NULL if not set (fail-secure: no rows visible). '
  'Non-owner connections MUST call SET LOCAL app.current_org_id before queries.';


-- ============================================================================
-- Step 2: Performance indexes on orgId columns
-- ============================================================================
-- Prisma creates FK indexes for relations, but explicit indexes on orgId
-- ensure RLS policy evaluation is fast for non-owner connections.

CREATE INDEX IF NOT EXISTS "idx_User_orgId" ON public."User" ("orgId");
CREATE INDEX IF NOT EXISTS "idx_Candidate_orgId" ON public."Candidate" ("orgId");
CREATE INDEX IF NOT EXISTS "idx_Role_orgId" ON public."Role" ("orgId");
CREATE INDEX IF NOT EXISTS "idx_Cutline_orgId" ON public."Cutline" ("orgId");

-- Indexes for transitive lookups (used in subquery-based policies)
CREATE INDEX IF NOT EXISTS "idx_Assessment_candidateId" ON public."Assessment" ("candidateId");
CREATE INDEX IF NOT EXISTS "idx_AssessmentInvitation_candidateId" ON public."AssessmentInvitation" ("candidateId");
CREATE INDEX IF NOT EXISTS "idx_Note_candidateId" ON public."Note" ("candidateId");
CREATE INDEX IF NOT EXISTS "idx_OutcomeRecord_candidateId" ON public."OutcomeRecord" ("candidateId");
CREATE INDEX IF NOT EXISTS "idx_CompositeWeight_roleId" ON public."CompositeWeight" ("roleId");
CREATE INDEX IF NOT EXISTS "idx_RoleVersion_roleId" ON public."RoleVersion" ("roleId");

-- Indexes for deeply nested lookups (assessment child tables)
CREATE INDEX IF NOT EXISTS "idx_SubtestResult_assessmentId" ON public."SubtestResult" ("assessmentId");
CREATE INDEX IF NOT EXISTS "idx_CompositeScore_assessmentId" ON public."CompositeScore" ("assessmentId");
CREATE INDEX IF NOT EXISTS "idx_ItemResponse_assessmentId" ON public."ItemResponse" ("assessmentId");
CREATE INDEX IF NOT EXISTS "idx_AIInteraction_assessmentId" ON public."AIInteraction" ("assessmentId");
CREATE INDEX IF NOT EXISTS "idx_Prediction_assessmentId" ON public."Prediction" ("assessmentId");
CREATE INDEX IF NOT EXISTS "idx_RedFlag_assessmentId" ON public."RedFlag" ("assessmentId");
CREATE INDEX IF NOT EXISTS "idx_PostAssessmentSurvey_assessmentId" ON public."PostAssessmentSurvey" ("assessmentId");
CREATE INDEX IF NOT EXISTS "idx_ConversationMessage_assessmentId" ON public."ConversationMessage" ("assessmentId");
CREATE INDEX IF NOT EXISTS "idx_AssessmentState_assessmentId" ON public."AssessmentState" ("assessmentId");
CREATE INDEX IF NOT EXISTS "idx_AIEvaluationRun_assessmentId" ON public."AIEvaluationRun" ("assessmentId");


-- ============================================================================
-- Step 3: Direct orgId tables — Organization, User, Candidate, Role, Cutline
-- ============================================================================

-- Organization (tenant root)
ALTER TABLE public."Organization" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_isolation" ON public."Organization"
  FOR ALL USING (id = public.get_current_org_id())
  WITH CHECK (id = public.get_current_org_id());

-- User
ALTER TABLE public."User" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_isolation_select" ON public."User"
  FOR SELECT USING ("orgId" = public.get_current_org_id());

CREATE POLICY "org_isolation_insert" ON public."User"
  FOR INSERT WITH CHECK ("orgId" = public.get_current_org_id());

CREATE POLICY "org_isolation_update" ON public."User"
  FOR UPDATE USING ("orgId" = public.get_current_org_id());

CREATE POLICY "org_isolation_delete" ON public."User"
  FOR DELETE USING ("orgId" = public.get_current_org_id());

-- Candidate
ALTER TABLE public."Candidate" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_isolation_select" ON public."Candidate"
  FOR SELECT USING ("orgId" = public.get_current_org_id());

CREATE POLICY "org_isolation_insert" ON public."Candidate"
  FOR INSERT WITH CHECK ("orgId" = public.get_current_org_id());

CREATE POLICY "org_isolation_update" ON public."Candidate"
  FOR UPDATE USING ("orgId" = public.get_current_org_id());

CREATE POLICY "org_isolation_delete" ON public."Candidate"
  FOR DELETE USING ("orgId" = public.get_current_org_id());

-- Role
ALTER TABLE public."Role" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_isolation_select" ON public."Role"
  FOR SELECT USING ("orgId" = public.get_current_org_id());

CREATE POLICY "org_isolation_insert" ON public."Role"
  FOR INSERT WITH CHECK ("orgId" = public.get_current_org_id());

CREATE POLICY "org_isolation_update" ON public."Role"
  FOR UPDATE USING ("orgId" = public.get_current_org_id());

CREATE POLICY "org_isolation_delete" ON public."Role"
  FOR DELETE USING ("orgId" = public.get_current_org_id());

-- Cutline
ALTER TABLE public."Cutline" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_isolation_select" ON public."Cutline"
  FOR SELECT USING ("orgId" = public.get_current_org_id());

CREATE POLICY "org_isolation_insert" ON public."Cutline"
  FOR INSERT WITH CHECK ("orgId" = public.get_current_org_id());

CREATE POLICY "org_isolation_update" ON public."Cutline"
  FOR UPDATE USING ("orgId" = public.get_current_org_id());

CREATE POLICY "org_isolation_delete" ON public."Cutline"
  FOR DELETE USING ("orgId" = public.get_current_org_id());


-- TeamInvitation (direct orgId)
ALTER TABLE public."TeamInvitation" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_isolation_select" ON public."TeamInvitation"
  FOR SELECT USING ("orgId" = public.get_current_org_id());

CREATE POLICY "org_isolation_insert" ON public."TeamInvitation"
  FOR INSERT WITH CHECK ("orgId" = public.get_current_org_id());

CREATE POLICY "org_isolation_update" ON public."TeamInvitation"
  FOR UPDATE USING ("orgId" = public.get_current_org_id());

CREATE POLICY "org_isolation_delete" ON public."TeamInvitation"
  FOR DELETE USING ("orgId" = public.get_current_org_id());

CREATE INDEX IF NOT EXISTS "idx_TeamInvitation_orgId" ON public."TeamInvitation" ("orgId");


-- ============================================================================
-- Step 4: Role-scoped tables (via roleId -> Role.orgId)
-- ============================================================================

-- CompositeWeight
ALTER TABLE public."CompositeWeight" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_isolation" ON public."CompositeWeight"
  FOR ALL USING (
    "roleId" IN (
      SELECT id FROM public."Role"
      WHERE "orgId" = public.get_current_org_id()
    )
  )
  WITH CHECK (
    "roleId" IN (
      SELECT id FROM public."Role"
      WHERE "orgId" = public.get_current_org_id()
    )
  );

-- RoleVersion
ALTER TABLE public."RoleVersion" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_isolation" ON public."RoleVersion"
  FOR ALL USING (
    "roleId" IN (
      SELECT id FROM public."Role"
      WHERE "orgId" = public.get_current_org_id()
    )
  )
  WITH CHECK (
    "roleId" IN (
      SELECT id FROM public."Role"
      WHERE "orgId" = public.get_current_org_id()
    )
  );


-- ============================================================================
-- Step 5: Candidate-scoped tables (via candidateId -> Candidate.orgId)
-- ============================================================================

-- Assessment
ALTER TABLE public."Assessment" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_isolation" ON public."Assessment"
  FOR ALL USING (
    "candidateId" IN (
      SELECT id FROM public."Candidate"
      WHERE "orgId" = public.get_current_org_id()
    )
  )
  WITH CHECK (
    "candidateId" IN (
      SELECT id FROM public."Candidate"
      WHERE "orgId" = public.get_current_org_id()
    )
  );

-- AssessmentInvitation
ALTER TABLE public."AssessmentInvitation" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_isolation" ON public."AssessmentInvitation"
  FOR ALL USING (
    "candidateId" IN (
      SELECT id FROM public."Candidate"
      WHERE "orgId" = public.get_current_org_id()
    )
  )
  WITH CHECK (
    "candidateId" IN (
      SELECT id FROM public."Candidate"
      WHERE "orgId" = public.get_current_org_id()
    )
    AND "roleId" IN (
      SELECT id FROM public."Role"
      WHERE "orgId" = public.get_current_org_id()
    )
  );

-- Note
ALTER TABLE public."Note" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_isolation" ON public."Note"
  FOR ALL USING (
    "candidateId" IN (
      SELECT id FROM public."Candidate"
      WHERE "orgId" = public.get_current_org_id()
    )
  )
  WITH CHECK (
    "candidateId" IN (
      SELECT id FROM public."Candidate"
      WHERE "orgId" = public.get_current_org_id()
    )
    AND "authorId" IN (
      SELECT id FROM public."User"
      WHERE "orgId" = public.get_current_org_id()
    )
  );

-- OutcomeRecord
ALTER TABLE public."OutcomeRecord" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_isolation" ON public."OutcomeRecord"
  FOR ALL USING (
    "candidateId" IN (
      SELECT id FROM public."Candidate"
      WHERE "orgId" = public.get_current_org_id()
    )
  )
  WITH CHECK (
    "candidateId" IN (
      SELECT id FROM public."Candidate"
      WHERE "orgId" = public.get_current_org_id()
    )
  );


-- ============================================================================
-- Step 6: Assessment-child tables (via assessmentId -> Assessment -> Candidate)
-- ============================================================================

-- SubtestResult
ALTER TABLE public."SubtestResult" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_isolation" ON public."SubtestResult"
  FOR ALL USING (
    "assessmentId" IN (
      SELECT a.id FROM public."Assessment" a
      JOIN public."Candidate" c ON a."candidateId" = c.id
      WHERE c."orgId" = public.get_current_org_id()
    )
  )
  WITH CHECK (
    "assessmentId" IN (
      SELECT a.id FROM public."Assessment" a
      JOIN public."Candidate" c ON a."candidateId" = c.id
      WHERE c."orgId" = public.get_current_org_id()
    )
  );

-- CompositeScore
ALTER TABLE public."CompositeScore" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_isolation" ON public."CompositeScore"
  FOR ALL USING (
    "assessmentId" IN (
      SELECT a.id FROM public."Assessment" a
      JOIN public."Candidate" c ON a."candidateId" = c.id
      WHERE c."orgId" = public.get_current_org_id()
    )
  )
  WITH CHECK (
    "assessmentId" IN (
      SELECT a.id FROM public."Assessment" a
      JOIN public."Candidate" c ON a."candidateId" = c.id
      WHERE c."orgId" = public.get_current_org_id()
    )
  );

-- ItemResponse
ALTER TABLE public."ItemResponse" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_isolation" ON public."ItemResponse"
  FOR ALL USING (
    "assessmentId" IN (
      SELECT a.id FROM public."Assessment" a
      JOIN public."Candidate" c ON a."candidateId" = c.id
      WHERE c."orgId" = public.get_current_org_id()
    )
  )
  WITH CHECK (
    "assessmentId" IN (
      SELECT a.id FROM public."Assessment" a
      JOIN public."Candidate" c ON a."candidateId" = c.id
      WHERE c."orgId" = public.get_current_org_id()
    )
  );

-- AIInteraction
ALTER TABLE public."AIInteraction" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_isolation" ON public."AIInteraction"
  FOR ALL USING (
    "assessmentId" IN (
      SELECT a.id FROM public."Assessment" a
      JOIN public."Candidate" c ON a."candidateId" = c.id
      WHERE c."orgId" = public.get_current_org_id()
    )
  )
  WITH CHECK (
    "assessmentId" IN (
      SELECT a.id FROM public."Assessment" a
      JOIN public."Candidate" c ON a."candidateId" = c.id
      WHERE c."orgId" = public.get_current_org_id()
    )
  );

-- Prediction
ALTER TABLE public."Prediction" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_isolation" ON public."Prediction"
  FOR ALL USING (
    "assessmentId" IN (
      SELECT a.id FROM public."Assessment" a
      JOIN public."Candidate" c ON a."candidateId" = c.id
      WHERE c."orgId" = public.get_current_org_id()
    )
  )
  WITH CHECK (
    "assessmentId" IN (
      SELECT a.id FROM public."Assessment" a
      JOIN public."Candidate" c ON a."candidateId" = c.id
      WHERE c."orgId" = public.get_current_org_id()
    )
  );

-- RedFlag
ALTER TABLE public."RedFlag" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_isolation" ON public."RedFlag"
  FOR ALL USING (
    "assessmentId" IN (
      SELECT a.id FROM public."Assessment" a
      JOIN public."Candidate" c ON a."candidateId" = c.id
      WHERE c."orgId" = public.get_current_org_id()
    )
  )
  WITH CHECK (
    "assessmentId" IN (
      SELECT a.id FROM public."Assessment" a
      JOIN public."Candidate" c ON a."candidateId" = c.id
      WHERE c."orgId" = public.get_current_org_id()
    )
  );

-- PostAssessmentSurvey
ALTER TABLE public."PostAssessmentSurvey" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_isolation" ON public."PostAssessmentSurvey"
  FOR ALL USING (
    "assessmentId" IN (
      SELECT a.id FROM public."Assessment" a
      JOIN public."Candidate" c ON a."candidateId" = c.id
      WHERE c."orgId" = public.get_current_org_id()
    )
  )
  WITH CHECK (
    "assessmentId" IN (
      SELECT a.id FROM public."Assessment" a
      JOIN public."Candidate" c ON a."candidateId" = c.id
      WHERE c."orgId" = public.get_current_org_id()
    )
  );

-- ConversationMessage
ALTER TABLE public."ConversationMessage" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_isolation" ON public."ConversationMessage"
  FOR ALL USING (
    "assessmentId" IN (
      SELECT a.id FROM public."Assessment" a
      JOIN public."Candidate" c ON a."candidateId" = c.id
      WHERE c."orgId" = public.get_current_org_id()
    )
  )
  WITH CHECK (
    "assessmentId" IN (
      SELECT a.id FROM public."Assessment" a
      JOIN public."Candidate" c ON a."candidateId" = c.id
      WHERE c."orgId" = public.get_current_org_id()
    )
  );

-- AssessmentState
ALTER TABLE public."AssessmentState" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_isolation" ON public."AssessmentState"
  FOR ALL USING (
    "assessmentId" IN (
      SELECT a.id FROM public."Assessment" a
      JOIN public."Candidate" c ON a."candidateId" = c.id
      WHERE c."orgId" = public.get_current_org_id()
    )
  )
  WITH CHECK (
    "assessmentId" IN (
      SELECT a.id FROM public."Assessment" a
      JOIN public."Candidate" c ON a."candidateId" = c.id
      WHERE c."orgId" = public.get_current_org_id()
    )
  );

-- AIEvaluationRun
ALTER TABLE public."AIEvaluationRun" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_isolation" ON public."AIEvaluationRun"
  FOR ALL USING (
    "assessmentId" IN (
      SELECT a.id FROM public."Assessment" a
      JOIN public."Candidate" c ON a."candidateId" = c.id
      WHERE c."orgId" = public.get_current_org_id()
    )
  )
  WITH CHECK (
    "assessmentId" IN (
      SELECT a.id FROM public."Assessment" a
      JOIN public."Candidate" c ON a."candidateId" = c.id
      WHERE c."orgId" = public.get_current_org_id()
    )
  );


-- ============================================================================
-- NOT org-scoped (RLS intentionally NOT enabled):
--
--   AccessRequest:
--     Public intake form — unauthenticated visitors submit these. No orgId
--     column. The POST route is public; GET/PATCH are ADMIN-only. Contains
--     PII (email, name, company) and reviewer User.id references. If a
--     non-owner analytics role is ever added, REVOKE SELECT on this table
--     individually to prevent cross-org PII exposure.
--
--   ItemCalibration:
--     Global IRT psychometric parameters (difficulty, discrimination,
--     guessing) shared identically across all orgs. Read-only reference
--     data with no tenant-specific content. Safe to exclude.
--
--   ActivityLog:
--     Cross-entity audit trail using polymorphic entityType/entityId
--     pattern. No orgId column and cannot be transitively scoped. Contains
--     actorId (User.id) and metadata JSON with candidateId values. If a
--     non-owner connection is ever introduced, this table MUST be protected
--     separately — either add a denormalized orgId column with a direct RLS
--     policy, or restrict access via REVOKE. Until then, ActivityLog must
--     ONLY be accessed through the owner connection.
--
-- IMPORTANT operational notes:
--   - TRUNCATE bypasses all RLS policies (PostgreSQL limitation). Ensure
--     non-owner roles are never granted TRUNCATE on these tables.
--   - BYPASSRLS must NEVER be granted to non-owner roles on this database.
--   - Non-owner connections MUST call SET LOCAL app.current_org_id = '...'
--     within a transaction before issuing any queries.
--   - If FORCE ROW LEVEL SECURITY is ever applied to any table, the Prisma
--     owner connection will also be subject to RLS — and since it does NOT
--     set app.current_org_id, all queries would return zero rows (total
--     outage). Do not use FORCE ROW LEVEL SECURITY without middleware changes.
-- ============================================================================

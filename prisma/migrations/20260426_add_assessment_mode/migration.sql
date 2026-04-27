-- PRO-126: Add AssessmentMode enum and assessmentMode field to Assessment
-- This is the foundational seam for the dual-mode platform (PRO-125 epic).
-- All existing assessments default to CANDIDATE.

CREATE TYPE "AssessmentMode" AS ENUM ('CANDIDATE', 'EMPLOYEE');

ALTER TABLE "Assessment" ADD COLUMN "assessmentMode" "AssessmentMode" NOT NULL DEFAULT 'CANDIDATE';

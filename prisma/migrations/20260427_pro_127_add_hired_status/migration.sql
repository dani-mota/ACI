-- PRO-127a: Add HIRED enum value to CandidateStatus
-- This must run as its own transaction. Postgres requires ALTER TYPE ... ADD VALUE
-- to be committed before the new value can be used in subsequent statements.

ALTER TYPE "CandidateStatus" ADD VALUE 'HIRED';

-- PRO-129b: Add employeeStatus column on Assessment
-- Nullable because the field is only meaningful in EMPLOYEE mode (matches department/roleFamily).
-- Backfill any already-converted assessments to ACTIVE.

ALTER TABLE "Assessment" ADD COLUMN "employeeStatus" "EmployeeStatus";

UPDATE "Assessment" SET "employeeStatus" = 'ACTIVE' WHERE "assessmentMode" = 'EMPLOYEE';

-- PRO-127b: Add employee conversion fields and soft-archive columns
-- Department + Role Family are required at conversion time but nullable in schema
-- because existing CANDIDATE-mode rows have no value.
-- archivedAt enables soft-archive of evaluative outputs (red flags, predictions)
-- when an assessment is converted to EMPLOYEE mode.

ALTER TABLE "Assessment" ADD COLUMN "department" TEXT;
ALTER TABLE "Assessment" ADD COLUMN "roleFamily" TEXT;
ALTER TABLE "Assessment" ADD COLUMN "convertedAt" TIMESTAMP(3);
ALTER TABLE "Assessment" ADD COLUMN "convertedBy" TEXT;

ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_convertedBy_fkey"
  FOREIGN KEY ("convertedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "RedFlag" ADD COLUMN "archivedAt" TIMESTAMP(3);
ALTER TABLE "Prediction" ADD COLUMN "archivedAt" TIMESTAMP(3);

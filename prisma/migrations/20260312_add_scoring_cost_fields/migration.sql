-- AlterTable
ALTER TABLE "Assessment" ADD COLUMN "scoringCostUsd" DOUBLE PRECISION;
ALTER TABLE "Assessment" ADD COLUMN "scoringTokensIn" INTEGER;
ALTER TABLE "Assessment" ADD COLUMN "scoringTokensOut" INTEGER;

-- AlterTable
ALTER TABLE "AssessmentState" ADD COLUMN "realtimeTokensIn" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "AssessmentState" ADD COLUMN "realtimeTokensOut" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "AssessmentState" ADD COLUMN "act1CompletedAt" TIMESTAMP(3);
ALTER TABLE "AssessmentState" ADD COLUMN "act2CompletedAt" TIMESTAMP(3);
ALTER TABLE "AssessmentState" ADD COLUMN "act3CompletedAt" TIMESTAMP(3);

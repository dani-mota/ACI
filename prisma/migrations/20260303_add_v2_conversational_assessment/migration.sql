-- V2 Conversational Assessment Schema Changes
-- This migration adds support for the Adaptive Conversational Investigation Engine

-- New enums
CREATE TYPE "AssessmentVersion" AS ENUM ('V1_BLOCKS', 'V2_CONVO');
CREATE TYPE "AssessmentAct" AS ENUM ('ACT_1', 'ACT_2', 'ACT_3');
CREATE TYPE "CeilingTypeEnum" AS ENUM ('HARD_CEILING', 'SOFT_CEILING_TRAINABLE', 'SOFT_CEILING_CONTEXT_DEPENDENT', 'STRESS_INDUCED', 'INSUFFICIENT_DATA');
CREATE TYPE "ConvoMessageRole" AS ENUM ('AGENT', 'CANDIDATE', 'SYSTEM');
CREATE TYPE "InteractionElementType" AS ENUM ('TEXT_RESPONSE', 'MULTIPLE_CHOICE_INLINE', 'NUMERIC_INPUT', 'TIMED_CHALLENGE', 'CONFIDENCE_RATING', 'TRADEOFF_SELECTION');

-- Add version column to Assessment (default V1_BLOCKS for backward compat)
ALTER TABLE "Assessment" ADD COLUMN "version" "AssessmentVersion" NOT NULL DEFAULT 'V1_BLOCKS';

-- Add V2 layered scoring fields to SubtestResult
ALTER TABLE "SubtestResult" ADD COLUMN "layerARawScore" DOUBLE PRECISION;
ALTER TABLE "SubtestResult" ADD COLUMN "layerBRawScore" DOUBLE PRECISION;
ALTER TABLE "SubtestResult" ADD COLUMN "layerAWeight" DOUBLE PRECISION;
ALTER TABLE "SubtestResult" ADD COLUMN "layerBWeight" DOUBLE PRECISION;
ALTER TABLE "SubtestResult" ADD COLUMN "consistencyLevel" TEXT;
ALTER TABLE "SubtestResult" ADD COLUMN "consistencyDownweighted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "SubtestResult" ADD COLUMN "ceilingType" "CeilingTypeEnum";
ALTER TABLE "SubtestResult" ADD COLUMN "ceilingNarrative" TEXT;
ALTER TABLE "SubtestResult" ADD COLUMN "scoringVersion" INTEGER NOT NULL DEFAULT 1;

-- Add V2 fields to ItemResponse
ALTER TABLE "ItemResponse" ADD COLUMN "act" "AssessmentAct";
ALTER TABLE "ItemResponse" ADD COLUMN "messageId" TEXT;

-- New table: ConversationMessage
CREATE TABLE "ConversationMessage" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "role" "ConvoMessageRole" NOT NULL,
    "content" TEXT NOT NULL,
    "act" "AssessmentAct" NOT NULL,
    "metadata" JSONB,
    "elementType" "InteractionElementType",
    "elementData" JSONB,
    "candidateInput" TEXT,
    "responseTimeMs" INTEGER,
    "sequenceOrder" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConversationMessage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ConversationMessage_assessmentId_act_idx" ON "ConversationMessage"("assessmentId", "act");
CREATE INDEX "ConversationMessage_assessmentId_sequenceOrder_idx" ON "ConversationMessage"("assessmentId", "sequenceOrder");
ALTER TABLE "ConversationMessage" ADD CONSTRAINT "ConversationMessage_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- New table: AssessmentState
CREATE TABLE "AssessmentState" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "currentAct" "AssessmentAct" NOT NULL DEFAULT 'ACT_1',
    "currentScenario" INTEGER NOT NULL DEFAULT 0,
    "currentBeat" INTEGER NOT NULL DEFAULT 0,
    "currentConstruct" TEXT,
    "currentPhase" INTEGER,
    "branchPath" JSONB,
    "act2Progress" JSONB,
    "act3Progress" JSONB,
    "isComplete" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssessmentState_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AssessmentState_assessmentId_key" ON "AssessmentState"("assessmentId");
ALTER TABLE "AssessmentState" ADD CONSTRAINT "AssessmentState_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- New table: AIEvaluationRun
CREATE TABLE "AIEvaluationRun" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "construct" "Construct" NOT NULL,
    "runIndex" INTEGER NOT NULL,
    "indicatorScores" JSONB NOT NULL,
    "aggregateScore" DOUBLE PRECISION NOT NULL,
    "modelId" TEXT NOT NULL,
    "latencyMs" INTEGER NOT NULL,
    "rawOutput" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AIEvaluationRun_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AIEvaluationRun_assessmentId_construct_idx" ON "AIEvaluationRun"("assessmentId", "construct");
CREATE INDEX "AIEvaluationRun_messageId_idx" ON "AIEvaluationRun"("messageId");
ALTER TABLE "AIEvaluationRun" ADD CONSTRAINT "AIEvaluationRun_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

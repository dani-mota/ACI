-- PRO-132: Evidence Layer per-construct cached annotations
--
-- One row per (assessmentId, construct). Lazy-generated on first dossier expand.
-- annotation is null if never attempted; only successful AI output is stored.
-- Failed Haiku attempts bump attemptedAt (cooldown gate) without polluting the
-- cache with fallback text. promptVersion lets PRO-134 invalidate v1 outputs
-- via constant bump in code (no migration).

CREATE TABLE "EvidenceAnnotation" (
  "id"            TEXT NOT NULL,
  "assessmentId"  TEXT NOT NULL,
  "construct"     "Construct" NOT NULL,
  "messageId"     TEXT NOT NULL,
  "annotation"    TEXT,
  "promptVersion" INTEGER NOT NULL DEFAULT 1,
  "attemptedAt"   TIMESTAMP(3),
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EvidenceAnnotation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EvidenceAnnotation_assessmentId_construct_key" ON "EvidenceAnnotation"("assessmentId", "construct");
CREATE INDEX "EvidenceAnnotation_assessmentId_idx" ON "EvidenceAnnotation"("assessmentId");

ALTER TABLE "EvidenceAnnotation" ADD CONSTRAINT "EvidenceAnnotation_assessmentId_fkey"
  FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EvidenceAnnotation" ADD CONSTRAINT "EvidenceAnnotation_messageId_fkey"
  FOREIGN KEY ("messageId") REFERENCES "ConversationMessage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

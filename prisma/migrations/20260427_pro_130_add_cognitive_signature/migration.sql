-- PRO-130: Cognitive Signature (Layer 1) — cached narrative + retry gating + prompt versioning.
--
-- We deliberately don't store the deterministic fallback (only AI output goes into cognitiveSignature)
-- so a transient Haiku outage cannot permanently stick a fallback on an employee.
--
-- cognitiveSignaturePromptVersion lets PRO-134 invalidate signatures generated under v1 rules
-- without a migration — bump the constant in code, mismatched rows regenerate on next view.

ALTER TABLE "Assessment" ADD COLUMN "cognitiveSignature" TEXT;
ALTER TABLE "Assessment" ADD COLUMN "cognitiveSignaturePromptVersion" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Assessment" ADD COLUMN "cognitiveSignatureAttemptedAt" TIMESTAMP(3);

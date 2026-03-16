/**
 * Zod schemas for ConversationMessage metadata — whitelist validation before DB persist.
 * PRD §9.1, Pilot blocker P-11.
 *
 * Rejects unknown fields to prevent metadata pollution.
 */
import { z } from "zod";
import {
  AssessmentActSchema,
  ConstructSchema,
  TurnFormatSchema,
  BeatTypeSchema,
  AdaptivePhaseSchema,
  GenerationMethodSchema,
} from "./turn-schema";

const ResponseClassificationSchema = z.enum(["STRONG", "ADEQUATE", "WEAK"]);
const ConfidenceLevelSchema = z.enum(["VERY_CONFIDENT", "SOMEWHAT_CONFIDENT", "NOT_SURE"]);

// ──────────────────────────────────────────────
// Candidate Message Metadata
// ──────────────────────────────────────────────

export const CandidateMessageMetadataSchema = z.object({
  // Always present
  format: TurnFormatSchema,
  act: AssessmentActSchema,
  primaryConstructs: z.array(ConstructSchema),
  secondaryConstructs: z.array(ConstructSchema),
  responseTimeMs: z.number().nonnegative(),

  // Conversational formats (F2, F6, F8, F9)
  scenarioIndex: z.number().int().min(0).optional(),
  beatIndex: z.number().int().min(0).optional(),
  beatType: BeatTypeSchema.optional(),
  classification: ResponseClassificationSchema.optional(),
  constructSignals: z.record(
    z.string(),
    z.object({ signalStrength: z.number().min(0).max(1), evidence: z.string() })
  ).optional(),

  // Structured formats (F3, F4, F5)
  itemId: z.string().optional(),
  difficulty: z.number().min(0).max(1).optional(),
  isCorrect: z.boolean().optional(),
  phase: AdaptivePhaseSchema.optional(),

  // Confidence (F7)
  confidence: z.number().min(0).max(1).optional(),
  confidenceLevel: ConfidenceLevelSchema.optional(),

  // Hidden information
  hiddenInfoTriggered: z.boolean().optional(),
  hiddenInfoSignalStrength: z.number().min(0).max(1).optional(),

  // Classification branch
  classificationBranch: ResponseClassificationSchema.optional(),

  // Sentinel marker
  sentinel: z.boolean().optional(),

  // Input truncation flag
  inputTruncated: z.boolean().optional(),
}).strict(); // Reject unknown fields

// ──────────────────────────────────────────────
// Agent Message Metadata
// ──────────────────────────────────────────────

export const AgentMessageMetadataSchema = z.object({
  format: TurnFormatSchema,
  act: AssessmentActSchema,
  primaryConstructs: z.array(ConstructSchema),
  generationMethod: GenerationMethodSchema,
  systemLatencyMs: z.number().nonnegative(),

  scenarioIndex: z.number().int().min(0).optional(),
  beatIndex: z.number().int().min(0).optional(),
  beatType: BeatTypeSchema.optional(),
  probeUsed: z.string().optional(),
  probeVariant: z.boolean().optional(),
  hiddenInfoRevealed: z.boolean().optional(),
  classification: ResponseClassificationSchema.optional(),
  preGenerated: z.boolean().optional(),
}).strict(); // Reject unknown fields

/**
 * Validate candidate message metadata. Returns cleaned data or null on failure.
 * Logs validation errors for monitoring.
 */
export function validateCandidateMetadata(
  data: unknown,
): z.infer<typeof CandidateMessageMetadataSchema> | null {
  const result = CandidateMessageMetadataSchema.safeParse(data);
  if (!result.success) {
    console.warn("[metadata-validation] Candidate metadata invalid:", result.error.issues);
    return null;
  }
  return result.data;
}

/**
 * Validate agent message metadata. Returns cleaned data or null on failure.
 */
export function validateAgentMetadata(
  data: unknown,
): z.infer<typeof AgentMessageMetadataSchema> | null {
  const result = AgentMessageMetadataSchema.safeParse(data);
  if (!result.success) {
    console.warn("[metadata-validation] Agent metadata invalid:", result.error.issues);
    return null;
  }
  return result.data;
}

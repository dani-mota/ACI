/**
 * Zod schema for AssessmentTurnResponse — validates every Turn before it reaches the client.
 * PRD §4.2, Pilot blocker P-1.
 *
 * Key enforcement: Act 2 structured formats REQUIRE itemId, constructId, difficulty.
 */
import { z } from "zod";
import { TURN_FORMATS, BEAT_TYPES, ADAPTIVE_PHASES } from "@/lib/types/formats";

// ──────────────────────────────────────────────
// Prisma enum values as Zod literals
// ──────────────────────────────────────────────

const AssessmentActSchema = z.enum(["PHASE_0", "ACT_1", "ACT_2", "ACT_3"]);

const ConstructSchema = z.enum([
  "FLUID_REASONING", "EXECUTIVE_CONTROL", "COGNITIVE_FLEXIBILITY",
  "METACOGNITIVE_CALIBRATION", "LEARNING_VELOCITY", "SYSTEMS_DIAGNOSTICS",
  "PATTERN_RECOGNITION", "QUANTITATIVE_REASONING", "SPATIAL_VISUALIZATION",
  "MECHANICAL_REASONING", "PROCEDURAL_RELIABILITY", "ETHICAL_JUDGMENT",
]);

const InteractionElementTypeSchema = z.enum([
  "TEXT_RESPONSE", "MULTIPLE_CHOICE_INLINE", "NUMERIC_INPUT",
  "TIMED_CHALLENGE", "CONFIDENCE_RATING", "TRADEOFF_SELECTION",
]);

// ──────────────────────────────────────────────
// Sub-schemas
// ──────────────────────────────────────────────

const ScenarioReferenceDataSchema = z.object({
  role: z.string(),
  context: z.string(),
  sections: z.array(z.object({
    label: z.string(),
    items: z.array(z.string()),
    highlight: z.boolean().optional(),
  })),
  question: z.string(),
});

const ReferenceUpdateSchema = z.object({
  newInformation: z.array(z.string()),
  question: z.string(),
});

const InteractiveElementDataSchema = z.object({
  elementType: InteractionElementTypeSchema,
  prompt: z.string(),
  options: z.array(z.string()).optional(),
  timeLimit: z.number().positive().optional(),
  construct: ConstructSchema.optional(),
  itemId: z.string().optional(),
  asciiDiagram: z.string().optional(),
  unitSuffix: z.string().optional(),
  timingExpectations: z.object({
    fast: z.number(),
    typical: z.number(),
    slow: z.number(),
  }).optional(),
});

const TurnDeliverySchema = z.object({
  sentences: z.array(z.string()),
  referenceCard: ScenarioReferenceDataSchema.optional(),
  referenceUpdate: ReferenceUpdateSchema.optional(),
  interactiveElement: InteractiveElementDataSchema.optional(),
});

const TurnInputTypeSchema = z.enum([
  "voice-or-text", "select", "numeric", "timed-select", "confidence", "none",
]);

const TurnInputExpectationSchema = z.object({
  type: TurnInputTypeSchema,
  options: z.array(z.string()).optional(),
  timeLimit: z.number().positive().optional(),
  silenceThresholds: z.object({
    first: z.number().positive(),
    second: z.number().positive(),
    final: z.number().positive(),
  }).optional(),
});

const TurnFormatSchema = z.enum(TURN_FORMATS as unknown as [string, ...string[]]);
const BeatTypeSchema = z.enum(BEAT_TYPES as unknown as [string, ...string[]]);
const AdaptivePhaseSchema = z.enum(ADAPTIVE_PHASES as unknown as [string, ...string[]]);

const TurnSignalContextSchema = z.object({
  format: TurnFormatSchema,
  act: AssessmentActSchema,
  primaryConstructs: z.array(ConstructSchema),
  secondaryConstructs: z.array(ConstructSchema),
  scenarioIndex: z.number().int().min(0).optional(),
  beatIndex: z.number().int().min(0).optional(),
  beatType: BeatTypeSchema.optional(),
  constructId: ConstructSchema.optional(),
  phase: AdaptivePhaseSchema.optional(),
  itemId: z.string().optional(),
  difficulty: z.number().min(0).max(1).optional(),
});

const GenerationMethodSchema = z.enum(["pre-generated", "streamed", "scripted", "hybrid"]);

const TurnMetaSchema = z.object({
  progress: z.object({
    act1: z.number().min(0).max(1),
    act2: z.number().min(0).max(1),
    act3: z.number().min(0).max(1),
  }),
  generationMethod: GenerationMethodSchema,
  isComplete: z.boolean().optional(),
  transition: z.object({
    from: AssessmentActSchema,
    to: AssessmentActSchema,
  }).optional(),
  systemLatencyMs: z.number().nonnegative().optional(),
});

// ──────────────────────────────────────────────
// Top-Level Turn Schema
// ──────────────────────────────────────────────

export const AssessmentTurnResponseSchema = z.object({
  type: z.literal("turn"),
  delivery: TurnDeliverySchema,
  input: TurnInputExpectationSchema,
  signal: TurnSignalContextSchema,
  meta: TurnMetaSchema,
});

// ──────────────────────────────────────────────
// Act 2 Structured Format Enforcement (P-1)
// ──────────────────────────────────────────────

const ACT_2_STRUCTURED_FORMATS = new Set([
  "MULTIPLE_CHOICE", "NUMERIC_INPUT", "TIMED_CHALLENGE",
]);

/**
 * Validates a Turn and enforces discriminated union rules:
 * - Act 2 structured formats (F3-F5) REQUIRE itemId, constructId, difficulty.
 * - correctAnswer must NEVER be present in delivery or signal.
 *
 * Returns { success: true, data } or { success: false, error }.
 */
export function validateTurn(data: unknown): { success: true; data: z.infer<typeof AssessmentTurnResponseSchema> } | { success: false; error: z.ZodError } {
  const result = AssessmentTurnResponseSchema.safeParse(data);
  if (!result.success) return result;

  const turn = result.data;

  // Act 2 structured format enforcement
  if (ACT_2_STRUCTURED_FORMATS.has(turn.signal.format)) {
    const missing: string[] = [];
    if (turn.signal.itemId == null) missing.push("itemId");
    if (turn.signal.constructId == null) missing.push("constructId");
    if (turn.signal.difficulty == null) missing.push("difficulty");

    if (missing.length > 0) {
      return {
        success: false,
        error: new z.ZodError([{
          code: "custom",
          path: ["signal"],
          message: `Act 2 structured format "${turn.signal.format}" requires: ${missing.join(", ")}`,
        }]),
      };
    }
  }

  return result;
}

// Re-export sub-schemas for composition in other validators
export {
  AssessmentActSchema,
  ConstructSchema,
  TurnFormatSchema,
  BeatTypeSchema,
  AdaptivePhaseSchema,
  GenerationMethodSchema,
  ScenarioReferenceDataSchema,
  ReferenceUpdateSchema,
};

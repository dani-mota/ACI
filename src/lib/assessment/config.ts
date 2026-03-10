/**
 * AI model configuration for the assessment engine.
 * Haiku for real-time interactions (classification, follow-ups, probes).
 * Sonnet for heavyweight tasks (scenario generation, item generation).
 */
export const AI_CONFIG = {
  /** Model for real-time assessment interactions (low latency) */
  realtimeModel: "claude-haiku-4-5-20251001" as const,
  /** Model for content generation (higher quality) */
  generationModel: "claude-sonnet-4-20250514" as const,
  /** Timeout for real-time AI calls (ms) */
  realtimeTimeoutMs: 15_000,
  /** Timeout for generation AI calls (ms) */
  generationTimeoutMs: 30_000,
  /** Number of independent evaluation runs for Layer B scoring */
  evaluationRunCount: 3,
  /** Standard deviation threshold for high-variance flagging */
  highVarianceThreshold: 0.3,
  /** Downweight factor for high-variance scores */
  highVarianceDownweight: 0.5,
} as const;

/**
 * Feature flags for progressive rollout of new capabilities.
 */
export const FEATURE_FLAGS = {
  /** Enable pre-generated content libraries instead of live AI generation */
  CONTENT_LIBRARY_ENABLED: process.env.FEATURE_CONTENT_LIBRARY === "true",
} as const;

/**
 * Assessment structure configuration.
 */
export const ASSESSMENT_STRUCTURE = {
  /** Number of scenarios in Act 1 */
  act1ScenarioCount: 4,
  /** Number of beats per scenario */
  beatsPerScenario: 6,
  /** Constructs measured in Act 2 with dedicated adaptive loops */
  act2Constructs: [
    "QUANTITATIVE_REASONING",
    "SPATIAL_VISUALIZATION",
    "MECHANICAL_REASONING",
    "PATTERN_RECOGNITION",
    "FLUID_REASONING",
  ] as const,
  /** Number of confidence-tagged items in Act 3 */
  act3ConfidenceItems: 3,
  /** Number of parallel scenarios in Act 3 */
  act3ParallelScenarios: 2,
  /** Consistency threshold for Act 1 vs Act 3 comparison */
  consistencyThreshold: 0.15,
  /** Layer A scoring weight (deterministic items) */
  defaultLayerAWeight: 0.55,
  /** Layer B scoring weight (AI-evaluated responses) */
  defaultLayerBWeight: 0.45,
  /** Downweight factor applied to low-consistency constructs */
  consistencyDownweightFactor: 0.75,
} as const;

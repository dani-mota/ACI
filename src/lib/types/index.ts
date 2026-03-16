/**
 * Barrel export for all shared types.
 * Import from "@/lib/types" instead of individual files.
 */

// Turn contract (PRD §4.2)
export type {
  AssessmentTurnResponse,
  TurnDelivery,
  TurnInputExpectation,
  TurnInputType,
  TurnSignalContext,
  TurnMeta,
  GenerationMethod,
  ScenarioReferenceData,
  ReferenceUpdate,
  InteractiveElementData,
} from "./turn";

// Format enums (PRD §3.1, §9.2)
export {
  TURN_FORMATS,
  BEAT_TYPES,
  ADAPTIVE_PHASES,
  RESPONSE_CLASSIFICATIONS,
  CONFIDENCE_LEVELS,
} from "./formats";
export type {
  TurnFormat,
  BeatType,
  AdaptivePhase,
  ResponseClassification,
  ConfidenceLevel,
} from "./formats";

// Constructs & layers (PRD §2.1)
export type { Construct, Layer } from "./constructs";
export {
  CONSTRUCT_LAYER_MAP,
  ALL_CONSTRUCTS,
  CONSTRUCT_DISPLAY_NAMES,
  getConstructLayer,
  getConstructsByLayer,
} from "./constructs";

// Message metadata (PRD §9.1)
export type {
  CandidateMessageMetadata,
  AgentMessageMetadata,
} from "./metadata";

// Assessment lifecycle (PRD §9.3)
export {
  ASSESSMENT_LIFECYCLE_STATES,
} from "./lifecycle";
export type { AssessmentLifecycle } from "./lifecycle";

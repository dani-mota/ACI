/**
 * Typed metadata interfaces for ConversationMessage.metadata JSON field.
 * PRD §9.1. These replace untyped Record<string, unknown> metadata.
 */
import type { AssessmentAct, Construct } from "@/generated/prisma/client";
import type { TurnFormat, BeatType, AdaptivePhase, ResponseClassification, ConfidenceLevel } from "./formats";
import type { GenerationMethod } from "./turn";

// ──────────────────────────────────────────────
// Candidate Message Metadata
// ──────────────────────────────────────────────

export interface CandidateMessageMetadata {
  /** Always present */
  format: TurnFormat;
  act: AssessmentAct;
  primaryConstructs: Construct[];
  secondaryConstructs: Construct[];
  responseTimeMs: number;

  /** Conversational formats (F2, F6, F8, F9) */
  scenarioIndex?: number;
  beatIndex?: number;
  beatType?: BeatType;
  classification?: ResponseClassification;
  constructSignals?: Record<string, { signalStrength: number; evidence: string }>;

  /** Structured formats (F3, F4, F5) */
  itemId?: string;
  difficulty?: number;
  isCorrect?: boolean;
  phase?: AdaptivePhase;

  /** Confidence (F7) */
  confidence?: number;
  confidenceLevel?: ConfidenceLevel;

  /** Hidden information */
  hiddenInfoTriggered?: boolean;
  hiddenInfoSignalStrength?: number;

  /** Classification branch served */
  classificationBranch?: ResponseClassification;

  /** Sentinel marker */
  sentinel?: boolean;

  /** Input was truncated from original length */
  inputTruncated?: boolean;
}

// ──────────────────────────────────────────────
// Agent Message Metadata
// ──────────────────────────────────────────────

export interface AgentMessageMetadata {
  format: TurnFormat;
  act: AssessmentAct;
  primaryConstructs: Construct[];
  generationMethod: GenerationMethod;
  systemLatencyMs: number;

  scenarioIndex?: number;
  beatIndex?: number;
  beatType?: BeatType;
  probeUsed?: string;
  probeVariant?: boolean;
  hiddenInfoRevealed?: boolean;
  classification?: ResponseClassification;

  /** Content was pre-generated from library */
  preGenerated?: boolean;
}

/**
 * Unified AssessmentTurnResponse — the single response shape for all 9 formats.
 * PRD §4.2. Every format produces this exact JSON.
 */
import type { AssessmentAct, Construct, InteractionElementType } from "@/generated/prisma/client";
import type { TurnFormat, BeatType, AdaptivePhase } from "./formats";

// ──────────────────────────────────────────────
// Top-Level Turn Response
// ──────────────────────────────────────────────

export interface AssessmentTurnResponse {
  type: "turn";
  delivery: TurnDelivery;
  input: TurnInputExpectation;
  signal: TurnSignalContext;
  meta: TurnMeta;
}

// ──────────────────────────────────────────────
// Delivery — what Aria says / shows
// ──────────────────────────────────────────────

export interface ScenarioReferenceData {
  role: string;
  context: string;
  sections: { label: string; items: string[]; highlight?: boolean }[];
  question: string;
}

export interface ReferenceUpdate {
  newInformation: string[];
  question: string;
}

export interface InteractiveElementData {
  elementType: InteractionElementType;
  prompt: string;
  options?: string[];
  timeLimit?: number;
  construct?: Construct;
  itemId?: string;
  asciiDiagram?: string;
  unitSuffix?: string;
  timingExpectations?: { fast: number; typical: number; slow: number };
}

export interface TurnDelivery {
  /** Pre-split sentences ready for TTS. Empty array = no speech. */
  sentences: string[];
  /** Beat 0 only — replaces existing reference card. */
  referenceCard?: ScenarioReferenceData;
  /** Beats 2-5 — merges into existing reference card. */
  referenceUpdate?: ReferenceUpdate;
  /** Shown AFTER sentences finish playing. */
  interactiveElement?: InteractiveElementData;
}

// ──────────────────────────────────────────────
// Input — what we expect from the candidate next
// ──────────────────────────────────────────────

export type TurnInputType =
  | "voice-or-text"
  | "select"
  | "numeric"
  | "timed-select"
  | "confidence"
  | "none";

export interface TurnInputExpectation {
  type: TurnInputType;
  options?: string[];
  timeLimit?: number;
  silenceThresholds?: { first: number; second: number; final: number };
}

// ──────────────────────────────────────────────
// Signal — measurement context for this turn
// ──────────────────────────────────────────────

export interface TurnSignalContext {
  format: TurnFormat;
  act: AssessmentAct;
  primaryConstructs: Construct[];
  secondaryConstructs: Construct[];
  scenarioIndex?: number;
  beatIndex?: number;
  beatType?: BeatType;
  constructId?: Construct;
  phase?: AdaptivePhase;
  itemId?: string;
  difficulty?: number;
}

// ──────────────────────────────────────────────
// Meta — progress, generation info, transitions
// ──────────────────────────────────────────────

export type GenerationMethod = "pre-generated" | "streamed" | "scripted" | "hybrid";

export interface TurnMeta {
  progress: { act1: number; act2: number; act3: number };
  generationMethod: GenerationMethod;
  isComplete?: boolean;
  transition?: { from: AssessmentAct; to: AssessmentAct };
  systemLatencyMs?: number;
}

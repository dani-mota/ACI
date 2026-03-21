import type { ResponseClassification } from "./types";

// ──────────────────────────────────────────────
// Content Library: Pre-generated assessment content
// ──────────────────────────────────────────────

/** Content format version. v1: Beat 0 has 5 sentences (trailing question). v2: Beat 0 has 4 sentences (no trailing question). */
export const CONTENT_FORMAT_VERSION = 2;

export interface ContentLibraryData {
  version: number;
  /** Content format version — distinguishes old (v1) vs new (v2) Beat 0 structure. */
  formatVersion?: number;
  generatedAt: string;
  modelId: string;
  roleContext: {
    environment: string;
    skills: string[];
    tasks: string[];
    errorConsequences: string[];
  } | null;

  act1: {
    scenarios: Act1ScenarioContent[];
  };

  act2: {
    diagnosticProbes: DiagnosticProbeContent[];
  };

  // Deferred until Act 3 is fully implemented
  act3: null;
}

// ──────────────────────────────────────────────
// Act 1: Scenario Content
// ──────────────────────────────────────────────

export interface Act1ScenarioContent {
  scenarioId: string;
  variants: Act1Variant[];
}

export interface Act1Variant {
  variantId: string;
  beats: Act1BeatContent[];
}

export interface Act1BeatContent {
  beatIndex: number;
  beatType: string;
  constructs: string[];
  // Beat 0: unbranched opening
  spokenText?: string;
  referenceCard?: ScenarioReferenceData;
  // Beats 1-5: branched by classification
  branches?: Record<ResponseClassification, BranchContent>;
  /** Standardized probe for this beat (PRD §12.3). Extracted from scenario beat templates. */
  probeConfig?: ProbeConfig;
  /** Construct indicators for this beat (PRD §12.3). Merged from scenario rubric data. */
  constructIndicators?: ConstructIndicators;
}

/** Probe verification config — the standardized question Aria must ask. */
export interface ProbeConfig {
  /** The canonical probe question, e.g. "How does that change your approach?" */
  primaryProbe: string;
  /** Alternative phrasings for scaffolding contexts. */
  approvedVariants: string[];
  /** Which construct this probe targets. */
  constructTarget: string;
}

/** Behavioral indicators for a beat — strong vs weak signals. */
export interface ConstructIndicators {
  construct: string;
  strongIndicators: string[];
  weakIndicators: string[];
}

export interface BranchContent {
  spokenText: string;
  referenceUpdate: {
    newInformation: string[];
    question: string;
  } | null;
}

export interface ScenarioReferenceData {
  role: string;
  context: string;
  sections: {
    label: string;
    items: string[];
    highlight?: boolean;
  }[];
  question: string;
}

// ──────────────────────────────────────────────
// Act 2: Diagnostic Probes
// ──────────────────────────────────────────────

export interface DiagnosticProbeContent {
  construct: string;
  probeType: string;
  variants: {
    spokenText: string;
    followUpBranches: Record<string, { spokenText: string }>;
  }[];
}

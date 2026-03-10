import type { ResponseClassification } from "./types";

// ──────────────────────────────────────────────
// Content Library: Pre-generated assessment content
// ──────────────────────────────────────────────

export interface ContentLibraryData {
  version: number;
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

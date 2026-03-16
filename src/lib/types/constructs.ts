/**
 * Construct and Layer re-exports with mapping utilities.
 * PRD §2.1. Re-exports Prisma enums and adds the construct→layer mapping.
 */
import type { Construct, Layer } from "@/generated/prisma/client";

// Re-export Prisma enums for convenience
export type { Construct, Layer } from "@/generated/prisma/client";

// ──────────────────────────────────────────────
// Construct → Layer mapping
// ──────────────────────────────────────────────

export const CONSTRUCT_LAYER_MAP: Record<Construct, Layer> = {
  // Layer 1: Cognitive Core (5)
  FLUID_REASONING: "COGNITIVE_CORE",
  EXECUTIVE_CONTROL: "COGNITIVE_CORE",
  COGNITIVE_FLEXIBILITY: "COGNITIVE_CORE",
  METACOGNITIVE_CALIBRATION: "COGNITIVE_CORE",
  LEARNING_VELOCITY: "COGNITIVE_CORE",

  // Layer 2: Technical Aptitude (5)
  SYSTEMS_DIAGNOSTICS: "TECHNICAL_APTITUDE",
  PATTERN_RECOGNITION: "TECHNICAL_APTITUDE",
  QUANTITATIVE_REASONING: "TECHNICAL_APTITUDE",
  SPATIAL_VISUALIZATION: "TECHNICAL_APTITUDE",
  MECHANICAL_REASONING: "TECHNICAL_APTITUDE",

  // Layer 3: Behavioral Integrity (2)
  PROCEDURAL_RELIABILITY: "BEHAVIORAL_INTEGRITY",
  ETHICAL_JUDGMENT: "BEHAVIORAL_INTEGRITY",
} as const;

/** All 12 construct identifiers as a const array. */
export const ALL_CONSTRUCTS = Object.keys(CONSTRUCT_LAYER_MAP) as Construct[];

/** Get the layer for a given construct. */
export function getConstructLayer(construct: Construct): Layer {
  return CONSTRUCT_LAYER_MAP[construct];
}

/** Get all constructs belonging to a given layer. */
export function getConstructsByLayer(layer: Layer): Construct[] {
  return ALL_CONSTRUCTS.filter((c) => CONSTRUCT_LAYER_MAP[c] === layer);
}

/** Human-readable construct names (never shown to candidates). */
export const CONSTRUCT_DISPLAY_NAMES: Record<Construct, string> = {
  FLUID_REASONING: "Fluid Reasoning",
  EXECUTIVE_CONTROL: "Executive Control",
  COGNITIVE_FLEXIBILITY: "Cognitive Flexibility",
  METACOGNITIVE_CALIBRATION: "Metacognitive Calibration",
  LEARNING_VELOCITY: "Learning Velocity",
  SYSTEMS_DIAGNOSTICS: "Systems Diagnostics",
  PATTERN_RECOGNITION: "Pattern Recognition",
  QUANTITATIVE_REASONING: "Quantitative Reasoning",
  SPATIAL_VISUALIZATION: "Spatial Visualization",
  MECHANICAL_REASONING: "Mechanical Reasoning",
  PROCEDURAL_RELIABILITY: "Procedural Reliability",
  ETHICAL_JUDGMENT: "Ethical Judgment",
} as const;

/**
 * Canonical probe questions per scenario × beat.
 * PRD §12.3: probeConfig with primaryProbe + approvedVariants + constructTarget.
 *
 * Extracted from the beat type patterns. Each beat type has a standard probe
 * shape — the specific wording adapts to scenario context.
 */
import type { ProbeConfig, ConstructIndicators } from "./content-types";
import { SCENARIOS } from "./scenarios";

/**
 * Default probes by beat type — used when no scenario-specific probe exists.
 */
const DEFAULT_PROBES_BY_BEAT_TYPE: Record<string, Omit<ProbeConfig, "constructTarget">> = {
  INITIAL_SITUATION: {
    primaryProbe: "", // Beat 0 is narration — no probe
    approvedVariants: [],
  },
  INITIAL_RESPONSE: {
    primaryProbe: "What would you do first?",
    approvedVariants: [
      "How would you approach this?",
      "Where would you start?",
      "What's your first move?",
    ],
  },
  COMPLICATION: {
    primaryProbe: "How does that change your approach?",
    approvedVariants: [
      "What does that mean for your plan?",
      "How would you adjust given this?",
      "Does that change anything for you?",
    ],
  },
  SOCIAL_PRESSURE: {
    primaryProbe: "How do you respond to that?",
    approvedVariants: [
      "What do you say?",
      "How do you handle that?",
      "What would you tell them?",
    ],
  },
  CONSEQUENCE_REVEAL: {
    primaryProbe: "How do you evaluate that outcome?",
    approvedVariants: [
      "What do you make of that?",
      "How does that land for you?",
      "What would you do differently?",
    ],
  },
  REFLECTIVE_SYNTHESIS: {
    primaryProbe: "What was the hardest part of this situation?",
    approvedVariants: [
      "What did you learn from this?",
      "What would you do differently next time?",
      "Looking back, what stands out?",
    ],
  },
};

/**
 * Get probe config for a specific scenario and beat.
 * Falls back to default probes by beat type if no scenario-specific probe.
 */
export function getProbeConfig(scenarioIndex: number, beatIndex: number): ProbeConfig | null {
  const scenario = SCENARIOS[scenarioIndex];
  if (!scenario) return null;

  const beat = scenario.beats[beatIndex];
  if (!beat) return null;

  // Beat 0 (INITIAL_SITUATION) has no probe — it's narration
  if (beat.type === "INITIAL_SITUATION") return null;

  const defaultProbe = DEFAULT_PROBES_BY_BEAT_TYPE[beat.type];
  if (!defaultProbe) return null;

  return {
    primaryProbe: defaultProbe.primaryProbe,
    approvedVariants: defaultProbe.approvedVariants,
    constructTarget: (beat.primaryConstructs[0] as string) ?? "FLUID_REASONING",
  };
}

/**
 * Get construct indicators for a specific scenario and beat.
 * Extracts from scenario rubric indicators.
 */
export function getConstructIndicators(scenarioIndex: number, beatIndex: number): ConstructIndicators | null {
  const scenario = SCENARIOS[scenarioIndex];
  if (!scenario) return null;

  const beat = scenario.beats[beatIndex];
  if (!beat || !beat.rubricIndicators || beat.rubricIndicators.length === 0) return null;

  return {
    construct: (beat.primaryConstructs[0] as string) ?? "FLUID_REASONING",
    strongIndicators: beat.rubricIndicators.map((ind) => ind.positiveCriteria),
    weakIndicators: beat.rubricIndicators.map((ind) => ind.negativeCriteria),
  };
}

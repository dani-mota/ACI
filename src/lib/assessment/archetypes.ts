/**
 * PRO-138: Trajectory Readiness archetype library.
 *
 * Seeded library of 10 role archetypes, each with a 12-construct demand
 * profile on the 1-10 authoring scale (matches PRO-135 storage scale).
 *
 * NAMES + NUMBERS ARE PLACEHOLDER CONTENT — Dani reviews in PR. These
 * are measurement decisions, NOT under the 2026-05-11 engineering trust
 * grant. First-pass design intent:
 *   - 10 archetypes spread across cognitive emphasis (synthesis,
 *     execution, pattern-finding, alignment, diagnosis)
 *   - Distinct enough that visibly different employee profiles produce
 *     visibly different rankings (validated by spot-check during
 *     implementation against existing employee data)
 *   - Developmental framing only (PRO-134 vocabulary discipline). No
 *     evaluative names, no "high performer" / "flight risk" language.
 *
 * Construct keys must match `CONSTRUCTS` in `src/lib/constructs.ts`.
 * Mismatched keys are silently dropped by the compute function and
 * treated as no_demand.
 *
 * Library lives in code (not DB) for Phase 2 per AC. If it ever
 * becomes user-authored, the `id` field survives renames and can act
 * as the FK.
 */

export interface RoleArchetype {
  /** Stable id — survives renames. FK-ready if archetypes ever move to DB. */
  id: string;
  /** Display name. PRO-134 vocabulary-clean. */
  name: string;
  /** One-sentence developmental description for the panel row. */
  description: string;
  /** 12-construct demand profile on 1-10 scale (matches PRO-135 authoring scale).
   *  Keys must match CONSTRUCTS in `src/lib/constructs.ts`. Partial maps
   *  allowed for archetypes that don't have an opinion on a construct
   *  (compute treats missing as no_demand). */
  demands: Partial<Record<string, number>>;
}

export const ARCHETYPE_LIBRARY: RoleArchetype[] = [
  {
    id: "strategic_advisor",
    name: "Strategic Advisor",
    description:
      "Synthesizes ambiguous information into directional recommendations.",
    demands: {
      FLUID_REASONING: 9,
      EXECUTIVE_CONTROL: 9,
      COGNITIVE_FLEXIBILITY: 8,
      METACOGNITIVE_CALIBRATION: 8,
      LEARNING_VELOCITY: 7,
      PATTERN_RECOGNITION: 7,
      SYSTEMS_DIAGNOSTICS: 6,
      QUANTITATIVE_REASONING: 6,
      SPATIAL_VISUALIZATION: 5,
      MECHANICAL_REASONING: 3,
      PROCEDURAL_RELIABILITY: 4,
      ETHICAL_JUDGMENT: 8,
    },
  },
  {
    id: "cross_functional_integrator",
    name: "Cross-Functional Integrator",
    description:
      "Holds many threads at once and translates across disciplines.",
    demands: {
      FLUID_REASONING: 7,
      EXECUTIVE_CONTROL: 8,
      COGNITIVE_FLEXIBILITY: 9,
      METACOGNITIVE_CALIBRATION: 7,
      LEARNING_VELOCITY: 8,
      PATTERN_RECOGNITION: 7,
      SYSTEMS_DIAGNOSTICS: 6,
      QUANTITATIVE_REASONING: 5,
      SPATIAL_VISUALIZATION: 5,
      MECHANICAL_REASONING: 3,
      PROCEDURAL_RELIABILITY: 5,
      ETHICAL_JUDGMENT: 7,
    },
  },
  {
    id: "ambiguous_mission_lead",
    name: "Ambiguous Mission Lead",
    description:
      "Operates effectively when goals are loosely defined and shift.",
    demands: {
      FLUID_REASONING: 9,
      EXECUTIVE_CONTROL: 7,
      COGNITIVE_FLEXIBILITY: 10,
      METACOGNITIVE_CALIBRATION: 8,
      LEARNING_VELOCITY: 7,
      PATTERN_RECOGNITION: 7,
      SYSTEMS_DIAGNOSTICS: 5,
      QUANTITATIVE_REASONING: 5,
      SPATIAL_VISUALIZATION: 4,
      MECHANICAL_REASONING: 3,
      PROCEDURAL_RELIABILITY: 3,
      ETHICAL_JUDGMENT: 8,
    },
  },
  {
    id: "precision_executor",
    name: "Precision Executor",
    description:
      "Delivers consistent output where accuracy matters more than novelty.",
    demands: {
      FLUID_REASONING: 5,
      EXECUTIVE_CONTROL: 9,
      COGNITIVE_FLEXIBILITY: 4,
      METACOGNITIVE_CALIBRATION: 8,
      LEARNING_VELOCITY: 5,
      PATTERN_RECOGNITION: 7,
      SYSTEMS_DIAGNOSTICS: 6,
      QUANTITATIVE_REASONING: 7,
      SPATIAL_VISUALIZATION: 5,
      MECHANICAL_REASONING: 4,
      PROCEDURAL_RELIABILITY: 10,
      ETHICAL_JUDGMENT: 7,
    },
  },
  {
    id: "high_volume_operator",
    name: "High-Volume Operator",
    description:
      "Sustains output across many similar units of work.",
    demands: {
      FLUID_REASONING: 4,
      EXECUTIVE_CONTROL: 8,
      COGNITIVE_FLEXIBILITY: 3,
      METACOGNITIVE_CALIBRATION: 6,
      LEARNING_VELOCITY: 4,
      PATTERN_RECOGNITION: 6,
      SYSTEMS_DIAGNOSTICS: 5,
      QUANTITATIVE_REASONING: 5,
      SPATIAL_VISUALIZATION: 4,
      MECHANICAL_REASONING: 5,
      PROCEDURAL_RELIABILITY: 9,
      ETHICAL_JUDGMENT: 7,
    },
  },
  {
    id: "pattern_discoverer",
    name: "Pattern Discoverer",
    description:
      "Surfaces non-obvious regularities in noisy data.",
    demands: {
      FLUID_REASONING: 9,
      EXECUTIVE_CONTROL: 6,
      COGNITIVE_FLEXIBILITY: 7,
      METACOGNITIVE_CALIBRATION: 7,
      LEARNING_VELOCITY: 7,
      PATTERN_RECOGNITION: 10,
      SYSTEMS_DIAGNOSTICS: 8,
      QUANTITATIVE_REASONING: 8,
      SPATIAL_VISUALIZATION: 6,
      MECHANICAL_REASONING: 5,
      PROCEDURAL_RELIABILITY: 5,
      ETHICAL_JUDGMENT: 6,
    },
  },
  {
    id: "coalition_builder",
    name: "Coalition Builder",
    description:
      "Aligns stakeholders with different priorities toward shared decisions.",
    demands: {
      FLUID_REASONING: 7,
      EXECUTIVE_CONTROL: 7,
      COGNITIVE_FLEXIBILITY: 8,
      METACOGNITIVE_CALIBRATION: 9,
      LEARNING_VELOCITY: 7,
      PATTERN_RECOGNITION: 7,
      SYSTEMS_DIAGNOSTICS: 5,
      QUANTITATIVE_REASONING: 4,
      SPATIAL_VISUALIZATION: 4,
      MECHANICAL_REASONING: 3,
      PROCEDURAL_RELIABILITY: 5,
      ETHICAL_JUDGMENT: 9,
    },
  },
  {
    id: "long_horizon_architect",
    name: "Long-Horizon Architect",
    description:
      "Designs systems whose payoff lands months or years after the work.",
    demands: {
      FLUID_REASONING: 10,
      EXECUTIVE_CONTROL: 9,
      COGNITIVE_FLEXIBILITY: 7,
      METACOGNITIVE_CALIBRATION: 8,
      LEARNING_VELOCITY: 6,
      PATTERN_RECOGNITION: 8,
      SYSTEMS_DIAGNOSTICS: 9,
      QUANTITATIVE_REASONING: 7,
      SPATIAL_VISUALIZATION: 6,
      MECHANICAL_REASONING: 4,
      PROCEDURAL_RELIABILITY: 6,
      ETHICAL_JUDGMENT: 7,
    },
  },
  {
    id: "rapid_diagnoser",
    name: "Rapid Diagnoser",
    description:
      "Identifies the actual problem from limited initial information.",
    demands: {
      FLUID_REASONING: 8,
      EXECUTIVE_CONTROL: 7,
      COGNITIVE_FLEXIBILITY: 6,
      METACOGNITIVE_CALIBRATION: 7,
      LEARNING_VELOCITY: 8,
      PATTERN_RECOGNITION: 9,
      SYSTEMS_DIAGNOSTICS: 10,
      QUANTITATIVE_REASONING: 7,
      SPATIAL_VISUALIZATION: 6,
      MECHANICAL_REASONING: 6,
      PROCEDURAL_RELIABILITY: 5,
      ETHICAL_JUDGMENT: 6,
    },
  },
  {
    id: "resilient_specialist",
    name: "Resilient Specialist",
    description:
      "Deep expertise that adapts when the problem shape shifts.",
    demands: {
      FLUID_REASONING: 7,
      EXECUTIVE_CONTROL: 7,
      COGNITIVE_FLEXIBILITY: 7,
      METACOGNITIVE_CALIBRATION: 9,
      LEARNING_VELOCITY: 9,
      PATTERN_RECOGNITION: 7,
      SYSTEMS_DIAGNOSTICS: 8,
      QUANTITATIVE_REASONING: 6,
      SPATIAL_VISUALIZATION: 5,
      MECHANICAL_REASONING: 6,
      PROCEDURAL_RELIABILITY: 5,
      ETHICAL_JUDGMENT: 6,
    },
  },
];

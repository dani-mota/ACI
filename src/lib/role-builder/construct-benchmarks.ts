// PRO-89 PR#2: per-construct weight benchmark ranges. Surfaces a
// "Similar roles: X–Y%" hint on each construct row in WeightVisualizer
// so the recruiter has an external frame of reference when deciding
// whether the AI's weight is reasonable, conservative, or aggressive.
//
// Numbers are derived from the distribution of weights across ACI's
// five validated role templates (factory-technician, cnc-machinist,
// cam-programmer, cmm-programmer, manufacturing-engineer) — the
// reference profiles described in pipeline.ts lines 337–343. The
// table itself is AC-prescribed (PRO-89 ticket § "Benchmark Reference
// Data") — these are Dani's measurement values, not engineering ones.
// If a future role family expands the template set, regenerate these
// from the new distribution rather than hand-tuning.
//
// Static at module load — no AI calls, no DB reads, no runtime cost.

export interface ConstructBenchmark {
  low: number;
  high: number;
}

export const CONSTRUCT_BENCHMARKS: Record<string, ConstructBenchmark> = {
  FLUID_REASONING: { low: 10, high: 18 },
  EXECUTIVE_CONTROL: { low: 6, high: 12 },
  COGNITIVE_FLEXIBILITY: { low: 5, high: 10 },
  METACOGNITIVE_CALIBRATION: { low: 5, high: 10 },
  LEARNING_VELOCITY: { low: 10, high: 22 },
  SYSTEMS_DIAGNOSTICS: { low: 8, high: 18 },
  PATTERN_RECOGNITION: { low: 8, high: 15 },
  QUANTITATIVE_REASONING: { low: 12, high: 20 },
  SPATIAL_VISUALIZATION: { low: 10, high: 20 },
  MECHANICAL_REASONING: { low: 8, high: 15 },
  PROCEDURAL_RELIABILITY: { low: 8, high: 20 },
  ETHICAL_JUDGMENT: { low: 5, high: 12 },
};

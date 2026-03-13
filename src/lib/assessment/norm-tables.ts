/**
 * Percentile lookup tables per construct.
 *
 * STATUS: PLACEHOLDER — these are synthetic sigmoid curves, NOT derived from
 * empirical norming data. They use a logistic function centered at 0.5 with
 * per-construct difficulty offsets estimated from item difficulty distributions.
 *
 * RECALIBRATION GUIDE:
 * 1. Collect N ≥ 200 assessment completions with known population characteristics
 * 2. Run `npx ts-node src/lib/assessment/norm-recalibrator.ts` — it reads all
 *    scored assessments from the DB and produces updated percentile tables
 * 3. Replace `defaultMapping()` with the empirical lookup tables from the output
 * 4. Re-run scoring pipeline on a sample to verify percentile shifts are reasonable
 * 5. Commit the updated tables with the norming study date and sample size
 *
 * WHEN TO RECALIBRATE:
 * - After adding/removing items to the item bank (difficulty distribution changes)
 * - After changing scoring weights in pipeline.ts
 * - After accumulating 200+ additional completions (quarterly recommended)
 * - After any change to the assessment flow that affects raw score distributions
 *
 * rawScore: 0-1 (proportion correct / average evaluation score)
 * Returns: percentile 1-99
 */

// Default mapping: simple sigmoid-like curve centered at 0.5
function defaultMapping(rawScore: number): number {
  // Map 0-1 raw score to 1-99 percentile using a logistic curve
  const k = 6; // steepness
  const midpoint = 0.5;
  const logistic = 1 / (1 + Math.exp(-k * (rawScore - midpoint)));
  return Math.max(1, Math.min(99, Math.round(logistic * 98 + 1)));
}

// Per-construct adjustments (difficulty calibration)
const DIFFICULTY_OFFSETS: Record<string, number> = {
  FLUID_REASONING: -0.05,        // harder items
  EXECUTIVE_CONTROL: 0,
  COGNITIVE_FLEXIBILITY: 0.05,   // open-response items scored generously
  METACOGNITIVE_CALIBRATION: 0,
  LEARNING_VELOCITY: 0,
  SYSTEMS_DIAGNOSTICS: -0.05,
  PATTERN_RECOGNITION: 0,
  QUANTITATIVE_REASONING: -0.05,
  SPATIAL_VISUALIZATION: 0,
  MECHANICAL_REASONING: 0,
  PROCEDURAL_RELIABILITY: 0.1,   // Likert items tend toward positive
  ETHICAL_JUDGMENT: 0.05,
};

export function rawScoreToPercentile(construct: string, rawScore: number): number {
  const offset = DIFFICULTY_OFFSETS[construct] || 0;
  const adjusted = Math.max(0, Math.min(1, rawScore - offset));
  return defaultMapping(adjusted);
}

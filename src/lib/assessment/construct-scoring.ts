import { rawScoreToPercentile } from "./norm-tables";

interface ScoredItem {
  itemId: string;
  construct: string;
  rawScore: number;
  responseTimeMs?: number;
}

interface ConstructScore {
  construct: string;
  layer: string;
  rawScore: number;
  percentile: number;
  itemCount: number;
  avgResponseTimeMs: number;
}

export const CONSTRUCT_LAYERS: Record<string, string> = {
  FLUID_REASONING: "COGNITIVE_CORE",
  EXECUTIVE_CONTROL: "COGNITIVE_CORE",
  COGNITIVE_FLEXIBILITY: "COGNITIVE_CORE",
  METACOGNITIVE_CALIBRATION: "COGNITIVE_CORE",
  LEARNING_VELOCITY: "COGNITIVE_CORE",
  SYSTEMS_DIAGNOSTICS: "TECHNICAL_APTITUDE",
  PATTERN_RECOGNITION: "TECHNICAL_APTITUDE",
  QUANTITATIVE_REASONING: "TECHNICAL_APTITUDE",
  SPATIAL_VISUALIZATION: "TECHNICAL_APTITUDE",
  MECHANICAL_REASONING: "TECHNICAL_APTITUDE",
  PROCEDURAL_RELIABILITY: "BEHAVIORAL_INTEGRITY",
  ETHICAL_JUDGMENT: "BEHAVIORAL_INTEGRITY",
};

/**
 * Aggregate scored items into per-construct scores with percentiles.
 */
export function scoreConstructs(scoredItems: ScoredItem[]): ConstructScore[] {
  // Group by construct
  const byConstruct = new Map<string, ScoredItem[]>();
  for (const item of scoredItems) {
    const group = byConstruct.get(item.construct) || [];
    group.push(item);
    byConstruct.set(item.construct, group);
  }

  const results: ConstructScore[] = [];

  for (const [construct, items] of byConstruct) {
    const rawScore = items.reduce((sum, i) => sum + i.rawScore, 0) / items.length;
    const times = items.filter((i) => i.responseTimeMs).map((i) => i.responseTimeMs!);
    const avgResponseTimeMs = times.length > 0
      ? Math.round(times.reduce((a, b) => a + b, 0) / times.length)
      : 0;

    const percentile = rawScoreToPercentile(construct, rawScore);

    results.push({
      construct,
      layer: CONSTRUCT_LAYERS[construct] || "COGNITIVE_CORE",
      rawScore: Math.round(rawScore * 100) / 100,
      percentile,
      itemCount: items.length,
      avgResponseTimeMs,
    });
  }

  return results;
}

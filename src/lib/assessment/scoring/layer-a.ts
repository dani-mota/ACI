import type { Construct, AssessmentAct } from "@/generated/prisma/client";
import type { LayerAScore } from "../types";

/**
 * Layer A: Deterministic scoring for structured items (Act 2 + Act 3 confidence items).
 *
 * Binary accuracy (0/1) scaled by difficulty parameter.
 * Harder items contribute more to the score.
 */

interface DeterministicItem {
  itemId: string;
  construct: Construct;
  difficulty: number;
  correct: boolean;
  responseTimeMs?: number;
  act: AssessmentAct;
}

/**
 * Score a single deterministic item.
 * Score = correct ? (1 + (difficulty - 0.5) * 0.3) : 0
 */
export function scoreItem(item: DeterministicItem): LayerAScore {
  const rawScore = item.correct
    ? 1 * (1 + (item.difficulty - 0.5) * 0.3)
    : 0;

  return {
    itemId: item.itemId,
    construct: item.construct,
    rawScore,
    difficultyParam: item.difficulty,
    responseTimeMs: item.responseTimeMs,
    act: item.act,
  };
}

/**
 * Aggregate Layer A scores per construct.
 * Returns mean of difficulty-scaled scores.
 */
export function aggregateLayerA(
  scores: LayerAScore[],
): Map<string, { score: number; itemCount: number; avgResponseTimeMs: number }> {
  const byConstruct = new Map<string, LayerAScore[]>();

  for (const score of scores) {
    const key = score.construct as string;
    const group = byConstruct.get(key) || [];
    group.push(score);
    byConstruct.set(key, group);
  }

  const result = new Map<string, { score: number; itemCount: number; avgResponseTimeMs: number }>();

  for (const [construct, items] of byConstruct) {
    const maxPossibleScores = items.map((i) => 1 + (i.difficultyParam - 0.5) * 0.3);
    const maxPossibleTotal = maxPossibleScores.reduce((a, b) => a + b, 0);
    const actualTotal = items.reduce((sum, i) => sum + i.rawScore, 0);

    // Normalize to 0-1 range
    const score = maxPossibleTotal > 0 ? actualTotal / maxPossibleTotal : 0;

    const times = items.filter((i) => i.responseTimeMs).map((i) => i.responseTimeMs!);
    const avgResponseTimeMs = times.length > 0
      ? Math.round(times.reduce((a, b) => a + b, 0) / times.length)
      : 0;

    result.set(construct, { score, itemCount: items.length, avgResponseTimeMs });
  }

  return result;
}

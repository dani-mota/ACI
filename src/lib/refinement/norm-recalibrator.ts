/**
 * Norm Recalibrator
 *
 * Computes empirical percentile breakpoints for each construct from
 * real SubtestResult data. Returns updated norm tables that can
 * replace the static lookup tables in norm-tables.ts.
 *
 * Called manually — not a cron job.
 */

import prisma from "@/lib/prisma";
import { Construct } from "@/generated/prisma/client";

export interface ConstructNorm {
  construct: string;
  sampleSize: number;
  mean: number;
  sd: number;
  percentileBreakpoints: Record<number, number>; // percentile → rawScore
}

/**
 * Compute empirical norms for all constructs.
 * Optionally filter to a specific orgId.
 */
export async function recalibrateNorms(orgId?: string): Promise<ConstructNorm[]> {
  const where = orgId
    ? {
        assessment: {
          candidate: { orgId },
        },
      }
    : {};

  const subtestResults = await prisma.subtestResult.findMany({
    where,
    select: {
      construct: true,
      rawScore: true,
    },
  });

  // Group raw scores by construct
  const scoresByConstruct = new Map<string, number[]>();
  for (const result of subtestResults) {
    if (!scoresByConstruct.has(result.construct)) {
      scoresByConstruct.set(result.construct, []);
    }
    scoresByConstruct.get(result.construct)!.push(result.rawScore);
  }

  const norms: ConstructNorm[] = [];
  const constructs = Object.values(Construct) as string[];

  for (const construct of constructs) {
    const scores = scoresByConstruct.get(construct);
    if (!scores || scores.length < 10) continue;

    const sorted = [...scores].sort((a, b) => a - b);
    const n = sorted.length;

    const mean = sorted.reduce((s, v) => s + v, 0) / n;
    const variance = sorted.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / n;
    const sd = Math.sqrt(variance);

    // Build percentile breakpoints at every 5th percentile
    const breakpoints: Record<number, number> = {};
    for (let p = 5; p <= 95; p += 5) {
      const rank = Math.floor((p / 100) * (n - 1));
      breakpoints[p] = Math.round(sorted[rank] * 1000) / 1000;
    }
    breakpoints[1] = sorted[0];
    breakpoints[99] = sorted[n - 1];

    norms.push({
      construct: construct as string,
      sampleSize: n,
      mean: Math.round(mean * 1000) / 1000,
      sd: Math.round(sd * 1000) / 1000,
      percentileBreakpoints: breakpoints,
    });
  }

  return norms;
}

/**
 * Convert a raw score to an empirical percentile using computed norms.
 */
export function rawScoreToPercentile(
  rawScore: number,
  norms: ConstructNorm,
): number {
  const { percentileBreakpoints } = norms;
  const breakpoints = Object.entries(percentileBreakpoints)
    .map(([p, v]) => ({ percentile: parseInt(p), value: v }))
    .sort((a, b) => a.value - b.value);

  for (let i = breakpoints.length - 1; i >= 0; i--) {
    if (rawScore >= breakpoints[i].value) {
      return breakpoints[i].percentile;
    }
  }
  return 1;
}

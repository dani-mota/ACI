/**
 * Validity Analyzer
 *
 * Computes Pearson correlations between SubtestResult percentiles and
 * OutcomeRecord values. Returns a validity coefficient matrix per
 * (construct, metricType, roleSlug).
 *
 * Called manually — not a cron job.
 */

import prisma from "@/lib/prisma";

export interface ValidityCoefficient {
  construct: string;
  metricType: string;
  roleSlug: string;
  pearsonR: number;
  sampleSize: number;
}

/**
 * Compute validity coefficients for a given org.
 * Matches candidates who have both SubtestResults and OutcomeRecords.
 */
export async function analyzeValidity(orgId: string): Promise<ValidityCoefficient[]> {
  // Fetch all candidates with outcomes and assessment results
  const candidates = await prisma.candidate.findMany({
    where: { orgId },
    include: {
      outcomes: true,
      assessment: {
        include: { subtestResults: true },
      },
      primaryRole: true,
    },
  });

  // Only keep candidates with both outcomes and completed assessments
  const eligible = candidates.filter(
    (c) => c.outcomes.length > 0 && c.assessment?.subtestResults.length
  );

  if (eligible.length < 5) return []; // Need minimum sample for meaningful correlations

  // Build pairs: (construct percentile, outcome value) per (construct, metricType, roleSlug)
  const pairMap = new Map<
    string, // key: "construct|metricType|roleSlug"
    { x: number; y: number }[]
  >();

  for (const candidate of eligible) {
    if (!candidate.assessment) continue;
    const roleSlug = candidate.primaryRole.slug;

    for (const subtest of candidate.assessment.subtestResults) {
      for (const outcome of candidate.outcomes) {
        const key = `${subtest.construct}|${outcome.metricType}|${roleSlug}`;
        if (!pairMap.has(key)) pairMap.set(key, []);
        pairMap.get(key)!.push({ x: subtest.percentile, y: outcome.metricValue });
      }
    }
  }

  const results: ValidityCoefficient[] = [];

  for (const [key, pairs] of pairMap.entries()) {
    if (pairs.length < 5) continue;

    const [construct, metricType, roleSlug] = key.split("|");
    const r = pearsonR(
      pairs.map((p) => p.x),
      pairs.map((p) => p.y)
    );

    results.push({
      construct,
      metricType,
      roleSlug,
      pearsonR: r,
      sampleSize: pairs.length,
    });
  }

  // Sort by absolute correlation descending
  return results.sort((a, b) => Math.abs(b.pearsonR) - Math.abs(a.pearsonR));
}

function pearsonR(x: number[], y: number[]): number {
  const n = x.length;
  if (n < 2) return 0;

  const meanX = x.reduce((s, v) => s + v, 0) / n;
  const meanY = y.reduce((s, v) => s + v, 0) / n;

  let num = 0;
  let denX = 0;
  let denY = 0;

  for (let i = 0; i < n; i++) {
    const dx = x[i] - meanX;
    const dy = y[i] - meanY;
    num += dx * dy;
    denX += dx * dx;
    denY += dy * dy;
  }

  const den = Math.sqrt(denX * denY);
  return den === 0 ? 0 : Math.round((num / den) * 1000) / 1000;
}

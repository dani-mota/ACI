/**
 * PRO-138: Trajectory Readiness — archetype-fit ranking for the employee
 * dossier's retention-narrative panel.
 *
 * Pure compute. No Prisma. Consumes raw subtestResult shape from
 * Assessment.subtestResults (construct + percentile).
 *
 * Metric: **Euclidean distance**, per the AC formula text ("1 minus the
 * normalized Euclidean distance, expressed as a percentage"). The AC
 * prose also references "cosine similarity (or nearest-neighbor scoring)"
 * — Slack to Dani 2026-05-12 flagged the discrepancy; defaulting to
 * Euclidean per the formula. If validation alignment ever requires
 * cosine, the swap is one helper, no other plan changes.
 */

import type { RoleArchetype } from "@/lib/assessment/archetypes";

export interface ArchetypeFit {
  archetypeId: string;
  archetypeName: string;
  archetypeDescription: string;
  /** 0-100 integer fit score. Higher = better fit. */
  fitScore: number;
  /** Top-3 constructs that contribute most to this fit (or to misfit, for
   *  the bottom rows). Names match CONSTRUCTS keys. */
  drivingConstructs: string[];
}

export interface TrajectoryReadiness {
  /** Top 5 archetypes by fit (descending). */
  top: ArchetypeFit[];
  /** Bottom 2 archetypes by fit (ascending — least aligned first). */
  bottom: ArchetypeFit[];
}

/**
 * Computes the ranked archetype-fit summary for an employee.
 *
 * Metric: Euclidean distance between the employee's 12-construct percentile
 * profile and each archetype's demand profile. Demands ship on the 1-10
 * authoring scale (matches PRO-135); they're scaled to 0-100 to compare
 * apples-to-apples with employee percentiles before computing the distance.
 * The distance is normalized by the max possible (100 * sqrt(n)) and
 * inverted to produce a 0-100 fit percentage.
 *
 * Driving constructs (per archetype) are the 3 constructs that contribute
 * most to its score:
 *   - Top rows (high fit): smallest |diff| (best-matched constructs that
 *     produced the high fit).
 *   - Bottom rows (low fit): largest |diff| (most-misfit constructs that
 *     explain the low alignment — "less aligned with your current profile"
 *     framing).
 *
 * Returns `null` when:
 *   - Employee has fewer than 12 subtest results (incomplete assessment), OR
 *   - Library has fewer than 7 archetypes (defensive lower bound — top-5
 *     plus bottom-2 = 7 minimum to avoid overlap).
 *
 * Returns a `TrajectoryReadiness` with exactly 5 `top` + 2 `bottom`
 * archetypes for a library of 10 (the seeded default).
 */
export function computeTrajectoryReadiness(
  employeeScores: { construct: string; percentile: number }[],
  library: RoleArchetype[],
): TrajectoryReadiness | null {
  // Defensive lower bounds — see jsdoc.
  if (employeeScores.length < 12) return null;
  if (library.length < 7) return null;

  // Quick lookup: construct -> employee percentile (0-100 scale).
  const employeeByConstruct = new Map<string, number>();
  for (const s of employeeScores) employeeByConstruct.set(s.construct, s.percentile);

  // First pass: compute per-archetype fit + per-construct squared diffs.
  // Keep the diffs around so the second pass can pick driving constructs
  // with a different sort direction per section (top vs bottom).
  type FitWithDiffs = ArchetypeFit & {
    _diffs: { construct: string; squaredDiff: number }[];
  };

  const fits: FitWithDiffs[] = library.map((archetype) => {
    const diffs: { construct: string; squaredDiff: number }[] = [];
    let sumSquared = 0;
    let n = 0;

    for (const [construct, demand1to10] of Object.entries(archetype.demands)) {
      if (demand1to10 == null) continue;
      const employeePct = employeeByConstruct.get(construct);
      if (employeePct == null) continue;
      // 1-10 demand → 0-100 to match employee percentile scale.
      const demandPct = demand1to10 * 10;
      const diff = employeePct - demandPct;
      const squared = diff * diff;
      diffs.push({ construct, squaredDiff: squared });
      sumSquared += squared;
      n++;
    }

    // No overlapping constructs — treat as worst possible fit. Shouldn't
    // happen with the seeded library (all archetypes specify demands on
    // CONSTRUCTS keys), but defensive.
    if (n === 0) {
      return {
        archetypeId: archetype.id,
        archetypeName: archetype.name,
        archetypeDescription: archetype.description,
        fitScore: 0,
        drivingConstructs: [],
        _diffs: diffs,
      };
    }

    // Normalize Euclidean distance to 0..1, then invert to fit %.
    const euclidean = Math.sqrt(sumSquared);
    const maxEuclidean = 100 * Math.sqrt(n); // max diff per construct is 100
    const normalized = euclidean / maxEuclidean;
    const fitScore = Math.round((1 - normalized) * 100);

    return {
      archetypeId: archetype.id,
      archetypeName: archetype.name,
      archetypeDescription: archetype.description,
      fitScore,
      drivingConstructs: [], // filled in second pass per section
      _diffs: diffs,
    };
  });

  // Sort descending by fit (highest first).
  fits.sort((a, b) => b.fitScore - a.fitScore);

  // Top 5: drivers = smallest |diff| (best matches that drive the high fit).
  const top: ArchetypeFit[] = fits.slice(0, 5).map((f) => ({
    archetypeId: f.archetypeId,
    archetypeName: f.archetypeName,
    archetypeDescription: f.archetypeDescription,
    fitScore: f.fitScore,
    drivingConstructs: [...f._diffs]
      .sort((a, b) => a.squaredDiff - b.squaredDiff)
      .slice(0, 3)
      .map((d) => d.construct),
  }));

  // Bottom 2: drivers = largest |diff| (most-misfit constructs).
  // .slice(-2) → [second-to-last, last]; .reverse() → [worst, second-worst]
  // = ascending fit order ("least aligned first") per AC.
  const bottom: ArchetypeFit[] = fits
    .slice(-2)
    .reverse()
    .map((f) => ({
      archetypeId: f.archetypeId,
      archetypeName: f.archetypeName,
      archetypeDescription: f.archetypeDescription,
      fitScore: f.fitScore,
      drivingConstructs: [...f._diffs]
        .sort((a, b) => b.squaredDiff - a.squaredDiff)
        .slice(0, 3)
        .map((d) => d.construct),
    }));

  return { top, bottom };
}

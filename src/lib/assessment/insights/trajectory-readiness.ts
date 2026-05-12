/**
 * PRO-138: Trajectory Readiness — archetype-fit ranking for the employee
 * dossier's retention-narrative panel.
 *
 * This file ships in two commits:
 *   - Commit 4 (this commit): types only — panel + page can compile against
 *     these shapes while the compute math is held.
 *   - Commit 3 (held): `computeTrajectoryReadiness` body, after Dani confirms
 *     Euclidean vs cosine metric. See plan file for the pre-flight Slack.
 *
 * Pure compute target. No Prisma. Consumes raw subtestResult shape from
 * Assessment.subtestResults (construct + percentile).
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
 * **HELD PENDING DANI'S METRIC CONFIRMATION (cosine vs Euclidean).** See
 * the PRO-138 plan file for the pre-flight Slack. Both the distance loop
 * AND the driving-constructs extraction are metric-dependent.
 *
 * Returns `null` when:
 *   - Employee has fewer than 12 subtest results (incomplete assessment), OR
 *   - Library has fewer than 7 archetypes (defensive lower bound — top-5
 *     plus bottom-2 = 7 minimum to avoid overlap).
 *
 * Returns a `TrajectoryReadiness` with exactly 5 `top` + 2 `bottom`
 * archetypes for a library of 10 (the seeded default).
 *
 * Until commit 3 lands, returns `null` unconditionally so callers can wire
 * the panel against a deterministic shape.
 */
export function computeTrajectoryReadiness(
  _employeeScores: { construct: string; percentile: number }[],
  _library: RoleArchetype[],
): TrajectoryReadiness | null {
  // Held: see file header. Commit 3 replaces this with the real compute.
  return null;
}

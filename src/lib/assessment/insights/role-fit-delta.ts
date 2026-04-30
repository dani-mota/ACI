/**
 * PRO-136: Cognitive Role Fit Delta — per-construct shape comparison between
 * an employee's scores and their role's cognitive demand profile.
 *
 * Pure compute. No Prisma. No I/O (except a dev-only `console.warn` for
 * unknown constructs — see Decision #6 in the plan).
 *
 * Establishes the `src/lib/assessment/insights/` directory; PRO-137 / PRO-138
 * / PRO-139 will live next to it.
 *
 * Scale discipline (Decision #1):
 *   - Inputs are 0-100 (subtest percentiles + expandTo100'd demands).
 *   - Output `delta` is 0-100. The panel divides by 10 at the display
 *     boundary to render the AC's "+/- on a 10-point scale" framing.
 *   - The threshold (±10 here = ±1 on the 10-pt display) matches PRO-131's
 *     `GAP_THRESHOLD` for the radar's gap-dot color logic.
 */

import { CONSTRUCTS } from "@/lib/constructs";
import type { RoleDemandProfileEntry } from "@/lib/assessment/role-demand-resolution";

export type FitDirection = "over_spec" | "growth_edge" | "aligned" | "no_demand";

export interface RoleFitDeltaEntry {
  construct: string;
  /** 0-100 percentile, same scale as SubtestResult.percentile. */
  employeeScore: number;
  /** 0-100 (converted from 1-10 storage by `expandTo100`). null when no
   *  demand was specified for this construct in the profile. */
  demandScore: number | null;
  /** Signed delta on 0-100 scale (employeeScore - demandScore). null when
   *  demandScore is null — there's nothing to subtract from. */
  delta: number | null;
  direction: FitDirection;
}

/** ±10 on the 0-100 scale = ±1 on the AC's 10-point display scale.
 *  Matches PRO-131's `GAP_THRESHOLD` for radar gap-dot color logic. */
const ALIGNMENT_THRESHOLD = 10;

/**
 * Per-construct delta between an employee's scores and the role's demands.
 *
 * Iterates over `Object.keys(CONSTRUCTS)` (always 12) so partial profiles
 * still render every construct — missing demands surface as `"no_demand"`
 * rows. Visual continuity with the radar above (which always shows 12 spokes).
 *
 * Filters unknown constructs in `roleDemandProfile` (enum drift / stale data)
 * with a non-production warning. The panel never sees raw enum codes.
 */
export function computeRoleFitDelta(
  employeeScores: { construct: string; percentile: number }[],
  roleDemandProfile: RoleDemandProfileEntry[],
): RoleFitDeltaEntry[] {
  const employeeByConstruct = new Map(
    employeeScores.map((s) => [s.construct, s.percentile]),
  );

  // Validate: drop any roleDemandProfile entries whose construct isn't in
  // CONSTRUCTS. In dev, warn so the upstream data drift gets noticed.
  const validDemands = new Map<string, number>();
  for (const d of roleDemandProfile) {
    if (!(d.construct in CONSTRUCTS)) {
      if (process.env.NODE_ENV !== "production") {
        // eslint-disable-next-line no-console
        console.warn(
          `[role-fit-delta] dropping unknown construct from demand profile: ${d.construct}`,
        );
      }
      continue;
    }
    validDemands.set(d.construct, d.demandScore);
  }

  // Always emit one row per CONSTRUCTS key (12 rows). Partial profiles get
  // `"no_demand"` rows; visual parity with the 12-spoke radar above.
  return Object.keys(CONSTRUCTS).map((construct) => {
    const employeeScore = employeeByConstruct.get(construct) ?? 0;
    const demandScore = validDemands.get(construct);

    if (demandScore === undefined) {
      return {
        construct,
        employeeScore,
        demandScore: null,
        delta: null,
        direction: "no_demand",
      };
    }

    const delta = employeeScore - demandScore;
    const direction: FitDirection =
      delta >= ALIGNMENT_THRESHOLD
        ? "over_spec"
        : delta <= -ALIGNMENT_THRESHOLD
          ? "growth_edge"
          : "aligned";

    return { construct, employeeScore, demandScore, delta, direction };
  });
}

/**
 * PRO-135: Pure helpers + canonical type for the role-demand resolution layer.
 *
 * Two scales coexist:
 *   - Authoring (1-10): how HR leaders score sliders. What the DB stores in
 *     `RoleDemandProfile.constructScores`.
 *   - Radar overlay (0-100): what `ConstructMapEmployee` consumes — same scale
 *     as `SubtestResult.percentile`, so the dual polygon is comparable.
 *
 * The conversion lives in exactly one place — `expandTo100` — called by the
 * single server resolver `resolveRoleDemandProfileForEmployee` in `lib/data.ts`.
 * Authoring components read raw 1-10 directly via a different path. This is
 * the "single public read-path" guard against future ×10 mistakes.
 *
 * `RoleDemandProfileEntry` is owned here (not co-located in the radar
 * component) so PRO-136+ consumers can import the type without creating a
 * `lib → components` circular-dep risk.
 */

/** Single radar-spoke entry on the 0-100 (percentile) scale. */
export interface RoleDemandProfileEntry {
  construct: string;
  /** 0-100, same scale as subtestResults.percentile. */
  demandScore: number;
}

/** Authoring-scale (1-10) construct score map. Partial because templates and
 *  in-progress profiles may stake out only a subset of the 12 constructs. */
export type AuthoringScores = Partial<Record<string, number>>;

/**
 * Single-public-read-path output shape. `profileId` and `updatedAt` are
 * unused by PRO-135's UI but they're free upfront and save PRO-136+ from
 * refactoring the resolver later when they need cache-invalidation signals.
 */
export interface ResolvedRoleDemand {
  profileId: string;
  updatedAt: Date;
  demands: RoleDemandProfileEntry[];
}

/**
 * THIS IS THE ONLY 1-10 → 0-100 CONVERSION POINT. If you need the demand
 * scores on the radar scale anywhere else, route through here.
 */
export function expandTo100(scores: AuthoringScores): RoleDemandProfileEntry[] {
  const out: RoleDemandProfileEntry[] = [];
  for (const [construct, value] of Object.entries(scores)) {
    if (typeof value !== "number") continue;
    out.push({ construct, demandScore: value * 10 });
  }
  return out;
}

/**
 * Count scored constructs for the "N of 12 constructs scored" indicator
 * on incomplete profile cards. Counts non-null/non-undefined numeric values.
 */
export function countScoredConstructs(scores: AuthoringScores): number {
  let n = 0;
  for (const value of Object.values(scores)) {
    if (typeof value === "number") n++;
  }
  return n;
}

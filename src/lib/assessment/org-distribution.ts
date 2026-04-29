/**
 * PRO-134: Org-wide construct distribution types and pure helpers.
 *
 * Lives outside `lib/data.ts` so client components can import the type and
 * `quartileLabel` without dragging prisma into the client bundle. The actual
 * data-fetcher (`getOrgConstructDistributions`) stays in `lib/data.ts` and
 * runs on the server only.
 */

export interface OrgConstructDistribution {
  construct: string;
  /** Quartile breakpoints derived from this org's SubtestResult.percentile values.
   * q1 = 25th percentile of the org's distribution; q2 = median; q3 = 75th. */
  q1: number;
  q2: number;
  q3: number;
  /** Total assessments contributing to this distribution. < 10 → too sparse to
   * label; UI falls back to the generic "compared to your colleagues" string. */
  sampleSize: number;
}

/**
 * Map an employee's percentile to a developmental quartile label relative to
 * their organization's distribution. Employee Mode replacement language for the
 * forbidden "X percentile of candidates" phrasing.
 */
export function quartileLabel(
  employeePercentile: number,
  distribution: OrgConstructDistribution,
): string {
  if (distribution.sampleSize < 10) return "compared to your colleagues";
  if (employeePercentile >= distribution.q3) return "Top quartile in our company";
  if (employeePercentile >= distribution.q2) return "Upper-mid quartile";
  if (employeePercentile >= distribution.q1) return "Lower-mid quartile";
  return "Developing relative to colleagues";
}

"use client";

/**
 * PRO-136: Role Fit Delta panel — renders the per-construct shape comparison
 * between an employee's scores and their role's cognitive demand profile.
 *
 * P0 insight of Employee Mode. Builds on PRO-135's `roleDemandProfile` prop
 * already wired through page → dossier. Pure presentation; the math lives
 * in `lib/assessment/insights/role-fit-delta.ts`.
 */

import { useMemo } from "react";
import { ArrowUp, ArrowDown, Minus } from "lucide-react";
import { CONSTRUCTS } from "@/lib/constructs";
import {
  computeRoleFitDelta,
  type FitDirection,
  type RoleFitDeltaEntry,
} from "@/lib/assessment/insights/role-fit-delta";
import type { RoleDemandProfileEntry } from "@/lib/assessment/role-demand-resolution";

interface RoleFitDeltaPanelProps {
  subtestResults: { construct: string; percentile: number }[];
  roleDemandProfile?: RoleDemandProfileEntry[];
}

const DIRECTION_LABEL: Record<FitDirection, string> = {
  over_spec: "Over-Spec",
  growth_edge: "Growth Edge",
  aligned: "Aligned",
  no_demand: "Not specified",
};

const DIRECTION_COLOR: Record<FitDirection, string> = {
  over_spec: "text-aci-green",
  growth_edge: "text-aci-amber",
  aligned: "text-muted-foreground",
  no_demand: "text-muted-foreground italic",
};

const DIRECTION_ICON: Record<FitDirection, typeof ArrowUp | null> = {
  over_spec: ArrowUp,
  growth_edge: ArrowDown,
  aligned: Minus,
  no_demand: null,
};

/**
 * Threshold-derived display delta. `aligned` rows render `0` regardless of
 * the underlying 0-100 delta so the colored direction and the displayed
 * number agree at boundaries — prevents the "+1 green vs +1 grey" confusion.
 */
function displayDelta(row: RoleFitDeltaEntry): string {
  if (row.direction === "no_demand" || row.delta === null) return "—";
  if (row.direction === "aligned") return "0";
  const tenPoint = Math.round(row.delta / 10);
  return tenPoint > 0 ? `+${tenPoint}` : String(tenPoint);
}

export function RoleFitDeltaPanel({
  subtestResults,
  roleDemandProfile,
}: RoleFitDeltaPanelProps) {
  // Hooks must run before early returns — useMemo always called, even with [].
  const rows = useMemo(
    () => computeRoleFitDelta(subtestResults, roleDemandProfile ?? []),
    [subtestResults, roleDemandProfile],
  );

  if (!roleDemandProfile) {
    return (
      <p className="text-xs text-muted-foreground italic">
        Role demand profile not configured for this role.
      </p>
    );
  }

  return (
    <table className="w-full text-sm">
      <thead className="text-[10px] uppercase tracking-wider text-muted-foreground">
        <tr>
          <th className="text-left font-medium pb-2">Construct</th>
          <th className="text-right font-medium pb-2">Your Score</th>
          <th className="text-right font-medium pb-2">Role Demand</th>
          <th className="text-right font-medium pb-2">Delta</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          // Compute layer guarantees row.construct is a valid CONSTRUCTS key
          // (Decision #6 filters unknowns upstream). No fallback needed —
          // if CONSTRUCTS[key] is undefined here, that's a constructs.ts bug
          // we want to surface loudly via React's error boundary, not paper
          // over by rendering the raw enum code.
          const meta = CONSTRUCTS[row.construct];
          const Icon = DIRECTION_ICON[row.direction];
          // Display precision: integer 1-10. SubtestResult percentiles round
          // to nearest integer on this scale; known precision loss at boundary
          // values (e.g. 45/54 both → 5) flagged in PR description.
          const employeeDisplay = Math.round(row.employeeScore / 10);
          const demandDisplay =
            row.demandScore === null ? "—" : Math.round(row.demandScore / 10);
          return (
            <tr key={row.construct} className="border-t border-border">
              <td className="py-2 text-foreground">{meta.name}</td>
              <td className="py-2 text-right font-mono">{employeeDisplay}</td>
              <td className="py-2 text-right font-mono">{demandDisplay}</td>
              <td className={`py-2 text-right font-mono ${DIRECTION_COLOR[row.direction]}`}>
                <span className="inline-flex items-center gap-1 justify-end">
                  {Icon && <Icon className="w-3 h-3" aria-hidden="true" />}
                  <span>{displayDelta(row)}</span>
                  <span className="ml-2 text-[10px] uppercase tracking-wider">
                    {DIRECTION_LABEL[row.direction]}
                  </span>
                </span>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

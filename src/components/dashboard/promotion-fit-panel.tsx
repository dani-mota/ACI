"use client";

/**
 * PRO-139: Promotion Fit panel — comparison of an employee's scores against
 * the role's next-level demand profile, with a single-string developmental
 * verdict.
 *
 * Pure presentation. Math lives in
 * `src/lib/assessment/insights/promotion-fit.ts`. Renders inside the Fit
 * Panels tabbed container (`fit-panels.tsx`). Visual structure mirrors
 * `role-fit-delta-panel.tsx` so the two panels read as siblings.
 *
 * Vocabulary discipline (PRO-134): the verdict string is the AC-verbatim
 * output of `renderVerdictString` — never paraphrased here. Direction labels
 * stay developmental ("Over-Spec", "Growth Edge", "Aligned").
 */

import { useMemo } from "react";
import { ArrowUp, ArrowDown, Minus } from "lucide-react";
import { CONSTRUCTS } from "@/lib/constructs";
import {
  computePromotionFit,
  renderVerdictString,
} from "@/lib/assessment/insights/promotion-fit";
import type { FitDirection, RoleFitDeltaEntry } from "@/lib/assessment/insights/role-fit-delta";
import type { RoleDemandProfileEntry } from "@/lib/assessment/role-demand-resolution";

interface PromotionFitPanelProps {
  subtestResults: { construct: string; percentile: number }[];
  /** Next-level demand profile (0-100 scale). Undefined when the employee's
   *  role family has no `nextLevelProfileId` configured — panel renders the
   *  AC empty-state copy instead of a table. */
  nextLevelDemand?: RoleDemandProfileEntry[];
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

function displayDelta(row: RoleFitDeltaEntry): string {
  if (row.direction === "no_demand" || row.delta === null) return "—";
  if (row.direction === "aligned") return "0";
  const tenPoint = Math.round(row.delta / 10);
  return tenPoint > 0 ? `+${tenPoint}` : String(tenPoint);
}

export function PromotionFitPanel({
  subtestResults,
  nextLevelDemand,
}: PromotionFitPanelProps) {
  // Hooks must run before early returns.
  const result = useMemo(
    () => computePromotionFit(subtestResults, nextLevelDemand ?? []),
    [subtestResults, nextLevelDemand],
  );

  if (!nextLevelDemand) {
    return (
      <p className="text-xs text-muted-foreground italic">
        Next-level demand profile not configured for this role family.
      </p>
    );
  }

  const verdictString = renderVerdictString(result);

  return (
    <div className="space-y-4">
      {/* Verdict header — AC-verbatim string. Bold prominence above the
          table so it reads as the headline, not a footnote. */}
      <div className="border-l-2 border-foreground/30 pl-3">
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
          Promotion Readiness
        </p>
        <p className="text-sm text-foreground">{verdictString}</p>
      </div>

      <table className="w-full text-sm">
        <thead className="text-[10px] uppercase tracking-wider text-muted-foreground">
          <tr>
            <th className="text-left font-medium pb-2">Construct</th>
            <th className="text-right font-medium pb-2">Your Score</th>
            <th className="text-right font-medium pb-2">Next-Level Demand</th>
            <th className="text-right font-medium pb-2">Delta</th>
          </tr>
        </thead>
        <tbody>
          {result.rows.map((row) => {
            const meta = CONSTRUCTS[row.construct];
            const Icon = DIRECTION_ICON[row.direction];
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
    </div>
  );
}

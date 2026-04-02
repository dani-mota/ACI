"use client";

import { AlertTriangle } from "lucide-react";
import {
  CONSTRUCT_LABELS,
  type ConstructId,
  type TeamAggregateMetrics,
} from "@/lib/team-composition/types";
import type { IndividualProfile } from "@/lib/team-composition/types";

interface SpofAlertsProps {
  metrics: TeamAggregateMetrics;
  members: IndividualProfile[];
}

export function SpofAlerts({ metrics, members }: SpofAlertsProps) {
  const spofs = Object.entries(metrics.perConstruct)
    .filter(([, m]) => m.singlePointOfFailure)
    .map(([cid, m]) => {
      const keyMember = members.find((p) => m.aboveThreshold.includes(p.id));
      return { construct: cid as ConstructId, metric: m, keyMember };
    });

  if (spofs.length === 0) {
    return (
      <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-4">
        <div className="flex items-center gap-2 text-emerald-400 text-sm font-medium">
          <div className="w-2 h-2 rounded-full bg-emerald-500" />
          No Single Points of Failure Detected
        </div>
        <p className="text-xs text-slate-400 mt-1">
          Every critical construct has adequate coverage across multiple team members.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {spofs.map(({ construct, metric, keyMember }) => (
        <div
          key={construct}
          className="rounded-lg border border-amber-500/25 bg-amber-500/5 p-3"
        >
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
            <div className="flex-1">
              <div className="text-sm font-medium text-amber-400">
                {CONSTRUCT_LABELS[construct]}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Only{" "}
                <span className="text-slate-300 font-medium">
                  {keyMember?.name ?? "1 member"}
                </span>{" "}
                scores above threshold ({metric.aboveThreshold.length === 1 ? "1" : metric.aboveThreshold.length} of{" "}
                {metric.aboveThreshold.length + (members.length - metric.aboveThreshold.length)} members). Team mean:{" "}
                <span className="font-mono text-slate-300">{Math.round(metric.mean)}</span> vs ideal{" "}
                <span className="font-mono text-slate-300">{Math.round(metric.mean + metric.gapFromIdeal)}</span>.
                If this person leaves, the team loses critical capability.
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

"use client";

import { StatusBadge } from "@/components/ui/status-badge";
import { ScoreBar } from "@/components/ui/score-bar";
import { AlertTriangle, Clock, Eye, TrendingUp } from "lucide-react";
import { isEmployeeMode } from "@/lib/assessment/mode-utils";

interface DecisionSummaryProps {
  candidate: any;
  compositeScore: any;
  roleName: string;
}

export function DecisionSummary({ candidate, compositeScore, roleName }: DecisionSummaryProps) {
  // PRO-134: defensive guard. This component is candidate-mode only by route
  // topology today; the guard future-proofs against accidental imports into
  // an Employee Mode surface (verdict + red-flag content must never leak).
  if (isEmployeeMode(candidate?.assessment)) return null;

  const prediction = candidate.assessment?.predictions;
  const redFlags = candidate.assessment?.redFlags || [];

  return (
    <div className="bg-card border border-border p-4 space-y-3">
      <div>
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium mb-1.5">Decision</p>
        <div className="transition-all duration-300">
          <StatusBadge status={candidate.status} />
        </div>
      </div>

      <div>
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium mb-1.5">
          {roleName} Composite
        </p>
        <div className="flex items-center gap-2">
          <span className="text-xl font-bold text-foreground font-mono">
            {compositeScore?.percentile ?? "—"}
          </span>
          <span className="text-[10px] text-muted-foreground font-mono">/ 100</span>
        </div>
        <ScoreBar percentile={compositeScore?.percentile ?? 0} showLabel={false} height={6} />
        <p className="text-[10px] text-muted-foreground mt-1 font-mono">
          {compositeScore?.passed ? "ABOVE CUTLINE" : `${Math.abs(compositeScore?.distanceFromCutline ?? 0)} PTS FROM CUTLINE`}
        </p>
      </div>

      {redFlags.length > 0 && (
        <div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium mb-1.5">Flags</p>
          {redFlags.map((flag: any) => (
            <div key={flag.id} className={`flex items-start gap-2 text-[11px] p-2 mb-1 border ${
              flag.severity === "CRITICAL" ? "bg-aci-red/5 border-aci-red/20 text-aci-red" : flag.severity === "WARNING" ? "bg-aci-amber/5 border-aci-amber/20 text-aci-amber" : "bg-aci-blue/5 border-aci-blue/20 text-aci-blue"
            }`}>
              <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
              <span>{flag.title}</span>
            </div>
          ))}
        </div>
      )}

      {prediction && (
        <div className="space-y-2 pt-2 border-t border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <Clock className="w-3 h-3" /> RAMP TIME
            </div>
            <span className="text-[10px] font-mono font-medium text-foreground">{prediction.rampTimeLabel}</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <Eye className="w-3 h-3" /> SUPERVISION
            </div>
            <span className="text-[10px] font-mono font-medium text-foreground">{prediction.supervisionLoad}</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <TrendingUp className="w-3 h-3" /> CEILING
            </div>
            <span className="text-[10px] font-mono font-medium text-foreground">{prediction.performanceCeiling}</span>
          </div>
        </div>
      )}
    </div>
  );
}

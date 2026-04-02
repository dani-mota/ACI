"use client";

import { ShieldCheck, ShieldAlert, AlertTriangle } from "lucide-react";
import type { MissionCoverage } from "@/lib/team-composition/types";
import { CONSTRUCT_SHORT_LABELS } from "@/lib/team-composition/types";

interface CoverageMapProps {
  coverage: MissionCoverage;
}

function coverageColor(pct: number): string {
  if (pct >= 0.9) return "bg-emerald-500";
  if (pct >= 0.7) return "bg-amber-500";
  if (pct >= 0.5) return "bg-orange-500";
  return "bg-red-500";
}

function coverageTextColor(pct: number): string {
  if (pct >= 0.9) return "text-emerald-400";
  if (pct >= 0.7) return "text-amber-400";
  if (pct >= 0.5) return "text-orange-400";
  return "text-red-400";
}

export function CoverageMap({ coverage }: CoverageMapProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-medium text-slate-400 uppercase tracking-wider">
          Mission Coverage
        </h3>
        <div className="flex items-center gap-2">
          {coverage.averageCoverage >= 0.8 ? (
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
          ) : coverage.averageCoverage >= 0.5 ? (
            <AlertTriangle className="w-4 h-4 text-amber-400" />
          ) : (
            <ShieldAlert className="w-4 h-4 text-red-400" />
          )}
          <span className={`text-lg font-bold ${coverageTextColor(coverage.averageCoverage)}`}>
            {(coverage.averageCoverage * 100).toFixed(0)}%
          </span>
          <span className="text-[10px] text-slate-500">avg coverage</span>
        </div>
      </div>

      <div className="space-y-2">
        {coverage.phases.map((phase) => (
          <div key={phase.phaseId} className="rounded-lg border border-slate-700/50 bg-slate-900/30 p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-slate-300">{phase.phaseName}</span>
              <span className={`text-xs font-bold ${coverageTextColor(phase.overallCoverage)}`}>
                {(phase.overallCoverage * 100).toFixed(0)}%
              </span>
            </div>

            {/* Coverage bar */}
            <div className="h-2 bg-slate-800 rounded-full overflow-hidden mb-2">
              <div
                className={`h-full rounded-full transition-all duration-500 ${coverageColor(phase.overallCoverage)}`}
                style={{ width: `${phase.overallCoverage * 100}%` }}
              />
            </div>

            {/* Gaps */}
            {phase.gaps.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1.5">
                <span className="text-[9px] text-red-400 font-medium mr-1">GAPS:</span>
                {phase.gaps.map((g) => (
                  <span key={g} className="text-[9px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20">
                    {CONSTRUCT_SHORT_LABELS[g]}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

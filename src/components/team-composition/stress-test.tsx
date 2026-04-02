"use client";

import { useState } from "react";
import { Flame, Play, ShieldAlert, ShieldCheck, AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";
import type { Mission, IndividualProfile, StressTestResult } from "@/lib/team-composition/types";
import { CONSTRUCT_SHORT_LABELS, STRESS_SCENARIOS } from "@/lib/team-composition/types";
import { runStressTest } from "@/lib/team-composition/mission-engine";

interface StressTestProps {
  mission: Mission;
  team: IndividualProfile[];
}

const RISK_COLORS: Record<StressTestResult["riskLevel"], { bg: string; text: string; border: string }> = {
  low: { bg: "bg-emerald-500/10", text: "text-emerald-400", border: "border-emerald-500/20" },
  moderate: { bg: "bg-amber-500/10", text: "text-amber-400", border: "border-amber-500/20" },
  high: { bg: "bg-orange-500/10", text: "text-orange-400", border: "border-orange-500/20" },
  critical: { bg: "bg-red-500/10", text: "text-red-400", border: "border-red-500/20" },
};

const RISK_ICONS: Record<StressTestResult["riskLevel"], React.ReactNode> = {
  low: <ShieldCheck className="w-4 h-4 text-emerald-400" />,
  moderate: <AlertTriangle className="w-4 h-4 text-amber-400" />,
  high: <ShieldAlert className="w-4 h-4 text-orange-400" />,
  critical: <Flame className="w-4 h-4 text-red-400" />,
};

function StressResultCard({ result }: { result: StressTestResult }) {
  const [expanded, setExpanded] = useState(false);
  const risk = RISK_COLORS[result.riskLevel];

  return (
    <div className={`rounded-xl border ${risk.border} ${risk.bg} overflow-hidden`}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/[0.02] transition-colors"
      >
        {RISK_ICONS[result.riskLevel]}
        <div className="flex-1">
          <div className="text-sm font-medium text-slate-200">{result.scenario.label}</div>
          <div className="text-[10px] text-slate-500">{result.scenario.description}</div>
        </div>
        <div className="text-right shrink-0 mr-2">
          <div className={`text-xs font-bold ${risk.text} uppercase`}>{result.riskLevel}</div>
          <div className="text-[10px] text-slate-500">
            {result.delta >= 0 ? "No impact" : `${(result.delta * 100).toFixed(0)}% coverage`}
          </div>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
      </button>

      {expanded && (
        <div className="px-4 pb-4 border-t border-slate-700/30 pt-3 space-y-3">
          {/* Findings */}
          <div className="space-y-1">
            {result.findings.map((f, i) => (
              <p key={i} className="text-xs text-slate-300 leading-relaxed">
                {f}
              </p>
            ))}
          </div>

          {/* Phase impacts */}
          {result.phaseImpacts.length > 0 && (
            <div className="space-y-1.5">
              <div className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Phase Impact</div>
              {result.phaseImpacts.map((p) => (
                <div key={p.phaseId} className="flex items-center gap-2 text-xs">
                  <span className="text-slate-400 w-40 truncate">{p.phaseName}</span>
                  <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${p.stressedCoverage >= 0.8 ? "bg-emerald-500" : p.stressedCoverage >= 0.5 ? "bg-amber-500" : "bg-red-500"}`}
                      style={{ width: `${p.stressedCoverage * 100}%` }}
                    />
                  </div>
                  <span className="text-slate-500 w-8 text-right">{(p.stressedCoverage * 100).toFixed(0)}%</span>
                  {p.newGaps.length > 0 && (
                    <div className="flex gap-1 ml-1">
                      {p.newGaps.slice(0, 3).map((g) => (
                        <span key={g} className="text-[8px] px-1 py-0.5 rounded bg-red-500/10 text-red-400">
                          {CONSTRUCT_SHORT_LABELS[g]}
                        </span>
                      ))}
                      {p.newGaps.length > 3 && (
                        <span className="text-[8px] text-red-400">+{p.newGaps.length - 3}</span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function StressTest({ mission, team }: StressTestProps) {
  const [results, setResults] = useState<StressTestResult[]>([]);
  const [running, setRunning] = useState(false);

  const handleRun = () => {
    setRunning(true);
    // Simulate brief delay for effect
    setTimeout(() => {
      const res = STRESS_SCENARIOS.map((s) => runStressTest(s, mission, team));
      setResults(res);
      setRunning(false);
    }, 400);
  };

  const worstRisk = results.reduce<StressTestResult["riskLevel"]>((worst, r) => {
    const order: StressTestResult["riskLevel"][] = ["low", "moderate", "high", "critical"];
    return order.indexOf(r.riskLevel) > order.indexOf(worst) ? r.riskLevel : worst;
  }, "low");

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-medium text-slate-400 uppercase tracking-wider">
          Stress Testing
        </h3>
        <button
          onClick={handleRun}
          disabled={running || team.length === 0}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 disabled:opacity-40 text-red-400 text-xs font-medium transition-colors"
        >
          {running ? (
            <>
              <div className="w-3 h-3 border-2 border-red-400/30 border-t-red-400 rounded-full animate-spin" />
              Running...
            </>
          ) : (
            <>
              <Play className="w-3 h-3" />
              Run All Scenarios
            </>
          )}
        </button>
      </div>

      {team.length === 0 && (
        <p className="text-xs text-slate-500 py-4 text-center">Draft team members first to enable stress testing.</p>
      )}

      {results.length > 0 && (
        <>
          {/* Summary */}
          <div className={`rounded-lg border ${RISK_COLORS[worstRisk].border} ${RISK_COLORS[worstRisk].bg} px-4 py-2 flex items-center gap-2`}>
            {RISK_ICONS[worstRisk]}
            <span className={`text-xs font-medium ${RISK_COLORS[worstRisk].text}`}>
              Overall Risk: <span className="uppercase font-bold">{worstRisk}</span>
            </span>
          </div>

          {/* Individual results */}
          <div className="space-y-2">
            {results.map((r, i) => (
              <StressResultCard key={i} result={r} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

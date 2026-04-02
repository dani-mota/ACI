"use client";

import { CONSTRUCT_IDS, CONSTRUCT_SHORT_LABELS, CONSTRUCT_CATEGORIES, type Mission, type CognitiveDemand } from "@/lib/team-composition/types";

const DEMAND_COLORS: Record<CognitiveDemand, { bg: string; text: string; border: string }> = {
  critical: { bg: "bg-red-500/20", text: "text-red-400", border: "border-red-500/40" },
  high: { bg: "bg-amber-500/15", text: "text-amber-400", border: "border-amber-500/30" },
  moderate: { bg: "bg-blue-500/10", text: "text-blue-400", border: "border-blue-500/20" },
  low: { bg: "bg-slate-800/30", text: "text-slate-600", border: "border-transparent" },
};

const DEMAND_LABELS: Record<CognitiveDemand, string> = {
  critical: "CRIT",
  high: "HIGH",
  moderate: "MOD",
  low: "—",
};

interface MissionTimelineProps {
  mission: Mission;
}

export function MissionTimeline({ mission }: MissionTimelineProps) {
  // Group constructs by category for display
  const categories = [
    { label: "Behavioral", ids: CONSTRUCT_IDS.filter((c) => CONSTRUCT_CATEGORIES[c] === "behavioral") },
    { label: "Technical", ids: CONSTRUCT_IDS.filter((c) => CONSTRUCT_CATEGORIES[c] === "technical") },
    { label: "Cognitive", ids: CONSTRUCT_IDS.filter((c) => CONSTRUCT_CATEGORIES[c] === "cognitive") },
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-medium text-slate-400 uppercase tracking-wider">
          Cognitive Demand Timeline
        </h3>
        <div className="flex items-center gap-3">
          {(["critical", "high", "moderate"] as CognitiveDemand[]).map((d) => (
            <div key={d} className="flex items-center gap-1.5">
              <div className={`w-2.5 h-2.5 rounded-sm ${DEMAND_COLORS[d].bg} border ${DEMAND_COLORS[d].border}`} />
              <span className="text-[10px] text-slate-500 capitalize">{d}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-slate-700/50 bg-slate-900/30 overflow-hidden">
        {/* Phase headers */}
        <div className="grid border-b border-slate-700/50" style={{ gridTemplateColumns: `160px repeat(${mission.phases.length}, 1fr)` }}>
          <div className="px-3 py-2 text-[10px] font-medium text-slate-500 uppercase tracking-wider">
            Construct
          </div>
          {mission.phases.map((phase) => (
            <div key={phase.id} className="px-3 py-2 text-center border-l border-slate-700/30">
              <div className="text-[11px] font-medium text-slate-300 truncate">{phase.name}</div>
              <div className="text-[9px] text-slate-500">
                Mo {phase.startMonth}–{phase.endMonth}
              </div>
            </div>
          ))}
        </div>

        {/* Demand grid */}
        {categories.map((cat) => (
          <div key={cat.label}>
            {/* Category header */}
            <div
              className="grid border-t border-slate-700/30"
              style={{ gridTemplateColumns: `160px repeat(${mission.phases.length}, 1fr)` }}
            >
              <div className="px-3 py-1.5 text-[9px] font-bold text-slate-500 uppercase tracking-widest bg-slate-800/20">
                {cat.label}
              </div>
              {mission.phases.map((p) => (
                <div key={p.id} className="bg-slate-800/20 border-l border-slate-700/30" />
              ))}
            </div>

            {cat.ids.map((cid) => (
              <div
                key={cid}
                className="grid border-t border-slate-800/50 hover:bg-slate-800/20 transition-colors"
                style={{ gridTemplateColumns: `160px repeat(${mission.phases.length}, 1fr)` }}
              >
                <div className="px-3 py-1.5 text-[11px] text-slate-400 flex items-center">
                  {CONSTRUCT_SHORT_LABELS[cid]}
                </div>
                {mission.phases.map((phase) => {
                  const demand = phase.demands[cid];
                  const colors = DEMAND_COLORS[demand];
                  return (
                    <div key={phase.id} className="px-2 py-1.5 flex items-center justify-center border-l border-slate-800/30">
                      {demand !== "low" ? (
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded ${colors.bg} ${colors.text} border ${colors.border}`}>
                          {DEMAND_LABELS[demand]}
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-700">—</span>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

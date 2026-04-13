"use client";

import { Crosshair, ChevronDown, Clock, Layers, Zap } from "lucide-react";
import type { Mission } from "@/lib/team-composition/types";

interface MissionBriefingProps {
  missions: Mission[];
  selectedMission: Mission;
  onSelectMission: (id: string) => void;
  dropdownOpen: boolean;
  onToggleDropdown: () => void;
}

const STATUS_COLORS: Record<Mission["status"], { bg: string; text: string; label: string }> = {
  planning: { bg: "bg-amber-500/20", text: "text-amber-400", label: "PLANNING" },
  active: { bg: "bg-emerald-500/20", text: "text-emerald-400", label: "ACTIVE" },
  completed: { bg: "bg-slate-500/20", text: "text-muted-foreground", label: "COMPLETED" },
};

export function MissionBriefing({
  missions,
  selectedMission,
  onSelectMission,
  dropdownOpen,
  onToggleDropdown,
}: MissionBriefingProps) {
  const status = STATUS_COLORS[selectedMission.status];

  return (
    <div className="space-y-4">
      {/* Mission selector */}
      <div className="flex items-center justify-between">
        <div className="relative">
          <button
            onClick={onToggleDropdown}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border bg-card hover:bg-muted transition-all text-sm"
          >
            <Crosshair className="w-3.5 h-3.5 text-amber-400" />
            <span className="font-medium text-foreground">{selectedMission.name}</span>
            {selectedMission.codename && (
              <span className="text-[10px] font-mono text-muted-foreground">[{selectedMission.codename}]</span>
            )}
            <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
          </button>

          {dropdownOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={onToggleDropdown} />
              <div className="absolute left-0 top-full mt-1 w-80 z-50 rounded-lg border border-border bg-popover shadow-xl shadow-black/40 overflow-hidden">
                {missions.map((m) => {
                  const s = STATUS_COLORS[m.status];
                  return (
                    <button
                      key={m.id}
                      onClick={() => { onSelectMission(m.id); onToggleDropdown(); }}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-all hover:bg-muted ${
                        m.id === selectedMission.id ? "bg-amber-500/5 border-l-2 border-amber-500" : "border-l-2 border-transparent"
                      }`}
                    >
                      <Crosshair className="w-4 h-4 text-amber-400 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-foreground truncate">{m.name}</div>
                        <div className="text-[10px] text-muted-foreground truncate">
                          {m.totalMonths}mo &middot; {m.phases.length} phases
                        </div>
                      </div>
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${s.bg} ${s.text}`}>
                        {s.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>

        <span className={`text-[10px] font-bold px-2 py-1 rounded ${status.bg} ${status.text}`}>
          {status.label}
        </span>
      </div>

      {/* Mission brief card */}
      <div className="rounded-xl border border-border bg-card p-5">
        <p className="text-sm text-foreground leading-relaxed mb-4">
          {selectedMission.description}
        </p>
        <div className="flex items-center gap-6 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            <span>{selectedMission.totalMonths} months</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5" />
            <span>{selectedMission.phases.length} phases</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5" />
            <span>
              {selectedMission.phases.reduce((s, p) => {
                const critCount = Object.values(p.demands).filter((d) => d === "critical").length;
                return s + critCount;
              }, 0)} critical demands
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState, useMemo, useCallback } from "react";
import { Target, Users, Flame, Map } from "lucide-react";
import type { Mission, IndividualProfile } from "@/lib/team-composition/types";
import { computeMissionCoverage, rankTalentForMission } from "@/lib/team-composition/mission-engine";
import { MissionBriefing } from "./mission-briefing";
import { MissionTimeline } from "./mission-timeline";
import { CoverageMap } from "./coverage-map";
import { TalentDraft } from "./talent-draft";
import { StressTest } from "./stress-test";

type MissionTab = "briefing" | "draft" | "stress";

const TAB_CONFIG: { id: MissionTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "briefing", label: "Mission Intel", icon: Target },
  { id: "draft", label: "Team Assembly", icon: Users },
  { id: "stress", label: "Stress Test", icon: Flame },
];

interface MissionDashboardProps {
  missions: Mission[];
  /** All available profiles (both internal members and candidates) */
  talentPool: IndividualProfile[];
}

export function MissionDashboard({ missions, talentPool }: MissionDashboardProps) {
  const [selectedMissionId, setSelectedMissionId] = useState(missions[0]?.id ?? "");
  const [missionDropdownOpen, setMissionDropdownOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<MissionTab>("briefing");
  const [assembledIds, setAssembledIds] = useState<string[]>([]);

  const selectedMission = useMemo(
    () => missions.find((m) => m.id === selectedMissionId) ?? missions[0],
    [missions, selectedMissionId]
  );

  const assembledTeam = useMemo(
    () => assembledIds.map((id) => talentPool.find((p) => p.id === id)!).filter(Boolean),
    [assembledIds, talentPool]
  );

  const availablePool = useMemo(
    () => talentPool.filter((p) => !assembledIds.includes(p.id)),
    [talentPool, assembledIds]
  );

  const coverage = useMemo(
    () => computeMissionCoverage(selectedMission, assembledTeam),
    [selectedMission, assembledTeam]
  );

  const recommendations = useMemo(
    () => rankTalentForMission(selectedMission, assembledTeam, availablePool),
    [selectedMission, assembledTeam, availablePool]
  );

  const handleSelectMission = useCallback((id: string) => {
    setSelectedMissionId(id);
    setAssembledIds([]);
  }, []);

  const handleAddMember = useCallback((id: string) => {
    setAssembledIds((prev) => [...prev, id]);
  }, []);

  const handleRemoveMember = useCallback((id: string) => {
    setAssembledIds((prev) => prev.filter((x) => x !== id));
  }, []);

  if (!selectedMission) {
    return <p className="text-sm text-slate-500 py-8 text-center">No missions available.</p>;
  }

  return (
    <div className="space-y-6">
      {/* Mission briefing header — always visible */}
      <MissionBriefing
        missions={missions}
        selectedMission={selectedMission}
        onSelectMission={handleSelectMission}
        dropdownOpen={missionDropdownOpen}
        onToggleDropdown={() => setMissionDropdownOpen(!missionDropdownOpen)}
      />

      {/* Sub-tabs */}
      <div className="flex items-center gap-1 border-b border-slate-700/50 pb-px">
        {TAB_CONFIG.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium transition-all border-b-2 -mb-px ${
                isActive
                  ? "text-amber-400 border-amber-500"
                  : "text-slate-400 border-transparent hover:text-slate-300 hover:border-slate-600"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
              {tab.id === "draft" && assembledTeam.length > 0 && (
                <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold ${
                  isActive ? "bg-amber-500/20 text-amber-400" : "bg-slate-700/50 text-slate-500"
                }`}>
                  {assembledTeam.length}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      {activeTab === "briefing" && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-2">
            <MissionTimeline mission={selectedMission} />
          </div>
          <div>
            <CoverageMap coverage={coverage} />
          </div>
        </div>
      )}

      {activeTab === "draft" && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-2">
            <TalentDraft
              mission={selectedMission}
              assembledTeam={assembledTeam}
              talentPool={availablePool}
              recommendations={recommendations}
              onAddMember={handleAddMember}
              onRemoveMember={handleRemoveMember}
            />
          </div>
          <div>
            <CoverageMap coverage={coverage} />
          </div>
        </div>
      )}

      {activeTab === "stress" && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-2">
            <StressTest mission={selectedMission} team={assembledTeam} />
          </div>
          <div>
            <CoverageMap coverage={coverage} />
          </div>
        </div>
      )}
    </div>
  );
}

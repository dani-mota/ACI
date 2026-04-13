"use client";

import { useState, useMemo } from "react";
import { Users, UserCheck, Lightbulb, ChevronDown, Crosshair } from "lucide-react";
import { TeamDashboard } from "@/components/team-composition/team-dashboard";
import { CandidateEvaluation } from "@/components/team-composition/candidate-evaluation";
import { DevelopmentPlan } from "@/components/team-composition/development-plan";
import { MissionDashboard } from "@/components/team-composition/mission-dashboard";
import {
  MOCK_TEAMS,
  MOCK_PROFILES,
  getTeamMembers,
  getTeamCandidates,
} from "@/lib/team-composition/mock-data";
import { getMockMissions } from "@/lib/team-composition/mission-data";
import { MISSION_TYPE_LABELS } from "@/lib/team-composition/types";

type ViewTab = "dashboard" | "candidates" | "development" | "mission";

const TAB_CONFIG: { id: ViewTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "dashboard", label: "Team Dashboard", icon: Users },
  { id: "candidates", label: "Candidate Evaluation", icon: UserCheck },
  { id: "development", label: "Development Plan", icon: Lightbulb },
  { id: "mission", label: "Mission Planner", icon: Crosshair },
];

export function TeamCompositionClient() {
  const [selectedTeamId, setSelectedTeamId] = useState(MOCK_TEAMS[0].id);
  const [activeTab, setActiveTab] = useState<ViewTab>("dashboard");
  const [teamDropdownOpen, setTeamDropdownOpen] = useState(false);

  const selectedTeam = useMemo(
    () => MOCK_TEAMS.find((t) => t.id === selectedTeamId)!,
    [selectedTeamId]
  );
  const members = useMemo(() => getTeamMembers(selectedTeam), [selectedTeam]);
  const candidates = useMemo(() => getTeamCandidates(selectedTeam), [selectedTeam]);
  const missions = useMemo(() => getMockMissions(), []);
  const allProfiles = useMemo(() => Object.values(MOCK_PROFILES), []);

  return (
    <div className="px-6 py-6">
      {/* Page header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
          <span>Arklight Cognitive Index</span>
          <span>/</span>
          <span className="text-muted-foreground/70">Team Composition Analysis</span>
        </div>
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-foreground">
            Team Composition Analysis
          </h1>

          {/* Team selector */}
          <div className="relative">
            <button
              onClick={() => setTeamDropdownOpen(!teamDropdownOpen)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border bg-card hover:bg-muted transition-all text-sm"
            >
              <div className="w-2 h-2 rounded-full bg-blue-500" />
              <span className="font-medium text-foreground">Team {selectedTeam.name}</span>
              <span className="text-[10px] text-muted-foreground">
                {MISSION_TYPE_LABELS[selectedTeam.missionType]}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
            </button>

            {teamDropdownOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setTeamDropdownOpen(false)}
                />
                <div className="absolute right-0 top-full mt-1 w-72 z-50 rounded-lg border border-border bg-popover shadow-xl shadow-black/20 overflow-hidden">
                  {MOCK_TEAMS.map((team) => {
                    const teamMembers = getTeamMembers(team);
                    return (
                      <button
                        key={team.id}
                        onClick={() => {
                          setSelectedTeamId(team.id);
                          setTeamDropdownOpen(false);
                        }}
                        className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-all hover:bg-muted ${
                          team.id === selectedTeamId ? "bg-blue-500/10 border-l-2 border-blue-500" : "border-l-2 border-transparent"
                        }`}
                      >
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500/20 to-cyan-500/10 flex items-center justify-center text-xs font-bold text-blue-400">
                          {team.name[0]}
                        </div>
                        <div className="flex-1">
                          <div className="text-sm font-medium text-foreground">Team {team.name}</div>
                          <div className="text-[10px] text-muted-foreground">
                            {MISSION_TYPE_LABELS[team.missionType]} &middot; {teamMembers.length} members
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Tab navigation */}
      <div className="flex items-center gap-1 mb-6 border-b border-border pb-px">
        {TAB_CONFIG.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium transition-all border-b-2 -mb-px ${
                isActive
                  ? "text-blue-500 dark:text-blue-400 border-blue-500"
                  : "text-muted-foreground border-transparent hover:text-foreground hover:border-border"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
              {tab.id === "candidates" && (
                <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold ${
                  isActive ? "bg-blue-500/20 text-blue-500 dark:text-blue-400" : "bg-muted text-muted-foreground"
                }`}>
                  {candidates.length}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div>
        {activeTab === "dashboard" && (
          <TeamDashboard team={selectedTeam} members={members} />
        )}
        {activeTab === "candidates" && (
          <CandidateEvaluation
            team={selectedTeam}
            members={members}
            candidates={candidates}
          />
        )}
        {activeTab === "development" && (
          <DevelopmentPlan team={selectedTeam} members={members} />
        )}
        {activeTab === "mission" && (
          <MissionDashboard missions={missions} talentPool={allProfiles} />
        )}
      </div>
    </div>
  );
}

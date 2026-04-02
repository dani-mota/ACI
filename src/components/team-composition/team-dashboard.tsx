"use client";

import { useMemo } from "react";
import { BarChart3, Users, Target, ShieldAlert } from "lucide-react";
import { TeamRadarChart } from "./radar-chart";
import { TeamHeatmap } from "./heatmap";
import { CDIGauge } from "./cdi-gauge";
import { SpofAlerts } from "./spof-alerts";
import {
  CONSTRUCT_IDS,
  CONSTRUCT_LABELS,
  MISSION_TYPE_LABELS,
  type Team,
  type IndividualProfile,
  type TeamAggregateMetrics,
  type ConstructVector,
} from "@/lib/team-composition/types";
import { computeTeamMetrics, getIdealProfile } from "@/lib/team-composition/engine";

interface TeamDashboardProps {
  team: Team;
  members: IndividualProfile[];
}

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  color,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}) {
  return (
    <div className="rounded-lg border border-slate-700/50 bg-slate-800/30 p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`w-4 h-4 ${color}`} />
        <span className="text-xs text-slate-400 font-medium">{label}</span>
      </div>
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
      {sub && <div className="text-[10px] text-slate-500 mt-0.5">{sub}</div>}
    </div>
  );
}

function GapBarChart({ metrics, ideal }: { metrics: TeamAggregateMetrics; ideal: ConstructVector }) {
  const sorted = [...CONSTRUCT_IDS].sort(
    (a, b) => Math.abs(metrics.perConstruct[b].gapFromIdeal) - Math.abs(metrics.perConstruct[a].gapFromIdeal)
  );

  return (
    <div className="space-y-1.5">
      {sorted.map((cid) => {
        const gap = metrics.perConstruct[cid].gapFromIdeal;
        const teamMean = Math.round(metrics.perConstruct[cid].mean);
        const idealVal = Math.round(ideal[cid]);
        const absGap = Math.abs(gap);
        const isDeficit = gap > 0;

        return (
          <div key={cid} className="flex items-center gap-2 text-xs group">
            <div className="w-[100px] text-slate-400 truncate text-right text-[11px]">
              {CONSTRUCT_LABELS[cid].split(" ").slice(0, 2).join(" ")}
            </div>
            <div className="flex-1 h-5 bg-slate-800/50 rounded-sm relative overflow-hidden">
              {/* Team mean marker */}
              <div
                className="absolute top-0 bottom-0 bg-blue-500/30 rounded-sm"
                style={{ width: `${teamMean}%` }}
              />
              {/* Ideal line */}
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-cyan-400/60 z-10"
                style={{ left: `${idealVal}%` }}
              />
              {/* Gap indicator */}
              {absGap > 3 && (
                <div
                  className={`absolute top-0 bottom-0 ${
                    isDeficit ? "bg-amber-500/25" : "bg-emerald-500/20"
                  }`}
                  style={{
                    left: `${isDeficit ? teamMean : idealVal}%`,
                    width: `${absGap}%`,
                  }}
                />
              )}
              {/* Value label */}
              <div className="absolute inset-0 flex items-center justify-between px-2">
                <span className="font-mono text-[10px] text-slate-300 z-20">{teamMean}</span>
                <span className={`font-mono text-[10px] z-20 ${
                  absGap > 10 ? "text-amber-400" : absGap > 5 ? "text-slate-300" : "text-emerald-400"
                }`}>
                  {isDeficit ? `-${Math.round(gap)}` : `+${Math.round(Math.abs(gap))}`}
                </span>
              </div>
            </div>
          </div>
        );
      })}
      <div className="flex items-center gap-4 mt-2 ml-[108px] text-[10px] text-slate-500">
        <div className="flex items-center gap-1">
          <div className="w-3 h-2 bg-blue-500/30 rounded-sm" /> Team Mean
        </div>
        <div className="flex items-center gap-1">
          <div className="w-0.5 h-3 bg-cyan-400/60" /> Ideal
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-2 bg-amber-500/25 rounded-sm" /> Gap
        </div>
      </div>
    </div>
  );
}

export function TeamDashboard({ team, members }: TeamDashboardProps) {
  const metrics = useMemo(() => computeTeamMetrics(team, members), [team, members]);
  const ideal = useMemo(() => getIdealProfile(team), [team]);

  const teamMeans: ConstructVector = useMemo(() => {
    const v = {} as ConstructVector;
    for (const cid of CONSTRUCT_IDS) {
      v[cid] = metrics.perConstruct[cid].mean;
    }
    return v;
  }, [metrics]);

  const spofMap = useMemo(() => {
    const map: Record<string, boolean> = {};
    for (const cid of CONSTRUCT_IDS) {
      map[cid] = metrics.perConstruct[cid].singlePointOfFailure;
    }
    return map;
  }, [metrics]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-slate-100">Team {team.name}</h2>
            <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-blue-500/15 text-blue-400 border border-blue-500/20">
              {MISSION_TYPE_LABELS[team.missionType]}
            </span>
          </div>
          <p className="text-sm text-slate-400 mt-0.5">
            {team.department} &middot; {members.length} members
          </p>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-4 gap-3">
        <StatCard
          label="Team Size"
          value={members.length}
          sub="Active members"
          icon={Users}
          color="text-blue-400"
        />
        <StatCard
          label="Overall Gap"
          value={Math.round(metrics.overallGapScore)}
          sub="Avg distance from ideal"
          icon={Target}
          color={metrics.overallGapScore > 15 ? "text-amber-400" : "text-emerald-400"}
        />
        <StatCard
          label="SPOFs"
          value={metrics.spofCount}
          sub="Single points of failure"
          icon={ShieldAlert}
          color={metrics.spofCount > 2 ? "text-red-400" : metrics.spofCount > 0 ? "text-amber-400" : "text-emerald-400"}
        />
        <StatCard
          label="CDI"
          value={`${Math.round(metrics.cognitiveDiversityIndex * 100)}%`}
          sub={`${metrics.cdiInterpretation} diversity`}
          icon={BarChart3}
          color={metrics.cdiInterpretation === "moderate" ? "text-emerald-400" : "text-amber-400"}
        />
      </div>

      {/* Radar + CDI row */}
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-lg border border-slate-700/50 bg-slate-800/20 p-4">
          <h3 className="text-sm font-semibold text-slate-200 mb-2">Team Profile vs Ideal</h3>
          <TeamRadarChart
            series={[
              { label: "Team Average", data: teamMeans, color: "#2563EB", opacity: 0.2 },
              { label: "Mission Ideal", data: ideal, color: "#06B6D4", opacity: 0.05, strokeDash: "6 3" },
            ]}
            height={340}
          />
        </div>

        <div className="space-y-4">
          <CDIGauge value={metrics.cognitiveDiversityIndex} interpretation={metrics.cdiInterpretation} />
          <div className="rounded-lg border border-slate-700/50 bg-slate-800/20 p-4">
            <h3 className="text-sm font-semibold text-slate-200 mb-3">Gap Analysis</h3>
            <GapBarChart metrics={metrics} ideal={ideal} />
          </div>
        </div>
      </div>

      {/* SPOF Alerts */}
      <div>
        <h3 className="text-sm font-semibold text-slate-200 mb-2">Single Points of Failure</h3>
        <SpofAlerts metrics={metrics} members={members} />
      </div>

      {/* Heatmap */}
      <div className="rounded-lg border border-slate-700/50 bg-slate-800/20 p-4">
        <h3 className="text-sm font-semibold text-slate-200 mb-3">Member Cognitive Profiles</h3>
        <TeamHeatmap members={members} highlightSpof={spofMap} />
      </div>
    </div>
  );
}

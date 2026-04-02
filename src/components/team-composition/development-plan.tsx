"use client";

import { useMemo } from "react";
import { Lightbulb, ArrowUp, Target, Zap } from "lucide-react";
import {
  CONSTRUCT_IDS,
  CONSTRUCT_LABELS,
  CONSTRUCT_SHORT_LABELS,
  type Team,
  type IndividualProfile,
  type ConstructId,
} from "@/lib/team-composition/types";
import {
  computeTeamMetrics,
  computeTeamDevelopmentPlan,
  getIdealProfile,
} from "@/lib/team-composition/engine";

interface DevelopmentPlanProps {
  team: Team;
  members: IndividualProfile[];
}

function PotentialBar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  let color = "bg-slate-500/40";
  let textColor = "text-slate-400";
  if (value > 0.7) { color = "bg-emerald-500/40"; textColor = "text-emerald-400"; }
  else if (value > 0.5) { color = "bg-blue-500/40"; textColor = "text-blue-400"; }
  else if (value > 0.35) { color = "bg-amber-500/40"; textColor = "text-amber-400"; }

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-slate-800/50 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`text-[10px] font-mono font-semibold ${textColor} w-[32px] text-right`}>
        {pct}%
      </span>
    </div>
  );
}

function GapConstructCard({
  construct,
  gap,
  ideal,
  teamMean,
  topRecommendations,
  members,
}: {
  construct: ConstructId;
  gap: number;
  ideal: number;
  teamMean: number;
  topRecommendations: Array<{
    memberId: string;
    currentScore: number;
    developmentPotential: number;
    recommendation: string;
    priorityRank: number;
  }>;
  members: IndividualProfile[];
}) {
  const memberMap = Object.fromEntries(members.map((m) => [m.id, m]));
  // Show top 3 highest potential members
  const top3 = topRecommendations.slice(0, 3);

  return (
    <div className="rounded-lg border border-slate-700/50 bg-slate-800/20 p-4">
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-semibold text-slate-200">{CONSTRUCT_LABELS[construct]}</h4>
            <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
              gap > 15 ? "bg-red-500/20 text-red-400 border border-red-500/20"
              : gap > 10 ? "bg-amber-500/20 text-amber-400 border border-amber-500/20"
              : "bg-blue-500/20 text-blue-400 border border-blue-500/20"
            }`}>
              {gap > 15 ? "Critical Gap" : gap > 10 ? "Significant Gap" : "Moderate Gap"}
            </span>
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-3">
            <span>Team avg: <span className="font-mono text-slate-400">{Math.round(teamMean)}</span></span>
            <span>Ideal: <span className="font-mono text-cyan-400/80">{Math.round(ideal)}</span></span>
            <span>Gap: <span className="font-mono text-amber-400">{Math.round(gap)}</span></span>
          </div>
        </div>
        <Target className="w-4 h-4 text-slate-600" />
      </div>

      <div className="space-y-3">
        {top3.map((rec) => {
          const member = memberMap[rec.memberId];
          if (!member) return null;

          return (
            <div key={rec.memberId} className="rounded border border-slate-700/30 bg-slate-900/30 p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full bg-gradient-to-br from-blue-500/30 to-cyan-500/20 flex items-center justify-center text-[8px] font-bold text-blue-300">
                    {rec.priorityRank}
                  </div>
                  <span className="text-xs font-medium text-slate-300">{member.name}</span>
                  <span className="text-[10px] text-slate-500">{member.role}</span>
                </div>
                <div className="flex items-center gap-1 text-[10px]">
                  <span className="text-slate-500">Current:</span>
                  <span className="font-mono font-semibold text-slate-300">{rec.currentScore}</span>
                </div>
              </div>

              <div className="mb-2">
                <div className="text-[10px] text-slate-500 mb-1">Development Potential</div>
                <PotentialBar value={rec.developmentPotential} />
              </div>

              <p className="text-[11px] text-slate-400 leading-relaxed">
                {rec.recommendation}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function DevelopmentPlan({ team, members }: DevelopmentPlanProps) {
  const metrics = useMemo(() => computeTeamMetrics(team, members), [team, members]);
  const ideal = useMemo(() => getIdealProfile(team), [team]);
  const plan = useMemo(
    () => computeTeamDevelopmentPlan(team, members, metrics),
    [team, members, metrics]
  );

  // Summary stats
  const criticalGaps = plan.gapConstructs.filter(
    (c) => metrics.perConstruct[c].gapFromIdeal > 15
  );
  const moderateGaps = plan.gapConstructs.filter(
    (c) => metrics.perConstruct[c].gapFromIdeal > 5 && metrics.perConstruct[c].gapFromIdeal <= 15
  );

  // Find members with highest average development potential
  const memberPotentials = members.map((m) => {
    const avgPotential = plan.recommendations
      .filter((r) => r.memberId === m.id)
      .reduce((sum, r) => sum + r.developmentPotential, 0) /
      Math.max(plan.gapConstructs.length, 1);
    return { member: m, avgPotential };
  }).sort((a, b) => b.avgPotential - a.avgPotential);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-lg font-bold text-slate-100">
          Development Recommendations — Team {team.name}
        </h3>
        <p className="text-xs text-slate-400 mt-0.5">
          Targeted development priorities based on team gaps and individual growth potential
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-4">
          <div className="flex items-center gap-2 mb-1">
            <Zap className="w-4 h-4 text-red-400" />
            <span className="text-xs text-red-400 font-medium">Critical Gaps</span>
          </div>
          <div className="text-2xl font-bold text-red-400">{criticalGaps.length}</div>
          <div className="text-[10px] text-slate-500 mt-0.5">
            {criticalGaps.map((c) => CONSTRUCT_SHORT_LABELS[c]).join(", ") || "None"}
          </div>
        </div>

        <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-4">
          <div className="flex items-center gap-2 mb-1">
            <ArrowUp className="w-4 h-4 text-amber-400" />
            <span className="text-xs text-amber-400 font-medium">Moderate Gaps</span>
          </div>
          <div className="text-2xl font-bold text-amber-400">{moderateGaps.length}</div>
          <div className="text-[10px] text-slate-500 mt-0.5">
            {moderateGaps.map((c) => CONSTRUCT_SHORT_LABELS[c]).join(", ") || "None"}
          </div>
        </div>

        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-4">
          <div className="flex items-center gap-2 mb-1">
            <Lightbulb className="w-4 h-4 text-emerald-400" />
            <span className="text-xs text-emerald-400 font-medium">Highest Potential</span>
          </div>
          <div className="text-lg font-bold text-emerald-400">
            {memberPotentials[0]?.member.name.split(" ")[0] ?? "—"}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">
            Avg development potential: {Math.round((memberPotentials[0]?.avgPotential ?? 0) * 100)}%
          </div>
        </div>
      </div>

      {/* Per-gap-construct cards */}
      <div>
        <h4 className="text-sm font-semibold text-slate-200 mb-3">Priority Development Areas</h4>
        <div className="grid grid-cols-2 gap-4">
          {plan.gapConstructs.map((construct) => {
            const recsForConstruct = plan.recommendations.filter(
              (r) => r.construct === construct
            );
            return (
              <GapConstructCard
                key={construct}
                construct={construct}
                gap={metrics.perConstruct[construct].gapFromIdeal}
                ideal={ideal[construct]}
                teamMean={metrics.perConstruct[construct].mean}
                topRecommendations={recsForConstruct}
                members={members}
              />
            );
          })}
        </div>
      </div>

      {/* Member potential ranking */}
      <div className="rounded-lg border border-slate-700/50 bg-slate-800/20 p-4">
        <h4 className="text-sm font-semibold text-slate-200 mb-3">Team Member Development Potential</h4>
        <div className="space-y-2">
          {memberPotentials.map(({ member, avgPotential }, idx) => (
            <div key={member.id} className="flex items-center gap-3 py-1.5">
              <span className="text-[10px] text-slate-500 w-4 text-right">{idx + 1}</span>
              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500/30 to-cyan-500/20 flex items-center justify-center text-[9px] font-bold text-blue-300 shrink-0">
                {member.name.split(" ").map((n) => n[0]).join("")}
              </div>
              <div className="min-w-[120px]">
                <div className="text-xs text-slate-300 font-medium">{member.name}</div>
                <div className="text-[10px] text-slate-500">{member.role}</div>
              </div>
              <div className="flex-1">
                <PotentialBar value={avgPotential} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

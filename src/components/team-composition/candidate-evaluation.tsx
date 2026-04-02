"use client";

import { useMemo, useState } from "react";
import { ArrowUpDown, TrendingUp, TrendingDown, Minus, ChevronDown, ChevronRight } from "lucide-react";
import { TeamRadarChart } from "./radar-chart";
import {
  CONSTRUCT_IDS,
  CONSTRUCT_LABELS,
  CONSTRUCT_SHORT_LABELS,
  type Team,
  type IndividualProfile,
  type CandidateTeamFit,
  type ConstructId,
  type ConstructVector,
} from "@/lib/team-composition/types";
import { rankCandidates, getIdealProfile, computeTeamMetrics } from "@/lib/team-composition/engine";

interface CandidateEvaluationProps {
  team: Team;
  members: IndividualProfile[];
  candidates: IndividualProfile[];
}

function ImpactBadge({ score }: { score: number }) {
  if (score > 15) return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/20">High Impact</span>;
  if (score > 5) return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/20 text-blue-400 border border-blue-500/20">Moderate</span>;
  if (score > 0) return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-500/20 text-slate-400 border border-slate-500/20">Low Impact</span>;
  return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-500/20 text-red-400 border border-red-500/20">Negative</span>;
}

function DeltaBar({ construct, delta }: { construct: ConstructId; delta: number }) {
  const maxDelta = 15;
  const width = Math.min(Math.abs(delta) / maxDelta * 100, 100);
  const isPositive = delta > 0;

  return (
    <div className="flex items-center gap-1.5 text-[10px]">
      <span className="w-[70px] text-right text-slate-500 truncate">
        {CONSTRUCT_SHORT_LABELS[construct]}
      </span>
      <div className="flex-1 h-3 bg-slate-800/50 rounded-sm relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full h-full relative">
            {/* Center line */}
            <div className="absolute left-1/2 top-0 bottom-0 w-px bg-slate-600/50" />
            {/* Delta bar */}
            <div
              className={`absolute top-0 bottom-0 rounded-sm ${
                isPositive ? "bg-emerald-500/40" : "bg-red-500/30"
              }`}
              style={{
                left: isPositive ? "50%" : `${50 - width / 2}%`,
                width: `${width / 2}%`,
              }}
            />
          </div>
        </div>
      </div>
      <span className={`w-[32px] text-right font-mono ${
        delta > 2 ? "text-emerald-400" : delta < -1 ? "text-red-400" : "text-slate-500"
      }`}>
        {delta > 0 ? "+" : ""}{delta.toFixed(1)}
      </span>
    </div>
  );
}

function CandidateCard({
  candidate,
  fit,
  teamMeans,
  ideal,
  rank,
  expanded,
  onToggle,
}: {
  candidate: IndividualProfile;
  fit: CandidateTeamFit;
  teamMeans: ConstructVector;
  ideal: ConstructVector;
  rank: number;
  expanded: boolean;
  onToggle: () => void;
}) {
  const sortedDeltas = [...CONSTRUCT_IDS].sort(
    (a, b) => fit.gapDelta[b] - fit.gapDelta[a]
  );

  return (
    <div className={`rounded-lg border transition-all ${
      expanded ? "border-blue-500/30 bg-slate-800/30" : "border-slate-700/40 bg-slate-800/15 hover:border-slate-600/50"
    }`}>
      {/* Summary row */}
      <button
        className="w-full flex items-center gap-4 p-4 text-left cursor-pointer"
        onClick={onToggle}
      >
        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500/30 to-cyan-500/20 flex items-center justify-center text-xs font-bold text-blue-300 shrink-0">
          {rank}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-slate-200">{candidate.name}</span>
            <ImpactBadge score={fit.teamImpactScore} />
          </div>
          <div className="text-[11px] text-slate-500">{candidate.role}</div>
        </div>

        <div className="flex items-center gap-6 text-xs shrink-0">
          <div className="text-center">
            <div className="text-[10px] text-slate-500 mb-0.5">Impact</div>
            <div className={`font-mono font-bold ${
              fit.teamImpactScore > 10 ? "text-emerald-400" : fit.teamImpactScore > 0 ? "text-blue-400" : "text-red-400"
            }`}>
              {fit.teamImpactScore > 0 ? "+" : ""}{fit.teamImpactScore.toFixed(1)}
            </div>
          </div>
          <div className="text-center">
            <div className="text-[10px] text-slate-500 mb-0.5">Fit Delta</div>
            <div className="font-mono font-bold text-slate-300">
              {fit.teamFitDelta > 0 ? "+" : ""}{fit.teamFitDelta.toFixed(1)}
            </div>
          </div>
          <div className="text-center">
            <div className="text-[10px] text-slate-500 mb-0.5">Redundancy</div>
            <div className={`font-mono font-bold ${
              fit.redundancyScore > 0.15 ? "text-amber-400" : "text-slate-400"
            }`}>
              {(fit.redundancyScore * 100).toFixed(0)}%
            </div>
          </div>
          <div className="text-center">
            <div className="text-[10px] text-slate-500 mb-0.5">Merit</div>
            <div className="font-mono font-bold text-slate-300">{fit.individualMerit.toFixed(0)}</div>
          </div>
          {expanded ? <ChevronDown className="w-4 h-4 text-slate-500" /> : <ChevronRight className="w-4 h-4 text-slate-500" />}
        </div>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="px-4 pb-4 pt-0 border-t border-slate-700/30">
          <div className="grid grid-cols-2 gap-4 mt-4">
            {/* Radar */}
            <div>
              <h4 className="text-xs font-medium text-slate-400 mb-1">Profile Comparison</h4>
              <TeamRadarChart
                series={[
                  { label: "Candidate", data: candidate.scores, color: "#22D3EE", opacity: 0.2 },
                  { label: "Team Avg", data: teamMeans, color: "#2563EB", opacity: 0.1 },
                  { label: "Ideal", data: ideal, color: "#06B6D4", opacity: 0, strokeDash: "4 3" },
                ]}
                height={280}
              />
            </div>

            {/* Gap delta bars */}
            <div>
              <h4 className="text-xs font-medium text-slate-400 mb-2">Team Fit Delta by Construct</h4>
              <div className="space-y-1">
                {sortedDeltas.map((cid) => (
                  <DeltaBar key={cid} construct={cid} delta={fit.gapDelta[cid]} />
                ))}
              </div>

              {/* Gap fills */}
              {fit.primaryGapsFilled.length > 0 && (
                <div className="mt-3 pt-3 border-t border-slate-700/30">
                  <div className="text-[10px] text-slate-500 mb-1 flex items-center gap-1">
                    <TrendingUp className="w-3 h-3 text-emerald-500" /> Fills Gaps
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {fit.primaryGapsFilled.map((c) => (
                      <span key={c} className="px-1.5 py-0.5 rounded text-[9px] bg-emerald-500/15 text-emerald-400 border border-emerald-500/15">
                        {CONSTRUCT_SHORT_LABELS[c]}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {fit.redundantConstructs.length > 0 && (
                <div className="mt-2">
                  <div className="text-[10px] text-slate-500 mb-1 flex items-center gap-1">
                    <TrendingDown className="w-3 h-3 text-amber-500" /> Redundant On
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {fit.redundantConstructs.map((c) => (
                      <span key={c} className="px-1.5 py-0.5 rounded text-[9px] bg-amber-500/10 text-amber-400 border border-amber-500/15">
                        {CONSTRUCT_SHORT_LABELS[c]}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function CandidateEvaluation({ team, members, candidates }: CandidateEvaluationProps) {
  const [sortBy, setSortBy] = useState<"impact" | "merit">("impact");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const ideal = useMemo(() => getIdealProfile(team), [team]);
  const metrics = useMemo(() => computeTeamMetrics(team, members), [team, members]);

  const teamMeans: ConstructVector = useMemo(() => {
    const v = {} as ConstructVector;
    for (const cid of CONSTRUCT_IDS) {
      v[cid] = metrics.perConstruct[cid].mean;
    }
    return v;
  }, [metrics]);

  const ranked = useMemo(() => rankCandidates(candidates, team, members), [candidates, team, members]);

  const sortedRanked = useMemo(() => {
    if (sortBy === "merit") {
      return [...ranked].sort((a, b) => b.individualMerit - a.individualMerit);
    }
    return ranked; // already sorted by teamImpactScore
  }, [ranked, sortBy]);

  const candidateMap = useMemo(
    () => Object.fromEntries(candidates.map((c) => [c.id, c])),
    [candidates]
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-slate-100">
            Candidate Evaluation — Team {team.name}
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            {candidates.length} candidates ranked by {sortBy === "impact" ? "Team Impact Score" : "Individual Merit"}
          </p>
        </div>

        <div className="flex items-center gap-1 bg-slate-800/50 rounded-md border border-slate-700/50 p-0.5">
          <button
            onClick={() => setSortBy("impact")}
            className={`px-3 py-1.5 rounded text-xs font-medium transition-all ${
              sortBy === "impact"
                ? "bg-blue-500/20 text-blue-400 border border-blue-500/25"
                : "text-slate-400 hover:text-slate-300 border border-transparent"
            }`}
          >
            Team-Adjusted
          </button>
          <button
            onClick={() => setSortBy("merit")}
            className={`px-3 py-1.5 rounded text-xs font-medium transition-all ${
              sortBy === "merit"
                ? "bg-blue-500/20 text-blue-400 border border-blue-500/25"
                : "text-slate-400 hover:text-slate-300 border border-transparent"
            }`}
          >
            Individual Merit
          </button>
        </div>
      </div>

      {/* Ranking shift indicator */}
      {sortBy === "impact" && (
        <div className="rounded-lg border border-blue-500/15 bg-blue-500/5 p-3">
          <p className="text-xs text-blue-300/80">
            <span className="font-semibold text-blue-300">Team-adjusted ranking active.</span>{" "}
            Candidates are ranked by how much they improve this team&apos;s cognitive gaps, penalized for redundancy with existing strengths.
            Switch to &ldquo;Individual Merit&rdquo; to see raw score ranking.
          </p>
        </div>
      )}

      {/* Candidate list */}
      <div className="space-y-2">
        {sortedRanked.map((fit, idx) => {
          const candidate = candidateMap[fit.candidateId];
          if (!candidate) return null;
          return (
            <CandidateCard
              key={fit.candidateId}
              candidate={candidate}
              fit={fit}
              teamMeans={teamMeans}
              ideal={ideal}
              rank={idx + 1}
              expanded={expandedId === fit.candidateId}
              onToggle={() => setExpandedId(expandedId === fit.candidateId ? null : fit.candidateId)}
            />
          );
        })}
      </div>
    </div>
  );
}

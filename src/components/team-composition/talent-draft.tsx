"use client";

import { useState } from "react";
import { UserPlus, UserMinus, ChevronDown, ChevronUp, Zap, AlertTriangle, Check } from "lucide-react";
import type { IndividualProfile, Mission, TalentRecommendation } from "@/lib/team-composition/types";
import { CONSTRUCT_SHORT_LABELS } from "@/lib/team-composition/types";

interface TalentDraftProps {
  mission: Mission;
  assembledTeam: IndividualProfile[];
  talentPool: IndividualProfile[];
  recommendations: TalentRecommendation[];
  onAddMember: (id: string) => void;
  onRemoveMember: (id: string) => void;
}

function RecommendationCard({
  rec,
  profile,
  phaseLookup,
  onAdd,
}: {
  rec: TalentRecommendation;
  profile: IndividualProfile;
  phaseLookup: Record<string, string>;
  onAdd: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3">
        {/* Avatar */}
        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-amber-500/20 to-orange-500/10 flex items-center justify-center text-xs font-bold text-amber-400 shrink-0">
          {profile.name.split(" ").map((n) => n[0]).join("")}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-foreground truncate">{profile.name}</div>
          <div className="text-[10px] text-muted-foreground truncate">{profile.role}</div>
        </div>

        {/* Coverage delta */}
        <div className="text-right shrink-0">
          {rec.coverageDelta > 0 ? (
            <span className="text-xs font-bold text-emerald-400">+{(rec.coverageDelta * 100).toFixed(0)}%</span>
          ) : (
            <span className="text-xs font-bold text-muted-foreground">+0%</span>
          )}
          <div className="text-[9px] text-muted-foreground">coverage</div>
        </div>

        {/* Fills count */}
        <div className="text-right shrink-0 w-12">
          <span className="text-xs font-bold text-blue-400">{rec.coversFills.length}</span>
          <div className="text-[9px] text-muted-foreground">fills</div>
        </div>

        {/* Actions */}
        <button
          onClick={onAdd}
          className="px-3 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 text-xs font-medium transition-colors flex items-center gap-1"
        >
          <UserPlus className="w-3 h-3" />
          Draft
        </button>
        <button onClick={() => setExpanded(!expanded)} className="text-muted-foreground hover:text-foreground transition-colors">
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {expanded && (
        <div className="px-4 pb-3 border-t border-border pt-3 space-y-2">
          {/* What they fill */}
          {rec.coversFills.length > 0 && (
            <div>
              <div className="text-[9px] font-bold text-emerald-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                <Check className="w-3 h-3" /> Fills Gaps
              </div>
              <div className="flex flex-wrap gap-1">
                {rec.coversFills.map((f, i) => (
                  <span key={i} className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    {CONSTRUCT_SHORT_LABELS[f.construct]} <span className="text-emerald-600">in {phaseLookup[f.phaseId]}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Strongest phases */}
          {rec.strongestPhases.length > 0 && (
            <div>
              <div className="text-[9px] font-bold text-blue-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                <Zap className="w-3 h-3" /> Strongest Impact
              </div>
              <div className="flex flex-wrap gap-1">
                {rec.strongestPhases.map((pid) => (
                  <span key={pid} className="text-[10px] px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                    {phaseLookup[pid]}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Weaknesses */}
          {rec.weaknesses.length > 0 && (
            <div>
              <div className="text-[9px] font-bold text-amber-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> Weaknesses
              </div>
              <div className="flex flex-wrap gap-1">
                {rec.weaknesses.map((w, i) => (
                  <span key={i} className="text-[10px] px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                    {CONSTRUCT_SHORT_LABELS[w.construct]}: {w.score}/{w.needed} <span className="text-amber-600">in {phaseLookup[w.phaseId]}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function TalentDraft({
  mission,
  assembledTeam,
  talentPool,
  recommendations,
  onAddMember,
  onRemoveMember,
}: TalentDraftProps) {
  const phaseLookup = Object.fromEntries(mission.phases.map((p) => [p.id, p.name]));
  const poolProfiles = new Map(talentPool.map((p) => [p.id, p]));

  return (
    <div className="space-y-4">
      {/* Assembled team */}
      <div>
        <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
          Assembled Team ({assembledTeam.length})
        </h3>
        {assembledTeam.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-card p-6 text-center">
            <UserPlus className="w-6 h-6 text-muted-foreground mx-auto mb-2" />
            <p className="text-xs text-muted-foreground">Draft talent from the pool below to assemble your mission team.</p>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {assembledTeam.map((m) => (
              <div key={m.id} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5">
                <div className="w-6 h-6 rounded bg-emerald-500/20 flex items-center justify-center text-[10px] font-bold text-emerald-400">
                  {m.name.split(" ").map((n) => n[0]).join("")}
                </div>
                <div>
                  <div className="text-xs font-medium text-foreground">{m.name}</div>
                  <div className="text-[9px] text-muted-foreground">{m.role}</div>
                </div>
                <button
                  onClick={() => onRemoveMember(m.id)}
                  className="ml-1 text-muted-foreground hover:text-red-400 transition-colors"
                  title="Remove from team"
                >
                  <UserMinus className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Talent pool */}
      <div>
        <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
          Talent Pool — Mission-Ranked ({recommendations.length})
        </h3>
        <div className="space-y-1.5">
          {recommendations.map((rec, idx) => {
            const profile = poolProfiles.get(rec.profileId);
            if (!profile) return null;
            return (
              <div key={rec.profileId} className="flex items-start gap-2">
                <span className="text-[10px] font-bold text-muted-foreground mt-3 w-5 text-right shrink-0">
                  {idx + 1}
                </span>
                <div className="flex-1">
                  <RecommendationCard
                    rec={rec}
                    profile={profile}
                    phaseLookup={phaseLookup}
                    onAdd={() => onAddMember(rec.profileId)}
                  />
                </div>
              </div>
            );
          })}
          {recommendations.length === 0 && (
            <p className="text-xs text-muted-foreground py-4 text-center">All available talent has been drafted.</p>
          )}
        </div>
      </div>
    </div>
  );
}

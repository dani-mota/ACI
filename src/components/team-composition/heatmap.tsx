"use client";

import { CONSTRUCT_IDS, CONSTRUCT_SHORT_LABELS, type IndividualProfile } from "@/lib/team-composition/types";

interface HeatmapProps {
  members: IndividualProfile[];
  highlightSpof?: Record<string, boolean>;
}

function scoreColor(score: number): string {
  if (score >= 85) return "bg-emerald-800/80 text-emerald-100";
  if (score >= 70) return "bg-emerald-600/60 text-emerald-50";
  if (score >= 55) return "bg-secondary text-foreground";
  if (score >= 40) return "bg-amber-600/50 text-amber-100";
  return "bg-red-700/50 text-red-100";
}

function scoreBorder(score: number): string {
  if (score >= 85) return "border-emerald-500/30";
  if (score >= 70) return "border-emerald-400/20";
  if (score >= 55) return "border-border";
  if (score >= 40) return "border-amber-500/30";
  return "border-red-500/30";
}

export function TeamHeatmap({ members, highlightSpof }: HeatmapProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr>
            <th className="text-left py-2 px-3 text-muted-foreground font-medium sticky left-0 bg-popover z-10 min-w-[140px]">
              Team Member
            </th>
            {CONSTRUCT_IDS.map((cid) => (
              <th
                key={cid}
                className={`py-2 px-1.5 text-center font-medium min-w-[72px] ${
                  highlightSpof?.[cid]
                    ? "text-amber-400"
                    : "text-muted-foreground"
                }`}
              >
                <div className="flex flex-col items-center gap-0.5">
                  <span className="text-[10px] leading-tight">{CONSTRUCT_SHORT_LABELS[cid]}</span>
                  {highlightSpof?.[cid] && (
                    <span className="text-[8px] text-amber-500 font-bold">SPOF</span>
                  )}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {members.map((member) => (
            <tr key={member.id} className="border-t border-border">
              <td className="py-1.5 px-3 text-foreground font-medium sticky left-0 bg-popover z-10">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500/30 to-cyan-500/30 flex items-center justify-center text-[10px] font-bold text-blue-300 shrink-0">
                    {member.name.split(" ").map(n => n[0]).join("")}
                  </div>
                  <div>
                    <div className="text-[11px]">{member.name}</div>
                    <div className="text-[9px] text-muted-foreground">{member.role}</div>
                  </div>
                </div>
              </td>
              {CONSTRUCT_IDS.map((cid) => {
                const score = member.scores[cid];
                return (
                  <td key={cid} className="py-1.5 px-1">
                    <div
                      className={`rounded px-1.5 py-1 text-center font-mono font-semibold text-[11px] border ${scoreColor(score)} ${scoreBorder(score)} transition-all hover:scale-110 hover:z-10 cursor-default`}
                      title={`${member.name}: ${CONSTRUCT_SHORT_LABELS[cid]} = ${score}`}
                    >
                      {score}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

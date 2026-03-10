"use client";

import Link from "next/link";
import { InitialsBadge } from "@/components/ui/initials-badge";
import { useBasePath } from "@/components/base-path-provider";
import { StatusBadge } from "@/components/ui/status-badge";
import { CONSTRUCTS, LAYER_INFO, type LayerType } from "@/lib/constructs";

interface TopConstructScore {
  constructId: string;
  abbreviation: string;
  percentile: number;
  layerColor: string;
}

interface FailedDimension {
  name: string;
  actual: number;
  required: number;
}

interface RosterCandidate {
  id: string;
  firstName: string;
  lastName: string;
  compositePercentile: number;
  status: string;
  distanceFromCutline: number;
  topConstructScores: TopConstructScore[];
  failedDimensions: FailedDimension[];
  redFlags: { severity: string; title: string }[];
}

interface CandidateRosterProps {
  title: string;
  subtitle: string;
  candidates: RosterCandidate[];
  variant: "recommended" | "review" | "doNotAdvance";
}

const VARIANT_CONFIG = {
  recommended: { borderColor: "border-l-aci-green", emptyMsg: "No candidates meet all cutline thresholds for this role." },
  review: { borderColor: "border-l-aci-amber", emptyMsg: "No candidates in the review zone." },
  doNotAdvance: { borderColor: "border-l-aci-red-muted", emptyMsg: "No candidates flagged as not recommended." },
};

export function CandidateRoster({ title, subtitle, candidates, variant }: CandidateRosterProps) {
  const basePath = useBasePath();
  const config = VARIANT_CONFIG[variant];

  return (
    <div className="bg-card border border-border">
      <div className="p-5 border-b border-border">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider" style={{ fontFamily: "var(--font-dm-sans)" }}>
              {title}
            </h2>
            <p className="text-[10px] text-muted-foreground mt-0.5 uppercase tracking-wider">{subtitle}</p>
          </div>
          <span className="text-[10px] font-mono font-medium text-muted-foreground px-2 py-0.5 bg-accent border border-border">
            {candidates.length} candidate{candidates.length !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      {candidates.length === 0 ? (
        <div className="p-5">
          <p className="text-xs text-muted-foreground">{config.emptyMsg}</p>
        </div>
      ) : (
        <div>
          {candidates.map((c, i) => (
            <div
              key={c.id}
              className={`flex items-center gap-4 px-5 py-3 border-l-2 ${config.borderColor} ${
                i < candidates.length - 1 ? "border-b border-border/50" : ""
              } hover:bg-accent/30 transition-colors`}
            >
              <InitialsBadge firstName={c.firstName} lastName={c.lastName} size="sm" />

              <div className="flex-1 min-w-0">
                <Link href={`${basePath}/candidates/${c.id}`} className="text-xs font-medium text-foreground hover:text-aci-gold transition-colors">
                  {c.firstName} {c.lastName}
                </Link>
                {/* Failure reasons for review/doNotAdvance */}
                {variant !== "recommended" && c.failedDimensions.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {c.failedDimensions.map((f) => (
                      <span key={f.name} className="text-[9px] font-mono text-aci-red px-1 py-0.5 bg-aci-red/5 border border-aci-red/20">
                        {f.name}: {f.actual} / min {f.required}
                      </span>
                    ))}
                  </div>
                )}
                {/* Red flags for doNotAdvance */}
                {variant === "doNotAdvance" && c.redFlags?.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {c.redFlags?.filter((f) => f.severity === "CRITICAL").map((f, j) => (
                      <span key={j} className="text-[9px] font-mono text-aci-red px-1 py-0.5 bg-aci-red/5 border border-aci-red/20">
                        {f.title}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Top 3 weighted construct scores */}
              <div className="hidden sm:flex items-center gap-2">
                {c.topConstructScores.map((s) => (
                  <div key={s.constructId} className="flex items-center gap-1 px-1.5 py-0.5 bg-accent/50 border border-border">
                    <span className="text-[9px] font-mono font-semibold" style={{ color: s.layerColor }}>
                      {s.abbreviation}
                    </span>
                    <span className="text-[10px] font-mono font-medium text-foreground tabular-nums">
                      {s.percentile}
                    </span>
                  </div>
                ))}
              </div>

              {/* Composite score */}
              <div className="text-right">
                <p className="text-lg font-bold font-mono text-foreground tabular-nums">{c.compositePercentile}</p>
                <p className="text-[8px] text-muted-foreground uppercase tracking-wider">Composite</p>
              </div>

              <StatusBadge status={c.status} size="sm" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

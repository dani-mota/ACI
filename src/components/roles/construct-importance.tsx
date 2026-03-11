"use client";

import { CONSTRUCTS, LAYER_INFO, type LayerType } from "@/lib/constructs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Info } from "lucide-react";

interface ConstructRanking {
  constructId: string;
  weight: number;
  rank: number;
  isCritical: boolean;
}

interface ConstructImportanceProps {
  constructs: ConstructRanking[];
  roleSlug: string;
}

const LAYERS: LayerType[] = ["COGNITIVE_CORE", "TECHNICAL_APTITUDE", "BEHAVIORAL_INTEGRITY"];

export function ConstructImportance({ constructs, roleSlug }: ConstructImportanceProps) {
  const maxWeight = Math.max(...constructs.map((c) => c.weight));

  return (
    <TooltipProvider delayDuration={200}>
      <div className="bg-card border border-border p-5">
        <h2 className="text-sm font-semibold text-foreground mb-3 uppercase tracking-wider" style={{ fontFamily: "var(--font-dm-sans)" }}>
          Construct Importance
        </h2>

        {/* Explainer card */}
        <div className="flex items-start gap-2 mb-4 p-3 rounded bg-muted/50 border border-border/50">
          <Info className="w-3.5 h-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            These weights determine how much each trait matters for this role.
            A higher percentage means that trait has more influence on a candidate&apos;s
            overall score. They add up to 100% so you can see the relative importance
            of each trait at a glance.
          </p>
        </div>

        <div className="space-y-4">
          {LAYERS.map((layer) => {
            const info = LAYER_INFO[layer];
            const layerConstructs = constructs.filter(
              (c) => CONSTRUCTS[c.constructId as keyof typeof CONSTRUCTS]?.layer === layer
            );

            if (layerConstructs.length === 0) return null;

            return (
              <div key={layer}>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2.5 h-2.5" style={{ backgroundColor: info.color }} />
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">{info.name}</span>
                </div>

                <div className="space-y-0.5">
                  {layerConstructs.map((c) => {
                    const meta = CONSTRUCTS[c.constructId as keyof typeof CONSTRUCTS];
                    if (!meta) return null;
                    const barWidth = maxWeight > 0 ? (c.weight / maxWeight) * 100 : 0;
                    const relevance = meta.roleRelevance[roleSlug];

                    return (
                      <div
                        key={c.constructId}
                        className={`p-2.5 border border-border/50 ${c.isCritical ? "border-l-2 border-l-aci-gold bg-aci-gold/5" : ""}`}
                      >
                        <div className="flex items-center gap-3">
                          {/* Rank */}
                          <span className={`text-[10px] font-mono font-bold w-5 text-center ${c.isCritical ? "text-aci-gold" : "text-muted-foreground"}`}>
                            #{c.rank}
                          </span>

                          {/* Abbreviation */}
                          <span className="text-[10px] font-mono font-semibold w-6 text-center" style={{ color: info.color }}>
                            {meta.abbreviation}
                          </span>

                          {/* Name with tooltip */}
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="text-xs text-foreground w-40 truncate cursor-help border-b border-dashed border-muted-foreground/30">
                                {meta.name}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-[280px] p-3 space-y-1.5">
                              <p className="text-xs font-medium">{meta.name}</p>
                              <p className="text-[11px] opacity-80">{meta.definition}</p>
                              {relevance && (
                                <p className="text-[11px] opacity-60 italic">{relevance}</p>
                              )}
                            </TooltipContent>
                          </Tooltip>

                          {/* Weight bar */}
                          <div className="flex-1 h-4 bg-muted overflow-hidden relative">
                            <div
                              className="h-full transition-all duration-500"
                              style={{
                                width: `${barWidth}%`,
                                backgroundColor: c.isCritical ? "#0EA5E9" : info.color,
                                opacity: c.isCritical ? 0.8 : 0.6,
                              }}
                            />
                          </div>

                          {/* Weight value */}
                          <span className="text-[11px] font-mono font-semibold tabular-nums w-10 text-right" style={{ color: info.color }}>
                            {c.weight}%
                          </span>

                          {/* Critical badge */}
                          {c.isCritical && (
                            <span className="text-[9px] font-mono font-medium uppercase tracking-wider text-aci-gold px-1.5 py-0.5 bg-aci-gold/10 border border-aci-gold/30">
                              Critical
                            </span>
                          )}
                        </div>

                        {/* Role relevance */}
                        {relevance && (
                          <p className="text-[10px] text-muted-foreground leading-relaxed mt-1.5 ml-14">
                            {relevance}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </TooltipProvider>
  );
}

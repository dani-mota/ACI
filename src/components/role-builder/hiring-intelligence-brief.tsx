"use client";

import { TrendingUp, AlertTriangle, Users } from "lucide-react";
import { CONSTRUCTS } from "@/lib/constructs";
import type { HiringIntelligence } from "@/lib/role-builder/pipeline";

interface HiringIntelligenceBriefProps {
  intelligence: HiringIntelligence;
}

export function HiringIntelligenceBrief({ intelligence }: HiringIntelligenceBriefProps) {
  const {
    estimatedPassRate,
    estimatedPassRatio,
    bottleneckConstruct,
    bottleneckExplanation,
    sourcingRecommendation,
    comparisonToDefaults,
  } = intelligence;

  const rateColor =
    estimatedPassRate >= 30
      ? "text-aci-green"
      : estimatedPassRate >= 15
      ? "text-aci-gold"
      : "text-aci-red";

  const bottleneckMeta = CONSTRUCTS[bottleneckConstruct];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        {/* Pass Rate */}
        <div className="bg-card border border-border p-3 rounded-sm">
          <div className="flex items-center gap-1.5 mb-1">
            <TrendingUp className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Est. Pass Rate</span>
          </div>
          <span className={`text-2xl font-bold font-mono ${rateColor}`}>
            {estimatedPassRate}%
          </span>
          <p className="text-[10px] text-muted-foreground mt-0.5">{estimatedPassRatio} applicants</p>
        </div>

        {/* Bottleneck */}
        <div className="bg-card border border-border p-3 rounded-sm">
          <div className="flex items-center gap-1.5 mb-1">
            <AlertTriangle className="w-3.5 h-3.5 text-aci-gold" />
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Bottleneck</span>
          </div>
          <span className="text-sm font-semibold text-foreground leading-tight">
            {bottleneckMeta?.name ?? bottleneckConstruct}
          </span>
          <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">{bottleneckExplanation}</p>
        </div>

        {/* Benchmark comparison */}
        <div className="bg-card border border-border p-3 rounded-sm">
          <div className="flex items-center gap-1.5 mb-1">
            <Users className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Closest Default</span>
          </div>
          <span className="text-sm font-semibold text-foreground leading-tight capitalize">
            {comparisonToDefaults.mostSimilarRole.replace(/-/g, " ")}
          </span>
          {comparisonToDefaults.keyDifferences.length > 0 && (
            <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">
              {comparisonToDefaults.keyDifferences[0]}
            </p>
          )}
        </div>
      </div>

      {/* Sourcing */}
      <div className="bg-aci-navy/5 border border-aci-navy/10 p-3 rounded-sm">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1">Sourcing Recommendation</p>
        <p className="text-xs text-foreground leading-relaxed">{sourcingRecommendation}</p>
      </div>
    </div>
  );
}

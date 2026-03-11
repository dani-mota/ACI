"use client";

import { TrendingUp, AlertTriangle, Users, Info } from "lucide-react";
import { CONSTRUCTS } from "@/lib/constructs";
import type { HiringIntelligence } from "@/lib/role-builder/pipeline";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

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
    <TooltipProvider delayDuration={200}>
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        {/* Pass Rate */}
        <div className="bg-card border border-border p-3 rounded-sm">
          <div className="flex items-center gap-1.5 mb-1">
            <TrendingUp className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Est. Pass Rate</span>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="w-3 h-3 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-[280px] p-3 space-y-1.5">
                <p className="text-[11px]">
                  Estimated percentage of the general applicant population that would meet
                  all cutline thresholds for this role, based on the construct weight
                  distribution and difficulty of the cutlines.
                </p>
                <p className="text-[11px] opacity-70">
                  This is a pre-calibration estimate — actual pass rates will be refined
                  once live assessment data is collected.
                </p>
              </TooltipContent>
            </Tooltip>
          </div>
          <span className={`text-2xl font-bold font-mono ${rateColor}`}>
            {estimatedPassRate}%
          </span>
          {estimatedPassRate < 15 && (
            <p className="text-[10px] text-aci-gold mt-1">
              A low pass rate suggests demanding cutlines. Consider reviewing construct weights or cutline thresholds if this seems restrictive for your talent market.
            </p>
          )}
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
          <p className="text-[10px] text-muted-foreground mt-0.5">{bottleneckExplanation}</p>
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
            <div className="text-[10px] text-muted-foreground mt-0.5 space-y-0.5">
              {comparisonToDefaults.keyDifferences.map((diff, i) => (
                <p key={i}>{diff}</p>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Sourcing */}
      <div className="bg-aci-navy/5 border border-aci-navy/10 p-3 rounded-sm">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1">Sourcing Recommendation</p>
        <p className="text-xs text-foreground leading-relaxed">{sourcingRecommendation}</p>
      </div>
    </div>
    </TooltipProvider>
  );
}

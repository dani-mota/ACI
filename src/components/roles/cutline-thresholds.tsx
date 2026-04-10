"use client";

import { LAYER_INFO } from "@/lib/constructs";

interface CutlineThresholdsProps {
  cutline: {
    technicalAptitude: number;
    behavioralIntegrity: number;
    learningVelocity: number;
    overallMinimum: number | null;
  } | null;
}

const DIMENSIONS = [
  { key: "technicalAptitude" as const, label: "Technical Aptitude", sublabel: "Layer average minimum", color: LAYER_INFO.TECHNICAL_APTITUDE.color },
  { key: "behavioralIntegrity" as const, label: "Behavioral Integrity", sublabel: "Layer average minimum", color: LAYER_INFO.BEHAVIORAL_INTEGRITY.color },
  { key: "learningVelocity" as const, label: "Learning Velocity", sublabel: "Construct minimum", color: LAYER_INFO.COGNITIVE_CORE.color },
];

export function CutlineThresholds({ cutline }: CutlineThresholdsProps) {
  if (!cutline) {
    return (
      <div className="bg-card border border-border p-5">
        <h2 className="text-sm font-semibold text-foreground mb-3 uppercase tracking-wider" style={{ fontFamily: "var(--font-dm-sans)" }}>
          Minimum Thresholds
        </h2>
        <p className="text-xs text-muted-foreground">No cutline configured for this role.</p>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border p-5">
      <h2 className="text-sm font-semibold text-foreground mb-4 uppercase tracking-wider" style={{ fontFamily: "var(--font-dm-sans)" }}>
        Minimum Thresholds
      </h2>

      <div className="space-y-4">
        {DIMENSIONS.map(({ key, label, sublabel, color }) => {
          const value = cutline[key];

          return (
            <div key={key}>
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2" style={{ backgroundColor: color }} />
                  <span className="text-xs text-foreground font-medium">{label}</span>
                  <span className="text-[9px] text-muted-foreground uppercase tracking-wider">{sublabel}</span>
                </div>
                <span className="text-xs font-mono font-bold" style={{ color }}>
                  Scaled Score: {value}
                </span>
              </div>

              <div className="relative h-6 bg-muted overflow-hidden">
                {/* Fail zone */}
                <div
                  className="absolute top-0 bottom-0 left-0 bg-aci-red/8"
                  style={{ width: `${value}%` }}
                />
                {/* Pass zone */}
                <div
                  className="absolute top-0 bottom-0 right-0 bg-aci-green/8"
                  style={{ left: `${value}%` }}
                />
                {/* Cutline marker */}
                <div
                  className="absolute top-0 bottom-0 w-0.5"
                  style={{ left: `${value}%`, backgroundColor: color }}
                />
                {/* Cutline label */}
                <div
                  className="absolute top-1/2 -translate-y-1/2 text-[9px] font-mono font-bold px-1"
                  style={{
                    left: `${value}%`,
                    transform: `translateX(${value > 70 ? "-100%" : "4px"}) translateY(-50%)`,
                    color,
                  }}
                >
                  {value}
                </div>
                {/* Scale markers */}
                <div className="absolute bottom-0 left-0 w-full flex justify-between px-1">
                  <span className="text-[8px] text-muted-foreground/50 font-mono">0</span>
                  <span className="text-[8px] text-muted-foreground/50 font-mono">25</span>
                  <span className="text-[8px] text-muted-foreground/50 font-mono">50</span>
                  <span className="text-[8px] text-muted-foreground/50 font-mono">75</span>
                  <span className="text-[8px] text-muted-foreground/50 font-mono">100</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

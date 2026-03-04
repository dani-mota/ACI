"use client";

import { LAYER_INFO } from "@/lib/constructs";

export interface CutlineValues {
  technicalAptitude: number;
  behavioralIntegrity: number;
  learningVelocity: number;
  overallMinimum?: number;
}

interface CutlineControlsProps {
  cutlines: CutlineValues;
  recommendations: CutlineValues;
  onChange: (cutlines: CutlineValues) => void;
}

const DIMENSIONS = [
  {
    key: "technicalAptitude" as const,
    label: "Technical Aptitude",
    sublabel: "Layer 2 average minimum",
    color: LAYER_INFO.TECHNICAL_APTITUDE.color,
  },
  {
    key: "behavioralIntegrity" as const,
    label: "Behavioral Integrity",
    sublabel: "Layer 3 average minimum",
    color: LAYER_INFO.BEHAVIORAL_INTEGRITY.color,
  },
  {
    // DB field is "learningVelocity" for historical reasons; represents Cognitive Core layer average
    key: "learningVelocity" as const,
    label: "Cognitive Core",
    sublabel: "Layer 1 average minimum",
    color: LAYER_INFO.COGNITIVE_CORE.color,
  },
];

export function CutlineControls({ cutlines, recommendations, onChange }: CutlineControlsProps) {
  const handleChange = (key: keyof CutlineValues, value: number) => {
    onChange({ ...cutlines, [key]: value });
  };

  return (
    <div className="space-y-5">
      {DIMENSIONS.map(({ key, label, sublabel, color }) => {
        const value = cutlines[key] ?? 50;
        const rec = recommendations[key] ?? 50;
        const diff = value - rec;

        return (
          <div key={key}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
                <span className="text-xs font-medium text-foreground">{label}</span>
                <span className="text-[9px] uppercase tracking-wider text-muted-foreground">{sublabel}</span>
              </div>
              <div className="flex items-center gap-2">
                {diff !== 0 && (
                  <span className={`text-[9px] font-mono ${diff > 0 ? "text-aci-gold" : "text-muted-foreground"}`}>
                    {diff > 0 ? `+${diff}` : diff} from ACI rec
                  </span>
                )}
                <span className="text-xs font-mono font-bold" style={{ color }}>
                  {value}th %ile
                </span>
              </div>
            </div>

            <div className="relative">
              {/* ACI recommendation marker */}
              <div
                className="absolute -top-2 text-aci-gold text-[8px] -translate-x-1/2 pointer-events-none select-none"
                style={{ left: `${rec}%` }}
                title={`ACI recommendation: ${rec}th percentile`}
              >
                ◆
              </div>

              {/* Track background with pass/fail zones */}
              <div className="relative h-7 bg-muted overflow-hidden rounded-sm">
                <div
                  className="absolute top-0 bottom-0 left-0 bg-aci-red/8"
                  style={{ width: `${value}%` }}
                />
                <div
                  className="absolute top-0 bottom-0 right-0 bg-aci-green/8"
                  style={{ left: `${value}%` }}
                />
                <div
                  className="absolute top-0 bottom-0 w-0.5"
                  style={{ left: `${value}%`, backgroundColor: color }}
                />
                <div className="absolute bottom-0.5 left-0 w-full flex justify-between px-1 pointer-events-none">
                  {[0, 25, 50, 75, 100].map((v) => (
                    <span key={v} className="text-[7px] text-muted-foreground/50 font-mono">
                      {v}
                    </span>
                  ))}
                </div>
              </div>

              <input
                type="range"
                min={10}
                max={90}
                step={1}
                value={value}
                onChange={(e) => handleChange(key, Number(e.target.value))}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, ClipboardCheck, Compass, Wrench, Users, Lightbulb, Rocket, AlertTriangle, CheckCircle, Info } from "lucide-react";
import { generateAllPanels } from "@/lib/intelligence";
import type { AssessmentMode } from "@/generated/prisma/enums";
import { isEmployeeMode } from "@/lib/assessment/mode-utils";

const ICONS: Record<string, any> = {
  "clipboard-check": ClipboardCheck,
  "compass": Compass,
  "wrench": Wrench,
  "users": Users,
  "lightbulb": Lightbulb,
  "rocket": Rocket,
};

const RISK_CONFIG = {
  low: { label: "LOW RISK", color: "text-aci-green", bg: "bg-aci-green/5", border: "border-aci-green/20", Icon: CheckCircle },
  moderate: { label: "MODERATE", color: "text-aci-amber", bg: "bg-aci-amber/5", border: "border-aci-amber/20", Icon: Info },
  elevated: { label: "ELEVATED", color: "text-aci-red", bg: "bg-aci-red/5", border: "border-aci-red/20", Icon: AlertTriangle },
};

interface IntelligenceReportProps {
  subtestResults: any[];
  roleName?: string;
  // PRO-134: optional, used by the defensive guard. Existing callers omit it.
  assessmentMode?: AssessmentMode | null;
}

export function IntelligenceReport({ subtestResults, roleName, assessmentMode }: IntelligenceReportProps) {
  // PRO-134: defensive guard against accidental import into Employee Mode surfaces.
  if (isEmployeeMode({ assessmentMode })) return null;

  const panels = generateAllPanels(
    subtestResults.map((r: any) => ({ construct: r.construct, percentile: r.percentile })),
    roleName
  );

  const [openPanels, setOpenPanels] = useState<Set<number>>(new Set([0]));

  const toggle = (index: number) => {
    const next = new Set(openPanels);
    if (next.has(index)) next.delete(index);
    else next.add(index);
    setOpenPanels(next);
  };

  return (
    <div className="bg-card border border-border p-5">
      <h2 className="text-sm font-semibold text-foreground mb-3 uppercase tracking-wider" style={{ fontFamily: "var(--font-dm-sans)" }}>
        Candidate Intelligence Report
      </h2>

      <div className="space-y-1">
        {panels.map((panel, i) => {
          const isOpen = openPanels.has(i);
          const Icon = ICONS[panel.icon] || ClipboardCheck;
          const risk = panel.riskLevel ? RISK_CONFIG[panel.riskLevel] : null;

          return (
            <div key={i} className="border border-border overflow-hidden">
              <button
                onClick={() => toggle(i)}
                className="w-full flex items-center gap-3 p-3 text-left hover:bg-accent transition-colors"
              >
                <Icon className="w-4 h-4 text-aci-blue shrink-0" />
                <span className="flex-1 text-xs font-medium text-foreground">{panel.title}</span>
                {risk && (
                  <span className={`text-[9px] font-mono font-medium uppercase tracking-wider ${risk.color} px-1.5 py-0.5 ${risk.bg} border ${risk.border}`}>
                    {risk.label}
                  </span>
                )}
                {isOpen ? (
                  <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                )}
              </button>

              {isOpen && (
                <div className="px-3 pb-3 border-t border-border">
                  <p className="text-xs text-muted-foreground leading-relaxed mt-2.5">
                    {panel.narrative}
                  </p>

                  {panel.keyPoints.length > 0 && (
                    <ul className="mt-3 space-y-1.5">
                      {panel.keyPoints.map((point, j) => (
                        <li key={j} className="flex items-start gap-2 text-[11px] text-muted-foreground">
                          <span className="w-1 h-1 bg-aci-gold mt-1.5 shrink-0" />
                          {point}
                        </li>
                      ))}
                    </ul>
                  )}

                  {/* Hiring Action + Development Note */}
                  {(panel.hiringAction || panel.developmentNote) && (
                    <div className="mt-3 pt-3 border-t border-border grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {panel.hiringAction && (
                        <div className="p-2 bg-accent/30">
                          <p className="text-[9px] text-aci-gold uppercase tracking-wider font-medium mb-1">Hiring Action</p>
                          <p className="text-[10px] text-muted-foreground leading-relaxed">{panel.hiringAction}</p>
                        </div>
                      )}
                      {panel.developmentNote && (
                        <div className="p-2 bg-accent/30">
                          <p className="text-[9px] text-aci-blue uppercase tracking-wider font-medium mb-1">Development Focus</p>
                          <p className="text-[10px] text-muted-foreground leading-relaxed">{panel.developmentNote}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

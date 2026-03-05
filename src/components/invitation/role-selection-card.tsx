"use client";

import { Check } from "lucide-react";

const COMPLEXITY_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  LOW: { label: "Low", color: "#065F46", bg: "#D1FAE5" },
  MEDIUM: { label: "Medium", color: "#1E40AF", bg: "#DBEAFE" },
  MEDIUM_HIGH: { label: "Med-High", color: "#92400E", bg: "#FEF3C7" },
  HIGH: { label: "High", color: "#991B1B", bg: "#FEE2E2" },
};

const SOURCE_LABELS: Record<string, string> = {
  SYSTEM_DEFAULT: "Template",
  JD_UPLOAD: "JD Upload",
  TEMPLATE_CLONE: "Cloned",
  MANUAL_ENTRY: "Manual",
};

export interface InviteRole {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  isGeneric?: boolean;
  isCustom?: boolean;
  complexityLevel?: "LOW" | "MEDIUM" | "MEDIUM_HIGH" | "HIGH" | null;
  sourceType?: "SYSTEM_DEFAULT" | "JD_UPLOAD" | "TEMPLATE_CLONE" | "MANUAL_ENTRY" | null;
  compositeWeights: { constructId: string; weight: number }[];
}

interface RoleSelectionCardProps {
  role: InviteRole;
  selected: boolean;
  onSelect: () => void;
}

export function RoleSelectionCard({ role, selected, onSelect }: RoleSelectionCardProps) {
  return (
    <button
      onClick={onSelect}
      role="radio"
      aria-checked={selected}
      aria-label={role.name}
      className={`w-full text-left p-3 border transition-all focus-visible:ring-2 focus-visible:ring-aci-blue focus-visible:ring-offset-2 outline-none ${
        selected
          ? "border-aci-blue bg-aci-blue/5"
          : "border-border hover:border-aci-blue/30"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <h3 className="text-xs font-medium text-foreground uppercase tracking-wider">
            {role.name}
          </h3>

          {role.description && (
            <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2 leading-relaxed">
              {role.description}
            </p>
          )}

          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
            {role.complexityLevel && COMPLEXITY_LABELS[role.complexityLevel] && (
              <span
                className="text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5"
                style={{
                  color: COMPLEXITY_LABELS[role.complexityLevel].color,
                  backgroundColor: COMPLEXITY_LABELS[role.complexityLevel].bg,
                }}
              >
                {COMPLEXITY_LABELS[role.complexityLevel].label}
              </span>
            )}
            {role.sourceType && SOURCE_LABELS[role.sourceType] && (
              <span className="text-[9px] font-mono text-muted-foreground bg-accent px-1.5 py-0.5 uppercase tracking-wider">
                {SOURCE_LABELS[role.sourceType]}
              </span>
            )}
          </div>
        </div>

        {selected && (
          <div className="w-5 h-5 bg-aci-blue rounded-full flex items-center justify-center shrink-0">
            <Check className="w-3 h-3 text-white" />
          </div>
        )}
      </div>
    </button>
  );
}

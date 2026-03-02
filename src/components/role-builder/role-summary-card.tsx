"use client";

import { useState } from "react";
import { Pencil, Check, X } from "lucide-react";

type ComplexityLevel = "LOW" | "MEDIUM" | "MEDIUM_HIGH" | "HIGH";

const COMPLEXITY_BADGE: Record<ComplexityLevel, { label: string; color: string; bg: string }> = {
  LOW:         { label: "Low Complexity",      color: "#059669", bg: "#059669/10" },
  MEDIUM:      { label: "Medium Complexity",   color: "#2563EB", bg: "#2563EB/10" },
  MEDIUM_HIGH: { label: "Med-High Complexity", color: "#D97706", bg: "#D97706/10" },
  HIGH:        { label: "High Complexity",     color: "#DC2626", bg: "#DC2626/10" },
};

interface RoleSummaryCardProps {
  name: string;
  description?: string;
  complexityLevel: ComplexityLevel;
  closestTemplate: string;
  onetCodes?: string[];
  outsideScope?: boolean;
  onNameChange: (name: string) => void;
  onDescriptionChange: (description: string) => void;
}

export function RoleSummaryCard({
  name,
  description,
  complexityLevel,
  closestTemplate,
  onetCodes,
  outsideScope,
  onNameChange,
  onDescriptionChange,
}: RoleSummaryCardProps) {
  const [editingName, setEditingName] = useState(false);
  const [editingDesc, setEditingDesc] = useState(false);
  const [draftName, setDraftName] = useState(name);
  const [draftDesc, setDraftDesc] = useState(description ?? "");

  const badge = COMPLEXITY_BADGE[complexityLevel] ?? COMPLEXITY_BADGE.MEDIUM;

  const commitName = () => {
    if (draftName.trim()) onNameChange(draftName.trim());
    else setDraftName(name);
    setEditingName(false);
  };

  const commitDesc = () => {
    onDescriptionChange(draftDesc.trim());
    setEditingDesc(false);
  };

  return (
    <div className="bg-card border border-border p-4 space-y-3">
      {/* Role Name */}
      <div>
        {editingName ? (
          <div className="flex items-center gap-2">
            <input
              autoFocus
              className="flex-1 text-xl font-bold text-foreground bg-transparent border-b-2 border-aci-gold outline-none py-0.5"
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitName();
                if (e.key === "Escape") { setDraftName(name); setEditingName(false); }
              }}
            />
            <button onClick={commitName} className="text-aci-green"><Check className="w-4 h-4" /></button>
            <button onClick={() => { setDraftName(name); setEditingName(false); }} className="text-muted-foreground"><X className="w-4 h-4" /></button>
          </div>
        ) : (
          <div className="flex items-center gap-2 group">
            <h2 className="text-xl font-bold text-foreground">{name}</h2>
            <button
              onClick={() => { setDraftName(name); setEditingName(true); }}
              className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Meta row */}
      <div className="flex items-center flex-wrap gap-2">
        {/* Complexity badge */}
        <span
          className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-sm"
          style={{ color: badge.color, backgroundColor: `${badge.color}15` }}
        >
          {badge.label}
        </span>

        {/* Closest template */}
        <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
          Most similar to:{" "}
          <span className="text-foreground font-medium capitalize">
            {closestTemplate.replace(/-/g, " ")}
          </span>
        </span>

        {/* O*NET codes */}
        {onetCodes && onetCodes.length > 0 && (
          <div className="flex items-center gap-1">
            {onetCodes.slice(0, 3).map((code) => (
              <span key={code} className="text-[9px] font-mono bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                {code}
              </span>
            ))}
          </div>
        )}

        {/* Outside scope warning */}
        {outsideScope && (
          <span className="text-[10px] text-amber-600 font-medium bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-sm">
            ⚠ Outside ACI manufacturing scope
          </span>
        )}
      </div>

      {/* Description */}
      <div className="group">
        {editingDesc ? (
          <div className="space-y-1.5">
            <textarea
              autoFocus
              rows={3}
              className="w-full text-sm text-foreground bg-transparent border border-aci-gold/50 rounded p-2 outline-none resize-none focus:border-aci-gold"
              value={draftDesc}
              onChange={(e) => setDraftDesc(e.target.value)}
              placeholder="Add a role description…"
              onKeyDown={(e) => {
                if (e.key === "Escape") { setDraftDesc(description ?? ""); setEditingDesc(false); }
              }}
            />
            <div className="flex gap-2">
              <button onClick={commitDesc} className="text-xs text-aci-green flex items-center gap-1"><Check className="w-3 h-3" /> Save</button>
              <button onClick={() => { setDraftDesc(description ?? ""); setEditingDesc(false); }} className="text-xs text-muted-foreground flex items-center gap-1"><X className="w-3 h-3" /> Cancel</button>
            </div>
          </div>
        ) : (
          <div
            className="flex items-start gap-2 cursor-pointer"
            onClick={() => { setDraftDesc(description ?? ""); setEditingDesc(true); }}
          >
            {description ? (
              <p className="text-sm text-muted-foreground leading-relaxed flex-1 hover:text-foreground transition-colors">
                {description}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground/50 italic flex-1">
                Click to add a description…
              </p>
            )}
            <Pencil className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity mt-0.5 shrink-0" />
          </div>
        )}
      </div>
    </div>
  );
}

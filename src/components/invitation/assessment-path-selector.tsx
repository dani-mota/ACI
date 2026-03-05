"use client";

import { Compass, Target, Check, Info } from "lucide-react";
import { RoleSearch } from "./role-search";
import type { InviteRole } from "./role-selection-card";

type AssessmentPath = "generic" | "role-specific";

interface AssessmentPathSelectorProps {
  selectedPath: AssessmentPath | null;
  onSelectPath: (path: AssessmentPath) => void;
  roles: InviteRole[];
  selectedRoleId: string | null;
  onSelectRole: (roleId: string) => void;
  roleSearchQuery: string;
  onRoleSearchQueryChange: (query: string) => void;
  canCreateRole: boolean;
  hasGenericRole: boolean;
}

export function AssessmentPathSelector({
  selectedPath,
  onSelectPath,
  roles,
  selectedRoleId,
  onSelectRole,
  roleSearchQuery,
  onRoleSearchQueryChange,
  canCreateRole,
  hasGenericRole,
}: AssessmentPathSelectorProps) {
  return (
    <div className="space-y-4">
      <h3 className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
        Choose Assessment Type
      </h3>

      <div role="radiogroup" aria-label="Assessment type" className="space-y-3">
        {/* Path A: General Aptitude Screen */}
        <button
          onClick={() => onSelectPath("generic")}
          role="radio"
          aria-checked={selectedPath === "generic"}
          aria-label="General Aptitude Screen — Measures all 12 constructs equally"
          disabled={!hasGenericRole}
          className={`w-full text-left p-4 border transition-all focus-visible:ring-2 focus-visible:ring-aci-blue focus-visible:ring-offset-2 outline-none ${
            selectedPath === "generic"
              ? "border-aci-blue bg-aci-blue/5"
              : hasGenericRole
                ? "border-border hover:border-aci-blue/30"
                : "border-border opacity-50 cursor-not-allowed"
          }`}
        >
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded bg-aci-blue/10 flex items-center justify-center shrink-0">
              <Compass className="w-5 h-5 text-aci-blue" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-xs font-medium text-foreground uppercase tracking-wider">
                General Aptitude Screen
              </h3>
              <p className="text-[10px] text-muted-foreground mt-0.5 leading-relaxed">
                Measures all 12 constructs equally. Shows fit across every role in your org.
              </p>
            </div>
            {selectedPath === "generic" && (
              <div className="w-5 h-5 bg-aci-blue rounded-full flex items-center justify-center shrink-0">
                <Check className="w-3 h-3 text-white" />
              </div>
            )}
          </div>
        </button>

        {/* Info callout when generic is selected */}
        {selectedPath === "generic" && (
          <div role="status" className="bg-aci-blue/5 border border-aci-blue/20 p-3 flex items-start gap-2">
            <Info className="w-3.5 h-3.5 text-aci-blue shrink-0 mt-0.5" aria-hidden="true" />
            <p className="text-[10px] text-muted-foreground leading-relaxed">
              Recommended for early-career talent screening, internal workforce assessments,
              and horizontal promotion evaluations. Measures all 12 constructs with equal
              weighting — no domain-adaptive probes. Results include cross-role fit rankings.
            </p>
          </div>
        )}

        {/* OR divider */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-border" />
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
            or
          </span>
          <div className="flex-1 h-px bg-border" />
        </div>

        {/* Path B: Role-Specific Assessment */}
        <button
          onClick={() => onSelectPath("role-specific")}
          role="radio"
          aria-checked={selectedPath === "role-specific"}
          aria-label="Role-Specific Assessment — Domain-adaptive assessment tailored to a specific role"
          className={`w-full text-left p-4 border transition-all focus-visible:ring-2 focus-visible:ring-aci-green focus-visible:ring-offset-2 outline-none ${
            selectedPath === "role-specific"
              ? "border-aci-green bg-aci-green/5"
              : "border-border hover:border-aci-green/30"
          }`}
        >
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded bg-aci-green/10 flex items-center justify-center shrink-0">
              <Target className="w-5 h-5 text-aci-green" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-xs font-medium text-foreground uppercase tracking-wider">
                Role-Specific Assessment
              </h3>
              <p className="text-[10px] text-muted-foreground mt-0.5 leading-relaxed">
                Domain-adaptive assessment tailored to a specific role&apos;s requirements.
              </p>
            </div>
            {selectedPath === "role-specific" && (
              <div className="w-5 h-5 bg-aci-green rounded-full flex items-center justify-center shrink-0">
                <Check className="w-3 h-3 text-white" />
              </div>
            )}
          </div>
        </button>
      </div>

      {/* Inline role search — only when role-specific is selected */}
      {selectedPath === "role-specific" && (
        <RoleSearch
          roles={roles}
          selectedRoleId={selectedRoleId}
          onSelectRole={onSelectRole}
          searchQuery={roleSearchQuery}
          onSearchQueryChange={onRoleSearchQueryChange}
          canCreateRole={canCreateRole}
        />
      )}
    </div>
  );
}

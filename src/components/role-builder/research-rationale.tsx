"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Download } from "lucide-react";
import { CONSTRUCTS } from "@/lib/constructs";
import { Button } from "@/components/ui/button";
import type { ResearchRationale } from "@/lib/role-builder/pipeline";

interface ResearchRationaleProps {
  rationale: ResearchRationale;
  /** Role ID — used to construct the PDF download link after saving */
  savedRoleId?: string;
}

export function ResearchRationalePanel({ rationale, savedRoleId }: ResearchRationaleProps) {
  const [open, setOpen] = useState(false);
  const [expandedConstruct, setExpandedConstruct] = useState<string | null>(null);

  return (
    <div className="border border-border bg-card">
      {/* Header toggle */}
      <button
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-accent/50 transition-colors"
        onClick={() => setOpen((v) => !v)}
      >
        <div className="flex items-center gap-2">
          {open ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
          <span className="text-xs font-semibold uppercase tracking-wider text-foreground">Research Rationale</span>
          <span className="text-[10px] text-muted-foreground">(AI-generated · collapsed by default)</span>
        </div>
        {savedRoleId && (
          <a
            href={`/api/roles/${savedRoleId}/rationale/pdf`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-aci-gold transition-colors"
          >
            <Download className="w-3 h-3" />
            Download Brief
          </a>
        )}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-4 border-t border-border">
          {/* Summary */}
          <div className="pt-3">
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-1">Summary</p>
            <p className="text-sm text-foreground leading-relaxed">{rationale.summary}</p>
          </div>

          {/* Complexity explanation */}
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-1">Complexity Rationale</p>
            <p className="text-sm text-foreground leading-relaxed">{rationale.complexityExplanation}</p>
          </div>

          {/* Per-construct rationales (accordion) */}
          {rationale.topConstructRationales.length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-2">
                Weight Rationale — Top Constructs
              </p>
              <div className="space-y-1">
                {rationale.topConstructRationales.map(({ construct, rationale: text }) => {
                  const meta = CONSTRUCTS[construct];
                  const isExpanded = expandedConstruct === construct;
                  return (
                    <div key={construct} className="border border-border rounded-sm overflow-hidden">
                      <button
                        className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-accent/50 transition-colors"
                        onClick={() => setExpandedConstruct(isExpanded ? null : construct)}
                      >
                        <span className="text-xs font-medium text-foreground">
                          {meta?.name ?? construct}
                        </span>
                        {isExpanded ? (
                          <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        ) : (
                          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        )}
                      </button>
                      {isExpanded && (
                        <div className="px-3 pb-3 text-xs text-muted-foreground leading-relaxed border-t border-border pt-2">
                          {text}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Cutline rationale */}
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-1">Cutline Rationale</p>
            <p className="text-sm text-foreground leading-relaxed">{rationale.cutlineRationale}</p>
          </div>

          {/* Template comparison */}
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-1">
              Comparison to ACI Default Profiles
            </p>
            <p className="text-sm text-foreground leading-relaxed">{rationale.templateComparison}</p>
          </div>

          {/* Compliance note */}
          <div className="bg-muted/40 border border-border rounded-sm p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
              Compliance Notice
            </p>
            <p className="text-xs text-muted-foreground leading-relaxed">{rationale.complianceNote}</p>
          </div>

          {savedRoleId && (
            <div className="flex justify-end">
              <Button variant="outline" size="sm" asChild>
                <a href={`/api/roles/${savedRoleId}/rationale/pdf`} target="_blank" rel="noopener noreferrer">
                  <Download className="w-3.5 h-3.5" />
                  Download Research Brief (PDF)
                </a>
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

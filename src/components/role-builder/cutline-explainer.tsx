"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Info } from "lucide-react";

export function CutlineExplainer() {
  const [open, setOpen] = useState(false);

  return (
    <div className="border border-border bg-card mb-4">
      <button
        className="w-full flex items-center gap-2 px-4 py-3 hover:bg-accent/50 transition-colors"
        onClick={() => setOpen((v) => !v)}
      >
        {open ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
        <Info className="w-3.5 h-3.5 text-muted-foreground" />
        <span className="text-xs font-semibold uppercase tracking-wider text-foreground">What are cutline thresholds?</span>
      </button>

      {open && (
        <div className="px-4 pb-4 border-t border-border pt-3 space-y-2">
          <p className="text-sm text-muted-foreground leading-relaxed">
            Cutline thresholds define the minimum percentile a candidate must reach in each assessment
            layer to be considered for the role. A candidate scoring below any cutline is flagged as
            not meeting the minimum standard, regardless of their performance in other areas.
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Higher cutlines are more selective — fewer candidates will pass, but those who do are
            more likely to succeed. The gold diamond (◆) marks ACI&apos;s research-backed recommendation.
            You can adjust thresholds based on your hiring needs and labor market conditions.
          </p>
        </div>
      )}
    </div>
  );
}

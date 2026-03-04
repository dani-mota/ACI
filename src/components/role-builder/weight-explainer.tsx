"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Info } from "lucide-react";

export function WeightExplainer() {
  const [open, setOpen] = useState(false);

  return (
    <div className="border border-border bg-card mb-4">
      <button
        className="w-full flex items-center gap-2 px-4 py-3 hover:bg-accent/50 transition-colors"
        onClick={() => setOpen((v) => !v)}
      >
        {open ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
        <Info className="w-3.5 h-3.5 text-muted-foreground" />
        <span className="text-xs font-semibold uppercase tracking-wider text-foreground">What are construct weights?</span>
      </button>

      {open && (
        <div className="px-4 pb-4 border-t border-border pt-3 space-y-2">
          <p className="text-sm text-muted-foreground leading-relaxed">
            Construct weights determine how much each cognitive, technical, and behavioral trait
            contributes to a candidate&apos;s overall score. They must sum to 100%. A higher weight means
            that trait has more influence on who passes and who doesn&apos;t.
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            ACI generates recommended weights based on O*NET occupational data and I/O psychology
            research. The gold diamond (◆) shows the AI recommendation. You can lock individual weights
            and adjust others — unlocked weights will automatically rebalance to keep the total at 100%.
          </p>
        </div>
      )}
    </div>
  );
}

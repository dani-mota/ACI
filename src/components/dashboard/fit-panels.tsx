"use client";

/**
 * PRO-139: Fit Panels — Layer 4 of the Employee Dossier. Tabbed container
 * holding three views:
 *   - Role Fit: delegates to PRO-136's `RoleFitDeltaPanel` (no recomputation;
 *     just a different presentation context per AC).
 *   - Promotion Fit: comparison vs. next-level demand profile + verdict.
 *   - Mission Fit: Phase 3 placeholder.
 *
 * Tab state syncs to the URL fragment (`#role-fit` / `#promotion-fit` /
 * `#mission-fit`) so links are shareable.
 *
 * SSR/CSR hash handling: initial render uses the default tab to avoid a
 * hydration mismatch (the server has no `window`). A `useEffect` reads the
 * hash post-mount and switches if needed. Tab changes call
 * `history.replaceState` — not `pushState` — so the browser back button
 * doesn't cycle through tab states.
 */

import { useEffect, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RoleFitDeltaPanel } from "./role-fit-delta-panel";
import { PromotionFitPanel } from "./promotion-fit-panel";
import type { RoleDemandProfileEntry } from "@/lib/assessment/role-demand-resolution";

const TAB_VALUES = ["role-fit", "promotion-fit", "mission-fit"] as const;
type TabValue = (typeof TAB_VALUES)[number];

const DEFAULT_TAB: TabValue = "role-fit";

function isTabValue(v: string): v is TabValue {
  return (TAB_VALUES as readonly string[]).includes(v);
}

interface FitPanelsProps {
  subtestResults: { construct: string; percentile: number }[];
  /** PRO-135/136: current role's demand profile for the Role Fit tab. */
  roleDemandProfile?: RoleDemandProfileEntry[];
  /** PRO-139: next-level demand profile for the Promotion Fit tab. Stubbed
   *  as `undefined` until PR#1's schema + resolver land — panel renders the
   *  AC empty-state in that case. */
  nextLevelDemand?: RoleDemandProfileEntry[];
}

export function FitPanels({
  subtestResults,
  roleDemandProfile,
  nextLevelDemand,
}: FitPanelsProps) {
  const [tab, setTab] = useState<TabValue>(DEFAULT_TAB);

  // Initial hash sync — runs after hydration so the SSR markup matches.
  useEffect(() => {
    const fragment = window.location.hash.replace(/^#/, "");
    if (fragment && isTabValue(fragment) && fragment !== DEFAULT_TAB) {
      setTab(fragment);
    }
    // Intentionally empty deps: this is a mount-time read. Browser
    // back/forward navigations don't need to retrigger because we use
    // replaceState (no history entries added).
  }, []);

  const handleChange = (value: string) => {
    if (!isTabValue(value)) return;
    setTab(value);
    // replaceState (not pushState) so the back button doesn't cycle tabs.
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", `#${value}`);
    }
  };

  return (
    <Tabs value={tab} onValueChange={handleChange} className="w-full">
      <TabsList>
        <TabsTrigger value="role-fit">Role Fit</TabsTrigger>
        <TabsTrigger value="promotion-fit">Promotion Fit</TabsTrigger>
        <TabsTrigger value="mission-fit">Mission Fit</TabsTrigger>
      </TabsList>

      <TabsContent value="role-fit" className="pt-4">
        <RoleFitDeltaPanel
          subtestResults={subtestResults}
          roleDemandProfile={roleDemandProfile}
        />
      </TabsContent>

      <TabsContent value="promotion-fit" className="pt-4">
        <PromotionFitPanel
          subtestResults={subtestResults}
          nextLevelDemand={nextLevelDemand}
        />
      </TabsContent>

      <TabsContent value="mission-fit" className="pt-4">
        <p className="text-xs text-muted-foreground italic">
          Mission Fit unlocks when Mission Profiles are configured — coming in
          a future release.
        </p>
      </TabsContent>
    </Tabs>
  );
}

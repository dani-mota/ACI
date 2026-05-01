"use client";

/**
 * PRO-135: Role Demand Profile authoring UI.
 *
 * 12 sliders grouped by layer, each with a HelpCircle info-icon tooltip showing
 * the construct definition (reused from CONSTRUCTS[code].definition — same text
 * PRO-132's evidence prompts hand to Haiku, so authoring-time and prompt-time
 * descriptions stay consistent).
 *
 * Form state is a Map<construct, number | undefined> so partial profiles work
 * cleanly — null/undefined means "not yet scored," which the list page surfaces
 * as "N of 12 constructs scored." Per Dani polish #2.
 *
 * Templates are copied into local state on selection (no DB write until Save).
 */

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { CONSTRUCTS, LAYER_INFO, type LayerType } from "@/lib/constructs";
import {
  ROLE_DEMAND_TEMPLATES,
  type RoleDemandTemplate,
} from "@/lib/assessment/role-demand-templates";
import type { AuthoringScores } from "@/lib/assessment/role-demand-resolution";

const LAYER_ORDER: LayerType[] = [
  "COGNITIVE_CORE",
  "TECHNICAL_APTITUDE",
  "BEHAVIORAL_INTEGRITY",
];
const SLIDER_MIDPOINT = 5;

interface RoleProfileEditorProps {
  mode: "create" | "edit";
  initial?: {
    id: string;
    name: string;
    roleFamily: string;
    constructScores: AuthoringScores;
  };
}

interface SliderState {
  // null means "not yet scored" — distinguished from a deliberate score.
  // The DB store maps null → key absent (so we don't pollute the JSON).
  value: number | null;
}

function buildInitialSliderState(scores: AuthoringScores | undefined): Map<string, SliderState> {
  const map = new Map<string, SliderState>();
  for (const code of Object.keys(CONSTRUCTS)) {
    const v = scores?.[code];
    map.set(code, { value: typeof v === "number" ? v : null });
  }
  return map;
}

export function RoleProfileEditor({ mode, initial }: RoleProfileEditorProps) {
  const router = useRouter();
  const [name, setName] = useState(initial?.name ?? "");
  const [roleFamily, setRoleFamily] = useState(initial?.roleFamily ?? "");
  const [sliders, setSliders] = useState<Map<string, SliderState>>(
    () => buildInitialSliderState(initial?.constructScores),
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scoredCount = useMemo(
    () => Array.from(sliders.values()).filter((s) => s.value !== null).length,
    [sliders],
  );

  function applyTemplate(template: RoleDemandTemplate) {
    if (mode === "create" && !name) setName(template.name);
    if (mode === "create" && !roleFamily) setRoleFamily(template.roleFamily);
    setSliders(buildInitialSliderState(template.constructScores));
  }

  function setSlider(construct: string, value: number) {
    setSliders((prev) => {
      const next = new Map(prev);
      next.set(construct, { value });
      return next;
    });
  }

  async function onSave() {
    setError(null);
    if (!name.trim()) {
      setError("Profile name is required.");
      return;
    }
    if (!roleFamily.trim()) {
      setError("Role family is required.");
      return;
    }

    const constructScores: Record<string, number> = {};
    for (const [code, s] of sliders) {
      if (s.value !== null) constructScores[code] = s.value;
    }

    setSubmitting(true);
    try {
      const url = mode === "create"
        ? "/api/role-profiles"
        : `/api/role-profiles/${initial!.id}`;
      const method = mode === "create" ? "POST" : "PUT";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          roleFamily: roleFamily.trim(),
          constructScores,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? `Save failed (${res.status})`);
        return;
      }
      router.push("/role-profiles");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div className="p-6 space-y-6 max-w-[960px] mx-auto">
        <header className="flex items-start justify-between gap-3">
          <div>
            <h1
              className="text-xl font-bold text-foreground"
              style={{ fontFamily: "var(--font-dm-sans)" }}
            >
              {mode === "create" ? "New Role Demand Profile" : "Edit Role Demand Profile"}
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Score how much each construct matters for this role on a 1–10 scale. Skipped sliders count as &ldquo;not yet scored.&rdquo;
            </p>
          </div>
          <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
            {scoredCount} of 12 scored
          </div>
        </header>

        {/* Identity + template picker */}
        <section className="bg-card border border-border p-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                Profile Name
              </label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Software Engineer — IC3"
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                Role Family
              </label>
              <Input
                value={roleFamily}
                onChange={(e) => setRoleFamily(e.target.value)}
                placeholder="e.g. Engineering"
                className="mt-1"
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                Resolved case-insensitively against employees&apos; role family.
              </p>
            </div>
          </div>

          {mode === "create" && (
            <div>
              <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                Start from a template
              </label>
              <Select
                onValueChange={(id) => {
                  const tpl = ROLE_DEMAND_TEMPLATES.find((t) => t.id === id);
                  if (tpl) applyTemplate(tpl);
                }}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Choose a template (optional)" />
                </SelectTrigger>
                <SelectContent>
                  {ROLE_DEMAND_TEMPLATES.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      <div className="flex flex-col">
                        <span>{t.name}</span>
                        <span className="text-[10px] text-muted-foreground">
                          {t.description}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </section>

        {/* Slider grid grouped by layer */}
        {LAYER_ORDER.map((layer) => {
          const layerInfo = LAYER_INFO[layer];
          const codes = Object.entries(CONSTRUCTS)
            .filter(([, meta]) => meta.layer === layer)
            .map(([code]) => code);
          if (codes.length === 0) return null;

          return (
            <section key={layer} className="bg-card border border-border p-5">
              <header className="flex items-center gap-2 mb-4">
                <span
                  className="inline-block w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: layerInfo.color }}
                  aria-hidden="true"
                />
                <h2 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                  {layerInfo.name}
                </h2>
              </header>
              <div className="space-y-5">
                {codes.map((code) => {
                  const meta = CONSTRUCTS[code];
                  const slider = sliders.get(code) ?? { value: null };
                  const display = slider.value ?? SLIDER_MIDPOINT;
                  const unscored = slider.value === null;
                  return (
                    <div key={code}>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-medium text-foreground">
                            {meta.name}
                          </span>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                type="button"
                                aria-label={`What is ${meta.name}?`}
                                className="text-muted-foreground hover:text-foreground"
                              >
                                <HelpCircle className="w-3 h-3" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-[300px]">
                              {meta.definition}
                            </TooltipContent>
                          </Tooltip>
                          <span className="text-[10px] font-mono text-muted-foreground">
                            ({meta.abbreviation})
                          </span>
                        </div>
                        <span
                          className={`text-xs font-mono ${
                            unscored ? "text-muted-foreground italic" : "text-foreground"
                          }`}
                        >
                          {unscored ? "—" : `${slider.value} / 10`}
                        </span>
                      </div>
                      <Slider
                        min={1}
                        max={10}
                        step={1}
                        value={[display]}
                        onValueChange={([v]) => setSlider(code, v)}
                      />
                      <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                        <span>1 — Low demand</span>
                        <span>10 — Critical demand</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}

        {error && (
          <p className="text-xs text-aci-red" role="alert">
            {error}
          </p>
        )}

        <div className="flex items-center justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => router.push("/role-profiles")}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button type="button" onClick={onSave} disabled={submitting}>
            {submitting ? "Saving…" : mode === "create" ? "Create Profile" : "Save Changes"}
          </Button>
        </div>
      </div>
    </TooltipProvider>
  );
}

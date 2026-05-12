"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Loader2, AlertTriangle, CheckCircle, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WeightVisualizer } from "./weight-visualizer";
import { WeightExplainer } from "./weight-explainer";
import { CutlineControls } from "./cutline-controls";
import { CutlineExplainer } from "./cutline-explainer";
import { HiringIntelligenceBrief } from "./hiring-intelligence-brief";
import { ResearchRationalePanel } from "./research-rationale";
import { RoleSummaryCard } from "./role-summary-card";
import type { RoleBuilderPipelineResult } from "@/lib/role-builder/pipeline";

interface ReviewClientProps {
  result: RoleBuilderPipelineResult;
  saveEndpoint?: string;
  redirectPath?: (slug: string) => string;
}

export function ReviewClient({ result, saveEndpoint = "/api/roles", redirectPath = (slug) => `/roles/${slug}` }: ReviewClientProps) {
  const router = useRouter();

  const [name, setName] = useState(result.extracted.title || "New Role");
  const [description, setDescription] = useState(result.extracted.description || "");
  const [weights, setWeights] = useState<Record<string, number>>({ ...result.weights.weights });
  type Cutlines = {
    technicalAptitude: number;
    behavioralIntegrity: number;
    learningVelocity: number;
    overallMinimum?: number;
  };
  const [cutlines, setCutlines] = useState<Cutlines>({
    technicalAptitude: result.weights.cutlines.technicalAptitude,
    behavioralIntegrity: result.weights.cutlines.behavioralIntegrity,
    learningVelocity: result.weights.cutlines.learningVelocity,
    overallMinimum: result.weights.cutlines.overallMinimum,
  });
  // PRO-89 PR#1: single-level undo. Snapshots BOTH weights + cutlines on
  // each commit so "undo my last change" works regardless of which
  // section the user edited last. Restoring nulls the snapshot so undo
  // disables until the next change. PRO-88's deferred-commit pattern on
  // weight sliders means this captures pre-drag state once per gesture,
  // not per pixel; cutline sliders may fire onChange per pixel during
  // drag (they don't yet use the deferred pattern), so undo on cutlines
  // restores to the most recent pre-change state — typically one click
  // step before the user noticed. Acceptable trade-off; can be tightened
  // later by porting PRO-88's deferred pattern to CutlineControls if
  // design partners flag it.
  const [previousState, setPreviousState] = useState<{
    weights: Record<string, number>;
    cutlines: Cutlines;
  } | null>(null);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedRoleId, setSavedRoleId] = useState<string | null>(null);

  const total = Object.values(weights).reduce((s, v) => s + v, 0);
  const isValid = name.trim().length > 0 && Math.abs(total - 100) <= 1;

  // PRO-89 PR#1: each handler snapshots BOTH weights + cutlines before
  // applying its change, so a single Undo restores whichever section
  // was last edited. Both WeightVisualizer (PRO-88) and CutlineControls
  // (PRO-89 PR#1) use deferred-commit on their sliders — onChange fires
  // once per gesture on release, not per drag pixel — so undo always
  // restores to true pre-drag state regardless of which section the
  // user edited last.
  const handleWeightChange = useCallback((next: Record<string, number>) => {
    setPreviousState({ weights, cutlines });
    setWeights(next);
  }, [weights, cutlines]);

  const handleCutlineChange = useCallback((next: Cutlines) => {
    setPreviousState({ weights, cutlines });
    setCutlines(next);
  }, [weights, cutlines]);

  // PRO-89 PR#1: restore both snapshots and disable undo. Single-level
  // by AC — no stack. Repeating undo without an intervening change is
  // a no-op (button is disabled in that state).
  const handleUndo = useCallback(() => {
    if (previousState) {
      setWeights(previousState.weights);
      setCutlines(previousState.cutlines);
      setPreviousState(null);
    }
  }, [previousState]);

  const canUndo = previousState !== null;

  const handleSave = useCallback(async () => {
    if (!isValid) return;
    setSaving(true);
    setSaveError(null);

    try {
      const res = await fetch(saveEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || undefined,
          sourceType: result.pipelineMetadata.sourceType,
          complexityLevel: result.weights.complexityLevel,
          onetCodes: result.onetMatches.slice(0, 3).map((m) => m.occupation.soc),
          jobDescriptionText: undefined,
          weights,
          cutlines,
          researchRationale: result.rationale,
          confidenceScores: result.weights.confidenceScores,
          hiringIntelligence: result.hiringIntelligence,
          jdContext: result.extracted,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setSaveError(data.error ?? "Failed to save role");
        setSaving(false);
        return;
      }

      const { role } = await res.json();
      setSavedRoleId(role.id);

      // Clear session storage and redirect
      sessionStorage.removeItem("roleBuilderResult");
      router.push(redirectPath(role.slug));
    } catch {
      setSaveError("Network error. Please try again.");
      setSaving(false);
    }
  }, [isValid, name, description, weights, cutlines, result, router, saveEndpoint, redirectPath]);

  const outsideScope = result.pipelineMetadata.warnings.some((w) =>
    w.toLowerCase().includes("scope") || w.toLowerCase().includes("manufactur")
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Main content */}
      <div className="max-w-4xl mx-auto px-6 py-6 space-y-5 pb-28">
        {/* Header */}
        <div>
          <h1 className="text-xl font-bold text-foreground" style={{ fontFamily: "var(--font-dm-sans)" }}>
            Review Role Profile
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Review and adjust the AI-generated weights before saving.{" "}
            {result.pipelineMetadata.durationMs > 0 && (
              <span>Generated in {(result.pipelineMetadata.durationMs / 1000).toFixed(1)}s.</span>
            )}
          </p>
        </div>

        {/* Outside scope warning */}
        {outsideScope && (
          <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 text-amber-700 text-xs px-4 py-3 rounded-sm">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold">Heads up: </span>
              This role may be outside ACI&apos;s optimized manufacturing/engineering scope. Weights were still
              generated but may require more manual adjustment.
              {result.pipelineMetadata.warnings.length > 0 && (
                <p className="mt-1 text-amber-600">{result.pipelineMetadata.warnings[0]}</p>
              )}
            </div>
          </div>
        )}

        {/* Section A — Role Summary */}
        <section>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">A. Role Identity</p>
          <RoleSummaryCard
            name={name}
            description={description}
            complexityLevel={result.weights.complexityLevel}
            closestTemplate={result.weights.closestTemplate}
            onetCodes={result.onetMatches.slice(0, 3).map((m) => m.occupation.soc)}
            outsideScope={outsideScope}
            onNameChange={setName}
            onDescriptionChange={setDescription}
          />
        </section>

        {/* Section B — Construct Weights */}
        <section>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">B. Construct Weights</p>
          <WeightExplainer />
          <div className="bg-card border border-border p-4">
            <WeightVisualizer
              weights={weights}
              recommendations={result.weights.weights}
              onChange={handleWeightChange}
              // PRO-89 PR#1: surface AI rationale + confidence per construct.
              // Both already generated by the pipeline (GeneratedWeights in
              // pipeline.ts:47-48); previously unused on this surface.
              evidence={result.weights.weightEvidence}
              confidenceScores={result.weights.confidenceScores}
            />
          </div>
        </section>

        {/* Section C — Cutlines */}
        <section>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">C. Cutline Thresholds</p>
          <CutlineExplainer />
          <div className="bg-card border border-border p-4">
            <CutlineControls
              cutlines={cutlines}
              recommendations={{
                technicalAptitude: result.weights.cutlines.technicalAptitude,
                behavioralIntegrity: result.weights.cutlines.behavioralIntegrity,
                learningVelocity: result.weights.cutlines.learningVelocity,
              }}
              onChange={handleCutlineChange}
            />
          </div>
        </section>

        {/* Section D — Hiring Intelligence */}
        <section>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">D. Hiring Intelligence</p>
          <HiringIntelligenceBrief intelligence={result.hiringIntelligence} />
        </section>

        {/* Section E — Research Rationale */}
        <section>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">E. Research Rationale</p>
          <ResearchRationalePanel
            rationale={result.rationale}
            savedRoleId={savedRoleId ?? undefined}
          />
        </section>
      </div>

      {/* Sticky bottom action bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border px-6 py-3 flex items-center justify-between z-50">
        <div className="flex items-center gap-3">
          {!isValid && total !== 0 && (
            <div className="flex items-center gap-1.5 text-xs text-aci-red">
              <AlertTriangle className="w-3.5 h-3.5" />
              {Math.abs(total - 100) > 1
                ? `Weights sum to ${total}% (must be 100%)`
                : "Role name is required"}
            </div>
          )}
          {saveError && (
            <div className="flex items-center gap-1.5 text-xs text-aci-red">
              <AlertTriangle className="w-3.5 h-3.5" />
              {saveError}
            </div>
          )}
          {savedRoleId && (
            <div className="flex items-center gap-1.5 text-xs text-aci-green">
              <CheckCircle className="w-3.5 h-3.5" />
              Role saved — redirecting…
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* PRO-89 PR#1: single-level undo. Disabled when nothing has
              changed since load OR since the last undo. Sits next to
              Cancel since both revert state, but Undo is local (last
              change only) while Cancel discards all edits. */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleUndo}
            disabled={!canUndo || saving}
            className="gap-1"
          >
            <Undo2 className="w-3.5 h-3.5" />
            Undo
          </Button>
          <Button variant="ghost" size="sm" onClick={() => router.push("/roles")} disabled={saving}>
            Cancel
          </Button>
          <Button
            variant="gold"
            size="sm"
            onClick={handleSave}
            disabled={saving || !isValid}
            className="min-w-[120px]"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving…
              </>
            ) : (
              "Save Role"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Loader2, AlertTriangle, CheckCircle } from "lucide-react";
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
}

export function ReviewClient({ result }: ReviewClientProps) {
  const router = useRouter();

  const [name, setName] = useState(result.extracted.title || "New Role");
  const [description, setDescription] = useState(result.extracted.description || "");
  const [weights, setWeights] = useState<Record<string, number>>({ ...result.weights.weights });
  const [cutlines, setCutlines] = useState<{
    technicalAptitude: number;
    behavioralIntegrity: number;
    learningVelocity: number;
    overallMinimum?: number;
  }>({
    technicalAptitude: result.weights.cutlines.technicalAptitude,
    behavioralIntegrity: result.weights.cutlines.behavioralIntegrity,
    learningVelocity: result.weights.cutlines.learningVelocity,
    overallMinimum: result.weights.cutlines.overallMinimum,
  });

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedRoleId, setSavedRoleId] = useState<string | null>(null);

  const total = Object.values(weights).reduce((s, v) => s + v, 0);
  const isValid = name.trim().length > 0 && Math.abs(total - 100) <= 1;

  const handleSave = useCallback(async () => {
    if (!isValid) return;
    setSaving(true);
    setSaveError(null);

    try {
      const res = await fetch("/api/roles", {
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
      router.push(`/roles/${role.slug}`);
    } catch {
      setSaveError("Network error. Please try again.");
      setSaving(false);
    }
  }, [isValid, name, description, weights, cutlines, result, router]);

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
              onChange={setWeights}
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
              onChange={setCutlines}
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

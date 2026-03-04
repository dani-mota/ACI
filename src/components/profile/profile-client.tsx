"use client";

import { useMemo, useState, useRef, useEffect, useCallback } from "react";
import { IdentityCard } from "./identity-card";
import { DecisionSummary } from "./decision-summary";
import { SpiderChart } from "./spider-chart";
import { IntelligenceReport } from "./intelligence-report";
import { LayerResults } from "./layer-results";
import { PredictionsGrid } from "./predictions-grid";
import { NotesPanel } from "./notes-panel";
import { RoleSwitcher } from "./role-switcher";
import { InterviewGuide } from "./interview-guide";
import { RoleMismatch } from "./role-mismatch";
import { CONSTRUCTS, LAYER_INFO, type LayerType } from "@/lib/constructs";
import { AlertTriangle, TrendingUp, TrendingDown, Shield, FileDown, FileText, ClipboardList } from "lucide-react";
import { RecordOutcomeForm } from "./record-outcome-form";
import { RoleFitRankings } from "./role-fit-rankings";

const OUTCOME_ROLES = ["RECRUITING_MANAGER", "TA_LEADER", "ADMIN"];

interface ProfileClientProps {
  candidate: any;
  allRoles: any[];
  cutlines: any[];
  userRole?: string;
}

function generateExecutiveSummary(
  candidate: any,
  compositeScore: any,
  roleName: string,
  subtestResults: any[],
  predictions: any,
  redFlags: any[],
) {
  const firstName = candidate.firstName;
  const percentile = compositeScore?.percentile ?? 0;
  const passed = compositeScore?.passed ?? false;
  const distance = Math.abs(compositeScore?.distanceFromCutline ?? 0);

  // Identify top 3 strengths and bottom 2 development areas
  const sorted = [...subtestResults].sort((a, b) => b.percentile - a.percentile);
  const strengths = sorted.slice(0, 3).map((r) => ({
    name: CONSTRUCTS[r.construct as keyof typeof CONSTRUCTS]?.name ?? r.construct,
    abbr: CONSTRUCTS[r.construct as keyof typeof CONSTRUCTS]?.abbreviation ?? r.construct,
    percentile: r.percentile,
    layer: CONSTRUCTS[r.construct as keyof typeof CONSTRUCTS]?.layer as LayerType,
  }));
  const devAreas = sorted.slice(-2).map((r) => ({
    name: CONSTRUCTS[r.construct as keyof typeof CONSTRUCTS]?.name ?? r.construct,
    abbr: CONSTRUCTS[r.construct as keyof typeof CONSTRUCTS]?.abbreviation ?? r.construct,
    percentile: r.percentile,
    layer: CONSTRUCTS[r.construct as keyof typeof CONSTRUCTS]?.layer as LayerType,
  }));

  // Layer averages
  const layers = (["COGNITIVE_CORE", "TECHNICAL_APTITUDE", "BEHAVIORAL_INTEGRITY"] as LayerType[]).map((layer) => {
    const layerResults = subtestResults.filter((r) => r.layer === layer);
    const avg = layerResults.length > 0
      ? Math.round(layerResults.reduce((s, r) => s + r.percentile, 0) / layerResults.length)
      : 0;
    return { layer, name: LAYER_INFO[layer].name, color: LAYER_INFO[layer].color, avg };
  });

  // Overall narrative
  let overviewNarrative: string;
  if (percentile >= 85) {
    overviewNarrative = `${firstName} is an exceptional candidate for the ${roleName} role, scoring at the ${percentile}th percentile overall. This places them in the top tier of assessed candidates — the kind of hire that elevates team capability. Their strongest dimensions are ${strengths[0].name} (${strengths[0].percentile}th) and ${strengths[1].name} (${strengths[1].percentile}th), indicating both the cognitive foundation and practical aptitude for immediate high-level contribution. Recommend fast-tracking through the interview process.`;
  } else if (percentile >= 65) {
    overviewNarrative = `${firstName} presents a solid profile for the ${roleName} role at the ${percentile}th percentile composite. They demonstrate clear strengths in ${strengths[0].name} (${strengths[0].percentile}th) and ${strengths[1].name} (${strengths[1].percentile}th), which align well with role demands. ${devAreas[0].percentile < 40 ? `Development area in ${devAreas[0].name} (${devAreas[0].percentile}th) warrants attention during onboarding — assess whether this construct is critical for the specific position or can be compensated through team structure.` : "No significant gaps were identified that would impede standard onboarding."} Overall, this is a candidate worth advancing with standard due diligence.`;
  } else if (percentile >= 45) {
    overviewNarrative = `${firstName} shows a mixed profile for the ${roleName} role at the ${percentile}th percentile composite. While ${strengths[0].name} (${strengths[0].percentile}th) is a relative strength, the overall assessment suggests they may require above-average support during onboarding and extended ramp time. Key development areas in ${devAreas.map((d) => `${d.name} (${d.percentile}th)`).join(" and ")} should be weighed against role requirements. The hiring decision should consider whether these gaps are trainable and whether the team can provide adequate support during the ramp period.`;
  } else {
    overviewNarrative = `${firstName} scored at the ${percentile}th percentile for the ${roleName} role, which falls below the typical hiring threshold. The assessment revealed limitations in ${devAreas.map((d) => `${d.name} (${d.percentile}th)`).join(" and ")}, which are likely to impact job performance without significant intervention. ${strengths[0].percentile >= 60 ? `Their relative strength in ${strengths[0].name} (${strengths[0].percentile}th) may be valuable in specialized contexts, but the overall profile does not support advancement for this role.` : "No standout strengths were identified to compensate for the development areas."} If advancing, budget for extended onboarding and close supervision.`;
  }

  // Key insight
  let keyInsight: string;
  const cogAvg = layers.find((l) => l.layer === "COGNITIVE_CORE")!.avg;
  const techAvg = layers.find((l) => l.layer === "TECHNICAL_APTITUDE")!.avg;
  const behAvg = layers.find((l) => l.layer === "BEHAVIORAL_INTEGRITY")!.avg;

  if (cogAvg >= 70 && techAvg >= 70 && behAvg >= 70) {
    keyInsight = "Rare balanced excellence across all three assessment layers. This candidate has the cognitive foundation to learn fast, the technical aptitude to apply knowledge practically, and the behavioral integrity to maintain standards under pressure. This is the profile associated with top-quartile performance and lowest attrition risk.";
  } else if (cogAvg >= 70 && techAvg < 50) {
    keyInsight = "Strong cognitive foundation but weaker technical application. This candidate thinks well but may not yet have the practical skills for immediate technical contribution. High potential for development — consider whether the role allows for a learning curve and whether the investment in training will yield returns.";
  } else if (techAvg >= 70 && cogAvg < 50) {
    keyInsight = "Strong practical skills but more limited cognitive flexibility. This candidate will execute well within established processes but may struggle with novel problems or significant process changes. Best suited for roles with well-defined procedures and stable operations.";
  } else if (behAvg < 40) {
    keyInsight = "Behavioral integrity scores warrant careful consideration. Lower procedural reliability and/or ethical judgment indicate elevated risk for quality escapes and compliance gaps. If advancing, implement structured oversight and clear accountability mechanisms from day one.";
  } else if (behAvg >= 75 && cogAvg < 50 && techAvg < 50) {
    keyInsight = "Exceptional behavioral foundation with developing cognitive and technical capabilities. This candidate will follow procedures reliably and make ethical decisions — qualities that are harder to train than technical skills. Consider whether the role has adequate training support to develop their technical capabilities while leveraging their integrity.";
  } else {
    keyInsight = `Profile shows the strongest performance in ${layers.sort((a, b) => b.avg - a.avg)[0].name} (avg ${layers.sort((a, b) => b.avg - a.avg)[0].avg}th percentile) with room for growth in ${layers.sort((a, b) => a.avg - b.avg)[0].name} (avg ${layers.sort((a, b) => a.avg - b.avg)[0].avg}th percentile). Hiring decision should weigh whether the strongest layer aligns with the most critical demands of the specific role.`;
  }

  return {
    overviewNarrative,
    keyInsight,
    strengths,
    devAreas,
    layers,
    percentile,
    passed,
    distance,
    rampWeeks: predictions?.estimatedRampWeeks ?? (percentile >= 70 ? "3-5" : percentile >= 50 ? "6-8" : "8-12"),
    supervisionLevel: predictions?.supervisionLevel ?? (percentile >= 70 ? "Standard" : percentile >= 50 ? "Moderate" : "Enhanced"),
    redFlagCount: redFlags?.length ?? 0,
  };
}

export function ProfileClient({ candidate, allRoles, cutlines, userRole }: ProfileClientProps) {
  const [selectedRoleSlug, setSelectedRoleSlug] = useState(candidate.primaryRole.slug);
  const [showAnimation, setShowAnimation] = useState(false);
  const previousWeightsRef = useRef<Record<string, number>>({});

  const selectedRole = allRoles.find((r: any) => r.slug === selectedRoleSlug) || allRoles[0];

  // Compute weight diffs when role changes
  const weightDiffs = useMemo(() => {
    const currentWeights: Record<string, number> = {};
    for (const w of selectedRole?.compositeWeights || []) {
      currentWeights[w.constructId] = w.weight;
    }
    const diffs: Record<string, number> = {};
    const prev = previousWeightsRef.current;
    if (Object.keys(prev).length > 0) {
      for (const key of Object.keys(currentWeights)) {
        diffs[key] = (currentWeights[key] ?? 0) - (prev[key] ?? 0);
      }
      for (const key of Object.keys(prev)) {
        if (!(key in diffs)) {
          diffs[key] = -(prev[key] ?? 0);
        }
      }
    }
    return diffs;
  }, [selectedRole]);

  const handleRoleSelect = useCallback((slug: string) => {
    // Capture current weights before switching
    const currentWeights: Record<string, number> = {};
    for (const w of selectedRole?.compositeWeights || []) {
      currentWeights[w.constructId] = w.weight;
    }
    previousWeightsRef.current = currentWeights;
    setSelectedRoleSlug(slug);
    setShowAnimation(true);
  }, [selectedRole]);

  useEffect(() => {
    if (showAnimation) {
      const timer = setTimeout(() => setShowAnimation(false), 1200);
      return () => clearTimeout(timer);
    }
  }, [showAnimation]);
  const compositeScore = candidate.assessment?.compositeScores?.find(
    (cs: any) => cs.roleSlug === selectedRoleSlug
  );
  const cutline = cutlines.find((c: any) => c.roleId === selectedRole?.id);

  const subtestResults = useMemo(
    () => candidate.assessment?.subtestResults || [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [candidate.assessment?.subtestResults]
  );
  const predictions = candidate.assessment?.predictions;
  const redFlags = useMemo(
    () => candidate.assessment?.redFlags || [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [candidate.assessment?.redFlags]
  );

  const summary = useMemo(
    () => generateExecutiveSummary(candidate, compositeScore, selectedRole?.name, subtestResults, predictions, redFlags),
    [candidate, compositeScore, selectedRole, subtestResults, predictions, redFlags]
  );

  return (
    <div className="p-6" data-tutorial="profile-header">
      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr_300px] gap-4">
        {/* Left Sidebar */}
        <div className="space-y-3">
          <IdentityCard candidate={candidate} />
          <DecisionSummary
            candidate={candidate}
            compositeScore={compositeScore}
            roleName={selectedRole?.name}
          />
          {/* Quick Actions */}
          <div className="bg-card border border-border p-4" data-tutorial="profile-pdf-export">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium mb-2">Actions</p>
            <button
              onClick={() => {
                const a = document.createElement("a");
                a.href = `/api/export/pdf/${candidate.id}`;
                a.download = `${candidate.firstName}_${candidate.lastName}_Scorecard.pdf`;
                a.click();
              }}
              className="flex items-center gap-2 w-full px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-aci-gold border border-aci-gold/30 hover:bg-aci-gold/10 transition-colors"
            >
              <FileDown className="w-3.5 h-3.5" />
              Export PDF Scorecard
            </button>
            <button
              onClick={() => {
                const a = document.createElement("a");
                a.href = `/api/export/pdf/${candidate.id}/one-pager`;
                a.download = `${candidate.firstName}_${candidate.lastName}_OnePager.pdf`;
                a.click();
              }}
              className="flex items-center gap-2 w-full px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-aci-gold border border-aci-gold/30 hover:bg-aci-gold/10 transition-colors mt-2"
            >
              <FileText className="w-3.5 h-3.5" />
              HM One-Pager
            </button>
            <button
              onClick={() => {
                const a = document.createElement("a");
                a.href = `/api/export/pdf/${candidate.id}/interview-kit`;
                a.download = `${candidate.firstName}_${candidate.lastName}_InterviewKit.pdf`;
                a.click();
              }}
              className="flex items-center gap-2 w-full px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-aci-gold border border-aci-gold/30 hover:bg-aci-gold/10 transition-colors mt-2"
            >
              <ClipboardList className="w-3.5 h-3.5" />
              Interview Kit PDF
            </button>
          </div>
        </div>

        {/* Center Column */}
        <div className="space-y-4 min-w-0">
          {/* Executive Summary */}
          <div className="bg-card border border-border p-5">
            <h2 className="text-sm font-semibold text-foreground mb-3 uppercase tracking-wider" style={{ fontFamily: "var(--font-dm-sans)" }}>
              Executive Summary
            </h2>

            {/* Composite score + status */}
            <div className="flex items-center gap-4 mb-4 pb-4 border-b border-border">
              <div className="text-center">
                <p className="text-3xl font-bold font-mono text-foreground">{summary.percentile}</p>
                <p className="text-[9px] text-muted-foreground uppercase tracking-wider font-medium">Composite</p>
              </div>
              <div className="flex-1">
                <p className={`text-xs font-semibold uppercase tracking-wider ${summary.passed ? "text-aci-green" : "text-aci-amber"}`}>
                  {summary.passed ? "Meets Cutline Thresholds" : `${summary.distance} Points from Cutline`}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  for {selectedRole?.name}
                </p>
              </div>
              {summary.redFlagCount > 0 && (
                <div className="flex items-center gap-1.5 px-2 py-1 bg-aci-red/5 border border-aci-red/20">
                  <AlertTriangle className="w-3.5 h-3.5 text-aci-red" />
                  <span className="text-[10px] font-mono font-medium text-aci-red uppercase">
                    {summary.redFlagCount} Flag{summary.redFlagCount > 1 ? "s" : ""}
                  </span>
                </div>
              )}
            </div>

            {/* Overview narrative */}
            <p className="text-xs text-muted-foreground leading-relaxed mb-4">
              {summary.overviewNarrative}
            </p>

            {/* Layer averages */}
            <div className="grid grid-cols-3 gap-2 mb-4">
              {summary.layers.map((l) => (
                <div key={l.layer} className="p-2 bg-accent/30 border border-border text-center">
                  <div className="flex items-center justify-center gap-1.5 mb-1">
                    <div className="w-2 h-2" style={{ backgroundColor: l.color }} />
                    <p className="text-[9px] text-muted-foreground uppercase tracking-wider font-medium">{l.name}</p>
                  </div>
                  <p className="text-lg font-bold font-mono" style={{ color: l.color }}>{l.avg}</p>
                </div>
              ))}
            </div>

            {/* Strengths + Dev areas side by side */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
              <div className="p-3 bg-accent/30 border border-border">
                <div className="flex items-center gap-1.5 mb-2">
                  <TrendingUp className="w-3.5 h-3.5 text-aci-green" />
                  <p className="text-[9px] text-aci-green uppercase tracking-wider font-semibold">Top Strengths</p>
                </div>
                <div className="space-y-1.5">
                  {summary.strengths.map((s) => (
                    <div key={s.abbr} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono font-semibold w-5" style={{ color: LAYER_INFO[s.layer].color }}>{s.abbr}</span>
                        <span className="text-[11px] text-foreground">{s.name}</span>
                      </div>
                      <span className="text-[11px] font-mono font-semibold" style={{ color: LAYER_INFO[s.layer].color }}>{s.percentile}th</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="p-3 bg-accent/30 border border-border">
                <div className="flex items-center gap-1.5 mb-2">
                  <TrendingDown className="w-3.5 h-3.5 text-aci-amber" />
                  <p className="text-[9px] text-aci-amber uppercase tracking-wider font-semibold">Development Areas</p>
                </div>
                <div className="space-y-1.5">
                  {summary.devAreas.map((d) => (
                    <div key={d.abbr} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono font-semibold w-5" style={{ color: LAYER_INFO[d.layer].color }}>{d.abbr}</span>
                        <span className="text-[11px] text-foreground">{d.name}</span>
                      </div>
                      <span className="text-[11px] font-mono font-semibold" style={{ color: LAYER_INFO[d.layer].color }}>{d.percentile}th</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Key insight */}
            <div className="p-3 bg-accent/30 border border-border">
              <div className="flex items-center gap-1.5 mb-1.5">
                <Shield className="w-3.5 h-3.5 text-aci-gold" />
                <p className="text-[9px] text-aci-gold uppercase tracking-wider font-semibold">Key Insight</p>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">{summary.keyInsight}</p>
            </div>
          </div>

          <div data-tutorial="profile-spider-chart">
            <SpiderChart
              subtestResults={subtestResults}
              roleWeights={selectedRole?.compositeWeights || []}
              cutline={cutline}
              roleSlug={selectedRoleSlug}
              weightDiffs={weightDiffs}
              showAnimation={showAnimation}
            />
          </div>

          <IntelligenceReport
            subtestResults={subtestResults}
            roleName={selectedRole?.name}
          />

          <LayerResults
            subtestResults={subtestResults}
            aiInteractions={candidate.assessment?.aiInteractions || []}
            roleSlug={selectedRoleSlug}
          />

          <PredictionsGrid prediction={predictions} />

          {userRole && OUTCOME_ROLES.includes(userRole) && candidate.status === "RECOMMENDED" && (
            <RecordOutcomeForm
              candidateId={candidate.id}
              existingOutcomes={candidate.outcomes || []}
            />
          )}

          <NotesPanel notes={candidate.notes || []} candidateId={candidate.id} />
        </div>

        {/* Right Sidebar */}
        <div className="space-y-3">
          <RoleSwitcher
            roles={allRoles}
            selectedSlug={selectedRoleSlug}
            onSelect={handleRoleSelect}
            compositeScores={candidate.assessment?.compositeScores || []}
          />
          {candidate.primaryRole?.isGeneric && (
            <RoleFitRankings
              compositeScores={candidate.assessment?.compositeScores || []}
              roles={allRoles}
            />
          )}
          <RoleMismatch
            compositeScores={candidate.assessment?.compositeScores || []}
            primaryRoleSlug={candidate.primaryRole.slug}
            candidateStatus={candidate.status}
            roles={allRoles}
            onSelect={handleRoleSelect}
          />
          <InterviewGuide
            subtestResults={subtestResults}
            redFlags={redFlags}
          />
        </div>
      </div>
    </div>
  );
}

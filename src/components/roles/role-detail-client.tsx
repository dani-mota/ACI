"use client";

import { useMemo } from "react";
import { CONSTRUCTS, LAYER_INFO, type LayerType } from "@/lib/constructs";
import { calculateComposite, evaluateCutline, determineStatus, getCutlineFailures } from "@/lib/scoring";
import { useContext } from "react";
import { AuthContext } from "@/components/auth-provider";
import { RoleTabSelector } from "./role-tab-selector";
import { RoleHeader } from "./role-header";
import { ConstructImportance } from "./construct-importance";
import { CutlineThresholds } from "./cutline-thresholds";
import { CandidateRoster } from "./candidate-roster";

interface RoleDetailClientProps {
  role: any;
  allRoles: any[];
  candidates: any[];
}

export function RoleDetailClient({ role, allRoles, candidates }: RoleDetailClientProps) {
  const auth = useContext(AuthContext);
  const canCreateRole = auth ? ["TA_LEADER", "ADMIN"].includes(auth.user.role) : false;

  const processed = useMemo(() => {
    const cutline = role.cutlines?.[0] ?? null;
    const weights = role.compositeWeights || [];

    // Sort weights by weight descending, assign global rank
    const sortedWeights = [...weights].sort((a: any, b: any) => b.weight - a.weight);
    const constructRanking = sortedWeights.map((w: any, i: number) => ({
      constructId: w.constructId,
      weight: w.weight,
      rank: i + 1,
      isCritical: i < 3,
    }));

    // Top 3 weighted constructs for candidate score display
    const top3WeightedIds = sortedWeights.slice(0, 3).map((w: any) => w.constructId);

    // Process candidates
    const recommended: any[] = [];
    const reviewRequired: any[] = [];
    const doNotAdvance: any[] = [];
    let totalAssessed = 0;
    let compositeSum = 0;

    for (const candidate of candidates) {
      const assessment = candidate.assessment;
      if (!assessment?.subtestResults?.length) continue;

      const subtestResults = assessment.subtestResults;
      const compositeScore = assessment.compositeScores?.find(
        (cs: any) => cs.roleSlug === role.slug
      );
      if (!compositeScore) continue;

      totalAssessed++;
      compositeSum += compositeScore.percentile;

      const redFlags = assessment.redFlags || [];
      const status = determineStatus(compositeScore.passed, compositeScore.distanceFromCutline, redFlags);

      // Top 3 weighted construct scores for this candidate
      const topConstructScores = top3WeightedIds.map((id: string) => {
        const result = subtestResults.find((r: any) => r.construct === id);
        const meta = CONSTRUCTS[id as keyof typeof CONSTRUCTS];
        return {
          constructId: id,
          abbreviation: meta?.abbreviation ?? id,
          percentile: result?.percentile ?? 0,
          layerColor: meta ? LAYER_INFO[meta.layer as LayerType].color : "#94a3b8",
        };
      });

      // Cutline failures
      const failedDimensions = cutline
        ? getCutlineFailures(subtestResults, cutline)
        : [];

      const processedCandidate = {
        id: candidate.id,
        firstName: candidate.firstName,
        lastName: candidate.lastName,
        compositePercentile: compositeScore.percentile,
        status,
        distanceFromCutline: compositeScore.distanceFromCutline,
        topConstructScores,
        failedDimensions,
        redFlags: redFlags.map((f: any) => ({ severity: f.severity, title: f.title })),
      };

      if (status === "RECOMMENDED") recommended.push(processedCandidate);
      else if (status === "REVIEW_REQUIRED") reviewRequired.push(processedCandidate);
      else doNotAdvance.push(processedCandidate);
    }

    // Sort each group
    recommended.sort((a: any, b: any) => b.compositePercentile - a.compositePercentile);
    reviewRequired.sort((a: any, b: any) => b.distanceFromCutline - a.distanceFromCutline);
    doNotAdvance.sort((a: any, b: any) => b.compositePercentile - a.compositePercentile);

    const stats = {
      totalAssessed,
      recommendedCount: recommended.length,
      strongFitPct: totalAssessed > 0 ? Math.round((recommended.length / totalAssessed) * 100) : 0,
      avgComposite: totalAssessed > 0 ? Math.round(compositeSum / totalAssessed) : 0,
      reviewCount: reviewRequired.length,
    };

    return { constructRanking, cutline, stats, recommended, reviewRequired, doNotAdvance };
  }, [role, candidates]);

  return (
    <div className="p-6 space-y-4">
      <RoleTabSelector roles={allRoles} currentSlug={role.slug} canCreateRole={canCreateRole} />

      <RoleHeader role={role} stats={processed.stats} />

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-4">
        <ConstructImportance constructs={processed.constructRanking} roleSlug={role.slug} />
        <CutlineThresholds cutline={processed.cutline} />
      </div>

      <CandidateRoster
        title="Recommended"
        subtitle="Passed all cutline thresholds"
        candidates={processed.recommended}
        variant="recommended"
      />

      <CandidateRoster
        title="Needs Review"
        subtitle="Near cutline or flagged for review"
        candidates={processed.reviewRequired}
        variant="review"
      />

      <CandidateRoster
        title="Not Recommended"
        subtitle="Below cutline thresholds"
        candidates={processed.doNotAdvance}
        variant="doNotAdvance"
      />
    </div>
  );
}

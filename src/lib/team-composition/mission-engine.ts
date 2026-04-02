// ──────────────────────────────────────────────
// Mission Planner — Computation Engine
// ──────────────────────────────────────────────

import {
  type ConstructId,
  type IndividualProfile,
  type Mission,
  type MissionPhase,
  type PhaseCoverage,
  type MissionCoverage,
  type TalentRecommendation,
  type StressScenario,
  type StressTestResult,
  type CognitiveDemand,
  CONSTRUCT_IDS,
  DEMAND_THRESHOLDS,
  STRESS_SCENARIOS,
} from "./types";

// ──────────────────────────────────────────────
// Phase Coverage
// ──────────────────────────────────────────────

function computePhaseCoverage(
  phase: MissionPhase,
  team: IndividualProfile[]
): PhaseCoverage {
  const constructCoverage = {} as PhaseCoverage["constructCoverage"];
  const gaps: ConstructId[] = [];

  let demandsAboveLow = 0;
  let metCount = 0;

  for (const cid of CONSTRUCT_IDS) {
    const demand = phase.demands[cid];
    const threshold = DEMAND_THRESHOLDS[demand];
    const membersAbove = team.filter((m) => m.scores[cid] >= threshold);
    const bestMember = team.reduce<{ id: string | null; score: number }>(
      (best, m) => (m.scores[cid] > best.score ? { id: m.id, score: m.scores[cid] } : best),
      { id: null, score: 0 }
    );

    const met = demand === "low" || membersAbove.length > 0;

    constructCoverage[cid] = {
      demand,
      threshold,
      met,
      depth: membersAbove.length,
      bestScore: bestMember.score,
      bestMemberId: bestMember.id,
    };

    if (demand !== "low") {
      demandsAboveLow++;
      if (met) metCount++;
      else gaps.push(cid);
    }
  }

  return {
    phaseId: phase.id,
    phaseName: phase.name,
    constructCoverage,
    overallCoverage: demandsAboveLow > 0 ? Math.round((metCount / demandsAboveLow) * 100) / 100 : 1,
    gaps,
  };
}

// ──────────────────────────────────────────────
// Mission Coverage (all phases)
// ──────────────────────────────────────────────

export function computeMissionCoverage(
  mission: Mission,
  team: IndividualProfile[]
): MissionCoverage {
  const phases = mission.phases.map((p) => computePhaseCoverage(p, team));
  const avgCoverage = phases.length > 0
    ? Math.round((phases.reduce((s, p) => s + p.overallCoverage, 0) / phases.length) * 100) / 100
    : 0;

  const weakest = phases.reduce<{ phaseId: string; coverage: number } | null>(
    (w, p) => (!w || p.overallCoverage < w.coverage ? { phaseId: p.phaseId, coverage: p.overallCoverage } : w),
    null
  );

  return { missionId: mission.id, phases, averageCoverage: avgCoverage, weakestPhase: weakest };
}

// ──────────────────────────────────────────────
// Talent Ranking for Mission
// ──────────────────────────────────────────────

export function rankTalentForMission(
  mission: Mission,
  currentTeam: IndividualProfile[],
  pool: IndividualProfile[]
): TalentRecommendation[] {
  const baseline = computeMissionCoverage(mission, currentTeam);

  return pool
    .filter((p) => !currentTeam.some((m) => m.id === p.id))
    .map((candidate) => {
      const withCandidate = [...currentTeam, candidate];
      const newCoverage = computeMissionCoverage(mission, withCandidate);

      // What gaps does this candidate fill?
      const coversFills: TalentRecommendation["coversFills"] = [];
      const weaknesses: TalentRecommendation["weaknesses"] = [];
      const phaseImpacts: Record<string, number> = {};

      for (let i = 0; i < mission.phases.length; i++) {
        const phase = mission.phases[i];
        const oldPhase = baseline.phases[i];
        const newPhase = newCoverage.phases[i];
        phaseImpacts[phase.id] = newPhase.overallCoverage - oldPhase.overallCoverage;

        // Gaps that are now filled
        for (const gap of oldPhase.gaps) {
          if (!newPhase.gaps.includes(gap)) {
            coversFills.push({ phaseId: phase.id, construct: gap });
          }
        }

        // Weaknesses: constructs where this person is below threshold for non-low demands
        for (const cid of CONSTRUCT_IDS) {
          const demand = phase.demands[cid];
          if (demand === "low") continue;
          const threshold = DEMAND_THRESHOLDS[demand];
          if (candidate.scores[cid] < threshold && demand === "critical") {
            weaknesses.push({
              phaseId: phase.id,
              construct: cid,
              score: candidate.scores[cid],
              needed: threshold,
            });
          }
        }
      }

      // Which phases benefit most
      const strongestPhases = Object.entries(phaseImpacts)
        .filter(([, d]) => d > 0)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([id]) => id);

      return {
        profileId: candidate.id,
        coversFills,
        coverageDelta: Math.round((newCoverage.averageCoverage - baseline.averageCoverage) * 100) / 100,
        strongestPhases,
        weaknesses,
      };
    })
    .sort((a, b) => {
      // Primary: coverage delta
      if (b.coverageDelta !== a.coverageDelta) return b.coverageDelta - a.coverageDelta;
      // Secondary: number of gaps filled
      return b.coversFills.length - a.coversFills.length;
    });
}

// ──────────────────────────────────────────────
// Stress Testing
// ──────────────────────────────────────────────

function riskLevel(delta: number): StressTestResult["riskLevel"] {
  if (delta > -0.05) return "low";
  if (delta > -0.15) return "moderate";
  if (delta > -0.30) return "high";
  return "critical";
}

/** Stress test: remove each member one at a time, report the worst case */
function stressKeyPersonLeaves(
  mission: Mission,
  team: IndividualProfile[]
): StressTestResult {
  const baseline = computeMissionCoverage(mission, team);
  const scenario = STRESS_SCENARIOS[0];

  if (team.length === 0) {
    return {
      scenario,
      baselineCoverage: 0,
      stressedCoverage: 0,
      delta: 0,
      phaseImpacts: [],
      findings: ["No team members to test."],
      riskLevel: "low",
    };
  }

  // Test removing each member
  let worstDelta = 0;
  let worstMember: IndividualProfile | null = null;
  let worstCoverage: MissionCoverage | null = null;

  for (const member of team) {
    const reduced = team.filter((m) => m.id !== member.id);
    const cov = computeMissionCoverage(mission, reduced);
    const delta = cov.averageCoverage - baseline.averageCoverage;
    if (delta < worstDelta) {
      worstDelta = delta;
      worstMember = member;
      worstCoverage = cov;
    }
  }

  if (!worstMember || !worstCoverage) {
    return {
      scenario,
      baselineCoverage: baseline.averageCoverage,
      stressedCoverage: baseline.averageCoverage,
      delta: 0,
      phaseImpacts: [],
      findings: ["Team is resilient — no single removal significantly degrades coverage."],
      riskLevel: "low",
    };
  }

  const phaseImpacts = mission.phases.map((phase, i) => {
    const oldPhase = baseline.phases[i];
    const newPhase = worstCoverage!.phases[i];
    const newGaps = newPhase.gaps.filter((g) => !oldPhase.gaps.includes(g));
    return {
      phaseId: phase.id,
      phaseName: phase.name,
      baselineCoverage: oldPhase.overallCoverage,
      stressedCoverage: newPhase.overallCoverage,
      newGaps,
    };
  });

  const findings: string[] = [
    `Most critical member: ${worstMember.name} (${worstMember.role}).`,
    `Removing them drops average coverage from ${(baseline.averageCoverage * 100).toFixed(0)}% to ${(worstCoverage.averageCoverage * 100).toFixed(0)}%.`,
  ];

  const hardHitPhases = phaseImpacts.filter((p) => p.newGaps.length > 0);
  if (hardHitPhases.length > 0) {
    findings.push(
      `Phases impacted: ${hardHitPhases.map((p) => `${p.phaseName} (+${p.newGaps.length} new gaps)`).join(", ")}.`
    );
  }

  return {
    scenario,
    baselineCoverage: baseline.averageCoverage,
    stressedCoverage: worstCoverage.averageCoverage,
    delta: Math.round(worstDelta * 100) / 100,
    phaseImpacts,
    findings,
    riskLevel: riskLevel(worstDelta),
  };
}

/** Stress test: merge adjacent phases (simulate overlap) */
function stressTimelineCompression(
  mission: Mission,
  team: IndividualProfile[]
): StressTestResult {
  const baseline = computeMissionCoverage(mission, team);
  const scenario = STRESS_SCENARIOS[1];

  if (mission.phases.length < 2) {
    return {
      scenario,
      baselineCoverage: baseline.averageCoverage,
      stressedCoverage: baseline.averageCoverage,
      delta: 0,
      phaseImpacts: [],
      findings: ["Only one phase — timeline compression not applicable."],
      riskLevel: "low",
    };
  }

  // Merge each adjacent pair, take the higher demand level for each construct
  const demandRank: Record<CognitiveDemand, number> = { critical: 3, high: 2, moderate: 1, low: 0 };
  const rankToDemand: CognitiveDemand[] = ["low", "moderate", "high", "critical"];

  const mergedPhases: MissionPhase[] = [];
  for (let i = 0; i < mission.phases.length - 1; i++) {
    const a = mission.phases[i];
    const b = mission.phases[i + 1];
    const merged: MissionPhase = {
      id: `${a.id}+${b.id}`,
      name: `${a.name} + ${b.name}`,
      description: `Overlapping: ${a.name} and ${b.name}`,
      startMonth: a.startMonth,
      endMonth: b.endMonth,
      demands: {} as Record<ConstructId, CognitiveDemand>,
    };
    for (const cid of CONSTRUCT_IDS) {
      const maxRank = Math.max(demandRank[a.demands[cid]], demandRank[b.demands[cid]]);
      merged.demands[cid] = rankToDemand[maxRank];
    }
    mergedPhases.push(merged);
  }

  const compressedMission: Mission = { ...mission, phases: mergedPhases };
  const stressed = computeMissionCoverage(compressedMission, team);
  const delta = Math.round((stressed.averageCoverage - baseline.averageCoverage) * 100) / 100;

  const phaseImpacts = mergedPhases.map((phase, i) => ({
    phaseId: phase.id,
    phaseName: phase.name,
    baselineCoverage: baseline.averageCoverage,
    stressedCoverage: stressed.phases[i].overallCoverage,
    newGaps: stressed.phases[i].gaps,
  }));

  const findings: string[] = [];
  const worstOverlap = phaseImpacts.reduce((w, p) => (p.stressedCoverage < (w?.stressedCoverage ?? 1) ? p : w), phaseImpacts[0]);
  if (worstOverlap) {
    findings.push(`Worst overlap: "${worstOverlap.phaseName}" at ${(worstOverlap.stressedCoverage * 100).toFixed(0)}% coverage.`);
    if (worstOverlap.newGaps.length > 0) {
      findings.push(`Uncovered demands: ${worstOverlap.newGaps.length} constructs fall below threshold when phases overlap.`);
    }
  }
  if (delta >= 0) {
    findings.push("Team can handle compressed timelines without significant coverage loss.");
  } else {
    findings.push(`Average coverage drops by ${Math.abs(delta * 100).toFixed(0)} percentage points under compression.`);
  }

  return {
    scenario,
    baselineCoverage: baseline.averageCoverage,
    stressedCoverage: stressed.averageCoverage,
    delta,
    phaseImpacts,
    findings,
    riskLevel: riskLevel(delta),
  };
}

/** Stress test: escalate all demand levels by one tier */
function stressScopeExpansion(
  mission: Mission,
  team: IndividualProfile[]
): StressTestResult {
  const baseline = computeMissionCoverage(mission, team);
  const scenario = STRESS_SCENARIOS[2];

  const escalate = (d: CognitiveDemand): CognitiveDemand => {
    if (d === "low") return "moderate";
    if (d === "moderate") return "high";
    if (d === "high") return "critical";
    return "critical";
  };

  const escalatedPhases: MissionPhase[] = mission.phases.map((p) => ({
    ...p,
    demands: Object.fromEntries(
      CONSTRUCT_IDS.map((cid) => [cid, escalate(p.demands[cid])])
    ) as Record<ConstructId, CognitiveDemand>,
  }));

  const escalatedMission: Mission = { ...mission, phases: escalatedPhases };
  const stressed = computeMissionCoverage(escalatedMission, team);
  const delta = Math.round((stressed.averageCoverage - baseline.averageCoverage) * 100) / 100;

  const phaseImpacts = mission.phases.map((phase, i) => ({
    phaseId: phase.id,
    phaseName: phase.name,
    baselineCoverage: baseline.phases[i].overallCoverage,
    stressedCoverage: stressed.phases[i].overallCoverage,
    newGaps: stressed.phases[i].gaps.filter((g) => !baseline.phases[i].gaps.includes(g)),
  }));

  const totalNewGaps = phaseImpacts.reduce((s, p) => s + p.newGaps.length, 0);
  const findings: string[] = [
    `Scope expansion creates ${totalNewGaps} new gaps across all phases.`,
    `Average coverage drops from ${(baseline.averageCoverage * 100).toFixed(0)}% to ${(stressed.averageCoverage * 100).toFixed(0)}%.`,
  ];

  if (delta > -0.10) {
    findings.push("Team has sufficient headroom to absorb moderate scope increases.");
  } else {
    findings.push("Team is operating near capacity — scope expansion would require additional talent.");
  }

  return {
    scenario,
    baselineCoverage: baseline.averageCoverage,
    stressedCoverage: stressed.averageCoverage,
    delta,
    phaseImpacts,
    findings,
    riskLevel: riskLevel(delta),
  };
}

export function runStressTest(
  scenario: StressScenario,
  mission: Mission,
  team: IndividualProfile[]
): StressTestResult {
  switch (scenario.type) {
    case "key_person_leaves":
      return stressKeyPersonLeaves(mission, team);
    case "timeline_compression":
      return stressTimelineCompression(mission, team);
    case "scope_expansion":
      return stressScopeExpansion(mission, team);
  }
}

export function runAllStressTests(
  mission: Mission,
  team: IndividualProfile[]
): StressTestResult[] {
  return STRESS_SCENARIOS.map((s) => runStressTest(s, mission, team));
}

import type { ConversationMessage } from "@/generated/prisma/client";
import type { RedFlagCheck, ConstructLayeredScore, ConsistencyResult, LayerBScore } from "../types";

/**
 * V2 Red Flag Detection: 12 checks (7 original preserved + 5 new for conversational format).
 */

interface RedFlagInput {
  constructScores: ConstructLayeredScore[];
  messages: ConversationMessage[];
  consistencyResults: ConsistencyResult[];
  layerBScores: LayerBScore[];
  totalDurationMs?: number;
}

export function detectRedFlags(input: RedFlagInput): RedFlagCheck[] {
  const checks = [
    // ── Original 7 checks (adapted for V2) ──────────────────────
    checkExtremelyLowScores(input.constructScores),
    checkBehavioralConcern(input.constructScores),
    checkSpeedAccuracyMismatch(input.constructScores),
    checkIncompleteAssessment(input.constructScores),
    checkRandomResponding(input.messages),
    checkMinimalEngagement(input.messages),
    checkOverconfidencePattern(input.constructScores),

    // ── 5 new checks for V2 ─────────────────────────────────────
    checkScenarioDisengagement(input.messages),
    checkConsistencyFailure(input.consistencyResults),
    checkCopyPasteDetection(input.messages),
    checkEscalationAvoidance(input.messages),
    checkHighVarianceEvaluation(input.layerBScores),
  ];

  return checks.filter((c) => c.triggered);
}

// ── Original checks ──────────────────────────────────────────

function checkExtremelyLowScores(scores: ConstructLayeredScore[]): RedFlagCheck {
  const low = scores.filter((s) => s.percentile < 10);
  return {
    triggered: low.length > 0,
    severity: "CRITICAL",
    category: "Extreme Low Score",
    title: "Critical performance deficit detected",
    description: `Constructs below 10th percentile: ${low.map((s) => s.construct).join(", ")}`,
    constructs: low.map((s) => s.construct as string),
  };
}

function checkBehavioralConcern(scores: ConstructLayeredScore[]): RedFlagCheck {
  const concern = scores.filter(
    (s) => s.percentile < 25 && s.layer === "BEHAVIORAL_INTEGRITY",
  );
  return {
    triggered: concern.length > 0,
    severity: "WARNING",
    category: "Behavioral Concern",
    title: "Below-threshold behavioral integrity score",
    description: `Constructs: ${concern.map((s) => s.construct).join(", ")}`,
    constructs: concern.map((s) => s.construct as string),
  };
}

function checkSpeedAccuracyMismatch(scores: ConstructLayeredScore[]): RedFlagCheck {
  // Only flag when we have actual timing data (avgResponseTimeMs > 0 excludes missing/conversational)
  const mismatch = scores.filter(
    (s) => s.percentile < 30 && s.avgResponseTimeMs > 1 && s.avgResponseTimeMs < 3000,
  );
  return {
    triggered: mismatch.length > 0,
    severity: "WARNING",
    category: "Speed-Accuracy Mismatch",
    title: "Unusually fast responses with low accuracy detected",
    description: "Candidate answered quickly on constructs where accuracy was also low.",
    constructs: mismatch.map((s) => s.construct as string),
  };
}

function checkIncompleteAssessment(scores: ConstructLayeredScore[]): RedFlagCheck {
  const noData = scores.filter((s) => s.itemCount === 0);
  return {
    triggered: noData.length > 2,
    severity: "CRITICAL",
    category: "Incomplete Assessment",
    title: "Assessment was not completed for multiple constructs",
    description: `No data for: ${noData.map((s) => s.construct).join(", ")}`,
    constructs: noData.map((s) => s.construct as string),
  };
}

function checkRandomResponding(messages: ConversationMessage[]): RedFlagCheck {
  const candidateMessages = messages.filter((m) => m.role === "CANDIDATE");
  if (candidateMessages.length === 0) {
    return { triggered: false, severity: "CRITICAL", category: "", title: "", description: "", constructs: [] };
  }

  const fastResponses = candidateMessages.filter(
    (m) => m.responseTimeMs !== null && m.responseTimeMs < 2000,
  );
  const ratio = fastResponses.length / candidateMessages.length;

  return {
    triggered: ratio > 0.3,
    severity: "CRITICAL",
    category: "Random Responding",
    title: "Potential random or disengaged responding detected",
    description: `${Math.round(ratio * 100)}% of responses were submitted in under 2 seconds.`,
    constructs: [],
  };
}

function checkMinimalEngagement(messages: ConversationMessage[]): RedFlagCheck {
  // Scope to Act 1 only — Act 3 calibration responses are intentionally short
  const candidateMessages = messages.filter(
    (m) => m.role === "CANDIDATE" && m.act === "ACT_1" && m.content && !m.candidateInput,
  );
  if (candidateMessages.length === 0) {
    return { triggered: false, severity: "WARNING", category: "", title: "", description: "", constructs: [] };
  }

  const shortResponses = candidateMessages.filter(
    (m) => m.content.trim().split(/\s+/).length < 10,
  );
  const ratio = shortResponses.length / candidateMessages.length;

  return {
    triggered: ratio > 0.5,
    severity: "WARNING",
    category: "Minimal Engagement",
    title: "Minimal engagement with open-ended questions",
    description: `More than half of conversational responses were under 10 words.`,
    constructs: [],
  };
}

function checkOverconfidencePattern(scores: ConstructLayeredScore[]): RedFlagCheck {
  // For V2, this is computed from calibration data in Act 3
  // Simplified check: look for constructs where Layer B >> Layer A (self-presentation > actual ability)
  const overconfident = scores.filter(
    (s) =>
      s.layerAScore !== null &&
      s.layerBScore !== null &&
      s.layerBScore - s.layerAScore > 0.3,
  );

  return {
    triggered: overconfident.length > 3,
    severity: "WARNING",
    category: "Overconfidence Pattern",
    title: "Systematic overconfidence across multiple constructs",
    description: `Conversational self-presentation exceeded structured test performance by >30% on ${overconfident.length} constructs.`,
    constructs: overconfident.map((s) => s.construct as string),
  };
}

// ── New V2 checks ────────────────────────────────────────────

function checkScenarioDisengagement(messages: ConversationMessage[]): RedFlagCheck {
  const act1CandidateMessages = messages.filter(
    (m) => m.role === "CANDIDATE" && m.act === "ACT_1" && m.content && !m.candidateInput,
  );
  if (act1CandidateMessages.length === 0) {
    return { triggered: false, severity: "WARNING", category: "", title: "", description: "", constructs: [] };
  }

  const avgWordCount =
    act1CandidateMessages.reduce(
      (sum, m) => sum + m.content.trim().split(/\s+/).length,
      0,
    ) / act1CandidateMessages.length;

  return {
    triggered: avgWordCount < 20,
    severity: "WARNING",
    category: "Scenario Disengagement",
    title: "Low engagement during scenario responses",
    description: `Average response length in Act 1 scenarios was ${Math.round(avgWordCount)} words (expected 30+).`,
    constructs: [],
  };
}

function checkConsistencyFailure(results: ConsistencyResult[]): RedFlagCheck {
  const failures = results.filter((r) => r.agreement === "LOW");
  return {
    triggered: failures.length >= 3,
    severity: "WARNING",
    category: "Consistency Failure",
    title: "Inconsistent performance across parallel assessments",
    description: `${failures.length} constructs showed LOW consistency between Act 1 and Act 3.`,
    constructs: failures.map((r) => r.construct as string),
  };
}

function checkCopyPasteDetection(messages: ConversationMessage[]): RedFlagCheck {
  const candidateMessages = messages
    .filter((m) => m.role === "CANDIDATE" && m.content.length > 30)
    .map((m) => m.content.trim().toLowerCase());

  // Check for identical or near-identical phrasing across responses
  let duplicateCount = 0;
  for (let i = 0; i < candidateMessages.length; i++) {
    for (let j = i + 1; j < candidateMessages.length; j++) {
      if (similarity(candidateMessages[i], candidateMessages[j]) > 0.85) {
        duplicateCount++;
      }
    }
  }

  return {
    triggered: duplicateCount >= 2,
    severity: "WARNING",
    category: "Copy-Paste Detection",
    title: "Identical phrasing detected across responses",
    description: `${duplicateCount} pairs of responses had >85% text similarity.`,
    constructs: [],
  };
}

function checkEscalationAvoidance(messages: ConversationMessage[]): RedFlagCheck {
  // Find candidate responses that follow agent messages tagged with SOCIAL_PRESSURE beatType
  const socialPressureResponses: ConversationMessage[] = [];
  for (let i = 1; i < messages.length; i++) {
    const prev = messages[i - 1];
    const curr = messages[i];
    if (
      curr.role === "CANDIDATE" &&
      curr.act === "ACT_1" &&
      prev.role === "AGENT" &&
      prev.metadata &&
      (prev.metadata as Record<string, unknown>).beatType === "SOCIAL_PRESSURE"
    ) {
      socialPressureResponses.push(curr);
    }
  }

  if (socialPressureResponses.length < 2) {
    return { triggered: false, severity: "WARNING", category: "", title: "", description: "", constructs: [] };
  }

  // Expanded heuristic: check for avoidance/compliance language patterns
  const avoidancePatterns = /\b(agree|go along|not worth|let it go|whatever|fine|okay|sure|no problem|i guess|you'?re right|probably right|i suppose|fair enough|makes sense|that works|i'?ll just|won'?t push|drop it|move on|not my place|defer|back down|comply|give in|concede|accommodate|rather not|avoid conflict|don'?t want to|path of least|keep the peace|not a big deal|i can live with)\b/i;
  const avoidanceCount = socialPressureResponses.filter((m) =>
    avoidancePatterns.test(m.content),
  ).length;

  // Trigger if >75% of pressure responses show avoidance (more practical than requiring 100%)
  const avoidanceRatio = avoidanceCount / socialPressureResponses.length;
  return {
    triggered: avoidanceRatio >= 0.75,
    severity: "WARNING",
    category: "Escalation Avoidance",
    title: "Systematic avoidance of confrontation in pressure scenarios",
    description: "Candidate consistently chose non-confrontational paths in all social pressure beats.",
    constructs: ["ETHICAL_JUDGMENT", "EXECUTIVE_CONTROL"],
  };
}

function checkHighVarianceEvaluation(layerBScores: LayerBScore[]): RedFlagCheck {
  const highVariance = layerBScores.filter((s) => s.highVarianceFlag);
  return {
    triggered: highVariance.length >= 3,
    severity: "WARNING",
    category: "AI Evaluation High Variance",
    title: "High variance in AI scoring across multiple responses",
    description: `${highVariance.length} responses had scoring variance >0.3 across triple-evaluation runs.`,
    constructs: highVariance.map((s) => s.construct as string),
  };
}

// ── Utility ──────────────────────────────────

function similarity(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length === 0 && b.length === 0) return 1;

  // Jaccard similarity on word bigram sets (deduped to prevent >1.0)
  const setA = new Set(getBigrams(a));
  const setB = new Set(getBigrams(b));

  if (setA.size === 0 && setB.size === 0) return 0;

  let intersectionSize = 0;
  for (const bg of setA) {
    if (setB.has(bg)) intersectionSize++;
  }
  const unionSize = setA.size + setB.size - intersectionSize;

  return unionSize > 0 ? intersectionSize / unionSize : 0;
}

function getBigrams(text: string): string[] {
  const words = text.split(/\s+/);
  const bigrams: string[] = [];
  for (let i = 0; i < words.length - 1; i++) {
    bigrams.push(`${words[i]} ${words[i + 1]}`);
  }
  return bigrams;
}

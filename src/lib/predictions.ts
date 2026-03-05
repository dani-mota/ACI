import type { RoleContext } from "./assessment/role-context";

interface SubtestScore {
  construct: string;
  percentile: number;
}

/** V2 ceiling characterization data, passed when available from Layer C scoring */
export interface CeilingCharacterization {
  construct: string;
  ceilingType: "HARD_CEILING" | "SOFT_CEILING_TRAINABLE" | "SOFT_CEILING_CONTEXT_DEPENDENT" | "STRESS_INDUCED" | "INSUFFICIENT_DATA";
  narrative?: string;
}

type SupervisionLevel = "MINIMAL" | "STANDARD" | "ELEVATED" | "HIGH";
type CeilingLevel = "SENIOR_SPECIALIST" | "TEAM_LEAD" | "STANDARD_PERFORMER" | "LIMITED";
type RiskLevel = "LOW" | "MODERATE" | "ELEVATED" | "HIGH";

function getScore(results: SubtestScore[], construct: string): number {
  return results.find(r => r.construct === construct)?.percentile ?? 50;
}

export function predictRampTime(results: SubtestScore[], roleContext?: RoleContext | null): {
  weeks: number;
  confidence: number;
  label: string;
  description: string;
} {
  const lv = getScore(results, "LEARNING_VELOCITY");
  const ec = getScore(results, "EXECUTIVE_CONTROL");
  const sd = getScore(results, "SYSTEMS_DIAGNOSTICS");

  const baseWeeks = Math.round(16 - (lv / 100) * 12);
  const ecModifier = ec >= 70 ? -1 : ec < 40 ? 1 : 0;
  const sdModifier = sd >= 70 ? -1 : sd < 40 ? 1 : 0;
  const weeks = Math.max(2, Math.min(16, baseWeeks + ecModifier + sdModifier));

  const confidence = Math.min(95, 60 + Math.abs(lv - 50) * 0.5);

  let label: string;
  if (weeks <= 4) label = "Fast Ramp";
  else if (weeks <= 8) label = "Standard Ramp";
  else if (weeks <= 12) label = "Extended Ramp";
  else label = "Long Ramp";

  return {
    weeks,
    confidence: Math.round(confidence),
    label,
    description: `Estimated ${weeks} weeks to full productivity based on learning velocity (${lv}th percentile), executive control (${ec}th), and systems diagnostics (${sd}th).${
      roleContext && !roleContext.isGeneric
        ? ` In the ${roleContext.environment.toLowerCase()} environment for ${roleContext.roleName}, this accounts for domain-specific onboarding requirements.`
        : ""
    }`,
  };
}

export function predictSupervision(
  results: SubtestScore[],
  roleContext?: RoleContext | null,
  ceilings?: CeilingCharacterization[],
): {
  level: SupervisionLevel;
  label: string;
  description: string;
  confidence: number;
} {
  const mc = getScore(results, "METACOGNITIVE_CALIBRATION");
  const prl = getScore(results, "PROCEDURAL_RELIABILITY");
  const ej = getScore(results, "ETHICAL_JUDGMENT");
  const ec = getScore(results, "EXECUTIVE_CONTROL");

  const composite = Math.round((mc * 0.3 + prl * 0.25 + ej * 0.25 + ec * 0.2));

  let level: SupervisionLevel;
  let label: string;

  if (composite >= 75) {
    level = "MINIMAL";
    label = "Minimal Supervision";
  } else if (composite >= 55) {
    level = "STANDARD";
    label = "Standard Supervision";
  } else if (composite >= 35) {
    level = "ELEVATED";
    label = "Elevated Supervision";
  } else {
    level = "HIGH";
    label = "High Supervision";
  }

  // V2: STRESS_INDUCED ceilings increase supervision recommendation
  const stressCeilings = ceilings?.filter(c => c.ceilingType === "STRESS_INDUCED") ?? [];
  if (stressCeilings.length > 0 && level === "MINIMAL") {
    level = "STANDARD";
    label = "Standard Supervision (stress-adjusted)";
  }

  const confidence = Math.min(95, 55 + Math.abs(composite - 50) * 0.6);

  let description = `Based on metacognitive calibration (${mc}th), procedural reliability (${prl}th), ethical judgment (${ej}th), and executive control (${ec}th).`;
  if (roleContext && !roleContext.isGeneric) {
    description += ` Given ${roleContext.roleName} responsibilities, this reflects expected autonomy in day-to-day operations.`;
  }
  if (stressCeilings.length > 0) {
    description += ` Stress-induced performance ceilings detected in ${stressCeilings.map(c => c.construct.toLowerCase().replace(/_/g, " ")).join(", ")} — additional supervisor check-ins recommended during high-pressure periods.`;
  }

  return {
    level,
    label,
    description,
    confidence: Math.round(confidence),
  };
}

export function predictCeiling(
  results: SubtestScore[],
  roleContext?: RoleContext | null,
  ceilings?: CeilingCharacterization[],
): {
  level: CeilingLevel;
  label: string;
  description: string;
  confidence: number;
} {
  const fr = getScore(results, "FLUID_REASONING");
  const lv = getScore(results, "LEARNING_VELOCITY");
  const sd = getScore(results, "SYSTEMS_DIAGNOSTICS");
  const mc = getScore(results, "METACOGNITIVE_CALIBRATION");

  const composite = Math.round((fr * 0.35 + lv * 0.25 + sd * 0.2 + mc * 0.2));

  let level: CeilingLevel;
  let label: string;

  if (composite >= 80) {
    level = "SENIOR_SPECIALIST";
    label = "Senior Specialist / Lead";
  } else if (composite >= 60) {
    level = "TEAM_LEAD";
    label = "Team Lead Potential";
  } else if (composite >= 40) {
    level = "STANDARD_PERFORMER";
    label = "Solid Performer";
  } else {
    level = "LIMITED";
    label = "Role-Specific Contributor";
  }

  // V2 ceiling characterization: HARD_CEILING on key constructs caps performance ceiling
  const keyConstruts = ["FLUID_REASONING", "LEARNING_VELOCITY", "SYSTEMS_DIAGNOSTICS"];
  const hardCeilings = ceilings?.filter(c => c.ceilingType === "HARD_CEILING" && keyConstruts.includes(c.construct)) ?? [];
  if (hardCeilings.length > 0 && (level === "SENIOR_SPECIALIST" || level === "TEAM_LEAD")) {
    level = "STANDARD_PERFORMER";
    label = "Solid Performer (ceiling-adjusted)";
  }

  // SOFT_CEILING_TRAINABLE: add training-specific context to description
  const trainableCeilings = ceilings?.filter(c => c.ceilingType === "SOFT_CEILING_TRAINABLE") ?? [];

  let confidence = Math.min(90, 50 + Math.abs(composite - 50) * 0.5);
  // Higher confidence when V2 ceiling data is available
  if (ceilings && ceilings.length > 0) {
    confidence = Math.min(95, confidence + 5);
  }

  let description = `Growth trajectory based on fluid reasoning (${fr}th), learning velocity (${lv}th), systems diagnostics (${sd}th), and self-awareness (${mc}th).`;
  if (roleContext && !roleContext.isGeneric) {
    description += ` Relative to the ${roleContext.roleName} growth trajectory within ${roleContext.domain.toLowerCase()}.`;
  }
  if (hardCeilings.length > 0) {
    description += ` Hard ceiling detected in ${hardCeilings.map(c => c.construct.toLowerCase().replace(/_/g, " ")).join(", ")} — growth trajectory adjusted downward.`;
  }
  if (trainableCeilings.length > 0) {
    description += ` Trainable ceilings in ${trainableCeilings.map(c => c.construct.toLowerCase().replace(/_/g, " ")).join(", ")} — targeted development can unlock additional potential.`;
  }

  return {
    level,
    label,
    description,
    confidence: Math.round(confidence),
  };
}

export function predictAttrition(results: SubtestScore[], roleContext?: RoleContext | null): {
  risk: RiskLevel;
  label: string;
  description: string;
  confidence: number;
  factors: string[];
} {
  const prl = getScore(results, "PROCEDURAL_RELIABILITY");
  const ej = getScore(results, "ETHICAL_JUDGMENT");
  const ec = getScore(results, "EXECUTIVE_CONTROL");
  const cf = getScore(results, "COGNITIVE_FLEXIBILITY");

  const factors: string[] = [];
  let riskScore = 50;

  if (prl < 35) { riskScore += 15; factors.push("Low procedural reliability correlates with early turnover"); }
  if (ej < 35) { riskScore += 10; factors.push("Low ethical alignment may signal cultural mismatch"); }
  if (ec < 35) { riskScore += 10; factors.push("Low focus may lead to frustration in demanding roles"); }
  if (cf > 85) { riskScore += 5; factors.push("Very high flexibility may signal restlessness in routine roles"); }
  if (prl >= 70) { riskScore -= 15; factors.push("Strong procedural reliability suggests role stability"); }
  if (ej >= 70) { riskScore -= 10; factors.push("High ethical alignment suggests cultural fit"); }

  riskScore = Math.max(10, Math.min(95, riskScore));

  let risk: RiskLevel;
  let label: string;

  if (riskScore >= 70) {
    risk = "HIGH";
    label = "High Attrition Risk";
  } else if (riskScore >= 55) {
    risk = "ELEVATED";
    label = "Elevated Attrition Risk";
  } else if (riskScore >= 35) {
    risk = "MODERATE";
    label = "Moderate Attrition Risk";
  } else {
    risk = "LOW";
    label = "Low Attrition Risk";
  }

  return {
    risk,
    label,
    description: `Attrition risk assessment based on behavioral indicators and role fit patterns.${
      roleContext && !roleContext.isGeneric
        ? ` Assessed in the context of ${roleContext.roleName} within ${roleContext.domain.toLowerCase()} environments.`
        : ""
    }`,
    confidence: Math.min(85, 50 + factors.length * 8),
    factors: factors.length > 0 ? factors : ["No significant risk factors identified"],
  };
}

export function generateAllPredictions(
  results: SubtestScore[],
  roleContext?: RoleContext | null,
  ceilings?: CeilingCharacterization[],
) {
  return {
    rampTime: predictRampTime(results, roleContext),
    supervision: predictSupervision(results, roleContext, ceilings),
    ceiling: predictCeiling(results, roleContext, ceilings),
    attrition: predictAttrition(results, roleContext),
  };
}

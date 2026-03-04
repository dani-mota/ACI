/**
 * Template-driven narrative insights for SubtestResult records.
 * Each construct × percentile band maps to a 1–2 sentence professional insight.
 * Bands: 0–24 (concern), 25–49 (below), 50–74 (average), 75–100 (strong)
 *
 * When a RoleContext is provided, a domain-specific sentence is appended.
 */

import type { RoleContext } from "./role-context";

type Band = "concern" | "below" | "average" | "strong";

function getBand(percentile: number): Band {
  if (percentile >= 75) return "strong";
  if (percentile >= 50) return "average";
  if (percentile >= 25) return "below";
  return "concern";
}

const NARRATIVES: Record<string, Record<Band, string>> = {
  FLUID_REASONING: {
    strong: "Demonstrates exceptional abstract reasoning and novel problem-solving capacity. Adapts quickly to unfamiliar challenges and identifies non-obvious solutions under pressure.",
    average: "Shows solid reasoning skills adequate for most structured tasks. May need additional context or time when problems are highly ambiguous or multistep.",
    below: "Reasoning performance suggests difficulty with novel, open-ended problems. Benefits from clearly defined procedures and close supervision on complex tasks.",
    concern: "Significant gaps in abstract reasoning detected. Structured roles with well-defined procedures are recommended; complex troubleshooting may be a challenge.",
  },
  EXECUTIVE_CONTROL: {
    strong: "Exhibits strong working memory and cognitive control. Effectively manages competing demands, stays on task under interruption, and prioritizes with precision.",
    average: "Manages routine multi-step tasks reliably. Performance may degrade when juggling more than two simultaneous priorities or under sustained cognitive load.",
    below: "Attention and task-switching appear effortful. May struggle with environments requiring frequent context shifts or tracking multiple concurrent workstreams.",
    concern: "Executive function scores indicate meaningful risk in fast-paced, high-interruption environments. Close task management and simplified workflows are advisable.",
  },
  COGNITIVE_FLEXIBILITY: {
    strong: "Adapts readily to changing conditions, new information, and revised instructions. Unlikely to be rigid when standard methods fail; quickly explores alternatives.",
    average: "Shows reasonable adaptability in familiar contexts. May require time to recalibrate when facing unexpected changes or contradictory information.",
    below: "Tends toward established routines; adapting to novel or changing conditions takes extra effort. Change management support may be beneficial during onboarding.",
    concern: "Low flexibility scores suggest difficulty shifting approaches when circumstances change. Roles with stable, predictable workflows are a better fit.",
  },
  METACOGNITIVE_CALIBRATION: {
    strong: "Highly accurate self-assessment — knows what they know and what they don't. Confidence tracks actual performance closely, which supports reliable judgment calls.",
    average: "Self-awareness is adequate; minor miscalibration is present but within normal range. Occasional blind spots may occur on edge-case decisions.",
    below: "Noticeable gap between self-assessed confidence and actual accuracy. May over- or under-commit on tasks; benefits from external checkpoints on high-stakes work.",
    concern: "Significant miscalibration detected. Confidence is poorly matched to actual performance, which creates risk in autonomous decision-making contexts.",
  },
  LEARNING_VELOCITY: {
    strong: "Acquires new skills rapidly and retains them with minimal repetition. Likely to reach full productivity ahead of schedule and continue growing beyond the role.",
    average: "Learns at a standard pace with normal reinforcement. Expected to reach functional proficiency within a typical onboarding window.",
    below: "Learning pace is below average; more structured training, repetition, and supervisor check-ins are likely needed to reach full competency.",
    concern: "Learning velocity is a concern. Extended ramp time is expected; intensive support, structured milestones, and frequent coaching are strongly recommended.",
  },
  SYSTEMS_DIAGNOSTICS: {
    strong: "Identifies root causes efficiently and thinks in systems. Excels at diagnosing complex failures and understanding interdependencies across process components.",
    average: "Competent at structured troubleshooting within familiar systems. May need guidance when failure modes are non-obvious or span multiple subsystems.",
    below: "Diagnostic reasoning is developing. Better suited to execution roles than root-cause analysis; systematic checklists and escalation paths should be in place.",
    concern: "Limited ability to diagnose system-level problems detected. Complex troubleshooting responsibilities should be assigned to more senior personnel.",
  },
  PATTERN_RECOGNITION: {
    strong: "Quickly detects anomalies, trends, and regularities in data or physical environments. Likely to catch quality deviations early and flag process drift proactively.",
    average: "Pattern detection is reliable in familiar contexts. May miss subtle or novel anomalies that fall outside prior experience.",
    below: "Pattern recognition performance suggests reliance on explicit checklists rather than intuitive detection. Quality inspection tasks may require additional verification steps.",
    concern: "Low pattern recognition scores indicate a meaningful risk for inspection or monitoring roles. Automated checks and secondary review are advisable.",
  },
  QUANTITATIVE_REASONING: {
    strong: "Handles numerical reasoning with precision. Comfortable with calculations, data interpretation, and accuracy-sensitive tasks without need for verification support.",
    average: "Sufficient numerical competency for standard operational tasks. Complex calculations or high-precision work may benefit from documented procedures.",
    below: "Quantitative reasoning is developing. Numerical and data tasks should be proceduralized and spot-checked during early tenure.",
    concern: "Quantitative scores indicate significant risk for calculation-intensive or precision-dependent roles. Additional training and close oversight are recommended.",
  },
  SPATIAL_VISUALIZATION: {
    strong: "Excellent ability to mentally manipulate 3D objects, interpret visual diagrams, and reason about geometric relationships without physical aids.",
    average: "Adequate spatial reasoning for most professional contexts. Complex diagrams or multi-view representations may benefit from supplemental visualization tools.",
    below: "Spatial reasoning is below average; may struggle with interpreting complex diagrams or spatial layouts. Supplemental tools and reference materials are advisable.",
    concern: "Spatial visualization deficit detected. Roles requiring frequent interpretation of visual diagrams or spatial models may be significantly challenging.",
  },
  MECHANICAL_REASONING: {
    strong: "Strong intuition for systems, cause-and-effect relationships, and operational trade-offs. Likely to troubleshoot issues intuitively and understand technical constraints.",
    average: "Solid foundation in applied reasoning about systems and processes. Performance on novel or complex scenarios may vary; standard training should suffice.",
    below: "Mechanical reasoning is developing. Formal training on relevant systems is recommended before independent handling of complex operational tasks.",
    concern: "Mechanical reasoning scores are a concern for technically demanding roles. Foundational training and extended supervised operation are strongly advised.",
  },
  PROCEDURAL_RELIABILITY: {
    strong: "Highly disciplined and consistent in following established procedures. Unlikely to skip steps under pressure; documentation and compliance habits are strong.",
    average: "Generally follows procedures reliably in routine conditions. Under high time pressure or fatigue, occasional lapses may occur.",
    below: "Procedural adherence is inconsistent. Clear standard procedures, checklists, and accountability structures are important to ensure quality standards are met.",
    concern: "Low procedural reliability is a significant concern for compliance-sensitive or quality-critical roles. Intensive oversight and structured accountability systems are required.",
  },
  ETHICAL_JUDGMENT: {
    strong: "Consistently applies principled reasoning to ambiguous situations. Resists social pressure when procedures or standards are at stake.",
    average: "Generally makes sound ethical judgments in straightforward scenarios. Ambiguous situations with competing pressures may occasionally produce inconsistent reasoning.",
    below: "Ethical judgment shows inconsistency, particularly when social dynamics or time pressure are involved. Explicit guidance on expected conduct is important.",
    concern: "Significant ethical judgment concerns detected. Roles involving sign-off authority, compliance oversight, or autonomous decision-making warrant careful monitoring.",
  },
};

export function getNarrativeInsight(
  construct: string,
  percentile: number,
  roleContext?: RoleContext | null,
): string {
  const band = getBand(percentile);
  const constructNarratives = NARRATIVES[construct];
  if (!constructNarratives) return "";

  const base = constructNarratives[band];

  // Append domain-specific context when a non-generic role context is available
  if (!roleContext || roleContext.isGeneric || !roleContext.keyTasks.length) {
    return base;
  }

  const DOMAIN_SUFFIXES: Record<Band, (ctx: RoleContext) => string> = {
    strong: (ctx) =>
      `This is particularly valuable for ${ctx.roleName} roles involving ${ctx.keyTasks[0]}.`,
    average: (ctx) =>
      `For ${ctx.roleName} responsibilities, structured onboarding in ${ctx.environment.toLowerCase()} contexts will help bridge any gaps.`,
    below: (ctx) =>
      `Given the ${ctx.roleName} role's demands around ${ctx.keyTasks[0]}, additional support during ramp-up is recommended.`,
    concern: (ctx) =>
      `This is a heightened concern given ${ctx.roleName} requirements in ${ctx.environment.toLowerCase()} environments.`,
  };

  return `${base} ${DOMAIN_SUFFIXES[band](roleContext)}`;
}

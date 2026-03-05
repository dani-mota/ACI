import type { BeatTemplate, ScenarioShell, ResponseClassification, DomainAdaptedContent } from "../types";
import { getScenarioContent } from "./generator";

/**
 * Builds the follow-up prompt for the next beat based on the candidate's classification
 * and the scenario's branch scripts.
 *
 * This produces the userContext that is sent to the AI to generate the next beat's content.
 */
export function buildFollowUpContext(
  scenario: ScenarioShell,
  currentBeat: BeatTemplate,
  nextBeat: BeatTemplate,
  classification: ResponseClassification,
  candidateResponse: string,
  domainContent: DomainAdaptedContent | null,
): string {
  const content = getScenarioContent(scenario, domainContent);
  const branchScript = nextBeat.branchScripts[classification];
  const beatAdaptation = content.beatAdaptation(nextBeat.beatNumber);

  const parts: string[] = [];

  // Context about the classification
  parts.push(
    `[BEAT TRANSITION: ${currentBeat.type} → ${nextBeat.type}]`,
    `The candidate's response was classified as ${classification}.`,
    `Their response: "${candidateResponse.slice(0, 500)}"`,
    "",
  );

  // Branch script for the next beat
  parts.push(
    `BRANCH SCRIPT (${classification}): ${branchScript}`,
    "",
  );

  // Beat template
  parts.push(
    `NEXT BEAT TEMPLATE: ${nextBeat.agentPromptTemplate}`,
    "",
  );

  // Domain adaptation if available
  if (beatAdaptation) {
    parts.push(`DOMAIN ADAPTATION: ${beatAdaptation}`, "");
  }

  // Scenario context
  parts.push(
    `SETTING: ${content.setting}`,
    `CHARACTERS: ${content.characters.join(", ")}`,
    "",
  );

  // Instructions
  parts.push(
    "Generate the next beat's content following the branch script and template.",
    "The response should feel like a natural continuation of the conversation.",
    "Reference the candidate's previous choices where appropriate.",
    `The next beat measures: ${nextBeat.primaryConstructs.join(", ")}.`,
  );

  return parts.join("\n");
}

/**
 * Builds a transition message between scenarios.
 * Used when moving from one scenario to the next within Act 1.
 */
export function buildScenarioTransitionContext(
  completedScenario: ScenarioShell,
  nextScenario: ScenarioShell,
  domainContent: DomainAdaptedContent | null,
): string {
  const nextContent = getScenarioContent(nextScenario, domainContent);

  return `[SCENARIO TRANSITION]
You have just completed "${completedScenario.name}".

Now introduce a completely new scenario: "${nextScenario.name}"
Setting: ${nextContent.setting}
Initial situation: ${nextContent.initialSituation}

Generate a natural transition: briefly acknowledge the candidate has handled a challenging situation, then smoothly introduce the new scenario. Do NOT say "scenario 2" or reference the assessment structure. Make it feel like a new topic arising in a natural conversation.`;
}

/**
 * Builds a reflective synthesis prompt for Beat 5 of a scenario.
 * This is the final beat where the candidate reflects on their experience.
 */
export function buildReflectiveSynthesisContext(
  scenario: ScenarioShell,
  beat: BeatTemplate,
  classification: ResponseClassification,
  overallBranchPath: ResponseClassification[],
): string {
  const dominantClassification = getDominantClassification(overallBranchPath);
  const branchScript = beat.branchScripts[dominantClassification];

  return `[REFLECTIVE SYNTHESIS]
The candidate has completed all beats of "${scenario.name}".

OVERALL PERFORMANCE PATTERN: ${overallBranchPath.join(" → ")}
DOMINANT CLASSIFICATION: ${dominantClassification}

BRANCH SCRIPT: ${branchScript}

TEMPLATE: ${beat.agentPromptTemplate}

Generate the reflective question. It should feel warm and genuinely curious, not evaluative. The candidate should feel invited to be honest about their experience.`;
}

function getDominantClassification(path: ResponseClassification[]): ResponseClassification {
  const counts = { STRONG: 0, ADEQUATE: 0, WEAK: 0 };
  for (const c of path) {
    counts[c]++;
  }
  if (counts.STRONG >= counts.ADEQUATE && counts.STRONG >= counts.WEAK) return "STRONG";
  if (counts.WEAK >= counts.ADEQUATE && counts.WEAK >= counts.STRONG) return "WEAK";
  return "ADEQUATE";
}

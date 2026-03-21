/**
 * F1: SCENARIO_SETUP TurnBuilder — Act 1 Beat 0.
 * Pre-written narration from content library. No AI calls. Input type: none.
 */
import type { TurnBuilderContext } from "./context";
import type { AssessmentTurnResponse, ScenarioReferenceData } from "@/lib/types/turn";
import { splitSentences, buildMeta, getSilenceThresholds } from "./helpers";
import { lookupBeatContent } from "../content-serving";
import { SCENARIOS } from "../scenarios";

export async function buildScenarioSetup(ctx: TurnBuilderContext): Promise<AssessmentTurnResponse> {
  const { action, state, contentLibrary, variantSelections } = ctx;
  const meta = ("metadata" in action ? action.metadata : undefined) as Record<string, unknown> | undefined;
  const scenarioIndex = (meta?.scenarioIndex as number) ?? state.currentScenario;
  const scenario = SCENARIOS[scenarioIndex];

  let spokenText = "";
  let referenceCard: ScenarioReferenceData | undefined;

  // Try content library first
  if (contentLibrary && variantSelections) {
    try {
      const content = lookupBeatContent(contentLibrary, scenarioIndex, 0, "ADEQUATE", variantSelections);
      spokenText = content.spokenText;
      referenceCard = content.referenceCard as ScenarioReferenceData | undefined;
    } catch {
      // Fall through to engine prompt
    }
  }

  // Fallback: use the engine's scenario description
  if (!spokenText && scenario) {
    spokenText = scenario.domainNeutralContent.initialSituation;
  }

  if (!spokenText) {
    spokenText = "Let me set the scene for you.";
  }

  // Synthesize a reference card from scenario shell data when the content library
  // doesn't provide one (e.g., no library for this role, or beat has no card).
  if (!referenceCard && scenario) {
    const { domainNeutralContent } = scenario;
    const otherCharacters = domainNeutralContent.characters.slice(1);
    referenceCard = {
      role: domainNeutralContent.characters[0] ?? "You",
      context: domainNeutralContent.setting,
      sections: otherCharacters.length > 0
        ? [{ label: "Key People", items: otherCharacters, highlight: false }]
        : [],
      question: "How would you handle this situation?",
    };
  }

  const sentences = splitSentences(spokenText);

  // Strip trailing question from legacy content libraries (generated with
  // "Sentence 5: The question" instruction). Beat 0 is pure scene-setting —
  // the first question comes from Beat 1. Guard: only strip when ≥5 sentences
  // to avoid accidentally trimming short narrations that legitimately end with "?".
  if (sentences.length >= 5 && sentences[sentences.length - 1]?.trim().endsWith("?")) {
    sentences.pop();
  }

  return {
    type: "turn",
    delivery: {
      sentences,
      ...(referenceCard ? { referenceCard } : {}),
    },
    input: { type: "none" },
    signal: {
      format: "SCENARIO_SETUP",
      act: state.currentAct as "ACT_1",
      primaryConstructs: (scenario?.primaryConstructs ?? []) as any[],
      secondaryConstructs: [],
      scenarioIndex,
      beatIndex: 0,
      beatType: "INITIAL_SITUATION",
    },
    meta: buildMeta(state, contentLibrary ? "pre-generated" : "scripted"),
  };
}

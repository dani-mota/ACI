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

  return {
    type: "turn",
    delivery: {
      sentences: splitSentences(spokenText),
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

/**
 * F7: CONFIDENCE_RATING TurnBuilder — Act 3 Phase 1.
 * Static text. No AI calls. Input type: confidence.
 */
import type { TurnBuilderContext } from "./context";
import type { AssessmentTurnResponse } from "@/lib/types/turn";
import { buildMeta } from "./helpers";

export async function buildConfidenceRating(ctx: TurnBuilderContext): Promise<AssessmentTurnResponse> {
  const { action, state } = ctx;
  if (action.type !== "INTERACTIVE_ELEMENT") throw new Error("Expected INTERACTIVE_ELEMENT action");

  return {
    type: "turn",
    delivery: {
      sentences: ["How confident are you in that answer?"],
      interactiveElement: {
        elementType: "CONFIDENCE_RATING",
        prompt: "How confident are you in that answer?",
        options: ["Very confident", "Somewhat confident", "Not sure"],
      },
    },
    input: {
      type: "confidence",
      options: ["VERY_CONFIDENT", "SOMEWHAT_CONFIDENT", "NOT_SURE"],
    },
    signal: {
      format: "CONFIDENCE_RATING",
      act: "ACT_3",
      primaryConstructs: ["METACOGNITIVE_CALIBRATION"],
      secondaryConstructs: [],
    },
    meta: buildMeta(state, "scripted"),
  };
}

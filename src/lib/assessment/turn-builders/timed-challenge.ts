/**
 * F5: TIMED_CHALLENGE TurnBuilder — Act 2 timed items.
 * Reads from item bank. No AI calls. Input type: timed-select.
 * Timer starts ONLY after TTS delivery completes (P-16).
 */
import type { TurnBuilderContext } from "./context";
import type { AssessmentTurnResponse } from "@/lib/types/turn";
import { splitSentences, buildMeta } from "./helpers";

export async function buildTimedChallenge(ctx: TurnBuilderContext): Promise<AssessmentTurnResponse> {
  const { action, state } = ctx;
  if (action.type !== "INTERACTIVE_ELEMENT") throw new Error("Expected INTERACTIVE_ELEMENT action");

  const { elementData, act } = action;
  const construct = elementData.construct as string | undefined;
  const timeLimit = elementData.timeLimit ?? 60;

  return {
    type: "turn",
    delivery: {
      sentences: splitSentences(elementData.prompt),
      interactiveElement: {
        elementType: "TIMED_CHALLENGE",
        prompt: elementData.prompt,
        options: elementData.options ?? [],
        timeLimit,
        ...(elementData.asciiDiagram ? { asciiDiagram: elementData.asciiDiagram as string } : {}),
        ...(elementData.timingExpectations ? { timingExpectations: elementData.timingExpectations as any } : {}),
      },
    },
    input: {
      type: "timed-select",
      options: (elementData.options ?? []).map((_, i) => String.fromCharCode(65 + i)),
      timeLimit,
    },
    signal: {
      format: "TIMED_CHALLENGE",
      act: act as any,
      primaryConstructs: construct ? [construct as any] : [],
      secondaryConstructs: [],
      constructId: construct as any,
      itemId: elementData.itemId as string,
      difficulty: (elementData as any).difficulty ?? 0.5,
      phase: (action.metadata as any)?.phase,
    },
    meta: buildMeta(state, "pre-generated"),
  };
}

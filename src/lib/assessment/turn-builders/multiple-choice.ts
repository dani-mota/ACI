/**
 * F3: MULTIPLE_CHOICE TurnBuilder — Act 2 structured items.
 * Reads from item bank. No AI calls. Input type: select.
 */
import type { TurnBuilderContext } from "./context";
import type { AssessmentTurnResponse } from "@/lib/types/turn";
import { splitSentences, buildMeta } from "./helpers";

export async function buildMultipleChoice(ctx: TurnBuilderContext): Promise<AssessmentTurnResponse> {
  const { action, state } = ctx;
  if (action.type !== "INTERACTIVE_ELEMENT") throw new Error("Expected INTERACTIVE_ELEMENT action");

  const { elementData, act } = action;
  const prompt = elementData.prompt;
  const options = elementData.options ?? [];
  const construct = elementData.construct as string | undefined;

  return {
    type: "turn",
    delivery: {
      sentences: splitSentences(prompt),
      interactiveElement: {
        elementType: "MULTIPLE_CHOICE_INLINE",
        prompt,
        options,
        ...(elementData.asciiDiagram ? { asciiDiagram: elementData.asciiDiagram as string } : {}),
        ...(elementData.timingExpectations ? { timingExpectations: elementData.timingExpectations as any } : {}),
      },
    },
    input: {
      type: "select",
      options: options.map((_, i) => String.fromCharCode(65 + i)), // A, B, C, D
    },
    signal: {
      format: "MULTIPLE_CHOICE",
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

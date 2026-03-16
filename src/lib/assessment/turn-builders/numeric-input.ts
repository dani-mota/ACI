/**
 * F4: NUMERIC_INPUT TurnBuilder — Act 2 numeric items.
 * Reads from item bank. No AI calls. Input type: numeric.
 */
import type { TurnBuilderContext } from "./context";
import type { AssessmentTurnResponse } from "@/lib/types/turn";
import { splitSentences, buildMeta } from "./helpers";

export async function buildNumericInput(ctx: TurnBuilderContext): Promise<AssessmentTurnResponse> {
  const { action, state } = ctx;
  if (action.type !== "INTERACTIVE_ELEMENT") throw new Error("Expected INTERACTIVE_ELEMENT action");

  const { elementData, act } = action;
  const construct = elementData.construct as string | undefined;

  return {
    type: "turn",
    delivery: {
      sentences: splitSentences(elementData.prompt),
      interactiveElement: {
        elementType: "NUMERIC_INPUT",
        prompt: elementData.prompt,
        ...(elementData.asciiDiagram ? { asciiDiagram: elementData.asciiDiagram as string } : {}),
        ...(elementData.unitSuffix ? { unitSuffix: elementData.unitSuffix as string } : {}),
        ...(elementData.timingExpectations ? { timingExpectations: elementData.timingExpectations as any } : {}),
      },
    },
    input: { type: "numeric" },
    signal: {
      format: "NUMERIC_INPUT",
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

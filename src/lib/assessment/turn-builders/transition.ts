/**
 * TRANSITION + COMPLETION TurnBuilder — scripted act transitions and assessment end.
 * No AI calls. Input type: none.
 */
import type { TurnBuilderContext } from "./context";
import type { AssessmentTurnResponse } from "@/lib/types/turn";
import type { TurnFormat } from "@/lib/types/formats";
import { splitSentences, buildMeta } from "./helpers";

export async function buildTransition(ctx: TurnBuilderContext): Promise<AssessmentTurnResponse> {
  const { action, state } = ctx;

  if (action.type === "COMPLETE") {
    return {
      type: "turn",
      delivery: { sentences: splitSentences(action.closingMessage) },
      input: { type: "none" },
      signal: {
        format: "COMPLETION",
        act: state.currentAct as any,
        primaryConstructs: [],
        secondaryConstructs: [],
      },
      meta: buildMeta(state, "scripted", { isComplete: true }),
    };
  }

  if (action.type === "TRANSITION") {
    return {
      type: "turn",
      delivery: { sentences: splitSentences(action.transitionMessage) },
      input: { type: "none" },
      signal: {
        format: "TRANSITION",
        act: action.from.act as any,
        primaryConstructs: [],
        secondaryConstructs: [],
      },
      meta: buildMeta(state, "scripted", {
        transition: { from: action.from.act, to: action.to.act },
      }),
    };
  }

  // Fallback — should not reach here
  return {
    type: "turn",
    delivery: { sentences: ["Let's continue."] },
    input: { type: "none" },
    signal: {
      format: "TRANSITION" as TurnFormat,
      act: state.currentAct as any,
      primaryConstructs: [],
      secondaryConstructs: [],
    },
    meta: buildMeta(state, "scripted"),
  };
}

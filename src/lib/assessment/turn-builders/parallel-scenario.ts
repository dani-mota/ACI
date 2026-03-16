/**
 * F8: PARALLEL_SCENARIO TurnBuilder — Act 3 Phase 2.
 * Identical flow to F2 (Open Probe) but in Act 3 for consistency checking.
 */
import type { TurnBuilderContext } from "./context";
import type { AssessmentTurnResponse } from "@/lib/types/turn";
import { buildOpenProbe } from "./open-probe";

export async function buildParallelScenario(ctx: TurnBuilderContext): Promise<AssessmentTurnResponse> {
  // Same generation pipeline as Open Probe — classify, generate, verify
  const turn = await buildOpenProbe(ctx);

  // Override format and act to reflect this is a parallel scenario
  turn.signal.format = "PARALLEL_SCENARIO";
  turn.signal.act = "ACT_3";

  return turn;
}

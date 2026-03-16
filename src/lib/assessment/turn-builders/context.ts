/**
 * TurnBuilderContext — everything a TurnBuilder needs to construct a Turn.
 * Assembled once per request in the dispatcher, passed to the selected builder.
 */
import type { AssessmentState, ConversationMessage } from "@/generated/prisma/client";
import type { EngineAction } from "../types";
import type { AssessmentTurnResponse } from "@/lib/types/turn";
import type { RoleContext } from "../role-context";
import type { ContentLibraryData } from "../content-types";

export interface TurnBuilderContext {
  /** The engine action that triggered this turn. */
  action: EngineAction;
  /** Current assessment state from DB. */
  state: AssessmentState;
  /** All persisted messages (in sequence order). */
  messages: ConversationMessage[];
  /** Candidate's last message (may be undefined for sentinels/auto-advance). */
  lastCandidateMessage?: string;
  /** Whether the last message was a sentinel like [NO_RESPONSE]. */
  isSentinel: boolean;
  /** Role context for domain-adaptive prompts (null if generic role). */
  roleContext: RoleContext | null;
  /** Candidate's first name for personalization. */
  candidateName?: string;
  /** Assessment ID for DB operations. */
  assessmentId: string;
  /** Content library data (loaded if available and enabled). */
  contentLibrary?: ContentLibraryData;
  /** Variant selections for content library (per-scenario random indices). */
  variantSelections?: Record<string, number>;
  /** Pre-generated acknowledgment (may have been started in parallel). */
  acknowledgment?: string;
  /** Classification result from the parallel classification call. */
  classificationResult?: import("../types").ClassificationResult;
}

/** Signature for all TurnBuilder functions. */
export type TurnBuilder = (ctx: TurnBuilderContext) => Promise<AssessmentTurnResponse>;

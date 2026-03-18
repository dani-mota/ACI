import { NextRequest } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { streamText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import prisma from "@/lib/prisma";
import { getRoleContext } from "@/lib/assessment/role-context";
import { getNextAction, computeStateUpdate, computeProgress } from "@/lib/assessment/engine";
import { AI_CONFIG, FEATURE_FLAGS } from "@/lib/assessment/config";
import type { ResponseClassification, AdaptiveLoopState } from "@/lib/assessment/types";
import { classifyResponse } from "@/lib/assessment/classification";
import { generateAcknowledgment } from "@/lib/assessment/generate-acknowledgment";
import { loadContentLibrary, lookupBeatContent, getReadyLibrary, selectRandomVariants } from "@/lib/assessment/content-serving";
import { SCENARIOS } from "@/lib/assessment/scenarios";
import { recordResult, initLoopState } from "@/lib/assessment/adaptive-loop";
import { ITEM_BANK } from "@/lib/assessment/item-bank";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { createLogger } from "@/lib/assessment/logger";
import { dispatch } from "@/lib/assessment/dispatcher";
import { normalizeInput } from "@/lib/assessment/validation/input-schema";
import { validateCandidateMetadata, validateAgentMetadata } from "@/lib/assessment/validation/metadata-schema";
import type { TurnBuilderContext } from "@/lib/assessment/turn-builders/context";

// Vercel serverless: ensure enough time for streaming + onFinish DB writes
export const maxDuration = 60;

/**
 * POST /api/assess/[token]/chat
 *
 * Streaming chat endpoint for the V2 conversational assessment.
 * Uses Vercel AI SDK to stream Claude responses to the candidate.
 *
 * Request body:
 * - messages: Array of { role: "user" | "assistant", content: string }
 * - candidateInput?: string (for structured element responses)
 * - elementResponse?: { elementType: string, value: string, itemId?: string }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const requestId = crypto.randomUUID().slice(0, 8);
  const log = createLogger("chat-route", requestId);
  let stateSnapshot: Record<string, unknown> | null = null;

  try {

  // Rate limit by token
  const rl = checkRateLimit(`chat:${token}`, RATE_LIMITS.assessmentChat);
  if (!rl.allowed) {
    return new Response(JSON.stringify({ error: "Too many requests" }), {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)),
      },
    });
  }

  // Validate invitation token
  const invitation = await prisma.assessmentInvitation.findUnique({
    where: { linkToken: token },
    include: {
      candidate: true,
      role: true,
    },
  });

  if (!invitation || invitation.status === "EXPIRED" || (invitation.expiresAt && new Date() > invitation.expiresAt)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Find the assessment
  const assessment = await prisma.assessment.findFirst({
    where: { candidateId: invitation.candidateId },
    include: {
      assessmentState: true,
      messages: { orderBy: { sequenceOrder: "asc" } },
    },
  });

  if (!assessment) {
    return new Response(JSON.stringify({ error: "Assessment not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  const assessmentId = assessment.id;

  // Completion guard — reject if assessment is already complete
  if (assessment.assessmentState?.isComplete) {
    return new Response(JSON.stringify({ error: "Assessment already completed" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Lifecycle guard — reject if assessment is currently being scored (P0-5)
  if (invitation.candidate.status === "SCORING") {
    return new Response(JSON.stringify({ error: "Assessment is being scored" }), {
      status: 409,
      headers: { "Content-Type": "application/json" },
    });
  }

  const body = await request.json();
  const { messages: clientMessages, elementResponse } = body;

  // Validate elementResponse shape if present
  if (elementResponse) {
    if (typeof elementResponse !== "object" || typeof elementResponse.value !== "string") {
      return new Response(JSON.stringify({ error: "Invalid elementResponse" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    // Sanitize string fields
    elementResponse.value = String(elementResponse.value).slice(0, 2000);
    if (elementResponse.elementType) elementResponse.elementType = String(elementResponse.elementType).slice(0, 50);
    if (elementResponse.itemId) elementResponse.itemId = String(elementResponse.itemId).slice(0, 100);
    if (elementResponse.construct) elementResponse.construct = String(elementResponse.construct).slice(0, 50);
  }

  // Load role context for domain-adaptive prompts
  let roleContext = await getRoleContext(invitation.roleId);
  if (roleContext.isGeneric) roleContext = null as any;

  // Get or create assessment state
  let state = assessment.assessmentState;
  if (!state) {
    // Snapshot content library if available
    let contentLibraryId: string | undefined;
    let variantSelections: Record<string, number> | undefined;

    if (FEATURE_FLAGS.CONTENT_LIBRARY_ENABLED) {
      const readyLib = await getReadyLibrary(invitation.roleId);
      if (readyLib) {
        contentLibraryId = readyLib.id;
        variantSelections = selectRandomVariants(readyLib.content);
      }
    }

    state = await prisma.assessmentState.create({
      data: {
        assessmentId: assessment.id,
        ...(contentLibraryId ? { contentLibraryId, variantSelections } : {}),
      },
    });
  }

  // Capture state snapshot for error diagnostics
  stateSnapshot = {
    assessmentId: assessment?.id ?? "unknown",
    act: state.currentAct,
    scenario: state.currentScenario,
    beat: state.currentBeat,
    contentLibraryId: state.contentLibraryId ?? "none",
    hasVariants: !!state.variantSelections,
    contentLibEnabled: FEATURE_FLAGS.CONTENT_LIBRARY_ENABLED,
  };

  log.info("Assessment state loaded", { contentLibraryId: state.contentLibraryId ?? "none", hasVariants: !!state.variantSelections });

  // Capture state version for optimistic concurrency checks
  const stateVersion = state.updatedAt;

  /**
   * Optimistic concurrency helper: only update state if it hasn't been modified
   * since we read it. Returns the count of updated rows (0 = conflict).
   */
  async function updateStateOptimistic(data: Record<string, unknown>): Promise<number> {
    const result = await prisma.assessmentState.updateMany({
      where: { assessmentId, updatedAt: stateVersion },
      data,
    });
    return result.count;
  }

  // Helper: get next sequence order from DB to avoid race conditions
  async function nextSequenceOrder(): Promise<number> {
    const result = await prisma.conversationMessage.aggregate({
      where: { assessmentId },
      _max: { sequenceOrder: true },
    });
    return (result._max.sequenceOrder ?? 0) + 1;
  }

  // ── Phase 0 triggers ──

  // Persist a Phase 0 scripted message (Aria segment or candidate mic-check reply)
  if (body.trigger === "phase_0_message") {
    const { content, role } = body as { content: string; role: "AGENT" | "CANDIDATE" };
    if (!content || !role) {
      return new Response(JSON.stringify({ error: "Missing content or role" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    const seq = await nextSequenceOrder();
    await prisma.conversationMessage.create({
      data: {
        assessmentId: assessment.id,
        role,
        content: String(content).slice(0, 5000),
        act: "PHASE_0",
        sequenceOrder: seq,
      },
    });
    return new Response(JSON.stringify({ ok: true }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  // Complete Phase 0 → transition to ACT_1
  if (body.trigger === "phase_0_complete") {
    await prisma.assessmentState.update({
      where: { assessmentId: assessment.id },
      data: { currentAct: "ACT_1", phase0Complete: true },
    });
    return new Response(JSON.stringify({ ok: true }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  // Extract and normalize the candidate's last message (P-9)
  const rawLastMessage = clientMessages?.filter(
    (m: { role: string }) => m.role === "user",
  ).pop()?.content as string | undefined;
  const normalized = normalizeInput(rawLastMessage);
  const lastUserMessage: string | undefined = normalized.isSentinel && rawLastMessage == null
    ? undefined // truly no message — don't fabricate one
    : normalized.content;

  // Handle structured element responses (MC selection, numeric input, etc.)
  if (elementResponse) {
    const nextSeq = await nextSequenceOrder();
    await prisma.conversationMessage.create({
      data: {
        assessmentId: assessment.id,
        role: "CANDIDATE",
        content: elementResponse.value,
        act: state.currentAct,
        elementType: elementResponse.elementType,
        candidateInput: elementResponse.value,
        responseTimeMs: elementResponse.responseTimeMs,
        sequenceOrder: nextSeq,
        metadata: {
          itemId: elementResponse.itemId,
          construct: elementResponse.construct,
        },
      },
    });

    // Also persist as ItemResponse for scoring pipeline (with act field)
    if (elementResponse.itemId) {
      await prisma.itemResponse.upsert({
        where: {
          assessmentId_itemId: {
            assessmentId: assessment.id,
            itemId: elementResponse.itemId,
          },
        },
        create: {
          assessmentId: assessment.id,
          itemId: elementResponse.itemId,
          itemType: elementResponse.elementType || "MULTIPLE_CHOICE",
          response: elementResponse.value,
          responseTimeMs: elementResponse.responseTimeMs ?? null,
          act: state.currentAct,
        },
        update: {
          response: elementResponse.value,
          responseTimeMs: elementResponse.responseTimeMs ?? null,
          act: state.currentAct,
        },
      });
    }
  }

  // Persist candidate's text message (skip internal sentinels like [BEGIN_ASSESSMENT])
  const isSentinel = normalized.isSentinel;
  if (lastUserMessage && !elementResponse && !isSentinel) {
    const nextSeq = await nextSequenceOrder();
    await prisma.conversationMessage.create({
      data: {
        assessmentId: assessment.id,
        role: "CANDIDATE",
        content: lastUserMessage,
        act: state.currentAct,
        sequenceOrder: nextSeq,
        metadata: {
          scenarioIndex: state.currentScenario,
          beatIndex: state.currentBeat,
          ...(state.currentConstruct ? { construct: state.currentConstruct } : {}),
          ...(normalized.inputTruncated ? { inputTruncated: true, originalInputLength: normalized.originalLength } : {}),
        } as any,
      },
    });
  }

  // ── S1 fix: Record Act 2 element response in adaptive loop ──
  if (elementResponse && state.currentAct === "ACT_2" && elementResponse.itemId) {
    const item = ITEM_BANK.find((i) => i.id === elementResponse.itemId);
    if (item) {
      const act2Progress = (state.act2Progress as Record<string, AdaptiveLoopState> | null) ?? {};
      const constructId = (elementResponse.construct || item.construct) as string;
      const loopState: AdaptiveLoopState = act2Progress[constructId] ?? initLoopState(constructId as any);

      const { state: updatedLoop, phaseTransition, nextPhase } = recordResult(loopState, {
        itemId: item.id,
        construct: item.construct as any,
        difficulty: item.difficulty,
        correct: elementResponse.value === item.correctAnswer,
        responseTimeMs: elementResponse.responseTimeMs ?? 0,
        candidateResponse: elementResponse.value,
      });

      const newPhaseNumber = nextPhase
        ? ["CALIBRATION", "BOUNDARY_MAPPING", "PRESSURE_TEST", "DIAGNOSTIC_PROBE"].indexOf(nextPhase)
        : (state.currentPhase ?? 0);

      await prisma.assessmentState.update({
        where: { assessmentId: assessment.id },
        data: {
          act2Progress: { ...act2Progress, [constructId]: updatedLoop },
          ...(phaseTransition ? { currentPhase: newPhaseNumber } : {}),
        } as any,
      });

      // Re-fetch state after update
      state = (await prisma.assessmentState.findUnique({
        where: { assessmentId: assessment.id },
      }))!;
    }
  }

  // Fire acknowledgment early so it runs in parallel with classification (~200-400ms saved)
  // Skip for beats 1-2: they use streaming which handles acknowledgment natively via system prompt
  let acknowledgmentPromise: Promise<string> | null = null;
  if (
    state.currentAct === "ACT_1" && lastUserMessage && !isSentinel
    && FEATURE_FLAGS.CONTENT_LIBRARY_ENABLED && state.contentLibraryId
    && state.currentBeat > 2 // beats 0-2 don't use separate acknowledgment (0=intro, 1-2=streamed)
  ) {
    const preScenario = SCENARIOS[state.currentScenario];
    const preBeat = preScenario?.beats[state.currentBeat];
    if (preScenario && preBeat) {
      const lastAriaMsg = assessment.messages
        .filter((m) => m.role === "AGENT")
        .pop()?.content;
      acknowledgmentPromise = generateAcknowledgment(
        lastUserMessage,
        preBeat.type ?? "INITIAL_RESPONSE",
        (preBeat.primaryConstructs as string[]) ?? [],
        preScenario.name,
        lastAriaMsg,
      ).catch((err) => {
        log.warn("Acknowledgment generation failed", { error: String(err) });
        return "";
      });
    }
  }

  // Classify candidate response during Act 1 and update state
  // [NO_RESPONSE] (auto-advance after silence) gets synthetic WEAK classification (PRD §7.7).
  // Other sentinels ([BEGIN_ASSESSMENT], [BEGIN_ACT_2], etc.) skip classification entirely.
  if (state.currentAct === "ACT_1" && lastUserMessage === "[NO_RESPONSE]") {
    // Auto-advance: apply WEAK classification directly — no Haiku call needed
    const stateUpdate = computeStateUpdate(state, { type: "AGENT_MESSAGE" } as any, "WEAK");
    await prisma.assessmentState.update({
      where: { assessmentId: assessment.id },
      data: stateUpdate as any,
    });
    state = (await prisma.assessmentState.findUnique({
      where: { assessmentId: assessment.id },
    }))!;
    log.info("[NO_RESPONSE] → WEAK classification applied, beat advanced", {
      prevBeat: String((stateUpdate as any).currentBeat ?? state.currentBeat),
      newBeat: String(state.currentBeat),
    });
  } else if (state.currentAct === "ACT_1" && lastUserMessage && !isSentinel) {
    const scenario = SCENARIOS[state.currentScenario];
    if (scenario) {
      const beat = scenario.beats[state.currentBeat];
      if (beat) {
        const conversationHistory = assessment.messages
          .slice(-10)
          .map((m) => `${m.role}: ${m.content.slice(0, 300)}`)
          .join("\n");

        try {
          const classification = await classifyResponse(
            lastUserMessage,
            scenario,
            beat,
            conversationHistory,
            roleContext,
          );

          log.info("Classification complete", { act: state.currentAct, beat: String(state.currentBeat), classification: classification.classification, rubricScore: classification.rubricScore });

          // Update state with classification + accumulate token usage
          const stateUpdate = computeStateUpdate(state, { type: "AGENT_MESSAGE" } as any, classification.classification);
          const tokenIncrement = classification.tokenUsage ?? { inputTokens: 0, outputTokens: 0 };
          await prisma.assessmentState.update({
            where: { assessmentId: assessment.id },
            data: {
              ...(stateUpdate as any),
              realtimeTokensIn: { increment: tokenIncrement.inputTokens },
              realtimeTokensOut: { increment: tokenIncrement.outputTokens },
            },
          });

          // Re-fetch state after update
          state = (await prisma.assessmentState.findUnique({
            where: { assessmentId: assessment.id },
          }))!;
          log.info("State after classification", { act: state.currentAct, beat: String(state.currentBeat), scenario: String(state.currentScenario), construct: state.currentConstruct ?? undefined, phase: String(state.currentPhase ?? 0) });
        } catch (classErr) {
          log.error("Classification failed, proceeding with ADEQUATE default", {
            error: classErr instanceof Error ? classErr.message : String(classErr),
            beat: String(state.currentBeat),
            scenario: String(state.currentScenario),
          });
          // Fall through with current state — streaming will still work with ADEQUATE default
        }
      }
    }
  }

  // Determine the next action from the engine
  const action = getNextAction(state, assessment.messages, lastUserMessage);
  log.info("Action determined", { actionType: action.type, act: "act" in action ? (action as any).act : undefined });

  // ── UNIFIED TURNS PATH (behind feature flag) ──
  // When enabled, all action types go through the dispatcher → TurnBuilder → Turn JSON.
  // The existing streaming/JSON paths below remain as the fallback.
  if (FEATURE_FLAGS.UNIFIED_TURNS) {
    const builderCtx: TurnBuilderContext = {
      action,
      state,
      messages: assessment.messages,
      lastCandidateMessage: lastUserMessage,
      isSentinel: !!isSentinel,
      roleContext: roleContext ?? null,
      candidateName: invitation.candidate.firstName ?? undefined,
      assessmentId: assessment.id,
      ...(state.contentLibraryId && FEATURE_FLAGS.CONTENT_LIBRARY_ENABLED ? {
        contentLibrary: await loadContentLibrary(state.contentLibraryId).catch(() => undefined),
        variantSelections: (state.variantSelections as Record<string, number>) ?? undefined,
      } : {}),
      ...(acknowledgmentPromise ? { acknowledgment: await acknowledgmentPromise.catch(() => "") } : {}),
    };

    const turn = await dispatch(builderCtx);

    // Persist agent message with validated metadata (P-11)
    const seq = await nextSequenceOrder();
    const agentContent = turn.delivery.sentences.join(" ");
    const rawAgentMeta = {
      format: turn.signal.format,
      act: state.currentAct,
      generationMethod: turn.meta.generationMethod,
      systemLatencyMs: turn.meta.systemLatencyMs ?? 0,
      primaryConstructs: turn.signal.primaryConstructs,
      ...(turn.signal.scenarioIndex != null ? { scenarioIndex: turn.signal.scenarioIndex } : {}),
      ...(turn.signal.beatIndex != null ? { beatIndex: turn.signal.beatIndex } : {}),
      ...(turn.signal.beatType ? { beatType: turn.signal.beatType } : {}),
      // P-2: persist referenceCard for visual restoration on session recovery
      ...(turn.delivery.referenceCard ? { referenceCard: turn.delivery.referenceCard } : {}),
    };
    const validatedAgentMeta = validateAgentMetadata(rawAgentMeta);
    await prisma.conversationMessage.create({
      data: {
        assessmentId: assessment.id,
        role: "AGENT",
        content: agentContent,
        act: state.currentAct,
        sequenceOrder: seq,
        metadata: (validatedAgentMeta ?? { ...rawAgentMeta, _validationFailed: true }) as any,
      },
    });

    // Update assessment state
    const stateUpdate = computeStateUpdate(state, action);
    if (Object.keys(stateUpdate).length > 0) {
      await prisma.assessmentState.update({
        where: { assessmentId: assessment.id },
        data: {
          ...(stateUpdate as any),
          ...(turn.meta.isComplete ? { isComplete: true } : {}),
        },
      });
    } else if (turn.meta.isComplete) {
      await prisma.assessmentState.update({
        where: { assessmentId: assessment.id },
        data: { isComplete: true },
      });
    }

    return new Response(JSON.stringify(turn), {
      headers: { "Content-Type": "application/json" },
    });
  }

  // ── @deprecated LEGACY PATH — used when FEATURE_UNIFIED_TURNS is off ──
  // This entire section (through the end of the POST handler) handles the old
  // multi-shape response format. When UNIFIED_TURNS is on (default since Stage 7),
  // the unified Turn path above handles all action types.

  // Helper: re-fetch state and compute progress for client
  async function getProgress(): Promise<{ act1: number; act2: number; act3: number }> {
    const latest = await prisma.assessmentState.findUnique({ where: { assessmentId: assessment!.id } });
    return latest ? computeProgress(latest) : { act1: 0, act2: 0, act3: 0 };
  }

  // Handle non-streaming actions
  if (action.type === "COMPLETE") {
    // Persist closing message
    const seq = await nextSequenceOrder();
    await prisma.conversationMessage.create({
      data: {
        assessmentId: assessment.id,
        role: "AGENT",
        content: action.closingMessage,
        act: state.currentAct,
        sequenceOrder: seq,
      },
    });
    await prisma.assessmentState.update({
      where: { assessmentId: assessment.id },
      data: { isComplete: true },
    });

    return new Response(
      JSON.stringify({
        type: "complete",
        message: action.closingMessage,
        progress: { act1: 1, act2: 1, act3: 1 },
      }),
      { headers: { "Content-Type": "application/json" } },
    );
  }

  if (action.type === "INTERACTIVE_ELEMENT") {
    // Send element data as JSON (not streamed)
    const seq = await nextSequenceOrder();
    await prisma.conversationMessage.create({
      data: {
        assessmentId: assessment.id,
        role: "AGENT",
        content: action.elementData.prompt,
        act: action.act,
        elementType: action.elementType,
        elementData: action.elementData as any,
        sequenceOrder: seq,
      },
    });

    // S2 fix: Update assessment state for interactive element actions (e.g., Act 3 progress)
    const elStateUpdate = computeStateUpdate(state, action);
    log.info("StateUpdate (interactive element)", { stateUpdate: elStateUpdate });
    if (Object.keys(elStateUpdate).length > 0) {
      await prisma.assessmentState.update({
        where: { assessmentId: assessment.id },
        data: elStateUpdate as any,
      });
    }

    // Strip correctAnswer from client-facing element data
    const { correctAnswer: _answer, ...safeElementData } = action.elementData as Record<string, unknown>;
    const progress = await getProgress();

    return new Response(
      JSON.stringify({
        type: "interactive_element",
        elementType: action.elementType,
        elementData: safeElementData,
        followUpPrompt: action.followUpPrompt,
        progress,
      }),
      { headers: { "Content-Type": "application/json" } },
    );
  }

  if (action.type === "TRANSITION") {
    // Persist transition message and update state
    const seq = await nextSequenceOrder();
    await prisma.conversationMessage.create({
      data: {
        assessmentId: assessment.id,
        role: "AGENT",
        content: action.transitionMessage,
        act: action.from.act as any,
        sequenceOrder: seq,
        metadata: { transition: true, from: action.from, to: action.to },
      },
    });

    const stateUpdate = computeStateUpdate(state, action);
    // Record per-act completion timestamp
    const actTimestamp: Record<string, Date> = {};
    if (action.from?.act === "ACT_1") actTimestamp.act1CompletedAt = new Date();
    else if (action.from?.act === "ACT_2") actTimestamp.act2CompletedAt = new Date();
    else if (action.from?.act === "ACT_3") actTimestamp.act3CompletedAt = new Date();

    log.info("StateUpdate (transition)", { stateUpdate, from: action.from?.act, to: action.to?.act });
    await prisma.assessmentState.update({
      where: { assessmentId: assessment.id },
      data: { ...(stateUpdate as any), ...actTimestamp },
    });

    const transitionProgress = await getProgress();
    return new Response(
      JSON.stringify({
        type: "transition",
        message: action.transitionMessage,
        to: action.to,
        progress: transitionProgress,
      }),
      { headers: { "Content-Type": "application/json" } },
    );
  }

  // AGENT_MESSAGE: Stream the AI response (or serve pre-generated content)
  if (action.type === "AGENT_MESSAGE") {
    // ── Beat 0 content library path ──
    // [BEGIN_ASSESSMENT] is a sentinel so usePreGenerated won't activate,
    // but Beat 0 is unbranched and doesn't need classification.
    if (
      FEATURE_FLAGS.CONTENT_LIBRARY_ENABLED
      && state.contentLibraryId
      && state.currentAct === "ACT_1"
      && isSentinel
      && state.currentBeat === 0
    ) {
      // Content lookup is recoverable (fall back to streaming); DB writes are not
      let beat0Content: { spokenText: string; referenceCard?: unknown } | null = null;
      try {
        const library = await loadContentLibrary(state.contentLibraryId!);
        const variantSelections = (state.variantSelections as Record<string, number>) ?? {};
        const scenarioIndex = (action.metadata as Record<string, unknown>)?.scenarioIndex as number ?? state.currentScenario;
        const raw = lookupBeatContent(library, scenarioIndex, 0, "ADEQUATE", variantSelections);
        if (raw.spokenText) beat0Content = raw;
      } catch (err) {
        log.error("Beat 0 content library lookup failed, falling back to streaming", { error: String(err) });
      }

      if (beat0Content) {
        // DB writes outside try/catch — failures propagate to outer handler
        const seq = await nextSequenceOrder();
        await prisma.conversationMessage.create({
          data: {
            assessmentId: assessment.id,
            role: "AGENT",
            content: beat0Content.spokenText,
            act: action.act,
            sequenceOrder: seq,
            metadata: {
              ...((action.metadata as Record<string, unknown>) ?? {}),
              preGenerated: true,
              beat0: true,
            } as any,
          },
        });

        if (action.metadata) {
          const stateUpdate = computeStateUpdate(state, action);
          log.info("StateUpdate (Beat 0 library)", { stateUpdate });
          if (Object.keys(stateUpdate).length > 0) {
            await prisma.assessmentState.update({
              where: { assessmentId: assessment.id },
              data: stateUpdate as any,
            });
          }
        }

        const beat0Progress = await getProgress();
        return new Response(
          JSON.stringify({
            type: "agent_message",
            message: beat0Content.spokenText,
            referenceCard: beat0Content.referenceCard || null,
            progress: beat0Progress,
          }),
          { headers: { "Content-Type": "application/json" } },
        );
      }
    }

    // ── Pre-generated content path ──
    // When content library is available and we're in Act 1 with a real candidate response,
    // serve pre-generated content with a personalized acknowledgment instead of streaming.
    const usePreGenerated = FEATURE_FLAGS.CONTENT_LIBRARY_ENABLED
      && state.contentLibraryId
      && state.currentAct === "ACT_1"
      && lastUserMessage
      && !isSentinel
      && !(action.metadata as Record<string, unknown>)?.transition;

    // Force streaming for beats 1–2 where personalization is critical.
    // These are the highest-signal exchanges — the candidate reveals their reasoning
    // and Aria must respond to their specific approach, not serve static templates.
    // Classification still runs for scoring; only content delivery changes.
    const preBeatIndex = (action.metadata as Record<string, unknown>)?.beatIndex as number ?? state.currentBeat;
    const forceStreaming = preBeatIndex >= 1 && preBeatIndex <= 2;

    if (usePreGenerated && !forceStreaming) {
      const scenarioIndex = (action.metadata as Record<string, unknown>)?.scenarioIndex as number ?? state.currentScenario;
      const beatIndex = (action.metadata as Record<string, unknown>)?.beatIndex as number ?? state.currentBeat;

      // Content lookup is recoverable (fall back to streaming); DB writes are not
      let preGenContent: { spokenText: string; referenceCard?: unknown; referenceUpdate?: unknown } | null = null;
      let preGenClassification: ResponseClassification = "ADEQUATE";

      try {
        const library = await loadContentLibrary(state.contentLibraryId!);
        const variantSelections = (state.variantSelections as Record<string, number>) ?? {};

        // Classification already ran above and updated state.
        const branchPath = (state.branchPath as ResponseClassification[] | null) ?? [];
        preGenClassification = branchPath[branchPath.length - 1] ?? "ADEQUATE";

        // Acknowledgment was fired in parallel with classification above
        const acknowledgment = acknowledgmentPromise
          ? await acknowledgmentPromise
          : "";

        // Look up pre-generated content
        const content = lookupBeatContent(library, scenarioIndex, beatIndex, preGenClassification, variantSelections);

        // Compose full response
        const fullText = beatIndex === 0
          ? content.spokenText
          : `${acknowledgment} ${content.spokenText}`;

        preGenContent = {
          spokenText: fullText,
          referenceCard: content.referenceCard || null,
          referenceUpdate: content.referenceUpdate || null,
        };
      } catch (err) {
        log.error("Pre-generated content lookup failed, falling back to streaming", { error: String(err) });
      }

      if (preGenContent) {
        // DB writes outside try/catch — failures propagate to outer handler
        const seq = await nextSequenceOrder();
        await prisma.conversationMessage.create({
          data: {
            assessmentId: assessment.id,
            role: "AGENT",
            content: preGenContent.spokenText,
            act: action.act,
            sequenceOrder: seq,
            metadata: {
              ...((action.metadata as Record<string, unknown>) ?? {}),
              preGenerated: true,
              classification: preGenClassification,
            } as any,
          },
        });

        if (action.metadata) {
          const stateUpdate = computeStateUpdate(state, action);
          log.info("StateUpdate (pre-generated content)", { stateUpdate });
          if (Object.keys(stateUpdate).length > 0) {
            await prisma.assessmentState.update({
              where: { assessmentId: assessment.id },
              data: stateUpdate as any,
            });
          }
        }

        const pregenProgress = await getProgress();
        return new Response(
          JSON.stringify({
            type: "agent_message",
            message: preGenContent.spokenText,
            referenceCard: preGenContent.referenceCard,
            referenceUpdate: preGenContent.referenceUpdate,
            progress: pregenProgress,
          }),
          { headers: { "Content-Type": "application/json" } },
        );
      }
    }

    // ── Streaming path (default / fallback) ──
    log.info("Entering streaming path", { act: state.currentAct, beat: String(state.currentBeat), hasContentLibrary: !!state.contentLibraryId });
    // Build conversation history for context
    const conversationHistory = buildConversationHistory(assessment.messages, clientMessages);

    // Add role context to system prompt if available
    let systemPrompt = action.systemPrompt;
    if (roleContext) {
      systemPrompt += `\n\nROLE CONTEXT: The candidate is being assessed for the role of ${roleContext.roleName}. Domain: ${roleContext.environment}. Key tasks: ${roleContext.keyTasks.slice(0, 4).join(", ")}. Technical skills: ${roleContext.technicalSkills.slice(0, 4).join(", ")}.`;
    }

    // Add candidate identity context so AI can address them by name
    const candidateName = invitation.candidate.firstName;
    if (candidateName) {
      systemPrompt += `\nCandidate name: ${candidateName}. You may address them by name once, in your first response of a new section. Do not repeat it in every response.`;
    }

    // Add beat-aware personalization instructions for Act 1 streaming
    if (state.currentAct === "ACT_1" && lastUserMessage && !isSentinel) {
      const currentBeat = state.currentBeat;
      if (currentBeat === 2) {
        // COMPLICATION beat: must directly challenge the candidate's specific stated approach
        systemPrompt += `\n\nIMPORTANT PERSONALIZATION:
- Begin with ONE sentence (max 15 words) referencing something specific the candidate said — a term, priority, or trade-off they identified. Do NOT evaluate quality.
- The complication you introduce MUST directly challenge the specific approach the candidate described. Do not use a generic complication that ignores what they said.
- If the candidate said they would "isolate the subsystem," your complication should make isolation difficult — not introduce an unrelated problem.
- If the candidate gave an off-topic or joke response, briefly note it doesn't address the situation and redirect to the scenario.`;
      } else if (currentBeat > 2) {
        systemPrompt += `\n\nIMPORTANT: Begin your response with a single brief sentence (max 15 words) that acknowledges something specific the candidate said. Do NOT evaluate quality or say "great answer". Then continue with the scenario content.`;
      }
    }

    try {
      const result = streamText({
        model: anthropic(AI_CONFIG.realtimeModel),
        system: systemPrompt,
        messages: [
          ...conversationHistory,
          { role: "user" as const, content: action.userContext },
        ],
        maxOutputTokens: 500,
        temperature: 0.7,
        abortSignal: AbortSignal.timeout(AI_CONFIG.realtimeTimeoutMs),
        async onFinish({ text }) {
          try {
            // Strip construct_check validation tags from parallel scenarios
            let cleanText = text;
            const constructCheckMatch = text.match(/<construct_check>(.*?)<\/construct_check>/);
            if (constructCheckMatch) {
              cleanText = text.replace(/<construct_check>.*?<\/construct_check>/g, "").trim();
              const expectedConstructs = constructCheckMatch[1].split(",");
              const actionMeta = action.metadata as Record<string, unknown> | undefined;
              if (actionMeta?.sourceScenarioIndex !== undefined) {
                const srcScenario = SCENARIOS[actionMeta.sourceScenarioIndex as number];
                const matched = srcScenario?.primaryConstructs.every(
                  (c: string) => expectedConstructs.includes(c)
                );
                if (!matched) {
                  log.warn("Parallel scenario construct mismatch", { expected: srcScenario?.primaryConstructs.join(","), got: constructCheckMatch[1] });
                }
              }
            }

            // Persist the agent's message after streaming completes
            const seq = await nextSequenceOrder();
            await prisma.conversationMessage.create({
              data: {
                assessmentId: assessment.id,
                role: "AGENT",
                content: cleanText,
                act: action.act,
                sequenceOrder: seq,
                metadata: {
                  ...((action.metadata as Record<string, unknown>) ?? {}),
                  ...(constructCheckMatch ? { constructValidation: constructCheckMatch[1] } : {}),
                } as any,
              },
            });

            // Update assessment state based on action metadata
            if (action.metadata) {
              const stateUpdate = computeStateUpdate(state!, action);
              log.info("StateUpdate (streaming onFinish)", { stateUpdate });
              if (Object.keys(stateUpdate).length > 0) {
                await prisma.assessmentState.update({
                  where: { assessmentId: assessment.id },
                  data: stateUpdate as any,
                });
              }
            }
          } catch (err) {
            Sentry.captureException(err, { extra: { requestId, assessmentId: assessment.id, context: "onFinish" } });
            log.error("onFinish failed", { assessmentId: assessment.id, error: String(err) });
          }
        },
      });

      // Attach progress as header (computed from current state, before onFinish updates)
      const streamProgress = computeProgress(state);
      const streamResponse = result.toTextStreamResponse();
      const streamHeaders = new Headers(streamResponse.headers);
      streamHeaders.set("X-ACI-Progress", JSON.stringify(streamProgress));
      return new Response(streamResponse.body, { status: 200, headers: streamHeaders });
    } catch (streamErr) {
      Sentry.captureException(streamErr, { extra: { requestId, act: state.currentAct, beat: state.currentBeat } });
      log.error("Streaming failed", {
        error: streamErr instanceof Error ? streamErr.message : String(streamErr),
        act: state.currentAct,
        beat: String(state.currentBeat),
        model: AI_CONFIG.realtimeModel,
      });
      return new Response(
        JSON.stringify({ error: "AI response generation failed" }),
        { status: 502, headers: { "Content-Type": "application/json" } },
      );
    }
  }

  // Fallback
  return new Response(JSON.stringify({ error: "Unknown action type" }), {
    status: 500,
    headers: { "Content-Type": "application/json" },
  });

  } catch (err) {
    Sentry.captureException(err, { extra: { requestId, state: stateSnapshot } });
    log.error("Unhandled error in chat route", {
      token: token?.slice(0, 8) + "...",
      state: stateSnapshot,
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    });
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        ...(process.env.NODE_ENV === "development" ? { detail: err instanceof Error ? err.message : String(err) } : {}),
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}

/**
 * GET /api/assess/[token]/chat
 *
 * Returns the current assessment state and message history.
 * Used for session recovery when the candidate returns.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const log = createLogger("chat-route-get");

  try {
    // Rate limit GET by token: 20/min
    const rl = checkRateLimit(`chat-get:${token}`, { maxRequests: 20, windowMs: 60_000 });
    if (!rl.allowed) {
      return new Response(JSON.stringify({ error: "Too many requests" }), {
        status: 429,
        headers: { "Content-Type": "application/json", "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) },
      });
    }

    const invitation = await prisma.assessmentInvitation.findUnique({
      where: { linkToken: token },
    });

    if (!invitation || invitation.status === "EXPIRED" || (invitation.expiresAt && new Date() > invitation.expiresAt)) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const assessment = await prisma.assessment.findUnique({
      where: { candidateId: invitation.candidateId },
      include: {
        assessmentState: true,
        messages: {
          orderBy: { sequenceOrder: "asc" },
          where: { role: { not: "SYSTEM" } },
        },
      },
    });

    if (!assessment) {
      return new Response(JSON.stringify({ error: "Assessment not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Strip internal scoring state but include progress-relevant fields
    const safeState = assessment.assessmentState ? {
      currentAct: assessment.assessmentState.currentAct,
      isComplete: assessment.assessmentState.isComplete,
      phase0Complete: assessment.assessmentState.phase0Complete,
      currentScenario: assessment.assessmentState.currentScenario,
      currentBeat: assessment.assessmentState.currentBeat,
      currentConstruct: assessment.assessmentState.currentConstruct,
      currentPhase: assessment.assessmentState.currentPhase,
      progress: computeProgress(assessment.assessmentState),
    } : null;

    // Find the last reference card data from agent messages for visual restoration (P-2)
    let lastReferenceCard = null;
    for (let i = assessment.messages.length - 1; i >= 0; i--) {
      const msg = assessment.messages[i];
      if (msg.role === "AGENT" && msg.act === "ACT_1") {
        const meta = msg.metadata as Record<string, unknown> | null;
        if (meta?.referenceCard) {
          lastReferenceCard = meta.referenceCard;
          break;
        }
      }
    }

    return new Response(
      JSON.stringify({
        assessmentId: assessment.id,
        state: safeState,
        recovery: true, // P-2: flag for TurnPlayer to skip audio replay
        lastReferenceCard, // P-2: reference card state for visual restoration
        messages: assessment.messages.map((m) => {
          // Strip correctAnswer from element data to prevent answer leakage
          let safeElementData = m.elementData as Record<string, unknown> | null;
          if (safeElementData && typeof safeElementData === "object" && !Array.isArray(safeElementData)) {
            const { correctAnswer: _a, ...rest } = safeElementData;
            safeElementData = rest;
          }
          return {
            id: m.id,
            role: m.role === "AGENT" ? "assistant" : "user",
            content: m.content,
            act: m.act,
            elementType: m.elementType,
            elementData: safeElementData,
            candidateInput: m.candidateInput,
            createdAt: m.createdAt,
          };
        }),
      }),
      { headers: { "Content-Type": "application/json" } },
    );
  } catch (err) {
    Sentry.captureException(err);
    log.error("GET handler failed", { error: err instanceof Error ? err.message : String(err) });
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

function buildConversationHistory(
  dbMessages: { role: string; content: string; act?: string | null }[],
  clientMessages?: { role: string; content: string }[],
): { role: "user" | "assistant"; content: string }[] {
  // Use DB messages as source of truth, excluding Phase 0 and system messages
  const history: { role: "user" | "assistant"; content: string }[] = [];

  for (const msg of dbMessages) {
    if (msg.role === "SYSTEM") continue;
    if (msg.act === "PHASE_0") continue; // Phase 0 is scripted, not relevant to AI context

    const role = msg.role === "AGENT" ? "assistant" : "user";
    let content = msg.content;

    // Sanitize candidate messages: strip XML tags and cap length
    if (role === "user") {
      content = content.replace(/<\/?[a-zA-Z_][a-zA-Z0-9_]*[^>]*>/g, "").slice(0, 2000);
    }

    history.push({ role, content });
  }

  // Cap context to last 40 messages to manage token usage
  return history.slice(-40);
}

import { NextRequest } from "next/server";
import { streamText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import prisma from "@/lib/prisma";
import { getRoleContext } from "@/lib/assessment/role-context";
import { getNextAction, computeStateUpdate, buildGreetingPrompt } from "@/lib/assessment/engine";
import { AI_CONFIG } from "@/lib/assessment/config";
import type { ResponseClassification, AdaptiveLoopState } from "@/lib/assessment/types";
import { classifyResponse } from "@/lib/assessment/classification";
import { SCENARIOS } from "@/lib/assessment/scenarios";
import { recordResult, initLoopState } from "@/lib/assessment/adaptive-loop";
import { ITEM_BANK } from "@/lib/assessment/item-bank";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";

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
    state = await prisma.assessmentState.create({
      data: { assessmentId: assessment.id },
    });
  }

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

  // Extract the candidate's last message
  const lastUserMessage = clientMessages?.filter(
    (m: { role: string }) => m.role === "user",
  ).pop()?.content as string | undefined;

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

  // Persist candidate's text message (skip internal sentinels like [START_ASSESSMENT])
  const isSentinel = lastUserMessage && /^\[.+\]$/.test(lastUserMessage.trim());
  if (lastUserMessage && !elementResponse && !isSentinel) {
    const nextSeq = await nextSequenceOrder();
    await prisma.conversationMessage.create({
      data: {
        assessmentId: assessment.id,
        role: "CANDIDATE",
        content: lastUserMessage,
        act: state.currentAct,
        sequenceOrder: nextSeq,
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

  // Classify candidate response during Act 1 and update state
  // Skip classification for sentinel messages (e.g. [BEGIN_ASSESSMENT], [NO_RESPONSE])
  // but DO classify real candidate responses even at beat 0.
  if (state.currentAct === "ACT_1" && lastUserMessage && !isSentinel) {
    const scenario = SCENARIOS[state.currentScenario];
    if (scenario) {
      const beat = scenario.beats[state.currentBeat];
      if (beat) {
        const conversationHistory = assessment.messages
          .slice(-10)
          .map((m) => `${m.role}: ${m.content.slice(0, 300)}`)
          .join("\n");

        const classification = await classifyResponse(
          lastUserMessage,
          scenario,
          beat,
          conversationHistory,
          roleContext,
        );

        // Update state with classification
        const stateUpdate = computeStateUpdate(state, { type: "AGENT_MESSAGE" } as any, classification.classification);
        await prisma.assessmentState.update({
          where: { assessmentId: assessment.id },
          data: stateUpdate as any,
        });

        // Re-fetch state after update
        state = (await prisma.assessmentState.findUnique({
          where: { assessmentId: assessment.id },
        }))!;
      }
    }
  }

  // Determine the next action from the engine
  const action = getNextAction(state, assessment.messages, lastUserMessage);

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
    if (Object.keys(elStateUpdate).length > 0) {
      await prisma.assessmentState.update({
        where: { assessmentId: assessment.id },
        data: elStateUpdate as any,
      });
    }

    // Strip correctAnswer from client-facing element data
    const { correctAnswer: _answer, ...safeElementData } = action.elementData as Record<string, unknown>;

    return new Response(
      JSON.stringify({
        type: "interactive_element",
        elementType: action.elementType,
        elementData: safeElementData,
        followUpPrompt: action.followUpPrompt,
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
    await prisma.assessmentState.update({
      where: { assessmentId: assessment.id },
      data: stateUpdate as any,
    });

    return new Response(
      JSON.stringify({
        type: "transition",
        message: action.transitionMessage,
        to: action.to,
      }),
      { headers: { "Content-Type": "application/json" } },
    );
  }

  // AGENT_MESSAGE: Stream the AI response
  if (action.type === "AGENT_MESSAGE") {
    // Build conversation history for context
    const conversationHistory = buildConversationHistory(assessment.messages, clientMessages);

    // Add role context to system prompt if available
    let systemPrompt = action.systemPrompt;
    if (roleContext) {
      systemPrompt += `\n\nROLE CONTEXT: The candidate is being assessed for the role of ${roleContext.roleName}. Domain: ${roleContext.environment}. Key tasks: ${roleContext.keyTasks.slice(0, 4).join(", ")}. Technical skills: ${roleContext.technicalSkills.slice(0, 4).join(", ")}.`;
    }

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
          // Persist the agent's message after streaming completes
          const seq = await nextSequenceOrder();
          await prisma.conversationMessage.create({
            data: {
              assessmentId: assessment.id,
              role: "AGENT",
              content: text,
              act: action.act,
              sequenceOrder: seq,
              metadata: action.metadata as any,
            },
          });

          // Update assessment state based on action metadata
          if (action.metadata) {
            const stateUpdate = computeStateUpdate(state!, action);
            if (Object.keys(stateUpdate).length > 0) {
              await prisma.assessmentState.update({
                where: { assessmentId: assessment.id },
                data: stateUpdate as any,
              });
            }
          }
        } catch (err) {
          console.error(`[V2] onFinish failed for assessment ${assessment.id}:`, err);
        }
      },
    });

    return result.toTextStreamResponse();
  }

  // Fallback
  return new Response(JSON.stringify({ error: "Unknown action type" }), {
    status: 500,
    headers: { "Content-Type": "application/json" },
  });
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

  const invitation = await prisma.assessmentInvitation.findUnique({
    where: { linkToken: token },
  });

  if (!invitation || invitation.status === "EXPIRED" || (invitation.expiresAt && new Date() > invitation.expiresAt)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const assessment = await prisma.assessment.findFirst({
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

  // Strip internal scoring state from client-facing response
  const safeState = assessment.assessmentState ? {
    currentAct: assessment.assessmentState.currentAct,
    isComplete: assessment.assessmentState.isComplete,
    phase0Complete: assessment.assessmentState.phase0Complete,
  } : null;

  return new Response(
    JSON.stringify({
      assessmentId: assessment.id,
      state: safeState,
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
    history.push({
      role: msg.role === "AGENT" ? "assistant" : "user",
      content: msg.content,
    });
  }

  // Cap context to last 20 messages to manage token usage
  return history.slice(-20);
}

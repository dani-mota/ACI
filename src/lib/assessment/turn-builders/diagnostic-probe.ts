/**
 * F6: DIAGNOSTIC_PROBE TurnBuilder — Act 2 Phase 4.
 * Haiku generates reflection prompt (buffered per B-1). Input type: voice-or-text.
 */
import type { TurnBuilderContext } from "./context";
import type { AssessmentTurnResponse } from "@/lib/types/turn";
import { splitSentences, buildMeta, getSilenceThresholds } from "./helpers";
import { AI_CONFIG } from "../config";
import { buildDiagnosticProbePrompt } from "../prompts/prompt-assembly";
import type { AdaptiveLoopState } from "../types";

export async function buildDiagnosticProbe(ctx: TurnBuilderContext): Promise<AssessmentTurnResponse> {
  const { action, state } = ctx;
  const startTime = Date.now();
  const construct = state.currentConstruct ?? "FLUID_REASONING";
  const act2Progress = (state.act2Progress as Record<string, AdaptiveLoopState> | null) ?? {};
  const loopState = act2Progress[construct];

  // Compute performance summary from loop state
  const allResults = [
    ...(loopState?.calibrationResults ?? []),
    ...(loopState?.boundaryResults ?? []),
    ...(loopState?.pressureResults ?? []),
  ];
  const itemCount = allResults.length;
  const correctCount = allResults.filter((r) => r.correct).length;
  const avgResponseTimeMs = itemCount > 0
    ? Math.round(allResults.reduce((sum, r) => sum + r.responseTimeMs, 0) / itemCount)
    : 0;

  let spokenText: string;

  // Try Haiku generation
  try {
    const formatName = construct.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    const prompt = buildDiagnosticProbePrompt({
      constructName: formatName,
      itemCount,
      correctCount,
      avgResponseTimeMs,
      performancePattern: itemCount > 0
        ? `${correctCount}/${itemCount} correct, avg ${avgResponseTimeMs}ms`
        : "No items completed yet",
    });

    spokenText = await generateBuffered(prompt);
  } catch {
    // Fallback to a generic probe
    spokenText = "Walk me through your thinking on those problems. Where did it get tricky for you?";
  }

  const latencyMs = Date.now() - startTime;

  return {
    type: "turn",
    delivery: { sentences: splitSentences(spokenText) },
    input: {
      type: "voice-or-text",
      silenceThresholds: getSilenceThresholds("ACT_2"),
    },
    signal: {
      format: "DIAGNOSTIC_PROBE",
      act: "ACT_2",
      primaryConstructs: [construct as any],
      secondaryConstructs: [],
      constructId: construct as any,
      phase: "DIAGNOSTIC_PROBE",
    },
    meta: buildMeta(state, "hybrid", { latencyMs }),
  };
}

async function generateBuffered(systemPrompt: string): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("No API key");

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), AI_CONFIG.realtimeTimeoutMs);

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: AI_CONFIG.realtimeModel,
        max_tokens: 300,
        temperature: 0.7,
        messages: [{ role: "user", content: systemPrompt }],
      }),
      signal: controller.signal,
    });

    if (!response.ok) throw new Error(`Haiku returned ${response.status}`);
    const data = await response.json();
    return (data.content?.[0]?.text || "").trim();
  } finally {
    clearTimeout(timeoutId);
  }
}

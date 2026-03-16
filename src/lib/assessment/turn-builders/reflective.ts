/**
 * F9: REFLECTIVE_ASSESSMENT TurnBuilder — Act 3 Phase 3.
 * Haiku generates reflective questions (buffered per B-1). Input type: voice-or-text.
 */
import type { TurnBuilderContext } from "./context";
import type { AssessmentTurnResponse } from "@/lib/types/turn";
import { splitSentences, buildMeta, getSilenceThresholds } from "./helpers";
import { AI_CONFIG } from "../config";
import { buildReflectivePrompt } from "../prompts/prompt-assembly";

export async function buildReflective(ctx: TurnBuilderContext): Promise<AssessmentTurnResponse> {
  const { state } = ctx;
  const startTime = Date.now();

  let spokenText: string;

  try {
    const prompt = buildReflectivePrompt();
    spokenText = await generateBuffered(prompt);
  } catch {
    spokenText = "Looking back at everything we've talked about — which parts felt easiest to you? Which felt hardest?";
  }

  const latencyMs = Date.now() - startTime;

  return {
    type: "turn",
    delivery: { sentences: splitSentences(spokenText) },
    input: {
      type: "voice-or-text",
      silenceThresholds: getSilenceThresholds("ACT_3"),
    },
    signal: {
      format: "REFLECTIVE_ASSESSMENT",
      act: "ACT_3",
      primaryConstructs: ["METACOGNITIVE_CALIBRATION"],
      secondaryConstructs: ["LEARNING_VELOCITY"],
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

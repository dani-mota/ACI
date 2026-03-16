/**
 * F2: OPEN_PROBE TurnBuilder — Act 1 Beats 1-5.
 * Hybrid generation: classify → acknowledge → content library OR stream from Haiku.
 * Input type: voice-or-text.
 */
import type { TurnBuilderContext } from "./context";
import type { AssessmentTurnResponse, ReferenceUpdate } from "@/lib/types/turn";
import type { ResponseClassification } from "../types";
import { splitSentences, buildMeta, getSilenceThresholds } from "./helpers";
import { lookupBeatContent } from "../content-serving";
import { SCENARIOS } from "../scenarios";
import { AI_CONFIG } from "../config";
import { ARIA_PERSONA } from "../prompts/aria-persona";
import { getProbeConfig, getConstructIndicators } from "../scenario-probes";
import { verifyProbePresent, addProbeReinforcement } from "../probe-verification";
import { sanitizeAriaOutput } from "../sanitize";

export async function buildOpenProbe(ctx: TurnBuilderContext): Promise<AssessmentTurnResponse> {
  const { action, state, contentLibrary, variantSelections, acknowledgment, classificationResult } = ctx;
  const meta = ("metadata" in action ? action.metadata : undefined) as Record<string, unknown> | undefined;
  const scenarioIndex = (meta?.scenarioIndex as number) ?? state.currentScenario;
  const beatIndex = (meta?.beatIndex as number) ?? state.currentBeat;
  const scenario = SCENARIOS[scenarioIndex];
  const beat = scenario?.beats[beatIndex];
  const startTime = Date.now();

  // Determine classification from state's branch path
  const branchPath = (state.branchPath as ResponseClassification[] | null) ?? [];
  const classification: ResponseClassification = branchPath[branchPath.length - 1] ?? "ADEQUATE";

  let spokenText = "";
  let referenceUpdate: ReferenceUpdate | undefined;
  let generationMethod: "pre-generated" | "hybrid" | "streamed" = "hybrid";

  // Beats 1-2 force streaming for personalization (PRD §3.2)
  const forceStreaming = beatIndex >= 1 && beatIndex <= 2;

  // Try pre-generated content for beats 3-5
  if (!forceStreaming && contentLibrary && variantSelections) {
    try {
      const content = lookupBeatContent(contentLibrary, scenarioIndex, beatIndex, classification, variantSelections);
      const ack = acknowledgment || "";
      spokenText = beatIndex === 0
        ? content.spokenText
        : `${ack} ${content.spokenText}`.trim();
      referenceUpdate = content.referenceUpdate as ReferenceUpdate | undefined;
      generationMethod = "pre-generated";
    } catch {
      // Fall through to Haiku streaming
    }
  }

  // Haiku generation path (streaming buffered per B-1)
  if (!spokenText) {
    const probeConfig = getProbeConfig(scenarioIndex, beatIndex);

    try {
      const systemPrompt = buildStreamingPrompt(ctx, scenarioIndex, beatIndex, classification);
      const userContext = "userContext" in action ? (action as any).userContext : "Generate Aria's next response.";
      let response = await generateFromHaiku(systemPrompt, userContext);
      const { cleaned } = sanitizeAriaOutput(response);
      response = cleaned;

      // Probe verification (PRD §3.2 Step 5): check if required probe is present
      if (probeConfig && probeConfig.primaryProbe) {
        const check = verifyProbePresent(response, probeConfig);
        if (!check.found) {
          // Retry at temperature 0.3 with reinforced instruction
          console.warn("[open-probe] Probe missing, retrying at temp 0.3");
          try {
            const retryPrompt = addProbeReinforcement(systemPrompt, probeConfig.primaryProbe);
            const retryResponse = await generateFromHaiku(retryPrompt, userContext, 0.3);
            const { cleaned: retryCleaned } = sanitizeAriaOutput(retryResponse);
            const retryCheck = verifyProbePresent(retryCleaned, probeConfig);
            if (retryCheck.found) {
              response = retryCleaned;
            } else {
              // Fall back to content library
              console.warn("[open-probe] Retry also missing probe, falling back to content library");
              throw new Error("Probe verification failed after retry");
            }
          } catch {
            throw new Error("Probe verification failed");
          }
        }
      }

      spokenText = response;
      generationMethod = forceStreaming ? "streamed" : "hybrid";
    } catch {
      // Fallback: use content library even for beats 1-2
      if (contentLibrary && variantSelections) {
        try {
          const content = lookupBeatContent(contentLibrary, scenarioIndex, beatIndex, classification, variantSelections);
          spokenText = content.spokenText;
          referenceUpdate = content.referenceUpdate as ReferenceUpdate | undefined;
          generationMethod = "pre-generated";
        } catch {
          spokenText = probeConfig?.primaryProbe
            ? `Let me ask you this: ${probeConfig.primaryProbe}`
            : "Let me rephrase that. What would you do in this situation?";
          generationMethod = "pre-generated";
        }
      } else {
        spokenText = probeConfig?.primaryProbe
          ? `Let me ask you this: ${probeConfig.primaryProbe}`
          : "Let me rephrase that. What would you do in this situation?";
        generationMethod = "pre-generated";
      }
    }
  }

  const latencyMs = Date.now() - startTime;

  return {
    type: "turn",
    delivery: {
      sentences: splitSentences(spokenText),
      ...(referenceUpdate ? { referenceUpdate } : {}),
    },
    input: {
      type: "voice-or-text",
      silenceThresholds: getSilenceThresholds("ACT_1"),
    },
    signal: {
      format: "OPEN_PROBE",
      act: "ACT_1",
      primaryConstructs: (beat?.primaryConstructs ?? []) as any[],
      secondaryConstructs: (beat?.secondaryConstructs ?? []) as any[],
      scenarioIndex,
      beatIndex,
      beatType: beat?.type as any,
    },
    meta: buildMeta(state, generationMethod, { latencyMs }),
  };
}

/** Build the system prompt for Haiku streaming (uses engine prompt + enhancements). */
function buildStreamingPrompt(
  ctx: TurnBuilderContext,
  scenarioIndex: number,
  beatIndex: number,
  classification: ResponseClassification,
): string {
  const { action, roleContext, candidateName, lastCandidateMessage } = ctx;
  let systemPrompt = (action as any).systemPrompt || ARIA_PERSONA;

  if (roleContext && !roleContext.isGeneric) {
    systemPrompt += `\n\nROLE CONTEXT: The candidate is being assessed for ${roleContext.roleName}. Domain: ${roleContext.environment}.`;
  }
  if (candidateName) {
    systemPrompt += `\nCandidate name: ${candidateName}. You may address them by name once.`;
  }
  if (lastCandidateMessage && beatIndex === 2) {
    systemPrompt += `\n\nIMPORTANT PERSONALIZATION:
- Begin with ONE sentence referencing something specific the candidate said.
- The complication MUST directly challenge their specific approach.`;
  } else if (lastCandidateMessage && beatIndex > 2) {
    systemPrompt += `\n\nIMPORTANT: Begin with a brief sentence acknowledging something specific the candidate said.`;
  }

  return systemPrompt;
}

/** Call Haiku to generate a buffered response (per B-1: no server-side streaming on Vercel). */
async function generateFromHaiku(systemPrompt: string, userContext: string, temperature = 0.7): Promise<string> {
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
        max_tokens: 500,
        temperature,
        system: systemPrompt,
        messages: [{ role: "user", content: userContext }],
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

/**
 * F2: OPEN_PROBE TurnBuilder — Act 1 Beats 1-5.
 * Hybrid generation: classify → acknowledge → content library OR stream from Haiku.
 * Input type: voice-or-text.
 */
import type { TurnBuilderContext } from "./context";
import type { AssessmentTurnResponse, ReferenceUpdate, ScenarioReferenceData } from "@/lib/types/turn";
import type { ResponseClassification } from "../types";
import { splitSentences, buildMeta, getSilenceThresholds } from "./helpers";
import { lookupBeatContent } from "../content-serving";
import { SCENARIOS } from "../scenarios";
import { AI_CONFIG } from "../config";
import { ARIA_PERSONA } from "../prompts/aria-persona";
import { getProbeConfig, getConstructIndicators } from "../scenario-probes";
import { verifyProbePresent, addProbeReinforcement } from "../probe-verification";
import { sanitizeAriaOutput } from "../sanitize";
import { assembleOpenProbePrompt } from "../prompts/prompt-assembly";

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
  let referenceCard: ScenarioReferenceData | undefined;
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
      let systemPrompt: string;
      let userContext: string;

      if (forceStreaming && scenario && beat) {
        // Beats 1-2: 4-layer prompt (PRD §10) — includes candidate response + history
        // Sentinels are normalized to "" so Haiku never tries to "acknowledge" text the
        // candidate never said. AUTO_ADVANCE = opening turn (Beat 1 not yet asked);
        // NO_RESPONSE = candidate was given time but said nothing. Different instructions apply.
        const isNoResponse = ctx.lastCandidateMessage === "[NO_RESPONSE]";
        const isOpeningTurn = ctx.isSentinel && !isNoResponse;
        const assembled = assembleOpenProbePrompt({
          candidateName: ctx.candidateName,
          roleContext: ctx.roleContext,
          scenario,
          scenarioIndex,
          beat,
          candidateResponse: (ctx.isSentinel || !ctx.lastCandidateMessage) ? "" : ctx.lastCandidateMessage,
          classification,
          messages: ctx.messages,
          isOpeningTurn,
        });
        systemPrompt = assembled.systemPrompt;
        // Reinforce the engine's userContext when available (e.g., "Do NOT re-explain the scenario")
        const engineUserContext = "userContext" in action ? (action as any).userContext as string : "";
        userContext = engineUserContext
          ? `${assembled.userContext}\n\nADDITIONAL INSTRUCTIONS: ${engineUserContext}`
          : assembled.userContext;
      } else {
        // Beat 0 fallback or missing scenario: legacy inline prompt
        systemPrompt = buildStreamingPrompt(ctx, scenarioIndex, beatIndex, classification);
        userContext = "userContext" in action ? (action as any).userContext : "Generate Aria's next response.";
      }

      let response = await generateFromHaiku(systemPrompt, userContext);
      // Extract ---REFERENCE--- / ---REFERENCE_UPDATE--- before sanitizing — prevents JSON leaking into TTS
      const extracted = extractReferenceFromHaikuResponse(response);
      response = extracted.spoken;
      if (extracted.referenceCard) referenceCard = extracted.referenceCard;
      if (extracted.referenceUpdate) referenceUpdate = extracted.referenceUpdate;
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
            const retryRaw = await generateFromHaiku(retryPrompt, userContext, 0.3);
            const retryExtracted = extractReferenceFromHaikuResponse(retryRaw);
            if (retryExtracted.referenceCard) referenceCard = retryExtracted.referenceCard;
            if (retryExtracted.referenceUpdate) referenceUpdate = retryExtracted.referenceUpdate;
            const { cleaned: retryCleaned } = sanitizeAriaOutput(retryExtracted.spoken);
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
      ...(referenceCard ? { referenceCard } : {}),
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

/**
 * Strip ---REFERENCE--- / ---REFERENCE_UPDATE--- delimiter blocks from a raw Haiku response
 * and parse any embedded reference data. Returns the spoken-only text and any parsed data.
 * Prevents reference card JSON from leaking into TTS speech.
 */
function extractReferenceFromHaikuResponse(raw: string): {
  spoken: string;
  referenceCard?: ScenarioReferenceData;
  referenceUpdate?: ReferenceUpdate;
} {
  const UPDATE_DELIM = "---REFERENCE_UPDATE---";
  const CARD_DELIM = "---REFERENCE---";

  const updateIdx = raw.indexOf(UPDATE_DELIM);
  if (updateIdx !== -1) {
    const spoken = raw.slice(0, updateIdx).trim();
    try {
      const parsed = JSON.parse(raw.slice(updateIdx + UPDATE_DELIM.length).trim());
      if (Array.isArray(parsed.newInformation) && typeof parsed.question === "string") {
        return { spoken, referenceUpdate: parsed as ReferenceUpdate };
      }
    } catch { /* malformed JSON — skip */ }
    return { spoken };
  }

  const cardIdx = raw.indexOf(CARD_DELIM);
  if (cardIdx !== -1) {
    const spoken = raw.slice(0, cardIdx).trim();
    try {
      const parsed = JSON.parse(raw.slice(cardIdx + CARD_DELIM.length).trim());
      if (typeof parsed.role === "string" && Array.isArray(parsed.sections)) {
        return { spoken, referenceCard: parsed as ScenarioReferenceData };
      }
    } catch { /* malformed JSON — skip */ }
    return { spoken };
  }

  return { spoken: raw };
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

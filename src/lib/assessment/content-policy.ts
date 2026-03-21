/**
 * Content Delivery Policy Layer
 *
 * Sits between TurnBuilder output and Turn delivery. Enforces 5 rules
 * that ensure every Turn meets quality standards for the candidate experience.
 *
 * Rules (applied in order — replacement rules first, then additive):
 *   5. Silence recovery must be supportive, not directive
 *   3. No exact repetition within a scenario
 *   4. Hardcoded fallback catch (safety net)
 *   2. Acknowledgment enforcement
 *   1. Question enforcement
 */

import type { AssessmentTurnResponse } from "@/lib/types/turn";
import type { TurnBuilderContext } from "./turn-builders/context";
import { getProbeConfig } from "./scenario-probes";
import { createLogger } from "./logger";

const log = createLogger("content-policy");

// ── Helpers ─────────────────────────────────────────────

/**
 * Jaccard word-set similarity between two strings.
 * Returns 0-1 where 1 means identical word sets.
 */
export function jaccardSimilarity(a: string, b: string): number {
  const setA = new Set(a.toLowerCase().replace(/[^\w\s]/g, "").split(/\s+/).filter(Boolean));
  const setB = new Set(b.toLowerCase().replace(/[^\w\s]/g, "").split(/\s+/).filter(Boolean));
  const intersection = new Set([...setA].filter((x) => setB.has(x)));
  const union = new Set([...setA, ...setB]);
  return union.size === 0 ? 0 : intersection.size / union.size;
}

const REDIRECT_PHRASES = [
  "Let me come at this from a different angle.",
  "I want to explore a different dimension of this.",
  "Let me shift focus here.",
];

const SUPPORTIVE_SILENCE_PHRASES = [
  "No worries — this is a lot to think about. Let me give you a different angle.",
  "That's okay — take a moment if you need it. Here's another way to look at this.",
  "I know there's a lot going on in this situation. Let me shift the focus a bit.",
];

const BEAT_TYPE_PREFIXES: Record<string, string> = {
  INITIAL_RESPONSE: "I'd like to hear your take on this.",
  COMPLICATION: "Given this new development —",
  SOCIAL_PRESSURE: "That's a lot of pressure coming from different directions.",
  CONSEQUENCE_REVEAL: "Now that you've seen how that played out —",
  REFLECTIVE_SYNTHESIS: "Stepping back from the whole situation —",
};

// ── Policy Function ─────────────────────────────────────

export function applyContentPolicy(
  turn: AssessmentTurnResponse,
  ctx: TurnBuilderContext,
): AssessmentTurnResponse {
  // Deep clone to avoid mutating the original
  const result = structuredClone(turn);

  const beatType = result.signal.beatType;
  const beatIndex = result.signal.beatIndex ?? ctx.state.currentBeat;
  const scenarioIndex = result.signal.scenarioIndex ?? ctx.state.currentScenario;

  // ── Rule 5: Silence recovery must be supportive ────────
  if (ctx.isSentinel && ctx.lastCandidateMessage === "[NO_RESPONSE]") {
    const firstSentence = result.delivery.sentences[0] ?? "";
    const lower = firstSentence.toLowerCase();
    if (lower.startsWith("tell me more") || lower.startsWith("walk me through")) {
      const replacement = SUPPORTIVE_SILENCE_PHRASES[beatIndex % SUPPORTIVE_SILENCE_PHRASES.length];
      result.delivery.sentences[0] = replacement;
      log.info("Rule 5 fired: replaced directive silence recovery", { beatIndex });
    }
  }

  // ── Rule 3: No exact repetition within a scenario ──────
  const spokenText = result.delivery.sentences.join(" ");
  const recentAgentMessages = ctx.messages
    .filter((m) => m.role === "AGENT" && m.act === ctx.state.currentAct)
    .slice(-5)
    .map((m) => m.content);

  for (const recent of recentAgentMessages) {
    const similarity = jaccardSimilarity(spokenText, recent);
    if (similarity > 0.8) {
      const probeConfig = getProbeConfig(scenarioIndex, beatIndex);
      if (probeConfig?.primaryProbe) {
        const redirect = REDIRECT_PHRASES[beatIndex % REDIRECT_PHRASES.length];
        result.delivery.sentences = [redirect, probeConfig.primaryProbe];
        log.info("Rule 3 fired: deduplicated response", {
          similarity: Math.round(similarity * 100) / 100,
          beatIndex,
        });
      }
      break;
    }
  }

  // ── Rule 4: Hardcoded fallback catch (safety net) ──────
  const joined = result.delivery.sentences.join(" ");
  if (
    joined.includes("Let me rephrase that") ||
    joined.includes("Tell me more about how you'd approach this situation")
  ) {
    const probeConfig = getProbeConfig(scenarioIndex, beatIndex);
    if (probeConfig?.primaryProbe) {
      const prefix = beatType ? (BEAT_TYPE_PREFIXES[beatType] ?? "") : "";
      result.delivery.sentences = [
        `${prefix} ${probeConfig.primaryProbe}`.trim(),
      ];
      log.info("Rule 4 fired: replaced leaked hardcoded fallback", { beatIndex });
    }
  }

  // ── Rule 2: Acknowledgment enforcement ─────────────────
  const isConversational = result.signal.format === "OPEN_PROBE";
  const skipAck =
    ctx.isSentinel ||
    beatType === "INITIAL_SITUATION" ||
    !isConversational;

  if (!skipAck && ctx.acknowledgment && ctx.acknowledgment.length > 0) {
    const firstSentence = result.delivery.sentences[0] ?? "";
    const wordCount = firstSentence.split(/\s+/).length;
    // If first sentence is long (>30 words), it's likely jumping straight to content
    if (wordCount > 30) {
      result.delivery.sentences.unshift(ctx.acknowledgment);
      log.info("Rule 2 fired: prepended acknowledgment", { beatIndex });
    }
  }

  // ── Rule 1: Every Turn MUST end with a question ────────
  const skipQuestion =
    beatType === "INITIAL_SITUATION" ||
    result.input.type === "none";

  if (!skipQuestion) {
    const sentences = result.delivery.sentences;
    const lastTwo = sentences.slice(-2);
    const hasQuestion = lastTwo.some((s) => s.includes("?"));

    if (!hasQuestion) {
      const probeConfig = getProbeConfig(scenarioIndex, beatIndex);
      if (probeConfig?.primaryProbe) {
        result.delivery.sentences.push(probeConfig.primaryProbe);
        log.info("Rule 1 fired: appended probe question", {
          beatType,
          probe: probeConfig.primaryProbe,
        });
      }
    }
  }

  return result;
}

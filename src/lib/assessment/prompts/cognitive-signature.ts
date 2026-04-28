/**
 * PRO-130: Cognitive Signature (Layer 1) prompt + forbidden-language guard + fallback builder.
 *
 * The Cognitive Signature is a 2–4 sentence narrative paragraph describing what makes
 * an employee cognitively distinctive. It is the entry point of the Employee Dossier;
 * developmental framing is non-negotiable.
 */

import { CONSTRUCTS, LAYER_INFO, type LayerType } from "@/lib/constructs";

export interface SubtestScore {
  construct: string;
  percentile: number;
  layer?: LayerType | string | null;
}

export interface BuildPromptInput {
  firstName: string;
  subtestResults: SubtestScore[];
}

interface ScoredConstruct {
  name: string;
  percentile: number;
  layer: LayerType;
}

interface PromptPair {
  system: string;
  user: string;
}

// Bumped by PRO-134 when the rules tighten. Mismatched rows regenerate on next view.
export const CURRENT_PROMPT_VERSION = 1;

/**
 * AC's 8 forbidden phrases verbatim. Wider scrubbing belongs to PRO-134.
 * Known false-positive: "threshold" matches legitimate developmental uses like
 * "low threshold for ambiguity." Acceptable here; PRO-134 will need context-aware handling.
 */
const FORBIDDEN_PATTERNS: RegExp[] = [
  /\bred[ -]?flag\b/i,
  /\bconcern\b/i, // matches "concern" / "concerns" but NOT "concerning" by design
  /\brisk\b/i,
  /\bnot[ -]?recommended\b/i,
  /\bdecline\b/i,
  /\bcutline\b/i,
  /\bthreshold\b/i,
  /\bpercentile\s+of\s+candidates\b/i,
];

export function containsForbiddenLanguage(text: string): boolean {
  return FORBIDDEN_PATTERNS.some((re) => re.test(text));
}

/**
 * Convert raw subtestResults into ranked, friendly-named construct entries.
 * Sorted descending by percentile.
 */
function rankConstructs(subtestResults: SubtestScore[]): ScoredConstruct[] {
  return subtestResults
    .map((r) => {
      const meta = CONSTRUCTS[r.construct];
      return {
        name: meta?.name ?? r.construct,
        percentile: r.percentile,
        layer: (meta?.layer ?? r.layer ?? "COGNITIVE_CORE") as LayerType,
      };
    })
    .sort((a, b) => b.percentile - a.percentile);
}

function computeLayerAverages(ranked: ScoredConstruct[]): { layer: LayerType; name: string; avg: number }[] {
  const layers: LayerType[] = ["COGNITIVE_CORE", "TECHNICAL_APTITUDE", "BEHAVIORAL_INTEGRITY"];
  return layers.map((layer) => {
    const items = ranked.filter((r) => r.layer === layer);
    const avg = items.length > 0 ? Math.round(items.reduce((s, r) => s + r.percentile, 0) / items.length) : 0;
    return { layer, name: LAYER_INFO[layer].name, avg };
  });
}

const SYSTEM_PROMPT = `You are writing a Cognitive Signature: a 2–4 sentence narrative paragraph that describes what makes a person cognitively distinctive. This appears at the top of an employee development dossier read by managers. The framing is strictly DEVELOPMENTAL — describe observable patterns, never evaluate.

ABSOLUTE PROHIBITIONS (these phrases will be regex-blocked, output containing them is discarded):
- "red flag" / "redflag"
- "concern" / "concerns"
- "risk" / "risks"
- "not recommended"
- "decline"
- "cutline"
- "threshold"
- "percentile of candidates"

AVOID (soft guidance — use neutral descriptive alternatives):
- Evaluative vocabulary: "weak", "poor", "deficient", "worrying", "inadequate"
- Use instead: "lower", "developing", "under-leveraged", "less practiced"

REQUIRED STYLE:
- 2–4 sentences. Plain English. No markdown, no headers, no bullets.
- Refer to constructs by their friendly names (e.g., "ambiguity tolerance"), never raw enum codes.
- Third person, present tense.
- Pair a strength cluster with a complementary "under-leveraged in" framing — show where the person thrives AND where their profile is being underused.

EXEMPLAR (preserve this voice and structure):
"Maria's profile is defined by unusually high ambiguity tolerance paired with strong systems thinking and a deliberate decision cadence. She is at her best in problems that are under-defined and cross-functional; she is under-leveraged in problems with a known answer."

Output ONLY the paragraph. No preamble, no quotes, no explanation.`;

export function buildCognitiveSignaturePrompt(input: BuildPromptInput): PromptPair {
  const ranked = rankConstructs(input.subtestResults);
  const layerAverages = computeLayerAverages(ranked);

  const scoreLines = ranked
    .map((r) => `- ${r.name} (${r.layer}): ${r.percentile}`)
    .join("\n");
  const layerLines = layerAverages
    .map((l) => `- ${l.name}: ${l.avg}`)
    .join("\n");

  const user = `Employee first name: ${input.firstName}

Construct scores (sorted highest to lowest, scale 0–100):
${scoreLines}

Layer averages:
${layerLines}

Write the Cognitive Signature paragraph for ${input.firstName}.`;

  return { system: SYSTEM_PROMPT, user };
}

/**
 * Deterministic fallback narrative used when Haiku fails or returns
 * forbidden language. NOT cached on the assessment row — built on demand
 * so a transient outage doesn't permanently stick a fallback on an employee.
 *
 * Free of forbidden phrases by construction.
 */
export function buildFallbackSignature(input: BuildPromptInput): string {
  const ranked = rankConstructs(input.subtestResults);
  if (ranked.length === 0) {
    return `${input.firstName}'s cognitive profile is being prepared. A detailed signature will appear here once assessment data is available.`;
  }

  const top = ranked.slice(0, 3);
  const bottom = ranked.slice(-2);

  const strengthsList =
    top.length === 1
      ? top[0].name
      : top.length === 2
        ? `${top[0].name} and ${top[1].name}`
        : `${top[0].name}, ${top[1].name}, and ${top[2].name}`;

  const devList =
    bottom.length === 0
      ? ""
      : bottom.length === 1
        ? bottom[0].name
        : `${bottom[0].name} and ${bottom[1].name}`;

  const sentenceA = `${input.firstName}'s profile shows distinctive strength in ${strengthsList}.`;
  const sentenceB = devList
    ? ` Their profile is more developing in ${devList}, which suggests where additional practice and leverage could most expand their range.`
    : ` Their profile is balanced across the construct set.`;

  return sentenceA + sentenceB;
}

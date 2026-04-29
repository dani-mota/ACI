/**
 * PRO-132: Evidence Annotation prompt + fallback builder for the Employee Dossier Layer 3.
 *
 * Annotation = a 1-sentence developmental-framing description of what signal a specific
 * candidate response demonstrates for a given construct. Manager reads it and says
 * "yes, that's exactly right — I've seen that behavior."
 *
 * The excerpt itself is real ConversationMessage.content (never paraphrased here).
 * Haiku ONLY writes the annotation.
 *
 * Forbidden vocabulary handling consumes the canonical list from
 * `evaluative-vocabulary.ts` (PRO-134). Re-exported here so the API route can
 * pull both the prompt builder and the guard from one module.
 */

import { CONSTRUCTS, LAYER_INFO, type LayerType } from "@/lib/constructs";
import { containsForbiddenLanguage } from "./evaluative-vocabulary";

// Re-export so the API route imports both pieces from one module.
export { containsForbiddenLanguage };

// PRO-134: bumped to 2 when prompt rules tightened (wider soft-guidance list).
// Existing v1 EvidenceAnnotation rows regenerate on next expand because the
// hot-path cache check requires `promptVersion === CURRENT_PROMPT_VERSION`.
export const CURRENT_PROMPT_VERSION = 2;

export interface BuildEvidenceAnnotationPromptInput {
  construct: string;
  employeeName: string;
  messageContent: string;
}

interface PromptPair {
  system: string;
  user: string;
}

const SYSTEM_PROMPT = `You are writing a single-sentence Evidence Annotation for an Employee Dossier. The annotation describes what signal a specific candidate response demonstrates for a particular cognitive construct. Managers read the annotation alongside the actual quoted response. The framing is strictly DEVELOPMENTAL — describe observable behavior, never evaluate.

ABSOLUTE PROHIBITIONS (the output is regex-blocked if it contains any of these phrases):
- "red flag" / "redflag"
- "concern" / "concerns"
- "risk" / "risks"
- "not recommended"
- "decline"
- "cutline"
- "threshold"
- "percentile of candidates"

AVOID (use neutral descriptive alternatives):
- Evaluative vocabulary: "weak", "poor", "deficient", "worrying", "inadequate", "good", "bad", "excellent", "concerning"
- Verdict language: "this is right/wrong", "this shows X is a problem", "needs improvement"
- Use instead: "lower", "developing", "under-leveraged", "less practiced", "characteristic of", "tends to"

REQUIRED STYLE:
- ONE sentence. Plain English. No markdown, no headers, no bullets.
- Lead with "This response shows…", "[Name]'s response demonstrates…", or similar third-person observable framing.
- Refer to the construct by its friendly name (not its enum code).
- Stay close to the response — don't generalize beyond what's observable.

EXAMPLES (preserve this voice):
- "This response shows Maria pausing to clarify the question's framing before committing — characteristic of high metacognitive calibration."
- "Sam's response demonstrates fluid reasoning by reframing the constraint as an optimization rather than a blocker."

Output ONLY the single sentence. No preamble, no quotes, no explanation.`;

export function buildEvidenceAnnotationPrompt(
  input: BuildEvidenceAnnotationPromptInput,
): PromptPair {
  const meta = CONSTRUCTS[input.construct];
  const friendlyName = meta?.name ?? input.construct;
  const definition = meta?.definition ?? "";

  const user = `Employee first name: ${input.employeeName}
Construct: ${friendlyName}${definition ? ` — ${definition}` : ""}

Candidate response:
"""
${input.messageContent}
"""

Write the single-sentence Evidence Annotation for this response and construct.`;

  return { system: SYSTEM_PROMPT, user };
}

/**
 * Layer-keyed deterministic fallback templates. Used when Haiku fails or returns
 * forbidden language. NOT cached on the row — built on demand so a transient
 * outage doesn't permanently stick a fallback on an employee.
 *
 * Three templates (one per construct family) instead of one universal sentence
 * repeated 12 times — reads less mechanical when fallback fires for several
 * constructs in the same session.
 */
export interface BuildFallbackAnnotationInput {
  construct: string;
  employeeName: string;
}

export function buildFallbackAnnotation(input: BuildFallbackAnnotationInput): string {
  const meta = CONSTRUCTS[input.construct];
  const friendlyName = meta?.name ?? input.construct;
  const layer: LayerType = meta?.layer ?? "COGNITIVE_CORE";
  const layerInfo = LAYER_INFO[layer];
  const employee = input.employeeName;

  switch (layer) {
    case "COGNITIVE_CORE":
      return `This response sits within ${employee}'s ${layerInfo.name} profile and reflects how they engage with ${friendlyName}.`;
    case "TECHNICAL_APTITUDE":
      return `${employee}'s response demonstrates engagement with ${friendlyName} as part of their ${layerInfo.name} profile.`;
    case "BEHAVIORAL_INTEGRITY":
      return `This response gives a window into ${employee}'s ${friendlyName} as part of their ${layerInfo.name} profile.`;
  }
}

/**
 * PRO-139: Stretch-context phrases per construct.
 *
 * Sourced by `computePromotionFit` to fill the {stretch context} slot in the
 * AC's middle verdict: "Profile aligns with approximately {N} months of
 * {stretch context}." Phrase is keyed by the construct with the *largest
 * under-spec gap* — i.e., the development area most likely to close the
 * promotion-readiness delta.
 *
 * Vocabulary discipline (PRO-134): phrases describe the *experience* needed,
 * not a deficiency. No "lacks", "needs", "weakness". Frame as work-shaped
 * development — what kind of exposure would build the construct.
 *
 * Exhaustiveness is type-enforced via `Record<keyof typeof CONSTRUCTS, string>`.
 * Adding a new construct to CONSTRUCTS without updating this map is a
 * compile-time error.
 */

import { CONSTRUCTS } from "@/lib/constructs";

type ConstructKey = keyof typeof CONSTRUCTS;

export const STRETCH_CONTEXTS: Record<ConstructKey, string> = {
  FLUID_REASONING:
    "leading novel troubleshooting work on unfamiliar equipment or materials",
  EXECUTIVE_CONTROL:
    "managing concurrent priorities under sustained production pressure",
  COGNITIVE_FLEXIBILITY:
    "owning work that requires pivoting strategy when initial approaches fail",
  METACOGNITIVE_CALIBRATION:
    "leading reviews where calibrating confidence against evidence is the work",
  LEARNING_VELOCITY:
    "ramping on a new platform or domain end-to-end without hand-holding",
  SYSTEMS_DIAGNOSTICS:
    "owning root-cause investigations across interconnected production systems",
  PATTERN_RECOGNITION:
    "leading SPC or trend-analysis work where spotting drift is the deliverable",
  QUANTITATIVE_REASONING:
    "owning tolerance, capability, or cost-modeling work end-to-end",
  SPATIAL_VISUALIZATION:
    "leading complex programming or fixture-design work for unfamiliar geometry",
  MECHANICAL_REASONING:
    "owning force-analysis or workholding design for first-of-kind parts",
  PROCEDURAL_RELIABILITY:
    "owning a quality-critical process where protocol adherence is observable",
  ETHICAL_JUDGMENT:
    "owning escalation decisions where standing the standard up matters",
};

export function stretchContextFor(construct: string): string | undefined {
  return STRETCH_CONTEXTS[construct as ConstructKey];
}

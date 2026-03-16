/**
 * Assessment lifecycle states.
 * PRD §9.3. Includes SCORING_FAILED per pilot blocker P-12.
 */

export const ASSESSMENT_LIFECYCLE_STATES = [
  "CREATED",
  "PHASE_0",
  "ACT_1",
  "ACT_2",
  "ACT_3",
  "COMPLETED",
  "SCORING",
  "SCORED",
  "SCORING_FAILED",
  "INCOMPLETE",
  "ABANDONED",
] as const;

export type AssessmentLifecycle = (typeof ASSESSMENT_LIFECYCLE_STATES)[number];

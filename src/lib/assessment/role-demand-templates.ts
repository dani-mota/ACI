/**
 * PRO-135: In-code role demand profile templates.
 *
 * Templates are NOT seeded into the database — they're defined here and copied
 * into the org's profile list when an HR leader picks "Start from template" in
 * the authoring UI. That keeps the authoring component free of test data and
 * lets us swap the template set pre-launch without a data migration.
 *
 * Five baseline archetypes per the AC. Dani revisits before the Anduril/Hadrian
 * pilots with manufacturing-flavored defaults — out of scope for PRO-135.
 *
 * Construct keys match `Object.keys(CONSTRUCTS)` from `@/lib/constructs`. Values
 * are 1-10 (authoring scale). Missing keys mean the template doesn't take a
 * stance on that construct — the slider lands at midpoint and shows as unscored
 * until the user moves it.
 */

import type { AuthoringScores } from "@/lib/assessment/role-demand-resolution";

export interface RoleDemandTemplate {
  /** Stable identifier for the picker, not surfaced to users. */
  id: string;
  /** Editable on copy. */
  name: string;
  /** Editable on copy. */
  roleFamily: string;
  /** Shown in the picker so HR leaders can see what each template represents. */
  description: string;
  /** 1-10 per construct. Partial — see file-level note. */
  constructScores: AuthoringScores;
}

export const ROLE_DEMAND_TEMPLATES: RoleDemandTemplate[] = [
  {
    id: "ic-engineer",
    name: "Software Engineer — IC",
    roleFamily: "Engineering",
    description:
      "Individual-contributor engineer. High demand for analytical reasoning, learning velocity, and systems thinking; moderate behavioral demands.",
    constructScores: {
      FLUID_REASONING: 9,
      EXECUTIVE_CONTROL: 7,
      COGNITIVE_FLEXIBILITY: 8,
      METACOGNITIVE_CALIBRATION: 7,
      LEARNING_VELOCITY: 9,
      SYSTEMS_DIAGNOSTICS: 9,
      PATTERN_RECOGNITION: 8,
      QUANTITATIVE_REASONING: 8,
      SPATIAL_VISUALIZATION: 6,
      MECHANICAL_REASONING: 5,
      PROCEDURAL_RELIABILITY: 6,
      ETHICAL_JUDGMENT: 7,
    },
  },
  {
    id: "people-manager",
    name: "People Manager",
    roleFamily: "Management",
    description:
      "First-line people manager. High demand for behavioral integrity, calibration, and flexibility; technical aptitude is contextual.",
    constructScores: {
      FLUID_REASONING: 7,
      EXECUTIVE_CONTROL: 9,
      COGNITIVE_FLEXIBILITY: 9,
      METACOGNITIVE_CALIBRATION: 9,
      LEARNING_VELOCITY: 7,
      SYSTEMS_DIAGNOSTICS: 6,
      PATTERN_RECOGNITION: 7,
      PROCEDURAL_RELIABILITY: 8,
      ETHICAL_JUDGMENT: 9,
    },
  },
  {
    id: "tech-lead",
    name: "Technical Lead",
    roleFamily: "Engineering",
    description:
      "Senior engineer with team coordination scope. High demand across cognitive and technical layers, with strong behavioral integrity.",
    constructScores: {
      FLUID_REASONING: 9,
      EXECUTIVE_CONTROL: 8,
      COGNITIVE_FLEXIBILITY: 8,
      METACOGNITIVE_CALIBRATION: 8,
      LEARNING_VELOCITY: 9,
      SYSTEMS_DIAGNOSTICS: 9,
      PATTERN_RECOGNITION: 8,
      QUANTITATIVE_REASONING: 8,
      SPATIAL_VISUALIZATION: 6,
      MECHANICAL_REASONING: 6,
      PROCEDURAL_RELIABILITY: 7,
      ETHICAL_JUDGMENT: 8,
    },
  },
  {
    id: "operations",
    name: "Operations Specialist",
    roleFamily: "Operations",
    description:
      "Process-driven operations role. High demand for procedural reliability, quantitative reasoning, and pattern recognition.",
    constructScores: {
      FLUID_REASONING: 6,
      EXECUTIVE_CONTROL: 8,
      COGNITIVE_FLEXIBILITY: 6,
      METACOGNITIVE_CALIBRATION: 7,
      LEARNING_VELOCITY: 6,
      SYSTEMS_DIAGNOSTICS: 7,
      PATTERN_RECOGNITION: 8,
      QUANTITATIVE_REASONING: 8,
      PROCEDURAL_RELIABILITY: 9,
      ETHICAL_JUDGMENT: 8,
    },
  },
  {
    id: "strategy",
    name: "Strategy Analyst",
    roleFamily: "Strategy",
    description:
      "Strategic role with high ambiguity. Demands fluid reasoning, cognitive flexibility, calibration; lower technical specificity.",
    constructScores: {
      FLUID_REASONING: 9,
      EXECUTIVE_CONTROL: 7,
      COGNITIVE_FLEXIBILITY: 9,
      METACOGNITIVE_CALIBRATION: 9,
      LEARNING_VELOCITY: 8,
      SYSTEMS_DIAGNOSTICS: 7,
      PATTERN_RECOGNITION: 8,
      QUANTITATIVE_REASONING: 7,
      ETHICAL_JUDGMENT: 8,
    },
  },
];

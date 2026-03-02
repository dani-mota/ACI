import { ONET_ACI_MAPPINGS } from "./mapping";
import type { OnetOccupation } from "./dataset";
import type { OnetMatchResult } from "./matcher";

// All 12 ACI construct IDs
const ALL_CONSTRUCTS = [
  "FLUID_REASONING",
  "EXECUTIVE_CONTROL",
  "COGNITIVE_FLEXIBILITY",
  "METACOGNITIVE_CALIBRATION",
  "LEARNING_VELOCITY",
  "SYSTEMS_DIAGNOSTICS",
  "PATTERN_RECOGNITION",
  "QUANTITATIVE_REASONING",
  "SPATIAL_VISUALIZATION",
  "MECHANICAL_REASONING",
  "PROCEDURAL_RELIABILITY",
  "ETHICAL_JUDGMENT",
] as const;

// Minimum weight floor for each construct (prevents zeroing out any construct)
const MIN_WEIGHT = 2; // out of 100

/**
 * Derives ACI construct weights (0–100, summing to 100) from matched O*NET occupations.
 * matchWeights controls how much each occupation contributes (will be normalized).
 */
export function deriveWeightsFromOnet(
  matches: OnetMatchResult[]
): Record<string, number> {
  if (matches.length === 0) {
    // Return flat default weights if no matches
    const flat = Math.floor(100 / 12);
    const weights: Record<string, number> = {};
    ALL_CONSTRUCTS.forEach((c) => (weights[c] = flat));
    weights["FLUID_REASONING"] += 100 - flat * 12; // absorb rounding remainder
    return weights;
  }

  // Build a blend score: each occupation contributes proportionally to its match score
  const totalMatchScore = matches.reduce((s, m) => s + m.score, 0);
  const blendWeights = matches.map((m) => m.score / totalMatchScore);

  // Raw construct scores (accumulate importance × mapping weight across all occupations)
  const rawScores: Record<string, number> = {};
  ALL_CONSTRUCTS.forEach((c) => (rawScores[c] = 0));

  matches.forEach((match, idx) => {
    const occ: OnetOccupation = match.occupation;
    const blend = blendWeights[idx];

    // Process abilities
    occ.abilities.forEach((ability) => {
      const mappings = ONET_ACI_MAPPINGS.filter(
        (m) => m.onetId === ability.id || m.onetName === ability.name
      );
      mappings.forEach((mapping) => {
        if (mapping.aciConstruct in rawScores) {
          rawScores[mapping.aciConstruct] +=
            blend * ability.importance * mapping.mappingWeight;
        }
      });
    });

    // Process skills
    occ.skills.forEach((skill) => {
      const mappings = ONET_ACI_MAPPINGS.filter(
        (m) => m.onetId === skill.id || m.onetName === skill.name
      );
      mappings.forEach((mapping) => {
        if (mapping.aciConstruct in rawScores) {
          rawScores[mapping.aciConstruct] +=
            blend * skill.importance * mapping.mappingWeight * 0.8; // skills weighted slightly less than abilities
        }
      });
    });

    // Process work styles
    occ.workStyles.forEach((ws) => {
      const mappings = ONET_ACI_MAPPINGS.filter(
        (m) => m.onetId === ws.id || m.onetName === ws.name
      );
      mappings.forEach((mapping) => {
        if (mapping.aciConstruct in rawScores) {
          rawScores[mapping.aciConstruct] +=
            blend * ws.importance * mapping.mappingWeight * 0.7; // work styles weighted less than abilities
        }
      });
    });
  });

  // Apply minimum floor
  ALL_CONSTRUCTS.forEach((c) => {
    if (rawScores[c] < 1) rawScores[c] = 1;
  });

  // Normalize to sum = 100, with minimum floor of MIN_WEIGHT per construct
  const totalRaw = Object.values(rawScores).reduce((s, v) => s + v, 0);
  const normalized: Record<string, number> = {};
  ALL_CONSTRUCTS.forEach((c) => {
    normalized[c] = Math.max(MIN_WEIGHT, Math.round((rawScores[c] / totalRaw) * 100));
  });

  // Adjust for rounding drift — redistribute excess from highest-weighted construct
  const total = Object.values(normalized).reduce((s, v) => s + v, 0);
  const diff = 100 - total;
  if (diff !== 0) {
    // Add/subtract from FLUID_REASONING as the "adjustment construct"
    normalized["FLUID_REASONING"] = Math.max(
      MIN_WEIGHT,
      normalized["FLUID_REASONING"] + diff
    );
  }

  return normalized;
}

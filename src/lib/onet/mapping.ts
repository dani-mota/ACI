// O*NET element ID → ACI construct mapping table
// Based on the O*NET Content Model and ACI construct definitions

export interface OnetAciMapping {
  onetId: string;
  onetName: string;
  onetType: "ability" | "skill" | "workStyle";
  aciConstruct: string;
  mappingWeight: number; // 0–1, how strongly this element contributes
}

export const ONET_ACI_MAPPINGS: OnetAciMapping[] = [
  // ── FLUID_REASONING ──────────────────────────────────────────
  { onetId: "1.A.1.b.3", onetName: "Inductive Reasoning",   onetType: "ability",    aciConstruct: "FLUID_REASONING",             mappingWeight: 0.90 },
  { onetId: "1.A.1.b.4", onetName: "Deductive Reasoning",   onetType: "ability",    aciConstruct: "FLUID_REASONING",             mappingWeight: 0.85 },
  { onetId: "1.A.1.b.1", onetName: "Problem Sensitivity",   onetType: "ability",    aciConstruct: "SYSTEMS_DIAGNOSTICS",         mappingWeight: 0.80 },
  { onetId: "1.A.1.b.2", onetName: "Information Ordering",  onetType: "ability",    aciConstruct: "SYSTEMS_DIAGNOSTICS",         mappingWeight: 0.50 },

  // ── EXECUTIVE_CONTROL ────────────────────────────────────────
  { onetId: "1.A.1.g.1", onetName: "Selective Attention",   onetType: "ability",    aciConstruct: "EXECUTIVE_CONTROL",           mappingWeight: 0.90 },
  { onetId: "1.A.1.g.2", onetName: "Time Sharing",          onetType: "ability",    aciConstruct: "EXECUTIVE_CONTROL",           mappingWeight: 0.85 },
  { onetId: "1.A.1.d.1", onetName: "Memorization",          onetType: "ability",    aciConstruct: "EXECUTIVE_CONTROL",           mappingWeight: 0.45 },

  // ── COGNITIVE_FLEXIBILITY ────────────────────────────────────
  { onetId: "1.A.1.c.1", onetName: "Category Flexibility",  onetType: "ability",    aciConstruct: "COGNITIVE_FLEXIBILITY",       mappingWeight: 0.90 },
  { onetId: "1.C.4.b",   onetName: "Adaptability/Flexibility", onetType: "workStyle", aciConstruct: "COGNITIVE_FLEXIBILITY",     mappingWeight: 0.80 },
  { onetId: "1.C.4.c",   onetName: "Innovation",            onetType: "workStyle",  aciConstruct: "COGNITIVE_FLEXIBILITY",       mappingWeight: 0.60 },

  // ── METACOGNITIVE_CALIBRATION ────────────────────────────────
  { onetId: "1.C.5.b",   onetName: "Attention to Detail",   onetType: "workStyle",  aciConstruct: "METACOGNITIVE_CALIBRATION",   mappingWeight: 0.70 },
  { onetId: "1.C.6.a",   onetName: "Analytical Thinking",   onetType: "workStyle",  aciConstruct: "METACOGNITIVE_CALIBRATION",   mappingWeight: 0.65 },

  // ── LEARNING_VELOCITY ────────────────────────────────────────
  { onetId: "2.A.2.a",   onetName: "Active Learning",       onetType: "skill",      aciConstruct: "LEARNING_VELOCITY",           mappingWeight: 0.90 },
  { onetId: "1.C.4.a",   onetName: "Initiative",            onetType: "workStyle",  aciConstruct: "LEARNING_VELOCITY",           mappingWeight: 0.50 },
  { onetId: "1.C.7.a",   onetName: "Achievement/Effort",    onetType: "workStyle",  aciConstruct: "LEARNING_VELOCITY",           mappingWeight: 0.55 },

  // ── SYSTEMS_DIAGNOSTICS ──────────────────────────────────────
  { onetId: "2.B.2.i",   onetName: "Complex Problem Solving", onetType: "skill",    aciConstruct: "SYSTEMS_DIAGNOSTICS",         mappingWeight: 0.90 },
  { onetId: "2.B.3.k",   onetName: "Troubleshooting",       onetType: "skill",      aciConstruct: "SYSTEMS_DIAGNOSTICS",         mappingWeight: 0.85 },
  { onetId: "2.B.2.e",   onetName: "Systems Analysis",      onetType: "skill",      aciConstruct: "SYSTEMS_DIAGNOSTICS",         mappingWeight: 0.80 },
  { onetId: "2.B.2.f",   onetName: "Systems Evaluation",    onetType: "skill",      aciConstruct: "SYSTEMS_DIAGNOSTICS",         mappingWeight: 0.75 },

  // ── PATTERN_RECOGNITION ──────────────────────────────────────
  { onetId: "1.A.2.a.2", onetName: "Flexibility of Closure", onetType: "ability",   aciConstruct: "PATTERN_RECOGNITION",         mappingWeight: 0.90 },
  { onetId: "1.A.2.a.3", onetName: "Perceptual Speed",      onetType: "ability",    aciConstruct: "PATTERN_RECOGNITION",         mappingWeight: 0.85 },
  { onetId: "1.A.2.a.1", onetName: "Speed of Closure",      onetType: "ability",    aciConstruct: "PATTERN_RECOGNITION",         mappingWeight: 0.80 },

  // ── QUANTITATIVE_REASONING ───────────────────────────────────
  { onetId: "1.A.1.c.2", onetName: "Mathematical Reasoning", onetType: "ability",   aciConstruct: "QUANTITATIVE_REASONING",      mappingWeight: 0.90 },
  { onetId: "1.A.1.c.3", onetName: "Number Facility",       onetType: "ability",    aciConstruct: "QUANTITATIVE_REASONING",      mappingWeight: 0.85 },
  { onetId: "2.A.1.e",   onetName: "Mathematics",           onetType: "skill",      aciConstruct: "QUANTITATIVE_REASONING",      mappingWeight: 0.75 },

  // ── SPATIAL_VISUALIZATION ────────────────────────────────────
  { onetId: "1.A.2.b.2", onetName: "Visualization",         onetType: "ability",    aciConstruct: "SPATIAL_VISUALIZATION",       mappingWeight: 0.95 },
  { onetId: "1.A.2.b.1", onetName: "Spatial Orientation",   onetType: "ability",    aciConstruct: "SPATIAL_VISUALIZATION",       mappingWeight: 0.85 },

  // ── MECHANICAL_REASONING ─────────────────────────────────────
  { onetId: "2.B.3.l",   onetName: "Repairing",             onetType: "skill",      aciConstruct: "MECHANICAL_REASONING",        mappingWeight: 0.90 },
  { onetId: "2.B.3.i",   onetName: "Equipment Maintenance", onetType: "skill",      aciConstruct: "MECHANICAL_REASONING",        mappingWeight: 0.70 },
  { onetId: "2.B.3.j",   onetName: "Equipment Selection",   onetType: "skill",      aciConstruct: "MECHANICAL_REASONING",        mappingWeight: 0.60 },
  { onetId: "2.B.3.h",   onetName: "Operation Monitoring",  onetType: "skill",      aciConstruct: "MECHANICAL_REASONING",        mappingWeight: 0.55 },

  // ── PROCEDURAL_RELIABILITY ───────────────────────────────────
  { onetId: "1.C.5.a",   onetName: "Dependability",         onetType: "workStyle",  aciConstruct: "PROCEDURAL_RELIABILITY",      mappingWeight: 0.95 },
  { onetId: "1.C.5.b",   onetName: "Attention to Detail",   onetType: "workStyle",  aciConstruct: "PROCEDURAL_RELIABILITY",      mappingWeight: 0.85 },
  { onetId: "2.B.4.b",   onetName: "Quality Control Analysis", onetType: "skill",   aciConstruct: "PROCEDURAL_RELIABILITY",      mappingWeight: 0.70 },

  // ── ETHICAL_JUDGMENT ─────────────────────────────────────────
  { onetId: "1.C.5.c",   onetName: "Integrity",             onetType: "workStyle",  aciConstruct: "ETHICAL_JUDGMENT",            mappingWeight: 0.95 },
  { onetId: "1.C.6.b",   onetName: "Concern for Others",    onetType: "workStyle",  aciConstruct: "ETHICAL_JUDGMENT",            mappingWeight: 0.55 },
];

// Build a lookup map by onetId → array of mappings (an ID can map to multiple constructs)
export const MAPPING_BY_ONET_ID = ONET_ACI_MAPPINGS.reduce<Record<string, OnetAciMapping[]>>(
  (acc, m) => {
    if (!acc[m.onetId]) acc[m.onetId] = [];
    acc[m.onetId].push(m);
    return acc;
  },
  {}
);

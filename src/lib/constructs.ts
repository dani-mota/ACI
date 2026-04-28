export type LayerType = "COGNITIVE_CORE" | "TECHNICAL_APTITUDE" | "BEHAVIORAL_INTEGRITY";

export interface ConstructMeta {
  name: string;
  abbreviation: string;
  layer: LayerType;
  definition: string;
  roleRelevance: Record<string, string>;
}

export const LAYER_INFO: Record<LayerType, { name: string; color: string; icon: string; description: string }> = {
  COGNITIVE_CORE: {
    name: "Cognitive Core",
    color: "#2563EB",
    icon: "brain",
    description: "How they think and learn. Fluid reasoning, attention, flexibility, self-awareness, and learning speed.",
  },
  TECHNICAL_APTITUDE: {
    name: "Technical Aptitude",
    color: "#059669",
    icon: "wrench",
    description: "How they solve real-world problems. Mechanical reasoning, spatial thinking, pattern detection, quantitative skills, and systems diagnosis.",
  },
  BEHAVIORAL_INTEGRITY: {
    name: "Behavioral Integrity",
    color: "#D97706",
    icon: "shield",
    description: "How they act under pressure. Whether they follow procedures, report problems, and maintain standards when it's hard.",
  },
};

// ⚠️ INSERTION ORDER MATTERS.
// PRO-131's Employee Construct Map renders one radar spoke per construct
// in this order: 5 cognitive → 5 technical → 2 behavioral.
// Reordering this object alphabetically (or any other way) will silently
// break the visual grouping on the radar chart. If a different order is
// needed for a specific surface, transform a copy at the call site.
export const CONSTRUCTS: Record<string, ConstructMeta> = {
  FLUID_REASONING: {
    name: "Fluid Reasoning",
    abbreviation: "FL",
    layer: "COGNITIVE_CORE",
    definition: "How well they solve novel problems without prior knowledge or training.",
    roleRelevance: {
      "factory-technician": "Determines how quickly they troubleshoot unfamiliar equipment failures on the floor.",
      "cnc-machinist": "Predicts ability to optimize cutting strategies when encountering new materials or geometries.",
      "cam-programmer": "Core to writing efficient toolpaths for complex, first-time geometries.",
      "cmm-programmer": "Helps develop new measurement strategies for unusual part features.",
      "manufacturing-engineer": "Essential for designing new processes and solving cross-functional production problems.",
    },
  },
  EXECUTIVE_CONTROL: {
    name: "Executive Control",
    abbreviation: "EC",
    layer: "COGNITIVE_CORE",
    definition: "Ability to maintain focus, manage competing priorities, and resist distractions.",
    roleRelevance: {
      "factory-technician": "Critical for maintaining quality when running multiple machines simultaneously.",
      "cnc-machinist": "Determines accuracy under production pressure with tight deadlines.",
      "cam-programmer": "Needed to manage complex multi-operation programs without losing track of details.",
      "cmm-programmer": "Essential for maintaining measurement precision during long inspection runs.",
      "manufacturing-engineer": "Required for managing multiple improvement projects across different production lines.",
    },
  },
  COGNITIVE_FLEXIBILITY: {
    name: "Cognitive Flexibility",
    abbreviation: "CF",
    layer: "COGNITIVE_CORE",
    definition: "How easily they shift between different approaches when one isn't working.",
    roleRelevance: {
      "factory-technician": "Predicts how well they adapt when a standard procedure fails mid-task.",
      "cnc-machinist": "Important for switching strategies when a tool breaks or material behaves unexpectedly.",
      "cam-programmer": "Needed to pivot between different programming approaches for tricky geometries.",
      "cmm-programmer": "Helps when initial measurement plans need reworking due to fixture issues.",
      "manufacturing-engineer": "Critical for balancing competing solutions across departments.",
    },
  },
  METACOGNITIVE_CALIBRATION: {
    name: "Metacognitive Calibration",
    abbreviation: "MC",
    layer: "COGNITIVE_CORE",
    definition: "How accurately they assess their own knowledge — do they know what they don't know?",
    roleRelevance: {
      "factory-technician": "Predicts whether they'll ask for help vs. guess when uncertain about a procedure.",
      "cnc-machinist": "Determines if they'll stop and verify vs. run a questionable program.",
      "cam-programmer": "Shows whether they'll validate assumptions about material properties before committing.",
      "cmm-programmer": "Critical — overconfidence in measurement means bad parts get approved.",
      "manufacturing-engineer": "Important for knowing when to seek specialist input vs. solving alone.",
    },
  },
  LEARNING_VELOCITY: {
    name: "Learning Velocity",
    abbreviation: "LV",
    layer: "COGNITIVE_CORE",
    definition: "How fast they pick up new skills from instruction and become productive.",
    roleRelevance: {
      "factory-technician": "The #1 predictor of ramp time. High LV = productive in weeks, not months.",
      "cnc-machinist": "Determines how fast they'll master new machine types and control systems.",
      "cam-programmer": "Predicts how quickly they'll learn HyperMill, NX, or Mastercam without hand-holding.",
      "cmm-programmer": "Shows how fast they'll become independent with PC-DMIS or Calypso.",
      "manufacturing-engineer": "Predicts how quickly they absorb cross-domain knowledge (materials, processes, quality).",
    },
  },
  SYSTEMS_DIAGNOSTICS: {
    name: "Systems Diagnostics",
    abbreviation: "SD",
    layer: "TECHNICAL_APTITUDE",
    definition: "Ability to understand how interconnected systems work and isolate root causes.",
    roleRelevance: {
      "factory-technician": "Helps trace quality issues back to specific machine settings or material lots.",
      "cnc-machinist": "Used when diagnosing why a program that worked yesterday is producing scrap today.",
      "cam-programmer": "Important for understanding how toolpath changes cascade through the entire machining process.",
      "cmm-programmer": "Needed to trace measurement anomalies back to environmental or fixture root causes.",
      "manufacturing-engineer": "The core skill — understanding how process changes ripple through entire production systems.",
    },
  },
  PATTERN_RECOGNITION: {
    name: "Pattern Recognition",
    abbreviation: "PR",
    layer: "TECHNICAL_APTITUDE",
    definition: "Ability to spot meaningful patterns, trends, and anomalies in data or processes.",
    roleRelevance: {
      "factory-technician": "Helps notice when machine behavior starts drifting before it causes scrap.",
      "cnc-machinist": "Critical for reading tool wear patterns and predicting failures.",
      "cam-programmer": "Used to identify recurring geometry patterns that can be programmed efficiently.",
      "cmm-programmer": "The #1 skill — spotting dimensional trends that indicate process drift.",
      "manufacturing-engineer": "Essential for reading SPC charts and identifying systemic quality patterns.",
    },
  },
  QUANTITATIVE_REASONING: {
    name: "Quantitative Reasoning",
    abbreviation: "QR",
    layer: "TECHNICAL_APTITUDE",
    definition: "Working with numbers, tolerances, feeds/speeds, and mathematical relationships.",
    roleRelevance: {
      "factory-technician": "Basic math for reading specs, measuring parts, and calculating simple adjustments.",
      "cnc-machinist": "Core skill for calculating feeds, speeds, depths of cut, and tolerance stacks.",
      "cam-programmer": "Essential for programming precise toolpaths with correct stepover, lead-in, and tolerance values.",
      "cmm-programmer": "The #1 skill — GD&T interpretation, statistical analysis, and measurement uncertainty.",
      "manufacturing-engineer": "Required for process capability analysis, cost modeling, and tolerance allocation.",
    },
  },
  SPATIAL_VISUALIZATION: {
    name: "Spatial Visualization",
    abbreviation: "SV",
    layer: "TECHNICAL_APTITUDE",
    definition: "Mentally rotating 3D objects and understanding how 2D drawings map to real parts.",
    roleRelevance: {
      "factory-technician": "Helps read assembly drawings and understand how parts fit together.",
      "cnc-machinist": "Critical for understanding how a flat program creates a 3D part from raw stock.",
      "cam-programmer": "The #1 skill — mentally simulating 5-axis toolpaths through complex geometry.",
      "cmm-programmer": "Needed to plan probe access paths around complex part features.",
      "manufacturing-engineer": "Important for designing fixtures, work cells, and production flow layouts.",
    },
  },
  MECHANICAL_REASONING: {
    name: "Mechanical Reasoning",
    abbreviation: "MR",
    layer: "TECHNICAL_APTITUDE",
    definition: "Intuition for how physical systems, forces, and mechanisms behave.",
    roleRelevance: {
      "factory-technician": "Helps understand why parts deform, tools deflect, and machines vibrate.",
      "cnc-machinist": "Core skill for understanding cutting forces, tool engagement, and workholding physics.",
      "cam-programmer": "Used to predict how programmed forces will affect thin-wall parts and delicate features.",
      "cmm-programmer": "Less critical but helps understand why parts warp and measurement contacts cause deformation.",
      "manufacturing-engineer": "Important for fixture design, force analysis, and process physics understanding.",
    },
  },
  PROCEDURAL_RELIABILITY: {
    name: "Procedural Reliability",
    abbreviation: "PRL",
    layer: "BEHAVIORAL_INTEGRITY",
    definition: "Consistency in following established procedures, even when shortcuts are tempting.",
    roleRelevance: {
      "factory-technician": "The #1 behavioral predictor — will they follow the checklist every time, not just when watched?",
      "cnc-machinist": "Important but less critical — experienced machinists need judgment, not just compliance.",
      "cam-programmer": "Low importance — creative roles suffer from excessive rule-following.",
      "cmm-programmer": "High importance — measurement protocols must be followed exactly. No shortcuts.",
      "manufacturing-engineer": "Low importance — engineers design procedures, not follow them.",
    },
  },
  ETHICAL_JUDGMENT: {
    name: "Ethical Judgment",
    abbreviation: "EJ",
    layer: "BEHAVIORAL_INTEGRITY",
    definition: "Making the right call under pressure — reporting problems, maintaining standards, speaking up.",
    roleRelevance: {
      "factory-technician": "Will they report a borderline part or let it slide at the end of a long shift?",
      "cnc-machinist": "Will they flag a tool issue or hope it holds for the last few parts?",
      "cam-programmer": "Will they disclose a programming assumption that might affect part quality?",
      "cmm-programmer": "Critical — will they reject a part from a senior machinist who insists it's fine?",
      "manufacturing-engineer": "Important for mentoring integrity — modeling the right behavior for the floor.",
    },
  },
};

export const CONSTRUCT_LIST = Object.keys(CONSTRUCTS) as (keyof typeof CONSTRUCTS)[];

export const COGNITIVE_CONSTRUCTS = CONSTRUCT_LIST.filter(c => CONSTRUCTS[c].layer === "COGNITIVE_CORE");
export const TECHNICAL_CONSTRUCTS = CONSTRUCT_LIST.filter(c => CONSTRUCTS[c].layer === "TECHNICAL_APTITUDE");
export const BEHAVIORAL_CONSTRUCTS = CONSTRUCT_LIST.filter(c => CONSTRUCTS[c].layer === "BEHAVIORAL_INTEGRITY");

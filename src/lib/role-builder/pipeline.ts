import { matchOnetOccupations, type OnetMatchResult } from "@/lib/onet/matcher";
import { deriveWeightsFromOnet } from "@/lib/onet/weights";

// ── Types ────────────────────────────────────────────────────────────────────

export interface ExtractedJD {
  title: string;
  description?: string;
  level: "ENTRY" | "MID" | "SENIOR" | "LEAD";
  technicalSkills: string[];
  behavioralRequirements: string[];
  environment: {
    setting: "FLOOR" | "CLEANROOM" | "LAB" | "OFFICE" | "FIELD" | "MIXED";
    physicalDemands: "LOW" | "MODERATE" | "HIGH";
    shiftWork: boolean;
  };
  supervision: {
    receivesSupervision: "CLOSE" | "MODERATE" | "INDEPENDENT";
    providesSupervision: boolean;
    teamSize: number | null;
  };
  consequenceOfError: {
    safetyCritical: boolean;
    qualityCritical: boolean;
    costImpact: "LOW" | "MEDIUM" | "HIGH";
  };
  learningRequirements: {
    newTechnologyAdoption: boolean;
    continuousLearning: boolean;
    crossTraining: boolean;
  };
  keyTasks: string[];
  outsideScope: boolean;
  outsideScopeReason: string | null;
}

export interface GeneratedWeights {
  complexityLevel: "LOW" | "MEDIUM" | "MEDIUM_HIGH" | "HIGH";
  closestTemplate: string;
  weights: Record<string, number>; // constructId → 0–100, must sum to 100
  cutlines: {
    technicalAptitude: number;
    behavioralIntegrity: number;
    learningVelocity: number;
    overallMinimum: number;
  };
  confidenceScores: Record<string, "HIGH" | "MEDIUM" | "LOW">;
  weightEvidence: Record<string, string>; // per-construct evidence sentences
}

export interface ResearchRationale {
  summary: string;
  complexityExplanation: string;
  topConstructRationales: { construct: string; rationale: string }[];
  cutlineRationale: string;
  templateComparison: string;
  complianceNote: string;
}

export interface HiringIntelligence {
  estimatedPassRate: number; // percentage 0–100
  estimatedPassRatio: string; // e.g. "1 in 8"
  bottleneckConstruct: string;
  bottleneckExplanation: string;
  sourcingRecommendation: string;
  comparisonToDefaults: {
    mostSimilarRole: string;
    keyDifferences: string[];
  };
}

export interface RoleBuilderPipelineInput {
  sourceType: "JD_UPLOAD" | "TEMPLATE_CLONE" | "MANUAL_ENTRY";
  rawText?: string;
  templateSlug?: string;
  templateWeights?: Record<string, number>;
  templateCutlines?: { technicalAptitude: number; behavioralIntegrity: number; learningVelocity: number };
  formData?: {
    title: string;
    description?: string;
    responsibilities?: string;
    skills?: string;
    environment?: string;
    experienceLevel?: string;
    safetyCritical?: boolean;
    qualityCritical?: boolean;
  };
}

export interface RoleBuilderPipelineResult {
  extracted: ExtractedJD;
  onetMatches: OnetMatchResult[];
  onetDerivedWeights: Record<string, number>;
  weights: GeneratedWeights;
  rationale: ResearchRationale;
  hiringIntelligence: HiringIntelligence;
  pipelineMetadata: {
    durationMs: number;
    stagesCompleted: number;
    warnings: string[];
    sourceType: string;
  };
}

// ── Claude API helper ────────────────────────────────────────────────────────

async function callClaude(
  model: "claude-haiku-4-5-20251001" | "claude-sonnet-4-6",
  systemPrompt: string,
  userMessage: string,
  maxTokens: number
): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not configured");

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30_000); // 30s timeout

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    }),
    signal: controller.signal,
  });
  clearTimeout(timeoutId);

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Claude API error ${response.status}: ${err}`);
  }

  const data = await response.json();
  return data.content?.[0]?.text ?? "";
}

// Extract JSON from Claude response (strips markdown fences if present)
function extractJSON(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("No JSON object found in response");
  return JSON.parse(text.slice(start, end + 1));
}

// ── Stage 1: JD Extraction ───────────────────────────────────────────────────

const EXTRACTION_SYSTEM = `You are a job analysis expert specializing in manufacturing, engineering, and technical trades.
Extract structured information from the job description below.
Respond with ONLY valid JSON — no markdown, no explanations, no preamble.`;

const EXTRACTION_SCHEMA = `{
  "title": "string",
  "description": "1-2 sentence role summary",
  "level": "ENTRY | MID | SENIOR | LEAD",
  "technicalSkills": ["array of specific technical skills"],
  "behavioralRequirements": ["array of behavioral/soft skill requirements"],
  "environment": {
    "setting": "FLOOR | CLEANROOM | LAB | OFFICE | FIELD | MIXED",
    "physicalDemands": "LOW | MODERATE | HIGH",
    "shiftWork": true/false
  },
  "supervision": {
    "receivesSupervision": "CLOSE | MODERATE | INDEPENDENT",
    "providesSupervision": true/false,
    "teamSize": number or null
  },
  "consequenceOfError": {
    "safetyCritical": true/false,
    "qualityCritical": true/false,
    "costImpact": "LOW | MEDIUM | HIGH"
  },
  "learningRequirements": {
    "newTechnologyAdoption": true/false,
    "continuousLearning": true/false,
    "crossTraining": true/false
  },
  "keyTasks": ["top 5-8 most important tasks"],
  "outsideScope": true/false,
  "outsideScopeReason": "string or null"
}`;

async function extractJD(rawText: string): Promise<ExtractedJD> {
  const fallback: ExtractedJD = {
    title: "Manufacturing Technician",
    description: "",
    level: "MID",
    technicalSkills: [],
    behavioralRequirements: [],
    environment: { setting: "FLOOR", physicalDemands: "MODERATE", shiftWork: false },
    supervision: { receivesSupervision: "MODERATE", providesSupervision: false, teamSize: null },
    consequenceOfError: { safetyCritical: false, qualityCritical: true, costImpact: "MEDIUM" },
    learningRequirements: { newTechnologyAdoption: false, continuousLearning: false, crossTraining: false },
    keyTasks: [],
    outsideScope: false,
    outsideScopeReason: null,
  };

  try {
    const text = await callClaude(
      "claude-haiku-4-5-20251001",
      EXTRACTION_SYSTEM,
      `Extract structured job information from this job description. Use this exact JSON schema:\n${EXTRACTION_SCHEMA}\n\nJob description:\n${rawText.slice(0, 8000)}`,
      800
    );
    const parsed = extractJSON(text) as Partial<ExtractedJD>;
    return { ...fallback, ...parsed };
  } catch {
    return fallback;
  }
}

// Build ExtractedJD from a structured form (no Claude call)
function buildExtractedFromForm(
  form: NonNullable<RoleBuilderPipelineInput["formData"]>
): ExtractedJD {
  const levelMap: Record<string, ExtractedJD["level"]> = {
    entry: "ENTRY", mid: "MID", senior: "SENIOR", lead: "LEAD",
  };
  return {
    title: form.title,
    description: form.description ?? "",
    level: levelMap[form.experienceLevel?.toLowerCase() ?? "mid"] ?? "MID",
    technicalSkills: form.skills ? form.skills.split(/[,\n]/).map((s) => s.trim()).filter(Boolean) : [],
    behavioralRequirements: [],
    environment: {
      setting: (form.environment?.toUpperCase() as ExtractedJD["environment"]["setting"]) ?? "FLOOR",
      physicalDemands: "MODERATE",
      shiftWork: false,
    },
    supervision: { receivesSupervision: "MODERATE", providesSupervision: false, teamSize: null },
    consequenceOfError: {
      safetyCritical: form.safetyCritical ?? false,
      qualityCritical: form.qualityCritical ?? false,
      costImpact: "MEDIUM",
    },
    learningRequirements: { newTechnologyAdoption: false, continuousLearning: false, crossTraining: false },
    keyTasks: form.responsibilities
      ? form.responsibilities.split(/\n/).map((s) => s.trim()).filter(Boolean).slice(0, 8)
      : [],
    outsideScope: false,
    outsideScopeReason: null,
  };
}

// Build ExtractedJD from a template clone
function buildExtractedFromTemplate(templateSlug: string): ExtractedJD {
  const templateMeta: Record<string, Partial<ExtractedJD>> = {
    "factory-technician":       { title: "Factory Technician",       description: "Entry-level production role operating machinery on the factory floor.", level: "ENTRY", environment: { setting: "FLOOR",     physicalDemands: "HIGH",     shiftWork: true  }, consequenceOfError: { safetyCritical: false, qualityCritical: true,  costImpact: "MEDIUM" } },
    "cnc-machinist":            { title: "CNC Machinist",            description: "Precision machining role programming and operating CNC equipment.", level: "MID",   environment: { setting: "FLOOR",     physicalDemands: "MODERATE", shiftWork: true  }, consequenceOfError: { safetyCritical: false, qualityCritical: true,  costImpact: "MEDIUM" } },
    "cam-programmer":           { title: "CAM Programmer",           description: "Technical role creating toolpaths and programs for CNC manufacturing.", level: "MID",   environment: { setting: "OFFICE",    physicalDemands: "LOW",      shiftWork: false }, consequenceOfError: { safetyCritical: false, qualityCritical: true,  costImpact: "HIGH"   } },
    "cmm-programmer":           { title: "CMM Programmer",           description: "Quality-focused role programming coordinate measuring machines for inspection.", level: "MID",   environment: { setting: "CLEANROOM", physicalDemands: "LOW",      shiftWork: false }, consequenceOfError: { safetyCritical: false, qualityCritical: true,  costImpact: "HIGH"   } },
    "manufacturing-engineer":   { title: "Manufacturing Engineer",   description: "Senior engineering role designing and optimizing manufacturing processes.", level: "SENIOR",environment: { setting: "MIXED",     physicalDemands: "LOW",      shiftWork: false }, consequenceOfError: { safetyCritical: false, qualityCritical: true,  costImpact: "HIGH"   } },
  };

  const base: ExtractedJD = {
    title: templateSlug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    description: "",
    level: "MID",
    technicalSkills: [],
    behavioralRequirements: [],
    environment: { setting: "FLOOR", physicalDemands: "MODERATE", shiftWork: false },
    supervision: { receivesSupervision: "MODERATE", providesSupervision: false, teamSize: null },
    consequenceOfError: { safetyCritical: false, qualityCritical: true, costImpact: "MEDIUM" },
    learningRequirements: { newTechnologyAdoption: false, continuousLearning: false, crossTraining: false },
    keyTasks: [],
    outsideScope: false,
    outsideScopeReason: null,
  };

  const meta = templateMeta[templateSlug] ?? {};
  return { ...base, ...meta, environment: { ...base.environment, ...meta.environment }, consequenceOfError: { ...base.consequenceOfError, ...meta.consequenceOfError } };
}

// ── Stage 3: Weight Generation ───────────────────────────────────────────────

const WEIGHT_SYSTEM = `You are an industrial/organizational psychologist specializing in personnel selection for manufacturing and technical roles.
You have expertise in Schmidt & Hunter (1998) GMA meta-analyses, O*NET ability data, ASVAB research, Wilmot & Ones (2019) conscientiousness review, and EEOC Uniform Guidelines.
Respond ONLY with valid JSON — no markdown, no preamble.`;

async function generateWeights(
  extracted: ExtractedJD,
  onetMatches: OnetMatchResult[],
  onetDerivedWeights: Record<string, number>
): Promise<GeneratedWeights> {
  const fallback: GeneratedWeights = {
    complexityLevel: "MEDIUM",
    closestTemplate: "factory-technician",
    weights: { ...onetDerivedWeights },
    cutlines: { technicalAptitude: 55, behavioralIntegrity: 60, learningVelocity: 50, overallMinimum: 40 },
    confidenceScores: Object.fromEntries(
      Object.keys(onetDerivedWeights).map((k) => [k, "MEDIUM" as const])
    ),
    weightEvidence: {},
  };

  const onetSummary = onetMatches.slice(0, 3).map((m) =>
    `${m.occupation.title} (${m.occupation.soc}, Job Zone ${m.occupation.jobZone}, match score: ${m.score})`
  ).join("; ") || "No O*NET matches found";

  try {
    const text = await callClaude(
      "claude-sonnet-4-6",
      WEIGHT_SYSTEM,
      `Generate construct weights and cutlines for an ACI role profile.

HARD RULES:
- All 12 weights MUST sum to exactly 100
- No individual weight below 2
- No individual weight above 25
- Layer 1 (FLUID_REASONING, EXECUTIVE_CONTROL, COGNITIVE_FLEXIBILITY, METACOGNITIVE_CALIBRATION, LEARNING_VELOCITY): sum 35–55
- Layer 2 (SYSTEMS_DIAGNOSTICS, PATTERN_RECOGNITION, QUANTITATIVE_REASONING, SPATIAL_VISUALIZATION, MECHANICAL_REASONING): sum 25–45
- Layer 3 (PROCEDURAL_RELIABILITY, ETHICAL_JUDGMENT): sum 5–30

RESEARCH FRAMEWORK:
- Job Zone 1–2 (low complexity): Conscientiousness strongest predictor; moderate GMA weight
- Job Zone 3 (medium): Balanced cognitive and behavioral weights
- Job Zone 4–5 (high complexity): GMA dominant; conscientiousness effect weakens
- Safety/quality-critical roles → higher PROCEDURAL_RELIABILITY and ETHICAL_JUDGMENT
- High learning requirement → higher LEARNING_VELOCITY

O*NET BASELINE WEIGHTS (use as starting point, adjust based on judgment):
${JSON.stringify(onetDerivedWeights, null, 2)}

MATCHED O*NET OCCUPATIONS:
${onetSummary}

JOB ANALYSIS:
${JSON.stringify(extracted, null, 2)}

REFERENCE PROFILES (ACI validated roles):
- Factory Technician (Low-Med, JZ2): LV:22, PROC_REL:20, FR:10. Cutlines: Tech≥40, Beh≥60, LV≥60
- CNC Machinist (Medium, JZ3): SPATIAL:15, QUANT:15, MR:12. Cutlines: Tech≥60, Beh≥55, LV≥50
- CAM Programmer (Med-High, JZ3): SPATIAL:20, QUANT:18, FR:15. Cutlines: Tech≥75, Beh≥50, LV≥55
- CMM Programmer (Med-High, JZ3): QUANT:20, PAT:15, PROC_REL:12. Cutlines: Tech≥70, Beh≥75, LV≥45
- Mfg Engineer (High, JZ4): FR:18, SYS:18, LV:12. Cutlines: Tech≥65, Beh≥70, LV≥65

Respond with ONLY this JSON (weights as integers summing to exactly 100):
{
  "complexityLevel": "LOW | MEDIUM | MEDIUM_HIGH | HIGH",
  "closestTemplate": "factory-technician | cnc-machinist | cam-programmer | cmm-programmer | manufacturing-engineer",
  "weights": {
    "FLUID_REASONING": 0,
    "EXECUTIVE_CONTROL": 0,
    "COGNITIVE_FLEXIBILITY": 0,
    "METACOGNITIVE_CALIBRATION": 0,
    "LEARNING_VELOCITY": 0,
    "SYSTEMS_DIAGNOSTICS": 0,
    "PATTERN_RECOGNITION": 0,
    "QUANTITATIVE_REASONING": 0,
    "SPATIAL_VISUALIZATION": 0,
    "MECHANICAL_REASONING": 0,
    "PROCEDURAL_RELIABILITY": 0,
    "ETHICAL_JUDGMENT": 0
  },
  "cutlines": {
    "technicalAptitude": 0,
    "behavioralIntegrity": 0,
    "learningVelocity": 0,
    "overallMinimum": 0
  },
  "confidenceScores": {
    "FLUID_REASONING": "HIGH | MEDIUM | LOW",
    "EXECUTIVE_CONTROL": "HIGH | MEDIUM | LOW",
    "COGNITIVE_FLEXIBILITY": "HIGH | MEDIUM | LOW",
    "METACOGNITIVE_CALIBRATION": "HIGH | MEDIUM | LOW",
    "LEARNING_VELOCITY": "HIGH | MEDIUM | LOW",
    "SYSTEMS_DIAGNOSTICS": "HIGH | MEDIUM | LOW",
    "PATTERN_RECOGNITION": "HIGH | MEDIUM | LOW",
    "QUANTITATIVE_REASONING": "HIGH | MEDIUM | LOW",
    "SPATIAL_VISUALIZATION": "HIGH | MEDIUM | LOW",
    "MECHANICAL_REASONING": "HIGH | MEDIUM | LOW",
    "PROCEDURAL_RELIABILITY": "HIGH | MEDIUM | LOW",
    "ETHICAL_JUDGMENT": "HIGH | MEDIUM | LOW"
  },
  "weightEvidence": {
    "FLUID_REASONING": "1-2 sentence evidence",
    "EXECUTIVE_CONTROL": "1-2 sentence evidence",
    "COGNITIVE_FLEXIBILITY": "1-2 sentence evidence",
    "METACOGNITIVE_CALIBRATION": "1-2 sentence evidence",
    "LEARNING_VELOCITY": "1-2 sentence evidence",
    "SYSTEMS_DIAGNOSTICS": "1-2 sentence evidence",
    "PATTERN_RECOGNITION": "1-2 sentence evidence",
    "QUANTITATIVE_REASONING": "1-2 sentence evidence",
    "SPATIAL_VISUALIZATION": "1-2 sentence evidence",
    "MECHANICAL_REASONING": "1-2 sentence evidence",
    "PROCEDURAL_RELIABILITY": "1-2 sentence evidence",
    "ETHICAL_JUDGMENT": "1-2 sentence evidence"
  }
}`,
      2000
    );

    const parsed = extractJSON(text) as Partial<GeneratedWeights>;
    const weights = parsed.weights ?? fallback.weights;

    // Validate and normalize weights
    const normalized = normalizeWeights(weights);

    return {
      complexityLevel: parsed.complexityLevel ?? "MEDIUM",
      closestTemplate: parsed.closestTemplate ?? "factory-technician",
      weights: normalized,
      cutlines: parsed.cutlines ?? fallback.cutlines,
      confidenceScores: parsed.confidenceScores ?? fallback.confidenceScores,
      weightEvidence: parsed.weightEvidence ?? {},
    };
  } catch {
    return fallback;
  }
}

// Normalize weights: clamp to [2, 25], then scale to sum = 100
function normalizeWeights(weights: Record<string, number>): Record<string, number> {
  const constructs = [
    "FLUID_REASONING", "EXECUTIVE_CONTROL", "COGNITIVE_FLEXIBILITY", "METACOGNITIVE_CALIBRATION",
    "LEARNING_VELOCITY", "SYSTEMS_DIAGNOSTICS", "PATTERN_RECOGNITION", "QUANTITATIVE_REASONING",
    "SPATIAL_VISUALIZATION", "MECHANICAL_REASONING", "PROCEDURAL_RELIABILITY", "ETHICAL_JUDGMENT",
  ];

  // Clamp each to [2, 25]
  const clamped: Record<string, number> = {};
  constructs.forEach((c) => {
    clamped[c] = Math.max(2, Math.min(25, Math.round(weights[c] ?? 8)));
  });

  // Scale to sum = 100
  const total = Object.values(clamped).reduce((s, v) => s + v, 0);
  const normalized: Record<string, number> = {};
  constructs.forEach((c) => {
    normalized[c] = Math.round((clamped[c] / total) * 100);
  });

  // Fix rounding drift
  const sum = Object.values(normalized).reduce((s, v) => s + v, 0);
  const diff = 100 - sum;
  if (diff !== 0) normalized["FLUID_REASONING"] = Math.max(2, normalized["FLUID_REASONING"] + diff);

  return normalized;
}

// ── Stage 4: Research Rationale ──────────────────────────────────────────────

async function generateRationale(
  extracted: ExtractedJD,
  weights: GeneratedWeights,
  onetMatches: OnetMatchResult[]
): Promise<ResearchRationale> {
  const fallback: ResearchRationale = {
    summary: `This custom role profile was generated for a ${extracted.title} position using ACI's AI-powered Role Builder. The profile draws on O*NET occupational data and established research in personnel selection.`,
    complexityExplanation: `This role has been classified as ${weights.complexityLevel} complexity based on the job zone classification and cognitive demands identified in the job analysis.`,
    topConstructRationales: [],
    cutlineRationale: `The recommended cutlines reflect the role's technical demands and behavioral requirements. Candidates who do not meet these thresholds are unlikely to perform successfully in this role.`,
    templateComparison: `This custom role is most similar to ACI's validated ${weights.closestTemplate.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())} profile.`,
    complianceNote: `These assessment weights are based on job analysis data and O*NET occupational research. They are intended to predict job performance for the specific role described and are consistent with the Uniform Guidelines on Employee Selection Procedures (EEOC, 1978).`,
  };

  const sortedWeights = Object.entries(weights.weights)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([k, v]) => `${k}: ${v}%`)
    .join(", ");

  const onetNames = onetMatches.slice(0, 3).map((m) => m.occupation.title).join(", ") || "general manufacturing";

  try {
    const text = await callClaude(
      "claude-sonnet-4-6",
      `You are an I/O psychologist writing a research rationale for an HR compliance document. Use plain language. Reference O*NET data and Schmidt & Hunter meta-analyses. Write 3-5 sentence paragraphs. Respond ONLY with valid JSON — no markdown.`,
      `Write a research rationale for this role profile.

Role: ${extracted.title} (${weights.complexityLevel} complexity)
Top 5 weighted constructs: ${sortedWeights}
Matched O*NET occupations: ${onetNames}
Cutlines: Technical Aptitude ≥${weights.cutlines.technicalAptitude}th, Behavioral Integrity ≥${weights.cutlines.behavioralIntegrity}th, Learning Velocity ≥${weights.cutlines.learningVelocity}th
Safety critical: ${extracted.consequenceOfError.safetyCritical}
Quality critical: ${extracted.consequenceOfError.qualityCritical}
Closest ACI template: ${weights.closestTemplate}

Respond with ONLY this JSON:
{
  "summary": "2-3 sentence role summary",
  "complexityExplanation": "2-3 sentences on complexity classification",
  "topConstructRationales": [
    { "construct": "CONSTRUCT_NAME", "rationale": "2-3 sentence explanation citing O*NET data or research" }
  ],
  "cutlineRationale": "paragraph explaining cutline logic",
  "templateComparison": "paragraph comparing to closest ACI default role",
  "complianceNote": "1-2 sentence EEOC/ADA compliance statement"
}`,
      1500
    );

    const parsed = extractJSON(text) as Partial<ResearchRationale>;
    return { ...fallback, ...parsed };
  } catch {
    return fallback;
  }
}

// ── Stage 5: Hiring Intelligence ─────────────────────────────────────────────

async function generateHiringIntelligence(
  extracted: ExtractedJD,
  weights: GeneratedWeights
): Promise<HiringIntelligence> {
  const fallback: HiringIntelligence = {
    estimatedPassRate: 15,
    estimatedPassRatio: "1 in 7",
    bottleneckConstruct: "PROCEDURAL_RELIABILITY",
    bottleneckExplanation: "The behavioral integrity cutline is the most selective threshold for this role.",
    sourcingRecommendation: "Consider candidates from vocational training programs and apprenticeships with strong attendance records.",
    comparisonToDefaults: {
      mostSimilarRole: weights.closestTemplate,
      keyDifferences: ["Custom role profile generated from job description analysis."],
    },
  };

  try {
    const text = await callClaude(
      "claude-sonnet-4-6",
      `You are a talent acquisition analyst. Provide hiring intelligence for a role profile. Be concise and specific. Respond ONLY with valid JSON — no markdown.`,
      `Generate hiring intelligence for this role.

Role: ${extracted.title}
Cutlines: Technical Aptitude ≥${weights.cutlines.technicalAptitude}th percentile, Behavioral Integrity ≥${weights.cutlines.behavioralIntegrity}th percentile, Learning Velocity ≥${weights.cutlines.learningVelocity}th percentile
Top 3 weighted constructs: ${Object.entries(weights.weights).sort(([,a],[,b]) => b-a).slice(0,3).map(([k,v]) => `${k} (${v}%)`).join(", ")}
Complexity: ${weights.complexityLevel}
Closest template: ${weights.closestTemplate}

Respond ONLY with this JSON:
{
  "estimatedPassRate": number_between_5_and_40,
  "estimatedPassRatio": "1 in N",
  "bottleneckConstruct": "CONSTRUCT_NAME",
  "bottleneckExplanation": "1-2 sentences",
  "sourcingRecommendation": "1-2 sentences on where to find strong candidates",
  "comparisonToDefaults": {
    "mostSimilarRole": "slug",
    "keyDifferences": ["difference 1", "difference 2"]
  }
}`,
      600
    );

    const parsed = extractJSON(text) as Partial<HiringIntelligence>;
    return { ...fallback, ...parsed };
  } catch {
    return fallback;
  }
}

// ── Orchestrator ──────────────────────────────────────────────────────────────

export async function runRoleBuilderPipeline(
  input: RoleBuilderPipelineInput
): Promise<RoleBuilderPipelineResult> {
  const startTime = Date.now();
  const warnings: string[] = [];
  let stagesCompleted = 0;

  // Stage 1 & 2: Extract + O*NET match
  let extracted: ExtractedJD;

  if (input.sourceType === "JD_UPLOAD" && input.rawText) {
    extracted = await extractJD(input.rawText);
    stagesCompleted++;
    if (extracted.outsideScope) {
      warnings.push("This role appears to be outside ACI's core manufacturing/technical assessment domain.");
    }
  } else if (input.sourceType === "TEMPLATE_CLONE" && input.templateSlug) {
    extracted = buildExtractedFromTemplate(input.templateSlug);
    stagesCompleted++;
  } else if (input.sourceType === "MANUAL_ENTRY" && input.formData) {
    extracted = buildExtractedFromForm(input.formData);
    stagesCompleted++;
  } else {
    extracted = buildExtractedFromTemplate("factory-technician");
    warnings.push("Could not determine input source. Using default Factory Technician template.");
    stagesCompleted++;
  }

  // Stage 2: O*NET matching
  const onetMatches = matchOnetOccupations({
    title: extracted.title,
    description: extracted.keyTasks.join(" "),
    keywords: extracted.technicalSkills,
  });
  const onetDerivedWeights = deriveWeightsFromOnet(onetMatches);
  stagesCompleted++;

  // For template clones, start from the template weights instead of O*NET derived
  const baseWeightsForAI = input.sourceType === "TEMPLATE_CLONE" && input.templateWeights
    ? input.templateWeights
    : onetDerivedWeights;

  // Stages 3–5: Run in parallel
  const [generatedWeights, rationale, hiringIntelligence] = await Promise.all([
    generateWeights(extracted, onetMatches, baseWeightsForAI),
    // Rationale and hiring intelligence get fallbacks if weights generation fails — use onetDerived as stand-in
    Promise.resolve(null as ResearchRationale | null), // placeholder, replaced below
    Promise.resolve(null as HiringIntelligence | null), // placeholder, replaced below
  ]);
  stagesCompleted++;

  // Now generate rationale + hiring intelligence with the actual weights
  const [rationaleFinal, hiringIntelligenceFinal] = await Promise.all([
    generateRationale(extracted, generatedWeights, onetMatches),
    generateHiringIntelligence(extracted, generatedWeights),
  ]);
  stagesCompleted += 2;

  void rationale; void hiringIntelligence; // suppress unused vars from placeholder parallel above

  return {
    extracted,
    onetMatches,
    onetDerivedWeights,
    weights: generatedWeights,
    rationale: rationaleFinal,
    hiringIntelligence: hiringIntelligenceFinal,
    pipelineMetadata: {
      durationMs: Date.now() - startTime,
      stagesCompleted,
      warnings,
      sourceType: input.sourceType,
    },
  };
}

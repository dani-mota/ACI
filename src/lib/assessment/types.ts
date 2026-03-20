import type { Construct, AssessmentAct, CeilingTypeEnum, InteractionElementType } from "@/generated/prisma/client";

// ──────────────────────────────────────────────
// Response Classification (Act 1 Branching)
// ──────────────────────────────────────────────

export type ResponseClassification = "STRONG" | "ADEQUATE" | "WEAK";

export interface ClassificationResult {
  classification: ResponseClassification;
  indicatorsPresent: string[];
  indicatorsAbsent: string[];
  rubricScore: number; // 0.0 to 1.0
  constructSignals: Record<string, { signalStrength: number; evidence: string }>;
  branchRationale: string;
  isFallback?: boolean; // true when AI evaluation was unavailable and heuristic was used
  tokenUsage?: { inputTokens: number; outputTokens: number };
}

// ──────────────────────────────────────────────
// Act 1: Scenario Structure
// ──────────────────────────────────────────────

export interface BeatTemplate {
  beatNumber: number; // 0-5
  type: "INITIAL_SITUATION" | "INITIAL_RESPONSE" | "COMPLICATION" | "SOCIAL_PRESSURE" | "CONSEQUENCE_REVEAL" | "REFLECTIVE_SYNTHESIS";
  primaryConstructs: Construct[];
  secondaryConstructs: Construct[];
  agentPromptTemplate: string; // Template text for the agent's message
  branchScripts: {
    STRONG: string;
    ADEQUATE: string;
    WEAK: string;
  };
  rubricIndicators: BehavioralIndicator[];
}

export interface ScenarioShell {
  id: string;
  name: string;
  description: string;
  primaryConstructs: Construct[];
  beats: BeatTemplate[];
  domainNeutralContent: {
    setting: string;
    characters: string[];
    initialSituation: string;
  };
}

export interface ScenarioInstance {
  shell: ScenarioShell;
  domainContent?: DomainAdaptedContent;
  branchPath: ResponseClassification[];
  currentBeat: number;
}

export interface DomainAdaptedContent {
  roleSlug: string;
  setting: string;
  characters: string[];
  initialSituation: string;
  beatAdaptations: Record<number, string>; // beatNumber -> adapted content
}

// ──────────────────────────────────────────────
// Act 2: Adaptive Investigation Loop
// ──────────────────────────────────────────────

export type AdaptivePhase = "CALIBRATION" | "BOUNDARY_MAPPING" | "PRESSURE_TEST" | "DIAGNOSTIC_PROBE";

export interface Act2Item {
  id: string;
  construct: Construct;
  subType: string; // e.g., "arithmetic", "multi-variable", "algebraic"
  difficulty: number; // 0.0 to 1.0 (normalized)
  difficultyLevel: 1 | 2 | 3 | 4 | 5; // Discrete level
  prompt: string;
  elementType: InteractionElementType;
  options?: string[];
  correctAnswer?: string;
  distractorRationale?: Record<string, string>; // option -> what it reveals
  timingExpectations: { fast: number; typical: number; slow: number }; // in ms
  imageUrl?: string; // For spatial visualization items
  asciiDiagram?: string; // Monospace-rendered diagram for spatial items
}

export interface ItemResult {
  itemId: string;
  construct: Construct;
  difficulty: number;
  correct: boolean;
  responseTimeMs: number;
  candidateResponse: string;
}

export interface BoundaryDetection {
  construct: Construct;
  estimatedBoundary: number; // Difficulty level where accuracy drops
  confirmedFloor: number; // Lowest difficulty consistently passed
  confirmedCeiling: number; // Highest difficulty consistently failed
  confidence: number; // 0.0 to 1.0
  itemResults: ItemResult[];
}

export interface AdaptiveLoopState {
  construct: Construct;
  phase: AdaptivePhase;
  calibrationResults: ItemResult[];
  boundaryResults: ItemResult[];
  pressureResults: ItemResult[];
  probeExchanges: ProbeExchange[];
  boundary: BoundaryDetection | null;
  itemsServed: string[]; // IDs of items already shown (no repeats)
}

export interface PressureTestResult {
  confirmed: boolean; // Did pressure test confirm the boundary?
  contradiction: boolean; // Did candidate succeed at boundary difficulty?
  needsResolution: boolean; // Should we serve another item?
}

export interface ProbeExchange {
  question: string;
  diagnosticTarget: string;
  candidateResponse: string;
  strongCriteria: string;
  weakCriteria: string;
}

// ──────────────────────────────────────────────
// Act 3: Calibration & Consistency
// ──────────────────────────────────────────────

export interface ConfidenceTaggedItem {
  itemId: string;
  construct: Construct;
  candidateResponse: string;
  correct: boolean;
  statedConfidence: "VERY_CONFIDENT" | "SOMEWHAT_CONFIDENT" | "NOT_SURE";
}

export interface ConsistencyResult {
  construct: Construct;
  act1Score: number;
  act3Score: number;
  agreement: "HIGH" | "LOW";
  delta: number;
  lowerConfidenceSource: "ACT_1" | "ACT_3";
  downweightFactor: number; // 1.0 for HIGH, 0.75 for LOW
}

// ──────────────────────────────────────────────
// Scoring Layers
// ──────────────────────────────────────────────

export interface LayerAScore {
  itemId: string;
  construct: Construct;
  rawScore: number; // 0 or 1, scaled by difficulty
  difficultyParam: number;
  responseTimeMs?: number;
  act: AssessmentAct;
}

export interface AIEvalIndicator {
  indicatorId: string;
  present: boolean;
  reasoning: string;
}

export interface AIEvalRun {
  runIndex: number;
  indicators: AIEvalIndicator[];
  aggregateScore: number; // indicators_present / total
  modelId: string;
  latencyMs: number;
  rawOutput: string;
}

export interface LayerBScore {
  messageId: string;
  construct: Construct;
  indicators: AIEvalIndicator[]; // Median result across 3 runs
  aggregateScore: number;
  runs: AIEvalRun[];
  medianScore: number;
  variance: number; // SD across 3 runs
  highVarianceFlag: boolean; // SD > 0.3
  downweighted: boolean;
  act: AssessmentAct;
  isFallback?: boolean; // true when AI was unavailable and heuristic scoring was used
}

export type CeilingType = CeilingTypeEnum;

export interface LayerCCharacterization {
  construct: Construct;
  ceilingType: CeilingType;
  narrative: string;
  trainingRecommendation: string;
  supervisionImplication: string;
  evidenceStrength: number; // 0.0 to 1.0
}

export interface ConstructLayeredScore {
  construct: Construct;
  layer: string; // COGNITIVE_CORE | TECHNICAL_APTITUDE | BEHAVIORAL_INTEGRITY
  layerAScore: number | null;
  layerBScore: number | null;
  layerAWeight: number;
  layerBWeight: number;
  combinedRawScore: number;
  percentile: number;
  itemCount: number;
  avgResponseTimeMs: number;
  consistencyLevel?: "HIGH" | "LOW" | null;
  consistencyDownweightApplied: boolean;
  ceilingCharacterization?: LayerCCharacterization | null;
  /** True when construct has insufficient data (< 3 items for Layer A, < 2 exchanges for Layer B). */
  insufficientData?: boolean;
}

// ──────────────────────────────────────────────
// AI Evaluation Rubrics
// ──────────────────────────────────────────────

export interface BehavioralIndicator {
  id: string;
  label: string;
  description: string;
  positiveCriteria: string;
  negativeCriteria: string;
}

export interface ConstructRubric {
  construct: Construct;
  version: number;
  indicators: BehavioralIndicator[];
  scoringNotes: string;
}

// ──────────────────────────────────────────────
// Assessment Engine State Machine
// ──────────────────────────────────────────────

export type EngineActionType =
  | "AGENT_MESSAGE"
  | "INTERACTIVE_ELEMENT"
  | "CLASSIFY_AND_BRANCH"
  | "TRANSITION"
  | "COMPLETE";

export interface AgentMessageAction {
  type: "AGENT_MESSAGE";
  systemPrompt: string;
  userContext: string; // Context about what to say, fed to AI
  act: AssessmentAct;
  metadata?: Record<string, unknown>;
}

export interface InteractiveElementAction {
  type: "INTERACTIVE_ELEMENT";
  elementType: InteractionElementType;
  elementData: {
    prompt: string;
    options?: string[];
    correctAnswer?: string;
    timeLimit?: number;
    construct?: Construct;
    itemId?: string;
    timingExpectations?: { fast: number; typical: number; slow: number };
    [key: string]: unknown; // Allow additional item-bank fields
  };
  act: AssessmentAct;
  followUpPrompt?: string; // What the agent says after the candidate responds
  metadata?: Record<string, unknown>;
}

export interface TransitionAction {
  type: "TRANSITION";
  from: { act: AssessmentAct; detail: string };
  to: { act: AssessmentAct; detail: string };
  transitionMessage: string; // What the agent says during the transition
}

export interface CompleteAction {
  type: "COMPLETE";
  closingMessage: string;
}

export type EngineAction =
  | AgentMessageAction
  | InteractiveElementAction
  | TransitionAction
  | CompleteAction;

// ──────────────────────────────────────────────
// Red Flags V2
// ──────────────────────────────────────────────

export interface RedFlagCheck {
  triggered: boolean;
  severity: "CRITICAL" | "WARNING" | "INFO";
  category: string;
  title: string;
  description: string;
  constructs: string[];
}

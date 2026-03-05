import type { Construct } from "@/generated/prisma/client";
import type { ConstructRubric, BehavioralIndicator } from "../types";

/**
 * 12 construct rubrics with behavioral indicators for Layer B AI evaluation.
 *
 * Each rubric has 3-5 indicators that are scored present(1)/absent(0) by the AI evaluator.
 */

export const CONSTRUCT_RUBRICS: ConstructRubric[] = [
  {
    construct: "FLUID_REASONING" as Construct,
    version: 1,
    indicators: [
      { id: "FR_1", label: "Novel Problem Approach", description: "Approaches unfamiliar problems without relying on memorized procedures", positiveCriteria: "Generates a novel approach or analogy to solve an unfamiliar problem", negativeCriteria: "Freezes, requests a formula, or applies an irrelevant memorized procedure" },
      { id: "FR_2", label: "Hypothesis Generation", description: "Generates multiple hypotheses before committing to one", positiveCriteria: "Considers at least 2 possible explanations or approaches", negativeCriteria: "Jumps to a single conclusion without considering alternatives" },
      { id: "FR_3", label: "Logical Consistency", description: "Maintains logical consistency throughout reasoning chain", positiveCriteria: "Each step follows logically from the previous one", negativeCriteria: "Makes logical leaps or contradicts earlier reasoning" },
      { id: "FR_4", label: "Abstract Transfer", description: "Applies abstract principles across different contexts", positiveCriteria: "References a principle from a different domain that applies to the current problem", negativeCriteria: "Cannot see connections between structurally similar problems in different domains" },
    ],
    scoringNotes: "Focus on the quality of reasoning process, not just the correctness of the answer.",
  },
  {
    construct: "EXECUTIVE_CONTROL" as Construct,
    version: 1,
    indicators: [
      { id: "EC_1", label: "Impulse Regulation", description: "Resists impulsive responses under pressure", positiveCriteria: "Pauses to think before responding, especially in high-pressure scenarios", negativeCriteria: "Responds immediately without reflection, or changes answer rapidly" },
      { id: "EC_2", label: "Prioritization", description: "Identifies and acts on highest-priority items first", positiveCriteria: "Explicitly ranks competing demands and addresses most critical items first", negativeCriteria: "Addresses tasks in order presented rather than by priority" },
      { id: "EC_3", label: "Working Memory", description: "Tracks multiple variables simultaneously", positiveCriteria: "References multiple constraints or variables in a single response", negativeCriteria: "Loses track of previously stated constraints or forgets key variables" },
      { id: "EC_4", label: "Goal Maintenance", description: "Maintains focus on the primary objective despite distractions", positiveCriteria: "Returns to the main goal after addressing interruptions", negativeCriteria: "Gets derailed by subsidiary issues and loses sight of the main objective" },
    ],
    scoringNotes: "Pay attention to what happens under pressure — does the candidate maintain executive function or does it degrade?",
  },
  {
    construct: "COGNITIVE_FLEXIBILITY" as Construct,
    version: 1,
    indicators: [
      { id: "CF_1", label: "Perspective Shift", description: "Willingly abandons a previous approach when evidence contradicts it", positiveCriteria: "Explicitly acknowledges when their initial approach was wrong and pivots", negativeCriteria: "Doubles down on a failing approach or ignores contradicting evidence" },
      { id: "CF_2", label: "Rule Integration", description: "Integrates new rules or information into existing frameworks", positiveCriteria: "Successfully applies updated rules without reverting to old ones", negativeCriteria: "Confuses old and new rules, or cannot apply updated information" },
      { id: "CF_3", label: "Multi-Framework Thinking", description: "Can view a problem through multiple lenses", positiveCriteria: "Discusses the same situation from different stakeholder or analytical perspectives", negativeCriteria: "Applies only a single framework or perspective" },
    ],
    scoringNotes: "The key signal is whether the candidate can change their mind when the data warrants it.",
  },
  {
    construct: "METACOGNITIVE_CALIBRATION" as Construct,
    version: 1,
    indicators: [
      { id: "MC_1", label: "Confidence Accuracy", description: "Stated confidence matches actual performance", positiveCriteria: "Expresses high confidence on items they get right and lower confidence on items they struggle with", negativeCriteria: "Consistently overconfident on wrong answers or underconfident on correct ones" },
      { id: "MC_2", label: "Error Recognition", description: "Accurately identifies own errors and weaknesses", positiveCriteria: "Correctly identifies which parts of a task they handled poorly", negativeCriteria: "Claims to have done well on tasks where they clearly struggled" },
      { id: "MC_3", label: "Strategic Self-Awareness", description: "Can articulate their own thinking process", positiveCriteria: "Describes what strategies they used and why", negativeCriteria: "Cannot explain their reasoning process ('I just knew' without elaboration)" },
    ],
    scoringNotes: "Compare self-reported assessments against actual performance throughout the session.",
  },
  {
    construct: "LEARNING_VELOCITY" as Construct,
    version: 1,
    indicators: [
      { id: "LV_1", label: "Rapid Absorption", description: "Quickly absorbs and applies new information", positiveCriteria: "Correctly applies a newly taught concept within 1-2 attempts", negativeCriteria: "Requires multiple repetitions or cannot apply new information after explanation" },
      { id: "LV_2", label: "Pattern Extraction", description: "Identifies underlying patterns from examples", positiveCriteria: "Notices and articulates the pattern or rule governing a set of examples", negativeCriteria: "Treats each example independently without extracting general rules" },
      { id: "LV_3", label: "Error Correction Speed", description: "Quickly adjusts after making a mistake", positiveCriteria: "Identifies what went wrong and corrects approach within 1 attempt", negativeCriteria: "Repeats the same error multiple times" },
      { id: "LV_4", label: "Transfer", description: "Applies learning from one context to a different one", positiveCriteria: "Uses a lesson from one scenario when facing a structurally similar challenge", negativeCriteria: "Each new context is treated as completely unrelated to previous ones" },
    ],
    scoringNotes: "Measure the speed of learning, not the final level of understanding.",
  },
  {
    construct: "SYSTEMS_DIAGNOSTICS" as Construct,
    version: 1,
    indicators: [
      { id: "SD_1", label: "Variable Mapping", description: "Identifies key variables in a system", positiveCriteria: "Names the critical variables and their relationships", negativeCriteria: "Misses key variables or focuses on irrelevant details" },
      { id: "SD_2", label: "Root Cause Analysis", description: "Traces symptoms back to root causes", positiveCriteria: "Moves beyond symptoms to propose underlying mechanisms", negativeCriteria: "Treats symptoms as the problem without investigating causes" },
      { id: "SD_3", label: "Cascading Effects", description: "Anticipates how changes in one part affect others", positiveCriteria: "Predicts second-order consequences of proposed changes", negativeCriteria: "Considers only the immediate effect without thinking about downstream impacts" },
    ],
    scoringNotes: "Look for depth of systems understanding, not just surface-level diagnosis.",
  },
  {
    construct: "PATTERN_RECOGNITION" as Construct,
    version: 1,
    indicators: [
      { id: "PR_1", label: "Sequence Detection", description: "Identifies patterns in sequential data", positiveCriteria: "Correctly predicts the next element in a non-obvious sequence", negativeCriteria: "Cannot identify the rule governing a pattern" },
      { id: "PR_2", label: "Anomaly Detection", description: "Spots outliers or breaks in a pattern", positiveCriteria: "Identifies which data point doesn't fit the established pattern", negativeCriteria: "Misses anomalies or identifies normal variation as anomalous" },
      { id: "PR_3", label: "Abstract Pattern Transfer", description: "Recognizes structural similarities across different representations", positiveCriteria: "Sees the same pattern in different formats (numbers, words, shapes)", negativeCriteria: "Cannot transfer pattern recognition across representational formats" },
    ],
    scoringNotes: "Difficulty should scale with pattern complexity, not surface presentation.",
  },
  {
    construct: "QUANTITATIVE_REASONING" as Construct,
    version: 1,
    indicators: [
      { id: "QR_1", label: "Problem Structuring", description: "Breaks complex problems into solvable components", positiveCriteria: "Identifies the sub-problems and tackles them in logical order", negativeCriteria: "Attempts to solve the whole problem at once or cannot identify components" },
      { id: "QR_2", label: "Estimation", description: "Makes reasonable estimates when exact calculation is difficult", positiveCriteria: "Provides a reasonable ballpark figure with supporting logic", negativeCriteria: "Guesses randomly or refuses to estimate without exact computation" },
      { id: "QR_3", label: "Numerical Fluency", description: "Performs calculations accurately and efficiently", positiveCriteria: "Arrives at correct answers with appropriate precision", negativeCriteria: "Makes arithmetic errors that change the conclusion" },
    ],
    scoringNotes: "Process is as important as the answer — look for structured mathematical thinking.",
  },
  {
    construct: "SPATIAL_VISUALIZATION" as Construct,
    version: 1,
    indicators: [
      { id: "SV_1", label: "Mental Rotation", description: "Accurately rotates objects mentally", positiveCriteria: "Correctly identifies rotated versions of objects", negativeCriteria: "Confuses rotated with reflected objects or cannot track rotation" },
      { id: "SV_2", label: "Spatial Reasoning", description: "Reasons about spatial relationships without physical manipulation", positiveCriteria: "Correctly answers spatial questions through mental visualization", negativeCriteria: "Requires physical aids or cannot reason about spatial relationships abstractly" },
      { id: "SV_3", label: "Dimensional Thinking", description: "Moves between 2D and 3D representations", positiveCriteria: "Correctly predicts 3D outcomes from 2D inputs (or vice versa)", negativeCriteria: "Cannot translate between 2D and 3D representations" },
    ],
    scoringNotes: "Primary data comes from structured items. Conversational indicators supplement.",
  },
  {
    construct: "MECHANICAL_REASONING" as Construct,
    version: 1,
    indicators: [
      { id: "MR_1", label: "Physical Intuition", description: "Has correct intuitions about physical systems", positiveCriteria: "Predicts physical outcomes that align with actual physics", negativeCriteria: "Has incorrect intuitions about force, motion, or energy" },
      { id: "MR_2", label: "Mechanical Principles", description: "Applies mechanical principles correctly", positiveCriteria: "References and applies principles like leverage, gearing, or pressure correctly", negativeCriteria: "Misapplies or confuses mechanical principles" },
      { id: "MR_3", label: "System Interaction", description: "Understands how mechanical components interact", positiveCriteria: "Correctly predicts how changing one component affects the system", negativeCriteria: "Cannot reason about component interactions" },
    ],
    scoringNotes: "Primary data comes from structured items. Conversational indicators supplement.",
  },
  {
    construct: "PROCEDURAL_RELIABILITY" as Construct,
    version: 1,
    indicators: [
      { id: "PLR_1", label: "Protocol Adherence", description: "Follows established procedures and protocols", positiveCriteria: "References proper procedures, documentation requirements, or standard practices", negativeCriteria: "Ignores or bypasses established procedures" },
      { id: "PLR_2", label: "Consistency", description: "Applies rules consistently across situations", positiveCriteria: "Same standards applied regardless of who is involved or situational pressure", negativeCriteria: "Standards shift based on convenience, relationships, or pressure" },
      { id: "PLR_3", label: "Attention to Detail", description: "Notices details that others might miss", positiveCriteria: "References specific details from the scenario in their response", negativeCriteria: "Gives generic responses that don't reflect scenario-specific details" },
    ],
    scoringNotes: "Primarily measured through Act 1 scenarios. Look for consistency across different scenarios.",
  },
  {
    construct: "ETHICAL_JUDGMENT" as Construct,
    version: 1,
    indicators: [
      { id: "EJ_1", label: "Ethical Recognition", description: "Recognizes ethical dimensions of a situation", positiveCriteria: "Identifies ethical considerations without being prompted", negativeCriteria: "Misses or dismisses ethical aspects of the situation" },
      { id: "EJ_2", label: "Stakeholder Consideration", description: "Considers impact on multiple stakeholders", positiveCriteria: "References how decisions affect different groups", negativeCriteria: "Considers only their own perspective or one stakeholder" },
      { id: "EJ_3", label: "Principled Decision-Making", description: "Makes decisions based on ethical principles rather than convenience", positiveCriteria: "Chooses the ethically correct path even when it's harder or costlier", negativeCriteria: "Rationalizes the convenient choice or avoids making a decision" },
      { id: "EJ_4", label: "Moral Courage", description: "Maintains ethical position under pressure", positiveCriteria: "Stands firm on ethical issues when challenged by authority or peers", negativeCriteria: "Abandons ethical position under social or hierarchical pressure" },
    ],
    scoringNotes: "Primarily measured through Act 1 scenarios, especially Scenario 2 (Integrity Pressure Cooker).",
  },
];

/**
 * Get the rubric for a specific construct.
 */
export function getRubric(construct: Construct | string): ConstructRubric | undefined {
  return CONSTRUCT_RUBRICS.find((r) => r.construct === construct);
}

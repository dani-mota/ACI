import type { Construct } from "@/generated/prisma/client";
import type { BeatTemplate, ScenarioShell, ResponseClassification } from "../types";

/**
 * Four scenario shells for Act 1: The Scenario Gauntlet.
 * Each follows the six-beat template with three-path branching.
 *
 * Domain-neutral defaults are used when no JD context is available.
 * When JD context exists, the generator creates domain-adapted versions.
 */

// ──────────────────────────────────────────────
// Beat type constants
// ──────────────────────────────────────────────

const BEAT_TYPES = [
  "INITIAL_SITUATION",
  "INITIAL_RESPONSE",
  "COMPLICATION",
  "SOCIAL_PRESSURE",
  "CONSEQUENCE_REVEAL",
  "REFLECTIVE_SYNTHESIS",
] as const;

// ──────────────────────────────────────────────
// Scenario 1: The Escalating System Failure
// ──────────────────────────────────────────────

const SCENARIO_1: ScenarioShell = {
  id: "escalating-system-failure",
  name: "The Escalating System Failure",
  description:
    "A system or process is producing unexpected results. The candidate must diagnose what is going wrong, generate hypotheses, adapt when the situation changes, and hold their diagnosis when challenged.",
  primaryConstructs: [
    "SYSTEMS_DIAGNOSTICS",
    "FLUID_REASONING",
    "COGNITIVE_FLEXIBILITY",
    "LEARNING_VELOCITY",
  ] as Construct[],
  beats: [
    {
      beatNumber: 0,
      type: "INITIAL_SITUATION",
      primaryConstructs: ["SYSTEMS_DIAGNOSTICS"] as Construct[],
      secondaryConstructs: [] as Construct[],
      agentPromptTemplate:
        "Describe a workplace situation where a critical system has started producing unexpected outputs. Briefly explain how the system normally works, then describe the symptoms — data inconsistencies, process deviations, or quality anomalies over the past 48 hours. Include 3-4 relevant variables and constraints in the reference card.",
      branchScripts: {
        STRONG: "Make the system complex with multiple interdependent subsystems. The symptoms should suggest a cascading failure requiring cross-system understanding.",
        ADEQUATE: "Use moderate complexity. Symptoms should point to a specific area but could have multiple causes, with clear diagnostic pathways.",
        WEAK: "Keep the system straightforward with a clear input-output relationship. Symptoms are localized and the diagnostic path is direct.",
      },
      rubricIndicators: [
        {
          id: "S1B0_1",
          label: "Variable Identification",
          description: "Candidate identifies relevant variables in the initial situation",
          positiveCriteria: "Notes at least 2 key variables or constraints from the situation description",
          negativeCriteria: "Focuses on irrelevant details or misses the core system elements",
        },
        {
          id: "S1B0_2",
          label: "System Comprehension",
          description: "Candidate demonstrates understanding of the system explanation",
          positiveCriteria: "References how the system normally works when analyzing the failure",
          negativeCriteria: "Ignores or misunderstands the system description",
        },
      ],
    },
    {
      beatNumber: 1,
      type: "INITIAL_RESPONSE",
      primaryConstructs: ["FLUID_REASONING", "PROCEDURAL_RELIABILITY"] as Construct[],
      secondaryConstructs: ["SYSTEMS_DIAGNOSTICS"] as Construct[],
      agentPromptTemplate:
        "Ask the candidate what they would do in this situation. Keep it open-ended — no options, no hints.",
      branchScripts: {
        STRONG: "Escalate: reveal that the system has additional layers of complexity their initial approach didn't account for.",
        ADEQUATE: "Introduce a parallel issue that tests whether their diagnostic framework extends to related problems.",
        WEAK: "Provide a clearer signal about where the problem might be and ask them to narrow their investigation.",
      },
      rubricIndicators: [
        {
          id: "S1B1_1",
          label: "Causal Reasoning",
          description: "Generates hypotheses about what might be causing the failure",
          positiveCriteria: "Proposes at least one plausible root cause with supporting reasoning",
          negativeCriteria: "Jumps to a conclusion without reasoning or proposes an implausible cause",
        },
        {
          id: "S1B1_2",
          label: "Systematic Approach",
          description: "Follows a logical diagnostic sequence",
          positiveCriteria: "Describes a step-by-step approach or prioritizes what to check first",
          negativeCriteria: "Proposes random or unstructured actions",
        },
        {
          id: "S1B1_3",
          label: "Process Reference",
          description: "References established procedures or standard diagnostic methods",
          positiveCriteria: "Mentions following protocol, documenting findings, or consulting references",
          negativeCriteria: "Acts purely on instinct without referencing any standard practice",
        },
      ],
    },
    {
      beatNumber: 2,
      type: "COMPLICATION",
      primaryConstructs: ["COGNITIVE_FLEXIBILITY"] as Construct[],
      secondaryConstructs: ["FLUID_REASONING", "SYSTEMS_DIAGNOSTICS"] as Construct[],
      agentPromptTemplate:
        "Introduce a complication: new information arrives that contradicts or complicates the candidate's initial approach. Present it as something that just came to your attention.",
      branchScripts: {
        STRONG: "Make the complication subtle — it requires re-evaluating multiple assumptions simultaneously and creates a paradox with their initial diagnosis.",
        ADEQUATE: "The complication clearly contradicts one element of their approach but leaves other parts intact. They need to partially revise.",
        WEAK: "The complication is straightforward — new data clearly points in a different direction, giving a clear opportunity to pivot.",
      },
      rubricIndicators: [
        {
          id: "S1B2_1",
          label: "Adaptation",
          description: "Candidate modifies their approach in response to new information",
          positiveCriteria: "Explicitly revises their hypothesis or approach based on the new data",
          negativeCriteria: "Ignores the new information or doubles down on their original approach without addressing contradictions",
        },
        {
          id: "S1B2_2",
          label: "Integration",
          description: "Integrates old and new information into an updated understanding",
          positiveCriteria: "Reconciles the complication with prior information into a coherent revised model",
          negativeCriteria: "Treats the complication in isolation without connecting it to the broader situation",
        },
      ],
    },
    {
      beatNumber: 3,
      type: "SOCIAL_PRESSURE",
      primaryConstructs: ["EXECUTIVE_CONTROL", "ETHICAL_JUDGMENT"] as Construct[],
      secondaryConstructs: ["PROCEDURAL_RELIABILITY"] as Construct[],
      agentPromptTemplate:
        "Introduce a person who pushes back on the candidate's approach — a colleague or supervisor who disagrees, applies pressure to take a shortcut, or proposes an alternative. Ask the candidate how they respond.",
      branchScripts: {
        STRONG: "A senior leader insists on a quick fix that bypasses proper procedure. Career implications are implicit. Multiple stakeholders are watching.",
        ADEQUATE: "A peer suggests a faster but less thorough approach. The disagreement is professional. The candidate must weigh efficiency vs. completeness.",
        WEAK: "A colleague offers a helpful suggestion framed as criticism. The candidate needs to separate the feedback from the delivery.",
      },
      rubricIndicators: [
        {
          id: "S1B3_1",
          label: "Position Maintenance",
          description: "Maintains a reasoned position under social pressure",
          positiveCriteria: "Articulates why they believe their approach is correct while acknowledging the other perspective",
          negativeCriteria: "Immediately capitulates to social pressure or becomes confrontational",
        },
        {
          id: "S1B3_2",
          label: "Ethical Navigation",
          description: "Navigates competing obligations appropriately",
          positiveCriteria: "References safety, quality, or procedural standards when resisting pressure",
          negativeCriteria: "Prioritizes social harmony over doing the right thing, or ignores ethical dimensions",
        },
      ],
    },
    {
      beatNumber: 4,
      type: "CONSEQUENCE_REVEAL",
      primaryConstructs: ["EXECUTIVE_CONTROL"] as Construct[],
      secondaryConstructs: ["METACOGNITIVE_CALIBRATION"] as Construct[],
      agentPromptTemplate:
        "Reveal what happened as a result of the candidate's choices. The consequence may be positive, negative, or mixed. Ask them to evaluate the outcome.",
      branchScripts: {
        STRONG: "The outcome is mixed with complex tradeoffs — some aspects succeeded while others created new problems with second-order consequences.",
        ADEQUATE: "The outcome is mostly positive but with a clear gap they missed or could have handled better.",
        WEAK: "The outcome reveals a clear error from an earlier decision. The path to correction is visible.",
      },
      rubricIndicators: [
        {
          id: "S1B4_1",
          label: "Error Recognition",
          description: "Recognizes what went wrong or could have been better",
          positiveCriteria: "Accurately identifies the gap between their actions and the optimal outcome",
          negativeCriteria: "Denies any issues or blames external factors without self-reflection",
        },
        {
          id: "S1B4_2",
          label: "Corrective Action",
          description: "Proposes concrete steps to address the consequences",
          positiveCriteria: "Outlines specific actions to mitigate negative outcomes or build on positive ones",
          negativeCriteria: "Provides vague or no corrective actions",
        },
      ],
    },
    {
      beatNumber: 5,
      type: "REFLECTIVE_SYNTHESIS",
      primaryConstructs: ["METACOGNITIVE_CALIBRATION", "LEARNING_VELOCITY"] as Construct[],
      secondaryConstructs: [] as Construct[],
      agentPromptTemplate:
        "Ask the candidate to reflect: 'Knowing what you know now, what would you do differently from the start? What was the hardest part of this situation?'",
      branchScripts: {
        STRONG: "Probe whether they can extract generalizable principles from this specific experience.",
        ADEQUATE: "Explore their level of self-awareness about their approach and decision-making.",
        WEAK: "Help them recognize where they had difficulty and articulate why.",
      },
      rubricIndicators: [
        {
          id: "S1B5_1",
          label: "Accurate Self-Assessment",
          description: "Self-assessment aligns with actual performance across the scenario",
          positiveCriteria: "Identifies strengths and weaknesses that match their actual demonstrated behavior",
          negativeCriteria: "Self-assessment contradicts their actual performance (claims success where they struggled or vice versa)",
        },
        {
          id: "S1B5_2",
          label: "Lesson Extraction",
          description: "Extracts generalizable lessons from the specific experience",
          positiveCriteria: "Identifies a principle or approach that would apply beyond this specific scenario",
          negativeCriteria: "Reflection is purely scenario-specific with no broader insight",
        },
      ],
    },
  ],
  domainNeutralContent: {
    setting: "A mid-sized professional services firm where data processing systems have started producing inconsistent outputs",
    characters: ["The candidate (new team member)", "Jordan (senior colleague who has a different theory)", "Alex (team lead who wants a quick fix)"],
    initialSituation: "The automated reporting system that generates client deliverables has been producing data inconsistencies for the past 48 hours. Three client reports were flagged as inaccurate. The system processes data through four stages: intake, validation, transformation, and output. Each stage has logging, but the logs show different anomaly patterns at different stages.",
  },
};

// ──────────────────────────────────────────────
// Scenario 2: The Integrity Pressure Cooker
// ──────────────────────────────────────────────

const SCENARIO_2: ScenarioShell = {
  id: "integrity-pressure-cooker",
  name: "The Integrity Pressure Cooker",
  description:
    "A multi-stage ethical and procedural dilemma. The candidate notices something wrong, faces increasing pressure to ignore it, and must navigate competing obligations.",
  primaryConstructs: [
    "ETHICAL_JUDGMENT",
    "PROCEDURAL_RELIABILITY",
    "EXECUTIVE_CONTROL",
  ] as Construct[],
  beats: [
    {
      beatNumber: 0,
      type: "INITIAL_SITUATION",
      primaryConstructs: ["SYSTEMS_DIAGNOSTICS"] as Construct[],
      secondaryConstructs: [] as Construct[],
      agentPromptTemplate:
        "Describe a situation where the candidate discovers something that doesn't look right — a discrepancy in records, a process shortcut, or an overlooked quality issue. It's not immediately catastrophic but could have significant consequences if left unaddressed.",
      branchScripts: {
        STRONG: "Make the discrepancy subtle and embedded in routine operations. The implications are serious but not obvious.",
        ADEQUATE: "The discrepancy is moderately visible — it could be an honest mistake or intentional. The candidate must decide how to investigate.",
        WEAK: "The discrepancy is relatively clear. The focus is on what the candidate chooses to do about it.",
      },
      rubricIndicators: [
        { id: "S2B0_1", label: "Issue Detection", description: "Recognizes the significance of the discrepancy", positiveCriteria: "Identifies the discrepancy as something that warrants investigation", negativeCriteria: "Dismisses or minimizes the discrepancy" },
      ],
    },
    {
      beatNumber: 1,
      type: "INITIAL_RESPONSE",
      primaryConstructs: ["FLUID_REASONING", "PROCEDURAL_RELIABILITY"] as Construct[],
      secondaryConstructs: ["SYSTEMS_DIAGNOSTICS"] as Construct[],
      agentPromptTemplate: "Ask the candidate what they would do about the discrepancy they've noticed.",
      branchScripts: {
        STRONG: "Escalate the ethical dimension — the discrepancy involves someone with authority or a sensitive situation making reporting harder.",
        ADEQUATE: "The reporting path is clear but requires effort. See if the candidate follows through on their stated intention.",
        WEAK: "Provide more context about why the discrepancy matters and ask again what they would do.",
      },
      rubricIndicators: [
        { id: "S2B1_1", label: "Procedural Adherence", description: "References proper channels or procedures", positiveCriteria: "Mentions documenting the finding, reporting through proper channels, or following protocol", negativeCriteria: "Proposes handling it informally or ignoring it" },
        { id: "S2B1_2", label: "Proactive Stance", description: "Takes initiative to address the issue", positiveCriteria: "Takes ownership and proposes concrete action", negativeCriteria: "Waits to be told what to do or hopes someone else will handle it" },
      ],
    },
    {
      beatNumber: 2,
      type: "COMPLICATION",
      primaryConstructs: ["COGNITIVE_FLEXIBILITY"] as Construct[],
      secondaryConstructs: ["FLUID_REASONING", "SYSTEMS_DIAGNOSTICS"] as Construct[],
      agentPromptTemplate: "Reveal that the issue is larger than it first appeared — the discrepancy is not isolated, it suggests a pattern. This raises the stakes.",
      branchScripts: {
        STRONG: "The pattern suggests systemic issues implicating processes the candidate was told are reliable. They must question established assumptions.",
        ADEQUATE: "The pattern is concerning but has a plausible innocent explanation. The candidate must decide whether to escalate or investigate further.",
        WEAK: "The expanded scope is alarming but the next step is clear.",
      },
      rubricIndicators: [
        { id: "S2B2_1", label: "Scope Adjustment", description: "Adjusts approach to match the expanded scope", positiveCriteria: "Recognizes the broader pattern changes the situation and adjusts their plan", negativeCriteria: "Continues with the same approach regardless of new scope" },
      ],
    },
    {
      beatNumber: 3,
      type: "SOCIAL_PRESSURE",
      primaryConstructs: ["EXECUTIVE_CONTROL", "ETHICAL_JUDGMENT"] as Construct[],
      secondaryConstructs: ["PROCEDURAL_RELIABILITY"] as Construct[],
      agentPromptTemplate: "Introduce someone with authority who pressures the candidate to drop the issue, minimize it, or handle it quietly. The personal cost of doing the right thing increases.",
      branchScripts: {
        STRONG: "A respected senior figure tells the candidate to let it go. Implicit consequences for pushing further. Multiple people seem to know and accept it.",
        ADEQUATE: "A respected colleague suggests it's not worth the trouble. Pressure is social rather than hierarchical.",
        WEAK: "Someone suggests an easier path that satisfies minimum requirements but doesn't fully address the issue.",
      },
      rubricIndicators: [
        { id: "S2B3_1", label: "Ethical Resilience", description: "Maintains principled position under pressure", positiveCriteria: "Refuses to compromise on the issue while remaining professional and constructive", negativeCriteria: "Caves to pressure or finds ways to rationalize inaction" },
        { id: "S2B3_2", label: "Diplomatic Navigation", description: "Handles the interpersonal dimension skillfully", positiveCriteria: "Acknowledges the other person's perspective while firmly maintaining their position", negativeCriteria: "Is either confrontational or completely avoidant" },
      ],
    },
    {
      beatNumber: 4,
      type: "CONSEQUENCE_REVEAL",
      primaryConstructs: ["EXECUTIVE_CONTROL"] as Construct[],
      secondaryConstructs: ["METACOGNITIVE_CALIBRATION"] as Construct[],
      agentPromptTemplate: "Reveal the outcome. If they held firm, the investigation uncovers the full scope. If they compromised, show what was missed. Ask them to evaluate their decisions.",
      branchScripts: {
        STRONG: "The outcome validates their persistence but reveals more complexity. Ask what they learned about navigating institutional pressure.",
        ADEQUATE: "The outcome is positive but with costs — strained relationships, time spent. Ask how they'd handle the tradeoffs differently.",
        WEAK: "The outcome shows consequences of their choices. Ask what they would change and why.",
      },
      rubricIndicators: [
        { id: "S2B4_1", label: "Outcome Evaluation", description: "Accurately evaluates the consequences of their decisions", positiveCriteria: "Provides a balanced assessment of what went well and what didn't", negativeCriteria: "Provides a one-sided or inaccurate evaluation" },
      ],
    },
    {
      beatNumber: 5,
      type: "REFLECTIVE_SYNTHESIS",
      primaryConstructs: ["METACOGNITIVE_CALIBRATION", "LEARNING_VELOCITY"] as Construct[],
      secondaryConstructs: [] as Construct[],
      agentPromptTemplate: "Ask the candidate to reflect: 'Knowing what you know now, what would you do differently from the start? What was the hardest part?'",
      branchScripts: {
        STRONG: "Probe for deeper insight about systemic vs. individual ethics and balancing thoroughness with pragmatism.",
        ADEQUATE: "Ask them to generalize: in what other situations would similar principles apply?",
        WEAK: "Help them articulate what made it difficult and what they would look for in the future.",
      },
      rubricIndicators: [
        { id: "S2B5_1", label: "Self-Awareness", description: "Demonstrates accurate self-awareness", positiveCriteria: "Identifies specific decisions that were difficult and why", negativeCriteria: "Provides superficial reflection that doesn't match their actual choices" },
        { id: "S2B5_2", label: "Principle Extraction", description: "Extracts generalizable ethical principles", positiveCriteria: "Articulates a guiding principle that extends beyond this specific scenario", negativeCriteria: "Reflection remains purely tactical without ethical dimension" },
      ],
    },
  ],
  domainNeutralContent: {
    setting: "A growing company where the candidate discovers discrepancies in project billing records during a routine review",
    characters: ["The candidate (project coordinator)", "Morgan (senior manager who signed off on the records)", "Sam (colleague who thinks it's not worth reporting)"],
    initialSituation: "While preparing quarterly reports, the candidate notices that three project accounts show time entries that don't match the actual work completed. The discrepancies are small individually but show a consistent pattern. The entries were approved by a senior manager.",
  },
};

// ──────────────────────────────────────────────
// Scenario 3: The Learning Gauntlet
// ──────────────────────────────────────────────

const SCENARIO_3: ScenarioShell = {
  id: "learning-gauntlet",
  name: "The Learning Gauntlet",
  description:
    "The agent teaches the candidate a new system or rule set, then immediately tests application. Rules change, constraints are added, and the candidate must absorb and adapt quickly.",
  primaryConstructs: [
    "LEARNING_VELOCITY",
    "COGNITIVE_FLEXIBILITY",
    "PATTERN_RECOGNITION",
  ] as Construct[],
  beats: [
    {
      beatNumber: 0,
      type: "INITIAL_SITUATION",
      primaryConstructs: ["SYSTEMS_DIAGNOSTICS"] as Construct[],
      secondaryConstructs: [] as Construct[],
      agentPromptTemplate:
        "Teach the candidate a new system with 4-5 rules that have an internal logic. Explain clearly and concisely, then ask them to apply one rule to check their understanding.",
      branchScripts: {
        STRONG: "Use 5 rules with subtle interdependencies that require holding multiple rules in working memory simultaneously.",
        ADEQUATE: "Use 4 mostly independent rules. Application is straightforward if remembered correctly.",
        WEAK: "Use 3 clear rules. Each applies in a distinct situation with minimal overlap.",
      },
      rubricIndicators: [
        { id: "S3B0_1", label: "Rule Absorption", description: "Demonstrates understanding of the taught rules", positiveCriteria: "Correctly applies the rule to the test case", negativeCriteria: "Misapplies or forgets the rule" },
      ],
    },
    {
      beatNumber: 1,
      type: "INITIAL_RESPONSE",
      primaryConstructs: ["FLUID_REASONING", "PROCEDURAL_RELIABILITY"] as Construct[],
      secondaryConstructs: ["SYSTEMS_DIAGNOSTICS"] as Construct[],
      agentPromptTemplate: "Give the candidate a case that requires applying 2 rules simultaneously. Ask them to work through it step by step.",
      branchScripts: {
        STRONG: "Use a complex case requiring 3 rules at once where the interaction creates a non-obvious outcome.",
        ADEQUATE: "Use a case requiring 2 rules with a logical interaction if both are correctly applied.",
        WEAK: "Start with a simpler case where one rule clearly applies. Confirm basic understanding first.",
      },
      rubricIndicators: [
        { id: "S3B1_1", label: "Multi-Rule Application", description: "Applies multiple rules correctly in combination", positiveCriteria: "Arrives at the correct outcome by applying the rules in sequence", negativeCriteria: "Misses one or more rules or applies them incorrectly" },
      ],
    },
    {
      beatNumber: 2,
      type: "COMPLICATION",
      primaryConstructs: ["COGNITIVE_FLEXIBILITY"] as Construct[],
      secondaryConstructs: ["FLUID_REASONING", "SYSTEMS_DIAGNOSTICS"] as Construct[],
      agentPromptTemplate: "Tell the candidate the rules have been updated. Change one rule and immediately test whether they can apply the updated system without reverting to the old rule.",
      branchScripts: {
        STRONG: "Change a fundamental rule that affects how other rules interact, requiring a restructured mental model.",
        ADEQUATE: "Change one rule that affects some but not all cases. The candidate must identify when the new rule applies.",
        WEAK: "Change a rule in a straightforward way with a test case that obviously uses the new rule.",
      },
      rubricIndicators: [
        { id: "S3B2_1", label: "Rule Update Integration", description: "Successfully integrates the rule change", positiveCriteria: "Applies the new rule correctly without reverting to the old one", negativeCriteria: "Reverts to the old rule, confuses old and new, or cannot adapt" },
        { id: "S3B2_2", label: "Pattern Recognition", description: "Spots the underlying pattern across rule variations", positiveCriteria: "Notices or comments on the structural relationship between the old and new rules", negativeCriteria: "Treats each rule as completely independent without seeing connections" },
      ],
    },
    {
      beatNumber: 3,
      type: "SOCIAL_PRESSURE",
      primaryConstructs: ["EXECUTIVE_CONTROL", "ETHICAL_JUDGMENT"] as Construct[],
      secondaryConstructs: ["PROCEDURAL_RELIABILITY"] as Construct[],
      agentPromptTemplate: "Add time pressure: tell the candidate you're running short on time and need them to process three cases quickly. Present three rapid-fire cases testing different rule combinations.",
      branchScripts: {
        STRONG: "Three cases of increasing complexity. The third has an ambiguous element testing whether speed makes them skip careful analysis.",
        ADEQUATE: "Three cases at consistent moderate difficulty testing accuracy under time pressure.",
        WEAK: "Three straightforward cases testing baseline speed and confidence under mild pressure.",
      },
      rubricIndicators: [
        { id: "S3B3_1", label: "Accuracy Under Pressure", description: "Maintains accuracy when speed is demanded", positiveCriteria: "Gets 2-3 cases correct despite time pressure", negativeCriteria: "Accuracy drops significantly under pressure" },
      ],
    },
    {
      beatNumber: 4,
      type: "CONSEQUENCE_REVEAL",
      primaryConstructs: ["EXECUTIVE_CONTROL"] as Construct[],
      secondaryConstructs: ["METACOGNITIVE_CALIBRATION"] as Construct[],
      agentPromptTemplate: "Tell the candidate which cases they got right and wrong. Ask them to explain where they went wrong and what was happening in their thinking.",
      branchScripts: {
        STRONG: "Their errors reveal a specific pattern. Point it out and ask them to explain why that pattern emerged.",
        ADEQUATE: "Their errors are mixed. Ask them which types of cases they find most challenging.",
        WEAK: "Walk through the correct application of a missed case and ask them to explain the difference.",
      },
      rubricIndicators: [
        { id: "S3B4_1", label: "Error Analysis", description: "Accurately identifies the source of their errors", positiveCriteria: "Pinpoints the specific rule or step where they went wrong", negativeCriteria: "Cannot identify what went wrong or attributes errors to random causes" },
      ],
    },
    {
      beatNumber: 5,
      type: "REFLECTIVE_SYNTHESIS",
      primaryConstructs: ["METACOGNITIVE_CALIBRATION", "LEARNING_VELOCITY"] as Construct[],
      secondaryConstructs: [] as Construct[],
      agentPromptTemplate: "Ask the candidate: 'What strategy did you use to learn the system? If I taught you a new system tomorrow, what would you do differently?'",
      branchScripts: {
        STRONG: "Probe for metacognitive strategies — do they have a conscious learning approach, or do they learn reactively?",
        ADEQUATE: "Ask them to compare how they learn in different contexts — reading instructions vs. hands-on practice.",
        WEAK: "Ask what made this system hard or easy to learn and what support would help them learn faster.",
      },
      rubricIndicators: [
        { id: "S3B5_1", label: "Learning Strategy Awareness", description: "Can articulate their learning process", positiveCriteria: "Describes a conscious learning strategy or method they use", negativeCriteria: "Cannot articulate how they learn or says 'I just pick things up'" },
        { id: "S3B5_2", label: "Transfer Intent", description: "Can generalize learning approach to new contexts", positiveCriteria: "Identifies specific things they would do differently next time", negativeCriteria: "Reflection is specific to this task with no transfer" },
      ],
    },
  ],
  domainNeutralContent: {
    setting: "A project management system with a specific priority classification and escalation framework",
    characters: ["The candidate (new team member learning the system)", "The assessment agent (acting as trainer)"],
    initialSituation: "The candidate is learning a new project triage system. Incoming requests are classified by urgency (1-3), impact (A-C), and source (internal/external). Each combination follows different routing and response-time rules.",
  },
};

// ──────────────────────────────────────────────
// Scenario 4: The Prioritization Crisis
// ──────────────────────────────────────────────

const SCENARIO_4: ScenarioShell = {
  id: "prioritization-crisis",
  name: "The Prioritization Crisis",
  description:
    "Multiple competing demands, limited resources, new information arriving mid-task, and a team dynamic requiring coordination.",
  primaryConstructs: [
    "EXECUTIVE_CONTROL",
    "SYSTEMS_DIAGNOSTICS",
    "METACOGNITIVE_CALIBRATION",
    "ETHICAL_JUDGMENT",
  ] as Construct[],
  beats: [
    {
      beatNumber: 0,
      type: "INITIAL_SITUATION",
      primaryConstructs: ["SYSTEMS_DIAGNOSTICS"] as Construct[],
      secondaryConstructs: [] as Construct[],
      agentPromptTemplate:
        "Describe a busy workday with 5 tasks due by end of day. Each has different urgency, importance, dependencies, and stakeholders. Resources are constrained. At least two tasks have dependencies.",
      branchScripts: {
        STRONG: "Use 5 tasks with complex interdependencies. Some have hidden dependencies apparent only if the candidate asks the right questions.",
        ADEQUATE: "Use 5 tasks with clear priorities and 2 dependencies. The optimal sequence requires deliberate planning.",
        WEAK: "Use 4 tasks with obvious priority levels and 1 simple dependency.",
      },
      rubricIndicators: [
        { id: "S4B0_1", label: "Task Analysis", description: "Identifies key attributes of each task", positiveCriteria: "Assesses urgency, importance, and dependencies for the tasks", negativeCriteria: "Treats all tasks as equivalent or focuses on only one dimension" },
      ],
    },
    {
      beatNumber: 1,
      type: "INITIAL_RESPONSE",
      primaryConstructs: ["FLUID_REASONING", "PROCEDURAL_RELIABILITY"] as Construct[],
      secondaryConstructs: ["SYSTEMS_DIAGNOSTICS"] as Construct[],
      agentPromptTemplate: "Ask the candidate to create their plan: what order would they tackle the tasks, and why?",
      branchScripts: {
        STRONG: "Add a 6th task that creates a resource conflict with their optimal sequence.",
        ADEQUATE: "Add new information that changes the priority of one task.",
        WEAK: "Point out a dependency they missed and ask them to adjust their plan.",
      },
      rubricIndicators: [
        { id: "S4B1_1", label: "Sequencing Logic", description: "Creates a logical task sequence", positiveCriteria: "Orders tasks based on urgency, dependencies, and strategic importance", negativeCriteria: "Orders tasks randomly or by a single dimension only" },
        { id: "S4B1_2", label: "Resource Awareness", description: "Accounts for resource constraints in planning", positiveCriteria: "Mentions time or resource limitations when explaining their sequence", negativeCriteria: "Ignores constraints and creates an infeasible plan" },
      ],
    },
    {
      beatNumber: 2,
      type: "COMPLICATION",
      primaryConstructs: ["COGNITIVE_FLEXIBILITY"] as Construct[],
      secondaryConstructs: ["FLUID_REASONING", "SYSTEMS_DIAGNOSTICS"] as Construct[],
      agentPromptTemplate: "Introduce a midday crisis: a high-priority urgent request that disrupts the plan. Something has gone wrong requiring immediate attention. Ask how they reprioritize.",
      branchScripts: {
        STRONG: "The crisis requires significant replanning — some tasks must be dropped or delegated. Hard tradeoffs with incomplete information.",
        ADEQUATE: "The crisis affects 2-3 tasks. Most of their plan survives but needs reshuffling.",
        WEAK: "The crisis clearly takes top priority. The focus is on how they adjust the remaining tasks.",
      },
      rubricIndicators: [
        { id: "S4B2_1", label: "Dynamic Reprioritization", description: "Effectively reprioritizes when circumstances change", positiveCriteria: "Creates a revised plan that accounts for the new constraint", negativeCriteria: "Freezes, panics, or tries to do everything without adjusting" },
      ],
    },
    {
      beatNumber: 3,
      type: "SOCIAL_PRESSURE",
      primaryConstructs: ["EXECUTIVE_CONTROL", "ETHICAL_JUDGMENT"] as Construct[],
      secondaryConstructs: ["PROCEDURAL_RELIABILITY"] as Construct[],
      agentPromptTemplate: "Introduce a stakeholder who pushes back on the candidate's reprioritization — they want their task to remain the priority. The candidate must manage this while maintaining their plan.",
      branchScripts: {
        STRONG: "Two stakeholders simultaneously demand priority for different tasks. The candidate must make a judgment call that disappoints one.",
        ADEQUATE: "One stakeholder is unhappy. The candidate needs to explain their reasoning and manage expectations.",
        WEAK: "A colleague is frustrated about a delayed task. The candidate needs to communicate empathetically while holding firm.",
      },
      rubricIndicators: [
        { id: "S4B3_1", label: "Stakeholder Management", description: "Manages competing stakeholder expectations", positiveCriteria: "Communicates rationale clearly, shows empathy, and maintains the decision", negativeCriteria: "Caves to pressure, becomes defensive, or avoids the conversation" },
      ],
    },
    {
      beatNumber: 4,
      type: "CONSEQUENCE_REVEAL",
      primaryConstructs: ["EXECUTIVE_CONTROL"] as Construct[],
      secondaryConstructs: ["METACOGNITIVE_CALIBRATION"] as Construct[],
      agentPromptTemplate: "Ask: 'How well do you think you managed this overall — on a scale of 1 to 10?' Then reveal the actual outcome and compare it to their self-assessment.",
      branchScripts: {
        STRONG: "The outcome has nuanced successes and failures. Focus on how accurate their self-assessment was.",
        ADEQUATE: "The outcome is mostly positive with clear lessons. Compare their estimate to reality.",
        WEAK: "The outcome shows specific improvements needed. Explore the gap between their self-assessment and reality.",
      },
      rubricIndicators: [
        { id: "S4B4_1", label: "Calibration Accuracy", description: "Self-assessment matches actual performance", positiveCriteria: "Their rating is within 1-2 points of the objective assessment", negativeCriteria: "Their rating is 3+ points away from objective reality" },
      ],
    },
    {
      beatNumber: 5,
      type: "REFLECTIVE_SYNTHESIS",
      primaryConstructs: ["METACOGNITIVE_CALIBRATION", "LEARNING_VELOCITY"] as Construct[],
      secondaryConstructs: [] as Construct[],
      agentPromptTemplate: "Ask: 'What would you do differently from the start? What frameworks do you use when everything feels urgent?'",
      branchScripts: {
        STRONG: "Probe for systematic prioritization frameworks and whether they have transferable methods.",
        ADEQUATE: "Ask them to compare this to how they typically handle competing priorities.",
        WEAK: "Help them articulate what was most challenging about managing multiple demands.",
      },
      rubricIndicators: [
        { id: "S4B5_1", label: "Framework Articulation", description: "Can articulate a prioritization method", positiveCriteria: "Describes a systematic approach to prioritization that they use or would use", negativeCriteria: "Cannot articulate a method beyond 'I just figure it out'" },
        { id: "S4B5_2", label: "Learning Integration", description: "Integrates lessons from this experience", positiveCriteria: "Identifies specific behaviors they would change", negativeCriteria: "Says they would do the same thing or provides only superficial changes" },
      ],
    },
  ],
  domainNeutralContent: {
    setting: "A project team facing a compressed deadline with multiple deliverables due simultaneously",
    characters: ["The candidate (team coordinator)", "Riley (client contact with urgent request)", "Casey (team member whose task got deprioritized)", "Pat (manager who needs a status update)"],
    initialSituation: "It is Wednesday and five deliverables are due by Friday close of business. The candidate is coordinating a team of four. Task A (client presentation, 6 hours) depends on Task B (data analysis, 4 hours). Task C (internal report, 3 hours) is lower priority but the executive requesting it is known for being inflexible. Task D (quality review, 2 hours) is straightforward but requires a specific team member who is also needed for Task B. Task E (vendor response, 1 hour) has a hard deadline of Thursday noon.",
  },
};

// ──────────────────────────────────────────────
// Export
// ──────────────────────────────────────────────

export const SCENARIOS: ScenarioShell[] = [
  SCENARIO_1,
  SCENARIO_2,
  SCENARIO_3,
  SCENARIO_4,
];

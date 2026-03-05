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
        "Present a workplace scenario where a critical system or process has started producing unexpected outputs. Describe the symptoms — data inconsistencies, process deviations, or quality anomalies that have appeared over the past 48 hours. Before describing the failure, briefly explain how the system normally works (this tests Learning Velocity — whether the candidate absorbs the explanation). Include 3-4 relevant variables and constraints.",
      branchScripts: {
        STRONG: "The system is complex with multiple interdependent subsystems. Symptoms suggest a cascading failure that requires understanding of cross-system dependencies.",
        ADEQUATE: "The system has moderate complexity. Symptoms point to a specific area but could have multiple causes. Clear diagnostic pathways exist.",
        WEAK: "The system is straightforward with a clear input-output relationship. Symptoms are localized and the diagnostic path is more direct.",
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
        "The candidate has heard the situation. Ask them what they would do. This is open-ended — no options, no hints. Let them generate their own approach.",
      branchScripts: {
        STRONG: "The candidate's response was systematic and well-reasoned. Escalate: the system has additional layers of complexity that their initial approach didn't account for.",
        ADEQUATE: "The candidate's approach was reasonable but incomplete. Maintain complexity: introduce a parallel issue that tests whether their diagnostic framework extends.",
        WEAK: "The candidate's approach was unfocused or missed key variables. Simplify: provide a clearer signal about where the problem might be and ask them to narrow their investigation.",
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
        "Based on the candidate's previous response, introduce a complication that changes the situation. New information arrives that contradicts or complicates their initial approach. Test whether they can abandon or modify their reasoning when the data changes.",
      branchScripts: {
        STRONG: "The complication is subtle and requires re-evaluating multiple assumptions simultaneously. The new data creates a paradox with their initial diagnosis.",
        ADEQUATE: "The complication clearly contradicts one element of their approach but leaves other parts intact. They need to partially revise their strategy.",
        WEAK: "The complication is straightforward — new data clearly points in a different direction. The candidate has a clear opportunity to pivot.",
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
        "Another person in the scenario pushes back on the candidate's approach. A colleague or supervisor disagrees, applies pressure to take a shortcut, or proposes an alternative that sacrifices thoroughness for speed. Ask the candidate how they respond to this interpersonal challenge.",
      branchScripts: {
        STRONG: "A senior leader insists on a quick fix that bypasses proper diagnostic procedure. The pressure is significant — career implications are implicit. Multiple stakeholders are watching.",
        ADEQUATE: "A peer suggests an alternative approach that is faster but less thorough. The disagreement is professional, not confrontational. The candidate needs to weigh efficiency vs. completeness.",
        WEAK: "A colleague offers a helpful suggestion but frames it as criticism. The candidate needs to separate the feedback from the delivery and decide whether to incorporate it.",
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
        "Reveal the outcome of the candidate's choices across the previous beats. The consequence may be positive, negative, or mixed. Ask the candidate to evaluate what happened and what they would do about it now.",
      branchScripts: {
        STRONG: "The outcome is mixed with complex tradeoffs. Some aspects of their approach succeeded while others created new problems. There are second-order consequences they need to address.",
        ADEQUATE: "The outcome is mostly positive but with a clear gap — something they missed or could have done better. The evaluation is straightforward.",
        WEAK: "The outcome reveals a clear error from an earlier decision. The path to correction is visible. The question is whether they can identify what went wrong.",
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
        "Ask the candidate to step back and reflect: 'Knowing what you know now, what would you do differently from the start? What was the hardest part of this situation?' This is open-ended and tests self-awareness and learning extraction.",
      branchScripts: {
        STRONG: "The candidate has navigated a complex scenario. The reflection should capture whether they can extract generalizable principles from a specific experience.",
        ADEQUATE: "The candidate handled the scenario adequately. The reflection should reveal their level of self-awareness about their approach.",
        WEAK: "The candidate struggled with parts of the scenario. The reflection should show whether they recognize where they had difficulty and can articulate why.",
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
        "Present a workplace situation where the candidate discovers something that does not look right — a discrepancy in records, a process shortcut someone has been taking, or a quality issue that has been overlooked. The issue is not immediately catastrophic but could have significant consequences if left unaddressed.",
      branchScripts: {
        STRONG: "The discrepancy is subtle and embedded in routine operations. Noticing it requires attention to detail. The implications are serious but not obvious.",
        ADEQUATE: "The discrepancy is moderately visible. It could be an honest mistake or intentional. The candidate needs to decide how to investigate.",
        WEAK: "The discrepancy is relatively clear. The main question is what the candidate chooses to do about it rather than whether they notice it.",
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
      agentPromptTemplate: "Ask the candidate what they do about the discrepancy they've noticed.",
      branchScripts: {
        STRONG: "Escalate the ethical dimension: the discrepancy involves someone with authority or a sensitive situation that makes reporting more difficult.",
        ADEQUATE: "The reporting path is clear but requires effort. Test whether the candidate follows through on their stated intention.",
        WEAK: "Provide more scaffolding about why the discrepancy matters and ask again what they would do.",
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
      agentPromptTemplate: "New information reveals that the issue is larger than initially appeared. The discrepancy is not isolated — it suggests a pattern. This raises the stakes significantly.",
      branchScripts: {
        STRONG: "The pattern suggests systemic issues that implicate processes the candidate was told are reliable. They must question established assumptions.",
        ADEQUATE: "The pattern is concerning but has a plausible innocent explanation. The candidate must weigh whether to escalate further or investigate more.",
        WEAK: "The expanded scope is alarming but the next step (escalation) is clear. Test whether the candidate follows through.",
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
      agentPromptTemplate: "Someone with authority or influence pressures the candidate to drop the issue, minimize it, or handle it quietly. The personal cost of doing the right thing increases.",
      branchScripts: {
        STRONG: "A respected senior figure tells the candidate to let it go. There are implicit consequences for pushing further. Multiple people seem to know and accept the situation.",
        ADEQUATE: "A colleague they respect suggests it's not worth the trouble. The pressure is social rather than hierarchical. The candidate must weigh relationships against principles.",
        WEAK: "Someone suggests an easier path that doesn't fully address the issue but would satisfy minimum requirements. The temptation is convenience rather than fear.",
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
      agentPromptTemplate: "Reveal the outcome. If the candidate held firm, the investigation uncovers the full scope. If they compromised, show what was missed. Ask them to evaluate their decisions.",
      branchScripts: {
        STRONG: "The outcome validates their persistence but reveals even more complexity. Ask what they learned about navigating institutional pressure.",
        ADEQUATE: "The outcome is positive but there were costs (strained relationships, time spent). Ask how they would handle the tradeoffs differently.",
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
      agentPromptTemplate: "Ask: 'Knowing what you know now, what would you do differently from the start? What was the hardest part of this situation?'",
      branchScripts: {
        STRONG: "Probe for deeper insight about systemic vs. individual ethics, and how they balance thoroughness with pragmatism.",
        ADEQUATE: "Ask them to generalize: in what other situations would similar principles apply?",
        WEAK: "Help them articulate what made the situation difficult and what they would look for in the future.",
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
        "Teach the candidate a new system with 4-5 rules. The system should have an internal logic (a pattern the candidate can discover). Explain clearly but concisely. Then say: 'Let me make sure you understood that' and ask them to apply one rule.",
      branchScripts: {
        STRONG: "The system has 5 rules with subtle interdependencies. Mastering it requires holding multiple rules in working memory simultaneously.",
        ADEQUATE: "The system has 4 rules that are mostly independent. Application is straightforward if the rules are remembered correctly.",
        WEAK: "The system has 3 clear rules. Each rule applies in a distinct situation with minimal overlap.",
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
      agentPromptTemplate: "Present a scenario that requires applying 2 rules simultaneously. Ask the candidate to work through it step by step.",
      branchScripts: {
        STRONG: "Present a complex case requiring 3 rules at once. The interaction between rules creates a non-obvious outcome.",
        ADEQUATE: "Present a case requiring 2 rules. The interaction is logical if both rules are correctly applied.",
        WEAK: "Present a simpler case where one rule clearly applies. Confirm basic understanding before adding complexity.",
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
      agentPromptTemplate: "Change one of the rules. Tell the candidate: 'Actually, the rules have been updated.' Give them the new rule and immediately test whether they can apply the updated system without reverting to the old rule.",
      branchScripts: {
        STRONG: "Change a fundamental rule that affects how other rules interact. The update requires restructuring their mental model of the system.",
        ADEQUATE: "Change one rule in a way that affects some but not all cases. The candidate needs to identify when the new rule applies.",
        WEAK: "Change a rule in a straightforward way. The update is clearly explained and the test case obviously uses the new rule.",
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
      agentPromptTemplate: "Add time pressure and a constraint: 'We are running short on time. I need you to process these three cases quickly.' Present three rapid-fire cases that each test different rule combinations.",
      branchScripts: {
        STRONG: "Three cases of increasing complexity. The third case has an ambiguous element that tests whether speed makes them skip careful analysis.",
        ADEQUATE: "Three cases at consistent moderate difficulty. Tests whether they maintain accuracy under time pressure.",
        WEAK: "Three straightforward cases. Tests baseline speed and whether they can maintain confidence under mild pressure.",
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
      agentPromptTemplate: "Reveal which cases they got right and wrong. Ask them to explain where they went wrong and what was happening in their thinking when they made errors.",
      branchScripts: {
        STRONG: "Their errors reveal a specific pattern (consistently misapplying one rule or one rule interaction). Point this out and ask them to explain it.",
        ADEQUATE: "Their errors are mixed. Ask them to identify which types of cases they find most challenging.",
        WEAK: "Walk through the correct application of a missed case and ask them to explain the difference between their approach and the correct one.",
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
      agentPromptTemplate: "Ask: 'What strategy did you use to learn the system? If I taught you a new system tomorrow, what would you do differently to learn it faster?'",
      branchScripts: {
        STRONG: "Probe for metacognitive strategies: do they have a conscious learning approach, or do they learn reactively?",
        ADEQUATE: "Ask them to compare how they learn in different contexts (e.g., reading instructions vs. hands-on practice).",
        WEAK: "Ask what made this system hard or easy to learn, and what kind of support would help them learn faster.",
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
        "Present a busy workday with 5 tasks that need to be completed by end of day. Each task has a different urgency, importance, dependency, and stakeholder. Resources (time, people, equipment) are constrained. At least two tasks have dependencies — one cannot start until another finishes.",
      branchScripts: {
        STRONG: "5 tasks with complex interdependencies. Some tasks have hidden dependencies that become apparent only if the candidate asks the right questions. Resource constraints create genuine tradeoffs.",
        ADEQUATE: "5 tasks with clear priorities and 2 dependencies. The optimal sequence exists but requires deliberate planning.",
        WEAK: "4 tasks with obvious priority levels and 1 simple dependency. The sequencing challenge is straightforward.",
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
        STRONG: "Their plan is sound. Now add a 6th task that creates a resource conflict with their optimal sequence.",
        ADEQUATE: "Their plan has a reasonable structure. Add new information that changes the priority of one task.",
        WEAK: "Their plan needs refinement. Point out a dependency they missed and ask them to adjust.",
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
      agentPromptTemplate: "Midway through execution, a crisis arrives: a high-priority urgent request that disrupts the plan. Something has gone wrong that requires immediate attention. Ask the candidate how they reprioritize.",
      branchScripts: {
        STRONG: "The crisis requires significant replanning. Some tasks must be dropped or delegated. The candidate must make hard tradeoffs with incomplete information.",
        ADEQUATE: "The crisis affects 2-3 tasks. The candidate needs to reshuffle but most of their plan survives.",
        WEAK: "The crisis clearly takes top priority. The main question is how they adjust the remaining tasks.",
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
      agentPromptTemplate: "A team member or stakeholder pushes back on the candidate's reprioritization. They want their task to remain the priority. The candidate must manage this interpersonal dimension while maintaining their plan.",
      branchScripts: {
        STRONG: "Two stakeholders simultaneously demand priority for different tasks. The candidate must make a judgment call that will disappoint one of them.",
        ADEQUATE: "One stakeholder is unhappy with the reprioritization. The candidate needs to explain their reasoning and manage expectations.",
        WEAK: "A colleague is frustrated about a delayed task. The candidate needs to communicate empathetically while holding the new plan.",
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
      agentPromptTemplate: "Before revealing the outcome, ask: 'How well do you think you managed this situation overall — on a scale of 1 to 10?' Then reveal the actual outcome. This tests Metacognitive Calibration — does their self-assessment match reality?",
      branchScripts: {
        STRONG: "The outcome has nuanced successes and failures. Their self-assessment accuracy is the primary data point.",
        ADEQUATE: "The outcome is mostly positive with clear lessons. Compare their estimate to reality.",
        WEAK: "The outcome shows specific improvements needed. Use the gap between self-assessment and reality as a teaching moment.",
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
      agentPromptTemplate: "Ask: 'What would you do differently from the start? What frameworks do you use for prioritizing when everything feels urgent?'",
      branchScripts: {
        STRONG: "Probe for systematic prioritization frameworks (Eisenhower matrix, RICE, etc.) and whether they have transferable methods.",
        ADEQUATE: "Ask them to compare this approach to how they typically handle competing priorities.",
        WEAK: "Help them articulate what was most challenging about managing multiple demands simultaneously.",
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

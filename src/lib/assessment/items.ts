export type ItemType = "MULTIPLE_CHOICE" | "LIKERT" | "OPEN_RESPONSE" | "AI_PROBE" | "TIMED_SEQUENCE";

export interface AssessmentItem {
  id: string;
  construct: string;
  blockIndex: number;
  itemType: ItemType;
  prompt: string;
  options?: string[];
  correctAnswer?: string;
  timeLimit?: number; // seconds
  difficulty: number; // 1-5
}

/**
 * Item bank for the MVP assessment.
 * Items are defined in code (not database) for rapid iteration during validation study.
 * Each block has 4-6 items covering the assigned constructs.
 */
export const ITEM_BANK: AssessmentItem[] = [
  // ── Block 0: Reasoning & Executive Control ──
  {
    id: "fr-001", construct: "FLUID_REASONING", blockIndex: 0, itemType: "MULTIPLE_CHOICE", difficulty: 3,
    prompt: "If all Zephyrs are Quills, and some Quills are Prisms, which statement must be true?",
    options: ["All Zephyrs are Prisms", "Some Zephyrs may be Prisms", "No Zephyrs are Prisms", "All Prisms are Zephyrs"],
    correctAnswer: "Some Zephyrs may be Prisms",
  },
  {
    id: "fr-002", construct: "FLUID_REASONING", blockIndex: 0, itemType: "MULTIPLE_CHOICE", difficulty: 4,
    prompt: "A team of 5 analysts processes 120 reports in 8 hours. If 2 analysts are reassigned to another project, how many hours will it take the remaining team to process 120 reports?",
    options: ["13.3 hours", "12 hours", "20 hours", "10 hours"],
    correctAnswer: "13.3 hours",
  },
  {
    id: "ec-001", construct: "EXECUTIVE_CONTROL", blockIndex: 0, itemType: "TIMED_SEQUENCE", difficulty: 3, timeLimit: 60,
    prompt: "Memorize this sequence, then recall it in reverse order: 7 — 3 — 9 — 1 — 5 — 8",
    options: ["8-5-1-9-3-7", "7-3-9-1-5-8", "8-5-9-1-3-7", "7-8-5-1-9-3"],
    correctAnswer: "8-5-1-9-3-7",
  },
  {
    id: "ec-002", construct: "EXECUTIVE_CONTROL", blockIndex: 0, itemType: "MULTIPLE_CHOICE", difficulty: 3,
    prompt: "You are running three concurrent tasks: Task A (urgent, 20 min), Task B (important, 45 min), Task C (routine, 10 min). A colleague interrupts asking for help on Task D (15 min). What is the optimal approach?",
    options: ["Complete Task A, help colleague, then B and C", "Help colleague immediately since they asked first", "Finish all your tasks first, then help", "Delegate Task C and help colleague now"],
    correctAnswer: "Complete Task A, help colleague, then B and C",
  },
  {
    id: "cf-001", construct: "COGNITIVE_FLEXIBILITY", blockIndex: 0, itemType: "OPEN_RESPONSE", difficulty: 4,
    prompt: "A business process that has worked reliably for 5 years suddenly shows a 15% error rate. Your initial investigation ruled out staffing changes and software updates. What alternative factors would you investigate, and why?",
  },

  // ── Block 1: Technical Aptitude ──
  {
    id: "qr-001", construct: "QUANTITATIVE_REASONING", blockIndex: 1, itemType: "MULTIPLE_CHOICE", difficulty: 3,
    prompt: "A data entry process has an acceptable error margin of ±0.005%. If the baseline accuracy is 99.500%, what is the acceptable accuracy range?",
    options: ["99.495% to 99.505%", "99.490% to 99.510%", "99.500% to 99.505%", "99.495% to 99.500%"],
    correctAnswer: "99.495% to 99.505%",
  },
  {
    id: "qr-002", construct: "QUANTITATIVE_REASONING", blockIndex: 1, itemType: "MULTIPLE_CHOICE", difficulty: 4,
    prompt: "A server has 4 processing threads, each independently handling 3,500 requests per second. Each request processes 0.003 MB of data. What is the total data throughput in MB per second?",
    options: ["42 MB/s", "10.5 MB/s", "14 MB/s", "52.5 MB/s"],
    correctAnswer: "42 MB/s",
  },
  {
    id: "sv-001", construct: "SPATIAL_VISUALIZATION", blockIndex: 1, itemType: "TIMED_SEQUENCE", difficulty: 3, timeLimit: 45,
    prompt: "A cube is painted red on all faces, then cut into 27 equal smaller cubes. How many smaller cubes have exactly two painted faces?",
    options: ["8", "12", "6", "4"],
    correctAnswer: "12",
  },
  {
    id: "sv-002", construct: "SPATIAL_VISUALIZATION", blockIndex: 1, itemType: "MULTIPLE_CHOICE", difficulty: 3,
    prompt: "When a flat cross-shaped pattern is folded into a cube, which face is opposite the face marked X?",
    options: ["The face two positions away in the cross", "The adjacent face", "The bottom face", "It depends on fold direction"],
    correctAnswer: "The face two positions away in the cross",
  },
  {
    id: "mr-001", construct: "MECHANICAL_REASONING", blockIndex: 1, itemType: "MULTIPLE_CHOICE", difficulty: 3,
    prompt: "System A (capacity 20 units) feeds into System B (capacity 60 units). If System A processes at 900 units/hour and each unit from A requires 3 units of capacity in B, what is System B's effective processing rate and does it create a bottleneck?",
    options: ["300 units/hour, no bottleneck", "300 units/hour, creates bottleneck", "2700 units/hour, no bottleneck", "2700 units/hour, creates bottleneck"],
    correctAnswer: "300 units/hour, no bottleneck",
  },

  // ── Block 2: Processing & Diagnostics ──
  {
    id: "sd-001", construct: "SYSTEMS_DIAGNOSTICS", blockIndex: 2, itemType: "MULTIPLE_CHOICE", difficulty: 4,
    prompt: "A five-step workflow shows: Step 1 (OK) → Step 2 (OK) → Step 3 (intermittent errors) → Step 4 (OK) → Step 5 (consistent failures). Where should you investigate first?",
    options: ["Step 3 — intermittent errors indicate a developing problem", "Step 5 — it has consistent failures", "Between Steps 2 and 3 — the transition point", "Step 1 — start from the beginning"],
    correctAnswer: "Step 3 — intermittent errors indicate a developing problem",
  },
  {
    id: "sd-002", construct: "SYSTEMS_DIAGNOSTICS", blockIndex: 2, itemType: "OPEN_RESPONSE", difficulty: 4,
    prompt: "A system processes 200 transactions per shift. Recently, performance degrades by 5% every 50 transactions but recovers after a 10-minute cool-down. What is your diagnosis and proposed corrective action?",
  },
  {
    id: "pr-001", construct: "PATTERN_RECOGNITION", blockIndex: 2, itemType: "TIMED_SEQUENCE", difficulty: 3, timeLimit: 30,
    prompt: "Find the next number in the sequence: 2, 6, 14, 30, 62, __",
    options: ["126", "124", "94", "130"],
    correctAnswer: "126",
  },
  {
    id: "pr-002", construct: "PATTERN_RECOGNITION", blockIndex: 2, itemType: "MULTIPLE_CHOICE", difficulty: 3,
    prompt: "Error counts from a team's weekly output: Mon (3), Tue (1), Wed (5), Thu (2), Fri (8). Which pattern is most likely?",
    options: ["Increasing fatigue through the week", "Random variation within normal limits", "Process degradation with partial recovery", "Skill variation between team members"],
    correctAnswer: "Increasing fatigue through the week",
  },

  // ── Block 3: Judgment & Integrity ──
  {
    id: "prr-001", construct: "PROCEDURAL_RELIABILITY", blockIndex: 3, itemType: "LIKERT", difficulty: 2,
    prompt: "When I notice a minor deviation from standard procedure that doesn't seem to affect quality, I report it anyway.",
    options: ["Strongly Disagree", "Disagree", "Neutral", "Agree", "Strongly Agree"],
  },
  {
    id: "prr-002", construct: "PROCEDURAL_RELIABILITY", blockIndex: 3, itemType: "MULTIPLE_CHOICE", difficulty: 3,
    prompt: "You discover that a batch of 50 deliverables passed review, but you noticed minor formatting errors in 3 of them. The errors are cosmetic and technically within guidelines. What do you do?",
    options: ["Document the observation and inform the lead", "Re-review the entire batch to a higher standard", "Let it pass since it meets guidelines", "Separate the 3 items and continue"],
    correctAnswer: "Document the observation and inform the lead",
  },
  {
    id: "ej-001", construct: "ETHICAL_JUDGMENT", blockIndex: 3, itemType: "MULTIPLE_CHOICE", difficulty: 4,
    prompt: "A senior colleague asks you to sign off on a report for work you didn't personally review. They say 'everyone does it when we're behind schedule.' What do you do?",
    options: ["Refuse and explain you can only sign for work you verified", "Sign it since a senior colleague vouches for quality", "Ask to quickly verify a sample before signing", "Report the request to management immediately"],
    correctAnswer: "Refuse and explain you can only sign for work you verified",
  },
  {
    id: "ej-002", construct: "ETHICAL_JUDGMENT", blockIndex: 3, itemType: "OPEN_RESPONSE", difficulty: 4,
    prompt: "You discover that your company's current process, while compliant, generates significantly more waste than necessary due to outdated systems. A $50K upgrade would reduce waste by 60% but management says the budget is frozen. What steps would you take?",
  },

  // ── Block 4: Learning & Adaptation ──
  {
    id: "lv-001", construct: "LEARNING_VELOCITY", blockIndex: 4, itemType: "MULTIPLE_CHOICE", difficulty: 3,
    prompt: "You are introduced to a new software platform you've never used. The documentation is 200 pages. What is your first step?",
    options: ["Run through the tutorial to get hands-on experience", "Read the documentation cover to cover before using the system", "Ask a colleague to show you the basics, then explore", "Watch online videos about the platform"],
    correctAnswer: "Run through the tutorial to get hands-on experience",
  },
  {
    id: "lv-002", construct: "LEARNING_VELOCITY", blockIndex: 4, itemType: "OPEN_RESPONSE", difficulty: 4,
    prompt: "Describe a time you had to learn a completely new skill or process quickly. What strategies did you use, and how did you know when you were proficient?",
  },
  {
    id: "mc-001", construct: "METACOGNITIVE_CALIBRATION", blockIndex: 4, itemType: "LIKERT", difficulty: 2,
    prompt: "Before answering a difficult question, I usually have a good sense of whether I'll get it right.",
    options: ["Strongly Disagree", "Disagree", "Neutral", "Agree", "Strongly Agree"],
  },
  {
    id: "mc-002", construct: "METACOGNITIVE_CALIBRATION", blockIndex: 4, itemType: "MULTIPLE_CHOICE", difficulty: 3,
    prompt: "You've been asked to estimate how long a repair will take. Based on experience with similar repairs, what approach yields the most accurate estimate?",
    options: ["Break the job into sub-tasks and estimate each separately", "Use the time from the last similar repair", "Double your gut estimate to build in buffer", "Ask three colleagues and average their estimates"],
    correctAnswer: "Break the job into sub-tasks and estimate each separately",
  },

  // ── Block 5: Calibration & Integration ──
  {
    id: "int-001", construct: "METACOGNITIVE_CALIBRATION", blockIndex: 5, itemType: "LIKERT", difficulty: 2,
    prompt: "After completing a task, I actively reflect on what went well and what I would do differently.",
    options: ["Strongly Disagree", "Disagree", "Neutral", "Agree", "Strongly Agree"],
  },
  {
    id: "int-002", construct: "FLUID_REASONING", blockIndex: 5, itemType: "MULTIPLE_CHOICE", difficulty: 4,
    prompt: "A company must choose between Vendor A ($100K/year, processes 500 orders/day, 2% error rate) and Vendor B ($150K/year, processes 600 orders/day, 0.5% error rate). Each error costs $20 to resolve. Over 250 working days, which vendor is more cost-effective?",
    options: ["Vendor A saves $15,000 over Vendor B", "Vendor B saves $47,500 over Vendor A", "They cost the same over the period", "Vendor B saves $15,000 over Vendor A"],
    correctAnswer: "Vendor A saves $15,000 over Vendor B",
  },
  {
    id: "int-003", construct: "ETHICAL_JUDGMENT", blockIndex: 5, itemType: "OPEN_RESPONSE", difficulty: 4,
    prompt: "You are the shift lead. One team member consistently produces excellent work but frequently arrives 10-15 minutes late. Another team member is always on time but makes occasional errors. How do you handle both situations to maintain team morale and standards?",
  },
  {
    id: "int-004", construct: "FLUID_REASONING", blockIndex: 5, itemType: "TIMED_SEQUENCE", difficulty: 5, timeLimit: 90,
    prompt: "Three teams (X, Y, Z) handle customer cases. X handles 40% of cases with a 3% escalation rate. Y handles 35% with a 5% escalation rate. Z handles 25% with a 2% escalation rate. If a randomly selected case was escalated, what is the probability it came from Team Y?",
    options: ["50.7%", "35%", "52.4%", "47.6%"],
    correctAnswer: "50.7%",
  },
];

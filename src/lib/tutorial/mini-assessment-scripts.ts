import type { ScenarioReference } from "@/lib/assessment/parse-scenario-response";

// ─── Step Types ───────────────────────────────────────────────────────────────

export type StepType =
  | "narration"
  | "text-input"
  | "choice"
  | "timed-choice"
  | "numeric"
  | "complete";

export interface NarrationStep {
  id: string;
  type: "narration";
  act: "PHASE_0" | "ACT_1" | "ACT_2" | "ACT_3";
  text: string;
  referenceCard?: ScenarioReference;
}

export interface TextInputStep {
  id: string;
  type: "text-input";
  act: "PHASE_0" | "ACT_1" | "ACT_2" | "ACT_3";
  text: string;
  prompt: string;
}

export interface ChoiceStep {
  id: string;
  type: "choice";
  act: "PHASE_0" | "ACT_1" | "ACT_2" | "ACT_3";
  text: string;
  prompt: string;
  options: string[];
  ackByOption: Record<string, string>; // first letter of option → Aria ack text
}

export interface TimedChoiceStep {
  id: string;
  type: "timed-choice";
  act: "PHASE_0" | "ACT_1" | "ACT_2" | "ACT_3";
  text: string;
  prompt: string;
  options: string[];
  timeLimit: number; // seconds
  ackText: string;
}

export interface NumericStep {
  id: string;
  type: "numeric";
  act: "PHASE_0" | "ACT_1" | "ACT_2" | "ACT_3";
  text: string;
  prompt: string;
  ackText: string;
}

export interface CompleteStep {
  id: string;
  type: "complete";
  act: "ACT_3";
  text: string;
}

export type AssessmentStep =
  | NarrationStep
  | TextInputStep
  | ChoiceStep
  | TimedChoiceStep
  | NumericStep
  | CompleteStep;

export interface TutorialScript {
  segment: string;
  orgName: string;
  steps: AssessmentStep[];
}

// ─── Defense & Aerospace Manufacturing (Atlas Defense) ────────────────────────

const atlasDefenseScript: TutorialScript = {
  segment: "defense-manufacturing",
  orgName: "Atlas Defense",
  steps: [
    {
      id: "intro",
      type: "narration",
      act: "PHASE_0",
      text: "Hello. I'm Aria — ACI's assessment system. Today you'll work through a short scenario drawn from Atlas Defense's production environment. I'll present a situation, ask you to make a decision, then challenge your quantitative reasoning. There are no trick questions. I'm measuring how you think, not just what you know. Let's begin.",
    },
    {
      id: "mic-check",
      type: "text-input",
      act: "PHASE_0",
      text: "Before we start, tell me briefly — what kind of technical work do you find most engaging?",
      prompt: "Type your response…",
    },
    {
      id: "act1-setup",
      type: "narration",
      act: "ACT_1",
      text: "You're a manufacturing process engineer at Atlas Defense. It's 6 AM, two hours before a DoD source inspection. A quality technician flags a batch of machined housings: surface finish measurements are reading 12 microinches Ra, against a 10 microinch Ra specification. 340 units. Rework takes 45 minutes per unit on the polishing line. The inspection window opens in two hours.",
      referenceCard: {
        role: "Process Engineer — Atlas Defense",
        context: "DoD source inspection in 2 hours",
        sections: [
          {
            label: "Batch Status",
            highlight: true,
            items: ["340 units flagged", "Surface finish: 12 µin Ra measured vs. 10 µin Ra spec", "Non-conformance logged at 06:02"],
          },
          {
            label: "Resources",
            highlight: false,
            items: ["Polishing line: 4 machines available", "Rework time: 45 min/unit per machine", "Shift supervisor on-site"],
          },
          {
            label: "Constraints",
            highlight: false,
            items: ["Inspection window opens 08:00", "DoD inspector arriving at facility", "No substitution units available"],
          },
        ],
        newInformation: [],
        question: "What is your immediate priority in the next 30 minutes?",
      },
    },
    {
      id: "act1-question",
      type: "choice",
      act: "ACT_1",
      text: "What is your immediate priority in the next 30 minutes?",
      prompt: "Select your first move:",
      options: [
        "A. Begin rework on all 340 units immediately — maximize throughput before inspection",
        "B. Confirm the measurement tool calibration before committing to rework",
        "C. Notify program management and request inspection postponement",
        "D. Pull a statistical sample of 30 units to characterize the distribution before deciding",
      ],
      ackByOption: {
        A: "Moving all units to rework immediately maximizes throughput, but risks compounding the problem if the measurement itself was off. That's a common instinct under time pressure — and it has real costs.",
        B: "Confirming calibration first is the right call. A 2 microinch deviation is well within typical measurement uncertainty for surface finish. If the gauge is drifted, rework is unnecessary. This is what high-stakes process control looks like.",
        C: "Escalating to program management is appropriate — but it shouldn't be the first action before you've confirmed the scope. Postponement requests require data, not just flags.",
        D: "Sampling 30 units gives you a distribution, but at 45 minutes per rework cycle, you may not have time to act on what you learn. There's a faster diagnostic available first.",
      },
    },
    {
      id: "act1-ack",
      type: "narration",
      act: "ACT_1",
      text: "Noted. Now let's move to Act Two — quantitative reasoning under constraint.",
    },
    {
      id: "act2-timed",
      type: "timed-choice",
      act: "ACT_2",
      text: "You have 45 seconds. Four polishing machines are running in parallel. Each processes one unit in 45 minutes. How many units can be reworked in a 3-hour window?",
      prompt: "4 machines × 45 min/unit, 3-hour window — how many total units?",
      options: ["8", "12", "16", "20"],
      timeLimit: 45,
      ackText: "Correct: 4 machines × 4 cycles per machine in 3 hours = 16 units. Under real inspection pressure, this arithmetic tells you immediately whether rework is even a viable path for 340 units.",
    },
    {
      id: "act2-numeric",
      type: "numeric",
      act: "ACT_2",
      text: "Final calculation. After calibration confirms the gauge was drifted by +1.8 microinches, actual surface finish averages 10.2 µin Ra. You need to accept units measuring 10.0 ± 0.5 µin Ra. What percentage of the batch falls within specification?",
      prompt: "Enter the percentage (assume normal distribution, σ = 0.4 µin):",
      ackText: "With a mean of 10.2 and σ of 0.4, the spec window of 9.5–10.5 captures roughly 84% of units. Strong quantitative reasoning here. That kind of rapid estimation prevents unnecessary rework and delays.",
    },
    {
      id: "act3-reflect",
      type: "text-input",
      act: "ACT_3",
      text: "Last question before we wrap up. Of the three decision points you just worked through — the immediate prioritization, the throughput calculation, and the statistical estimate — which felt most uncertain, and why?",
      prompt: "Type your response…",
    },
    {
      id: "complete",
      type: "complete",
      act: "ACT_3",
      text: "That's the assessment. What you just demonstrated — methodical decision-making under production pressure, quantitative fluency, and accurate self-assessment — is exactly what ACI measures across your full candidate pool. The live platform shows you this profile for every candidate, ranked against role-specific benchmarks. Ready to explore the dashboard?",
    },
  ],
};

// ─── Space & Satellite Systems (Orbital Dynamics) ─────────────────────────────

const orbitalDynamicsScript: TutorialScript = {
  segment: "space-satellite",
  orgName: "Orbital Dynamics",
  steps: [
    {
      id: "intro",
      type: "narration",
      act: "PHASE_0",
      text: "Hello. I'm Aria — ACI's assessment system. Today you'll work through a scenario from Orbital Dynamics' satellite integration environment. I'll present a pre-launch situation, ask you to prioritize, then test your quantitative reasoning. I'm interested in how you think through constraint problems — not whether you have the exact answer. Let's begin.",
    },
    {
      id: "mic-check",
      type: "text-input",
      act: "PHASE_0",
      text: "Quick check before we start — describe a technical problem you solved that required working with incomplete information.",
      prompt: "Type your response…",
    },
    {
      id: "act1-setup",
      type: "narration",
      act: "ACT_1",
      text: "You're a systems engineer on a commercial imaging satellite program at Orbital Dynamics. Launch window is 48 hours out. During final thermal-vacuum testing, telemetry shows the onboard computer's thermal margin has dropped to +2°C above the red-line limit — from a predicted +8°C margin. The thermal control system is reading nominal. The discrepancy is unexplained.",
      referenceCard: {
        role: "Systems Engineer — Orbital Dynamics",
        context: "48 hours to launch window",
        sections: [
          {
            label: "Anomaly",
            highlight: true,
            items: ["OBC thermal margin: +2°C above red-line (predicted: +8°C)", "Thermal control system reading nominal", "Discrepancy onset: within last 4 hours of TVAC"],
          },
          {
            label: "Satellite Configuration",
            highlight: false,
            items: ["Payload: 3-band optical imager", "OBC: radiation-hardened ARM processor", "Primary and redundant thermal loops active"],
          },
          {
            label: "Launch Constraints",
            highlight: false,
            items: ["Launch window: 48 hours", "Next window: 22 days", "Payload customer contractual deadline in effect"],
          },
        ],
        newInformation: [],
        question: "What do you prioritize in the next four hours?",
      },
    },
    {
      id: "act1-question",
      type: "choice",
      act: "ACT_1",
      text: "What do you prioritize in the next four hours?",
      prompt: "Select your first move:",
      options: [
        "A. Initiate a full system power cycle to reset any transient thermal state before further analysis",
        "B. Pull the last 4 hours of OBC utilization and processor load telemetry to find an unexpected heat source",
        "C. Invoke the launch hold protocol immediately — any unexplained margin delta warrants a hold",
        "D. Run a delta-T correlation between predicted and actual across all thermal zones to localize the anomaly",
      ],
      ackByOption: {
        A: "A power cycle might clear a transient, but it also destroys the telemetry trail and risks introducing new transients 48 hours from launch. High-risk move with low diagnostic value.",
        B: "Good instinct. An unexpected 6°C drop in thermal margin with a nominally functioning thermal system often points to an unplanned load. Processor utilization telemetry is fast and non-invasive — the right first diagnostic step.",
        C: "Invoking a hold immediately is defensible if you have evidence of a systemic problem. But an unexplained delta 48 hours out benefits from a quick data pull first — holds have significant downstream cost.",
        D: "A full delta-T correlation across thermal zones is the right second step, but it's time-intensive. The fastest initial diagnostic is targeted at the anomaly's most likely cause. You'd sequence this after the load telemetry review.",
      },
    },
    {
      id: "act1-ack",
      type: "narration",
      act: "ACT_1",
      text: "Good. Moving to Act Two — quantitative reasoning under launch constraints.",
    },
    {
      id: "act2-timed",
      type: "timed-choice",
      act: "ACT_2",
      text: "You have 45 seconds. The OBC dissipates 4W at idle and 14W at peak load. Thermal resistance from OBC to radiator is 8°C/W. If the OBC runs at peak load for 30% of each orbit, what is the average steady-state temperature rise above the radiator?",
      prompt: "Avg dissipation × thermal resistance — what is ΔT?",
      options: ["35.2°C", "44.8°C", "56.0°C", "112.0°C"],
      timeLimit: 45,
      ackText: "Correct: average power = 4W × 0.7 + 14W × 0.3 = 7.0W. ΔT = 7.0W × 8°C/W = 56°C. A 10% shift in duty cycle explains your 6°C margin loss entirely. This is the kind of rapid thermal estimation that keeps launch teams moving.",
    },
    {
      id: "act2-numeric",
      type: "numeric",
      act: "ACT_2",
      text: "Follow-up calculation. If you reduce peak OBC load from 14W to 11W by deferring non-critical processes, and the duty cycle remains 30%, what is the new temperature rise above the radiator?",
      prompt: "Enter the new ΔT in °C:",
      ackText: "New average: 4W × 0.7 + 11W × 0.3 = 6.1W. ΔT = 6.1W × 8°C/W = 48.8°C — recovering roughly 7°C of margin. That's your path forward: load deferral restores margin without touching hardware 48 hours from launch.",
    },
    {
      id: "act3-reflect",
      type: "text-input",
      act: "ACT_3",
      text: "Final question. Of the decisions you just worked through — the diagnostic prioritization, the thermal calculation, and the load reduction estimate — which required the most cognitive effort, and what made it hard?",
      prompt: "Type your response…",
    },
    {
      id: "complete",
      type: "complete",
      act: "ACT_3",
      text: "That's the assessment. You just moved through a systems engineering triage under real launch pressure — diagnostic prioritization, thermal physics under time constraint, and accurate self-assessment. ACI surfaces this cognitive profile for every candidate you're evaluating, ranked against role-specific benchmarks for Orbital Dynamics' positions. Ready to explore the dashboard?",
    },
  ],
};

// ─── Hardware + AI / Robotics (Nexus Robotics) ────────────────────────────────

const nexusRoboticsScript: TutorialScript = {
  segment: "hardware-ai",
  orgName: "Nexus Robotics",
  steps: [
    {
      id: "intro",
      type: "narration",
      act: "PHASE_0",
      text: "Hello. I'm Aria — ACI's assessment system. Today's scenario comes from Nexus Robotics' production environment, where hardware and AI systems intersect in real time. I'll present a failure situation, ask you to prioritize your response, then test your quantitative reasoning. I'm interested in how you approach problems at the hardware-software boundary. Let's begin.",
    },
    {
      id: "mic-check",
      type: "text-input",
      act: "PHASE_0",
      text: "Before we start — what does a good debugging process look like to you when you're working at the intersection of hardware and software?",
      prompt: "Type your response…",
    },
    {
      id: "act1-setup",
      type: "narration",
      act: "ACT_1",
      text: "You're a robotics systems engineer at Nexus Robotics. The warehouse automation line has been running for six hours when Pick-and-Place Unit 4 begins missing targets at a 12% error rate — up from a baseline of 0.3%. The unit passed calibration 48 hours ago. No mechanical damage is visible. The vision model confidence scores are nominal. However, ambient temperature has risen 11°C since the morning shift.",
      referenceCard: {
        role: "Robotics Systems Engineer — Nexus Robotics",
        context: "Production line, 6 hours into shift",
        sections: [
          {
            label: "Failure Signal",
            highlight: true,
            items: ["PPU-4 miss rate: 12% (baseline: 0.3%)", "Vision model confidence: nominal (no degradation)", "Last calibration: 48 hours prior"],
          },
          {
            label: "Environmental",
            highlight: false,
            items: ["Ambient temp rise: +11°C since 06:00", "No mechanical damage observed", "Other PPUs performing nominally"],
          },
          {
            label: "System Architecture",
            highlight: false,
            items: ["Vision: RGB-D camera + YOLO-based pose estimator", "Arm controller: servo-driven, encoder feedback", "Calibration: 9-point grid, stored at calibration-time temperature"],
          },
        ],
        newInformation: [],
        question: "What is your diagnostic priority?",
      },
    },
    {
      id: "act1-question",
      type: "choice",
      act: "ACT_1",
      text: "What is your diagnostic priority?",
      prompt: "Select your first move:",
      options: [
        "A. Retrain the vision model on new images captured at current ambient conditions",
        "B. Check encoder drift or mechanical backlash as the temperature-sensitive failure mode",
        "C. Run a recalibration sequence to update the stored calibration to current conditions",
        "D. Compare PPU-4 camera extrinsics against a known-good unit to isolate the sensor",
      ],
      ackByOption: {
        A: "Retraining the vision model is a high-cost intervention — the model confidence is nominal, which tells you the perception stack isn't the problem. This targets the wrong subsystem.",
        B: "Close — thermal expansion affecting servo tolerances or encoder resolution is a real failure mode. But if calibration was stored at a different temperature, the coordinate transform itself is wrong before you even look at mechanical drift.",
        C: "Correct. Temperature-dependent calibration drift is the most parsimonious explanation: the vision-to-arm coordinate transform was established at a different thermal state. Recalibrating at current ambient conditions is fast, non-invasive, and directly tests the hypothesis.",
        D: "Comparing extrinsics is useful if you suspect the camera moved, but with nominal model confidence and a temperature correlation, the coordinate transform drift is the stronger candidate hypothesis.",
      },
    },
    {
      id: "act1-ack",
      type: "narration",
      act: "ACT_1",
      text: "Good. Moving to Act Two — let's stress-test your quantitative reasoning.",
    },
    {
      id: "act2-timed",
      type: "timed-choice",
      act: "ACT_2",
      text: "You have 45 seconds. A camera delivers 30 fps. The pose estimation model runs inference at 50ms per frame. At what frame rate does the system actually process if inference is the bottleneck — and what percentage of frames are dropped?",
      prompt: "Inference at 50ms/frame limits throughput — select processed fps and drop rate:",
      options: [
        "20 fps, 33% dropped",
        "20 fps, 50% dropped",
        "15 fps, 50% dropped",
        "25 fps, 17% dropped",
      ],
      timeLimit: 45,
      ackText: "Correct: 1/0.05s = 20 fps maximum throughput. Camera delivers 30 fps, so 10/30 = 33% of frames are dropped. This matters for latency analysis — dropped frames create stale pose estimates, which compound the miss rate under dynamic conditions.",
    },
    {
      id: "act2-numeric",
      type: "numeric",
      act: "ACT_2",
      text: "Now a latency budget. The end-to-end pick cycle requires the arm to begin moving within 80ms of a valid pose estimate. Sensor exposure takes 10ms, data transfer takes 5ms, and inference takes 50ms. How many milliseconds remain for coordinate transform and command dispatch?",
      prompt: "Enter remaining milliseconds:",
      ackText: "80ms − 10ms − 5ms − 50ms = 15ms remaining. That's your entire budget for the coordinate transform, inverse kinematics, and motor command serialization. When you add calibration drift, even small coordinate errors compound inside that 15ms window.",
    },
    {
      id: "act3-reflect",
      type: "text-input",
      act: "ACT_3",
      text: "Last question. Of the three problems — the diagnostic prioritization, the frame-drop calculation, and the latency budget — which felt most uncertain to you, and what drove that uncertainty?",
      prompt: "Type your response…",
    },
    {
      id: "complete",
      type: "complete",
      act: "ACT_3",
      text: "That's the assessment. You just navigated a hardware-software failure at the boundary where most debugging goes wrong — identifying the right subsystem, calculating system throughput, and reasoning through a tight latency budget. ACI gives you this cognitive profile for every candidate, benchmarked against Nexus Robotics' role requirements. Ready to explore the dashboard?",
    },
  ],
};

// ─── AI & Software (Vertex AI Labs) ──────────────────────────────────────────

const vertexAILabsScript: TutorialScript = {
  segment: "ai-software",
  orgName: "Vertex AI Labs",
  steps: [
    {
      id: "intro",
      type: "narration",
      act: "PHASE_0",
      text: "Hello. I'm Aria — ACI's assessment system. Today's scenario comes from Vertex AI Labs' production platform environment. I'll present a performance anomaly, ask you to prioritize your response, then test your quantitative reasoning on system capacity. I'm measuring how you think through ambiguous system failures — not just what you know. Let's begin.",
    },
    {
      id: "mic-check",
      type: "text-input",
      act: "PHASE_0",
      text: "Before we start — when a production system degrades unexpectedly, what's your general approach to distinguishing a data problem from a model problem from an infrastructure problem?",
      prompt: "Type your response…",
    },
    {
      id: "act1-setup",
      type: "narration",
      act: "ACT_1",
      text: "You're a platform engineer at Vertex AI Labs. It's Tuesday at 11 AM. The customer-facing recommendation API has shown a 34% increase in P95 latency over the last 90 minutes — from 180ms to 240ms. Error rate is flat at 0.1%. Model accuracy metrics are nominal. Infrastructure monitoring shows CPU utilization at 72% (up from 55%) but memory is stable. No deployments in the last 8 hours.",
      referenceCard: {
        role: "Platform Engineer — Vertex AI Labs",
        context: "Production degradation — Tuesday 11:00 AM",
        sections: [
          {
            label: "Degradation Signal",
            highlight: true,
            items: ["P95 latency: 240ms (baseline 180ms, +34%)", "Error rate: 0.1% (flat)", "Duration: 90 minutes"],
          },
          {
            label: "Infrastructure",
            highlight: false,
            items: ["CPU: 72% (up from 55%)", "Memory: stable", "No deployments in 8 hours"],
          },
          {
            label: "System Context",
            highlight: false,
            items: ["Recommendation API: serves ~8,000 RPS at peak", "Model serving: 4-replica deployment", "Upstream: user event stream, product catalog index"],
          },
        ],
        newInformation: [],
        question: "What is your diagnostic priority?",
      },
    },
    {
      id: "act1-question",
      type: "choice",
      act: "ACT_1",
      text: "What is your diagnostic priority?",
      prompt: "Select your first move:",
      options: [
        "A. Trigger an immediate horizontal scale-out — CPU at 72% with latency up is a capacity signal",
        "B. Check upstream data pipeline latency — a slow feature store or catalog refresh would explain CPU + latency together",
        "C. Roll back the most recent model version as a precaution — model drift can appear in latency before accuracy",
        "D. Review per-replica CPU variance — one hot replica could skew P95 without raising average error rates",
      ],
      ackByOption: {
        A: "Scaling out addresses a capacity shortage, but CPU at 72% is not saturated — and the latency increase started 90 minutes ago without a corresponding traffic spike. Scaling before you understand the cause can mask the root signal.",
        B: "Strong reasoning. A slow upstream dependency — particularly a feature store or catalog index with batch refresh cycles — would drive both CPU and latency simultaneously without affecting error rates or model accuracy. This is the most efficient first hypothesis to test.",
        C: "Model rollback is a high-cost intervention with no clear signal pointing at the model. Accuracy is nominal, which makes model drift unlikely as the primary cause.",
        D: "Hot replica diagnosis is a useful second step — but you'd see it in per-replica CPU metrics before P95 latency. The upstream dependency hypothesis is faster to rule out and more consistent with the symptom timeline.",
      },
    },
    {
      id: "act1-ack",
      type: "narration",
      act: "ACT_1",
      text: "Good. Act Two — let's test your quantitative reasoning on system capacity.",
    },
    {
      id: "act2-timed",
      type: "timed-choice",
      act: "ACT_2",
      text: "You have 45 seconds. Your recommendation API serves 8,000 RPS. Each request requires one feature store lookup averaging 12ms. The feature store connection pool has 200 connections. What is the maximum RPS the feature store can support before it becomes the bottleneck?",
      prompt: "200 connections, 12ms avg — what is max RPS before bottleneck?",
      options: ["8,000", "12,000", "16,667", "24,000"],
      timeLimit: 45,
      ackText: "Correct: max throughput = 200 connections / 0.012s = 16,667 RPS. You're currently at 8,000 RPS — 48% of capacity. But a batch catalog refresh consuming connection pool threads would reduce effective available connections, which would push you toward the bottleneck without a traffic spike.",
    },
    {
      id: "act2-numeric",
      type: "numeric",
      act: "ACT_2",
      text: "Capacity planning follow-up. If the catalog refresh job consumes 60 connections for 3 minutes every hour, what percentage of time is the feature store running at or above 90% connection pool utilization during those windows?",
      prompt: "Enter the percentage of time at ≥90% utilization (during refresh windows):",
      ackText: "During the 3-minute window, 60 connections are reserved, leaving 140 available. Max throughput drops to 140/0.012 = 11,667 RPS — still above current load. However, at 90% utilization (180 connections), max RPS = 180/0.012 = 15,000. The answer is 0% — you're not hitting 90% utilization even during refresh. But you ARE hitting the latency tail because connection contention adds queue delay to individual requests. That's the P95 story, not the average.",
    },
    {
      id: "act3-reflect",
      type: "text-input",
      act: "ACT_3",
      text: "Final question. Of the three problems — the system diagnosis, the throughput calculation, and the utilization question — which required you to hold the most competing variables simultaneously, and how did you approach that?",
      prompt: "Type your response…",
    },
    {
      id: "complete",
      type: "complete",
      act: "ACT_3",
      text: "That's the assessment. You just diagnosed a production latency anomaly, calculated system throughput under constraint, and reasoned through connection pool utilization — all under time pressure. ACI surfaces this cognitive profile for every candidate, benchmarked against Vertex AI Labs' role requirements. Ready to explore the dashboard?",
    },
  ],
};

// ─── Script Registry ──────────────────────────────────────────────────────────

const SCRIPTS: Record<string, TutorialScript> = {
  "defense-manufacturing": atlasDefenseScript,
  "space-satellite": orbitalDynamicsScript,
  "hardware-ai": nexusRoboticsScript,
  "ai-software": vertexAILabsScript,
};

export function getScript(segment: string | null): TutorialScript {
  return SCRIPTS[segment ?? ""] ?? atlasDefenseScript;
}

// ─── TutorialRunner ───────────────────────────────────────────────────────────

export type RunnerCallback = (step: AssessmentStep, stepIndex: number) => void;

export class TutorialRunner {
  private script: TutorialScript;
  private currentIndex = -1;
  private onStep: RunnerCallback;
  private onComplete: () => void;
  private aborted = false;

  constructor(segment: string | null, onStep: RunnerCallback, onComplete: () => void) {
    this.script = getScript(segment);
    this.onStep = onStep;
    this.onComplete = onComplete;
  }

  get segment(): string {
    return this.script.segment;
  }

  get orgName(): string {
    return this.script.orgName;
  }

  /** Start from step 0. Called once after TTS engine is ready. */
  start(): void {
    this.advance("__start__");
  }

  /** Advance to the next step. Call with user response after interactive steps. */
  advance(response: string): void {
    if (this.aborted) return;
    this.currentIndex++;

    const step = this.script.steps[this.currentIndex];
    if (!step) {
      this.onComplete();
      return;
    }

    // For choice steps, inject the ack text into the narration before the next step
    // (The stage component handles this by listening for responses)
    this.onStep(step, this.currentIndex);

    // For narration steps without user interaction, auto-advance after TTS
    // The stage component handles auto-advance by calling runner.advance() from the TTS completion callback
  }

  abort(): void {
    this.aborted = true;
  }

  getCurrentStep(): AssessmentStep | null {
    return this.script.steps[this.currentIndex] ?? null;
  }

  getTotalSteps(): number {
    return this.script.steps.length;
  }

  getProgress(): number {
    return Math.max(0, this.currentIndex) / Math.max(1, this.script.steps.length - 1);
  }
}

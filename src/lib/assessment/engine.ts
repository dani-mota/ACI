import type { AssessmentState, ConversationMessage, InteractionElementType } from "@/generated/prisma/client";
import type {
  EngineAction,
  AgentMessageAction,
  InteractiveElementAction,
  TransitionAction,
  CompleteAction,
  ResponseClassification,
  AdaptiveLoopState,
  AdaptivePhase,
} from "./types";
import { ASSESSMENT_STRUCTURE } from "./config";
import { SCENARIOS } from "./scenarios";
import { CONSTRUCT_LAYERS } from "./construct-scoring";
import { getNextItem, initLoopState } from "./adaptive-loop";

const ACT2_CONSTRUCTS = ASSESSMENT_STRUCTURE.act2Constructs;

/**
 * The assessment engine determines what happens next based on the current state
 * and the candidate's last message. This is the core orchestrator for the
 * three-act conversational assessment.
 */
export function getNextAction(
  state: AssessmentState,
  messages: ConversationMessage[],
  lastCandidateMessage?: string,
): EngineAction {
  if (state.isComplete) {
    return {
      type: "COMPLETE",
      closingMessage: "Thank you for completing the assessment. Your responses have been recorded.",
    } satisfies CompleteAction;
  }

  switch (state.currentAct) {
    case "ACT_1":
      return getAct1Action(state, messages, lastCandidateMessage);
    case "ACT_2":
      return getAct2Action(state, messages, lastCandidateMessage);
    case "ACT_3":
      return getAct3Action(state, messages, lastCandidateMessage);
    default:
      return {
        type: "COMPLETE",
        closingMessage: "The assessment has concluded. Thank you for your time.",
      } satisfies CompleteAction;
  }
}

// ──────────────────────────────────────────────
// ACT 1: Scenario Gauntlet
// ──────────────────────────────────────────────

function getAct1Action(
  state: AssessmentState,
  messages: ConversationMessage[],
  lastCandidateMessage?: string,
): EngineAction {
  const scenarioIndex = state.currentScenario;
  const beatIndex = state.currentBeat;

  // Check if all scenarios are complete
  if (scenarioIndex >= ASSESSMENT_STRUCTURE.act1ScenarioCount) {
    return {
      type: "TRANSITION",
      from: { act: "ACT_1", detail: "Scenario Gauntlet complete" },
      to: { act: "ACT_2", detail: "Precision Gauntlet" },
      transitionMessage:
        "We have finished the scenario section. Now I am going to focus on some specific abilities — these will be more focused and you will see some problems to solve directly.",
    } satisfies TransitionAction;
  }

  const scenario = SCENARIOS[scenarioIndex];
  if (!scenario) {
    return {
      type: "TRANSITION",
      from: { act: "ACT_1", detail: `Scenario ${scenarioIndex} not found` },
      to: { act: "ACT_2", detail: "Precision Gauntlet" },
      transitionMessage:
        "Let me move on to the next section where we will focus on specific problem-solving abilities.",
    } satisfies TransitionAction;
  }

  const beat = scenario.beats[beatIndex];
  if (!beat) {
    // All beats in this scenario done — transition to next scenario or Act 2
    if (scenarioIndex < ASSESSMENT_STRUCTURE.act1ScenarioCount - 1) {
      return {
        type: "AGENT_MESSAGE",
        systemPrompt: buildAct1SystemPrompt(scenario, beatIndex),
        userContext: `[TRANSITION] The candidate has completed Scenario ${scenarioIndex + 1}. Generate a brief transition message acknowledging they've covered a lot of ground and that you're moving to a different situation. Then introduce the next scenario: "${SCENARIOS[scenarioIndex + 1]?.name || "next scenario"}"`,
        act: "ACT_1",
        metadata: {
          scenarioIndex: scenarioIndex + 1,
          beatIndex: 0,
          transition: true,
        },
      } satisfies AgentMessageAction;
    }

    return {
      type: "TRANSITION",
      from: { act: "ACT_1", detail: "All scenarios complete" },
      to: { act: "ACT_2", detail: "Precision Gauntlet" },
      transitionMessage:
        "We have finished the scenario section. Now I am going to focus on some specific abilities — these will be more focused and you will see some problems to solve.",
    } satisfies TransitionAction;
  }

  // Determine which branch script to use based on last classification
  const branchPath = (state.branchPath as ResponseClassification[] | null) ?? [];
  const lastClassification = branchPath.length > 0 ? branchPath[branchPath.length - 1] : undefined;

  // Beat 0 (Initial Situation) — always starts with the scenario introduction
  if (beatIndex === 0 && !lastCandidateMessage) {
    return {
      type: "AGENT_MESSAGE",
      systemPrompt: buildAct1SystemPrompt(scenario, beatIndex),
      userContext: buildBeatPrompt(scenario, beat, lastClassification),
      act: "ACT_1",
      metadata: {
        scenarioIndex,
        beatIndex,
        beatType: beat.type,
        primaryConstructs: beat.primaryConstructs,
      },
    } satisfies AgentMessageAction;
  }

  // Beat 1 (Initial Response) — agent asks "What do you do?"
  if (beatIndex === 1 && !lastCandidateMessage) {
    return {
      type: "AGENT_MESSAGE",
      systemPrompt: buildAct1SystemPrompt(scenario, beatIndex),
      userContext: `Ask the candidate what they would do in this situation. Use an open-ended question like "What do you do?" or "How would you handle this?" Do not provide options — the candidate must generate their own response.`,
      act: "ACT_1",
      metadata: {
        scenarioIndex,
        beatIndex,
        beatType: beat.type,
        primaryConstructs: beat.primaryConstructs,
      },
    } satisfies AgentMessageAction;
  }

  // Beats 3-4 may include a tradeoff selection element
  if (beat.type === "SOCIAL_PRESSURE" && !lastCandidateMessage && beatIndex === 3) {
    return {
      type: "AGENT_MESSAGE",
      systemPrompt: buildAct1SystemPrompt(scenario, beatIndex),
      userContext: buildBeatPrompt(scenario, beat, lastClassification),
      act: "ACT_1",
      metadata: {
        scenarioIndex,
        beatIndex,
        beatType: beat.type,
        primaryConstructs: beat.primaryConstructs,
      },
    } satisfies AgentMessageAction;
  }

  // Default: generate the next beat's content based on classification
  return {
    type: "AGENT_MESSAGE",
    systemPrompt: buildAct1SystemPrompt(scenario, beatIndex),
    userContext: buildBeatPrompt(scenario, beat, lastClassification),
    act: "ACT_1",
    metadata: {
      scenarioIndex,
      beatIndex,
      beatType: beat.type,
      primaryConstructs: beat.primaryConstructs,
    },
  } satisfies AgentMessageAction;
}

function buildAct1SystemPrompt(scenario: typeof SCENARIOS[number], beatIndex: number): string {
  return `You are an assessment agent conducting a structured workplace scenario investigation. Your role is to present realistic situations, respond to the candidate's choices, and adapt the scenario based on their responses.

SCENARIO: ${scenario.name}
DESCRIPTION: ${scenario.description}
CURRENT BEAT: ${beatIndex + 1} of 6

RULES:
- Never reveal construct names or scoring criteria
- Never provide hints, correct answers, or coaching
- Acknowledge difficulty when appropriate but do not help
- Make transitions between beats feel natural and continuous
- Keep the scenario feeling realistic and immersive
- Adapt your language to match the candidate's communication style
- Responses should be 2-4 paragraphs for situation descriptions, 1-2 sentences for follow-up probes`;
}

function buildBeatPrompt(
  scenario: typeof SCENARIOS[number],
  beat: typeof SCENARIOS[number]["beats"][number],
  lastClassification?: ResponseClassification,
): string {
  const branchKey = lastClassification ?? "ADEQUATE";
  const branchScript = beat.branchScripts[branchKey];

  return `[BEAT: ${beat.type}]
Template: ${beat.agentPromptTemplate}
Branch script (${branchKey}): ${branchScript}

Generate the scenario content following the template and branch script. Present it naturally as part of an ongoing conversation.`;
}

// ──────────────────────────────────────────────
// ACT 2: Precision Gauntlet
// ──────────────────────────────────────────────

function getAct2Action(
  state: AssessmentState,
  messages: ConversationMessage[],
  lastCandidateMessage?: string,
): EngineAction {
  const constructId = state.currentConstruct;
  const phase = state.currentPhase ?? 0;
  const act2Progress = (state.act2Progress as Record<string, AdaptiveLoopState> | null) ?? {};

  // No current construct — start the first one or check if all done
  if (!constructId) {
    const nextConstruct = getNextAct2ConstructFromProgress(act2Progress);
    if (!nextConstruct) {
      return {
        type: "TRANSITION",
        from: { act: "ACT_2", detail: "Precision Gauntlet complete" },
        to: { act: "ACT_3", detail: "Calibration & Consistency Audit" },
        transitionMessage:
          "Good work on those focused problems. I have a few final questions to round out the assessment.",
      } satisfies TransitionAction;
    }

    return {
      type: "AGENT_MESSAGE",
      systemPrompt: buildAct2SystemPrompt(nextConstruct),
      userContext: `[TRANSITION TO NEW CONSTRUCT] You are beginning the ${formatConstructName(nextConstruct)} section. Introduce this section with a brief, encouraging transition: "Let me move to a different type of problem." Then present the first calibration item.`,
      act: "ACT_2",
      metadata: {
        construct: nextConstruct,
        phase: 0,
        phaseLabel: "CALIBRATION",
      },
    } satisfies AgentMessageAction;
  }

  const phaseLabel = getPhaseLabel(phase);

  // During diagnostic probe phase — conversational, not structured items
  if (phaseLabel === "DIAGNOSTIC_PROBE") {
    return {
      type: "AGENT_MESSAGE",
      systemPrompt: buildAct2DiagnosticPrompt(constructId, act2Progress[constructId]),
      userContext: lastCandidateMessage
        ? `The candidate responded to a diagnostic probe: "${lastCandidateMessage}". Analyze their response and either ask one more targeted follow-up or conclude the diagnostic for this construct.`
        : `Generate a diagnostic probe question for ${formatConstructName(constructId)}. The probe should investigate the nature of their performance ceiling.`,
      act: "ACT_2",
      metadata: {
        construct: constructId,
        phase,
        phaseLabel: "DIAGNOSTIC_PROBE",
      },
    } satisfies AgentMessageAction;
  }

  // For calibration, boundary mapping, pressure test — serve real items from item bank
  const loopState: AdaptiveLoopState = act2Progress[constructId] ?? initLoopState(constructId as any);
  const nextItem = getNextItem(loopState);

  if (!nextItem) {
    // No more items available for this phase — advance to next phase or construct
    if ((phaseLabel as string) !== "DIAGNOSTIC_PROBE") {
      return {
        type: "AGENT_MESSAGE",
        systemPrompt: buildAct2SystemPrompt(constructId),
        userContext: `No more items available for this phase. Transition to the next phase of assessment for ${formatConstructName(constructId)}.`,
        act: "ACT_2",
        metadata: {
          construct: constructId,
          phase: Math.min(phase + 1, 3),
          phaseLabel: getPhaseLabel(Math.min(phase + 1, 3)),
          advancePhase: true,
        },
      } satisfies AgentMessageAction;
    }
    // Diagnostic probe complete — move to next construct
    return {
      type: "AGENT_MESSAGE",
      systemPrompt: buildAct2SystemPrompt(constructId),
      userContext: `Diagnostic probing for ${formatConstructName(constructId)} is complete. Wrap up this section briefly.`,
      act: "ACT_2",
      metadata: {
        construct: constructId,
        phase,
        phaseLabel,
        constructComplete: true,
      },
    } satisfies AgentMessageAction;
  }

  return {
    type: "INTERACTIVE_ELEMENT",
    elementType: nextItem.elementType,
    elementData: {
      prompt: nextItem.prompt,
      construct: nextItem.construct as any,
      itemId: nextItem.id,
      options: nextItem.options,
      timingExpectations: nextItem.timingExpectations,
    },
    act: "ACT_2",
    followUpPrompt: "Walk me through your thinking on that one.",
  } satisfies InteractiveElementAction;
}

function getPhaseLabel(phase: number): AdaptivePhase {
  switch (phase) {
    case 0: return "CALIBRATION";
    case 1: return "BOUNDARY_MAPPING";
    case 2: return "PRESSURE_TEST";
    case 3: return "DIAGNOSTIC_PROBE";
    default: return "DIAGNOSTIC_PROBE";
  }
}

function buildAct2SystemPrompt(construct: string): string {
  return `You are an assessment agent conducting a focused ability measurement. You are now testing ${formatConstructName(construct)}.

RULES:
- Present items clearly and concisely
- After each structured response, ask the candidate to explain their reasoning
- Make the adaptation visible: "Let me try something a bit more complex" or "That was a tough one"
- Never reveal correct answers or scores
- Transition smoothly between items
- Keep a professional, warm tone`;
}

function buildAct2DiagnosticPrompt(construct: string, loopState?: AdaptiveLoopState): string {
  return `You are a diagnostic assessment engine. The candidate has completed structured items for ${formatConstructName(construct)}.

Your job is to generate follow-up questions that diagnose the NATURE of the candidate's ceiling:
1. Hard ceiling vs. soft ceiling: Can they solve it with more time or a different approach?
2. Domain-specific vs. general: Is the difficulty isolated to a sub-type?
3. Stress-induced vs. competence-limited: Did pressure cause the failure?
4. Self-aware vs. blind spot: Does the candidate recognize where they struggled?

Generate questions that feel natural. Do not reveal scores or correct answers.`;
}

// ──────────────────────────────────────────────
// ACT 3: Calibration & Consistency
// ──────────────────────────────────────────────

function getAct3Action(
  state: AssessmentState,
  messages: ConversationMessage[],
  lastCandidateMessage?: string,
): EngineAction {
  const act3Progress = (state.act3Progress as {
    confidenceItemsComplete: number;
    parallelScenariosComplete: number;
    selfAssessmentComplete: boolean;
  } | null) ?? {
    confidenceItemsComplete: 0,
    parallelScenariosComplete: 0,
    selfAssessmentComplete: false,
  };

  // Phase 1: Confidence-tagged items
  if (act3Progress.confidenceItemsComplete < ASSESSMENT_STRUCTURE.act3ConfidenceItems) {
    if (!lastCandidateMessage) {
      // Serve a confidence-tagged item
      return {
        type: "INTERACTIVE_ELEMENT",
        elementType: "MULTIPLE_CHOICE_INLINE",
        elementData: {
          prompt: `[Confidence-tagged item ${act3Progress.confidenceItemsComplete + 1}]`,
          itemId: `act3-confidence-${act3Progress.confidenceItemsComplete}`,
        },
        act: "ACT_3",
        followUpPrompt: undefined, // Confidence question comes next
      } satisfies InteractiveElementAction;
    }

    // Ask confidence rating after item response
    return {
      type: "INTERACTIVE_ELEMENT",
      elementType: "CONFIDENCE_RATING",
      elementData: {
        prompt: "How confident are you in that answer?",
        options: ["Very confident", "Somewhat confident", "Not sure"],
      },
      act: "ACT_3",
    } satisfies InteractiveElementAction;
  }

  // Phase 2: Parallel scenario re-presentation
  if (act3Progress.parallelScenariosComplete < ASSESSMENT_STRUCTURE.act3ParallelScenarios) {
    return {
      type: "AGENT_MESSAGE",
      systemPrompt: `You are presenting a brief scenario structurally identical to one from the earlier scenario section, but with completely different surface details. This tests consistency.

RULES:
- Keep the scenario brief (1-2 paragraphs)
- Present the same type of dilemma with different characters and setting
- Ask the candidate how they would handle the situation
- Do not reference the earlier scenario`,
      userContext: `Generate parallel scenario ${act3Progress.parallelScenariosComplete + 1}. This should be structurally similar to Act 1 Scenario ${act3Progress.parallelScenariosComplete + 1} but with entirely different surface content.`,
      act: "ACT_3",
      metadata: {
        parallelScenarioIndex: act3Progress.parallelScenariosComplete,
      },
    } satisfies AgentMessageAction;
  }

  // Phase 3: Reflective self-assessment
  if (!act3Progress.selfAssessmentComplete) {
    return {
      type: "AGENT_MESSAGE",
      systemPrompt: `You are conducting the final reflective self-assessment. Ask the candidate to reflect on the entire assessment experience.`,
      userContext: `Ask: "Across everything we have done today, which parts felt easiest for you? Which felt hardest? Were there moments where you felt uncertain but went with your first instinct?" This is a warm, open-ended closing question.`,
      act: "ACT_3",
      metadata: { selfAssessment: true },
    } satisfies AgentMessageAction;
  }

  // All Act 3 complete
  return {
    type: "COMPLETE",
    closingMessage:
      "Thank you for sharing all of that. You have given me a very thorough picture of how you approach different kinds of challenges. The assessment is now complete — your results will be reviewed and you will hear about next steps soon. I appreciate your time and effort today.",
  } satisfies CompleteAction;
}

// ──────────────────────────────────────────────
// State Mutation Helpers
// ──────────────────────────────────────────────

/**
 * Computes the next state after processing a candidate message and engine action.
 * Returns partial state update to apply via prisma.assessmentState.update().
 */
export function computeStateUpdate(
  currentState: AssessmentState,
  action: EngineAction,
  classification?: ResponseClassification,
): Partial<AssessmentState> {
  if (action.type === "COMPLETE") {
    return { isComplete: true };
  }

  if (action.type === "TRANSITION") {
    const toAct = action.to.act as AssessmentState["currentAct"];
    return {
      currentAct: toAct,
      currentScenario: 0,
      currentBeat: 0,
      currentConstruct: null,
      currentPhase: null,
    };
  }

  if (currentState.currentAct === "ACT_1" && classification) {
    const branchPath = (currentState.branchPath as ResponseClassification[] | null) ?? [];
    const newBeat = currentState.currentBeat + 1;
    const scenario = SCENARIOS[currentState.currentScenario];
    const maxBeats = scenario?.beats.length ?? ASSESSMENT_STRUCTURE.beatsPerScenario;

    if (newBeat >= maxBeats) {
      // Move to next scenario
      return {
        currentScenario: currentState.currentScenario + 1,
        currentBeat: 0,
        branchPath: [...branchPath, classification] as unknown as AssessmentState["branchPath"],
      };
    }

    return {
      currentBeat: newBeat,
      branchPath: [...branchPath, classification] as unknown as AssessmentState["branchPath"],
    };
  }

  // ── Act 2 state updates ──────────────────────────────────────
  if (currentState.currentAct === "ACT_2") {
    const metadata = (action.type === "AGENT_MESSAGE" || action.type === "INTERACTIVE_ELEMENT")
      ? (action as { metadata?: Record<string, unknown> }).metadata
      : undefined;

    if (!metadata) return {};

    const act2Progress = (currentState.act2Progress as Record<string, AdaptiveLoopState> | null) ?? {};

    // Advance phase within a construct
    if (metadata.advancePhase && metadata.construct) {
      const constructId = metadata.construct as string;
      return {
        currentPhase: (currentState.currentPhase ?? 0) + 1,
        act2Progress: {
          ...act2Progress,
          [constructId]: {
            ...(act2Progress[constructId] ?? {}),
            phase: getPhaseLabel(((currentState.currentPhase ?? 0) + 1)),
          },
        } as unknown as AssessmentState["act2Progress"],
      };
    }

    // Complete a construct — move to next
    if (metadata.constructComplete && metadata.construct) {
      const constructId = metadata.construct as string;
      const updatedProgress = {
        ...act2Progress,
        [constructId]: {
          ...(act2Progress[constructId] ?? {}),
          phase: "DIAGNOSTIC_PROBE" as AdaptivePhase,
          probeExchanges: [{ role: "complete" }], // Mark as done
        },
      };

      // Check for next construct
      const nextConstruct = getNextAct2ConstructFromProgress(updatedProgress);
      if (!nextConstruct) {
        // All constructs done — Act 2 complete, will transition on next call
        return {
          currentConstruct: null,
          currentPhase: null,
          act2Progress: updatedProgress as unknown as AssessmentState["act2Progress"],
        };
      }

      return {
        currentConstruct: nextConstruct,
        currentPhase: 0,
        act2Progress: updatedProgress as unknown as AssessmentState["act2Progress"],
      };
    }

    // Starting a new construct
    if (metadata.construct && metadata.construct !== currentState.currentConstruct) {
      return {
        currentConstruct: metadata.construct as string,
        currentPhase: metadata.phase as number ?? 0,
        act2Progress: act2Progress as unknown as AssessmentState["act2Progress"],
      };
    }

    return {};
  }

  // ── Act 3 state updates ──────────────────────────────────────
  if (currentState.currentAct === "ACT_3") {
    const act3Progress = (currentState.act3Progress as {
      confidenceItemsComplete: number;
      parallelScenariosComplete: number;
      selfAssessmentComplete: boolean;
    } | null) ?? {
      confidenceItemsComplete: 0,
      parallelScenariosComplete: 0,
      selfAssessmentComplete: false,
    };

    const metadata = (action.type === "AGENT_MESSAGE" || action.type === "INTERACTIVE_ELEMENT")
      ? (action as { metadata?: Record<string, unknown> }).metadata
      : undefined;

    // After confidence rating element response, advance confidence counter
    if (action.type === "INTERACTIVE_ELEMENT" && (action as InteractiveElementAction).elementType === "CONFIDENCE_RATING") {
      return {
        act3Progress: {
          ...act3Progress,
          confidenceItemsComplete: act3Progress.confidenceItemsComplete + 1,
        } as unknown as AssessmentState["act3Progress"],
      };
    }

    // After parallel scenario response
    if (metadata?.parallelScenarioIndex !== undefined) {
      return {
        act3Progress: {
          ...act3Progress,
          parallelScenariosComplete: act3Progress.parallelScenariosComplete + 1,
        } as unknown as AssessmentState["act3Progress"],
      };
    }

    // After self-assessment
    if (metadata?.selfAssessment) {
      return {
        act3Progress: {
          ...act3Progress,
          selfAssessmentComplete: true,
        } as unknown as AssessmentState["act3Progress"],
      };
    }

    return {};
  }

  return {};
}

/** Helper to find next Act 2 construct from progress map */
function getNextAct2ConstructFromProgress(
  progress: Record<string, AdaptiveLoopState | { phase: string; probeExchanges: unknown[] }>,
): string | null {
  for (const construct of ACT2_CONSTRUCTS) {
    const loopState = progress[construct];
    if (!loopState) return construct;
    const probes = (loopState as any).probeExchanges;
    if (!probes || probes.length < 1) return construct;
    if ((loopState as any).phase !== "DIAGNOSTIC_PROBE") return construct;
  }
  return null;
}

// ──────────────────────────────────────────────
// Utilities
// ──────────────────────────────────────────────

function formatConstructName(construct: string): string {
  return construct
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Build the initial greeting message for the assessment.
 */
export function buildGreetingPrompt(candidateName: string, companyName: string): string {
  return `You are beginning a conversational assessment. Greet the candidate warmly and explain the format.

Candidate name: ${candidateName}
Company: ${companyName}

Say something like: "Hi ${candidateName}, I am the assessment system for ${companyName}. Over the next couple of hours, I am going to work through a series of situations and problems with you to build a detailed picture of your strengths and how you approach different kinds of challenges. There are three sections — first we will work through some workplace scenarios together, then focus on some specific problem-solving abilities, and finally wrap up with a few reflection questions. There are no trick questions. I am genuinely trying to understand how you think. Ready to begin?"`;
}

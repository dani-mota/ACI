/**
 * Transition Scripts — narration sequences for seamless phase transitions.
 *
 * Each transition is a sequence of lines Aria speaks with synchronized
 * visual callbacks (orb resize, act label crossfade, etc.).
 * These go directly to TTS, NOT through the chat API.
 */

export type OrchestratorPhase =
  | "PHASE_0"
  | "TRANSITION_0_1"
  | "ACT_1"
  | "TRANSITION_1_2"
  | "ACT_2"
  | "TRANSITION_2_3"
  | "ACT_3"
  | "COMPLETING";

export interface TransitionLine {
  text: string;
  /** Fired when this line starts playing. */
  onStart?: () => void;
  /** Fired when this line finishes playing. */
  onComplete?: () => void;
}

export interface TransitionScript {
  from: OrchestratorPhase;
  to: OrchestratorPhase;
  lines: TransitionLine[];
}

/** Orb sizes by context (diameter in px, desktop). */
export const ORB_SIZES = {
  FULL: 160,
  COMPACT: 72,
  VOICE_PROBE: 110,
} as const;

/** Orb sizes for mobile. */
export const ORB_SIZES_MOBILE = {
  FULL: 160,
  COMPACT: 56,
  VOICE_PROBE: 90,
} as const;

export const ORB_TRANSITION = {
  duration: 2000,
  easing: "cubic-bezier(0.25, 0.1, 0.25, 1)",
} as const;

/** Estimated speech duration at ~150ms per word (used as TTS fallback). */
export function estimateSpeechDuration(text: string): number {
  return text.split(/\s+/).length * 150;
}

/**
 * Build the Act 1 → Act 2 transition script.
 * Visual callbacks are injected by the orchestrator.
 */
export function buildTransition1to2(callbacks: {
  onOrbCompress: () => void;
  onActLabelCrossfade: () => void;
  onTransitionComplete: () => void;
}): TransitionLine[] {
  return [
    {
      text: "You handled those scenarios well. Now we're going to shift gears.",
      onStart: callbacks.onOrbCompress,
    },
    {
      text: "I'm going to present you with a series of problems — some timed, some not.",
      onStart: callbacks.onActLabelCrossfade,
    },
    {
      text: "Take your time where you can.",
      onComplete: callbacks.onTransitionComplete,
    },
  ];
}

/**
 * Build the Act 2 → Act 3 transition script.
 */
export function buildTransition2to3(callbacks: {
  onOrbExpand: () => void;
  onClearInteractiveElements: () => void;
  onActLabelCrossfade: () => void;
  onTransitionComplete: () => void;
}): TransitionLine[] {
  return [
    {
      text: "We're in the final stretch now. I'd like to revisit a couple of things and get your own read on how you did today.",
      onStart: () => {
        callbacks.onOrbExpand();
        callbacks.onClearInteractiveElements();
      },
    },
    {
      text: "This last part is more reflective — there are no right or wrong answers here.",
      onStart: callbacks.onActLabelCrossfade,
    },
    {
      text: "Let's wrap things up.",
      onComplete: callbacks.onTransitionComplete,
    },
  ];
}

/**
 * Build the completion script (Act 3 → done).
 */
export function buildCompletionScript(callbacks: {
  onOrbSettle: () => void;
  onSubtitlesFadeOut: () => void;
  onComplete: () => void;
}): TransitionLine[] {
  return [
    {
      text: "That's everything. Thank you for your time and your thoughtful responses today.",
      onStart: callbacks.onOrbSettle,
    },
    {
      text: "Your results will be reviewed by the hiring team, and you'll hear from them soon.",
      onComplete: () => {
        callbacks.onSubtitlesFadeOut();
        // Delay before triggering completion to let subtitles fade
        setTimeout(callbacks.onComplete, 2000);
      },
    },
  ];
}

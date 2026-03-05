/**
 * Phase 0 "The Handshake" — scripted introduction sequence.
 *
 * Aria introduces herself, explains the format, validates the mic,
 * then transitions to ACT_1. This is NOT AI-generated; the text is
 * fixed and orchestrated client-side. Messages are persisted to the
 * database for audit via the chat API.
 */

export interface Phase0Segment {
  id: string;
  text: string;
  /** Estimated TTS duration in ms (used for fallback timing). */
  durationEstimateMs: number;
  /** Pause after TTS finishes before next segment (ms). */
  pauseAfterMs?: number;
  /** Whether to show the mic button after this segment. */
  showMic?: boolean;
  /** Whether completing this segment triggers the ACT_1 transition. */
  triggersTransition?: boolean;
}

export const PHASE_0_SEGMENTS: Phase0Segment[] = [
  {
    id: "introduction",
    text: "Hello, and welcome. My name is Aria, and I'll be guiding you through your assessment today. It's good to have you here.",
    durationEstimateMs: 8000,
    pauseAfterMs: 1500,
  },
  {
    id: "format_orientation",
    text: "This will take about 60 to 90 minutes. I'll walk you through some scenarios and problems — and you'll respond by speaking. I'll also give you some questions you can answer by tapping on screen. There are no trick questions, and there's no single right answer to most of what we'll discuss.",
    durationEstimateMs: 15000,
    pauseAfterMs: 1000,
  },
  {
    id: "mic_check",
    text: "Before we begin, let's make sure I can hear you clearly. Tap the microphone button and tell me — what role are you here for today?",
    durationEstimateMs: 8000,
    showMic: true,
  },
  {
    id: "confirmation",
    text: "Perfect, I can hear you. Let's get started.",
    durationEstimateMs: 4000,
    triggersTransition: true,
  },
];

/** Nudge when candidate hasn't responded to mic check after 15s. */
export const MIC_NUDGE_15S =
  "If you'd like, you can also type your response instead.";

/** Nudge when candidate still hasn't responded after 30s — auto-switch to text. */
export const MIC_NUDGE_30S =
  "No worries — let's continue with typing.";

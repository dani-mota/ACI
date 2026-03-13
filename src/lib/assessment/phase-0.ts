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

export function getPhase0Segments(candidateName: string, companyName: string): Phase0Segment[] {
  return [
    {
      id: "introduction",
      text: `Hello ${candidateName}, I'm Aria. Welcome to your assessment with ${companyName}. I'll be guiding you through the process today, and I think you'll find it an engaging experience.`,
      durationEstimateMs: 9000,
      pauseAfterMs: 1500,
    },
    {
      id: "format_orientation",
      text: "Here's how this will work. We'll spend about 60 to 90 minutes together. I'll walk you through some real-world scenarios, and you'll talk through how you'd approach them. We'll also include a few quick questions you can respond to on screen. There are no trick questions, and most of what we discuss doesn't have a single right answer. I'm interested in understanding how you think.",
      durationEstimateMs: 18000,
      pauseAfterMs: 1000,
    },
    {
      id: "mic_check",
      text: "Before we begin, let's confirm your microphone is working. Tap the microphone button and tell me, what role are you here for today?",
      durationEstimateMs: 9000,
      showMic: true,
    },
    {
      id: "confirmation",
      text: "I can hear you clearly. Let's get started.",
      durationEstimateMs: 4000,
      triggersTransition: true,
    },
  ];
}

/** Nudge when candidate hasn't responded to mic check after 15s. */
export const MIC_NUDGE_15S =
  "Take your time. If your microphone isn't cooperating, you're welcome to type your response instead.";

/** Nudge when candidate still hasn't responded after 30s — auto-switch to text. */
export const MIC_NUDGE_30S =
  "No problem at all — let's switch to typing. It works just as well.";

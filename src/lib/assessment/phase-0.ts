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
    text: "Hey there! I'm Aria — really glad you're here. I'll be your guide through this whole thing, and honestly, I think you're going to find it pretty interesting.",
    durationEstimateMs: 9000,
    pauseAfterMs: 1500,
  },
  {
    id: "format_orientation",
    text: "So here's how this works — we'll spend about 60 to 90 minutes together. I'm going to walk you through some real-world scenarios, and you'll just talk through how you'd handle them. We'll also mix in a few quick questions you can tap on screen. There's no trick questions, and honestly, most of what we'll talk about doesn't have one right answer. I'm just curious to hear how you think.",
    durationEstimateMs: 18000,
    pauseAfterMs: 1000,
  },
  {
    id: "mic_check",
    text: "One quick thing before we dive in — let's make sure your mic is working. Tap that microphone button and just tell me, what role are you here for today?",
    durationEstimateMs: 9000,
    showMic: true,
  },
  {
    id: "confirmation",
    text: "Great, I can hear you perfectly! Alright, let's jump in.",
    durationEstimateMs: 4000,
    triggersTransition: true,
  },
];

/** Nudge when candidate hasn't responded to mic check after 15s. */
export const MIC_NUDGE_15S =
  "No rush! If the mic's being tricky, you can always type instead — totally fine either way.";

/** Nudge when candidate still hasn't responded after 30s — auto-switch to text. */
export const MIC_NUDGE_30S =
  "Hey, no worries at all — let's just switch to typing. Works just as well!";

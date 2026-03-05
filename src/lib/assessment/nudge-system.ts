/**
 * Nudge System — silence detection + re-engagement.
 *
 * Monitors candidate silence after Aria finishes speaking.
 * Fires escalating nudge callbacks when the candidate hasn't
 * responded within context-dependent thresholds.
 */

export type NudgeContext =
  | "phase_0"
  | "act_1"
  | "act_2"
  | "act_3";

interface NudgeThresholds {
  /** Seconds until first supportive nudge. */
  first: number;
  /** Seconds until second nudge + text fallback offer. */
  second: number;
  /** Seconds until final auto-advance. */
  final: number;
}

const THRESHOLDS: Record<NudgeContext, NudgeThresholds> = {
  phase_0: { first: 15, second: 30, final: 45 },
  act_1:   { first: 20, second: 40, final: 60 },
  act_2:   { first: 15, second: 30, final: 45 },
  act_3:   { first: 25, second: 50, final: 75 },
};

export type NudgeLevel = "first" | "second" | "final";

export interface NudgeCallbacks {
  onNudge: (level: NudgeLevel) => void;
}

export class NudgeManager {
  private timers: ReturnType<typeof setTimeout>[] = [];
  private context: NudgeContext | null = null;

  /** Start monitoring silence for the given context. */
  start(context: NudgeContext, callbacks: NudgeCallbacks) {
    this.stop();
    this.context = context;
    const t = THRESHOLDS[context];

    this.timers.push(
      setTimeout(() => callbacks.onNudge("first"), t.first * 1000),
      setTimeout(() => callbacks.onNudge("second"), t.second * 1000),
      setTimeout(() => callbacks.onNudge("final"), t.final * 1000),
    );
  }

  /** Reset timers (candidate interacted). */
  reset() {
    const ctx = this.context;
    this.stop();
    this.context = ctx;
  }

  /** Stop all timers. */
  stop() {
    for (const t of this.timers) clearTimeout(t);
    this.timers = [];
    this.context = null;
  }
}

/** First nudge messages — supportive, encouraging. */
export const NUDGE_FIRST: Record<NudgeContext, string> = {
  phase_0: "Take your time — there's no rush.",
  act_1: "Take your time — there's no rush. I'm here whenever you're ready.",
  act_2: "No pressure — take a moment if you need it.",
  act_3: "Take your time to reflect. There's no rush.",
};

/** Second nudge — offer text fallback. */
export const NUDGE_SECOND: Record<NudgeContext, string> = {
  phase_0: "If you'd prefer to type your response, that's completely fine too.",
  act_1: "If you'd prefer to type your response, that's completely fine too.",
  act_2: "You can type your answer if that's easier.",
  act_3: "Feel free to type your thoughts if you'd prefer.",
};

/** Final nudge — auto-advance. */
export const NUDGE_FINAL: Record<NudgeContext, string> = {
  phase_0: "No worries — let's move on.",
  act_1: "No worries — let's move on to the next part.",
  act_2: "Let's continue with the next question.",
  act_3: "Let's keep going.",
};

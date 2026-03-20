/**
 * Nudge System — silence detection + re-engagement.
 *
 * Monitors candidate silence after Aria finishes speaking.
 * Fires escalating nudge callbacks when the candidate hasn't
 * responded within context-dependent thresholds.
 */

const __DEBUG = process.env.NODE_ENV !== "production";

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
  act_1:   { first: 15, second: 30, final: 45 },
  act_2:   { first: 15, second: 30, final: 45 },
  act_3:   { first: 15, second: 30, final: 45 },
};

export type NudgeLevel = "first" | "second" | "final";

export interface NudgeCallbacks {
  onNudge: (level: NudgeLevel) => void;
}

export class NudgeManager {
  private timers: ReturnType<typeof setTimeout>[] = [];
  private context: NudgeContext | null = null;
  private paused = false;
  private pausedCallbacks: NudgeCallbacks | null = null;
  private pausedElapsed = 0;
  private pauseStartTime = 0;
  private startTime = 0;

  /** Start monitoring silence for the given context. */
  start(context: NudgeContext, callbacks: NudgeCallbacks) {
    this.stop();
    this.context = context;
    this.paused = false;
    this.pausedCallbacks = callbacks;
    this.startTime = Date.now();
    this.pausedElapsed = 0;
    const t = THRESHOLDS[context];

    __DEBUG && console.log(`[NUDGE-TRACE] Timer started | context=${context} | thresholds: ${JSON.stringify(t)}`);

    const startedAt = Date.now();
    this.timers.push(
      setTimeout(() => {
        const elapsed = Math.round((Date.now() - startedAt) / 1000);
        __DEBUG && console.log(`[NUDGE-TRACE] Nudge 1 fired at ${elapsed}s | context=${context}`);
        callbacks.onNudge("first");
      }, t.first * 1000),
      setTimeout(() => {
        const elapsed = Math.round((Date.now() - startedAt) / 1000);
        __DEBUG && console.log(`[NUDGE-TRACE] Nudge 2 fired at ${elapsed}s | context=${context}`);
        callbacks.onNudge("second");
      }, t.second * 1000),
      setTimeout(() => {
        const elapsed = Math.round((Date.now() - startedAt) / 1000);
        __DEBUG && console.log(`[NUDGE-TRACE] Auto-advance fired at ${elapsed}s | context=${context}`);
        callbacks.onNudge("final");
      }, t.final * 1000),
    );
  }

  /** Reset timers (candidate interacted). */
  reset() {
    const ctx = this.context;
    this.stop();
    this.context = ctx;
  }

  /** Pause all timers (e.g. during phase transitions). */
  pause() {
    if (this.paused || !this.context) return;
    this.paused = true;
    this.pauseStartTime = Date.now();
    this.pausedElapsed += Date.now() - this.startTime;
    for (const t of this.timers) clearTimeout(t);
    this.timers = [];
  }

  /** Resume paused timers with adjusted remaining time. */
  resume() {
    if (!this.paused || !this.context || !this.pausedCallbacks) return;
    this.paused = false;
    const ctx = this.context;
    const callbacks = this.pausedCallbacks;
    const elapsed = this.pausedElapsed;
    const t = THRESHOLDS[ctx];

    this.startTime = Date.now();
    this.pausedElapsed = elapsed;

    const remaining = (ms: number) => Math.max(0, ms - elapsed);

    this.timers.push(
      setTimeout(() => callbacks.onNudge("first"), remaining(t.first * 1000)),
      setTimeout(() => callbacks.onNudge("second"), remaining(t.second * 1000)),
      setTimeout(() => callbacks.onNudge("final"), remaining(t.final * 1000)),
    );
  }

  /** Stop all timers. */
  stop() {
    for (const t of this.timers) clearTimeout(t);
    this.timers = [];
    this.context = null;
    this.paused = false;
    this.pausedCallbacks = null;
    this.pausedElapsed = 0;
  }

  /** Whether the manager is currently paused. */
  isPaused(): boolean {
    return this.paused;
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
  act_1: "Take your time — when you're ready, tap the microphone or type your thoughts.",
  act_2: "You can type your answer if that's easier.",
  act_3: "Feel free to type your thoughts if you'd prefer.",
};

/** Final nudge — auto-advance. */
export const NUDGE_FINAL: Record<NudgeContext, string> = {
  phase_0: "No worries — let's move on.",
  act_1: "I'll move us along, but we can revisit this if you'd like.",
  act_2: "Let's continue with the next question.",
  act_3: "Let's keep going.",
};

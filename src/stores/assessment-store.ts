import { create } from "zustand";
import type { AssessmentItem } from "@/lib/assessment/items";

interface ItemResponse {
  itemId: string;
  response: string;
  responseTimeMs: number;
  confidence?: number;
}

interface AssessmentState {
  token: string | null;
  assessmentId: string | null;
  roleId: string | null;
  blockIndex: number;
  itemIndex: number;
  items: AssessmentItem[];
  responses: Map<string, ItemResponse>;
  blockStartTime: number;
  itemStartTime: number;

  // Actions
  initBlock: (token: string, assessmentId: string, blockIndex: number, items: AssessmentItem[], roleId?: string) => void;
  submitResponse: (itemId: string, response: string, confidence?: number) => void;
  advanceItem: () => boolean; // returns false if block is complete
  getProgress: () => { current: number; total: number };
}

interface FailedSubmit {
  url: string;
  body: object;
  timestamp: number;
}

// Retry a fetch up to maxAttempts times with exponential backoff.
// On permanent failure, saves the payload to localStorage for reconciliation.
async function submitWithRetry(
  url: string,
  body: object,
  token: string,
  maxAttempts = 3
): Promise<void> {
  const delays = [0, 1000, 3000];
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (delays[attempt] > 0) {
      await new Promise((r) => setTimeout(r, delays[attempt]));
    }
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) return;
    } catch {
      // network error — will retry
    }
  }
  // All attempts failed: queue for reconciliation on next block init
  const queueKey = `aci-failed-${token}`;
  const existing: FailedSubmit[] = JSON.parse(localStorage.getItem(queueKey) || "[]");
  existing.push({ url, body, timestamp: Date.now() });
  localStorage.setItem(queueKey, JSON.stringify(existing));
}

// Flush any queued failed submits from previous network failures
function flushFailedQueue(token: string): void {
  const queueKey = `aci-failed-${token}`;
  const queue: FailedSubmit[] = JSON.parse(localStorage.getItem(queueKey) || "[]");
  if (queue.length === 0) return;

  localStorage.removeItem(queueKey);
  for (const item of queue) {
    // Best-effort resend — no further retry to avoid infinite growth
    fetch(item.url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(item.body),
    }).catch(() => {});
  }
}

export const useAssessmentStore = create<AssessmentState>((set, get) => ({
  token: null,
  assessmentId: null,
  roleId: null,
  blockIndex: 0,
  itemIndex: 0,
  items: [],
  responses: new Map(),
  blockStartTime: Date.now(),
  itemStartTime: Date.now(),

  initBlock: (token, assessmentId, blockIndex, items, roleId) => {
    // Flush any responses that failed to submit in a previous block
    if (typeof window !== "undefined") {
      flushFailedQueue(token);
    }

    // Restore from sessionStorage if available
    const storageKey = `aci-assess-${token}-${blockIndex}`;
    const saved = typeof window !== "undefined" ? sessionStorage.getItem(storageKey) : null;
    let restoredResponses = new Map<string, ItemResponse>();
    let restoredItemIndex = 0;

    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        restoredResponses = new Map(parsed.responses || []);
        restoredItemIndex = parsed.itemIndex || 0;
      } catch {
        // ignore parse errors
      }
    }

    set({
      token,
      assessmentId,
      roleId: roleId ?? null,
      blockIndex,
      itemIndex: restoredItemIndex,
      items,
      responses: restoredResponses,
      blockStartTime: Date.now(),
      itemStartTime: Date.now(),
    });
  },

  submitResponse: (itemId, response, confidence) => {
    const state = get();
    const responseTimeMs = Date.now() - state.itemStartTime;

    const newResponses = new Map(state.responses);
    newResponses.set(itemId, { itemId, response, responseTimeMs, confidence });

    set({ responses: newResponses });

    // Persist to sessionStorage so progress survives a page reload
    if (typeof window !== "undefined" && state.token) {
      const storageKey = `aci-assess-${state.token}-${state.blockIndex}`;
      sessionStorage.setItem(
        storageKey,
        JSON.stringify({
          itemIndex: state.itemIndex,
          responses: Array.from(newResponses.entries()),
        })
      );
    }

    // Send to server with retry — failed submits are queued for reconciliation
    if (state.token) {
      submitWithRetry(
        `/api/assess/${state.token}/response`,
        {
          itemId,
          itemType: state.items[state.itemIndex]?.itemType || "MULTIPLE_CHOICE",
          response,
          responseTimeMs,
          confidence,
        },
        state.token
      );
    }
  },

  advanceItem: () => {
    const state = get();
    const nextIndex = state.itemIndex + 1;

    if (nextIndex >= state.items.length) {
      return false; // block complete
    }

    set({ itemIndex: nextIndex, itemStartTime: Date.now() });

    // Update sessionStorage
    if (typeof window !== "undefined" && state.token) {
      const storageKey = `aci-assess-${state.token}-${state.blockIndex}`;
      sessionStorage.setItem(
        storageKey,
        JSON.stringify({
          itemIndex: nextIndex,
          responses: Array.from(state.responses.entries()),
        })
      );
    }

    return true;
  },

  getProgress: () => {
    const state = get();
    return { current: state.itemIndex + 1, total: state.items.length };
  },
}));

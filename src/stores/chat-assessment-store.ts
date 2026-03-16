import { create } from "zustand";
import type { OrchestratorPhase } from "@/lib/assessment/transitions";
import type { ScenarioReference } from "@/lib/assessment/parse-scenario-response";
import { parseScenarioResponse, splitSentences, cleanText } from "@/lib/assessment/parse-scenario-response";
import { mapApiError } from "@/lib/errors";
import type { AssessmentTurnResponse } from "@/lib/types/turn";

// ── Types ──

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  act?: string;
  elementType?: string;
  elementData?: Record<string, unknown>;
  candidateInput?: string;
  createdAt?: string;
}

export interface InteractiveElement {
  elementType: string;
  elementData: Record<string, unknown>;
  followUpPrompt?: string;
  responded: boolean;
}

export type OrbMode = "idle" | "speaking" | "listening" | "processing";
export type OrbSize = "full" | "compact";
export type InputMode = "voice" | "text";

// ── State interface ──

interface ChatAssessmentState {
  // Identity
  token: string | null;
  assessmentId: string | null;

  // Message history (for server context — NOT for display)
  messages: ChatMessage[];
  isLoading: boolean;
  error: string | null;

  // Display state (what the screen reads)
  subtitleText: string;
  subtitleRevealedWords: number;
  sentenceList: string[];
  currentSentenceIndex: number;
  referenceCard: ScenarioReference | null;
  /** How many reference card sections to reveal (progressive reveal during Beat 0). -1 = show all. */
  referenceRevealCount: number;
  orbMode: OrbMode;
  displayEvent: number;
  displayIsHistory: boolean;

  // Interactive elements
  activeElement: InteractiveElement | null;

  // Assessment progress
  currentAct: string;
  isComplete: boolean;
  orchestratorPhase: OrchestratorPhase;
  actProgress: { act1: number; act2: number; act3: number };

  // Orb visual state
  orbSize: OrbSize;
  orbTargetSize: number;
  audioAmplitude: number;

  // TTS state (set by component)
  isTTSPlaying: boolean;
  ttsFallbackActive: boolean;

  // Input state
  inputMode: InputMode;
  candidateTranscript: string;
  showTranscript: boolean;
  isTransitioning: boolean;

  // Timer (timed challenges)
  timerActive: boolean;
  timerSeconds: number;

  // Actions
  init: (token: string, assessmentId: string) => void;
  loadHistory: (messages: ChatMessage[], state?: {
    currentAct: string;
    isComplete: boolean;
    phase0Complete?: boolean;
    progress?: { act1: number; act2: number; act3: number };
  }) => void;
  sendMessage: (content: string) => Promise<void>;
  sendElementResponse: (response: { elementType: string; value: string; itemId?: string; construct?: string; responseTimeMs?: number }) => Promise<void>;
  displayMessage: (content: string, act: string, isHistory: boolean) => void;
  /** Handle a unified Turn response (Stage 3). Sets all display state from Turn fields. */
  handleTurn: (turn: AssessmentTurnResponse) => void;
  /** The last Turn received (for TurnPlayer rendering). */
  lastTurn: AssessmentTurnResponse | null;

  // Simple setters
  setActiveElement: (element: InteractiveElement | null) => void;
  setOrbMode: (mode: OrbMode) => void;
  setOrbSize: (size: OrbSize) => void;
  setOrbTargetSize: (size: number) => void;
  setAudioAmplitude: (amplitude: number) => void;
  setSubtitleText: (text: string) => void;
  setSubtitleRevealedWords: (count: number) => void;
  setTTSPlaying: (playing: boolean) => void;
  setTTSFallback: (fallback: boolean) => void;
  setInputMode: (mode: InputMode) => void;
  setCandidateTranscript: (text: string) => void;
  setShowTranscript: (show: boolean) => void;
  setTransitioning: (transitioning: boolean) => void;
  setOrchestratorPhase: (phase: OrchestratorPhase) => void;
  setActProgress: (act: "act1" | "act2" | "act3", value: number) => void;
  setSentenceList: (sentences: string[]) => void;
  setCurrentSentenceIndex: (index: number) => void;
  setReferenceCard: (card: ScenarioReference | null) => void;
  setReferenceRevealCount: (count: number) => void;
  updateReferenceQuestion: (question: string) => void;
  addNewInformation: (items: string[]) => void;
  clearReferenceCard: () => void;
  setVoiceListening: (listening: boolean) => void;
  setVoiceSpeaking: (speaking: boolean) => void;
  startTimer: (seconds: number) => void;
  stopTimer: () => void;
  reset: () => void;
}

// ── Helpers ──

/** Apply progress data from server response to the store */
function applyProgress(progress: { act1?: number; act2?: number; act3?: number } | undefined) {
  if (!progress) return;
  const store = useChatAssessmentStore.getState();
  if (progress.act1 !== undefined) store.setActProgress("act1", progress.act1);
  if (progress.act2 !== undefined) store.setActProgress("act2", progress.act2);
  if (progress.act3 !== undefined) store.setActProgress("act3", progress.act3);
}

// ── Store ──

export const useChatAssessmentStore = create<ChatAssessmentState>((set, get) => ({
  // Defaults
  token: null,
  assessmentId: null,
  messages: [],
  isLoading: false,
  error: null,
  subtitleText: "",
  subtitleRevealedWords: 0,
  sentenceList: [],
  currentSentenceIndex: 0,
  referenceCard: null,
  referenceRevealCount: -1,
  orbMode: "idle",
  displayEvent: 0,
  displayIsHistory: false,
  activeElement: null,
  currentAct: "ACT_1",
  isComplete: false,
  orchestratorPhase: "PHASE_0" as OrchestratorPhase,
  actProgress: { act1: 0, act2: 0, act3: 0 },
  orbSize: "full",
  orbTargetSize: 200,
  audioAmplitude: 0,
  isTTSPlaying: false,
  ttsFallbackActive: false,
  inputMode: "voice",
  candidateTranscript: "",
  showTranscript: false,
  isTransitioning: false,
  timerActive: false,
  timerSeconds: 0,
  lastTurn: null,

  // ── Actions ──

  init: (token, assessmentId) => {
    set({ token, assessmentId, error: null });
  },

  loadHistory: (messages, state) => {
    // Restore active element from last unanswered interactive message
    let activeElement: InteractiveElement | null = null;
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      if (msg.role === "user") break;
      if (msg.role === "assistant" && msg.elementType && msg.elementData) {
        activeElement = {
          elementType: msg.elementType,
          elementData: msg.elementData,
          responded: false,
        };
        break;
      }
    }

    set({
      messages,
      isLoading: false,
      currentAct: state?.currentAct ?? "ACT_1",
      isComplete: state?.isComplete ?? false,
      activeElement,
      actProgress: state?.progress ?? { act1: 0, act2: 0, act3: 0 },
    });
  },

  displayMessage: (content, act, isHistory) => {
    if (act === "ACT_1") {
      const parsed = parseScenarioResponse(content);

      // Compute the updated reference card
      const computeRefCard = (prev: ScenarioReference | null): ScenarioReference | null => {
        if (parsed.reference) {
          // Only replace an existing card with an explicit ---REFERENCE--- (new scenario).
          // Fallback-generated references should not overwrite an existing card.
          if (parsed.referenceIsExplicit || !prev) {
            return parsed.reference;
          }
          // Fallback reference but card already exists — keep existing card
          return prev;
        }
        if (parsed.referenceUpdate && prev) {
          // Follow-up beat: accumulate new information and update question
          return {
            ...prev,
            newInformation: [...prev.newInformation, ...parsed.referenceUpdate.newInformation],
            question: parsed.referenceUpdate.question || prev.question,
          };
        }
        return prev;
      };

      // Determine reveal mode: Beat 0 explicit reference starts hidden (0), everything else shows all (-1)
      const computeRevealCount = (prev: ScenarioReference | null, currentRevealCount: number): number => {
        if (isHistory) return -1; // History: show everything
        if (parsed.referenceIsExplicit && !prev) return 0; // New scenario Beat 0: progressive reveal
        // Preserve existing reveal count of 0 (progressive reveal still in progress)
        if (currentRevealCount === 0) return 0;
        return -1; // Follow-up beats or updates: show all existing content
      };

      if (isHistory) {
        const cleanedText = parsed.sentences.join(" ");
        set((s) => ({
          subtitleText: cleanedText,
          subtitleRevealedWords: cleanedText.split(/\s+/).length,
          sentenceList: [],
          currentSentenceIndex: 0,
          referenceCard: computeRefCard(s.referenceCard),
          referenceRevealCount: -1,
          orbMode: "idle",
          displayEvent: s.displayEvent + 1,
          displayIsHistory: true,
        }));
      } else {
        set((s) => ({
          subtitleText: parsed.sentences[0] || parsed.spokenText,
          subtitleRevealedWords: 0,
          sentenceList: parsed.sentences,
          currentSentenceIndex: 0,
          referenceCard: computeRefCard(s.referenceCard),
          referenceRevealCount: computeRevealCount(s.referenceCard, s.referenceRevealCount),
          orbMode: "speaking",
          displayEvent: s.displayEvent + 1,
          displayIsHistory: false,
        }));
      }
    } else {
      let cleaned = cleanText(content);
      // Strip any remaining JSON blocks (e.g., Act 2 structured data leaking into subtitles)
      cleaned = cleaned.replace(/\{[\s\S]*?"(?:newInformation|question|role|context|sections)"[\s\S]*?\}/g, "").trim();
      // Guard: if cleanText strips everything, fall back to original content
      if (!cleaned.trim()) {
        console.warn("[displayMessage] cleanText returned empty, using raw content");
        const fallbackSentences = splitSentences(content);
        set((s) => ({
          subtitleText: fallbackSentences[0] || content,
          subtitleRevealedWords: isHistory ? content.split(/\s+/).length : 0,
          sentenceList: isHistory ? [] : fallbackSentences,
          currentSentenceIndex: 0,
          orbMode: isHistory ? "idle" : "speaking",
          displayEvent: s.displayEvent + 1,
          displayIsHistory: isHistory,
        }));
        return;
      }
      const sentences = splitSentences(cleaned);
      if (isHistory) {
        set((s) => ({
          subtitleText: cleaned,
          subtitleRevealedWords: cleaned.split(/\s+/).length,
          sentenceList: [],
          currentSentenceIndex: 0,
          orbMode: "idle",
          displayEvent: s.displayEvent + 1,
          displayIsHistory: true,
        }));
      } else {
        set((s) => ({
          subtitleText: sentences[0] || content,
          subtitleRevealedWords: 0,
          sentenceList: sentences,
          currentSentenceIndex: 0,
          orbMode: "speaking",
          displayEvent: s.displayEvent + 1,
          displayIsHistory: false,
        }));
      }
    }
  },

  /**
   * Handle a unified AssessmentTurnResponse from the server.
   * Maps Turn fields → store state. Used when FEATURE_UNIFIED_TURNS is on.
   */
  handleTurn: (turn: AssessmentTurnResponse) => {
    const s = get();

    // 1. Store the Turn for TurnPlayer rendering
    set({ lastTurn: turn });

    // 2. Apply progress
    if (turn.meta.progress) {
      applyProgress(turn.meta.progress);
    }

    // 3. Handle completion
    if (turn.meta.isComplete) {
      set({ isComplete: true });
    }

    // 4. Handle transitions
    if (turn.meta.transition) {
      set({ currentAct: turn.meta.transition.to });
    }

    // 5. Handle reference card
    if (turn.delivery.referenceCard) {
      set({
        referenceCard: {
          role: turn.delivery.referenceCard.role || "",
          context: turn.delivery.referenceCard.context || "",
          sections: turn.delivery.referenceCard.sections || [],
          question: turn.delivery.referenceCard.question || "",
          newInformation: [],
        },
        referenceRevealCount: 0, // progressive reveal
      });
    }
    if (turn.delivery.referenceUpdate) {
      const card = s.referenceCard;
      if (card) {
        set({
          referenceCard: {
            ...card,
            newInformation: [...card.newInformation, ...(turn.delivery.referenceUpdate.newInformation || [])],
            question: turn.delivery.referenceUpdate.question || card.question,
          },
          referenceRevealCount: -1,
        });
      }
    }

    // 6. Handle interactive element
    if (turn.delivery.interactiveElement) {
      const el = turn.delivery.interactiveElement;
      set({
        activeElement: {
          elementType: el.elementType,
          elementData: {
            prompt: el.prompt,
            ...(el.options ? { options: el.options } : {}),
            ...(el.timeLimit ? { timeLimit: el.timeLimit } : {}),
            ...(el.asciiDiagram ? { asciiDiagram: el.asciiDiagram } : {}),
            ...(el.unitSuffix ? { unitSuffix: el.unitSuffix } : {}),
            ...(el.timingExpectations ? { timingExpectations: el.timingExpectations } : {}),
          },
          responded: false,
        },
      });
    }

    // 7. Set sentences for display (text reveal / TTS)
    const sentences = turn.delivery.sentences;
    if (sentences.length > 0) {
      set((s) => ({
        subtitleText: sentences[0],
        subtitleRevealedWords: 0,
        sentenceList: sentences,
        currentSentenceIndex: 0,
        orbMode: "speaking",
        displayEvent: s.displayEvent + 1,
        displayIsHistory: false,
        isLoading: false,
      }));
    } else {
      set({ isLoading: false, orbMode: "idle" });
    }
  },

  sendMessage: async (content) => {
    const { token, messages } = get();
    if (!token) return;
    if (get().isLoading) {
      console.warn("[sendMessage] Blocked by isLoading guard, content:", content);
      throw new Error("SEND_BLOCKED_LOADING");
    }

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content,
      createdAt: new Date().toISOString(),
    };

    const assistantMessage: ChatMessage = {
      id: `assistant-${Date.now()}`,
      role: "assistant",
      content: "",
    };

    set({
      messages: [...messages, userMessage, assistantMessage],
      isLoading: true,
      error: null,
      orbMode: "processing",
    });

    try {
      const allMessages = [...messages, userMessage].map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const doFetch = async (attempt: number) => {
        const res = await fetch(`/api/assess/${token}/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: allMessages }),
          signal: AbortSignal.timeout(30_000),
        });

        if (!res.ok) {
          if (res.status === 400) {
            try {
              const errData = await res.json();
              if (errData.error?.includes("already completed")) {
                set({ isComplete: true, isLoading: false });
                return null; // Signal early exit
              }
            } catch { /* fall through */ }
          }
          throw new Error(`Chat request failed: ${res.status}`);
        }
        return res;
      };

      let response: Response | null = null;
      try {
        response = await doFetch(1);
      } catch (fetchErr) {
        // Retry once after 2s delay
        await new Promise((r) => setTimeout(r, 2000));
        response = await doFetch(2);
      }

      if (!response) return; // Early exit (already completed)

      const contentType = response.headers.get("content-type") || "";

      // Handle JSON responses (transitions, interactive elements, completion)
      if (contentType.includes("application/json")) {
        const data = await response.json();
        const currentMessages = get().messages.filter((m) => m.id !== assistantMessage.id);

        // Unified Turn response (FEATURE_UNIFIED_TURNS on server)
        if (data.type === "turn") {
          const agentContent = data.delivery?.sentences?.join(" ") || "";
          const msg: ChatMessage = {
            id: `assistant-${Date.now()}`,
            role: "assistant",
            content: agentContent,
          };
          set({ messages: [...currentMessages, msg] });
          get().handleTurn(data as AssessmentTurnResponse);
          return;
        }

        if (data.type === "interactive_element") {
          set({
            messages: currentMessages,
            isLoading: false,
            orbMode: "idle",
            activeElement: {
              elementType: data.elementType,
              elementData: data.elementData,
              followUpPrompt: data.followUpPrompt,
              responded: false,
            },
          });
          applyProgress(data.progress);
          return;
        }

        if (data.type === "transition" || data.type === "complete") {
          const transitionMsg: ChatMessage = {
            id: `assistant-${Date.now()}`,
            role: "assistant",
            content: data.message,
          };
          set({
            messages: [...currentMessages, transitionMsg],
            isLoading: false,
            currentAct: data.to?.act ?? get().currentAct,
            isComplete: data.type === "complete",
          });
          applyProgress(data.progress);
          if (data.message) {
            get().displayMessage(data.message, get().currentAct, false);
          }
          return;
        }

        // Pre-generated content response (or generic JSON with message)
        if (data.message) {
          const msg: ChatMessage = {
            id: `assistant-${Date.now()}`,
            role: "assistant",
            content: data.message,
          };
          set({ messages: [...currentMessages, msg], isLoading: false });

          // If the response includes structured reference data, apply it directly
          // instead of relying on parseScenarioResponse to extract from text delimiters
          const hasReferenceCard = !!data.referenceCard;
          if (hasReferenceCard) {
            set({
              referenceCard: {
                role: data.referenceCard.role || "",
                context: data.referenceCard.context || "",
                sections: data.referenceCard.sections || [],
                question: data.referenceCard.question || "",
                newInformation: [],
              },
            });
          }
          if (data.referenceUpdate) {
            const card = get().referenceCard;
            if (card) {
              // Merge into existing card
              set({
                referenceCard: {
                  ...card,
                  newInformation: [...card.newInformation, ...(data.referenceUpdate.newInformation || [])],
                  question: data.referenceUpdate.question || card.question,
                },
                referenceRevealCount: -1,
              });
            } else {
              // No card exists yet — create a minimal one from update data
              set({
                referenceCard: {
                  context: "Situation Update",
                  sections: [],
                  newInformation: data.referenceUpdate.newInformation || [],
                  question: data.referenceUpdate.question || "",
                },
                referenceRevealCount: -1,
              });
            }
          }

          // Display message for TTS (sentences will be extracted by displayMessage)
          // If we already set reference data above, displayMessage's parseScenarioResponse
          // won't find delimiters and will just split spoken text into sentences — which is correct
          get().displayMessage(data.message, get().currentAct, false);

          // Override reveal count AFTER displayMessage to guarantee progressive reveal
          // (displayMessage's computeRevealCount may set -1; we need 0 for Beat 0)
          if (hasReferenceCard) {
            set({ referenceRevealCount: 0 });
          }
          applyProgress(data.progress);
          return;
        }
      }

      // Handle streaming response
      if (response.body) {
        // Read progress from header (available before stream body)
        const progressHeader = response.headers.get("x-aci-progress");
        if (progressHeader) {
          try { applyProgress(JSON.parse(progressHeader)); } catch { /* ignore */ }
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let accumulated = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          accumulated += chunk;
          set((s) => ({
            messages: s.messages.map((m) =>
              m.id === assistantMessage.id ? { ...m, content: accumulated } : m,
            ),
          }));
        }

        // Finalize streaming message
        const finalContent = accumulated;
        set((s) => ({
          messages: s.messages.map((m) =>
            m.id === assistantMessage.id ? { ...m, content: finalContent } : m,
          ),
          isLoading: false,
        }));

        // DIRECT DISPLAY — the fix
        if (finalContent) {
          get().displayMessage(finalContent, get().currentAct, false);
        }
      }
    } catch (err) {
      const errorMessage = mapApiError(err);
      set((s) => ({
        messages: s.messages.filter((m) => m.id !== assistantMessage.id),
        isLoading: false,
        error: errorMessage || null,
        orbMode: "idle",
      }));
      throw err;
    }
  },

  sendElementResponse: async (response) => {
    const { token, messages } = get();
    if (!token) return;
    if (get().isLoading) {
      console.warn("[sendElementResponse] Blocked by isLoading guard");
      return;
    }

    set({ isLoading: true, error: null, orbMode: "processing" });

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: response.value,
    };

    set((s) => ({ messages: [...s.messages, userMsg] }));

    try {
      let res: Response | null = null;
      let lastError: Error | null = null;
      const MAX_RETRIES = 3;

      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
          res = await fetch(`/api/assess/${token}/chat`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              messages: [...messages, userMsg].map((m) => ({ role: m.role, content: m.content })),
              elementResponse: response,
            }),
            signal: AbortSignal.timeout(30_000),
          });

          if (!res.ok) {
            throw new Error(`Element response failed: ${res.status}`);
          }
          break; // Success — exit retry loop
        } catch (err) {
          lastError = err instanceof Error ? err : new Error(String(err));
          console.warn(`[sendElementResponse] Attempt ${attempt}/${MAX_RETRIES} failed:`, lastError.message);
          if (attempt < MAX_RETRIES) {
            await new Promise((r) => setTimeout(r, 1000 * attempt)); // Backoff: 1s, 2s
          }
        }
      }

      if (!res || !res.ok) {
        throw lastError ?? new Error("Element response failed after retries");
      }

      // Mark element as responded on success
      set((s) => ({
        activeElement: s.activeElement ? { ...s.activeElement, responded: true } : null,
      }));

      const contentType = res.headers.get("content-type") || "";

      if (contentType.includes("application/json")) {
        const data = await res.json();
        const currentMessages = get().messages;

        if (data.type === "interactive_element") {
          set({
            isLoading: false,
            orbMode: "idle",
            activeElement: {
              elementType: data.elementType,
              elementData: data.elementData,
              followUpPrompt: data.followUpPrompt,
              responded: false,
            },
          });
          applyProgress(data.progress);
          return;
        }

        if (data.type === "transition" || data.type === "complete") {
          const transitionMsg: ChatMessage = {
            id: `assistant-${Date.now()}`,
            role: "assistant",
            content: data.message,
          };
          set({
            messages: [...currentMessages, transitionMsg],
            isLoading: false,
            activeElement: null,
            currentAct: data.to?.act ?? get().currentAct,
            isComplete: data.type === "complete",
          });
          applyProgress(data.progress);
          if (data.message) {
            get().displayMessage(data.message, get().currentAct, false);
          }
          return;
        }

        if (data.message) {
          const msg: ChatMessage = {
            id: `assistant-${Date.now()}`,
            role: "assistant",
            content: data.message,
          };
          set({ messages: [...currentMessages, msg], isLoading: false, activeElement: null });
          get().displayMessage(data.message, get().currentAct, false);
          applyProgress(data.progress);
          return;
        }

        set({ isLoading: false, activeElement: null, orbMode: "idle" });
        return;
      }

      // Handle streaming response
      if (res.body) {
        // Read progress from header
        const elProgressHeader = res.headers.get("x-aci-progress");
        if (elProgressHeader) {
          try { applyProgress(JSON.parse(elProgressHeader)); } catch { /* ignore */ }
        }

        const assistantMsg: ChatMessage = {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: "",
        };

        set((s) => ({
          messages: [...s.messages, assistantMsg],
          activeElement: null,
        }));

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let accumulated = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          accumulated += chunk;
          set((s) => ({
            messages: s.messages.map((m) =>
              m.id === assistantMsg.id ? { ...m, content: accumulated } : m,
            ),
          }));
        }

        const finalContent = accumulated;
        set((s) => ({
          messages: s.messages.map((m) =>
            m.id === assistantMsg.id ? { ...m, content: finalContent } : m,
          ),
          isLoading: false,
        }));

        if (finalContent) {
          get().displayMessage(finalContent, get().currentAct, false);
        }
      }
    } catch (err) {
      const errorMessage = mapApiError(err);
      set((s) => ({
        isLoading: false,
        error: errorMessage || null,
        orbMode: "idle",
        activeElement: s.activeElement ? { ...s.activeElement, responded: false } : null,
      }));
    }
  },

  // ── Simple setters ──
  setActiveElement: (element) => set({ activeElement: element }),
  setOrbMode: (mode) => set({ orbMode: mode }),
  setOrbSize: (size) => set({ orbSize: size }),
  setOrbTargetSize: (size) => set({ orbTargetSize: size }),
  setAudioAmplitude: (amplitude) => set({ audioAmplitude: amplitude }),
  setSubtitleText: (text) => set({ subtitleText: text, subtitleRevealedWords: 0 }),
  setSubtitleRevealedWords: (count) => set({ subtitleRevealedWords: count }),
  setTTSPlaying: (playing) => set({ isTTSPlaying: playing }),
  setTTSFallback: (fallback) => set({ ttsFallbackActive: fallback }),
  setInputMode: (mode) => set({ inputMode: mode }),
  setCandidateTranscript: (text) => set({ candidateTranscript: text }),
  setShowTranscript: (show) => set({ showTranscript: show }),
  setTransitioning: (transitioning) => set({ isTransitioning: transitioning }),
  setOrchestratorPhase: (phase) => set({ orchestratorPhase: phase }),
  setActProgress: (act, value) => set((s) => ({ actProgress: { ...s.actProgress, [act]: value } })),
  setSentenceList: (sentences) => set({ sentenceList: sentences, currentSentenceIndex: 0 }),
  setCurrentSentenceIndex: (index) => set({ currentSentenceIndex: index }),
  setReferenceCard: (card) => set({ referenceCard: card }),
  setReferenceRevealCount: (count) => set({ referenceRevealCount: count }),
  updateReferenceQuestion: (question) => set((s) => ({
    referenceCard: s.referenceCard ? { ...s.referenceCard, question } : null,
  })),
  addNewInformation: (items) => set((s) => ({
    referenceCard: s.referenceCard
      ? { ...s.referenceCard, newInformation: [...s.referenceCard.newInformation, ...items] }
      : null,
  })),
  clearReferenceCard: () => set({ referenceCard: null }),
  setVoiceListening: (listening) => set({ orbMode: listening ? "listening" : "idle" }),
  setVoiceSpeaking: (speaking) => set({ orbMode: speaking ? "speaking" : "idle" }),
  startTimer: (seconds) => set({ timerActive: true, timerSeconds: seconds }),
  stopTimer: () => set({ timerActive: false, timerSeconds: 0 }),

  reset: () =>
    set({
      token: null,
      assessmentId: null,
      messages: [],
      isLoading: false,
      error: null,
      subtitleText: "",
      subtitleRevealedWords: 0,
      sentenceList: [],
      currentSentenceIndex: 0,
      referenceCard: null,
      referenceRevealCount: -1,
      orbMode: "idle",
      displayEvent: 0,
      displayIsHistory: false,
      activeElement: null,
      currentAct: "ACT_1",
      isComplete: false,
      orchestratorPhase: "PHASE_0" as OrchestratorPhase,
      actProgress: { act1: 0, act2: 0, act3: 0 },
      orbSize: "full",
      orbTargetSize: 200,
      audioAmplitude: 0,
      isTTSPlaying: false,
      ttsFallbackActive: false,
      inputMode: "voice",
      candidateTranscript: "",
      showTranscript: false,
      isTransitioning: false,
      timerActive: false,
      timerSeconds: 0,
    }),
}));

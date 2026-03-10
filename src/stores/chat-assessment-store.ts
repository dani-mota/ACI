import { create } from "zustand";
import type { OrchestratorPhase } from "@/lib/assessment/transitions";
import type { ScenarioReference } from "@/lib/assessment/parse-scenario-response";
import { parseScenarioResponse, splitSentences, cleanText } from "@/lib/assessment/parse-scenario-response";

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

interface InteractiveElement {
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
  loadHistory: (messages: ChatMessage[], state?: { currentAct: string; isComplete: boolean }) => void;
  sendMessage: (content: string) => Promise<void>;
  sendElementResponse: (response: { elementType: string; value: string; itemId?: string; construct?: string; responseTimeMs?: number }) => Promise<void>;
  displayMessage: (content: string, act: string, isHistory: boolean) => void;

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
      const computeRevealCount = (prev: ScenarioReference | null): number => {
        if (isHistory) return -1; // History: show everything
        if (parsed.referenceIsExplicit && !prev) return 0; // New scenario Beat 0: progressive reveal
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
          referenceRevealCount: computeRevealCount(s.referenceCard),
          orbMode: "speaking",
          displayEvent: s.displayEvent + 1,
          displayIsHistory: false,
        }));
      }
    } else {
      const cleaned = cleanText(content);
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

      const response = await fetch(`/api/assess/${token}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: allMessages }),
      });

      if (!response.ok) {
        if (response.status === 400) {
          try {
            const errData = await response.json();
            if (errData.error?.includes("already completed")) {
              set({ isComplete: true, isLoading: false });
              return;
            }
          } catch { /* fall through */ }
        }
        throw new Error(`Chat request failed: ${response.status}`);
      }

      const contentType = response.headers.get("content-type") || "";

      // Handle JSON responses (transitions, interactive elements, completion)
      if (contentType.includes("application/json")) {
        const data = await response.json();
        const currentMessages = get().messages.filter((m) => m.id !== assistantMessage.id);

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
          if (data.message) {
            get().displayMessage(data.message, get().currentAct, false);
          }
          return;
        }

        // Generic JSON response
        if (data.message) {
          const msg: ChatMessage = {
            id: `assistant-${Date.now()}`,
            role: "assistant",
            content: data.message,
          };
          set({ messages: [...currentMessages, msg], isLoading: false });
          get().displayMessage(data.message, get().currentAct, false);
          return;
        }
      }

      // Handle streaming response
      if (response.body) {
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
        console.log("[sendMessage] Stream complete, finalContent length:", finalContent.length);
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
      const errorMessage = err instanceof Error ? err.message : "Something went wrong";
      set((s) => ({
        messages: s.messages.filter((m) => m.id !== assistantMessage.id),
        isLoading: false,
        error: errorMessage,
        orbMode: "idle",
      }));
      throw err;
    }
  },

  sendElementResponse: async (response) => {
    const { token, messages } = get();
    if (!token) return;

    set({ isLoading: true, error: null, orbMode: "processing" });

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: response.value,
    };

    set((s) => ({ messages: [...s.messages, userMsg] }));

    try {
      const res = await fetch(`/api/assess/${token}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...messages, userMsg].map((m) => ({ role: m.role, content: m.content })),
          elementResponse: response,
        }),
      });

      if (!res.ok) throw new Error(`Element response failed: ${res.status}`);

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
          return;
        }

        set({ isLoading: false, activeElement: null, orbMode: "idle" });
        return;
      }

      // Handle streaming response
      if (res.body) {
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
        console.log("[sendElementResponse] Stream complete, finalContent length:", finalContent.length);
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
      const errorMessage = err instanceof Error ? err.message : "Something went wrong";
      set({ isLoading: false, error: errorMessage, orbMode: "idle" });
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

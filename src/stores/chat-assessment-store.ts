import { create } from "zustand";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  act?: string;
  elementType?: string;
  elementData?: Record<string, unknown>;
  candidateInput?: string;
  createdAt?: string;
  isStreaming?: boolean;
}

interface InteractiveElement {
  elementType: string;
  elementData: Record<string, unknown>;
  followUpPrompt?: string;
  responded: boolean;
}

interface VoiceState {
  enabled: boolean;
  listening: boolean;
  speaking: boolean;
}

export type OrbMode = "idle" | "speaking" | "listening" | "processing";
export type OrbSize = "full" | "compact";
export type InputMode = "voice" | "text";

interface ChatAssessmentState {
  // Assessment identity
  token: string | null;
  assessmentId: string | null;

  // Messages
  messages: ChatMessage[];
  isLoading: boolean;
  error: string | null;

  // Current interactive element (if any)
  activeElement: InteractiveElement | null;

  // Voice mode
  voice: VoiceState;

  // Assessment progress
  currentAct: string;
  isComplete: boolean;

  // Timer (for timed challenges)
  timerActive: boolean;
  timerSeconds: number;

  // ── Stage UI state (orb experience) ──
  orbMode: OrbMode;
  orbSize: OrbSize;
  audioAmplitude: number;

  subtitleText: string;
  subtitleRevealedWords: number;

  isTTSPlaying: boolean;
  ttsFallbackActive: boolean;

  inputMode: InputMode;
  candidateTranscript: string;
  showTranscript: boolean;
  isTransitioning: boolean;

  // Actions
  init: (token: string, assessmentId: string) => void;
  loadHistory: (messages: ChatMessage[], state?: { currentAct: string; isComplete: boolean }) => void;
  sendMessage: (content: string) => Promise<void>;
  sendElementResponse: (response: { elementType: string; value: string; itemId?: string; construct?: string; responseTimeMs?: number }) => Promise<void>;
  setActiveElement: (element: InteractiveElement | null) => void;
  toggleVoice: () => void;
  setVoiceListening: (listening: boolean) => void;
  setVoiceSpeaking: (speaking: boolean) => void;
  startTimer: (seconds: number) => void;
  stopTimer: () => void;
  reset: () => void;

  // ── Stage UI actions ──
  setOrbMode: (mode: OrbMode) => void;
  setOrbSize: (size: OrbSize) => void;
  setAudioAmplitude: (amplitude: number) => void;
  setSubtitleText: (text: string) => void;
  setSubtitleRevealedWords: (count: number) => void;
  setTTSPlaying: (playing: boolean) => void;
  setTTSFallback: (fallback: boolean) => void;
  setInputMode: (mode: InputMode) => void;
  setCandidateTranscript: (text: string) => void;
  setShowTranscript: (show: boolean) => void;
  setTransitioning: (transitioning: boolean) => void;
}

export const useChatAssessmentStore = create<ChatAssessmentState>((set, get) => ({
  token: null,
  assessmentId: null,
  messages: [],
  isLoading: false,
  error: null,
  activeElement: null,
  voice: { enabled: false, listening: false, speaking: false },
  currentAct: "ACT_1",
  isComplete: false,
  timerActive: false,
  timerSeconds: 0,

  // Stage UI defaults
  orbMode: "idle",
  orbSize: "full",
  audioAmplitude: 0,
  subtitleText: "",
  subtitleRevealedWords: 0,
  isTTSPlaying: false,
  ttsFallbackActive: false,
  inputMode: "voice",
  candidateTranscript: "",
  showTranscript: false,
  isTransitioning: false,

  init: (token, assessmentId) => {
    set({ token, assessmentId, error: null });
  },

  loadHistory: (messages, state) => {
    // Restore active element from last unanswered interactive message
    let activeElement: InteractiveElement | null = null;
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      if (msg.role === "user") break; // Found a user response, no pending element
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
      currentAct: state?.currentAct ?? "ACT_1",
      isComplete: state?.isComplete ?? false,
      activeElement,
    });
  },

  sendMessage: async (content) => {
    const { token, messages } = get();
    if (!token || get().isLoading) return;

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
      isStreaming: true,
    };

    set({
      messages: [...messages, userMessage, assistantMessage],
      isLoading: true,
      error: null,
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
        // Handle "Assessment already completed" (400) gracefully
        if (response.status === 400) {
          try {
            const errData = await response.json();
            if (errData.error?.includes("already completed")) {
              set({ isComplete: true, isLoading: false });
              return;
            }
          } catch { /* fall through to generic error */ }
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
          const transitionMessage: ChatMessage = {
            id: `assistant-${Date.now()}`,
            role: "assistant",
            content: data.message,
          };
          set({
            messages: [...currentMessages, transitionMessage],
            isLoading: false,
            currentAct: data.to?.act ?? get().currentAct,
            isComplete: data.type === "complete",
          });
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
          // Parse Vercel AI SDK data stream format
          const lines = chunk.split("\n");
          for (const line of lines) {
            if (line.startsWith("0:")) {
              // Text delta — remove the "0:" prefix and parse the JSON string
              try {
                const text = JSON.parse(line.slice(2));
                accumulated += text;
                // Update the streaming message
                set((s) => ({
                  messages: s.messages.map((m) =>
                    m.id === assistantMessage.id
                      ? { ...m, content: accumulated }
                      : m,
                  ),
                }));
              } catch {
                // Non-JSON line, skip
              }
            }
          }
        }

        // Finalize the streaming message
        set((s) => ({
          messages: s.messages.map((m) =>
            m.id === assistantMessage.id
              ? { ...m, isStreaming: false }
              : m,
          ),
          isLoading: false,
        }));
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Something went wrong";
      set((s) => ({
        messages: s.messages.filter((m) => m.id !== assistantMessage.id),
        isLoading: false,
        error: errorMessage,
      }));
    }
  },

  sendElementResponse: async (response) => {
    const { token, messages } = get();
    if (!token) return;

    set({ isLoading: true, error: null });

    // Add candidate's element response as a visible message
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

      // Handle JSON responses (next interactive element, transition, completion)
      if (contentType.includes("application/json")) {
        const data = await res.json();
        const currentMessages = get().messages;

        if (data.type === "interactive_element") {
          set({
            isLoading: false,
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
          return;
        }

        if (data.message) {
          const msg: ChatMessage = {
            id: `assistant-${Date.now()}`,
            role: "assistant",
            content: data.message,
          };
          set({ messages: [...currentMessages, msg], isLoading: false, activeElement: null });
          return;
        }

        set({ isLoading: false, activeElement: null });
        return;
      }

      // Handle streaming response (agent follow-up after element)
      if (res.body) {
        const assistantMsg: ChatMessage = {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: "",
          isStreaming: true,
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
          const lines = chunk.split("\n");
          for (const line of lines) {
            if (line.startsWith("0:")) {
              try {
                const text = JSON.parse(line.slice(2));
                accumulated += text;
                set((s) => ({
                  messages: s.messages.map((m) =>
                    m.id === assistantMsg.id ? { ...m, content: accumulated } : m,
                  ),
                }));
              } catch { /* skip non-JSON lines */ }
            }
          }
        }

        set((s) => ({
          messages: s.messages.map((m) =>
            m.id === assistantMsg.id ? { ...m, isStreaming: false } : m,
          ),
          isLoading: false,
        }));
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Something went wrong";
      set({ isLoading: false, error: errorMessage });
    }
  },

  setActiveElement: (element) => set({ activeElement: element }),

  toggleVoice: () =>
    set((s) => ({
      voice: { ...s.voice, enabled: !s.voice.enabled, listening: false, speaking: false },
    })),

  setVoiceListening: (listening) =>
    set((s) => ({ voice: { ...s.voice, listening } })),

  setVoiceSpeaking: (speaking) =>
    set((s) => ({ voice: { ...s.voice, speaking } })),

  startTimer: (seconds) => set({ timerActive: true, timerSeconds: seconds }),
  stopTimer: () => set({ timerActive: false, timerSeconds: 0 }),

  // ── Stage UI actions ──
  setOrbMode: (mode) => set({ orbMode: mode }),
  setOrbSize: (size) => set({ orbSize: size }),
  setAudioAmplitude: (amplitude) => set({ audioAmplitude: amplitude }),
  setSubtitleText: (text) => set({ subtitleText: text, subtitleRevealedWords: 0 }),
  setSubtitleRevealedWords: (count) => set({ subtitleRevealedWords: count }),
  setTTSPlaying: (playing) => set({ isTTSPlaying: playing }),
  setTTSFallback: (fallback) => set({ ttsFallbackActive: fallback }),
  setInputMode: (mode) => set({ inputMode: mode }),
  setCandidateTranscript: (text) => set({ candidateTranscript: text }),
  setShowTranscript: (show) => set({ showTranscript: show }),
  setTransitioning: (transitioning) => set({ isTransitioning: transitioning }),

  reset: () =>
    set({
      token: null,
      assessmentId: null,
      messages: [],
      isLoading: false,
      error: null,
      activeElement: null,
      voice: { enabled: false, listening: false, speaking: false },
      currentAct: "ACT_1",
      isComplete: false,
      timerActive: false,
      timerSeconds: 0,
      orbMode: "idle",
      orbSize: "full",
      audioAmplitude: 0,
      subtitleText: "",
      subtitleRevealedWords: 0,
      isTTSPlaying: false,
      ttsFallbackActive: false,
      inputMode: "voice",
      candidateTranscript: "",
      showTranscript: false,
      isTransitioning: false,
    }),
}));

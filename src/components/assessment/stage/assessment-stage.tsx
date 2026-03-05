"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useChatAssessmentStore } from "@/stores/chat-assessment-store";
import { LivingBackground } from "@/components/assessment/background/living-background";
import { AssessmentOrb } from "@/components/assessment/orb/assessment-orb";
import { StageProgressBar } from "./progress-bar";
import { ActLabel } from "./act-label";
import { SubtitleDisplay } from "./subtitle-display";
import { CandidateTranscript } from "./candidate-transcript";
import { InputModeToggle } from "./input-mode-toggle";
import { StageChoiceCards } from "@/components/assessment/interactive/stage-choice-cards";
import { StageTimedChallenge } from "@/components/assessment/interactive/stage-timed-challenge";
import { StageConfidenceRating } from "@/components/assessment/interactive/stage-confidence-rating";
import { StageNumericInput } from "@/components/assessment/interactive/stage-numeric-input";
import { MicButton } from "@/components/assessment/voice/mic-button";
import { TTSEngine } from "@/components/assessment/voice/tts-engine";

// Stable reference to get fresh store state without subscribing
const getStore = () => useChatAssessmentStore.getState();

interface AssessmentStageProps {
  token: string;
  assessmentId: string;
  candidateName: string;
  companyName: string;
}

export function AssessmentStage({
  token,
  assessmentId,
}: AssessmentStageProps) {
  // ── Subscribe to individual state slices (prevents re-render cascades) ──
  const messages = useChatAssessmentStore((s) => s.messages);
  const currentAct = useChatAssessmentStore((s) => s.currentAct);
  const isComplete = useChatAssessmentStore((s) => s.isComplete);
  const activeElement = useChatAssessmentStore((s) => s.activeElement);
  const isLoading = useChatAssessmentStore((s) => s.isLoading);
  const error = useChatAssessmentStore((s) => s.error);
  const orbMode = useChatAssessmentStore((s) => s.orbMode);
  const orbSize = useChatAssessmentStore((s) => s.orbSize);
  const audioAmplitude = useChatAssessmentStore((s) => s.audioAmplitude);
  const subtitleText = useChatAssessmentStore((s) => s.subtitleText);
  const subtitleRevealedWords = useChatAssessmentStore((s) => s.subtitleRevealedWords);
  const isTTSPlaying = useChatAssessmentStore((s) => s.isTTSPlaying);
  const candidateTranscript = useChatAssessmentStore((s) => s.candidateTranscript);
  const showTranscript = useChatAssessmentStore((s) => s.showTranscript);
  const inputMode = useChatAssessmentStore((s) => s.inputMode);

  const [initialized, setInitialized] = useState(false);
  const [textInput, setTextInput] = useState("");
  const [showElements, setShowElements] = useState(false);
  const ttsRef = useRef<TTSEngine | null>(null);
  const lastProcessedMsgId = useRef<string | null>(null);
  const prevActRef = useRef<string>("ACT_1");
  const wordRevealTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const transcriptTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Initialize TTS engine (use getStore for callbacks — stable, no deps)
  useEffect(() => {
    const engine = new TTSEngine(
      (amplitude) => getStore().setAudioAmplitude(amplitude),
      (playing) => getStore().setTTSPlaying(playing),
      () => getStore().setTTSFallback(true),
    );
    ttsRef.current = engine;
    return () => engine.destroy();
  }, []);

  // Initialize assessment
  useEffect(() => {
    if (initialized) return;
    setInitialized(true);

    const s = getStore();
    s.init(token, assessmentId);
    s.setOrbMode("processing"); // Visual feedback immediately

    fetch(`/api/assess/${token}/chat`)
      .then((res) => res.json())
      .then((data) => {
        const st = getStore();
        if (data.messages?.length > 0) {
          st.loadHistory(data.messages, {
            currentAct: data.state?.currentAct ?? "ACT_1",
            isComplete: data.state?.isComplete ?? false,
          });

          // Show last assistant message as context (fully revealed, no TTS)
          const lastAssistant = [...data.messages]
            .reverse()
            .find((m: { role: string }) => m.role === "assistant");
          if (lastAssistant) {
            st.setSubtitleText(lastAssistant.content);
            st.setSubtitleRevealedWords(lastAssistant.content.split(/\s+/).length);
            lastProcessedMsgId.current = lastAssistant.id;
            st.setOrbMode("idle");
          } else {
            st.setOrbMode("idle");
          }
        } else {
          st.sendMessage("[START_ASSESSMENT]");
        }
      })
      .catch(() => {
        getStore().sendMessage("[START_ASSESSMENT]");
      });
  }, [token, assessmentId, initialized]);

  // ── Message → Subtitle + TTS Pipeline ──
  useEffect(() => {
    if (messages.length === 0) return;

    // Find the last assistant message (might not be the very last message)
    let lastAssistant: typeof messages[number] | null = null;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "assistant") {
        lastAssistant = messages[i];
        break;
      }
    }

    if (!lastAssistant) return;
    if (lastAssistant.id === lastProcessedMsgId.current) return;

    // Still streaming — show processing state
    if (lastAssistant.isStreaming) {
      getStore().setOrbMode("processing");
      return;
    }

    // Message complete — process it
    lastProcessedMsgId.current = lastAssistant.id;
    const text = lastAssistant.content;
    if (!text) return;

    // Detect if this is a history message (has createdAt) vs new streamed message
    const isHistory = !!lastAssistant.createdAt;

    const s = getStore();
    s.setSubtitleText(text);

    const words = text.split(/\s+/);
    const totalWords = words.length;

    if (wordRevealTimer.current) clearInterval(wordRevealTimer.current);

    if (isHistory) {
      // History: show all words immediately, no TTS
      s.setSubtitleRevealedWords(totalWords);
      s.setOrbMode("idle");
    } else {
      // New message: play TTS + word-by-word reveal
      s.setOrbMode("speaking");

      // Dynamic timing: aim for ~6s total reveal, capped 60–200ms per word
      const msPerWord = Math.max(60, Math.min(200, 6000 / totalWords));
      let revealed = 0;

      wordRevealTimer.current = setInterval(() => {
        revealed++;
        getStore().setSubtitleRevealedWords(revealed);
        if (revealed >= totalWords) {
          if (wordRevealTimer.current) clearInterval(wordRevealTimer.current);
        }
      }, msPerWord);

      // Play TTS
      if (ttsRef.current) {
        ttsRef.current.speak(text, token).then(() => {
          // Ensure all words are revealed when TTS finishes
          getStore().setSubtitleRevealedWords(totalWords);
          if (wordRevealTimer.current) clearInterval(wordRevealTimer.current);
          getStore().setOrbMode("idle");
          getStore().setAudioAmplitude(0);
        }).catch(() => {
          // TTS failed — reveal all words and go idle
          getStore().setSubtitleRevealedWords(totalWords);
          if (wordRevealTimer.current) clearInterval(wordRevealTimer.current);
          getStore().setOrbMode("idle");
        });
      }
    }
  }, [messages, token]);

  // ── Interactive element appearance animation ──
  useEffect(() => {
    if (activeElement && !activeElement.responded) {
      const timer = setTimeout(() => setShowElements(true), 300);
      return () => clearTimeout(timer);
    } else {
      setShowElements(false);
    }
  }, [activeElement]);

  // ── Act transitions ──
  useEffect(() => {
    if (currentAct === prevActRef.current) return;
    prevActRef.current = currentAct;

    const s = getStore();
    s.setTransitioning(true);
    s.setOrbSize(currentAct === "ACT_2" ? "compact" : "full");

    const timer = setTimeout(() => {
      getStore().setTransitioning(false);
    }, 3000);

    return () => clearTimeout(timer);
  }, [currentAct]);

  // ── Completion redirect ──
  useEffect(() => {
    if (!isComplete) return;

    const timer = setTimeout(() => {
      window.location.href = `/assess/${token}/survey`;
    }, 4000);

    return () => clearTimeout(timer);
  }, [isComplete, token]);

  // ── Handlers (use getStore() for fresh state — no store in deps) ──
  const handleVoiceTranscript = useCallback(
    (text: string) => {
      const s = getStore();
      s.setCandidateTranscript(text);
      s.setShowTranscript(true);
      if (transcriptTimeout.current) clearTimeout(transcriptTimeout.current);
      transcriptTimeout.current = setTimeout(() => getStore().setShowTranscript(false), 3000);

      ttsRef.current?.stop();

      const el = s.activeElement;
      if (el && !el.responded) {
        s.sendElementResponse({ elementType: el.elementType, value: text });
      } else {
        s.setOrbMode("processing");
        s.sendMessage(text);
      }
    },
    [],
  );

  const handleElementResponse = useCallback(
    (value: string) => {
      const s = getStore();
      const el = s.activeElement;
      if (!el) return;

      ttsRef.current?.stop();

      s.sendElementResponse({
        elementType: el.elementType,
        value,
        itemId: el.elementData.itemId as string | undefined,
        construct: el.elementData.construct as string | undefined,
      });
    },
    [],
  );

  const handleTextSend = useCallback(() => {
    const text = textInput.trim();
    if (!text) return;
    const s = getStore();
    if (s.isLoading) return;
    setTextInput("");

    ttsRef.current?.stop();
    s.setOrbMode("processing");
    s.sendMessage(text);
  }, [textInput]);

  const handleListeningChange = useCallback(
    (listening: boolean) => {
      const s = getStore();
      s.setVoiceListening(listening);
      if (listening) {
        ttsRef.current?.stop();
        s.setOrbMode("listening");
      } else if (!s.isLoading) {
        s.setOrbMode("idle");
      }
    },
    [],
  );

  // Render interactive element
  const renderInteractiveElement = () => {
    if (!activeElement || activeElement.responded) return null;

    const { elementType, elementData } = activeElement;
    const prompt = (elementData.prompt as string) ?? "";
    const options = (elementData.options as string[]) ?? [];
    const timeLimit = (elementData.timeLimit as number) ?? 60;

    switch (elementType) {
      case "MULTIPLE_CHOICE_INLINE":
      case "TRADEOFF_SELECTION":
        return (
          <StageChoiceCards
            prompt={prompt}
            options={options}
            onSelect={handleElementResponse}
            disabled={isLoading}
          />
        );
      case "NUMERIC_INPUT":
        return (
          <StageNumericInput
            prompt={prompt}
            onSubmit={handleElementResponse}
            disabled={isLoading}
          />
        );
      case "CONFIDENCE_RATING":
        return (
          <StageConfidenceRating
            prompt={prompt}
            onSelect={handleElementResponse}
            disabled={isLoading}
          />
        );
      case "TIMED_CHALLENGE":
        return (
          <StageTimedChallenge
            prompt={prompt}
            options={options}
            timeLimit={timeLimit}
            onSelect={handleElementResponse}
            onTimeout={() => handleElementResponse("TIMEOUT")}
            disabled={isLoading}
          />
        );
      default:
        return null;
    }
  };

  const isVoiceMode = inputMode === "voice" || currentAct !== "ACT_2";
  const showInputToggle = currentAct === "ACT_2" && !activeElement;
  const showInput = !isComplete && !activeElement;

  return (
    <div
      className="fixed inset-0 z-50 overflow-hidden"
      style={{ background: "#080e1a" }}
    >
      {/* Living background */}
      <LivingBackground />

      {/* Stage content */}
      <div className="relative z-10 flex flex-col items-center h-[100dvh] px-4 py-6">
        {/* Top: Progress */}
        <div className="w-full pt-2 pb-6">
          <StageProgressBar currentAct={currentAct} />
        </div>

        {/* Center: Orb + Subtitle area */}
        <div className="flex flex-col items-center flex-1 justify-center gap-4 -mt-8">
          {/* Act label */}
          <ActLabel currentAct={currentAct} />

          {/* Orb */}
          <AssessmentOrb
            mode={orbMode}
            amplitude={audioAmplitude}
            compact={orbSize === "compact"}
          />

          {/* Subtitle */}
          <SubtitleDisplay
            text={subtitleText}
            revealedWords={subtitleRevealedWords}
            isRevealing={isTTSPlaying}
          />

          {/* Candidate transcript */}
          <CandidateTranscript
            text={candidateTranscript}
            visible={showTranscript}
          />

          {/* Interactive elements */}
          {activeElement && !activeElement.responded && (
            <div
              className="w-full flex justify-center stage-animate"
              style={{
                opacity: showElements ? 1 : 0,
                transform: showElements ? "translateY(0)" : "translateY(24px)",
                transition: "opacity 700ms cubic-bezier(0.25, 0.1, 0.25, 1), transform 700ms cubic-bezier(0.25, 0.1, 0.25, 1)",
              }}
            >
              {renderInteractiveElement()}
            </div>
          )}
        </div>

        {/* Bottom: Input area */}
        {showInput && (
          <div className="flex flex-col items-center gap-3 pb-4 w-full">
            {showInputToggle && (
              <InputModeToggle
                mode={inputMode}
                onToggle={(mode) => getStore().setInputMode(mode)}
              />
            )}

            {isVoiceMode ? (
              <MicButton
                onTranscript={handleVoiceTranscript}
                onListeningChange={handleListeningChange}
                disabled={isLoading || isTTSPlaying}
              />
            ) : (
              <div className="flex gap-2 w-full max-w-md">
                <textarea
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleTextSend();
                    }
                  }}
                  placeholder="Type your response..."
                  disabled={isLoading}
                  rows={1}
                  className="flex-1 resize-none px-4 py-3 text-sm outline-none"
                  style={{
                    borderRadius: "10px",
                    border: "1px solid rgba(255, 255, 255, 0.07)",
                    background: "rgba(255, 255, 255, 0.03)",
                    color: "rgba(255, 255, 255, 0.85)",
                    fontFamily: "var(--font-display)",
                    maxHeight: "80px",
                    minHeight: "44px",
                  }}
                  onInput={(e) => {
                    const target = e.target as HTMLTextAreaElement;
                    target.style.height = "auto";
                    target.style.height = `${Math.min(target.scrollHeight, 80)}px`;
                  }}
                />
                <button
                  onClick={handleTextSend}
                  disabled={!textInput.trim() || isLoading}
                  aria-label="Send message"
                  style={{
                    width: "44px",
                    height: "44px",
                    borderRadius: "10px",
                    border: "1px solid rgba(37, 99, 235, 0.3)",
                    background: textInput.trim()
                      ? "rgba(37, 99, 235, 0.15)"
                      : "rgba(255, 255, 255, 0.03)",
                    color: textInput.trim()
                      ? "#60a5fa"
                      : "rgba(255, 255, 255, 0.2)",
                    cursor: textInput.trim() ? "pointer" : "default",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    transition: "all 200ms ease",
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <line x1="22" y1="2" x2="11" y2="13" />
                    <polygon points="22 2 15 22 11 13 2 9 22 2" />
                  </svg>
                </button>
              </div>
            )}
          </div>
        )}

        {/* Error */}
        {error && (
          <div
            className="fixed bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-lg"
            style={{
              background: "rgba(220, 38, 38, 0.15)",
              border: "1px solid rgba(220, 38, 38, 0.3)",
              color: "#fca5a5",
              fontSize: "12px",
              fontFamily: "var(--font-display)",
            }}
          >
            Something went wrong. Please try again.
          </div>
        )}
      </div>
    </div>
  );
}

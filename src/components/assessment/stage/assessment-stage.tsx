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
import { PHASE_0_SEGMENTS, MIC_NUDGE_15S, MIC_NUDGE_30S } from "@/lib/assessment/phase-0";
import { NudgeManager, NUDGE_FIRST, NUDGE_SECOND, NUDGE_FINAL, type NudgeContext } from "@/lib/assessment/nudge-system";

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
  companyName,
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
  const micButtonRef = useRef<HTMLButtonElement>(null);
  const lastProcessedMsgId = useRef<string | null>(null);
  const prevActRef = useRef<string>("ACT_1");
  const wordRevealTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const transcriptTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const phase0Ref = useRef<"idle" | "playing" | "mic_check" | "completing" | "done">("idle");
  const micNudgeTimers = useRef<{ t15?: ReturnType<typeof setTimeout>; t30?: ReturnType<typeof setTimeout> }>({});
  const [phase0MicCheck, setPhase0MicCheck] = useState(false);
  const nudgeRef = useRef(new NudgeManager());

  // Session timer
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setElapsedSeconds((s) => s + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

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

  // Resume AudioContext on first user interaction
  useEffect(() => {
    const resumeAudio = () => {
      ttsRef.current?.resumeContext();
      document.removeEventListener("click", resumeAudio);
      document.removeEventListener("touchstart", resumeAudio);
      document.removeEventListener("keydown", resumeAudio);
    };
    document.addEventListener("click", resumeAudio, { once: true });
    document.addEventListener("touchstart", resumeAudio, { once: true });
    document.addEventListener("keydown", resumeAudio, { once: true });
    return () => {
      document.removeEventListener("click", resumeAudio);
      document.removeEventListener("touchstart", resumeAudio);
      document.removeEventListener("keydown", resumeAudio);
    };
  }, []);

  // Initialize assessment
  useEffect(() => {
    if (initialized) return;
    setInitialized(true);

    const s = getStore();
    s.init(token, assessmentId);
    s.setOrbMode("processing");

    fetch(`/api/assess/${token}/chat`)
      .then((res) => res.json())
      .then((data) => {
        const st = getStore();
        const serverAct = data.state?.currentAct ?? "PHASE_0";

        if (data.messages?.length > 0) {
          if (serverAct === "PHASE_0") {
            phase0Ref.current = "done";
            prevActRef.current = "ACT_1";
            st.setOrbMode("processing");
            fetch(`/api/assess/${token}/chat`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ trigger: "phase_0_complete" }),
            }).then(() => {
              const store = getStore();
              store.loadHistory([], { currentAct: "ACT_1", isComplete: false });
              store.sendMessage("[BEGIN_ASSESSMENT]");
            });
            return;
          }

          st.loadHistory(data.messages, {
            currentAct: serverAct,
            isComplete: data.state?.isComplete ?? false,
          });
          prevActRef.current = serverAct;

          const lastAssistant = [...data.messages]
            .reverse()
            .find((m: { role: string }) => m.role === "assistant");
          if (lastAssistant) {
            st.setSubtitleText(lastAssistant.content);
            st.setSubtitleRevealedWords(lastAssistant.content.split(/\s+/).length);
            lastProcessedMsgId.current = lastAssistant.id;
          }
          st.setOrbMode("idle");
        } else {
          st.loadHistory([], { currentAct: serverAct, isComplete: false });
          prevActRef.current = serverAct;
          st.setOrbMode("idle");
        }
      })
      .catch(() => {
        getStore().setOrbMode("idle");
      });
  }, [token, assessmentId, initialized]);

  // ── Phase 0 helpers ──
  const persistPhase0Msg = useCallback(
    async (content: string, role: "AGENT" | "CANDIDATE") => {
      await fetch(`/api/assess/${token}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trigger: "phase_0_message", content, role }),
      });
    },
    [token],
  );

  const clearMicNudgeTimers = useCallback(() => {
    if (micNudgeTimers.current.t15) clearTimeout(micNudgeTimers.current.t15);
    if (micNudgeTimers.current.t30) clearTimeout(micNudgeTimers.current.t30);
    micNudgeTimers.current = {};
  }, []);

  const playSegmentTTS = useCallback(
    async (text: string) => {
      const s = getStore();
      s.setOrbMode("speaking");
      s.setSubtitleText(text);

      const words = text.split(/\s+/);
      const msPerWord = Math.max(60, Math.min(200, 6000 / words.length));
      let revealed = 0;
      const revealInterval = setInterval(() => {
        revealed++;
        getStore().setSubtitleRevealedWords(revealed);
        if (revealed >= words.length) clearInterval(revealInterval);
      }, msPerWord);

      if (ttsRef.current) {
        try {
          await ttsRef.current.speak(text, token);
        } catch {
          /* fallback timing handled by word reveal */
        }
      }

      clearInterval(revealInterval);
      getStore().setSubtitleRevealedWords(words.length);
      getStore().setOrbMode("idle");
      getStore().setAudioAmplitude(0);
    },
    [token],
  );

  const handlePhase0Response = useCallback(
    async (text: string) => {
      if (phase0Ref.current !== "mic_check") return;
      phase0Ref.current = "completing";
      setPhase0MicCheck(false);
      clearMicNudgeTimers();

      await persistPhase0Msg(text, "CANDIDATE");

      const confirmation = PHASE_0_SEGMENTS[3];
      await playSegmentTTS(confirmation.text);
      await persistPhase0Msg(confirmation.text, "AGENT");

      phase0Ref.current = "done";
      await fetch(`/api/assess/${token}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trigger: "phase_0_complete" }),
      });

      const s = getStore();
      s.loadHistory([], { currentAct: "ACT_1", isComplete: false });
      s.setOrbMode("processing");
      s.sendMessage("[BEGIN_ASSESSMENT]");
    },
    [token, clearMicNudgeTimers, persistPhase0Msg, playSegmentTTS],
  );

  // ── Phase 0 orchestration ──
  useEffect(() => {
    if (!initialized || currentAct !== "PHASE_0" || phase0Ref.current !== "idle") return;

    let cancelled = false;
    phase0Ref.current = "playing";

    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

    (async () => {
      for (const segment of PHASE_0_SEGMENTS.slice(0, 2)) {
        if (cancelled) return;
        await playSegmentTTS(segment.text);
        await persistPhase0Msg(segment.text, "AGENT");
        if (segment.pauseAfterMs) await sleep(segment.pauseAfterMs);
      }

      if (cancelled) return;

      const micSegment = PHASE_0_SEGMENTS[2];
      await playSegmentTTS(micSegment.text);
      await persistPhase0Msg(micSegment.text, "AGENT");

      if (cancelled) return;

      phase0Ref.current = "mic_check";
      setPhase0MicCheck(true);

      micNudgeTimers.current.t15 = setTimeout(async () => {
        if (phase0Ref.current !== "mic_check") return;
        await playSegmentTTS(MIC_NUDGE_15S);
      }, 15000);

      micNudgeTimers.current.t30 = setTimeout(async () => {
        if (phase0Ref.current !== "mic_check") return;
        getStore().setInputMode("text");
        await playSegmentTTS(MIC_NUDGE_30S);
      }, 30000);
    })();

    return () => {
      cancelled = true;
      clearMicNudgeTimers();
    };
  }, [initialized, currentAct, playSegmentTTS, persistPhase0Msg, clearMicNudgeTimers]);

  // ── Nudge helper ──
  const startNudgeForCurrentAct = useCallback(() => {
    const act = getStore().currentAct;
    if (act === "PHASE_0") return;
    const ctxMap: Record<string, NudgeContext> = {
      ACT_1: "act_1",
      ACT_2: "act_2",
      ACT_3: "act_3",
    };
    const ctx = ctxMap[act];
    if (!ctx) return;
    if (getStore().activeElement) return;

    nudgeRef.current.start(ctx, {
      onNudge: (level) => {
        const s = getStore();
        if (s.isLoading || s.isTTSPlaying) return;
        if (level === "first") {
          playSegmentTTS(NUDGE_FIRST[ctx]);
        } else if (level === "second") {
          s.setInputMode("text");
          playSegmentTTS(NUDGE_SECOND[ctx]);
        } else {
          playSegmentTTS(NUDGE_FINAL[ctx]).then(() => {
            getStore().setOrbMode("processing");
            getStore().sendMessage("[NO_RESPONSE]");
          });
        }
      },
    });
  }, [playSegmentTTS]);

  // ── Message → Subtitle + TTS Pipeline ──
  useEffect(() => {
    if (messages.length === 0) return;

    let lastAssistant: typeof messages[number] | null = null;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "assistant") {
        lastAssistant = messages[i];
        break;
      }
    }

    if (!lastAssistant) return;
    if (lastAssistant.id === lastProcessedMsgId.current) return;

    if (lastAssistant.isStreaming) {
      getStore().setOrbMode("processing");
      return;
    }

    lastProcessedMsgId.current = lastAssistant.id;
    const text = lastAssistant.content;
    if (!text) return;

    const isHistory = !!lastAssistant.createdAt;

    const s = getStore();
    s.setSubtitleText(text);

    const words = text.split(/\s+/);
    const totalWords = words.length;

    if (wordRevealTimer.current) clearInterval(wordRevealTimer.current);

    if (isHistory) {
      s.setSubtitleRevealedWords(totalWords);
      s.setOrbMode("idle");
    } else {
      s.setOrbMode("speaking");

      const msPerWord = Math.max(60, Math.min(200, 6000 / totalWords));
      let revealed = 0;

      wordRevealTimer.current = setInterval(() => {
        revealed++;
        getStore().setSubtitleRevealedWords(revealed);
        if (revealed >= totalWords) {
          if (wordRevealTimer.current) clearInterval(wordRevealTimer.current);
        }
      }, msPerWord);

      if (ttsRef.current) {
        ttsRef.current.speak(text, token).then(() => {
          getStore().setSubtitleRevealedWords(totalWords);
          if (wordRevealTimer.current) clearInterval(wordRevealTimer.current);
          getStore().setOrbMode("idle");
          getStore().setAudioAmplitude(0);
          startNudgeForCurrentAct();
        }).catch(() => {
          getStore().setSubtitleRevealedWords(totalWords);
          if (wordRevealTimer.current) clearInterval(wordRevealTimer.current);
          getStore().setOrbMode("idle");
          startNudgeForCurrentAct();
        });
      }
    }
  }, [messages, token, startNudgeForCurrentAct]);

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

  // ── Handlers ──
  const handleVoiceTranscript = useCallback(
    (text: string) => {
      const s = getStore();
      s.setCandidateTranscript(text);
      s.setShowTranscript(true);
      if (transcriptTimeout.current) clearTimeout(transcriptTimeout.current);
      transcriptTimeout.current = setTimeout(() => getStore().setShowTranscript(false), 3000);

      ttsRef.current?.stop();
      nudgeRef.current.stop();

      if (phase0Ref.current === "mic_check") {
        handlePhase0Response(text);
        return;
      }

      const el = s.activeElement;
      if (el && !el.responded) {
        s.sendElementResponse({ elementType: el.elementType, value: text });
      } else {
        s.setOrbMode("processing");
        s.sendMessage(text);
      }
    },
    [handlePhase0Response],
  );

  const handleElementResponse = useCallback(
    (value: string) => {
      const s = getStore();
      const el = s.activeElement;
      if (!el) return;

      ttsRef.current?.stop();
      nudgeRef.current.stop();

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
    nudgeRef.current.stop();

    if (phase0Ref.current === "mic_check") {
      handlePhase0Response(text);
      return;
    }

    s.setOrbMode("processing");
    s.sendMessage(text);
  }, [textInput, handlePhase0Response]);

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

  const isPhase0 = currentAct === "PHASE_0";
  const isVoiceMode = isPhase0
    ? inputMode === "voice"
    : inputMode === "voice" || currentAct !== "ACT_2";
  const showInputToggle = (currentAct === "ACT_2" && !activeElement) || phase0MicCheck;
  const showInput = !isComplete && !activeElement && (!isPhase0 || phase0MicCheck);

  // Structured mode: Act 2 with an active structured element
  const isStructuredMode = currentAct === "ACT_2" && activeElement && !activeElement.responded;

  // ── Spacebar toggle for mic ──
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return;
      if (e.repeat) return;
      if (e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement) return;
      if (!showInput || !isVoiceMode || isComplete || isTTSPlaying || isLoading) return;

      e.preventDefault();
      micButtonRef.current?.click();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showInput, isVoiceMode, isComplete, isTTSPlaying, isLoading]);

  // ── Input area (shared between both modes) ──
  const renderInputArea = () => {
    if (!showInput) return null;

    return (
      <div className="flex flex-col items-center gap-3 w-full">
        {showInputToggle && (
          <InputModeToggle
            mode={inputMode}
            onToggle={(mode) => getStore().setInputMode(mode)}
          />
        )}

        {isVoiceMode ? (
          <MicButton
            ref={micButtonRef}
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
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 overflow-hidden"
      style={{ background: "#080e1a" }}
    >
      {/* Living background */}
      <LivingBackground />

      {/* Top bar */}
      <div
        className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-6 py-4"
        style={{ pointerEvents: "none" }}
      >
        {/* Client company name */}
        <span
          className="text-[10px] uppercase tracking-[2px]"
          style={{
            fontFamily: "var(--font-mono)",
            color: "rgba(184, 196, 214, 0.4)",
            pointerEvents: "auto",
          }}
        >
          {companyName}
        </span>

        {/* Session timer */}
        <span
          className="text-[11px] tabular-nums"
          style={{
            fontFamily: "var(--font-mono)",
            color: "rgba(184, 196, 214, 0.35)",
            pointerEvents: "auto",
          }}
        >
          {formatTime(elapsedSeconds)}
        </span>
      </div>

      {/* Stage content */}
      <div className="relative z-10 flex flex-col h-[100dvh]">
        {/* Progress bar (hidden during Phase 0) */}
        {!isPhase0 && (
          <div className="w-full px-6 pt-12 pb-2">
            <StageProgressBar currentAct={currentAct} />
          </div>
        )}

        {/* Main content area */}
        {isStructuredMode ? (
          // ── Structured mode: question panel left, orb + subtitle right ──
          <div
            className="flex-1 flex items-center px-6 gap-8"
            style={{
              transition: "all 800ms cubic-bezier(0.25, 0.1, 0.25, 1)",
            }}
          >
            {/* Left: Question / interactive panel */}
            <div
              className="flex-1 flex flex-col justify-center max-w-xl"
              style={{
                opacity: showElements ? 1 : 0,
                transform: showElements ? "translateY(0)" : "translateY(24px)",
                transition: "opacity 700ms cubic-bezier(0.25, 0.1, 0.25, 1), transform 700ms cubic-bezier(0.25, 0.1, 0.25, 1)",
              }}
            >
              {renderInteractiveElement()}
            </div>

            {/* Right: Compact orb + subtitle + input */}
            <div className="flex flex-col items-center gap-4 min-w-[280px]">
              <AssessmentOrb
                mode={orbMode}
                amplitude={audioAmplitude}
                compact={true}
              />

              <SubtitleDisplay
                text={subtitleText}
                revealedWords={subtitleRevealedWords}
                isRevealing={isTTSPlaying}
              />

              <CandidateTranscript
                text={candidateTranscript}
                visible={showTranscript}
              />

              {renderInputArea()}
            </div>
          </div>
        ) : (
          // ── Conversational mode: orb center-stage ──
          <div className="flex flex-col items-center flex-1 justify-center gap-4 px-4 -mt-8">
            {/* Act label (hidden during Phase 0) */}
            {!isPhase0 && <ActLabel currentAct={currentAct} />}

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

            {/* Interactive elements (conversational mode — enter below subtitles) */}
            {activeElement && !activeElement.responded && (
              <div
                className="w-full flex justify-center"
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
        )}

        {/* Bottom input area (conversational mode only — structured mode has input in sidebar) */}
        {!isStructuredMode && showInput && (
          <div className="flex flex-col items-center gap-3 pb-4 px-4 w-full">
            {renderInputArea()}
          </div>
        )}
      </div>

      {/* Bottom bar */}
      <div
        className="absolute bottom-0 left-0 right-0 z-20 flex items-center justify-between px-6 py-3"
        style={{ pointerEvents: "none" }}
      >
        {/* Security indicator */}
        <span
          className="flex items-center gap-1.5 text-[9px] uppercase tracking-[1.5px]"
          style={{
            fontFamily: "var(--font-mono)",
            color: "rgba(184, 196, 214, 0.25)",
          }}
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="opacity-40">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          Encrypted Session
        </span>

        {/* Version */}
        <span
          className="text-[9px]"
          style={{
            fontFamily: "var(--font-mono)",
            color: "rgba(184, 196, 214, 0.2)",
          }}
        >
          ACI v1.6
        </span>
      </div>

      {/* Error toast */}
      {error && (
        <div
          className="fixed bottom-12 left-1/2 -translate-x-1/2 z-30 px-4 py-2 rounded-lg"
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
  );
}

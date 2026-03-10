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
import { Phase0BreakScreen } from "./phase0-break-screen";
import { ScenarioReferenceCard } from "./scenario-reference-card";
import { TTSEngine } from "@/components/assessment/voice/tts-engine";
import { PHASE_0_SEGMENTS, MIC_NUDGE_15S, MIC_NUDGE_30S } from "@/lib/assessment/phase-0";
import { NudgeManager, NUDGE_FIRST, NUDGE_SECOND, NUDGE_FINAL, type NudgeContext } from "@/lib/assessment/nudge-system";
import {
  ORB_SIZES,
  ORB_SIZES_MOBILE,
  buildTransition1to2,
  buildTransition2to3,
  buildCompletionScript,
  type OrchestratorPhase,
  type TransitionLine,
} from "@/lib/assessment/transitions";

// ── Helpers ──

const getStore = () => useChatAssessmentStore.getState();

function isMobile(): boolean {
  return typeof window !== "undefined" && window.innerWidth < 768;
}

function getOrbSize(key: keyof typeof ORB_SIZES): number {
  return isMobile() ? ORB_SIZES_MOBILE[key] : ORB_SIZES[key];
}

// ── Component ──

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
  // ── Subscribe to display state slices (NOT messages) ──
  const currentAct = useChatAssessmentStore((s) => s.currentAct);
  const isComplete = useChatAssessmentStore((s) => s.isComplete);
  const activeElement = useChatAssessmentStore((s) => s.activeElement);
  const isLoading = useChatAssessmentStore((s) => s.isLoading);
  const error = useChatAssessmentStore((s) => s.error);
  const orbMode = useChatAssessmentStore((s) => s.orbMode);
  const orbTargetSize = useChatAssessmentStore((s) => s.orbTargetSize);
  const audioAmplitude = useChatAssessmentStore((s) => s.audioAmplitude);
  const subtitleText = useChatAssessmentStore((s) => s.subtitleText);
  const subtitleRevealedWords = useChatAssessmentStore((s) => s.subtitleRevealedWords);
  const isTTSPlaying = useChatAssessmentStore((s) => s.isTTSPlaying);
  const candidateTranscript = useChatAssessmentStore((s) => s.candidateTranscript);
  const showTranscript = useChatAssessmentStore((s) => s.showTranscript);
  const inputMode = useChatAssessmentStore((s) => s.inputMode);
  const orchestratorPhase = useChatAssessmentStore((s) => s.orchestratorPhase);
  const actProgress = useChatAssessmentStore((s) => s.actProgress);
  const referenceCard = useChatAssessmentStore((s) => s.referenceCard);
  const referenceRevealCount = useChatAssessmentStore((s) => s.referenceRevealCount);
  const displayEvent = useChatAssessmentStore((s) => s.displayEvent);
  const displayIsHistory = useChatAssessmentStore((s) => s.displayIsHistory);
  const sentenceList = useChatAssessmentStore((s) => s.sentenceList);

  // ── Local state ──
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [phase0Ready, setPhase0Ready] = useState(false);
  const [textInput, setTextInput] = useState("");
  const [showElements, setShowElements] = useState(false);
  const [phase0MicCheck, setPhase0MicCheck] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [orbGliding, setOrbGliding] = useState(false);

  // ── Refs ──
  const ttsRef = useRef<TTSEngine | null>(null);
  const micButtonRef = useRef<HTMLButtonElement>(null);
  const prevActRef = useRef<string>("ACT_1");
  const wordRevealTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const transcriptTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const phase0Ref = useRef<"idle" | "playing" | "mic_check" | "completing" | "done">("idle");
  const micNudgeTimers = useRef<{ t15?: ReturnType<typeof setTimeout>; t30?: ReturnType<typeof setTimeout> }>({});
  const nudgeRef = useRef(new NudgeManager());
  const transitionInProgress = useRef(false);
  const sentenceSequenceRef = useRef(false);

  // ── Session timer ──
  useEffect(() => {
    const interval = setInterval(() => setElapsedSeconds((s) => s + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  // ── Persist orchestrator phase to sessionStorage ──
  useEffect(() => {
    if (orchestratorPhase === "PHASE_0") return;
    try {
      sessionStorage.setItem(`aci-phase-${token}`, orchestratorPhase);
    } catch { /* unavailable */ }
  }, [orchestratorPhase, token]);

  // ── Initialize TTS engine ──
  useEffect(() => {
    const engine = new TTSEngine(
      (amplitude) => getStore().setAudioAmplitude(amplitude),
      (playing) => getStore().setTTSPlaying(playing),
      () => getStore().setTTSFallback(true),
    );
    ttsRef.current = engine;
    return () => engine.destroy();
  }, []);

  // ── Audio unlock ──
  const handleAudioUnlock = useCallback(async () => {
    if (audioUnlocked) return;
    await ttsRef.current?.resumeContext();
    setAudioUnlocked(true);
  }, [audioUnlocked]);

  // ══════════════════════════════════════════════
  // TTS & Display Helpers
  // ══════════════════════════════════════════════

  // Play a single text segment through TTS with word reveal animation.
  // Used by Phase 0, transitions, and nudges.
  const playSegmentTTS = useCallback(
    async (text: string) => {
      const s = getStore();
      s.setOrbMode("speaking");
      s.setSubtitleText(text);

      const words = text.split(/\s+/);
      let revealed = 0;
      let revealInterval: ReturnType<typeof setInterval> | null = null;

      // Start word reveal only when TTS playback begins, paced to audio duration
      const startReveal = (durationSec: number) => {
        const msPerWord = Math.max(60, (durationSec * 1000) / words.length);
        revealInterval = setInterval(() => {
          revealed++;
          getStore().setSubtitleRevealedWords(revealed);
          if (revealed >= words.length && revealInterval) clearInterval(revealInterval);
        }, msPerWord);
      };

      if (ttsRef.current) {
        const ttsTimeout = Math.max(30000, words.length * 800);
        try {
          await Promise.race([
            ttsRef.current.speak(text, token, startReveal),
            new Promise<void>((resolve) => setTimeout(() => {
              console.warn("[TTS] Safety timeout reached, continuing");
              ttsRef.current?.stop();
              resolve();
            }, ttsTimeout)),
          ]);
        } catch { /* fallback timing from word reveal */ }
      } else {
        // No TTS engine — reveal at estimated speech rate
        startReveal(words.length * 0.4);
        await new Promise<void>((resolve) => setTimeout(resolve, words.length * 400 + 200));
      }

      if (revealInterval) clearInterval(revealInterval);
      getStore().setSubtitleRevealedWords(words.length);
      getStore().setOrbMode("idle");
      getStore().setAudioAmplitude(0);
    },
    [token],
  );

  // Play subtitle text with TTS and word reveal (for Act 2/3 single responses).
  const playSubtitleWithTTS = useCallback(
    async (text: string) => {
      const s = getStore();
      s.setSubtitleText(text);

      const words = text.split(/\s+/);
      const totalWords = words.length;

      if (wordRevealTimer.current) clearInterval(wordRevealTimer.current);

      // Start word reveal only when TTS playback begins, paced to audio duration
      const startReveal = (durationSec: number) => {
        const msPerWord = Math.max(60, (durationSec * 1000) / totalWords);
        let revealed = 0;
        wordRevealTimer.current = setInterval(() => {
          revealed++;
          getStore().setSubtitleRevealedWords(revealed);
          if (revealed >= totalWords && wordRevealTimer.current) {
            clearInterval(wordRevealTimer.current);
          }
        }, msPerWord);
      };

      if (ttsRef.current) {
        const ttsTimeout = Math.max(30000, totalWords * 800);
        const ttsComplete = () => {
          getStore().setSubtitleRevealedWords(totalWords);
          if (wordRevealTimer.current) clearInterval(wordRevealTimer.current);
          getStore().setOrbMode("idle");
          getStore().setAudioAmplitude(0);
        };
        try {
          await Promise.race([
            ttsRef.current.speak(text, token, startReveal),
            new Promise<void>((resolve) => setTimeout(() => {
              ttsRef.current?.stop();
              resolve();
            }, ttsTimeout)),
          ]);
          ttsComplete();
        } catch {
          ttsComplete();
        }
      } else {
        // No TTS engine — reveal at estimated speech rate
        const estimatedDuration = totalWords * 0.4;
        startReveal(estimatedDuration);
        await new Promise<void>((resolve) => setTimeout(resolve, estimatedDuration * 1000 + 200));
        getStore().setSubtitleRevealedWords(totalWords);
        getStore().setOrbMode("idle");
        getStore().setAudioAmplitude(0);
      }
    },
    [token],
  );

  // Sentence-by-sentence sequencer for Act 1 scenarios.
  const playSentenceSequence = useCallback(
    async (sentences: string[]) => {
      sentenceSequenceRef.current = true;
      const s = getStore();
      s.setSentenceList(sentences);
      s.setOrbMode("speaking");

      for (let i = 0; i < sentences.length; i++) {
        if (!sentenceSequenceRef.current) break;

        const sentence = sentences[i];
        s.setCurrentSentenceIndex(i);
        s.setSubtitleText(sentence);

        // Progressive reveal: increment reference card sections as sentences play
        if (getStore().referenceRevealCount >= 0) {
          getStore().setReferenceRevealCount(i + 1);
        }

        const words = sentence.split(/\s+/);
        const totalWords = words.length;
        let revealInterval: ReturnType<typeof setInterval> | null = null;

        // Start word reveal only when TTS playback begins, paced to audio duration
        const startReveal = (durationSec: number) => {
          const msPerWord = Math.max(60, (durationSec * 1000) / totalWords);
          let revealed = 0;
          revealInterval = setInterval(() => {
            revealed++;
            getStore().setSubtitleRevealedWords(revealed);
            if (revealed >= totalWords && revealInterval) clearInterval(revealInterval);
          }, msPerWord);
        };

        if (ttsRef.current) {
          const ttsTimeout = Math.max(30000, totalWords * 800);
          try {
            await Promise.race([
              ttsRef.current.speak(sentence, token, startReveal),
              new Promise<void>((resolve) => setTimeout(() => {
                ttsRef.current?.stop();
                resolve();
              }, ttsTimeout)),
            ]);
          } catch { /* fallback from word reveal */ }
        } else {
          const estimatedDuration = totalWords * 0.4;
          startReveal(estimatedDuration);
          await new Promise<void>((resolve) => setTimeout(resolve, estimatedDuration * 1000 + 200));
        }

        if (revealInterval) clearInterval(revealInterval);
        getStore().setSubtitleRevealedWords(totalWords);

        // Brief pause between sentences
        if (i < sentences.length - 1 && sentenceSequenceRef.current) {
          await new Promise((r) => setTimeout(r, 400));
        }
      }

      sentenceSequenceRef.current = false;
      getStore().setOrbMode("idle");
      getStore().setAudioAmplitude(0);
      // After all sentences played, reveal everything on the card
      if (getStore().referenceRevealCount >= 0) {
        getStore().setReferenceRevealCount(-1);
      }
    },
    [token],
  );

  // Transition narration engine — plays TransitionLine[] through TTS.
  const playTransitionScript = useCallback(
    async (lines: TransitionLine[]) => {
      transitionInProgress.current = true;
      nudgeRef.current.pause();

      for (const line of lines) {
        line.onStart?.();
        await playSegmentTTS(line.text);
        line.onComplete?.();
      }

      transitionInProgress.current = false;
    },
    [playSegmentTTS],
  );

  // ══════════════════════════════════════════════
  // Nudge System
  // ══════════════════════════════════════════════

  const startNudgeForCurrentAct = useCallback(() => {
    const act = getStore().currentAct;
    if (act === "PHASE_0") return;
    if (transitionInProgress.current) return;
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
        if (transitionInProgress.current) return;
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

  // ══════════════════════════════════════════════
  // Phase 0
  // ══════════════════════════════════════════════

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

  const handlePhase0Complete = useCallback(async () => {
    phase0Ref.current = "done";

    // Fire-and-forget: tell server Phase 0 is done
    fetch(`/api/assess/${token}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ trigger: "phase_0_complete" }),
    }).catch(() => {
      console.warn("[Phase0] phase_0_complete trigger failed");
    });

    // Show break screen
    const s = getStore();
    s.setOrchestratorPhase("TRANSITION_0_1");
    s.loadHistory([], { currentAct: "ACT_1", isComplete: false });
    s.setOrbMode("idle");
    s.setOrbTargetSize(getOrbSize("FULL"));
    s.setSubtitleText("");
  }, [token]);

  const handlePhase0Response = useCallback(
    async (text: string) => {
      if (phase0Ref.current !== "mic_check") return;
      phase0Ref.current = "completing";
      setPhase0MicCheck(false);
      clearMicNudgeTimers();

      try {
        persistPhase0Msg(text, "CANDIDATE").catch(() => {});

        const confirmation = PHASE_0_SEGMENTS[3];
        await playSegmentTTS(confirmation.text);
        persistPhase0Msg(confirmation.text, "AGENT").catch(() => {});

        await handlePhase0Complete();
      } catch (err) {
        console.error("[Phase0] Transition chain failed:", err);
        if ((phase0Ref.current as string) !== "done") {
          try { await handlePhase0Complete(); } catch { /* give up */ }
        }
      }
    },
    [clearMicNudgeTimers, persistPhase0Msg, playSegmentTTS, handlePhase0Complete],
  );

  // ══════════════════════════════════════════════
  // Act Transitions
  // ══════════════════════════════════════════════

  const handleBeginAct1 = useCallback(async () => {
    // Phase 1: Glide orb from center to right side
    setOrbGliding(true);
    await new Promise((r) => setTimeout(r, 1000));

    // Phase 2: Switch to split layout (orb is already in the right position)
    const s = getStore();
    s.setOrchestratorPhase("ACT_1");
    s.setOrbMode("processing");
    s.setOrbTargetSize(getOrbSize("FULL"));
    setOrbGliding(false);

    try {
      await s.sendMessage("[BEGIN_ASSESSMENT]");
    } catch {
      console.warn("[Transition] First sendMessage failed, retrying in 2s");
      await new Promise((r) => setTimeout(r, 2000));
      try {
        await getStore().sendMessage("[BEGIN_ASSESSMENT]");
      } catch {
        console.error("[Transition] Retry failed, showing recovery UI");
        const st = getStore();
        st.setOrbMode("idle");
        st.setSubtitleText("Whenever you're ready, tap the microphone or type to begin.");
        st.setSubtitleRevealedWords(100);
      }
    }
  }, []);

  const handleTransition1to2 = useCallback(async () => {
    if (transitionInProgress.current) return;

    const s = getStore();
    s.setOrchestratorPhase("TRANSITION_1_2");
    s.setTransitioning(true);
    s.setReferenceCard(null);

    const lines = buildTransition1to2({
      onOrbCompress: () => {
        getStore().setOrbTargetSize(getOrbSize("COMPACT"));
        getStore().setOrbSize("compact");
      },
      onActLabelCrossfade: () => {},
      onTransitionComplete: () => {
        const st = getStore();
        st.setOrchestratorPhase("ACT_2");
        st.setTransitioning(false);
      },
    });

    await playTransitionScript(lines);
    getStore().sendMessage("[BEGIN_ACT_2]");
  }, [playTransitionScript]);

  const handleTransition2to3 = useCallback(async () => {
    if (transitionInProgress.current) return;

    const s = getStore();
    s.setOrchestratorPhase("TRANSITION_2_3");
    s.setTransitioning(true);
    s.setActiveElement(null);

    const lines = buildTransition2to3({
      onOrbExpand: () => {
        getStore().setOrbTargetSize(getOrbSize("FULL"));
        getStore().setOrbSize("full");
      },
      onClearInteractiveElements: () => {
        getStore().setActiveElement(null);
      },
      onActLabelCrossfade: () => {},
      onTransitionComplete: () => {
        const st = getStore();
        st.setOrchestratorPhase("ACT_3");
        st.setTransitioning(false);
      },
    });

    await playTransitionScript(lines);
    getStore().sendMessage("[BEGIN_ACT_3]");
  }, [playTransitionScript]);

  const handleCompletion = useCallback(async () => {
    if (transitionInProgress.current) return;

    const s = getStore();
    s.setOrchestratorPhase("COMPLETING");

    const lines = buildCompletionScript({
      onOrbSettle: () => {
        getStore().setOrbMode("idle");
        getStore().setAudioAmplitude(0);
      },
      onSubtitlesFadeOut: () => {
        getStore().setSubtitleText("");
      },
      onComplete: () => {
        fetch(`/api/assess/${token}/complete`, { method: "POST" }).catch(() => {});
        setTimeout(() => {
          window.location.href = `/assess/${token}/survey`;
        }, 2000);
      },
    });

    await playTransitionScript(lines);
  }, [token, playTransitionScript]);

  // ══════════════════════════════════════════════
  // Initialization
  // ══════════════════════════════════════════════

  useEffect(() => {
    if (initialized || !audioUnlocked) return;
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
            // Phase 0 already had messages — skip to Act 1
            phase0Ref.current = "done";
            prevActRef.current = "ACT_1";
            st.setOrchestratorPhase("ACT_1");
            st.setOrbMode("processing");
            st.setOrbTargetSize(getOrbSize("FULL"));
            fetch(`/api/assess/${token}/chat`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ trigger: "phase_0_complete" }),
            }).catch(() => {});
            const store = getStore();
            store.loadHistory([], { currentAct: "ACT_1", isComplete: false });
            store.sendMessage("[BEGIN_ASSESSMENT]").catch((err) => {
              console.error("[Init] sendMessage failed:", err);
              const s2 = getStore();
              s2.setOrbMode("idle");
              s2.setSubtitleText("Whenever you're ready, tap the microphone or type to begin.");
              s2.setSubtitleRevealedWords(100);
            });
            return;
          }

          // Resume from existing session
          st.loadHistory(data.messages, {
            currentAct: serverAct,
            isComplete: data.state?.isComplete ?? false,
          });

          phase0Ref.current = "done";
          prevActRef.current = serverAct;
          st.setOrchestratorPhase(serverAct as OrchestratorPhase);
          st.setOrbTargetSize(
            serverAct === "ACT_2" ? getOrbSize("COMPACT") : getOrbSize("FULL")
          );

          const lastAssistant = [...data.messages]
            .reverse()
            .find((m: { role: string }) => m.role === "assistant");
          if (lastAssistant) {
            st.displayMessage(lastAssistant.content, serverAct, true);
          }
          st.setOrbMode("idle");
        } else {
          st.loadHistory([], { currentAct: serverAct, isComplete: false });
          prevActRef.current = serverAct;
          if (serverAct === "PHASE_0") {
            st.setOrchestratorPhase("PHASE_0");
            setPhase0Ready(true);
          } else {
            st.setOrchestratorPhase(serverAct as OrchestratorPhase);
            phase0Ref.current = "done";
          }
          st.setOrbTargetSize(getOrbSize("FULL"));
          st.setOrbMode("idle");
        }
      })
      .catch(() => {
        getStore().setOrbMode("idle");
      });
  }, [token, assessmentId, initialized, audioUnlocked]);

  // ══════════════════════════════════════════════
  // Phase 0 Orchestration
  // ══════════════════════════════════════════════

  useEffect(() => {
    if (!phase0Ready || orchestratorPhase !== "PHASE_0" || phase0Ref.current !== "idle") return;

    let cancelled = false;
    phase0Ref.current = "playing";

    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

    (async () => {
      try {
        for (const segment of PHASE_0_SEGMENTS.slice(0, 2)) {
          if (cancelled) return;
          await playSegmentTTS(segment.text);
          if (cancelled) return;
          persistPhase0Msg(segment.text, "AGENT").catch(() => {});
          if (segment.pauseAfterMs) await sleep(segment.pauseAfterMs);
        }

        if (cancelled) return;

        const micSegment = PHASE_0_SEGMENTS[2];
        await playSegmentTTS(micSegment.text);
        if (cancelled) return;
        persistPhase0Msg(micSegment.text, "AGENT").catch(() => {});

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
      } catch (err) {
        console.error("[Phase0] Orchestration error:", err);
        if (!cancelled && phase0Ref.current !== "done") {
          handlePhase0Complete();
        }
      }
    })();

    return () => {
      cancelled = true;
      clearMicNudgeTimers();
      ttsRef.current?.stop();
    };
  }, [phase0Ready, orchestratorPhase, playSegmentTTS, persistPhase0Msg, clearMicNudgeTimers, handlePhase0Complete]);

  // ══════════════════════════════════════════════
  // TTS Trigger — watches displayEvent (not messages)
  // ══════════════════════════════════════════════

  useEffect(() => {
    if (displayEvent === 0) return;
    if (displayIsHistory) return;
    if (transitionInProgress.current) return;

    if (sentenceList.length > 1) {
      playSentenceSequence(sentenceList).then(() => startNudgeForCurrentAct());
    } else if (subtitleText) {
      playSubtitleWithTTS(subtitleText).then(() => startNudgeForCurrentAct());
    }
  }, [displayEvent]); // eslint-disable-line react-hooks/exhaustive-deps

  // ══════════════════════════════════════════════
  // Act Transition Detection
  // ══════════════════════════════════════════════

  useEffect(() => {
    if (currentAct === prevActRef.current) return;
    const prevAct = prevActRef.current;
    prevActRef.current = currentAct;

    if (transitionInProgress.current) return;

    if (prevAct === "PHASE_0" && currentAct === "ACT_1") {
      // Handled by handlePhase0Complete
    } else if (prevAct === "ACT_1" && currentAct === "ACT_2") {
      handleTransition1to2();
    } else if (prevAct === "ACT_2" && currentAct === "ACT_3") {
      handleTransition2to3();
    } else {
      const s = getStore();
      s.setOrchestratorPhase(currentAct as OrchestratorPhase);
      s.setOrbTargetSize(
        currentAct === "ACT_2" ? getOrbSize("COMPACT") : getOrbSize("FULL")
      );
      s.setOrbSize(currentAct === "ACT_2" ? "compact" : "full");
    }
  }, [currentAct, handleTransition1to2, handleTransition2to3]);

  // ── Completion detection ──
  useEffect(() => {
    if (!isComplete) return;
    handleCompletion();
  }, [isComplete, handleCompletion]);

  // ── Interactive element appearance ──
  useEffect(() => {
    if (activeElement && !activeElement.responded) {
      const timer = setTimeout(() => setShowElements(true), 300);
      return () => clearTimeout(timer);
    } else {
      setShowElements(false);
    }
  }, [activeElement]);

  // ── Orb size in Act 2 ──
  useEffect(() => {
    if (orchestratorPhase !== "ACT_2") return;
    if (activeElement && !activeElement.responded) {
      getStore().setOrbTargetSize(getOrbSize("COMPACT"));
    } else if (!activeElement) {
      getStore().setOrbTargetSize(getOrbSize("VOICE_PROBE"));
    }
  }, [orchestratorPhase, activeElement]);

  // ── Spacebar toggle for mic ──
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code !== "Space") return;
      if (e.repeat) return;
      if (e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement) return;
      if (!showInput || !isVoiceMode || isComplete || isTTSPlaying || isLoading) return;
      e.preventDefault();
      micButtonRef.current?.click();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isComplete, isTTSPlaying, isLoading]); // showInput and isVoiceMode checked inline

  // ══════════════════════════════════════════════
  // Handlers
  // ══════════════════════════════════════════════

  const handleVoiceTranscript = useCallback(
    (text: string) => {
      const s = getStore();
      s.setCandidateTranscript(text);
      s.setShowTranscript(true);
      if (transcriptTimeout.current) clearTimeout(transcriptTimeout.current);
      transcriptTimeout.current = setTimeout(() => getStore().setShowTranscript(false), 3000);

      ttsRef.current?.stop();
      nudgeRef.current.stop();
      sentenceSequenceRef.current = false;

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

  const handleElementResponse = useCallback((value: string) => {
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
  }, []);

  const handleTextSend = useCallback(() => {
    const text = textInput.trim();
    if (!text) return;
    const s = getStore();
    if (s.isLoading) return;
    setTextInput("");

    ttsRef.current?.stop();
    nudgeRef.current.stop();
    sentenceSequenceRef.current = false;

    if (phase0Ref.current === "mic_check") {
      handlePhase0Response(text);
      return;
    }

    s.setOrbMode("processing");
    s.sendMessage(text);
  }, [textInput, handlePhase0Response]);

  const handleListeningChange = useCallback((listening: boolean) => {
    const s = getStore();
    s.setVoiceListening(listening);
    if (listening) {
      ttsRef.current?.stop();
      s.setOrbMode("listening");
    } else if (!s.isLoading) {
      s.setOrbMode("idle");
    }
  }, []);

  // ══════════════════════════════════════════════
  // Render Helpers
  // ══════════════════════════════════════════════

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

  // ── Visibility logic ──
  const isPhase0 = orchestratorPhase === "PHASE_0";
  const isBreak = orchestratorPhase === "TRANSITION_0_1";
  const isTransition = orchestratorPhase === "TRANSITION_0_1" ||
    orchestratorPhase === "TRANSITION_1_2" ||
    orchestratorPhase === "TRANSITION_2_3" ||
    orchestratorPhase === "COMPLETING";
  const showProgressBar = !isPhase0;
  const showActLabel = !isPhase0 && !isBreak;

  const isVoiceMode = isPhase0
    ? inputMode === "voice"
    : inputMode === "voice" || currentAct !== "ACT_2";
  const showInputToggle = (currentAct === "ACT_2" && !activeElement) || phase0MicCheck;
  const showInput = !isComplete && !isTransition && !activeElement && (!isPhase0 || phase0MicCheck);

  const isStructuredMode = orchestratorPhase === "ACT_2" && activeElement && !activeElement.responded;

  // Act 1 split layout: reference card left, Aria right
  const isScenarioMode = orchestratorPhase === "ACT_1" && !isTransition;

  // ── Input area ──
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

  // ══════════════════════════════════════════════
  // Render
  // ══════════════════════════════════════════════

  return (
    <div
      className="fixed inset-0 z-50 overflow-hidden"
      style={{ background: "#080e1a" }}
    >
      {/* Audio unlock gate */}
      {!audioUnlocked && (
        <button
          className="absolute inset-0 z-[100] flex flex-col items-center justify-center cursor-pointer border-none"
          onClick={handleAudioUnlock}
          aria-label="Begin assessment — audio required"
          autoFocus
          style={{ background: "rgba(8, 14, 26, 0.95)" }}
        >
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center mb-6"
            style={{
              background: "rgba(37, 99, 235, 0.12)",
              border: "1px solid rgba(37, 99, 235, 0.25)",
            }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="rgba(37, 99, 235, 0.8)" strokeWidth="2">
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
          </div>
          <p
            className="text-sm text-center"
            style={{
              fontFamily: "var(--font-display)",
              color: "rgba(184, 196, 214, 0.7)",
              fontWeight: 300,
            }}
          >
            Tap to begin your assessment
          </p>
          <p
            className="text-[10px] mt-2"
            style={{
              fontFamily: "var(--font-mono)",
              color: "rgba(184, 196, 214, 0.3)",
              letterSpacing: "1.5px",
              textTransform: "uppercase",
            }}
          >
            Audio required
          </p>
        </button>
      )}

      {/* Living background */}
      <LivingBackground />

      {/* Top bar */}
      <div
        className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-6 py-4"
        style={{ pointerEvents: "none" }}
      >
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
        {/* Progress bar */}
        <div className="w-full px-6 pt-12 pb-2 relative z-20">
          <StageProgressBar
            currentAct={currentAct}
            orchestratorPhase={orchestratorPhase}
            actProgress={actProgress}
            visible={showProgressBar}
          />
        </div>

        {/* Main content — three layout modes */}
        {isScenarioMode ? (
          /* ── Act 1 Scenario Mode: Reference card left, Aria right ── */
          <div className="flex-1 flex">
            {/* LEFT: Reference Card */}
            <div
              className="overflow-y-auto"
              style={{
                flex: "0 0 42%",
                padding: "24px 20px 24px 32px",
                scrollbarWidth: "none",
              }}
            >
              <ScenarioReferenceCard reference={referenceCard} revealCount={referenceRevealCount} />
            </div>

            {/* Subtle divider */}
            <div
              style={{
                width: "1px",
                background: "rgba(255, 255, 255, 0.03)",
                margin: "24px 0",
              }}
            />

            {/* RIGHT: Aria (orb + subtitle + input) */}
            <div className="flex-1 relative">
              {/* Act label */}
              <div
                className="absolute left-0 right-0 flex justify-center z-10"
                style={{ top: "calc(35% - 120px)" }}
              >
                <ActLabel currentAct={currentAct} visible={showActLabel} />
              </div>

              {/* Orb — centered in right panel */}
              <div
                className="absolute left-1/2"
                style={{ top: "35%", transform: "translate(-50%, -50%)", zIndex: 1 }}
              >
                <AssessmentOrb
                  mode={orbMode}
                  amplitude={audioAmplitude}
                  targetSize={orbTargetSize}
                />
              </div>

              {/* Subtitles — below orb */}
              <div
                className="absolute left-0 right-0 flex flex-col items-center gap-2 px-6 overflow-y-auto"
                style={{
                  top: "calc(35% + 140px)",
                  zIndex: 2,
                  bottom: showInput ? "100px" : "48px",
                  maskImage: "linear-gradient(to bottom, black 80%, transparent)",
                  WebkitMaskImage: "linear-gradient(to bottom, black 80%, transparent)",
                }}
              >
                <SubtitleDisplay
                  text={subtitleText}
                  revealedWords={subtitleRevealedWords}
                  isRevealing={isTTSPlaying}
                />
                <CandidateTranscript
                  text={candidateTranscript}
                  visible={showTranscript}
                />
              </div>

              {/* Input — pinned to bottom of right panel */}
              {showInput && (
                <div
                  className="absolute left-0 right-0 bottom-0 flex flex-col items-center gap-3 pb-4 px-4"
                  style={{ transition: "opacity 300ms ease" }}
                >
                  {renderInputArea()}
                </div>
              )}
            </div>
          </div>

        ) : isStructuredMode ? (
          /* ── Act 2 Structured Mode: interactive element left, orb right ── */
          <div
            className="flex-1 flex items-center px-6 gap-8"
            style={{ transition: "all 800ms cubic-bezier(0.25, 0.1, 0.25, 1)" }}
          >
            {/* Left: Question panel */}
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
                targetSize={orbTargetSize}
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
          /* ── Centered conversational mode: Phase 0, Act 3, transitions ── */
          <div className="relative flex-1">
            {/* Act label — above orb center */}
            <div
              className="absolute left-0 right-0 flex justify-center z-10"
              style={{ top: "calc(38% - 130px)" }}
            >
              <ActLabel currentAct={currentAct} visible={showActLabel} />
            </div>

            {/* Orb — center anchor, glides to right side when transitioning to Act 1 */}
            <div
              className="absolute"
              style={{
                top: orbGliding ? "35%" : "38%",
                left: orbGliding ? "71%" : "50%",
                transform: "translate(-50%, -50%)",
                zIndex: 1,
                transition: "top 1000ms cubic-bezier(0.25, 0.1, 0.25, 1), left 1000ms cubic-bezier(0.25, 0.1, 0.25, 1)",
              }}
            >
              <AssessmentOrb
                mode={orbMode}
                amplitude={audioAmplitude}
                targetSize={orbTargetSize}
              />
            </div>

            {/* Break screen — below orb, replaces subtitles during TRANSITION_0_1 */}
            {isBreak && !orbGliding && (
              <Phase0BreakScreen
                duration={20}
                onContinue={handleBeginAct1}
                visible={true}
              />
            )}

            {/* Subtitles — below orb, absolutely positioned, scrollable */}
            {!isBreak && (
              <div
                className="absolute left-0 right-0 flex flex-col items-center gap-2 px-4 overflow-y-auto"
                style={{
                  top: "calc(38% + 140px)",
                  zIndex: 2,
                  bottom: showInput ? "100px" : "48px",
                  maskImage: "linear-gradient(to bottom, black 80%, transparent)",
                  WebkitMaskImage: "linear-gradient(to bottom, black 80%, transparent)",
                }}
              >
                <SubtitleDisplay
                  text={subtitleText}
                  revealedWords={subtitleRevealedWords}
                  isRevealing={isTTSPlaying}
                />
                <CandidateTranscript
                  text={candidateTranscript}
                  visible={showTranscript}
                />
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

            {/* Input — pinned to bottom, never pushes anything */}
            {showInput && (
              <div
                className="absolute left-0 right-0 bottom-0 flex flex-col items-center gap-3 pb-4 px-4"
                style={{ transition: "opacity 300ms ease" }}
              >
                {renderInputArea()}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom bar */}
      <div
        className="absolute bottom-0 left-0 right-0 z-20 flex items-center justify-between px-6 py-3"
        style={{ pointerEvents: "none" }}
      >
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
        <span
          className="text-[9px]"
          style={{
            fontFamily: "var(--font-mono)",
            color: "rgba(184, 196, 214, 0.2)",
          }}
        >
          ACI v1.9
        </span>
      </div>

      {/* Error toast */}
      {error && (
        <div
          role="alert"
          className="fixed bottom-12 left-1/2 -translate-x-1/2 z-30 px-4 py-2 rounded-lg flex items-center gap-3"
          style={{
            background: "rgba(220, 38, 38, 0.15)",
            border: "1px solid rgba(220, 38, 38, 0.3)",
            color: "#fca5a5",
            fontSize: "12px",
            fontFamily: "var(--font-display)",
          }}
        >
          <span>Something went wrong. Please try again.</span>
          <button
            onClick={() => getStore().setSubtitleText("")}
            aria-label="Dismiss error"
            style={{
              color: "rgba(252, 165, 165, 0.6)",
              cursor: "pointer",
              padding: "2px",
              background: "none",
              border: "none",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}

"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useChatAssessmentStore } from "@/stores/chat-assessment-store";
import { LivingBackground } from "@/components/assessment/background/living-background";
import { OfflineOverlay } from "@/components/assessment/offline-overlay";
import { AssessmentOrb } from "@/components/assessment/orb/assessment-orb";
import { StageProgressBar } from "./progress-bar";
import { ActLabel } from "./act-label";
import { SubtitleDisplay } from "./subtitle-display";
import { CandidateTranscript } from "./candidate-transcript";
import { InputModeToggle } from "./input-mode-toggle";
import { InteractiveRenderer } from "@/components/assessment/interactive/interactive-renderer";
import { usePhase0 } from "./hooks/use-phase0";
import { MicButton } from "@/components/assessment/voice/mic-button";
import { Phase0BreakScreen } from "./phase0-break-screen";
import { ScenarioReferenceCard } from "./scenario-reference-card";
import { AriaSidebar } from "./aria-sidebar";
import { TransitionScreen } from "./transition-screen";
import { CompletionScreen } from "./completion-screen";
import { CenteredLayout } from "@/components/assessment/layouts/centered-layout";
import { ReferenceSplitLayout } from "@/components/assessment/layouts/reference-split-layout";
import { InteractiveSplitLayout } from "@/components/assessment/layouts/interactive-split-layout";
import { ConfidenceLayout } from "@/components/assessment/layouts/confidence-layout";
import { resolveFormat, type AssessmentFormat } from "@/lib/assessment/format-resolver";
import { TTSEngine } from "@/components/assessment/voice/tts-engine";
import { getPhase0Segments, MIC_NUDGE_15S, MIC_NUDGE_30S } from "@/lib/assessment/phase-0";
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
import { TurnPlayer } from "./turn-player";
import { ComponentErrorBoundary } from "@/components/assessment/error-boundary";
import { FEATURE_FLAGS } from "@/lib/assessment/config";

const __DEBUG = process.env.NODE_ENV !== "production";

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
  candidateName,
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
  const lastTurn = useChatAssessmentStore((s) => s.lastTurn);

  // ── Local state ──
  const [deliveryCancelToken, setDeliveryCancelToken] = useState(0);
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [phase0Ready, setPhase0Ready] = useState(false);
  const [textInput, setTextInput] = useState("");
  const [showElements, setShowElements] = useState(false);
  const [phase0MicCheck, setPhase0MicCheck] = useState(false);
  // Fix: PRO-23 — persist assessment start time to sessionStorage for reload recovery
  const [elapsedSeconds, setElapsedSeconds] = useState(() => {
    if (typeof window === "undefined") return 0;
    const stored = sessionStorage.getItem(`aci-start-${token}`);
    if (stored) {
      return Math.floor((Date.now() - Number(stored)) / 1000);
    }
    sessionStorage.setItem(`aci-start-${token}`, String(Date.now()));
    return 0;
  });
  const [orbGliding, setOrbGliding] = useState(false);
  const [layoutOpacity, setLayoutOpacity] = useState(1);
  const [showCompletionScreen, setShowCompletionScreen] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(true);

  // ── Refs ──
  const ttsRef = useRef<TTSEngine | null>(null);
  const micButtonRef = useRef<HTMLButtonElement>(null);
  const prevActRef = useRef<string>("ACT_1");
  const wordRevealTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const transcriptTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  // phase0Ref and micNudgeTimers are owned by usePhase0 hook
  const nudgeRef = useRef(new NudgeManager());
  const transitionInProgress = useRef(false);
  const ttsSequenceActiveRef = useRef(false);
  const sequenceIdRef = useRef(0);
  const justTransitionedRef = useRef(false);
  const lastFailedMessageRef = useRef<string | null>(null);
  // Fix: PRO-14 — store last failed element response for retry
  const lastFailedElementRef = useRef<{ elementType: string; value: string; itemId?: string; construct?: string } | null>(null);

  // ── Detect speech recognition support — auto-switch to text if unavailable ──
  useEffect(() => {
    const hasSpeech =
      typeof window !== "undefined" &&
      ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);
    setSpeechSupported(hasSpeech);
    if (!hasSpeech) {
      getStore().setInputMode("text");
    }
  }, []);

  // ── Session timer ──
  useEffect(() => {
    const interval = setInterval(() => setElapsedSeconds((s) => s + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  // ── Warn before tab close during active assessment ──
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (isComplete || orchestratorPhase === "COMPLETING") return;
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isComplete, orchestratorPhase]);

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

  // ── Auto-unlock audio on mount (user already interacted on welcome page) ──
  useEffect(() => {
    if (audioUnlocked) return;
    const unlock = async () => {
      await ttsRef.current?.resumeContext();
      setAudioUnlocked(true);
    };
    // Small delay to ensure TTS engine is initialized
    const timer = setTimeout(unlock, 200);
    return () => clearTimeout(timer);
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
      s.setSubtitleRevealedWords(0);

      const words = text.split(/\s+/);
      let revealed = 0;
      let revealInterval: ReturnType<typeof setInterval> | null = null;

      // Start a slow pre-reveal immediately so words begin appearing while TTS loads
      const estimatedMsPerWord = 350; // ~170 wpm reading pace
      revealInterval = setInterval(() => {
        revealed++;
        getStore().setSubtitleRevealedWords(revealed);
        if (revealed >= words.length && revealInterval) clearInterval(revealInterval);
      }, estimatedMsPerWord);

      // Once TTS playback begins, re-sync reveal pacing to audio duration
      const syncReveal = (durationSec: number) => {
        if (revealInterval) clearInterval(revealInterval);
        const remaining = words.length - revealed;
        if (remaining <= 0) return;
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
          let safetyTimeoutId: ReturnType<typeof setTimeout>;
          await Promise.race([
            ttsRef.current.speak(text, token, syncReveal).finally(() => clearTimeout(safetyTimeoutId)),
            new Promise<void>((resolve) => {
              safetyTimeoutId = setTimeout(() => {
                console.warn("[TTS] Safety timeout reached, continuing");
                ttsRef.current?.stop();
                resolve();
              }, ttsTimeout);
            }),
          ]);
        } catch { /* fallback timing from word reveal */ }
      } else {
        // No TTS engine — pre-reveal interval already running at estimated pace
        await new Promise<void>((resolve) => setTimeout(resolve, words.length * 400 + 200));
      }

      if (revealInterval) clearInterval(revealInterval);
      getStore().setSubtitleRevealedWords(words.length);
      getStore().setOrbMode("idle");
      getStore().setAudioAmplitude(0);
      getStore().setTTSPlaying(false);
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
          getStore().setTTSPlaying(false);
        };
        try {
          let safetyTimeoutId: ReturnType<typeof setTimeout>;
          await Promise.race([
            ttsRef.current.speak(text, token, startReveal).finally(() => clearTimeout(safetyTimeoutId)),
            new Promise<void>((resolve) => {
              safetyTimeoutId = setTimeout(() => {
                ttsRef.current?.stop();
                resolve();
              }, ttsTimeout);
            }),
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
        getStore().setTTSPlaying(false);
      }

      // Safety net: if a reference card was set for progressive reveal but this
      // fallback path ran instead of playSentenceSequence, show all sections now
      if (getStore().referenceRevealCount >= 0) {
        getStore().setReferenceRevealCount(-1);
      }
    },
    [token],
  );

  // Sentence-by-sentence sequencer for Act 1 scenarios.
  const playSentenceSequence = useCallback(
    async (sentences: string[]) => {
      // Filter out fragments that would produce bad TTS (e.g. lone numbers/units)
      const validSentences = sentences.filter((s) => {
        const words = s.trim().split(/\s+/);
        return words.length >= 2 && !/^\d+[°%]?$/.test(s.trim());
      });
      if (validSentences.length === 0) {
        console.warn("[TTS] No valid sentences after filtering", { original: sentences });
        return;
      }

      const myId = ++sequenceIdRef.current;
      ttsSequenceActiveRef.current = true;
      const s = getStore();
      s.setSentenceList(validSentences);
      s.setOrbMode("speaking");

      for (let i = 0; i < validSentences.length; i++) {
        if (sequenceIdRef.current !== myId) break;

        const sentenceStart = Date.now();
        const sentence = validSentences[i];
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
          // Pre-fetch next sentence while current one plays (N+1 lookahead)
          if (i + 1 < validSentences.length) {
            ttsRef.current.prefetch(validSentences[i + 1], token);
          }

          try {
            await ttsRef.current.speak(sentence, token, startReveal, true);
          } catch { /* TTS error — word reveal already started, continue to next sentence */ }
        } else {
          const estimatedDuration = totalWords * 0.4;
          startReveal(estimatedDuration);
          await new Promise<void>((resolve) => setTimeout(resolve, estimatedDuration * 1000 + 200));
        }

        if (revealInterval) clearInterval(revealInterval);
        getStore().setSubtitleRevealedWords(totalWords);

        // Enforce minimum time per sentence so card reveal feels progressive
        // even when TTS fails or resolves instantly
        const MIN_SENTENCE_MS = 2500;
        const elapsed = Date.now() - sentenceStart;
        if (elapsed < MIN_SENTENCE_MS && i < validSentences.length - 1) {
          await new Promise((r) => setTimeout(r, MIN_SENTENCE_MS - elapsed));
        }

        // Brief pause between sentences
        if (i < validSentences.length - 1 && sequenceIdRef.current === myId) {
          await new Promise((r) => setTimeout(r, 150));
        }
      }

      // Only clean up if this sequence is still the active one
      if (sequenceIdRef.current === myId) {
        getStore().setOrbMode("idle");
        getStore().setAudioAmplitude(0);
        getStore().setTTSPlaying(false);
        // After all sentences played, reveal everything on the card
        if (getStore().referenceRevealCount >= 0) {
          getStore().setReferenceRevealCount(-1);
        }
      }
      ttsSequenceActiveRef.current = false;
    },
    [token],
  );

  // Transition narration engine — plays TransitionLine[] through TTS.
  const playTransitionScript = useCallback(
    async (lines: TransitionLine[]) => {
      transitionInProgress.current = true;
      ttsSequenceActiveRef.current = true;
      nudgeRef.current.pause();

      for (const line of lines) {
        line.onStart?.();
        await playSegmentTTS(line.text);
        line.onComplete?.();
      }

      transitionInProgress.current = false;
      ttsSequenceActiveRef.current = false;
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
    const el = getStore().activeElement;
    if (el && el.responded) return;

    nudgeRef.current.start(ctx, {
      onNudge: (level) => {
        const s = getStore();
        if (s.isLoading || s.isTTSPlaying) {
          __DEBUG && console.log(`[NUDGE-TRACE] Nudge ${level} DROPPED | isLoading=${s.isLoading} isTTSPlaying=${s.isTTSPlaying}`);
          return;
        }
        if (transitionInProgress.current) {
          __DEBUG && console.log(`[NUDGE-TRACE] Nudge ${level} DROPPED | transitionInProgress=true`);
          return;
        }
        if (level === "first") {
          playSegmentTTS(NUDGE_FIRST[ctx]);
        } else if (level === "second") {
          playSegmentTTS(NUDGE_SECOND[ctx]);
        } else {
          __DEBUG && console.log(`[NUDGE-TRACE] Sending [NO_RESPONSE] | ctx=${ctx}`);
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

  const phase0Segments = useMemo(
    () => getPhase0Segments(candidateName, companyName),
    [candidateName, companyName],
  );

  const {
    persistPhase0Msg,
    clearMicNudgeTimers,
    handlePhase0Complete,
    handlePhase0Response,
    phase0Ref,
    micNudgeTimers,
  } = usePhase0({ token, playSegmentTTS, getOrbSize, setPhase0MicCheck, confirmationText: phase0Segments[3].text });

  // ══════════════════════════════════════════════
  // Act Transitions
  // ══════════════════════════════════════════════

  const handleBeginAct1 = useCallback(async () => {
    if (transitionInProgress.current) return;
    transitionInProgress.current = true;

    try {
      const s = getStore();

      // Phase 0: Show TRANSITION_0_1 screen (3-dot transition) for 2 seconds
      s.setOrchestratorPhase("TRANSITION_0_1");
      await new Promise((r) => setTimeout(r, 2000));

      // Phase 1: Glide orb from center → sidebar position + shrink to sidebar size (88px)
      s.setOrbTargetSize(88);
      s.setOrbMode("speaking");
      setOrbGliding(true);
      await new Promise((r) => setTimeout(r, 1200));

      // Phase 2: Fade out the centered layout
      setLayoutOpacity(0);
      await new Promise((r) => setTimeout(r, 600));

      // Phase 3: Switch to split layout while invisible (opacity is 0)
      s.setOrchestratorPhase("ACT_1");
      setOrbGliding(false);

      // Wait two frames so browser paints the new layout at opacity 0
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

      // Phase 4: Fade in the split layout (AriaSidebar now visible)
      setLayoutOpacity(1);

      // Phase 5: Play warm-up narration — subtitles now render in AriaSidebar
      try {
        const { ACT1_WARMUP_LINES } = await import("@/lib/assessment/transitions");
        await playSentenceSequence(ACT1_WARMUP_LINES);
      } catch {
        // If TTS warm-up fails, continue to assessment
      }

      // Phase 6: Begin assessment
      s.setOrbMode("processing");
      try {
        await getStore().sendMessage("[BEGIN_ASSESSMENT]");
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
    } finally {
      transitionInProgress.current = false;
    }
  }, [playSentenceSequence]);

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
        justTransitionedRef.current = true;
        st.setOrchestratorPhase("ACT_2");
        st.setTransitioning(false);
        // Nudge starts in onDeliveryComplete after the first Act 2 question plays (PRD §7.7)
      },
    });

    await playTransitionScript(lines);
    // Fix: PRO-12 — await sendMessage and handle failure with error toast + retry
    try {
      await getStore().sendMessage("[BEGIN_ACT_2]");
    } catch {
      lastFailedMessageRef.current = "[BEGIN_ACT_2]";
      useChatAssessmentStore.setState({ error: "Connection issue — tap to retry" });
    }
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
        justTransitionedRef.current = true;
        st.setOrchestratorPhase("ACT_3");
        st.setTransitioning(false);
        // Nudge starts in onDeliveryComplete after the first Act 3 question plays (PRD §7.7)
      },
    });

    await playTransitionScript(lines);
    // Fix: PRO-12 — await sendMessage and handle failure with error toast + retry
    try {
      await getStore().sendMessage("[BEGIN_ACT_3]");
    } catch {
      lastFailedMessageRef.current = "[BEGIN_ACT_3]";
      useChatAssessmentStore.setState({ error: "Connection issue — tap to retry" });
    }
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
        setShowCompletionScreen(true);
      },
      onComplete: async () => {
        // Fix: PRO-13 — retry completion POST with error handling instead of fire-and-forget
        let succeeded = false;
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            const res = await fetch(`/api/assess/${token}/complete`, { method: "POST" });
            if (res.ok) { succeeded = true; break; }
          } catch { /* retry */ }
          if (attempt < 2) await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
        }
        if (succeeded) {
          setTimeout(() => { window.location.href = `/assess/${token}/survey`; }, 4000);
        } else {
          useChatAssessmentStore.setState({ error: "Something went wrong — tap to try again" });
          lastFailedMessageRef.current = "__COMPLETE__";
        }
      },
    }, candidateName);

    await playTransitionScript(lines);
  }, [token, playTransitionScript, candidateName]);

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
            progress: data.state?.progress,
          });

          // P-2: restore reference card on recovery so ScenarioReferenceCard renders
          if (data.lastReferenceCard) {
            st.setReferenceCard({ ...data.lastReferenceCard, newInformation: [] });
            st.setReferenceRevealCount(-1); // show all sections immediately
          }

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
  }, [token, assessmentId, initialized, audioUnlocked]); // eslint-disable-line react-hooks/exhaustive-deps -- phase0Ref is a stable ref

  // Safety reset: if isLoading gets stuck (network hang, double-lock), force-clear after 75s.
  // Max legitimate duration: 2×30s attempts + 2s delay = 62s; 75s gives sufficient headroom.
  useEffect(() => {
    if (!isLoading) return;
    const id = setTimeout(() => {
      const s = getStore();
      if (s.isLoading) {
        console.warn("[SAFETY] isLoading stuck for 75s — force reset");
        const msgs = s.messages;
        const trimmed =
          msgs.length > 0 && msgs[msgs.length - 1].role === "assistant" && !msgs[msgs.length - 1].content
            ? msgs.slice(0, -1)
            : msgs;
        useChatAssessmentStore.setState({
          isLoading: false,
          orbMode: "idle",
          error: "Request timed out. Please try again.",
          messages: trimmed,
        });
      }
    }, 75_000);
    return () => clearTimeout(id);
  }, [isLoading]);

  // ══════════════════════════════════════════════
  // Phase 0 Orchestration
  // ══════════════════════════════════════════════

  useEffect(() => {
    if (!phase0Ready || orchestratorPhase !== "PHASE_0" || phase0Ref.current !== "idle") return;

    let cancelled = false;
    phase0Ref.current = "playing";

    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

    (async () => {
      ttsSequenceActiveRef.current = true;
      try {
        for (const segment of phase0Segments.slice(0, 2)) {
          if (cancelled) return;
          await playSegmentTTS(segment.text);
          if (cancelled) return;
          persistPhase0Msg(segment.text, "AGENT").catch(() => {});
          if (segment.pauseAfterMs) await sleep(segment.pauseAfterMs);
        }

        if (cancelled) return;

        const micSegment = phase0Segments[2];
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
          await playSegmentTTS(MIC_NUDGE_30S);
        }, 30000);
      } catch (err) {
        console.error("[Phase0] Orchestration error:", err);
        if (!cancelled && phase0Ref.current !== "done") {
          handlePhase0Complete();
        }
      } finally {
        ttsSequenceActiveRef.current = false;
      }
    })();

    return () => {
      cancelled = true;
      clearMicNudgeTimers();
      ttsRef.current?.stop();
    };
  }, [phase0Ready, orchestratorPhase, playSegmentTTS, persistPhase0Msg, clearMicNudgeTimers, handlePhase0Complete, phase0Segments]); // eslint-disable-line react-hooks/exhaustive-deps -- phase0Ref, micNudgeTimers are stable refs

  // ══════════════════════════════════════════════
  // TTS Trigger — watches displayEvent (not messages)
  // Only active when TurnPlayer is OFF (FEATURE_FLAGS.TURN_PLAYER = false).
  // When TurnPlayer is ON, the dep array is [] — React runs this once on mount
  // (where displayEvent === 0, so it returns immediately) and never again.
  // This structural prevention is stronger than an early-return guard: the effect
  // is never scheduled, never invoked, and produces no log noise per turn.
  // ══════════════════════════════════════════════

  useEffect(() => {
    if (displayEvent === 0) return;
    if (displayIsHistory) return;
    if (transitionInProgress.current) return;

    // During Phase 0, orchestration owns TTS — ignore displayEvent entirely
    if (orchestratorPhase === "PHASE_0" || orchestratorPhase === "TRANSITION_0_1") return;

    // If a sentence sequence is actively driving TTS, don't start a competing one.
    // A second playSentenceSequence would increment sequenceIdRef, causing the first
    // to break out mid-sentence — the root cause of "skippy" audio.
    if (ttsSequenceActiveRef.current) {
      return;
    }
    ttsRef.current?.stop();

    if (sentenceList.length >= 1) {
      playSentenceSequence(sentenceList).then(() => startNudgeForCurrentAct());
    } else if (subtitleText) {
      playSubtitleWithTTS(subtitleText).then(() => startNudgeForCurrentAct());
    }
  // When TURN_PLAYER is on (the constant is true), pass [] so React never re-schedules
  // this effect. When off, subscribe to displayEvent as before.
  }, FEATURE_FLAGS.TURN_PLAYER ? [] : [displayEvent]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // ── Interactive element appearance + nudge management ──
  useEffect(() => {
    if (activeElement && !activeElement.responded) {
      const timer = setTimeout(() => setShowElements(true), 300);
      // Start nudge for unanswered element
      startNudgeForCurrentAct();
      return () => clearTimeout(timer);
    } else {
      setShowElements(false);
      // Stop nudge when element is answered or cleared
      if (!activeElement) {
        nudgeRef.current.stop();
      }
    }
  }, [activeElement, startNudgeForCurrentAct]);

  // ── Orb size in Act 2 ──
  useEffect(() => {
    if (orchestratorPhase !== "ACT_2") return;
    if (activeElement && !activeElement.responded) {
      justTransitionedRef.current = false;
      getStore().setOrbTargetSize(getOrbSize("COMPACT"));
    } else if (!activeElement && !justTransitionedRef.current) {
      getStore().setOrbTargetSize(getOrbSize("VOICE_PROBE"));
    }
  }, [orchestratorPhase, activeElement]);


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
      sequenceIdRef.current++;

      if (phase0Ref.current === "mic_check") {
        handlePhase0Response(text);
        return;
      }

      // During Phase 0 intro segments, just stop TTS — don't send message
      if (phase0Ref.current === "playing" || phase0Ref.current === "completing") {
        s.setOrbMode("idle");
        return;
      }

      const el = s.activeElement;
      if (el && !el.responded) {
        s.sendElementResponse({ elementType: el.elementType, value: text });
      } else {
        s.setOrbMode("processing");
        lastFailedMessageRef.current = text;
        s.sendMessage(text).then(() => { lastFailedMessageRef.current = null; }).catch(() => {});
      }
    },
    [handlePhase0Response], // eslint-disable-line react-hooks/exhaustive-deps -- phase0Ref is a stable ref
  );

  const handleElementResponse = useCallback(async (value: string) => {
    const s = getStore();
    const el = s.activeElement;
    if (!el) return;

    ttsRef.current?.stop();
    nudgeRef.current.stop();

    const payload = {
      elementType: el.elementType,
      value,
      itemId: el.elementData.itemId as string | undefined,
      construct: el.elementData.construct as string | undefined,
    };
    // Fix: PRO-14 — store payload for retry on failure
    lastFailedElementRef.current = payload;
    try {
      await s.sendElementResponse(payload);
      lastFailedElementRef.current = null;
    } catch {
      // Error is already set in store by sendElementResponse's catch block
    }
  }, []);

  const handleTextSend = useCallback(() => {
    const text = textInput.trim();
    if (!text) return;
    const s = getStore();
    if (s.isLoading) return;
    setTextInput("");

    ttsRef.current?.stop();
    nudgeRef.current.stop();
    sequenceIdRef.current++;

    if (phase0Ref.current === "mic_check") {
      handlePhase0Response(text);
      return;
    }

    const el = s.activeElement;
    if (el && !el.responded) {
      s.sendElementResponse({ elementType: el.elementType, value: text });
    } else {
      s.setOrbMode("processing");
      lastFailedMessageRef.current = text;
      s.sendMessage(text).then(() => { lastFailedMessageRef.current = null; }).catch(() => {});
    }
  }, [textInput, handlePhase0Response]); // eslint-disable-line react-hooks/exhaustive-deps -- phase0Ref is a stable ref

  const handleListeningChange = useCallback((listening: boolean) => {
    const s = getStore();
    s.setVoiceListening(listening);
    if (listening) {
      nudgeRef.current.stop();
      setDeliveryCancelToken(t => t + 1);
      ttsRef.current?.stop();
      s.setOrbMode("listening");
    } else if (!s.isLoading) {
      s.setOrbMode("idle");
    }
  }, []);

  // ══════════════════════════════════════════════
  // Render Helpers
  // ══════════════════════════════════════════════

  const interactiveElement = (
    <InteractiveRenderer
      activeElement={activeElement}
      error={error}
      isLoading={isLoading}
      onElementResponse={handleElementResponse}
      onTimeout={() => handleElementResponse("TIMEOUT")}
    />
  );

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
  // Show mic during entire Phase 0 so user can interrupt Aria at any time
  const showInput = !isComplete && !isTransition && !activeElement;

  // Format resolver — single source of truth for layout selection
  const format: AssessmentFormat = resolveFormat(
    orchestratorPhase,
    activeElement,
    referenceRevealCount,
    isComplete,
  );

  // Layout key for crossfade animation on layout shell changes
  const layoutKey = format === 2 || format === 3 ? "split-ref"
    : format >= 4 && format <= 6 ? "split-interactive"
    : format === 7 ? "confidence"
    : "centered";

  // LAYOUT-TRACE: log whenever any layout-relevant state changes
  useEffect(() => {
    // Fix: PRO-75 — guard layout trace logs behind __DEBUG
    __DEBUG && console.log(`[LAYOUT-TRACE] orchestratorPhase: ${orchestratorPhase}`);
    __DEBUG && console.log(`[LAYOUT-TRACE] format resolved: ${format}`);
    __DEBUG && console.log(`[LAYOUT-TRACE] layoutKey: ${layoutKey}`);
    __DEBUG && console.log(`[LAYOUT-TRACE] referenceCard exists: ${!!referenceCard}`);
    __DEBUG && console.log(`[LAYOUT-TRACE] referenceRevealCount: ${referenceRevealCount}`);
  }, [orchestratorPhase, format, layoutKey, referenceCard, referenceRevealCount]);

  // ── Input area ──
  const renderInputArea = () => {
    if (!showInput) return null;

    return (
      <div className="flex flex-col items-center gap-3 w-full">
        {showInputToggle && (
          <InputModeToggle
            mode={inputMode}
            onToggle={(mode) => getStore().setInputMode(mode)}
            speechSupported={speechSupported}
          />
        )}

        {isVoiceMode ? (
          <MicButton
            ref={micButtonRef}
            onTranscript={handleVoiceTranscript}
            onListeningChange={handleListeningChange}
            disabled={isLoading || isTTSPlaying}
            reason={isTTSPlaying ? "speaking" : isLoading ? "loading" : undefined}
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
              aria-label="Type your response"
              disabled={isLoading || isTTSPlaying}
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
              disabled={!textInput.trim() || isLoading || isTTSPlaying}
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
                  ? "var(--s-blue-g, #4a8af5)"
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

  // Fix: PRO-43 — show loading state during initial assessment fetch
  if (!initialized) {
    return (
      <div
        className="stage-root fixed inset-0 z-50 overflow-hidden flex items-center justify-center"
        style={{ background: "var(--s-bg, #080e1a)" }}
      >
        <ComponentErrorBoundary componentName="living-background">
          <LivingBackground />
        </ComponentErrorBoundary>
        <div className="relative z-10 flex flex-col items-center gap-4">
          <div
            style={{
              width: "40px",
              height: "40px",
              borderRadius: "50%",
              border: "2px solid rgba(255,255,255,0.08)",
              borderTopColor: "var(--s-gold, #C9A84C)",
              animation: "spin 1s linear infinite",
            }}
          />
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "11px",
              fontWeight: 400,
              color: "var(--s-t3, #3d5068)",
              textTransform: "uppercase",
              letterSpacing: "1.5px",
            }}
          >
            Preparing assessment...
          </span>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div
      className="stage-root fixed inset-0 z-50 overflow-hidden"
      style={{ background: "var(--s-bg, #080e1a)" }}
    >
      <OfflineOverlay />

      {/* TurnPlayer (headless): when FEATURE_TURN_PLAYER is on, drives delivery from Turn data */}
      {/* textOnly=false enables voice via the existing TTSEngine */}
      {FEATURE_FLAGS.TURN_PLAYER && lastTurn && orchestratorPhase !== "PHASE_0" && (
        <TurnPlayer
          turn={lastTurn}
          textOnly={false}
          ttsEngine={ttsRef.current}
          token={token}
          onDeliveryComplete={() => {
            getStore().setOrbMode("idle");
            startNudgeForCurrentAct();
          }}
          onAutoAdvance={() => {
            nudgeRef.current.stop();
            getStore().setOrbMode("processing");
            getStore().sendMessage("[AUTO_ADVANCE]");
          }}
          cancelToken={deliveryCancelToken}
          onInputReceived={(value, meta) => {
            if (meta?.elementType) {
              getStore().sendElementResponse({
                elementType: meta.elementType,
                value,
                itemId: meta.itemId,
                construct: meta.construct,
                responseTimeMs: meta.responseTimeMs,
              });
            } else {
              getStore().sendMessage(value);
            }
          }}
        />
      )}

      {/* Audio auto-unlocks on mount — no gate needed (user already interacted on welcome page) */}

      {/* Living background */}
      <ComponentErrorBoundary componentName="living-background">
        <LivingBackground />
      </ComponentErrorBoundary>

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

        {/* Main content — format-based layout selection (keyed for crossfade) */}
        <div
          key={layoutKey}
          className="absolute inset-0 z-10"
          style={{
            opacity: layoutOpacity,
            transition: "opacity 600ms cubic-bezier(0.25, 0.1, 0.25, 1)",
          }}
        >
        {(format === 2 || format === 3) ? (
          /* ── Formats 2-3: Reference card + AriaSidebar ── */
          <ReferenceSplitLayout
            referenceCard={
              <ScenarioReferenceCard reference={referenceCard} revealCount={referenceRevealCount} />
            }
            sidebar={
              <AriaSidebar
                orbMode={orbMode}
                audioAmplitude={audioAmplitude}
                orbTargetSize={88}
                subtitleText={subtitleText}
                subtitleRevealedWords={subtitleRevealedWords}
                isTTSPlaying={isTTSPlaying}
                candidateTranscript={candidateTranscript}
                showTranscript={showTranscript}
                showInput={showInput}
                inputMode={inputMode}
                showInputToggle={showInputToggle}
                isLoading={isLoading}
                onVoiceTranscript={handleVoiceTranscript}
                onListeningChange={handleListeningChange}
                onTextSend={(text) => {
                  ttsRef.current?.stop();
                  nudgeRef.current.stop();
                  sequenceIdRef.current++;
                  const s = getStore();
                  s.setOrbMode("processing");
                  s.sendMessage(text);
                }}
                onInputModeToggle={(mode) => getStore().setInputMode(mode)}
                speechSupported={speechSupported}
                micButtonRef={micButtonRef}
              />
            }
          />

        ) : (format >= 4 && format <= 6) ? (
          /* ── Formats 4-6: Interactive element + AriaSidebar ── */
          <InteractiveSplitLayout
            showElements={showElements}
            interactiveElement={interactiveElement}
            sidebar={
              <AriaSidebar
                orbMode={orbMode}
                audioAmplitude={audioAmplitude}
                orbTargetSize={72}
                subtitleText={subtitleText}
                subtitleRevealedWords={subtitleRevealedWords}
                isTTSPlaying={isTTSPlaying}
                candidateTranscript={candidateTranscript}
                showTranscript={showTranscript}
                showInput={showInput}
                inputMode={inputMode}
                showInputToggle={showInputToggle}
                isLoading={isLoading}
                onVoiceTranscript={handleVoiceTranscript}
                onListeningChange={handleListeningChange}
                onTextSend={(text) => {
                  ttsRef.current?.stop();
                  nudgeRef.current.stop();
                  sequenceIdRef.current++;
                  const s = getStore();
                  const el = s.activeElement;
                  if (el && !el.responded) {
                    s.sendElementResponse({ elementType: el.elementType, value: text });
                  } else {
                    s.setOrbMode("processing");
                    s.sendMessage(text);
                  }
                }}
                onInputModeToggle={(mode) => getStore().setInputMode(mode)}
                speechSupported={speechSupported}
                micButtonRef={micButtonRef}
              />
            }
          />

        ) : format === 7 ? (
          /* ── Format 7: Confidence rating (centered with element) ── */
          <ConfidenceLayout
            actLabel={<ActLabel currentAct={currentAct} visible={showActLabel} />}
            orb={
              <AssessmentOrb
                mode={orbMode}
                amplitude={audioAmplitude}
                targetSize={orbTargetSize}
              />
            }
            subtitle={
              <>
                <SubtitleDisplay
                  text={subtitleText}
                  revealedWords={subtitleRevealedWords}
                  isRevealing={isTTSPlaying}
                />
                <CandidateTranscript
                  text={candidateTranscript}
                  visible={showTranscript}
                />
              </>
            }
            interactiveElement={interactiveElement}
            showElements={showElements}
            showInput={showInput}
            input={renderInputArea()}
          />

        ) : (
          /* ── Formats 1, 8, 9: Centered conversational / transition / completion ── */
          <CenteredLayout
            orbTop={orbGliding ? "14%" : "38%"}
            orbLeft={orbGliding ? "90%" : "50%"}
            orbTransition="top 1200ms cubic-bezier(0.25,0.1,0.25,1), left 1200ms cubic-bezier(0.25,0.1,0.25,1)"
            actLabel={<ActLabel currentAct={currentAct} visible={showActLabel} />}
            orb={
              <AssessmentOrb
                mode={orbMode}
                amplitude={audioAmplitude}
                targetSize={orbTargetSize}
              />
            }
            content={
              <>
                {isBreak && !orbGliding ? (
                  <Phase0BreakScreen
                    duration={20}
                    onContinue={handleBeginAct1}
                    visible={true}
                  />
                ) : isBreak && orbGliding ? (
                  /* During Phase 0→Act 1 glide: subtitles only (no 3-dot transition screen) */
                  <>
                    <SubtitleDisplay
                      text={subtitleText}
                      revealedWords={subtitleRevealedWords}
                      isRevealing={isTTSPlaying}
                    />
                  </>
                ) : format === 9 && showCompletionScreen ? (
                  <CompletionScreen
                    elapsedMinutes={Math.round(elapsedSeconds / 60)}
                    visible={true}
                  />
                ) : (
                  <>
                    {format === 8 && (
                      <TransitionScreen
                        heading={
                          // Fix: PRO-45 — render appropriate text during COMPLETING phase
                          orchestratorPhase === "TRANSITION_0_1" ? "Let's Begin" :
                          orchestratorPhase === "TRANSITION_1_2" ? "Problem Solving" :
                          orchestratorPhase === "TRANSITION_2_3" ? "Reflection" :
                          orchestratorPhase === "COMPLETING" ? "Wrapping Up" :
                          ""
                        }
                        visible={true}
                      />
                    )}
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
                          transition: "opacity 700ms cubic-bezier(0.25,0.1,0.25,1), transform 700ms cubic-bezier(0.25,0.1,0.25,1)",
                        }}
                      >
                        {interactiveElement}
                      </div>
                    )}
                  </>
                )}
              </>
            }
            showInput={showInput}
            input={renderInputArea()}
          />
        )}
        </div>
      </div>

      {/* Bottom bar */}
      <div
        className="absolute bottom-0 left-0 right-0 z-20 flex items-center justify-between px-6 py-3"
        style={{ pointerEvents: "none" }}
      >
        <span
          className="flex items-center gap-1.5 text-[11px] uppercase tracking-[1.5px]" /* Fix: PRO-53 */
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
          className="text-[11px]" /* Fix: PRO-53 */
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
            background: "color-mix(in srgb, var(--s-red, #DC2626) 15%, transparent)",
            border: "1px solid color-mix(in srgb, var(--s-red, #DC2626) 30%, transparent)",
            color: "#fca5a5",
            fontSize: "12px",
            fontFamily: "var(--font-display)",
          }}
        >
          <span>{error}</span>
          {(lastFailedMessageRef.current || lastFailedElementRef.current) && (
            <button
              onClick={async () => {
                // Fix: PRO-14 — handle element response retry
                const elPayload = lastFailedElementRef.current;
                if (elPayload) {
                  useChatAssessmentStore.setState({ error: null });
                  try {
                    await getStore().sendElementResponse(elPayload);
                    lastFailedElementRef.current = null;
                  } catch {
                    // Error re-set by store
                  }
                  return;
                }
                const msg = lastFailedMessageRef.current;
                if (!msg) return;
                useChatAssessmentStore.setState({ error: null });
                // Fix: PRO-13 — handle completion retry separately
                if (msg === "__COMPLETE__") {
                  try {
                    const res = await fetch(`/api/assess/${token}/complete`, { method: "POST" });
                    if (res.ok) {
                      lastFailedMessageRef.current = null;
                      setTimeout(() => { window.location.href = `/assess/${token}/survey`; }, 2000);
                    } else { throw new Error("retry failed"); }
                  } catch {
                    useChatAssessmentStore.setState({ error: "Something went wrong — tap to try again" });
                  }
                  return;
                }
                const s = getStore();
                s.setOrbMode("processing");
                lastFailedMessageRef.current = msg;
                s.sendMessage(msg).then(() => { lastFailedMessageRef.current = null; }).catch(() => {});
              }}
              aria-label="Retry"
              style={{
                color: "#fca5a5",
                cursor: "pointer",
                padding: "4px 10px",
                background: "rgba(252, 165, 165, 0.1)",
                border: "1px solid rgba(252, 165, 165, 0.25)",
                borderRadius: "4px",
                fontSize: "11px",
                fontFamily: "var(--font-mono)",
                fontWeight: 600,
                letterSpacing: "0.5px",
              }}
            >
              Retry
            </button>
          )}
          <button
            onClick={() => { useChatAssessmentStore.setState({ error: null }); }}
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

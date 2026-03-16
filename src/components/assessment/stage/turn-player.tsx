"use client";

/**
 * TurnPlayer — renders a single AssessmentTurnResponse.
 *
 * Stage 3: text-only mode (word-by-word reveal, no audio).
 * Stage 4: voice mode (TTS playback with subtitle sync).
 *
 * One component handles ALL 9 formats identically. The TurnPlayer doesn't
 * know which format it's playing — it just reads delivery.sentences,
 * drives subtitle reveal, and fires callbacks on completion.
 */

import { useEffect, useRef, useState, useCallback } from "react";
import type { AssessmentTurnResponse } from "@/lib/types/turn";
import { useChatAssessmentStore } from "@/stores/chat-assessment-store";
import type { TTSEngine } from "@/components/assessment/voice/tts-engine";

export interface InputMeta {
  elementType?: string;
  itemId?: string;
  construct?: string;
  responseTimeMs?: number;
}

interface TurnPlayerProps {
  turn: AssessmentTurnResponse | null;
  onDeliveryComplete: () => void;
  onInputReceived: (value: string, meta?: InputMeta) => void;
  /** Stage 3 = true (text reveal only), Stage 4+ = false (TTS audio) */
  textOnly?: boolean;
  /** TTS engine ref for voice mode. Required when textOnly=false. */
  ttsEngine?: TTSEngine | null;
  /** Assessment token for TTS API calls. Required when textOnly=false. */
  token?: string;
}

/** Word reveal stagger in ms (text-only mode). */
const WORD_STAGGER_MS = 55;
/** Minimum time per sentence in ms (text-only). */
const MIN_SENTENCE_MS = 1500;
/** Minimum time per sentence in ms (voice mode — pads short TTS). */
const MIN_SENTENCE_MS_VOICE = 2500;
/** Delay before showing interactive element after delivery. */
const ELEMENT_REVEAL_DELAY_MS = 300;
/** Pause between sentences in voice mode (ms). */
const INTER_SENTENCE_PAUSE_MS = 150;

export function TurnPlayer({
  turn,
  onDeliveryComplete,
  onInputReceived,
  textOnly = true,
  ttsEngine,
  token,
}: TurnPlayerProps) {
  const [deliveryComplete, setDeliveryComplete] = useState(false);
  const [showElement, setShowElement] = useState(false);
  const turnIdRef = useRef<string>("");
  const sentenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const revealedRef = useRef(0);
  const reducedMotion = useRef(false);
  const cancelledRef = useRef(false);
  const sequenceIdRef = useRef(0);

  const store = useChatAssessmentStore;

  // Detect prefers-reduced-motion
  useEffect(() => {
    if (typeof window !== "undefined") {
      reducedMotion.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    }
  }, []);

  // Main delivery effect — runs when a new Turn arrives
  useEffect(() => {
    if (!turn) return;

    // Generate a unique ID for this Turn to prevent re-processing
    const turnId = `${turn.signal.format}-${turn.signal.act}-${turn.meta.progress.act1}-${Date.now()}`;
    if (turnIdRef.current === turnId) return;
    turnIdRef.current = turnId;
    sequenceIdRef.current++;
    cancelledRef.current = false;

    // Reset state for new Turn
    setDeliveryComplete(false);
    setShowElement(false);
    revealedRef.current = 0;

    const sentences = turn.delivery.sentences;

    // Empty delivery — immediately complete
    if (sentences.length === 0) {
      setDeliveryComplete(true);
      onDeliveryComplete();
      return;
    }

    // Route to text or voice delivery
    if (textOnly || !ttsEngine || !token) {
      playTextDelivery(sentences);
    } else {
      playVoiceDelivery(sentences);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turn]);

  // Show interactive element after delivery completes
  useEffect(() => {
    if (!deliveryComplete || !turn?.delivery.interactiveElement) return;

    const timer = setTimeout(() => {
      setShowElement(true);
    }, ELEMENT_REVEAL_DELAY_MS);

    return () => clearTimeout(timer);
  }, [deliveryComplete, turn]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cancelledRef.current = true;
      if (sentenceTimerRef.current) clearTimeout(sentenceTimerRef.current);
      if (wordTimerRef.current) clearInterval(wordTimerRef.current);
    };
  }, []);

  // ──────────────────────────────────────────────
  // Text-only delivery (Stage 3)
  // ──────────────────────────────────────────────

  const playTextDelivery = useCallback((sentences: string[]) => {
    let sentenceIdx = 0;

    const playNextSentence = () => {
      if (cancelledRef.current || sentenceIdx >= sentences.length) {
        store.getState().setSubtitleRevealedWords(9999);
        store.getState().setReferenceRevealCount(-1);
        setDeliveryComplete(true);
        onDeliveryComplete();
        return;
      }

      const sentence = sentences[sentenceIdx];
      const words = sentence.split(/\s+/);

      store.getState().setSubtitleText(sentence);
      store.getState().setCurrentSentenceIndex(sentenceIdx);

      // Progressive reference card reveal
      const refCard = store.getState().referenceCard;
      if (refCard && store.getState().referenceRevealCount >= 0) {
        store.getState().setReferenceRevealCount(sentenceIdx + 1);
      }

      if (reducedMotion.current) {
        store.getState().setSubtitleRevealedWords(words.length);
        sentenceTimerRef.current = setTimeout(() => {
          sentenceIdx++;
          playNextSentence();
        }, Math.max(MIN_SENTENCE_MS, 300));
      } else {
        revealedRef.current = 0;
        store.getState().setSubtitleRevealedWords(0);

        wordTimerRef.current = setInterval(() => {
          revealedRef.current++;
          store.getState().setSubtitleRevealedWords(revealedRef.current);
          if (revealedRef.current >= words.length) {
            if (wordTimerRef.current) clearInterval(wordTimerRef.current);
          }
        }, WORD_STAGGER_MS);

        const totalRevealMs = words.length * WORD_STAGGER_MS;
        const sentenceDuration = Math.max(MIN_SENTENCE_MS, totalRevealMs + 400);

        sentenceTimerRef.current = setTimeout(() => {
          if (wordTimerRef.current) clearInterval(wordTimerRef.current);
          store.getState().setSubtitleRevealedWords(words.length);
          sentenceIdx++;
          playNextSentence();
        }, sentenceDuration);
      }
    };

    playNextSentence();
  }, [onDeliveryComplete, store]);

  // ──────────────────────────────────────────────
  // Voice delivery (Stage 4)
  // ──────────────────────────────────────────────

  const playVoiceDelivery = useCallback(async (sentences: string[]) => {
    if (!ttsEngine || !token) {
      console.log(`[TP] 📝 Text delivery START (no ttsEngine or token)`);
      playTextDelivery(sentences);
      return;
    }

    const mySequenceId = sequenceIdRef.current;
    console.log(`[TP] ▶ Voice delivery START | seqId=${mySequenceId} | sentences=${sentences.length} | time=${Date.now()}`);

    // Stop any existing playback
    ttsEngine.stop();
    store.getState().setOrbMode("speaking");

    for (let i = 0; i < sentences.length; i++) {
      // Check cancellation
      if (cancelledRef.current || sequenceIdRef.current !== mySequenceId) {
        console.log(`[TP] ⛔ Delivery CANCELLED | mySeq=${mySequenceId} | currentSeq=${sequenceIdRef.current} | cancelled=${cancelledRef.current} | at sentence ${i}/${sentences.length} | time=${Date.now()}`);
        return;
      }

      const sentence = sentences[i];
      const words = sentence.split(/\s+/);
      console.log(`[TP] 📢 Sentence ${i}/${sentences.length} START | seqId=${mySequenceId} | words=${words.length} | text="${sentence.substring(0, 60)}..." | time=${Date.now()}`);

      // Set subtitle for this sentence
      store.getState().setSubtitleText(sentence);
      store.getState().setCurrentSentenceIndex(i);
      store.getState().setSubtitleRevealedWords(0);
      revealedRef.current = 0;

      // Progressive reference card reveal
      const refCard = store.getState().referenceCard;
      if (refCard && store.getState().referenceRevealCount >= 0) {
        store.getState().setReferenceRevealCount(i + 1);
      }

      // Prefetch next sentence while current plays
      if (i + 1 < sentences.length) {
        console.log(`[TP] 📦 Prefetch sentence ${i + 1} | time=${Date.now()}`);
        ttsEngine.prefetch(sentences[i + 1], token).catch(() => {});
      }

      const startTime = Date.now();

      try {
        // Play this sentence with word reveal sync
        await ttsEngine.speak(sentence, token, (totalDurationSec) => {
          console.log(`[TP] 🔊 onPlaybackStart | sentence ${i} | duration=${totalDurationSec}s | time=${Date.now()}`);
          // onPlaybackStart: sync word reveal to audio duration
          if (cancelledRef.current || sequenceIdRef.current !== mySequenceId) return;

          const msPerWord = Math.max(60, (totalDurationSec * 1000) / words.length);
          revealedRef.current = 0;

          wordTimerRef.current = setInterval(() => {
            revealedRef.current++;
            store.getState().setSubtitleRevealedWords(revealedRef.current);
            if (revealedRef.current >= words.length) {
              if (wordTimerRef.current) clearInterval(wordTimerRef.current);
            }
          }, msPerWord);
        }, true); // preSplit=true — sentences already split
        console.log(`[TP] ✅ Sentence ${i} COMPLETE | seqId=${mySequenceId} | duration=${Date.now() - startTime}ms | time=${Date.now()}`);
      } catch (err) {
        console.log(`[TP] ❌ Sentence ${i} FAILED | seqId=${mySequenceId} | error=${err instanceof Error ? err.message : String(err)} | duration=${Date.now() - startTime}ms | time=${Date.now()}`);
        // Per-sentence failure: text fallback for this sentence, next tries audio
        store.getState().setSubtitleRevealedWords(words.length);
      }

      // Ensure all words revealed after TTS completes/fails
      if (wordTimerRef.current) clearInterval(wordTimerRef.current);
      store.getState().setSubtitleRevealedWords(words.length);

      // Enforce minimum sentence time, then add inter-sentence pause
      if (i < sentences.length - 1) {
        const elapsed = Date.now() - startTime;
        const remaining = MIN_SENTENCE_MS_VOICE - elapsed;
        if (remaining > 0) {
          console.log(`[TP] ⏸ Padding sentence ${i} by ${remaining}ms to reach MIN_SENTENCE_MS_VOICE | time=${Date.now()}`);
          await new Promise((r) => setTimeout(r, remaining));
        }
        await new Promise((r) => setTimeout(r, INTER_SENTENCE_PAUSE_MS));
      }
    }

    // All sentences delivered
    if (cancelledRef.current || sequenceIdRef.current !== mySequenceId) {
      console.log(`[TP] ⛔ Post-delivery CANCELLED | mySeq=${mySequenceId} | currentSeq=${sequenceIdRef.current} | time=${Date.now()}`);
      return;
    }

    console.log(`[TP] ⏹ Voice delivery END | seqId=${mySequenceId} | completed all ${sentences.length} sentences | time=${Date.now()}`);
    store.getState().setSubtitleRevealedWords(9999);
    store.getState().setReferenceRevealCount(-1);
    store.getState().setOrbMode("idle");
    store.getState().setAudioAmplitude(0);
    store.getState().setTTSPlaying(false);
    setDeliveryComplete(true);
    onDeliveryComplete();
  }, [ttsEngine, token, playTextDelivery, onDeliveryComplete, store]);

  // Headless — renders nothing. Drives store state for existing UI components.
  return null;
}

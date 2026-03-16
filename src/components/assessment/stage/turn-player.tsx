"use client";

/**
 * TurnPlayer — renders a single AssessmentTurnResponse.
 *
 * Stage 3: text-only mode (word-by-word reveal, no audio).
 * Stage 4: voice mode (TTS playback with audio sync).
 *
 * One component renders ALL 9 formats identically. The TurnPlayer doesn't
 * know which format it's playing — it just reads delivery.sentences,
 * shows referenceCard/referenceUpdate, reveals interactiveElement after
 * delivery completes, and activates input.
 */

import { useEffect, useRef, useState, useCallback } from "react";
import type { AssessmentTurnResponse } from "@/lib/types/turn";
import { useChatAssessmentStore } from "@/stores/chat-assessment-store";

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
}

/** Word reveal stagger in ms (text-only mode). */
const WORD_STAGGER_MS = 55;
/** Minimum time per sentence in ms. */
const MIN_SENTENCE_MS = 1500;
/** Delay before showing interactive element after delivery. */
const ELEMENT_REVEAL_DELAY_MS = 300;

export function TurnPlayer({ turn, onDeliveryComplete, onInputReceived, textOnly = true }: TurnPlayerProps) {
  const [deliveryComplete, setDeliveryComplete] = useState(false);
  const [showElement, setShowElement] = useState(false);
  const turnIdRef = useRef<string>("");
  const sentenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const revealedRef = useRef(0);
  const reducedMotion = useRef(false);

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

    // Text-only delivery: reveal sentences word-by-word
    if (textOnly) {
      playTextDelivery(sentences);
    }
    // Stage 4+: TTS delivery would go here
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
      if (sentenceTimerRef.current) clearTimeout(sentenceTimerRef.current);
      if (wordTimerRef.current) clearInterval(wordTimerRef.current);
    };
  }, []);

  /**
   * Text-only delivery: reveal sentences one at a time with word-by-word stagger.
   * For prefers-reduced-motion: instant appearance with opacity fade.
   */
  const playTextDelivery = useCallback((sentences: string[]) => {
    let sentenceIdx = 0;

    const playNextSentence = () => {
      if (sentenceIdx >= sentences.length) {
        // All sentences delivered
        store.getState().setSubtitleRevealedWords(9999);
        store.getState().setReferenceRevealCount(-1);
        setDeliveryComplete(true);
        onDeliveryComplete();
        return;
      }

      const sentence = sentences[sentenceIdx];
      const words = sentence.split(/\s+/);

      // Set subtitle for this sentence
      store.getState().setSubtitleText(sentence);
      store.getState().setCurrentSentenceIndex(sentenceIdx);

      // Progressive reference card reveal (one section per sentence)
      const refCard = store.getState().referenceCard;
      if (refCard && store.getState().referenceRevealCount >= 0) {
        store.getState().setReferenceRevealCount(sentenceIdx + 1);
      }

      if (reducedMotion.current) {
        // Instant reveal for reduced motion
        store.getState().setSubtitleRevealedWords(words.length);
        const duration = Math.max(MIN_SENTENCE_MS, 300);
        sentenceTimerRef.current = setTimeout(() => {
          sentenceIdx++;
          playNextSentence();
        }, duration);
      } else {
        // Word-by-word reveal
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

  // The TurnPlayer itself renders nothing — it's a behavior controller.
  // The actual UI (subtitles, reference cards, interactive elements) is
  // rendered by the existing components that read from the store.
  return null;
}

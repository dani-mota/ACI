"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { StageChoiceCards } from "./stage-choice-cards";

interface StageTimedChallengeProps {
  prompt: string;
  options: string[];
  timeLimit: number;
  onSelect: (value: string) => void;
  onTimeout: () => void;
  disabled?: boolean;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function StageTimedChallenge({
  prompt,
  options,
  timeLimit,
  onSelect,
  onTimeout,
  disabled,
}: StageTimedChallengeProps) {
  const [remaining, setRemaining] = useState(timeLimit);
  const [answered, setAnswered] = useState(false);
  // Fix: PRO-36 — only update aria-live region every 5s to avoid 4Hz screen reader spam
  const [ariaRemaining, setAriaRemaining] = useState(timeLimit);
  const elapsedRef = useRef(0);
  const lastTickRef = useRef(Date.now());
  const pausedRef = useRef(false);
  const lastAriaUpdateRef = useRef(timeLimit);

  useEffect(() => {
    if (disabled || answered) return;

    // Pause timer when tab is hidden
    const handleVisibility = () => {
      if (document.hidden) {
        pausedRef.current = true;
      } else {
        pausedRef.current = false;
        lastTickRef.current = Date.now();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    // Use wall-clock time at 4Hz for accuracy
    const interval = setInterval(() => {
      if (pausedRef.current) return;
      const now = Date.now();
      const delta = (now - lastTickRef.current) / 1000;
      lastTickRef.current = now;
      elapsedRef.current += delta;

      const newRemaining = Math.max(0, Math.round(timeLimit - elapsedRef.current));
      setRemaining(newRemaining);

      // Fix: PRO-36 — throttle aria-live updates to every 5 seconds (or when critical <=10s)
      if (
        newRemaining <= 0 ||
        newRemaining <= 10 ||
        lastAriaUpdateRef.current - newRemaining >= 5
      ) {
        setAriaRemaining(newRemaining);
        lastAriaUpdateRef.current = newRemaining;
      }

      if (newRemaining <= 0) {
        clearInterval(interval);
        onTimeout();
      }
    }, 250);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [disabled, answered, onTimeout, timeLimit]);

  const handleSelect = useCallback(
    (value: string) => {
      if (answered) return;
      setAnswered(true);
      onSelect(value);
    },
    [answered, onSelect],
  );

  const progress = remaining / timeLimit;
  const timerColor =
    progress > 0.5
      ? "var(--s-gold, #C9A84C)"
      : progress > 0.2
        ? "var(--s-amber, #D97706)"
        : "var(--s-red, #DC2626)";

  const isCritical = remaining <= 10;

  return (
    <div className="flex flex-col gap-4 w-full max-w-lg">
      {/* Timer display */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 4px",
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "clamp(9px, 2vw, 11px)",
            fontWeight: 600,
            color: "var(--s-t3, #3d5068)",
            textTransform: "uppercase",
            letterSpacing: "2px",
          }}
        >
          Time Remaining
        </span>
        {/* Fix: PRO-36 — aria-live="polite" + throttled to avoid 4Hz announcements */}
        <span
          role="timer"
          aria-live="polite"
          aria-label={`${ariaRemaining} seconds remaining`}
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "clamp(24px, 5vw, 32px)",
            fontWeight: 300,
            color: timerColor,
            fontVariantNumeric: "tabular-nums",
            transition: "color 500ms ease",
            animation: isCritical ? "dotPulse 1s ease-in-out infinite" : "none",
          }}
        >
          {formatTime(remaining)}
        </span>
      </div>

      {/* Timer track */}
      <div
        style={{
          height: "4px",
          borderRadius: "2px",
          background: "rgba(255,255,255,0.05)",
          overflow: "hidden",
        }}
      >
        <div
          className="stage-animate"
          style={{
            height: "100%",
            width: `${progress * 100}%`,
            borderRadius: "2px",
            background: `linear-gradient(90deg, ${timerColor}, ${timerColor}cc)`,
            boxShadow: `0 0 10px ${timerColor}44`,
            transition: "width 1s linear, background 500ms ease",
          }}
        />
      </div>

      {/* Fix: PRO-82 — text label when timer is low (WCAG 1.4.1: not color alone) */}
      {progress < 0.3 && (
        <span style={{ color: "var(--s-red, #DC2626)", fontSize: "11px", fontWeight: 600 }}>
          Hurry
        </span>
      )}

      {/* Choices */}
      <StageChoiceCards
        prompt={prompt}
        options={options}
        onSelect={handleSelect}
        disabled={disabled || answered || remaining === 0}
      />
    </div>
  );
}

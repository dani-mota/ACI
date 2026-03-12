"use client";

import { useState, useEffect, useCallback } from "react";
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

  useEffect(() => {
    if (disabled || answered) return;

    const interval = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          onTimeout();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [disabled, answered, onTimeout]);

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
            fontSize: "9px",
            fontWeight: 600,
            color: "var(--s-t3, #3d5068)",
            textTransform: "uppercase",
            letterSpacing: "2px",
          }}
        >
          Time Remaining
        </span>
        <span
          role="timer"
          aria-live="assertive"
          aria-label={`${remaining} seconds remaining`}
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "24px",
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
          height: "3px",
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

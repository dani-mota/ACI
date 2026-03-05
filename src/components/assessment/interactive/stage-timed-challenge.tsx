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
  const barColor =
    progress > 0.5
      ? "#2563EB"
      : progress > 0.2
        ? "#D97706"
        : "#DC2626";

  return (
    <div className="flex flex-col gap-3 w-full max-w-lg">
      {/* Timer bar */}
      <div className="flex items-center gap-3">
        <div
          className="flex-1 h-[2px] rounded-full"
          style={{ background: "rgba(255, 255, 255, 0.05)" }}
        >
          <div
            className="h-full rounded-full stage-animate"
            style={{
              width: `${progress * 100}%`,
              background: barColor,
              boxShadow: `0 0 8px ${barColor}66`,
              transition: "width 1s linear, background 0.5s ease",
            }}
          />
        </div>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "10px",
            color:
              remaining <= 10
                ? "#DC2626"
                : "rgba(255, 255, 255, 0.5)",
            fontWeight: remaining <= 10 ? 600 : 400,
            minWidth: "28px",
            textAlign: "right",
          }}
        >
          {remaining}s
        </span>
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

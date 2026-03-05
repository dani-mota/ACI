"use client";

import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";

// ──────────────────────────────────────────────
// Choice Cards (MC / Tradeoff selections in chat)
// ──────────────────────────────────────────────

interface ChoiceCardsProps {
  prompt: string;
  options: string[];
  onSelect: (value: string) => void;
  disabled?: boolean;
  selected?: string;
}

export function ChoiceCards({ prompt, options, onSelect, disabled, selected }: ChoiceCardsProps) {
  return (
    <div className="flex flex-col gap-3 px-4 py-3" role="group" aria-label={prompt}>
      <p className="text-sm font-medium text-slate-700" id="choice-prompt">{prompt}</p>
      <div className="flex flex-col gap-2" role="radiogroup" aria-labelledby="choice-prompt">
        {options.map((option, i) => (
          <button
            key={i}
            role="radio"
            aria-checked={selected === option}
            onClick={() => !disabled && onSelect(option)}
            disabled={disabled}
            className={cn(
              "rounded-xl border-2 px-4 py-3 text-left text-sm transition-all",
              selected === option
                ? "border-blue-600 bg-blue-50 text-blue-900"
                : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50",
              disabled && selected !== option && "opacity-50",
            )}
          >
            <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-xs font-medium text-slate-600">
              {String.fromCharCode(65 + i)}
            </span>
            {/* Strip leading letter prefix (e.g., "A) " or "A. ") to prevent doubling */}
            {option.replace(/^[A-Za-z]\)\s*|^[A-Za-z]\.\s*/, "")}
          </button>
        ))}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────
// Numeric Input
// ──────────────────────────────────────────────

interface NumericInputProps {
  prompt: string;
  onSubmit: (value: string) => void;
  disabled?: boolean;
}

export function NumericInput({ prompt, onSubmit, disabled }: NumericInputProps) {
  const [value, setValue] = useState("");

  const handleSubmit = () => {
    if (value.trim() && !disabled) {
      onSubmit(value.trim());
    }
  };

  return (
    <div className="flex flex-col gap-3 px-4 py-3">
      <p className="text-sm font-medium text-slate-700">{prompt}</p>
      <div className="flex gap-2">
        <input
          type="text"
          inputMode="decimal"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          disabled={disabled}
          placeholder="Enter your answer..."
          className="flex-1 rounded-xl border-2 border-slate-200 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none"
        />
        <button
          onClick={handleSubmit}
          disabled={disabled || !value.trim()}
          className="rounded-xl bg-slate-800 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-700 disabled:opacity-50"
        >
          Submit
        </button>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────
// Confidence Rating
// ──────────────────────────────────────────────

interface ConfidenceRatingProps {
  prompt: string;
  onSelect: (value: string) => void;
  disabled?: boolean;
  selected?: string;
}

export function ConfidenceRating({ prompt, onSelect, disabled, selected }: ConfidenceRatingProps) {
  const options = [
    { label: "Very confident", value: "VERY_CONFIDENT", icon: "+" },
    { label: "Somewhat confident", value: "SOMEWHAT_CONFIDENT", icon: "~" },
    { label: "Not sure", value: "NOT_SURE", icon: "?" },
  ];

  return (
    <div className="flex flex-col gap-3 px-4 py-3">
      <p className="text-sm font-medium text-slate-700">{prompt}</p>
      <div className="flex gap-2">
        {options.map((opt) => (
          <button
            key={opt.value}
            onClick={() => !disabled && onSelect(opt.value)}
            disabled={disabled}
            className={cn(
              "flex-1 rounded-xl border-2 px-3 py-3 text-center text-sm transition-all",
              selected === opt.value
                ? "border-blue-600 bg-blue-50 text-blue-900"
                : "border-slate-200 bg-white text-slate-600 hover:border-slate-300",
              disabled && selected !== opt.value && "opacity-50",
            )}
          >
            <div className="text-lg">{opt.icon}</div>
            <div className="mt-1 text-xs">{opt.label}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────
// Timed Challenge
// ──────────────────────────────────────────────

interface TimedChallengeProps {
  prompt: string;
  options: string[];
  timeLimit: number; // seconds
  onSelect: (value: string) => void;
  onTimeout: () => void;
  disabled?: boolean;
}

export function TimedChallenge({ prompt, options, timeLimit, onSelect, onTimeout, disabled }: TimedChallengeProps) {
  const [remaining, setRemaining] = useState(timeLimit);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    if (disabled || selected) return;

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
  }, [disabled, selected, onTimeout]);

  const handleSelect = useCallback(
    (option: string) => {
      if (disabled || selected) return;
      setSelected(option);
      onSelect(option);
    },
    [disabled, selected, onSelect],
  );

  const progress = (remaining / timeLimit) * 100;

  return (
    <div className="flex flex-col gap-3 px-4 py-3">
      {/* Timer bar */}
      <div className="relative h-2 w-full overflow-hidden rounded-full bg-slate-200">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-1000",
            progress > 50 ? "bg-blue-500" : progress > 20 ? "bg-amber-500" : "bg-red-500",
          )}
          style={{ width: `${progress}%` }}
        />
      </div>
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-slate-700">{prompt}</p>
        <span className={cn("text-sm font-mono", remaining <= 10 ? "text-red-600 font-bold" : "text-slate-500")}>
          {remaining}s
        </span>
      </div>
      <div className="flex flex-col gap-2">
        {options.map((option, i) => (
          <button
            key={i}
            onClick={() => handleSelect(option)}
            disabled={disabled || !!selected}
            className={cn(
              "rounded-xl border-2 px-4 py-2 text-left text-sm transition-all",
              selected === option
                ? "border-blue-600 bg-blue-50"
                : "border-slate-200 hover:border-slate-300",
              (disabled || (selected && selected !== option)) && "opacity-50",
            )}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────
// Interactive Element Router
// ──────────────────────────────────────────────

interface InteractiveElementProps {
  elementType: string;
  elementData: Record<string, unknown>;
  onRespond: (value: string) => void;
  disabled?: boolean;
}

export function InteractiveElement({ elementType, elementData, onRespond, disabled }: InteractiveElementProps) {
  const prompt = (elementData.prompt as string) ?? "";
  const options = (elementData.options as string[]) ?? [];
  const timeLimit = (elementData.timeLimit as number) ?? 60;

  switch (elementType) {
    case "MULTIPLE_CHOICE_INLINE":
    case "TRADEOFF_SELECTION":
      return <ChoiceCards prompt={prompt} options={options} onSelect={onRespond} disabled={disabled} />;
    case "NUMERIC_INPUT":
      return <NumericInput prompt={prompt} onSubmit={onRespond} disabled={disabled} />;
    case "CONFIDENCE_RATING":
      return <ConfidenceRating prompt={prompt} onSelect={onRespond} disabled={disabled} />;
    case "TIMED_CHALLENGE":
      return (
        <TimedChallenge
          prompt={prompt}
          options={options}
          timeLimit={timeLimit}
          onSelect={onRespond}
          onTimeout={() => onRespond("TIMEOUT")}
          disabled={disabled}
        />
      );
    default:
      return <p className="px-4 py-3 text-sm text-slate-500">Unknown element type: {elementType}</p>;
  }
}

"use client";

import { useState } from "react";

interface StageConfidenceRatingProps {
  prompt: string;
  onSelect: (value: string) => void;
  disabled?: boolean;
}

const OPTIONS = [
  { label: "Very Confident", value: "VERY_CONFIDENT" },
  { label: "Somewhat", value: "SOMEWHAT_CONFIDENT" },
  { label: "Not Sure", value: "NOT_SURE" },
] as const;

export function StageConfidenceRating({ prompt, onSelect, disabled }: StageConfidenceRatingProps) {
  const [selected, setSelected] = useState<string | null>(null);

  const handleSelect = (value: string) => {
    if (disabled || selected) return;
    setSelected(value);
    onSelect(value);
  };

  return (
    <div className="flex flex-col gap-3 w-full max-w-lg" aria-label={prompt}>
      <div className="flex gap-2" role="radiogroup" aria-label={prompt}>
        {OPTIONS.map((opt) => {
          const isSelected = selected === opt.value;
          const isFaded = selected !== null && !isSelected;

          return (
            <button
              key={opt.value}
              role="radio"
              aria-checked={isSelected}
              onClick={() => handleSelect(opt.value)}
              disabled={disabled || !!selected}
              className="flex-1 stage-animate"
              style={{
                padding: "11px 22px",
                borderRadius: "8px",
                border: isSelected
                  ? "1px solid rgba(37, 99, 235, 0.4)"
                  : "1px solid rgba(255, 255, 255, 0.07)",
                background: isSelected
                  ? "rgba(37, 99, 235, 0.1)"
                  : "rgba(255, 255, 255, 0.03)",
                color: isFaded
                  ? "rgba(255, 255, 255, 0.3)"
                  : "rgba(255, 255, 255, 0.85)",
                opacity: isFaded ? 0.3 : 1,
                cursor: disabled || selected ? "default" : "pointer",
                fontFamily: "var(--font-display)",
                fontSize: "13px",
                fontWeight: 400,
                textAlign: "center",
                transition: "all 300ms ease",
              }}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

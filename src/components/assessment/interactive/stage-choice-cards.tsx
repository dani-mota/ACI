"use client";

import { useState } from "react";

interface StageChoiceCardsProps {
  prompt: string;
  options: string[];
  onSelect: (value: string) => void;
  disabled?: boolean;
}

export function StageChoiceCards({ prompt, options, onSelect, disabled }: StageChoiceCardsProps) {
  const [selected, setSelected] = useState<string | null>(null);

  const handleSelect = (option: string) => {
    if (disabled || selected) return;
    setSelected(option);
    onSelect(option);
  };

  return (
    <div className="flex flex-col gap-2 w-full max-w-lg" role="group" aria-label={prompt}>
      <div className="flex flex-col gap-2" role="radiogroup" aria-label={prompt}>
        {options.map((option, i) => {
          const isSelected = selected === option;
          const isFaded = selected !== null && !isSelected;
          // Strip leading letter prefix (e.g., "A) " or "A. ")
          const label = option.replace(/^[A-Za-z]\)\s*|^[A-Za-z]\.\s*/, "");

          return (
            <button
              key={i}
              role="radio"
              aria-checked={isSelected}
              onClick={() => handleSelect(option)}
              disabled={disabled || !!selected}
              className="stage-animate"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                padding: "15px 18px",
                borderRadius: "10px",
                border: isSelected
                  ? "1px solid rgba(37, 99, 235, 0.4)"
                  : "1px solid rgba(255, 255, 255, 0.07)",
                background: isSelected
                  ? "rgba(37, 99, 235, 0.1)"
                  : "rgba(255, 255, 255, 0.03)",
                color: isFaded ? "rgba(255, 255, 255, 0.3)" : "rgba(255, 255, 255, 0.85)",
                cursor: disabled || selected ? "default" : "pointer",
                opacity: isFaded ? 0.3 : 1,
                transform: !selected && !disabled ? undefined : undefined,
                transition: "all 300ms ease",
                textAlign: "left",
                fontFamily: "var(--font-display)",
                fontSize: "14px",
                fontWeight: 400,
              }}
              onMouseEnter={(e) => {
                if (!selected && !disabled) {
                  (e.currentTarget as HTMLElement).style.transform = "translateX(3px)";
                  (e.currentTarget as HTMLElement).style.borderColor = "rgba(37, 99, 235, 0.2)";
                }
              }}
              onMouseLeave={(e) => {
                if (!selected && !disabled) {
                  (e.currentTarget as HTMLElement).style.transform = "translateX(0)";
                  (e.currentTarget as HTMLElement).style.borderColor = "rgba(255, 255, 255, 0.07)";
                }
              }}
            >
              <span
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: "30px",
                  height: "30px",
                  borderRadius: "7px",
                  fontFamily: "var(--font-mono)",
                  fontSize: "12px",
                  fontWeight: 400,
                  flexShrink: 0,
                  background: isSelected
                    ? "#2563EB"
                    : "rgba(255, 255, 255, 0.06)",
                  color: isSelected
                    ? "#fff"
                    : "rgba(255, 255, 255, 0.5)",
                  transition: "all 300ms ease",
                }}
              >
                {String.fromCharCode(65 + i)}
              </span>
              <span>{label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

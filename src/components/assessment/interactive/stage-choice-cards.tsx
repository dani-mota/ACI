"use client";

import { useState, useEffect, useRef } from "react";

interface StageChoiceCardsProps {
  prompt: string;
  options: string[];
  onSelect: (value: string) => void;
  disabled?: boolean;
}

export function StageChoiceCards({ prompt, options, onSelect, disabled }: StageChoiceCardsProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const groupRef = useRef<HTMLDivElement>(null);

  const handleSelect = (option: string) => {
    if (disabled || selected) return;
    setSelected(option);
    onSelect(option);
  };

  // Keyboard support: A/B/C/D letter keys + arrow keys for radiogroup
  useEffect(() => {
    if (disabled || selected) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Letter key shortcuts
      const key = e.key.toUpperCase();
      const letterIndex = key.charCodeAt(0) - 65;
      if (letterIndex >= 0 && letterIndex < options.length) {
        e.preventDefault();
        handleSelect(options[letterIndex]);
        return;
      }

      // Arrow key navigation within radiogroup
      if (!groupRef.current) return;
      const buttons = groupRef.current.querySelectorAll<HTMLElement>('[role="radio"]');
      if (!buttons.length) return;

      if (e.key === "ArrowDown" || e.key === "ArrowRight") {
        e.preventDefault();
        const next = (focusedIndex + 1) % options.length;
        setFocusedIndex(next);
        buttons[next]?.focus();
      } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
        e.preventDefault();
        const next = (focusedIndex - 1 + options.length) % options.length;
        setFocusedIndex(next);
        buttons[next]?.focus();
      } else if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        handleSelect(options[focusedIndex]);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [disabled, selected, options, focusedIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      className="flex flex-col gap-3 w-full max-w-lg"
      role="group"
      aria-label={prompt}
      style={{
        animation: "cardIn 0.4s cubic-bezier(0.16,1,0.3,1) both",
      }}
    >
      {/* Blue accent bar on left edge */}
      <div
        style={{
          borderLeft: "3px solid var(--s-blue, #2563EB)",
          borderRadius: "0 10px 10px 0",
          background: "var(--s-glass, rgba(9,15,30,0.88))",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          padding: "16px 20px",
        }}
      >
        {/* Question text */}
        <p
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "15px",
            fontWeight: 400,
            lineHeight: 1.7,
            color: "var(--s-t1, #c9d6e8)",
            margin: "0 0 16px 0",
          }}
        >
          {prompt}
        </p>

        {/* Options */}
        <div ref={groupRef} className="flex flex-col gap-2" role="radiogroup" aria-label={prompt}>
          {options.map((option, i) => {
            const isSelected = selected === option;
            const isFaded = selected !== null && !isSelected;
            const label = option.replace(/^[A-Za-z]\)\s*|^[A-Za-z]\.\s*/, "");
            const letter = String.fromCharCode(65 + i);

            return (
              <button
                key={i}
                role="radio"
                aria-checked={isSelected}
                tabIndex={i === focusedIndex ? 0 : -1}
                onClick={() => handleSelect(option)}
                onFocus={() => setFocusedIndex(i)}
                disabled={disabled || !!selected}
                className="stage-animate"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  padding: "12px 15px",
                  borderRadius: "10px",
                  border: isSelected
                    ? "1px solid rgba(37,99,235,0.5)"
                    : "1px solid rgba(255,255,255,0.06)",
                  background: isSelected
                    ? "rgba(37,99,235,0.12)"
                    : "transparent",
                  color: isFaded
                    ? "rgba(255,255,255,0.25)"
                    : "var(--s-t2, #7b8fa8)",
                  cursor: disabled || selected ? "default" : "pointer",
                  opacity: isFaded ? 0.3 : 1,
                  transform: "translateX(0)",
                  transition: "all 300ms ease",
                  textAlign: "left",
                  fontFamily: "var(--font-display)",
                  fontSize: "13.5px",
                  fontWeight: 400,
                }}
                onMouseEnter={(e) => {
                  if (!selected && !disabled) {
                    (e.currentTarget as HTMLElement).style.transform = "translateX(3px)";
                    (e.currentTarget as HTMLElement).style.borderColor = "rgba(37,99,235,0.25)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!selected && !disabled) {
                    (e.currentTarget as HTMLElement).style.transform = "translateX(0)";
                    (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.06)";
                  }
                }}
              >
                {/* Letter badge — circle */}
                <span
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: "27px",
                    height: "27px",
                    borderRadius: "50%",
                    fontFamily: "var(--font-mono)",
                    fontSize: "11px",
                    fontWeight: 700,
                    flexShrink: 0,
                    background: isSelected
                      ? "var(--s-blue, #2563EB)"
                      : "rgba(255,255,255,0.05)",
                    color: isSelected
                      ? "#fff"
                      : "rgba(255,255,255,0.45)",
                    border: isSelected
                      ? "none"
                      : "1px solid rgba(255,255,255,0.08)",
                    transition: "all 300ms ease",
                  }}
                >
                  {letter}
                </span>
                <span style={{ lineHeight: 1.5 }}>{label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

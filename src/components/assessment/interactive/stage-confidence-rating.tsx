"use client";

import { useState, useEffect, useRef } from "react";

interface StageConfidenceRatingProps {
  prompt: string;
  onSelect: (value: string) => void;
  disabled?: boolean;
}

const OPTIONS = [
  {
    label: "Very Confident",
    value: "VERY_CONFIDENT",
    subText: "I'm sure of my answer",
    icon: "check",
    color: "var(--s-green, #059669)",
    colorBg: "rgba(5,150,105,0.08)",
    colorBorder: "rgba(5,150,105,0.4)",
  },
  {
    label: "Somewhat",
    value: "SOMEWHAT_CONFIDENT",
    subText: "Reasonably certain",
    icon: "tilde",
    color: "var(--s-gold, #C9A84C)",
    colorBg: "rgba(201,168,76,0.08)",
    colorBorder: "rgba(201,168,76,0.4)",
  },
  {
    label: "Not Sure",
    value: "NOT_SURE",
    subText: "I was guessing",
    icon: "question",
    color: "var(--s-t2, #7b8fa8)",
    colorBg: "rgba(123,143,168,0.08)",
    colorBorder: "rgba(123,143,168,0.4)",
  },
] as const;

function ConfidenceIcon({ type, color }: { type: string; color: string }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      {type === "check" && <polyline points="20 6 9 17 4 12" />}
      {type === "tilde" && <path d="M4 12c1.5-2 3.5-2 5 0s3.5 2 5 0 3.5-2 5 0" />}
      {type === "question" && (
        <>
          <circle cx="12" cy="12" r="10" />
          <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </>
      )}
    </svg>
  );
}

export function StageConfidenceRating({ prompt, onSelect, disabled }: StageConfidenceRatingProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const groupRef = useRef<HTMLDivElement>(null);

  const handleSelect = (value: string) => {
    if (disabled || selected) return;
    setSelected(value);
    onSelect(value);
  };

  // Arrow key navigation for radiogroup
  useEffect(() => {
    if (disabled || selected) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!groupRef.current) return;
      const buttons = groupRef.current.querySelectorAll<HTMLElement>('[role="radio"]');
      if (!buttons.length) return;

      if (e.key === "ArrowDown" || e.key === "ArrowRight") {
        e.preventDefault();
        const next = (focusedIndex + 1) % OPTIONS.length;
        setFocusedIndex(next);
        buttons[next]?.focus();
      } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
        e.preventDefault();
        const next = (focusedIndex - 1 + OPTIONS.length) % OPTIONS.length;
        setFocusedIndex(next);
        buttons[next]?.focus();
      } else if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        handleSelect(OPTIONS[focusedIndex].value);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [disabled, selected, focusedIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      className="flex flex-col gap-4 w-full max-w-lg"
      aria-label={prompt}
      style={{ animation: "cardIn 0.4s cubic-bezier(0.16,1,0.3,1) both" }}
    >
      {/* Green accent bar + prompt */}
      <div
        style={{
          borderLeft: "3px solid var(--s-green, #059669)",
          borderRadius: "0 10px 10px 0",
          background: "var(--s-glass, rgba(9,15,30,0.88))",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          padding: "14px 20px",
        }}
      >
        <p
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "15px",
            fontWeight: 400,
            lineHeight: 1.7,
            color: "var(--s-t1, #c9d6e8)",
            margin: 0,
          }}
        >
          {prompt}
        </p>
      </div>

      {/* Three icon cards in a row */}
      <div ref={groupRef} className="flex gap-3" role="radiogroup" aria-label={prompt}>
        {OPTIONS.map((opt, optIndex) => {
          const isSelected = selected === opt.value;
          const isFaded = selected !== null && !isSelected;

          return (
            <button
              key={opt.value}
              role="radio"
              aria-checked={isSelected}
              tabIndex={optIndex === focusedIndex ? 0 : -1}
              onClick={() => handleSelect(opt.value)}
              onFocus={() => setFocusedIndex(optIndex)}
              disabled={disabled || !!selected}
              className="flex-1 stage-animate"
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "8px",
                padding: "18px 12px",
                borderRadius: "10px",
                border: isSelected
                  ? `1px solid ${opt.colorBorder}`
                  : "1px solid rgba(255,255,255,0.06)",
                background: isSelected
                  ? opt.colorBg
                  : "rgba(255,255,255,0.02)",
                opacity: isFaded ? 0.25 : 1,
                cursor: disabled || selected ? "default" : "pointer",
                transition: "all 300ms ease",
              }}
            >
              {/* Icon */}
              <ConfidenceIcon type={opt.icon} color={isSelected ? opt.color : "rgba(255,255,255,0.3)"} />

              {/* Label */}
              <span
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "13px",
                  fontWeight: 500,
                  color: isSelected ? opt.color : "var(--s-t2, #7b8fa8)",
                  transition: "color 300ms ease",
                }}
              >
                {opt.label}
              </span>

              {/* Sub-text */}
              <span
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "10px",
                  fontWeight: 300,
                  color: "var(--s-t3, #3d5068)",
                }}
              >
                {opt.subText}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

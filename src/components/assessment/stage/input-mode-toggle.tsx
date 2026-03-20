"use client";

import type { InputMode } from "@/stores/chat-assessment-store";

interface InputModeToggleProps {
  mode: InputMode;
  onToggle: (mode: InputMode) => void;
  speechSupported?: boolean;
}

export function InputModeToggle({ mode, onToggle, speechSupported = true }: InputModeToggleProps) {
  return (
    <div className="flex gap-1">
      {speechSupported && (
        <button
          onClick={() => onToggle("voice")}
          aria-pressed={mode === "voice"} /* Fix: PRO-61 */
          className="stage-animate"
          style={{
            padding: "5px 14px",
            borderRadius: "16px",
            fontFamily: "var(--font-mono)",
            fontSize: "11px", // Fix: PRO-53
            letterSpacing: "0.5px",
            textTransform: "uppercase",
            border:
              mode === "voice"
                ? "1px solid var(--s-blue, #2563EB)"
                : "1px solid rgba(255, 255, 255, 0.06)",
            color:
              mode === "voice"
                ? "var(--s-blue, #2563EB)"
                : "color-mix(in srgb, var(--s-t4, #b8c4d6) 50%, transparent)",
            background:
              mode === "voice"
                ? "rgba(37, 99, 235, 0.06)"
                : "transparent",
            cursor: "pointer",
            transition: "all 200ms ease",
          }}
        >
          Voice
        </button>
      )}
      <button
        onClick={() => onToggle("text")}
        aria-pressed={mode === "text"} /* Fix: PRO-61 */
        className="stage-animate"
        style={{
          padding: "5px 14px",
          borderRadius: "16px",
          fontFamily: "var(--font-mono)",
          fontSize: "11px", // Fix: PRO-53
          letterSpacing: "0.5px",
          textTransform: "uppercase",
          border:
            mode === "text"
              ? "1px solid var(--s-blue, #2563EB)"
              : "1px solid rgba(255, 255, 255, 0.06)",
          color:
            mode === "text"
              ? "var(--s-blue, #2563EB)"
              : "color-mix(in srgb, var(--s-t4, #b8c4d6) 50%, transparent)",
          background:
            mode === "text"
              ? "rgba(37, 99, 235, 0.06)"
              : "transparent",
          cursor: "pointer",
          transition: "all 200ms ease",
        }}
      >
        Type
      </button>
    </div>
  );
}

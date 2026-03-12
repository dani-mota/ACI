"use client";

import type { InputMode } from "@/stores/chat-assessment-store";

interface InputModeToggleProps {
  mode: InputMode;
  onToggle: (mode: InputMode) => void;
}

export function InputModeToggle({ mode, onToggle }: InputModeToggleProps) {
  return (
    <div className="flex gap-1">
      <button
        onClick={() => onToggle("voice")}
        className="stage-animate"
        style={{
          padding: "5px 14px",
          borderRadius: "16px",
          fontFamily: "var(--font-mono)",
          fontSize: "9px",
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
      <button
        onClick={() => onToggle("text")}
        className="stage-animate"
        style={{
          padding: "5px 14px",
          borderRadius: "16px",
          fontFamily: "var(--font-mono)",
          fontSize: "9px",
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

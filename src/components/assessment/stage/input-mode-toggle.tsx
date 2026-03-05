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
              ? "1px solid #2563EB"
              : "1px solid rgba(255, 255, 255, 0.06)",
          color:
            mode === "voice"
              ? "#2563EB"
              : "rgba(184, 196, 214, 0.5)",
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
              ? "1px solid #2563EB"
              : "1px solid rgba(255, 255, 255, 0.06)",
          color:
            mode === "text"
              ? "#2563EB"
              : "rgba(184, 196, 214, 0.5)",
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

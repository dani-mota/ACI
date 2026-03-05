"use client";

import { useState } from "react";

interface StageNumericInputProps {
  prompt: string;
  onSubmit: (value: string) => void;
  disabled?: boolean;
}

export function StageNumericInput({ prompt, onSubmit, disabled }: StageNumericInputProps) {
  const [value, setValue] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = () => {
    if (!value.trim() || disabled || submitted) return;
    setSubmitted(true);
    onSubmit(value.trim());
  };

  return (
    <div className="flex flex-col gap-3 w-full max-w-lg items-center" aria-label={prompt}>
      <div className="flex gap-2 w-full max-w-xs">
        <input
          type="text"
          inputMode="decimal"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          disabled={disabled || submitted}
          placeholder="Enter your answer..."
          className="flex-1 px-4 py-3 text-sm outline-none"
          style={{
            borderRadius: "10px",
            border: "1px solid rgba(255, 255, 255, 0.07)",
            background: "rgba(255, 255, 255, 0.03)",
            color: "rgba(255, 255, 255, 0.85)",
            fontFamily: "var(--font-mono)",
            fontSize: "14px",
          }}
        />
        <button
          onClick={handleSubmit}
          disabled={disabled || !value.trim() || submitted}
          style={{
            padding: "0 20px",
            borderRadius: "10px",
            border: "1px solid rgba(37, 99, 235, 0.3)",
            background: "rgba(37, 99, 235, 0.15)",
            color: value.trim() ? "#60a5fa" : "rgba(255, 255, 255, 0.3)",
            fontFamily: "var(--font-mono)",
            fontSize: "12px",
            letterSpacing: "1px",
            textTransform: "uppercase",
            cursor: disabled || !value.trim() || submitted ? "default" : "pointer",
            transition: "all 200ms ease",
          }}
        >
          Submit
        </button>
      </div>
    </div>
  );
}

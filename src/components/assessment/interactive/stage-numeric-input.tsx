"use client";

import { useState } from "react";

interface StageNumericInputProps {
  prompt: string;
  onSubmit: (value: string) => void;
  disabled?: boolean;
  unit?: string;
}

export function StageNumericInput({ prompt, onSubmit, disabled, unit }: StageNumericInputProps) {
  const [value, setValue] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validate = (v: string): boolean => {
    const trimmed = v.trim();
    if (!trimmed) return false;
    if (isNaN(Number(trimmed))) {
      setError("Please enter a valid number");
      return false;
    }
    setError(null);
    return true;
  };

  const handleSubmit = () => {
    if (disabled || submitted) return;
    if (!validate(value)) return;
    setSubmitted(true);
    onSubmit(value.trim());
  };

  const handleChange = (v: string) => {
    setValue(v);
    if (error) setError(null);
  };

  const hasValidInput = value.trim() && !isNaN(Number(value.trim()));

  return (
    <div
      className="flex flex-col gap-4 w-full max-w-lg"
      aria-label={prompt}
      style={{ animation: "cardIn 0.4s cubic-bezier(0.16,1,0.3,1) both" }}
    >
      {/* Question card with blue accent bar */}
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

      {/* Centered input area */}
      <div className="flex flex-col items-center gap-2">
        <div className="flex items-center justify-center gap-3">
          <input
            type="text"
            inputMode="decimal"
            aria-label="Enter your numeric answer"
            value={value}
            onChange={(e) => handleChange(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            disabled={disabled || submitted}
            placeholder="0"
            className="text-center outline-none"
            style={{
              width: "180px",
              padding: "12px 16px",
              borderRadius: "8px",
              border: submitted
                ? "1px solid var(--s-green, #059669)"
                : error
                  ? "1px solid var(--s-red, #DC2626)"
                  : "1px solid rgba(255,255,255,0.08)",
              background: "rgba(255,255,255,0.03)",
              color: "var(--s-t1, #c9d6e8)",
              fontFamily: "var(--font-mono)",
              fontSize: "26px",
              fontWeight: 300,
              fontVariantNumeric: "tabular-nums",
              transition: "border-color 300ms ease",
            }}
          />
          {unit && (
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "14px",
                fontWeight: 400,
                color: "var(--s-t3, #3d5068)",
              }}
            >
              {unit}
            </span>
          )}
        </div>

        {/* Validation error notification */}
        {error && (
          <p
            role="alert"
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "10px",
              fontWeight: 500,
              color: "var(--s-red, #DC2626)",
              letterSpacing: "0.5px",
              margin: 0,
              animation: "cardIn 0.3s ease both",
            }}
          >
            {error}
          </p>
        )}
      </div>

      {/* Submit button */}
      <div className="flex justify-center">
        <button
          onClick={handleSubmit}
          disabled={disabled || !value.trim() || submitted}
          style={{
            padding: "12px 32px",
            minHeight: "44px",
            borderRadius: "8px",
            border: hasValidInput
              ? "1px solid rgba(37,99,235,0.3)"
              : "1px solid rgba(255,255,255,0.06)",
            background: hasValidInput
              ? "rgba(37,99,235,0.12)"
              : "transparent",
            color: hasValidInput
              ? "var(--s-blue-g, #4a8af5)"
              : "rgba(255,255,255,0.2)",
            fontFamily: "var(--font-mono)",
            fontSize: "10px",
            fontWeight: 600,
            letterSpacing: "2px",
            textTransform: "uppercase",
            cursor: disabled || !hasValidInput || submitted ? "default" : "pointer",
            transition: "all 200ms ease",
          }}
        >
          Submit
        </button>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState, useRef, useCallback } from "react";

interface Phase0BreakScreenProps {
  duration?: number;
  onContinue: () => void;
  visible: boolean;
}

export function Phase0BreakScreen({
  duration = 20,
  onContinue,
  visible,
}: Phase0BreakScreenProps) {
  const [remaining, setRemaining] = useState(duration);
  const [fadingOut, setFadingOut] = useState(false);
  const [entered, setEntered] = useState(false);
  const calledRef = useRef(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const handleContinue = useCallback(() => {
    if (calledRef.current) return;
    calledRef.current = true;
    if (intervalRef.current) clearInterval(intervalRef.current);
    setFadingOut(true);
    setTimeout(onContinue, 500);
  }, [onContinue]);

  // Staggered entrance
  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(() => setEntered(true), 300);
    return () => clearTimeout(timer);
  }, [visible]);

  // Countdown timer
  useEffect(() => {
    if (!visible) return;
    calledRef.current = false;
    setRemaining(duration);

    intervalRef.current = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          if (intervalRef.current) clearInterval(intervalRef.current);
          setTimeout(handleContinue, 0);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [visible, duration, handleContinue]);

  if (!visible) return null;

  return (
    <div
      className="absolute left-0 right-0 z-30 flex flex-col items-center pointer-events-none"
      style={{
        top: "calc(38% + 140px)",
        opacity: fadingOut ? 0 : 1,
        transition: "opacity 500ms ease-out",
      }}
    >
      {/* Message */}
      <p
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "15px",
          fontWeight: 300,
          color: "rgba(184, 196, 214, 0.55)",
          letterSpacing: "0.3px",
          marginBottom: "24px",
          opacity: entered ? 1 : 0,
          transform: entered ? "translateY(0)" : "translateY(12px)",
          transition: "opacity 800ms ease, transform 800ms ease",
        }}
      >
        Your assessment is about to begin
      </p>

      {/* Countdown number */}
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "40px",
          fontWeight: 200,
          fontVariantNumeric: "tabular-nums",
          color: "rgba(184, 196, 214, 0.5)",
          marginBottom: "28px",
          opacity: entered ? 1 : 0,
          transform: entered ? "translateY(0)" : "translateY(12px)",
          transition: "opacity 800ms ease 200ms, transform 800ms ease 200ms",
        }}
      >
        {remaining}
      </div>

      {/* Continue button */}
      <button
        onClick={handleContinue}
        className="group flex items-center gap-2 px-5 py-2.5"
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "13px",
          fontWeight: 400,
          color: "rgba(184, 196, 214, 0.5)",
          background: "rgba(255, 255, 255, 0.03)",
          border: "1px solid rgba(255, 255, 255, 0.07)",
          borderRadius: "8px",
          cursor: "pointer",
          transition: "all 200ms ease",
          letterSpacing: "0.3px",
          pointerEvents: "auto",
          opacity: entered ? 1 : 0,
          transform: entered ? "translateY(0)" : "translateY(12px)",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = "rgba(184, 196, 214, 0.8)";
          e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.15)";
          e.currentTarget.style.background = "rgba(255, 255, 255, 0.05)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = "rgba(184, 196, 214, 0.5)";
          e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.07)";
          e.currentTarget.style.background = "rgba(255, 255, 255, 0.03)";
        }}
      >
        Continue
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="5" y1="12" x2="19" y2="12" />
          <polyline points="12 5 19 12 12 19" />
        </svg>
      </button>
    </div>
  );
}

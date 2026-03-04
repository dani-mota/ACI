"use client";

import { useEffect, useState } from "react";

interface CinematicLoadingProps {
  onComplete: () => void;
}

const MESSAGES = [
  "Analyzing cognitive patterns...",
  "Mapping technical aptitude profile...",
  "Evaluating behavioral integrity signals...",
  "Computing composite indices across 5 roles...",
  "Generating candidate intelligence report...",
  "Building your personalized dashboard...",
];

export function CinematicLoading({ onComplete }: CinematicLoadingProps) {
  const [currentMsg, setCurrentMsg] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const msgInterval = setInterval(() => {
      setCurrentMsg((prev) => {
        if (prev >= MESSAGES.length - 1) return prev;
        return prev + 1;
      });
    }, 2500);

    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) return 100;
        return prev + 0.8;
      });
    }, 120);

    const timeout = setTimeout(() => {
      onComplete();
    }, 15000);

    return () => {
      clearInterval(msgInterval);
      clearInterval(progressInterval);
      clearTimeout(timeout);
    };
  }, [onComplete]);

  return (
    <div className="min-h-screen bg-aci-navy flex flex-col items-center justify-center p-4">
      {/* ACI Logo */}
      <h1 className="text-4xl font-bold text-white tracking-[0.2em] mb-12" style={{ fontFamily: "var(--font-dm-sans)" }}>
        ACI
      </h1>

      {/* Messages */}
      <div className="h-8 mb-8 relative">
        {MESSAGES.map((msg, i) => (
          <p
            key={i}
            className={`text-center text-xs font-mono uppercase tracking-wider transition-all duration-700 absolute left-0 right-0 ${
              i === currentMsg
                ? "opacity-100 translate-y-0"
                : i < currentMsg
                  ? "opacity-0 -translate-y-4"
                  : "opacity-0 translate-y-4"
            }`}
            style={{ color: "rgba(197, 168, 76, 0.9)" }}
          >
            {msg}
          </p>
        ))}
      </div>

      {/* Progress bar */}
      <div className="w-80 max-w-full">
        <div className="h-0.5 bg-white/10 overflow-hidden">
          <div
            className="h-full transition-all duration-300 ease-out"
            style={{
              width: `${Math.min(progress, 100)}%`,
              background: "linear-gradient(90deg, #0EA5E9, #38BDF8)",
            }}
          />
        </div>
        <p className="text-center text-[10px] text-white/30 mt-3 font-mono">
          {Math.round(Math.min(progress, 100))}% complete
        </p>
      </div>
    </div>
  );
}

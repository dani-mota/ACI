"use client";

import { useEffect, useRef } from "react";

interface SubtitleDisplayProps {
  text: string;
  revealedWords: number;
  isRevealing: boolean;
}

export function SubtitleDisplay({ text, revealedWords, isRevealing }: SubtitleDisplayProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const words = text ? text.split(/\s+/) : [];

  // Scroll to latest revealed word
  useEffect(() => {
    if (containerRef.current && isRevealing) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [revealedWords, isRevealing]);

  if (!text) return <div className="min-h-[52px]" />;

  return (
    <div className="text-center max-w-[540px] mx-auto px-4 min-h-[52px]">
      {/* Visible subtitle with word-by-word reveal */}
      <p
        ref={containerRef}
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "17px",
          fontWeight: 300,
          lineHeight: 1.75,
          color: "#b8c4d6",
        }}
        className="max-sm:text-[15px]"
      >
        {words.map((word, i) => (
          <span
            key={`${i}-${word}`}
            className="stage-animate"
            style={{
              opacity: i < revealedWords ? 1 : 0,
              transition: "opacity 120ms ease",
              display: "inline",
            }}
          >
            {word}{" "}
          </span>
        ))}
      </p>

      {/* Screen reader: full text immediately */}
      <div className="sr-only" aria-live="polite">
        {text}
      </div>
    </div>
  );
}

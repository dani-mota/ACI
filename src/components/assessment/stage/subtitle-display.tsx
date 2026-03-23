"use client";

import { useEffect, useRef, useState } from "react";

interface SubtitleDisplayProps {
  text: string;
  revealedWords: number;
  isRevealing: boolean;
  /** Compact mode for sidebar — smaller font, no max-width */
  compact?: boolean;
}

// Safety-net: strip any structural markers that leaked past the parser
function stripMarkdown(s: string): string {
  return s
    .replace(/^#+\s+.*$/gm, "")                    // # headers
    .replace(/\[(?:spoken\s*text|SPOKEN|spoken|REFERENCE|Reference\s*Card)[^\]]*\]/gi, "") // bracket tags
    .replace(/-{3,}\s*(?:REFERENCE[_\s]*UPDATE?|REFERENCE)?\s*-{0,}/g, "")  // delimiter lines
    .replace(/^(?:SITUATION|INITIAL[_\s]SITUATION|COMPLICATION)\s*$/gm, "")  // beat labels
    .replace(/^[A-Z][A-Z_\s]+\s*---.*$/gm, "")     // "SITUATION ---" pattern
    .replace(/\*\*(.+?)\*\*/g, "$1")                // **bold**
    .replace(/\*(.+?)\*/g, "$1")                    // *italic*
    .replace(/__(.+?)__/g, "$1")                    // __bold__
    .replace(/_(.+?)_/g, "$1")                      // _italic_
    .replace(/~~(.+?)~~/g, "$1")                    // ~~strikethrough~~
    .replace(/`(.+?)`/g, "$1")                      // `code`
    .trim();
}

export function SubtitleDisplay({ text, revealedWords, isRevealing, compact }: SubtitleDisplayProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const prevTextRef = useRef(text);
  const [fadingOut, setFadingOut] = useState(false);
  const [displayText, setDisplayText] = useState(text);

  const words = displayText ? stripMarkdown(displayText).split(/\s+/) : [];

  // Handle text transitions with crossfade
  useEffect(() => {
    if (prevTextRef.current && !text) {
      // Text was cleared — fade out, then remove
      requestAnimationFrame(() => setFadingOut(true));
      const timer = setTimeout(() => {
        setFadingOut(false);
        setDisplayText("");
      }, 500);
      prevTextRef.current = text;
      return () => clearTimeout(timer);
    }
    if (prevTextRef.current && text && text !== prevTextRef.current) {
      // Sentence changed — crossfade: fade out old, swap, fade in new
      requestAnimationFrame(() => setFadingOut(true));
      const timer = setTimeout(() => {
        setDisplayText(text);
        setFadingOut(false);
      }, 300);
      prevTextRef.current = text;
      return () => clearTimeout(timer);
    }
    // First text or same text
    requestAnimationFrame(() => {
      setFadingOut(false);
      setDisplayText(text);
    });
    prevTextRef.current = text;
  }, [text]);

  // Scroll to latest revealed word
  useEffect(() => {
    if (containerRef.current && isRevealing) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [revealedWords, isRevealing]);

  if (!displayText && !fadingOut) return <div className={compact ? "min-h-[32px]" : "min-h-[52px]"} />;

  return (
    <div
      className={compact ? "text-center w-full px-1 min-h-[32px]" : "text-center max-w-[540px] mx-auto px-4 min-h-[52px]"}
      style={{
        opacity: fadingOut ? 0 : 1,
        transition: "opacity 300ms ease",
      }}
    >
      {/* Visible subtitle with word-by-word reveal */}
      <p
        ref={containerRef}
        style={{
          fontFamily: "var(--font-display)",
          fontSize: compact ? "13px" : "17px",
          fontWeight: 300,
          lineHeight: compact ? 1.6 : 1.75,
          color: "var(--s-t4, #b8c4d6)",
        }}
        className={compact ? "" : "max-sm:text-[15px]"}
      >
        {words.map((word, i) => {
          const revealed = i < revealedWords;
          const isCursor = revealed && i === revealedWords - 1 && isRevealing;
          return (
            <span
              key={`${i}-${word}`}
              className="stage-animate"
              style={{
                opacity: revealed ? 1 : 0,
                color: isCursor ? "#ffffff" : "var(--s-t4, #b8c4d6)",
                transition: "opacity 150ms ease, color 400ms ease",
                display: "inline",
              }}
            >
              {word}{" "}
            </span>
          );
        })}
      </p>

      {/* Screen reader: full text immediately */}
      <div className="sr-only" aria-live="polite">
        {displayText}
      </div>
    </div>
  );
}

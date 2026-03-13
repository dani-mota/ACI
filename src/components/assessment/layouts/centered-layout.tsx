"use client";

import type { ReactNode } from "react";

interface CenteredLayoutProps {
  actLabel: ReactNode;
  orb: ReactNode;
  content: ReactNode;
  input: ReactNode;
  showInput: boolean;
  /** Orb vertical offset — default 38% */
  orbTop?: string;
  /** Orb horizontal position — default 50% (center), can animate to 71% for Phase 0→Act 1 glide */
  orbLeft?: string;
  /** CSS transition for orb position changes */
  orbTransition?: string;
}

/**
 * Centered layout — used for Format 1 (Conversational), Format 8 (Transition), Format 9 (Completion).
 * Orb centered with content below and input pinned to bottom.
 */
export function CenteredLayout({
  actLabel,
  orb,
  content,
  input,
  showInput,
  orbTop = "38%",
  orbLeft = "50%",
  orbTransition = "top 1000ms cubic-bezier(0.25,0.1,0.25,1), left 1000ms cubic-bezier(0.25,0.1,0.25,1)",
}: CenteredLayoutProps) {
  return (
    <div className="relative h-full">
      {/* Act label — above orb center */}
      <div
        className="absolute left-0 right-0 flex justify-center z-10"
        style={{ top: `calc(${orbTop} - 130px)` }}
      >
        {actLabel}
      </div>

      {/* Orb — center anchor */}
      <div
        className="absolute"
        style={{
          top: orbTop,
          left: orbLeft,
          transform: "translate(-50%, -50%)",
          zIndex: 1,
          transition: orbTransition,
        }}
      >
        {orb}
      </div>

      {/* Content — below orb */}
      <div
        className="absolute left-0 right-0 flex flex-col items-center gap-2 px-4 overflow-y-auto"
        style={{
          top: `calc(${orbTop} + 140px)`,
          zIndex: 2,
          bottom: showInput ? "100px" : "48px",
          maskImage: "linear-gradient(to bottom, black 80%, transparent)",
          WebkitMaskImage: "linear-gradient(to bottom, black 80%, transparent)",
        }}
      >
        {content}
      </div>

      {/* Input — pinned to bottom */}
      {showInput && (
        <div
          className="absolute left-0 right-0 bottom-0 flex flex-col items-center gap-3 pb-4 px-4"
          style={{ transition: "opacity 300ms ease" }}
        >
          {input}
        </div>
      )}
    </div>
  );
}

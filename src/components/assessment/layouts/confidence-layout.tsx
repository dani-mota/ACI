"use client";

import type { ReactNode } from "react";

interface ConfidenceLayoutProps {
  actLabel: ReactNode;
  orb: ReactNode;
  subtitle: ReactNode;
  interactiveElement: ReactNode;
  input: ReactNode;
  showInput: boolean;
  showElements: boolean;
}

/**
 * Centered layout with interactive element below subtitles — Format 7 (Confidence Rating).
 * Also used when Act 3 has interactive elements in centered mode.
 */
export function ConfidenceLayout({
  actLabel,
  orb,
  subtitle,
  interactiveElement,
  input,
  showInput,
  showElements,
}: ConfidenceLayoutProps) {
  return (
    <div className="relative flex-1">
      {/* Act label */}
      <div
        className="absolute left-0 right-0 flex justify-center z-10"
        style={{ top: "calc(38% - 130px)" }}
      >
        {actLabel}
      </div>

      {/* Orb */}
      <div
        className="absolute"
        style={{
          top: "38%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          zIndex: 1,
        }}
      >
        {orb}
      </div>

      {/* Content below orb */}
      <div
        className="absolute left-0 right-0 flex flex-col items-center gap-2 px-4 overflow-y-auto"
        style={{
          top: "calc(38% + 140px)",
          zIndex: 2,
          bottom: showInput ? "100px" : "48px",
          maskImage: "linear-gradient(to bottom, black 80%, transparent)",
          WebkitMaskImage: "linear-gradient(to bottom, black 80%, transparent)",
        }}
      >
        {subtitle}

        {/* Interactive element (confidence rating) */}
        <div
          className="w-full flex justify-center"
          style={{
            opacity: showElements ? 1 : 0,
            transform: showElements ? "translateY(0)" : "translateY(24px)",
            transition:
              "opacity 700ms cubic-bezier(0.25,0.1,0.25,1), transform 700ms cubic-bezier(0.25,0.1,0.25,1)",
          }}
        >
          {interactiveElement}
        </div>
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

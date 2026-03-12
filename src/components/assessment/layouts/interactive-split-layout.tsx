"use client";

import type { ReactNode } from "react";

interface InteractiveSplitLayoutProps {
  interactiveElement: ReactNode;
  sidebar: ReactNode;
  showElements: boolean;
}

/**
 * Split layout for Formats 4, 5, 6 — Interactive element left, AriaSidebar right.
 * Used during Act 2 structured questions (MC, timed, numeric).
 */
export function InteractiveSplitLayout({
  interactiveElement,
  sidebar,
  showElements,
}: InteractiveSplitLayoutProps) {
  return (
    <div
      className="flex-1 flex items-center px-6 gap-8"
      style={{ transition: "all 800ms cubic-bezier(0.25,0.1,0.25,1)" }}
    >
      {/* Left: Question panel */}
      <div
        className="flex-1 flex flex-col justify-center max-w-xl"
        style={{
          opacity: showElements ? 1 : 0,
          transform: showElements ? "translateY(0)" : "translateY(24px)",
          transition:
            "opacity 700ms cubic-bezier(0.25,0.1,0.25,1), transform 700ms cubic-bezier(0.25,0.1,0.25,1)",
        }}
      >
        {interactiveElement}
      </div>

      {/* Right: AriaSidebar */}
      {sidebar}
    </div>
  );
}

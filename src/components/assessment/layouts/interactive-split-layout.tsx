"use client";

import { useState, useEffect, type ReactNode } from "react";

interface InteractiveSplitLayoutProps {
  interactiveElement: ReactNode;
  sidebar: ReactNode;
  showElements: boolean;
}

// Fix: PRO-22 — reuse the same mobile detection as ReferenceSplitLayout
function useIsMobile() {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const check = () => setMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);
  return mobile;
}

/**
 * Split layout for Formats 4, 5, 6 — Interactive element left, AriaSidebar right.
 * Used during Act 2 structured questions (MC, timed, numeric).
 * Fix: PRO-22 — on mobile (<768px), sidebar collapses to bottom sheet.
 */
export function InteractiveSplitLayout({
  interactiveElement,
  sidebar,
  showElements,
}: InteractiveSplitLayoutProps) {
  const isMobile = useIsMobile();
  const [sheetOpen, setSheetOpen] = useState(false);

  if (isMobile) {
    return (
      <div className="h-full flex flex-col relative">
        {/* Full-width interactive panel */}
        <div
          className="flex-1 flex flex-col justify-center px-4"
          style={{
            opacity: showElements ? 1 : 0,
            transform: showElements ? "translateY(0)" : "translateY(24px)",
            transition:
              "opacity 700ms cubic-bezier(0.25,0.1,0.25,1), transform 700ms cubic-bezier(0.25,0.1,0.25,1)",
          }}
        >
          {interactiveElement}
        </div>

        {/* Bottom sheet toggle tab */}
        <button
          onClick={() => setSheetOpen(!sheetOpen)}
          aria-label={sheetOpen ? "Collapse Aria" : "Expand Aria"}
          style={{
            position: "fixed",
            bottom: sheetOpen ? "min(60vh, 400px)" : 0,
            left: 0,
            right: 0,
            zIndex: 40,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
            padding: "10px 16px",
            background: "rgba(9,15,30,0.95)",
            borderTop: "1px solid rgba(37,99,235,0.15)",
            cursor: "pointer",
            border: "none",
            transition: "bottom 300ms ease",
          }}
        >
          <div
            style={{
              width: "32px",
              height: "3px",
              borderRadius: "2px",
              background: "rgba(255,255,255,0.15)",
            }}
          />
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "11px", // Fix: PRO-53
              fontWeight: 600,
              color: "rgba(96,165,250,0.6)",
              textTransform: "uppercase",
              letterSpacing: "2px",
            }}
          >
            Aria
          </span>
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="rgba(96,165,250,0.5)"
            strokeWidth="2"
            style={{
              transform: sheetOpen ? "rotate(180deg)" : "rotate(0deg)",
              transition: "transform 200ms ease",
            }}
          >
            <polyline points="18 15 12 9 6 15" />
          </svg>
        </button>

        {/* Bottom sheet content */}
        <div
          style={{
            position: "fixed",
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: 39,
            maxHeight: sheetOpen ? "min(60vh, 400px)" : "0px",
            overflow: "hidden",
            transition: "max-height 300ms ease",
            background: "rgba(9,15,30,0.97)",
            borderTop: "1px solid rgba(37,99,235,0.1)",
          }}
        >
          <div
            style={{
              padding: "12px 16px 24px",
              overflowY: "auto",
              maxHeight: "min(60vh, 400px)",
              scrollbarWidth: "none",
            }}
          >
            {sidebar}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="h-full flex items-center px-6 gap-8"
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

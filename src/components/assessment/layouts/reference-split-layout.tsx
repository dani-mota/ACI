"use client";

import { useState, useEffect, type ReactNode } from "react";

interface ReferenceSplitLayoutProps {
  referenceCard: ReactNode;
  sidebar: ReactNode;
}

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
 * Split layout for Formats 2 & 3 — Reference card left, AriaSidebar right.
 * On mobile (<768px), reference card becomes a collapsible bottom sheet.
 */
export function ReferenceSplitLayout({
  referenceCard,
  sidebar,
}: ReferenceSplitLayoutProps) {
  const isMobile = useIsMobile();
  const [sheetOpen, setSheetOpen] = useState(false);

  if (isMobile) {
    return (
      <div className="h-full flex flex-col relative">
        {/* Main content area */}
        <div className="flex-1">{sidebar}</div>

        {/* Bottom sheet toggle tab */}
        <button
          onClick={() => setSheetOpen(!sheetOpen)}
          aria-label={sheetOpen ? "Collapse scenario brief" : "Expand scenario brief"}
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
            borderBottom: sheetOpen ? "1px solid rgba(37,99,235,0.08)" : "none",
            cursor: "pointer",
            border: "none",
            transition: "bottom 300ms ease",
          }}
        >
          {/* Drag handle */}
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
            Scenario Brief
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
            {referenceCard}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex">
      {/* LEFT: Reference Card */}
      <div
        className="overflow-y-auto"
        style={{
          flex: "1 1 0%",
          padding: "88px 20px 24px 32px",
          scrollbarWidth: "none",
        }}
      >
        {referenceCard}
      </div>

      {/* Subtle divider */}
      <div
        style={{
          width: "1px",
          background: "rgba(255,255,255,0.03)",
          margin: "24px 0",
          flexShrink: 0,
        }}
      />

      {/* RIGHT: AriaSidebar */}
      {sidebar}
    </div>
  );
}

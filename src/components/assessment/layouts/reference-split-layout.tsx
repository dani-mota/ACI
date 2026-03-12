"use client";

import type { ReactNode } from "react";

interface ReferenceSplitLayoutProps {
  referenceCard: ReactNode;
  sidebar: ReactNode;
}

/**
 * Split layout for Formats 2 & 3 — Reference card left, AriaSidebar right.
 * Used during Act 1 scenario presentation.
 */
export function ReferenceSplitLayout({
  referenceCard,
  sidebar,
}: ReferenceSplitLayoutProps) {
  return (
    <div className="flex-1 flex">
      {/* LEFT: Reference Card */}
      <div
        className="overflow-y-auto"
        style={{
          flex: "1 1 0%",
          padding: "24px 20px 24px 32px",
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

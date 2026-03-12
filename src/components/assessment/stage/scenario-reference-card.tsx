"use client";

import { useEffect, useState, useRef } from "react";
import type { ScenarioReference, ReferenceSection } from "@/lib/assessment/parse-scenario-response";

interface ScenarioReferenceCardProps {
  reference: ScenarioReference | null;
  /** How many pieces to reveal. -1 = show all. 0 = nothing yet. */
  revealCount: number;
}

// ── Block color config by section type ──
type BlockAccent = "blue" | "gold" | "red";

function getBlockAccent(section: ReferenceSection): BlockAccent {
  if (section.highlight) {
    const label = section.label.toLowerCase();
    if (label.includes("consequence") || label.includes("constraint") || label.includes("time")) return "red";
    return "gold";
  }
  return "blue";
}

const ACCENT_COLORS: Record<BlockAccent, { border: string; bg: string; text: string; dot: string; label: string }> = {
  blue: {
    border: "rgba(37,99,235,0.35)",
    bg: "rgba(37,99,235,0.048)",
    text: "var(--s-t4, #b8c4d6)",
    dot: "var(--s-blue, #2563EB)",
    label: "rgba(96,165,250,0.6)",
  },
  gold: {
    border: "rgba(201,168,76,0.4)",
    bg: "rgba(201,168,76,0.04)",
    text: "rgba(201,168,76,0.75)",
    dot: "var(--s-gold, #C9A84C)",
    label: "rgba(201,168,76,0.7)",
  },
  red: {
    border: "rgba(220,38,38,0.4)",
    bg: "rgba(220,38,38,0.04)",
    text: "rgba(220,38,38,0.75)",
    dot: "var(--s-red, #DC2626)",
    label: "rgba(220,38,38,0.7)",
  },
};

// ── Section divider colors ──
const DIVIDER_COLORS: Record<string, string> = {
  context: "var(--s-blue, #2563EB)",
  resources: "var(--s-green, #059669)",
  stakes: "var(--s-gold, #C9A84C)",
  situation: "var(--s-blue, #2563EB)",
  default: "var(--s-t3, #3d5068)",
};

function getDividerColor(label: string): string {
  const lower = label.toLowerCase();
  for (const [key, color] of Object.entries(DIVIDER_COLORS)) {
    if (lower.includes(key)) return color;
  }
  return DIVIDER_COLORS.default;
}

// ── Scan-line word reveal block ──
function ScanRevealBlock({
  show,
  isActive,
  accent,
  children,
}: {
  show: boolean;
  isActive: boolean;
  accent: BlockAccent;
  children: React.ReactNode;
}) {
  const colors = ACCENT_COLORS[accent];
  const [revealed, setRevealed] = useState(!isActive && show);

  useEffect(() => {
    if (show && isActive) {
      // Start reveal after a brief delay
      const timer = setTimeout(() => setRevealed(true), 100);
      return () => clearTimeout(timer);
    }
    if (show) setRevealed(true);
  }, [show, isActive]);

  return (
    <div
      className="stage-animate"
      style={{
        opacity: show ? 1 : 0,
        maxHeight: show ? "600px" : "0px",
        overflow: "hidden",
        transition: "opacity 500ms ease, max-height 600ms ease",
        marginBottom: show ? "12px" : 0,
        borderLeft: `3px solid ${isActive ? colors.border : "rgba(255,255,255,0.04)"}`,
        background: isActive ? colors.bg : "rgba(255,255,255,0.013)",
        borderRadius: "0 8px 8px 0",
        padding: show ? "10px 14px" : "0 14px",
        animation: isActive && revealed ? `blockBreathe 3.2s ease-in-out infinite` : "none",
        // CSS variable for the breathing animation color
        ...({ "--breathe-color": colors.border } as React.CSSProperties),
      }}
    >
      {children}
    </div>
  );
}

// ── Section divider ──
function SectionDivider({ label }: { label: string }) {
  const color = getDividerColor(label);
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "8px",
        margin: "14px 0 8px",
      }}
    >
      <span
        style={{
          width: "10px",
          height: "10px",
          borderRadius: "50%",
          background: color,
          opacity: 0.7,
          flexShrink: 0,
        }}
      />
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "8px",
          fontWeight: 600,
          color: "var(--s-t3, #3d5068)",
          textTransform: "uppercase",
          letterSpacing: "2px",
        }}
      >
        {label}
      </span>
      <div
        style={{
          flex: 1,
          height: "1px",
          background: `linear-gradient(to right, ${color}40, transparent)`,
        }}
      />
    </div>
  );
}

export function ScenarioReferenceCard({ reference, revealCount }: ScenarioReferenceCardProps) {
  const [visible, setVisible] = useState(false);
  const [displayRef, setDisplayRef] = useState<ScenarioReference | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const prevSectionsLen = useRef(0);

  useEffect(() => {
    if (reference) {
      setDisplayRef(reference);
      const timer = setTimeout(() => setVisible(true), 300);
      return () => clearTimeout(timer);
    } else {
      setVisible(false);
      const timer = setTimeout(() => setDisplayRef(null), 500);
      return () => clearTimeout(timer);
    }
  }, [reference]);

  // Update displayRef when reference content changes (new info accumulates)
  useEffect(() => {
    if (reference && displayRef) {
      setDisplayRef(reference);
    }
  }, [reference?.newInformation?.length, reference?.question]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-scroll to new content
  useEffect(() => {
    if (!displayRef || !scrollRef.current) return;
    const currentLen = displayRef.sections.length + (displayRef.newInformation?.length ?? 0);
    if (currentLen > prevSectionsLen.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    }
    prevSectionsLen.current = currentLen;
  }, [displayRef?.sections.length, displayRef?.newInformation?.length]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!displayRef) return null;

  const showAll = revealCount === -1;
  const totalSections = displayRef.sections.length;
  const showRole = showAll || revealCount >= 1;
  const showQuestion = showAll || revealCount >= totalSections + 2;

  // Determine which section is "active" (most recently revealed)
  const activeIndex = showAll ? -1 : revealCount - 2;

  return (
    <div
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(12px)",
        transition: "opacity 500ms ease, transform 500ms ease",
      }}
    >
      {/* Glass shell */}
      <div
        style={{
          background: "var(--s-glass, rgba(9,15,30,0.88))",
          border: "1px solid var(--s-glass-border, rgba(37,99,235,0.18))",
          borderRadius: "12px",
          backdropFilter: "blur(28px)",
          WebkitBackdropFilter: "blur(28px)",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Top shimmer line */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: "1px",
            background: "linear-gradient(90deg, transparent 0%, var(--s-blue, #2563EB) 30%, var(--s-gold, #C9A84C) 60%, transparent 100%)",
            opacity: 0.5,
          }}
        />

        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "14px 20px 10px",
            borderBottom: "1px solid rgba(37,99,235,0.08)",
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "9px",
              fontWeight: 700,
              color: "var(--s-t3, #3d5068)",
              textTransform: "uppercase",
              letterSpacing: "2.5px",
            }}
          >
            Scenario Brief
          </span>
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "8px",
              fontWeight: 600,
              color: "rgba(96,165,250,0.5)",
              textTransform: "uppercase",
              letterSpacing: "1.5px",
              padding: "2px 8px",
              borderRadius: "4px",
              background: "rgba(37,99,235,0.08)",
            }}
          >
            Act 1
          </span>
        </div>

        {/* Body — scrollable */}
        <div
          ref={scrollRef}
          style={{
            padding: "12px 20px 16px",
            maxHeight: "calc(100vh - 200px)",
            overflowY: "auto",
            scrollbarWidth: "none",
          }}
        >
          {/* Role badge */}
          {displayRef.role && (
            <ScanRevealBlock show={showRole} isActive={false} accent="blue">
              <div
                style={{
                  display: "inline-block",
                  padding: "4px 10px",
                  borderRadius: "6px",
                  background: "rgba(37,99,235,0.1)",
                  border: "1px solid rgba(37,99,235,0.15)",
                }}
              >
                <span
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: "11px",
                    fontWeight: 500,
                    color: "rgba(96,165,250,0.85)",
                    letterSpacing: "0.3px",
                  }}
                >
                  {displayRef.role}
                </span>
              </div>
            </ScanRevealBlock>
          )}

          {/* Context line */}
          {displayRef.context && (
            <ScanRevealBlock show={showRole} isActive={false} accent="blue">
              <p
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "12px",
                  fontWeight: 400,
                  color: "rgba(184,196,214,0.45)",
                  margin: 0,
                  lineHeight: 1.65,
                }}
              >
                {displayRef.context}
              </p>
            </ScanRevealBlock>
          )}

          {/* Sections with dividers */}
          {displayRef.sections.map((section, si) => {
            const showSection = showAll || revealCount >= si + 2;
            const isActive = !showAll && si === activeIndex;
            const accent = getBlockAccent(section);
            const colors = ACCENT_COLORS[accent];

            // Group sections by type — show divider before first of each group
            const prevSection = si > 0 ? displayRef.sections[si - 1] : null;
            const showDivider = si === 0 || (prevSection && getBlockAccent(prevSection) !== accent);

            return (
              <div key={si}>
                {showDivider && showSection && (
                  <SectionDivider label={section.label} />
                )}
                <ScanRevealBlock show={showSection} isActive={isActive} accent={accent}>
                  {/* Section label */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      marginBottom: "6px",
                    }}
                  >
                    <span
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: "8px",
                        fontWeight: 600,
                        color: colors.label,
                        textTransform: "uppercase",
                        letterSpacing: "1.5px",
                      }}
                    >
                      {section.label}
                    </span>
                  </div>
                  {/* Section items */}
                  {section.items.map((item, ii) => (
                    <p
                      key={ii}
                      className="stage-animate"
                      style={{
                        fontFamily: "var(--font-display)",
                        fontSize: "12px",
                        fontWeight: 300,
                        color: isActive ? colors.text : "rgba(184,196,214,0.6)",
                        lineHeight: 1.7,
                        margin: 0,
                        marginBottom: ii < section.items.length - 1 ? "2px" : 0,
                        animation: isActive
                          ? `wordReveal 400ms ease ${ii * 80}ms both`
                          : "none",
                      }}
                    >
                      {item}
                    </p>
                  ))}
                </ScanRevealBlock>
              </div>
            );
          })}

          {/* New Information — accumulated across follow-up beats */}
          {displayRef.newInformation && displayRef.newInformation.length > 0 && (() => {
            const MAX_VISIBLE = 4;
            const COLLAPSE_THRESHOLD = 6;
            const items = displayRef.newInformation;
            const shouldCollapse = items.length > COLLAPSE_THRESHOLD;
            const visibleItems = shouldCollapse ? items.slice(-MAX_VISIBLE) : items;
            const hiddenCount = shouldCollapse ? items.length - MAX_VISIBLE : 0;

            return (
              <>
                <SectionDivider label="Updates" />
                <ScanRevealBlock show={true} isActive={true} accent="blue">
                  {hiddenCount > 0 && (
                    <p
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: "10px",
                        fontWeight: 400,
                        color: "rgba(96,165,250,0.35)",
                        lineHeight: 1.65,
                        marginBottom: "4px",
                        margin: 0,
                      }}
                    >
                      (+{hiddenCount} earlier updates)
                    </p>
                  )}
                  {visibleItems.map((item, ii) => (
                    <p
                      key={ii}
                      className="stage-animate"
                      style={{
                        fontFamily: "var(--font-display)",
                        fontSize: "12px",
                        fontWeight: 300,
                        color: "rgba(96,165,250,0.7)",
                        lineHeight: 1.7,
                        margin: 0,
                        marginBottom: ii < visibleItems.length - 1 ? "2px" : 0,
                        animation: ii === visibleItems.length - 1
                          ? `wordReveal 400ms ease both`
                          : "none",
                      }}
                    >
                      {item}
                    </p>
                  ))}
                </ScanRevealBlock>
              </>
            );
          })()}

          {/* Question callout — pinned at bottom, revealed last */}
          {displayRef.question && (
            <ScanRevealBlock show={showQuestion} isActive={showQuestion && !showAll} accent="blue">
              <div
                style={{
                  paddingTop: "8px",
                  borderTop: "1px solid rgba(255,255,255,0.05)",
                  display: "flex",
                  gap: "8px",
                  alignItems: "flex-start",
                }}
              >
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: "14px",
                    color: "rgba(96,165,250,0.5)",
                    lineHeight: 1.6,
                    flexShrink: 0,
                  }}
                >
                  ?
                </span>
                <p
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: "14px",
                    fontWeight: 400,
                    color: "rgba(184,196,214,0.8)",
                    lineHeight: 1.6,
                    margin: 0,
                  }}
                >
                  {displayRef.question}
                </p>
              </div>
            </ScanRevealBlock>
          )}
        </div>
      </div>
    </div>
  );
}

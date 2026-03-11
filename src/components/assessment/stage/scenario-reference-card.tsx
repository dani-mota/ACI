"use client";

import { useEffect, useState } from "react";
import type { ScenarioReference } from "@/lib/assessment/parse-scenario-response";

interface ScenarioReferenceCardProps {
  reference: ScenarioReference | null;
  /** How many pieces to reveal. -1 = show all. 0 = nothing yet. */
  revealCount: number;
}

/** Fade-in wrapper for progressive reveal. */
function RevealBlock({ show, children }: { show: boolean; children: React.ReactNode }) {
  return (
    <div
      style={{
        opacity: show ? 1 : 0,
        maxHeight: show ? "500px" : "0px",
        overflow: "hidden",
        transform: show ? "translateY(0)" : "translateY(8px)",
        transition: "opacity 600ms ease, max-height 600ms ease, transform 600ms ease",
      }}
    >
      {children}
    </div>
  );
}

export function ScenarioReferenceCard({ reference, revealCount }: ScenarioReferenceCardProps) {
  const [visible, setVisible] = useState(false);
  const [displayRef, setDisplayRef] = useState<ScenarioReference | null>(null);

  useEffect(() => {
    if (reference) {
      setDisplayRef(reference);
      const timer = setTimeout(() => setVisible(true), 400);
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

  if (!displayRef) return null;

  const showAll = revealCount === -1;
  // Reveal mapping:
  // revealCount 1 → role badge + context
  // revealCount 2 → first section
  // revealCount N+1 → Nth section
  // revealCount sections.length + 2 → question
  const totalSections = displayRef.sections.length;
  const showRole = showAll || revealCount >= 1;
  const showQuestion = showAll || revealCount >= totalSections + 2;

  return (
    <div
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(12px)",
        transition: "opacity 500ms ease, transform 500ms ease",
      }}
    >
      <div
        style={{
          background: "rgba(255, 255, 255, 0.025)",
          border: "1px solid rgba(255, 255, 255, 0.06)",
          borderRadius: "14px",
          padding: "20px 24px",
          maxHeight: "40vh",
          overflowY: "auto",
        }}
      >
        {/* Role badge */}
        {displayRef.role && (
          <RevealBlock show={showRole}>
            <div
              style={{
                display: "inline-block",
                padding: "4px 10px",
                borderRadius: "6px",
                background: "rgba(37, 99, 235, 0.1)",
                border: "1px solid rgba(37, 99, 235, 0.15)",
                marginBottom: "16px",
              }}
            >
              <span
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "11px",
                  fontWeight: 500,
                  color: "rgba(96, 165, 250, 0.85)",
                  letterSpacing: "0.3px",
                }}
              >
                {displayRef.role}
              </span>
            </div>
          </RevealBlock>
        )}

        {/* Context line */}
        {displayRef.context && (
          <RevealBlock show={showRole}>
            <p
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "12px",
                fontWeight: 400,
                color: "rgba(184, 196, 214, 0.45)",
                marginBottom: "14px",
                letterSpacing: "0.2px",
              }}
            >
              {displayRef.context}
            </p>
          </RevealBlock>
        )}

        {/* Sections — each revealed progressively */}
        {displayRef.sections.map((section, si) => {
          const showSection = showAll || revealCount >= si + 2;
          return (
            <RevealBlock key={si} show={showSection}>
              <div style={{ marginBottom: "14px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "8px" }}>
                  {section.highlight && (
                    <span
                      style={{
                        width: "4px",
                        height: "4px",
                        borderRadius: "50%",
                        background: "rgba(251, 191, 36, 0.7)",
                        flexShrink: 0,
                      }}
                    />
                  )}
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: "9px",
                      fontWeight: 500,
                      color: section.highlight
                        ? "rgba(251, 191, 36, 0.7)"
                        : "rgba(184, 196, 214, 0.4)",
                      textTransform: "uppercase",
                      letterSpacing: "1.5px",
                    }}
                  >
                    {section.label}
                  </span>
                </div>
                <ul
                  style={{
                    listStyle: "none",
                    padding: 0,
                    margin: 0,
                    borderLeft: `2px solid ${section.highlight ? "rgba(251, 191, 36, 0.15)" : "rgba(184, 196, 214, 0.08)"}`,
                    paddingLeft: "14px",
                  }}
                >
                  {section.items.map((item, ii) => (
                    <li
                      key={ii}
                      style={{
                        fontFamily: "var(--font-display)",
                        fontSize: "13px",
                        fontWeight: 300,
                        color: section.highlight
                          ? "rgba(251, 191, 36, 0.65)"
                          : "rgba(184, 196, 214, 0.6)",
                        lineHeight: 1.65,
                        paddingLeft: "0",
                        marginBottom: ii < section.items.length - 1 ? "2px" : 0,
                      }}
                    >
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </RevealBlock>
          );
        })}

        {/* New Information — accumulated across follow-up beats (always shown) */}
        {displayRef.newInformation && displayRef.newInformation.length > 0 && (() => {
          const MAX_VISIBLE = 4;
          const COLLAPSE_THRESHOLD = 6;
          const items = displayRef.newInformation;
          const shouldCollapse = items.length > COLLAPSE_THRESHOLD;
          const visibleItems = shouldCollapse ? items.slice(-MAX_VISIBLE) : items;
          const hiddenCount = shouldCollapse ? items.length - MAX_VISIBLE : 0;

          return (
            <div
              style={{
                marginBottom: "14px",
                opacity: 1,
                transition: "opacity 400ms ease",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "8px" }}>
                <span
                  style={{
                    width: "4px",
                    height: "4px",
                    borderRadius: "50%",
                    background: "rgba(37, 99, 235, 0.7)",
                    flexShrink: 0,
                  }}
                />
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: "9px",
                    fontWeight: 500,
                    color: "rgba(96, 165, 250, 0.6)",
                    textTransform: "uppercase",
                    letterSpacing: "1.5px",
                  }}
                >
                  New Information
                </span>
              </div>
              <ul
                style={{
                  listStyle: "none",
                  padding: 0,
                  margin: 0,
                  borderLeft: "2px solid rgba(37, 99, 235, 0.15)",
                  paddingLeft: "14px",
                }}
              >
                {hiddenCount > 0 && (
                  <li
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: "10px",
                      fontWeight: 400,
                      color: "rgba(96, 165, 250, 0.35)",
                      lineHeight: 1.65,
                      marginBottom: "4px",
                    }}
                  >
                    (+{hiddenCount} more)
                  </li>
                )}
                {visibleItems.map((item, ii) => (
                  <li
                    key={ii}
                    style={{
                      fontFamily: "var(--font-display)",
                      fontSize: "13px",
                      fontWeight: 300,
                      color: "rgba(96, 165, 250, 0.65)",
                      lineHeight: 1.65,
                      marginBottom: ii < visibleItems.length - 1 ? "2px" : 0,
                    }}
                  >
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          );
        })()}

        {/* Question callout — pinned at bottom, revealed last */}
        {displayRef.question && (
          <RevealBlock show={showQuestion}>
            <div
              style={{
                marginTop: "4px",
                paddingTop: "12px",
                borderTop: "1px solid rgba(255, 255, 255, 0.05)",
                display: "flex",
                gap: "8px",
                alignItems: "flex-start",
              }}
            >
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "14px",
                  color: "rgba(184, 196, 214, 0.35)",
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
                  color: "rgba(184, 196, 214, 0.8)",
                  lineHeight: 1.6,
                  margin: 0,
                }}
              >
                {displayRef.question}
              </p>
            </div>
          </RevealBlock>
        )}
      </div>
    </div>
  );
}

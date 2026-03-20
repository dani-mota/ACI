"use client";

// Fix: PRO-41 — derive construct count from source of truth instead of hardcoding 12
import { ALL_CONSTRUCTS } from "@/lib/types/constructs";

interface CompletionScreenProps {
  elapsedMinutes?: number;
  constructCount?: number;
  reviewMessage?: string;
  visible: boolean;
}

/**
 * Format 9 — Completion screen.
 * Green checkmark ring, heading, stats row.
 */
export function CompletionScreen({
  elapsedMinutes = 0,
  constructCount = ALL_CONSTRUCTS.length, // Fix: PRO-41
  reviewMessage = "Your results will be reviewed within 2 business days.",
  visible,
}: CompletionScreenProps) {
  if (!visible) return null;

  return (
    <div
      className="flex flex-col items-center gap-8 px-6"
      style={{
        opacity: visible ? 1 : 0,
        transition: "opacity 800ms ease",
      }}
    >
      {/* Green checkmark ring */}
      <div
        className="stage-animate"
        style={{
          width: "70px",
          height: "70px",
          borderRadius: "50%",
          border: "2px solid var(--s-green, #059669)",
          background: "rgba(5,150,105,0.08)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          animation: "cardIn 0.6s ease both",
        }}
      >
        <svg
          width="28"
          height="28"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--s-green-b, #22d68a)"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>

      {/* Heading */}
      <h2
        className="stage-animate"
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "22px",
          fontWeight: 300,
          color: "var(--s-t1, #c9d6e8)",
          textAlign: "center",
          margin: 0,
          animation: "cardIn 0.8s ease 0.2s both",
        }}
      >
        Assessment Complete
      </h2>

      {/* Sub-text */}
      <p
        className="stage-animate"
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "14px",
          fontWeight: 300,
          color: "var(--s-t2, #7b8fa8)",
          textAlign: "center",
          maxWidth: "380px",
          lineHeight: 1.65,
          margin: 0,
          animation: "cardIn 0.8s ease 0.4s both",
        }}
      >
        {reviewMessage}
      </p>

      {/* Stats row */}
      <div
        className="flex items-center justify-center stage-animate"
        style={{
          gap: "32px",
          animation: "cardIn 0.8s ease 0.6s both",
        }}
      >
        {[
          { number: String(constructCount), label: "Constructs" },
          { number: String(elapsedMinutes || "—"), label: "Minutes" },
          { number: "100%", label: "Complete" },
        ].map((stat, i) => (
          <div
            key={i}
            className="flex flex-col items-center"
            style={{
              borderRight: i < 2
                ? "1px solid rgba(255,255,255,0.06)"
                : "none",
              paddingRight: i < 2 ? "32px" : 0,
            }}
          >
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "28px",
                fontWeight: 300,
                color: "var(--s-t1, #c9d6e8)",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {stat.number}
            </span>
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "10px",
                fontWeight: 600,
                color: "var(--s-t3, #3d5068)",
                textTransform: "uppercase",
                letterSpacing: "1.5px",
              }}
            >
              {stat.label}
            </span>
          </div>
        ))}
      </div>

      {/* Fix: PRO-42 — loading feedback during redirect wait */}
      <p
        className="stage-animate"
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "11px",
          fontWeight: 400,
          color: "var(--s-t3, #3d5068)",
          textTransform: "uppercase",
          letterSpacing: "1.5px",
          textAlign: "center",
          margin: 0,
          animation: "cardIn 0.8s ease 0.8s both, dotPulse 2s ease-in-out 1.6s infinite",
        }}
      >
        Saving your results...
      </p>
    </div>
  );
}

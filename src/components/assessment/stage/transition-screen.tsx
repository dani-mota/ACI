"use client";

interface TransitionScreenProps {
  heading: string;
  subText?: string;
  ctaLabel?: string;
  onContinue?: () => void;
  visible: boolean;
}

/**
 * Format 8 — Act Transition screen.
 * Animated dots, heading, sub-text, optional CTA button.
 */
export function TransitionScreen({
  heading,
  subText,
  ctaLabel = "Continue",
  onContinue,
  visible,
}: TransitionScreenProps) {
  if (!visible) return null;

  return (
    <div
      className="flex flex-col items-center gap-6 px-6"
      style={{
        opacity: visible ? 1 : 0,
        transition: "opacity 800ms ease",
      }}
    >
      {/* Animated dots */}
      <div className="flex items-center gap-3">
        {[
          "var(--s-blue, #2563EB)",
          "var(--s-gold, #C9A84C)",
          "var(--s-green-b, #22d68a)",
        ].map((color, i) => (
          <span
            key={i}
            className="stage-animate"
            style={{
              width: "7px",
              height: "7px",
              borderRadius: "50%",
              background: color,
              animation: `dotPulse 1.4s ease-in-out ${i * 0.2}s infinite`,
            }}
          />
        ))}
      </div>

      {/* Heading */}
      {heading && (
        <h2
          className="stage-animate"
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "22px",
            fontWeight: 300,
            color: "var(--s-t1, #c9d6e8)",
            textAlign: "center",
            lineHeight: 1.4,
            margin: 0,
            animation: "cardIn 0.8s ease both",
          }}
        >
          {heading}
        </h2>
      )}

      {/* Sub-text */}
      {subText && (
        <p
          className="stage-animate"
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "14px",
            fontWeight: 300,
            color: "var(--s-t2, #7b8fa8)",
            textAlign: "center",
            maxWidth: "420px",
            lineHeight: 1.65,
            margin: 0,
            animation: "cardIn 0.8s ease 0.3s both",
          }}
        >
          {subText}
        </p>
      )}

      {/* CTA button */}
      {onContinue && (
        <button
          onClick={onContinue}
          className="stage-animate"
          style={{
            padding: "10px 28px",
            borderRadius: "8px",
            border: "1px solid rgba(37,99,235,0.25)",
            background: "transparent",
            color: "var(--s-blue-g, #4a8af5)",
            fontFamily: "var(--font-mono)",
            fontSize: "11px",
            fontWeight: 500,
            letterSpacing: "1.5px",
            textTransform: "uppercase",
            cursor: "pointer",
            transition: "all 300ms ease",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            animation: "cardIn 0.8s ease 0.5s both",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.background = "rgba(37,99,235,0.08)";
            (e.currentTarget as HTMLElement).style.borderColor = "rgba(37,99,235,0.4)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background = "transparent";
            (e.currentTarget as HTMLElement).style.borderColor = "rgba(37,99,235,0.25)";
          }}
        >
          {ctaLabel}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <line x1="5" y1="12" x2="19" y2="12" />
            <polyline points="12 5 19 12 12 19" />
          </svg>
        </button>
      )}
    </div>
  );
}

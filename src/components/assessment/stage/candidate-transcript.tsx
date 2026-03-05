"use client";

import { useEffect, useState } from "react";

interface CandidateTranscriptProps {
  text: string;
  visible: boolean;
}

export function CandidateTranscript({ text, visible }: CandidateTranscriptProps) {
  const [opacity, setOpacity] = useState(0);

  useEffect(() => {
    if (visible && text) {
      // Fade in
      requestAnimationFrame(() => setOpacity(0.5));

      // Fade out after 2s
      const timer = setTimeout(() => setOpacity(0), 2000);
      return () => clearTimeout(timer);
    } else {
      setOpacity(0);
    }
  }, [visible, text]);

  if (!text) return null;

  return (
    <div
      className="text-center mt-3 stage-animate"
      style={{
        fontFamily: "var(--font-display)",
        fontSize: "13px",
        fontWeight: 300,
        fontStyle: "italic",
        color: "rgba(184, 196, 214, 0.5)",
        opacity,
        transition: "opacity 600ms ease",
      }}
    >
      &ldquo;{text}&rdquo;
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";

const ACT_NAMES: Record<string, string> = {
  ACT_1: "Part One",
  ACT_2: "Part Two",
  ACT_3: "Calibration",
};

interface ActLabelProps {
  currentAct: string;
  visible: boolean;
}

export function ActLabel({ currentAct, visible }: ActLabelProps) {
  const label = ACT_NAMES[currentAct] ?? currentAct;
  const prevLabelRef = useRef(label);
  const [displayLabel, setDisplayLabel] = useState(label);
  const [crossfading, setCrossfading] = useState(false);

  useEffect(() => {
    if (label === prevLabelRef.current) return;
    prevLabelRef.current = label;

    // Crossfade: fade out old label, swap, fade in new
    requestAnimationFrame(() => setCrossfading(true));
    const timer = setTimeout(() => {
      setDisplayLabel(label);
      setCrossfading(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [label]);

  return (
    <div
      className="text-center stage-animate"
      style={{
        fontFamily: "var(--font-mono)",
        fontSize: "11px", // Fix: PRO-53
        letterSpacing: "2.5px",
        textTransform: "uppercase",
        color: "color-mix(in srgb, var(--s-gold, #C9A84C) 60%, transparent)",
        opacity: visible ? (crossfading ? 0 : 1) : 0,
        transition: "opacity 300ms ease",
        minHeight: "16px",
      }}
    >
      {displayLabel}
    </div>
  );
}

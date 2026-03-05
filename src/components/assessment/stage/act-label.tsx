"use client";

const ACT_NAMES: Record<string, string> = {
  ACT_1: "The Scenario Gauntlet",
  ACT_2: "The Precision Gauntlet",
  ACT_3: "Calibration",
};

interface ActLabelProps {
  currentAct: string;
}

export function ActLabel({ currentAct }: ActLabelProps) {
  const label = ACT_NAMES[currentAct] ?? currentAct;

  return (
    <div
      className="text-center stage-animate"
      style={{
        fontFamily: "var(--font-mono)",
        fontSize: "9px",
        letterSpacing: "2.5px",
        textTransform: "uppercase",
        color: "rgba(14, 165, 233, 0.6)", // aci-gold at 60% opacity
        transition: "opacity 1.2s ease",
      }}
    >
      {label}
    </div>
  );
}

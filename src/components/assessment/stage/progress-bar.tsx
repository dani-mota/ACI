"use client";

import type { OrchestratorPhase } from "@/lib/assessment/transitions";

const ACTS = [
  { key: "ACT_1", label: "Act 1" },
  { key: "ACT_2", label: "Act 2" },
  { key: "ACT_3", label: "Act 3" },
] as const;

const ACT_ORDER = ["ACT_1", "ACT_2", "ACT_3"];

interface StageProgressBarProps {
  currentAct: string;
  orchestratorPhase: OrchestratorPhase;
  /** Per-act fill progress (0.0 to 1.0). */
  actProgress: { act1: number; act2: number; act3: number };
  /** Controls fade-in visibility. */
  visible: boolean;
}

export function StageProgressBar({
  currentAct,
  orchestratorPhase,
  actProgress,
  visible,
}: StageProgressBarProps) {
  const currentIdx = ACT_ORDER.indexOf(currentAct);

  // During transitions, show progress for the "from" act
  const isTransitioning =
    orchestratorPhase === "TRANSITION_1_2" ||
    orchestratorPhase === "TRANSITION_2_3";

  const getSegmentFill = (actIndex: number): string => {
    const isPast = actIndex < currentIdx;
    const isActive = actIndex === currentIdx;

    if (isPast) return "100%";
    if (!isActive) return "0%";

    // Active segment — use granular progress
    const progressKey = actIndex === 0 ? "act1" : actIndex === 1 ? "act2" : "act3";
    const progress = actProgress[progressKey];
    return `${Math.min(100, Math.max(0, progress * 100))}%`;
  };

  return (
    <div
      className="flex items-center gap-2 max-w-[380px] sm:max-w-[380px] max-sm:max-w-[300px] w-full mx-auto"
      role="progressbar"
      aria-valuenow={currentIdx + 1}
      aria-valuemin={1}
      aria-valuemax={3}
      aria-label={`Assessment progress: ${ACTS[currentIdx]?.label ?? "Act 1"}`}
      style={{
        opacity: visible ? 1 : 0,
        transition: "opacity 300ms ease",
        pointerEvents: visible ? "auto" : "none",
      }}
    >
      {ACTS.map((act, i) => {
        const isActive = i === currentIdx;
        const isPast = i < currentIdx;

        return (
          <div key={act.key} className="flex items-center gap-2 flex-1">
            {/* Segment */}
            <div className="flex flex-col gap-1.5 flex-1">
              <span
                className="text-[9px] tracking-[1.8px] uppercase stage-animate"
                style={{
                  fontFamily: "var(--font-mono)",
                  color: isActive
                    ? "rgba(255, 255, 255, 0.6)"
                    : "rgba(255, 255, 255, 0.2)",
                  transition: "color 0.6s ease",
                }}
              >
                {act.label}
              </span>
              <div
                className="h-[2px] w-full rounded-full"
                style={{ background: "rgba(255, 255, 255, 0.05)" }}
              >
                <div
                  className="h-full rounded-full stage-animate"
                  style={{
                    background: isPast || isActive ? "#2563EB" : "transparent",
                    boxShadow:
                      isPast || isActive
                        ? "0 0 10px rgba(37, 99, 235, 0.5)"
                        : "none",
                    width: getSegmentFill(i),
                    transition: "width 1.8s cubic-bezier(0.25, 0.1, 0.25, 1)",
                  }}
                />
              </div>
            </div>

            {/* Dot separator (between segments) */}
            {i < ACTS.length - 1 && (
              <div
                className="w-1 h-1 rounded-full shrink-0 stage-animate"
                style={{
                  background:
                    isPast
                      ? "#2563EB"
                      : "rgba(255, 255, 255, 0.1)",
                  boxShadow: isPast
                    ? "0 0 6px rgba(37, 99, 235, 0.4)"
                    : "none",
                  transition: "background 0.6s ease",
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { OrbRenderer, type OrbStateMode } from "./orb-renderer";

interface AssessmentOrbProps {
  mode: OrbStateMode;
  amplitude: number;
  /** Target orb diameter in px. Animated with CSS transitions. */
  targetSize: number;
  /** @deprecated Use targetSize instead. Still supported for backwards compat. */
  compact?: boolean;
}

// Canvas padding for glow/aura — keep tight to avoid overlapping subtitles
const CANVAS_PADDING = 1.6;

function getDefaultSizes() {
  const mobile = typeof window !== "undefined" && window.innerWidth < 768;
  return { full: mobile ? 140 : 160, compact: mobile ? 56 : 72 };
}

export function AssessmentOrb({ mode, amplitude, targetSize, compact }: AssessmentOrbProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<OrbRenderer | null>(null);
  const [defaults] = useState(getDefaultSizes);

  // Resolve effective size: prefer targetSize, fall back to compact boolean
  const effectiveSize = targetSize > 0
    ? targetSize
    : compact ? defaults.compact : defaults.full;

  const isCompact = effectiveSize <= defaults.compact;

  // Initialize renderer
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const renderer = new OrbRenderer(canvas);
    rendererRef.current = renderer;
    renderer.resize(Math.round(effectiveSize * CANVAS_PADDING));
    renderer.start();

    return () => {
      renderer.stop();
      rendererRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync mode
  useEffect(() => {
    rendererRef.current?.setMode(mode);
  }, [mode]);

  // Sync amplitude
  useEffect(() => {
    rendererRef.current?.setAmplitude(amplitude);
  }, [amplitude]);

  // Sync size — animate canvas resize when targetSize changes
  useEffect(() => {
    rendererRef.current?.resize(Math.round(effectiveSize * CANVAS_PADDING));
  }, [effectiveSize]);

  const canvasSize = Math.round(effectiveSize * CANVAS_PADDING);

  // Status dot color based on mode
  const statusColor =
    mode === "speaking" ? "#2563EB" :
    mode === "listening" ? "#22d68a" :
    mode === "processing" ? "#D97706" :
    "rgba(37, 99, 235, 0.4)";

  return (
    <div
      className="relative flex items-center justify-center flex-shrink-0 pointer-events-none"
      style={{
        width: canvasSize,
        height: canvasSize,
        transition: "width 1.2s cubic-bezier(0.25, 0.1, 0.25, 1), height 1.2s cubic-bezier(0.25, 0.1, 0.25, 1)",
      }}
      role="img"
      aria-label={
        mode === "speaking"
          ? "AI evaluator is speaking"
          : mode === "listening"
            ? "AI evaluator is listening for your response"
            : mode === "processing"
              ? "AI evaluator is thinking"
              : "AI evaluator is ready"
      }
    >
      {/* Canvas (neural particle system) — radial mask prevents square edge */}
      <canvas
        ref={canvasRef}
        style={{
          width: canvasSize,
          height: canvasSize,
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -50%)",
          maskImage: "radial-gradient(circle closest-side at center, black 60%, transparent 90%)",
          WebkitMaskImage: "radial-gradient(circle closest-side at center, black 60%, transparent 90%)",
        }}
      />

      {/* Glass highlight — subtle top-left crescent */}
      {!isCompact && (
        <div
          className="absolute rounded-full pointer-events-none"
          style={{
            width: effectiveSize * 0.7,
            height: effectiveSize * 0.7,
            top: "8%",
            left: "8%",
            background: "radial-gradient(ellipse at 30% 30%, rgba(255, 255, 255, 0.04) 0%, transparent 60%)",
          }}
        />
      )}

      {/* Fresnel ring — outer edge glow, reactive to mode */}
      <div
        className="absolute rounded-full pointer-events-none"
        style={{
          width: effectiveSize - 2,
          height: effectiveSize - 2,
          border: `1px solid rgba(37, 99, 235, ${mode === "speaking" ? 0.15 : 0.08})`,
          boxShadow: mode === "speaking"
            ? "0 0 30px rgba(37, 99, 235, 0.12), 0 0 60px rgba(37, 99, 235, 0.06), inset 0 0 25px rgba(37, 99, 235, 0.05)"
            : "0 0 20px rgba(37, 99, 235, 0.06), inset 0 0 20px rgba(37, 99, 235, 0.03)",
          transition: "all 0.8s cubic-bezier(0.25, 0.1, 0.25, 1)",
        }}
      />

      {/* Orbital ring 1 — slow rotate */}
      {!isCompact && (
        <div
          className="absolute rounded-full pointer-events-none"
          style={{
            width: effectiveSize + 20,
            height: effectiveSize + 20,
            border: "1px solid rgba(37, 99, 235, 0.04)",
            animation: "orbitalSpin1 30s linear infinite",
          }}
        />
      )}

      {/* Orbital ring 2 — counter-rotate, tilted */}
      {!isCompact && (
        <div
          className="absolute rounded-full pointer-events-none"
          style={{
            width: effectiveSize + 36,
            height: effectiveSize + 36,
            border: "1px solid rgba(37, 99, 235, 0.025)",
            animation: "orbitalSpin2 45s linear infinite",
            transform: "rotateX(60deg)",
          }}
        />
      )}

      {/* Status dot — bottom center */}
      <div
        className="absolute pointer-events-none"
        style={{
          bottom: isCompact ? -6 : -10,
          left: "50%",
          transform: "translateX(-50%)",
          width: isCompact ? 4 : 6,
          height: isCompact ? 4 : 6,
          borderRadius: "50%",
          backgroundColor: statusColor,
          boxShadow: `0 0 8px ${statusColor}`,
          transition: "background-color 600ms ease, box-shadow 600ms ease",
        }}
      />

      <style jsx global>{`
        @keyframes orbitalSpin1 {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes orbitalSpin2 {
          from { transform: rotateX(60deg) rotate(0deg); }
          to { transform: rotateX(60deg) rotate(-360deg); }
        }
      `}</style>
    </div>
  );
}

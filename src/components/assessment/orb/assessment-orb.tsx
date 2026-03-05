"use client";

import { useEffect, useRef, useState } from "react";
import { OrbRenderer, type OrbStateMode } from "./orb-renderer";

interface AssessmentOrbProps {
  mode: OrbStateMode;
  amplitude: number;
  compact: boolean;
}

// Canvas needs extra padding for glow
const CANVAS_PADDING = 1.6;

function getOrbSizes() {
  const mobile = typeof window !== "undefined" && window.innerWidth < 768;
  return { full: mobile ? 160 : 200, compact: mobile ? 56 : 72 };
}

export function AssessmentOrb({ mode, amplitude, compact }: AssessmentOrbProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<OrbRenderer | null>(null);
  const [sizes, setSizes] = useState({ full: 200, compact: 72 });

  // Compute sizes client-side
  useEffect(() => {
    setSizes(getOrbSizes());
  }, []);

  // Initialize renderer
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const renderer = new OrbRenderer(canvas);
    rendererRef.current = renderer;

    const orbSize = compact ? sizes.compact : sizes.full;
    renderer.resize(Math.round(orbSize * CANVAS_PADDING));
    renderer.start();

    return () => {
      renderer.stop();
      rendererRef.current = null;
    };
  }, [sizes]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync mode
  useEffect(() => {
    rendererRef.current?.setMode(mode);
  }, [mode]);

  // Sync amplitude
  useEffect(() => {
    rendererRef.current?.setAmplitude(amplitude);
  }, [amplitude]);

  // Sync size
  useEffect(() => {
    const orbSize = compact ? sizes.compact : sizes.full;
    rendererRef.current?.resize(Math.round(orbSize * CANVAS_PADDING));
  }, [compact, sizes]);

  const wrapperSize = compact ? sizes.compact : sizes.full;
  const canvasSize = Math.round(wrapperSize * CANVAS_PADDING);

  // Status dot color based on mode
  const statusColor =
    mode === "speaking" ? "#2563EB" :
    mode === "listening" ? "#22d68a" :
    mode === "processing" ? "#D97706" :
    "rgba(37, 99, 235, 0.4)";

  return (
    <div
      className="relative flex items-center justify-center"
      style={{
        width: wrapperSize,
        height: wrapperSize,
        transition: "width 2s cubic-bezier(0.25, 0.1, 0.25, 1), height 2s cubic-bezier(0.25, 0.1, 0.25, 1)",
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
      {/* Canvas (neural particle system) */}
      <canvas
        ref={canvasRef}
        style={{
          width: canvasSize,
          height: canvasSize,
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -50%)",
        }}
      />

      {/* Glass highlight — subtle top-left crescent */}
      {!compact && (
        <div
          className="absolute rounded-full pointer-events-none"
          style={{
            width: wrapperSize * 0.7,
            height: wrapperSize * 0.7,
            top: "8%",
            left: "8%",
            background: "radial-gradient(ellipse at 30% 30%, rgba(255, 255, 255, 0.04) 0%, transparent 60%)",
          }}
        />
      )}

      {/* Fresnel ring — outer edge glow */}
      <div
        className="absolute rounded-full pointer-events-none"
        style={{
          width: wrapperSize - 2,
          height: wrapperSize - 2,
          border: "1px solid rgba(37, 99, 235, 0.08)",
          boxShadow: "0 0 20px rgba(37, 99, 235, 0.06), inset 0 0 20px rgba(37, 99, 235, 0.03)",
          transition: "all 2s cubic-bezier(0.25, 0.1, 0.25, 1)",
        }}
      />

      {/* Orbital ring 1 — slow rotate */}
      {!compact && (
        <div
          className="absolute rounded-full pointer-events-none"
          style={{
            width: wrapperSize + 20,
            height: wrapperSize + 20,
            border: "1px solid rgba(37, 99, 235, 0.04)",
            animation: "orbitalSpin1 30s linear infinite",
          }}
        />
      )}

      {/* Orbital ring 2 — counter-rotate, tilted */}
      {!compact && (
        <div
          className="absolute rounded-full pointer-events-none"
          style={{
            width: wrapperSize + 36,
            height: wrapperSize + 36,
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
          bottom: compact ? -6 : -10,
          left: "50%",
          transform: "translateX(-50%)",
          width: compact ? 4 : 6,
          height: compact ? 4 : 6,
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

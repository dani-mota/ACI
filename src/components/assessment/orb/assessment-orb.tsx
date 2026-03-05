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

  return (
    <div
      className="relative flex items-center justify-center stage-animate"
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
    </div>
  );
}

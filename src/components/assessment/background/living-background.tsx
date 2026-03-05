"use client";

import { useEffect, useRef } from "react";

// ── Canvas particle/aurora types ──

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  opacity: number;
  pulsePhase: number;
  pulseSpeed: number;
}

interface Aurora {
  x: number;
  y: number;
  radius: number;
  color: [number, number, number];
  opacity: number;
  driftX: number;
  driftY: number;
  phase: number;
}

const PARTICLE_COUNT_DESKTOP = 80;
const PARTICLE_COUNT_MOBILE = 40;
const CONNECTION_DISTANCE = 120;
const PARTICLE_COLOR = [147, 187, 255] as const;
const CONNECTION_COLOR = [37, 99, 235] as const;
const TARGET_FPS = 30;
const FRAME_INTERVAL = 1000 / TARGET_FPS;

function isMobile() {
  return typeof window !== "undefined" && window.innerWidth < 768;
}

function prefersReducedMotion() {
  return typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function createParticles(count: number, w: number, h: number): Particle[] {
  return Array.from({ length: count }, () => ({
    x: Math.random() * w,
    y: Math.random() * h,
    vx: (Math.random() - 0.5) * 0.12,
    vy: (Math.random() - 0.5) * 0.12,
    radius: 0.3 + Math.random() * 1.2,
    opacity: 0.05 + Math.random() * 0.25,
    pulsePhase: Math.random() * Math.PI * 2,
    pulseSpeed: 0.005 + Math.random() * 0.01,
  }));
}

function createAuroras(w: number, h: number): Aurora[] {
  return [
    { x: w * 0.3, y: h * 0.3, radius: w * 0.5, color: [15, 35, 80], opacity: 0.4, driftX: 0.08, driftY: 0.05, phase: 0 },
    { x: w * 0.7, y: h * 0.6, radius: w * 0.45, color: [12, 25, 65], opacity: 0.35, driftX: -0.06, driftY: 0.04, phase: 1.5 },
    { x: w * 0.5, y: h * 0.8, radius: w * 0.4, color: [20, 40, 90], opacity: 0.3, driftX: 0.04, driftY: -0.07, phase: 3 },
    { x: w * 0.6, y: h * 0.2, radius: w * 0.3, color: [60, 50, 20], opacity: 0.12, driftX: -0.03, driftY: 0.06, phase: 4.5 },
  ];
}

// ── Ghosted schematic SVG paths (industrial/technical drawings) ──

const SCHEMATICS = [
  // Gear outline
  {
    viewBox: "0 0 120 120",
    path: "M60 15 L67 25 L78 20 L80 32 L92 32 L88 44 L98 52 L90 60 L98 68 L88 76 L92 88 L80 88 L78 100 L67 95 L60 105 L53 95 L42 100 L40 88 L28 88 L32 76 L22 68 L30 60 L22 52 L32 44 L28 32 L40 32 L42 20 L53 25Z M60 42 A18 18 0 1 0 60 78 A18 18 0 1 0 60 42Z",
    size: 140,
    position: { top: "12%", left: "8%" },
    delay: 0,
  },
  // Circuit board traces
  {
    viewBox: "0 0 160 100",
    path: "M10 50 L40 50 L50 30 L80 30 L90 50 L120 50 M40 50 L40 80 L70 80 M80 30 L80 10 L110 10 L110 30 M120 50 L150 50 L150 70 L130 70 M50 30 A3 3 0 1 0 50 36 A3 3 0 1 0 50 30 M90 50 A3 3 0 1 0 90 56 A3 3 0 1 0 90 50 M110 10 A3 3 0 1 0 110 16 A3 3 0 1 0 110 10",
    size: 180,
    position: { bottom: "18%", right: "6%" },
    delay: 8,
  },
  // Caliper / measurement tool
  {
    viewBox: "0 0 140 60",
    path: "M10 30 L130 30 M20 15 L20 45 M40 20 L40 40 M60 20 L60 40 M80 20 L80 40 M100 20 L100 40 M120 15 L120 45 M25 30 L25 10 L55 10 L55 30",
    size: 160,
    position: { top: "65%", left: "5%" },
    delay: 16,
  },
  // Waveform / signal
  {
    viewBox: "0 0 200 60",
    path: "M10 30 Q30 30 40 10 Q50 -10 60 30 Q70 70 80 30 Q90 -5 100 30 Q110 65 120 30 Q130 0 140 30 Q150 55 160 30 L190 30 M10 30 A2 2 0 1 0 10 34 A2 2 0 1 0 10 30 M190 30 A2 2 0 1 0 190 34 A2 2 0 1 0 190 30",
    size: 200,
    position: { bottom: "30%", left: "60%" },
    delay: 24,
  },
];

// ── Line trace definitions ──

const LINE_TRACES = [
  // 3 horizontal
  { direction: "horizontal" as const, position: "18%", duration: 8, delay: 0 },
  { direction: "horizontal" as const, position: "52%", duration: 12, delay: 4 },
  { direction: "horizontal" as const, position: "78%", duration: 10, delay: 7 },
  // 2 vertical
  { direction: "vertical" as const, position: "22%", duration: 9, delay: 2 },
  { direction: "vertical" as const, position: "75%", duration: 11, delay: 6 },
];

export function LivingBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const particlesRef = useRef<Particle[]>([]);
  const aurorasRef = useRef<Aurora[]>([]);
  const timeRef = useRef(0);
  const lastFrameRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;

    const reduced = prefersReducedMotion();

    function resize() {
      const dpr = window.devicePixelRatio || 1;
      const w = window.innerWidth;
      const h = window.innerHeight;
      canvas!.width = w * dpr;
      canvas!.height = h * dpr;
      canvas!.style.width = `${w}px`;
      canvas!.style.height = `${h}px`;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);

      const count = isMobile() ? PARTICLE_COUNT_MOBILE : PARTICLE_COUNT_DESKTOP;
      particlesRef.current = createParticles(count, w, h);
      aurorasRef.current = createAuroras(w, h);
    }

    resize();
    window.addEventListener("resize", resize);

    if (reduced) {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const grad = ctx.createRadialGradient(w * 0.5, h * 0.4, 0, w * 0.5, h * 0.4, w * 0.7);
      grad.addColorStop(0, "rgb(15, 25, 55)");
      grad.addColorStop(1, "rgb(8, 14, 26)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
      return () => window.removeEventListener("resize", resize);
    }

    function render(timestamp: number) {
      animationRef.current = requestAnimationFrame(render);

      if (timestamp - lastFrameRef.current < FRAME_INTERVAL) return;
      lastFrameRef.current = timestamp;

      const w = window.innerWidth;
      const h = window.innerHeight;
      timeRef.current += 0.016;
      const t = timeRef.current;

      ctx!.fillStyle = "#080e1a";
      ctx!.fillRect(0, 0, w, h);

      // Draw auroras
      for (const aurora of aurorasRef.current) {
        const ox = Math.sin(t * aurora.driftX + aurora.phase) * 40;
        const oy = Math.cos(t * aurora.driftY + aurora.phase * 1.3) * 30;
        const grad = ctx!.createRadialGradient(
          aurora.x + ox, aurora.y + oy, 0,
          aurora.x + ox, aurora.y + oy, aurora.radius,
        );
        const [r, g, b] = aurora.color;
        grad.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${aurora.opacity})`);
        grad.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
        ctx!.fillStyle = grad;
        ctx!.fillRect(0, 0, w, h);
      }

      const particles = particlesRef.current;

      // Update & draw particles
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;

        if (p.x < 0) p.x = w;
        if (p.x > w) p.x = 0;
        if (p.y < 0) p.y = h;
        if (p.y > h) p.y = 0;

        p.pulsePhase += p.pulseSpeed;
        const alpha = p.opacity * (0.6 + 0.4 * Math.sin(p.pulsePhase));

        ctx!.beginPath();
        ctx!.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx!.fillStyle = `rgba(${PARTICLE_COLOR[0]}, ${PARTICLE_COLOR[1]}, ${PARTICLE_COLOR[2]}, ${alpha})`;
        ctx!.fill();
      }

      // Draw connecting lines
      ctx!.lineWidth = 0.5;
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < CONNECTION_DISTANCE) {
            const alpha = 0.03 * (1 - dist / CONNECTION_DISTANCE);
            ctx!.beginPath();
            ctx!.moveTo(particles[i].x, particles[i].y);
            ctx!.lineTo(particles[j].x, particles[j].y);
            ctx!.strokeStyle = `rgba(${CONNECTION_COLOR[0]}, ${CONNECTION_COLOR[1]}, ${CONNECTION_COLOR[2]}, ${alpha})`;
            ctx!.stroke();
          }
        }
      }
    }

    animationRef.current = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationRef.current);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <div className="absolute inset-0 w-full h-full overflow-hidden" aria-hidden="true">
      {/* Canvas layer: particles + auroras */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
      />

      {/* Blueprint grid overlay */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            `linear-gradient(rgba(37, 99, 235, 0.03) 1px, transparent 1px),
             linear-gradient(90deg, rgba(37, 99, 235, 0.03) 1px, transparent 1px)`,
          backgroundSize: "60px 60px",
        }}
      />

      {/* Ghosted schematics */}
      {SCHEMATICS.map((s, i) => (
        <svg
          key={i}
          viewBox={s.viewBox}
          className="absolute pointer-events-none"
          style={{
            width: s.size,
            height: s.size,
            ...s.position,
            opacity: 0,
            animation: `schematicFade 32s ease-in-out ${s.delay}s infinite`,
          }}
        >
          <path
            d={s.path}
            fill="none"
            stroke="rgba(37, 99, 235, 0.06)"
            strokeWidth="0.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ))}

      {/* Line traces */}
      {LINE_TRACES.map((trace, i) => (
        <div
          key={`trace-${i}`}
          className="absolute pointer-events-none"
          style={
            trace.direction === "horizontal"
              ? {
                  top: trace.position,
                  left: 0,
                  width: "100%",
                  height: "1px",
                  background: "linear-gradient(90deg, transparent 0%, rgba(37, 99, 235, 0.12) 50%, transparent 100%)",
                  backgroundSize: "200% 100%",
                  animation: `lineTraceH ${trace.duration}s linear ${trace.delay}s infinite`,
                }
              : {
                  left: trace.position,
                  top: 0,
                  height: "100%",
                  width: "1px",
                  background: "linear-gradient(180deg, transparent 0%, rgba(37, 99, 235, 0.12) 50%, transparent 100%)",
                  backgroundSize: "100% 200%",
                  animation: `lineTraceV ${trace.duration}s linear ${trace.delay}s infinite`,
                }
          }
        />
      ))}

      {/* Keyframe styles */}
      <style jsx global>{`
        @keyframes schematicFade {
          0%, 100% { opacity: 0; }
          15%, 85% { opacity: 1; }
        }
        @keyframes lineTraceH {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        @keyframes lineTraceV {
          0% { background-position: 0 200%; }
          100% { background-position: 0 -200%; }
        }
      `}</style>
    </div>
  );
}

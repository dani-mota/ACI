"use client";

import { useEffect, useRef } from "react";

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
const PARTICLE_COLOR = [147, 187, 255] as const; // --aci-blue-pale
const CONNECTION_COLOR = [37, 99, 235] as const; // --aci-blue
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
      // Static gradient for reduced motion
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

      // Throttle to ~30fps
      if (timestamp - lastFrameRef.current < FRAME_INTERVAL) return;
      lastFrameRef.current = timestamp;

      const w = window.innerWidth;
      const h = window.innerHeight;
      timeRef.current += 0.016;
      const t = timeRef.current;

      // Clear with background
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

        // Wrap around
        if (p.x < 0) p.x = w;
        if (p.x > w) p.x = 0;
        if (p.y < 0) p.y = h;
        if (p.y > h) p.y = 0;

        // Pulse opacity
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
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full"
      aria-hidden="true"
    />
  );
}

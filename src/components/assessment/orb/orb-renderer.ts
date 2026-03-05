export type OrbStateMode = "idle" | "speaking" | "listening" | "processing";

// ── Simplex 2D Noise ──────────────────────────────────────────────
// Compact implementation for organic blob displacement.

const F2 = 0.5 * (Math.sqrt(3) - 1);
const G2 = (3 - Math.sqrt(3)) / 6;
const GRAD: [number, number][] = [
  [1, 1], [-1, 1], [1, -1], [-1, -1],
  [1, 0], [-1, 0], [0, 1], [0, -1],
];

const PERM = (() => {
  const p = new Uint8Array(512);
  const src = Array.from({ length: 256 }, (_, i) => i);
  let s = 42;
  for (let i = 255; i > 0; i--) {
    s = (s * 16807) % 2147483647;
    const j = s % (i + 1);
    [src[i], src[j]] = [src[j], src[i]];
  }
  for (let i = 0; i < 256; i++) {
    p[i] = src[i];
    p[i + 256] = src[i];
  }
  return p;
})();

function snoise(x: number, y: number): number {
  const s = (x + y) * F2;
  const i = Math.floor(x + s);
  const j = Math.floor(y + s);
  const t = (i + j) * G2;
  const x0 = x - (i - t);
  const y0 = y - (j - t);
  const i1 = x0 > y0 ? 1 : 0;
  const j1 = 1 - i1;
  const x1 = x0 - i1 + G2;
  const y1 = y0 - j1 + G2;
  const x2 = x0 - 1 + 2 * G2;
  const y2 = y0 - 1 + 2 * G2;
  const ii = i & 255;
  const jj = j & 255;
  let n = 0;
  let t0 = 0.5 - x0 * x0 - y0 * y0;
  if (t0 > 0) {
    t0 *= t0;
    const g = GRAD[PERM[ii + PERM[jj]] & 7];
    n += t0 * t0 * (g[0] * x0 + g[1] * y0);
  }
  let t1 = 0.5 - x1 * x1 - y1 * y1;
  if (t1 > 0) {
    t1 *= t1;
    const g = GRAD[PERM[ii + i1 + PERM[jj + j1]] & 7];
    n += t1 * t1 * (g[0] * x1 + g[1] * y1);
  }
  let t2 = 0.5 - x2 * x2 - y2 * y2;
  if (t2 > 0) {
    t2 *= t2;
    const g = GRAD[PERM[ii + 1 + PERM[jj + 1]] & 7];
    n += t2 * t2 * (g[0] * x2 + g[1] * y2);
  }
  return 70 * n;
}

/** Two-octave fractional Brownian motion */
function fbm(x: number, y: number): number {
  return snoise(x, y) * 0.65 + snoise(x * 2.2, y * 2.2) * 0.35;
}

// ── Mode Configs ──────────────────────────────────────────────────

interface ModeParams {
  noiseStr: number;
  noiseSpd: number;
  noiseScl: number;
  ampMul: number;
  breathAmp: number;
  breathSpd: number;
  glowAlpha: number;
  glowSize: number;
  rotSpd: number;
  cInR: number; cInG: number; cInB: number;
  cOutR: number; cOutG: number; cOutB: number;
  cGlR: number; cGlG: number; cGlB: number;
}

const MODES: Record<OrbStateMode, ModeParams> = {
  idle: {
    noiseStr: 6, noiseSpd: 0.25, noiseScl: 1.2,
    ampMul: 0, breathAmp: 2.5, breathSpd: 0.6,
    glowAlpha: 0.15, glowSize: 1.8, rotSpd: 0,
    cInR: 110, cInG: 165, cInB: 255,
    cOutR: 18, cOutG: 48, cOutB: 120,
    cGlR: 55, cGlG: 120, cGlB: 235,
  },
  speaking: {
    noiseStr: 12, noiseSpd: 0.9, noiseScl: 1.5,
    ampMul: 20, breathAmp: 3, breathSpd: 1.0,
    glowAlpha: 0.45, glowSize: 2.6, rotSpd: 0,
    cInR: 195, cInG: 218, cInB: 255,
    cOutR: 30, cOutG: 85, cOutB: 210,
    cGlR: 100, cGlG: 170, cGlB: 255,
  },
  listening: {
    noiseStr: 8, noiseSpd: 0.4, noiseScl: 1.3,
    ampMul: 0, breathAmp: 4, breathSpd: 0.9,
    glowAlpha: 0.22, glowSize: 2.0, rotSpd: 0,
    cInR: 85, cInG: 225, cInB: 165,
    cOutR: 8, cOutG: 85, cOutB: 62,
    cGlR: 18, cGlG: 180, cGlB: 128,
  },
  processing: {
    noiseStr: 5, noiseSpd: 0.5, noiseScl: 1.0,
    ampMul: 0, breathAmp: 2, breathSpd: 1.6,
    glowAlpha: 0.18, glowSize: 1.7, rotSpd: 0.35,
    cInR: 140, cInG: 145, cInB: 250,
    cOutR: 50, cOutG: 42, cOutB: 155,
    cGlR: 105, cGlG: 108, cGlB: 242,
  },
};

const N_PTS = 128;
const TAU = Math.PI * 2;
const LERP_RATE = 0.045;

function lrp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

// ── Renderer ──────────────────────────────────────────────────────

export class OrbRenderer {
  private ctx: CanvasRenderingContext2D;
  private w = 0;
  private t = 0;
  private raf = 0;
  private amp = 0;
  private sAmp = 0;
  private mode: OrbStateMode = "idle";
  private p: ModeParams = { ...MODES.idle };
  private radius = 0;
  private tgtRadius = 0;

  constructor(private canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) throw new Error("No 2D context");
    this.ctx = ctx;
  }

  setMode(m: OrbStateMode) {
    this.mode = m;
  }

  setAmplitude(a: number) {
    this.amp = Math.max(0, Math.min(1, a));
  }

  resize(px: number) {
    const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
    this.w = px;
    this.canvas.width = px * dpr;
    this.canvas.height = px * dpr;
    this.canvas.style.width = `${px}px`;
    this.canvas.style.height = `${px}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.tgtRadius = px * 0.28;
    if (this.radius === 0) this.radius = this.tgtRadius;
  }

  start() {
    const tick = () => {
      this.raf = requestAnimationFrame(tick);
      this.step();
    };
    this.raf = requestAnimationFrame(tick);
  }

  stop() {
    cancelAnimationFrame(this.raf);
  }

  private step() {
    this.t += 0.016;

    // Interpolate all params toward target mode
    const tgt = MODES[this.mode];
    const p = this.p;
    for (const k of Object.keys(tgt) as (keyof ModeParams)[]) {
      (p as unknown as Record<string, number>)[k] = lrp(p[k], tgt[k], LERP_RATE);
    }

    this.sAmp = lrp(this.sAmp, this.amp, 0.15);
    this.radius = lrp(this.radius, this.tgtRadius, 0.05);

    this.render();
  }

  private render() {
    const { ctx, w, t, p, sAmp } = this;
    const cx = w / 2;
    const cy = w / 2;
    const breathe = Math.sin(t * p.breathSpd) * p.breathAmp;
    const R = this.radius + breathe;

    ctx.clearRect(0, 0, w, w);

    // ── 1. Ambient haze ──
    const hazeR = R * p.glowSize * 1.4;
    const haze = ctx.createRadialGradient(cx, cy, R * 0.15, cx, cy, hazeR);
    haze.addColorStop(0, `rgba(${p.cGlR},${p.cGlG},${p.cGlB},${p.glowAlpha * 0.35})`);
    haze.addColorStop(0.4, `rgba(${p.cGlR},${p.cGlG},${p.cGlB},${p.glowAlpha * 0.1})`);
    haze.addColorStop(1, `rgba(${p.cGlR},${p.cGlG},${p.cGlB},0)`);
    ctx.fillStyle = haze;
    ctx.fillRect(0, 0, w, w);

    // ── 2. Compute blob surface ──
    const pts: [number, number][] = [];
    const nt = t * p.noiseSpd;
    const rot = t * p.rotSpd;
    const ampBoost = 1 + sAmp * (p.ampMul / Math.max(p.noiseStr, 1));

    for (let i = 0; i < N_PTS; i++) {
      const theta = (i / N_PTS) * TAU;
      const tRot = theta + rot;
      const nx = Math.cos(tRot) * p.noiseScl;
      const ny = Math.sin(tRot) * p.noiseScl;
      const d = fbm(nx + nt, ny + nt * 0.7) * p.noiseStr * ampBoost;
      const r = R + d;
      pts.push([cx + Math.cos(theta) * r, cy + Math.sin(theta) * r]);
    }

    // ── 3. Outer shell (faint translucent layer) ──
    const pts2: [number, number][] = [];
    const nt2 = t * p.noiseSpd * 0.5;
    for (let i = 0; i < N_PTS; i++) {
      const theta = (i / N_PTS) * TAU;
      const tRot = theta + rot * 0.4;
      const nx = Math.cos(tRot) * p.noiseScl * 0.75;
      const ny = Math.sin(tRot) * p.noiseScl * 0.75;
      const d = fbm(nx + nt2 + 50, ny + nt2 * 0.8 + 50) * p.noiseStr * 0.6 * ampBoost;
      const r = R * 1.1 + d;
      pts2.push([cx + Math.cos(theta) * r, cy + Math.sin(theta) * r]);
    }
    ctx.beginPath();
    this.catmullRom(pts2);
    ctx.closePath();
    ctx.strokeStyle = `rgba(${p.cInR},${p.cInG},${p.cInB},${0.04 + sAmp * 0.06})`;
    ctx.lineWidth = 0.8;
    ctx.stroke();

    // ── 4. Main blob with glow ──
    ctx.save();
    ctx.shadowBlur = R * 0.55 * (0.5 + sAmp * 0.5);
    ctx.shadowColor = `rgba(${p.cGlR},${p.cGlG},${p.cGlB},${p.glowAlpha})`;

    ctx.beginPath();
    this.catmullRom(pts);
    ctx.closePath();

    // Amplitude-driven color brightening
    const ab = sAmp * 0.4;
    const ir = Math.min(255, p.cInR + ab * (255 - p.cInR));
    const ig = Math.min(255, p.cInG + ab * (255 - p.cInG));
    const ib = Math.min(255, p.cInB + ab * (255 - p.cInB));

    const grad = ctx.createRadialGradient(
      cx - R * 0.15, cy - R * 0.2, 0,
      cx + R * 0.05, cy + R * 0.05, R * 1.15,
    );
    grad.addColorStop(0, `rgb(${ir},${ig},${ib})`);
    grad.addColorStop(0.55, `rgb(${lrp(ir, p.cOutR, 0.45)},${lrp(ig, p.cOutG, 0.45)},${lrp(ib, p.cOutB, 0.45)})`);
    grad.addColorStop(1, `rgb(${p.cOutR},${p.cOutG},${p.cOutB})`);

    ctx.fillStyle = grad;
    ctx.fill();
    ctx.restore();

    // ── 5. Specular highlight ──
    const sx = cx - R * 0.18 + Math.sin(t * 0.15) * R * 0.05;
    const sy = cy - R * 0.24 + Math.cos(t * 0.12) * R * 0.04;
    const spec = ctx.createRadialGradient(sx, sy, 0, sx, sy, R * 0.55);
    spec.addColorStop(0, `rgba(255,255,255,${0.18 + sAmp * 0.2})`);
    spec.addColorStop(0.35, `rgba(255,255,255,${0.04 + sAmp * 0.06})`);
    spec.addColorStop(1, "rgba(255,255,255,0)");
    ctx.beginPath();
    this.catmullRom(pts);
    ctx.closePath();
    ctx.fillStyle = spec;
    ctx.fill();

    // ── 6. Rim light ──
    ctx.beginPath();
    this.catmullRom(pts);
    ctx.closePath();
    ctx.strokeStyle = `rgba(${Math.min(255, ir + 30)},${Math.min(255, ig + 30)},${Math.min(255, ib + 20)},${0.1 + sAmp * 0.15})`;
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // ── 7. Speaking energy wisps ──
    if (sAmp > 0.04) {
      ctx.save();
      ctx.globalAlpha = 0.08 + sAmp * 0.18;
      ctx.lineWidth = 1;
      const wispCount = 6;
      for (let wi = 0; wi < wispCount; wi++) {
        const wPhase = t * 1.8 + (wi / wispCount) * TAU;
        const r1 = R * 0.15;
        const r2 = R * (0.55 + sAmp * 0.35);
        const a1 = wPhase;
        const a2 = wPhase + 0.6 + sAmp * 0.3;
        const cpA = (a1 + a2) / 2;
        const cpR = R * (0.65 + Math.sin(t * 2.5 + wi) * 0.15);

        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a1) * r1, cy + Math.sin(a1) * r1);
        ctx.quadraticCurveTo(
          cx + Math.cos(cpA) * cpR,
          cy + Math.sin(cpA) * cpR,
          cx + Math.cos(a2) * r2,
          cy + Math.sin(a2) * r2,
        );
        const wg = ctx.createLinearGradient(
          cx + Math.cos(a1) * r1, cy + Math.sin(a1) * r1,
          cx + Math.cos(a2) * r2, cy + Math.sin(a2) * r2,
        );
        wg.addColorStop(0, `rgba(${ir},${ig},${ib},0)`);
        wg.addColorStop(0.5, `rgba(${ir},${ig},${ib},0.7)`);
        wg.addColorStop(1, `rgba(${ir},${ig},${ib},0)`);
        ctx.strokeStyle = wg;
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  /** Catmull-Rom → Cubic Bezier for smooth closed curves */
  private catmullRom(pts: [number, number][]) {
    const n = pts.length;
    if (n < 3) return;
    this.ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 0; i < n; i++) {
      const p0 = pts[(i - 1 + n) % n];
      const p1 = pts[i];
      const p2 = pts[(i + 1) % n];
      const p3 = pts[(i + 2) % n];
      this.ctx.bezierCurveTo(
        p1[0] + (p2[0] - p0[0]) / 6,
        p1[1] + (p2[1] - p0[1]) / 6,
        p2[0] - (p3[0] - p1[0]) / 6,
        p2[1] - (p3[1] - p1[1]) / 6,
        p2[0], p2[1],
      );
    }
  }
}

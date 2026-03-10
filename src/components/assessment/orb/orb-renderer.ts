export type OrbStateMode = "idle" | "speaking" | "listening" | "processing";

// ── Hash-based noise (matches prototype) ────────────────────────

function noise2D(x: number, y: number): number {
  const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  return (n - Math.floor(n)) * 2 - 1;
}

function smoothNoise(x: number, y: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const a = noise2D(ix, iy);
  const b = noise2D(ix + 1, iy);
  const c = noise2D(ix, iy + 1);
  const d = noise2D(ix + 1, iy + 1);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

function fbm(x: number, y: number, oct: number): number {
  let v = 0;
  let amp = 0.5;
  let freq = 1;
  for (let i = 0; i < oct; i++) {
    v += smoothNoise(x * freq, y * freq) * amp;
    amp *= 0.5;
    freq *= 2;
  }
  return v;
}

// ── Particle types ──────────────────────────────────────────────

interface NeuralParticle {
  bx: number;
  by: number;
  depth: number;
  x: number;
  y: number;
  driftPX: number;
  driftPY: number;
  driftFX: number;
  driftFY: number;
  driftR: number;
  sz: number;
  bright: number;
  colorMix: number;
  pPhase: number;
  pSpeed: number;
}

interface Edge {
  a: number;
  b: number;
  d: number;
}

interface Signal {
  a: number;
  b: number;
  t: number;
  speed: number;
  warm: boolean;
}

interface Ripple {
  birth: number;
  cx: number;
  cy: number;
}

interface FluidCurrent {
  angle: number;
  orbitR: number;
  speed: number;
  size: number;
  phase: number;
  hue: number;
  sat: number;
  lit: number;
  baseAlpha: number;
  x: number;
  y: number;
}

// ── Renderer ────────────────────────────────────────────────────

export class OrbRenderer {
  private ctx: CanvasRenderingContext2D;
  private RES = 600;
  private CX = 300;
  private CY = 300;
  private R = 0;
  private raf = 0;
  private mode: OrbStateMode = "idle";
  private amp = 0;
  private sAmp = 0; // smoothed amplitude
  private auraAmp = 0; // slower-smoothed amplitude for aura
  private coreBright = 0; // core brightness boost

  // State blend values
  private speakBlend = 0;
  private listenBlend = 0;
  private orientAmount = 0;
  private orbSpeakTimer = 0;

  // Neural particles
  private particles: NeuralParticle[] = [];
  private edges: Edge[] = [];
  private signals: Signal[] = [];
  private ripples: Ripple[] = [];
  private rippleTimer = 0;
  private currents: FluidCurrent[] = [];

  private PCOUNT = 280;
  private CONN_DIST = 0;

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
    this.RES = px * dpr;
    this.canvas.width = this.RES;
    this.canvas.height = this.RES;
    this.canvas.style.width = `${px}px`;
    this.canvas.style.height = `${px}px`;
    this.CX = this.RES / 2;
    this.CY = this.RES / 2;
    this.R = this.RES * 0.44;
    this.CONN_DIST = this.R * 0.32;
    this.initParticles();
    this.buildEdges();
    this.initCurrents();
  }

  private initParticles() {
    this.particles = [];
    for (let i = 0; i < this.PCOUNT; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = Math.pow(Math.random(), 0.5) * this.R * 0.88;
      const bx = Math.sin(phi) * Math.cos(theta) * r;
      const by = Math.sin(phi) * Math.sin(theta) * r;
      const depth = Math.cos(phi) * r / this.R;
      this.particles.push({
        bx, by, depth, x: bx, y: by,
        driftPX: Math.random() * Math.PI * 2,
        driftPY: Math.random() * Math.PI * 2,
        driftFX: 0.0005 + Math.random() * 0.001,
        driftFY: 0.00045 + Math.random() * 0.0009,
        driftR: 2 + Math.random() * 5,
        sz: 0.6 + Math.random() * 1.4,
        bright: 0.2 + Math.random() * 0.8,
        colorMix: Math.random(),
        pPhase: Math.random() * Math.PI * 2,
        pSpeed: 0.0008 + Math.random() * 0.002,
      });
    }
  }

  private buildEdges() {
    this.edges = [];
    for (let i = 0; i < this.particles.length; i++) {
      for (let j = i + 1; j < this.particles.length; j++) {
        const dx = this.particles[i].bx - this.particles[j].bx;
        const dy = this.particles[i].by - this.particles[j].by;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < this.CONN_DIST) this.edges.push({ a: i, b: j, d });
      }
    }
  }

  private initCurrents() {
    this.currents = [];
    for (let i = 0; i < 6; i++) {
      this.currents.push({
        angle: (i / 6) * Math.PI * 2 + Math.random() * 0.5,
        orbitR: this.R * (0.15 + Math.random() * 0.45),
        speed: (0.06 + Math.random() * 0.12) * (Math.random() > 0.5 ? 1 : -1),
        size: this.R * (0.18 + Math.random() * 0.22),
        phase: Math.random() * Math.PI * 2,
        hue: 215 + Math.random() * 20,
        sat: 55 + Math.random() * 25,
        lit: 50 + Math.random() * 20,
        baseAlpha: 0.04 + Math.random() * 0.05,
        x: this.CX,
        y: this.CY,
      });
    }
  }

  private spawnSignal() {
    if (this.edges.length === 0) return;
    const e = this.edges[Math.floor(Math.random() * this.edges.length)];
    this.signals.push({
      a: e.a,
      b: e.b,
      t: 0,
      speed: 0.008 + Math.random() * 0.016,
      warm: Math.random() > 0.8,
    });
  }

  start() {
    const tick = () => {
      this.raf = requestAnimationFrame(tick);
      this.render();
    };
    this.raf = requestAnimationFrame(tick);
  }

  stop() {
    cancelAnimationFrame(this.raf);
  }

  private render() {
    const t = performance.now() * 0.001;
    const { ctx, RES, CX, CY, R } = this;

    ctx.clearRect(0, 0, RES, RES);

    // Smooth state blends
    this.speakBlend += ((this.mode === "speaking" ? 1 : 0) - this.speakBlend) * 0.04;
    this.listenBlend += ((this.mode === "listening" ? 1 : 0) - this.listenBlend) * 0.025;
    this.sAmp += (this.amp - this.sAmp) * 0.2;
    this.auraAmp += (this.amp - this.auraAmp) * 0.08;
    this.coreBright += (this.amp - this.coreBright) * 0.15;

    const dt = 16.67;
    if (this.mode === "speaking") {
      this.orbSpeakTimer += dt;
      if (this.orbSpeakTimer < 700) this.orientAmount = Math.min(1, this.orientAmount + 0.04);
      else if (this.orbSpeakTimer < 2800) this.orientAmount += (1 - this.orientAmount) * 0.02;
      else this.orientAmount = Math.max(0, this.orientAmount - 0.015);
    } else {
      this.orientAmount = Math.max(0, this.orientAmount - 0.01);
      this.orbSpeakTimer = 0;
    }

    const sb = this.speakBlend;
    const lb = this.listenBlend;

    // ── Outer aura (drawn before clip — behind the sphere) ──
    {
      // Idle breathing rhythm
      const breathe = 0.3 + Math.sin(t * 0.8) * 0.12;
      // Audio-reactive expansion — much stronger during speech
      const auraStrength = breathe + this.auraAmp * 1.2 + sb * 0.3;
      const auraRadius = R * (1.2 + auraStrength * 0.5);
      const auraAlpha = 0.025 + auraStrength * 0.09;

      // Primary blue aura
      const ag = ctx.createRadialGradient(CX, CY, R * 0.8, CX, CY, auraRadius);
      ag.addColorStop(0, `rgba(37, 99, 235, ${auraAlpha * 1.8})`);
      ag.addColorStop(0.3, `rgba(60, 130, 246, ${auraAlpha * 0.8})`);
      ag.addColorStop(0.6, `rgba(37, 99, 235, ${auraAlpha * 0.3})`);
      ag.addColorStop(1, "rgba(37, 99, 235, 0)");
      ctx.fillStyle = ag;
      ctx.beginPath();
      ctx.arc(CX, CY, auraRadius, 0, Math.PI * 2);
      ctx.fill();

      // Soft diffused outer glow — always present, amplified during speech
      const outerGlowR = R * (1.5 + sb * 0.4 + this.auraAmp * 0.3);
      const outerGlowA = 0.012 + sb * 0.025 + this.auraAmp * 0.015;
      const og = ctx.createRadialGradient(CX, CY, R, CX, CY, outerGlowR);
      og.addColorStop(0, `rgba(50, 120, 240, ${outerGlowA})`);
      og.addColorStop(0.5, `rgba(37, 99, 235, ${outerGlowA * 0.3})`);
      og.addColorStop(1, "rgba(37, 99, 235, 0)");
      ctx.fillStyle = og;
      ctx.beginPath();
      ctx.arc(CX, CY, outerGlowR, 0, Math.PI * 2);
      ctx.fill();

      // Warm accent aura (gold when speaking — more visible)
      if (sb > 0.01) {
        const warmAlpha = sb * (0.04 + this.auraAmp * 0.06);
        const wg = ctx.createRadialGradient(CX, CY, R * 0.85, CX, CY, auraRadius * 0.95);
        wg.addColorStop(0, `rgba(201, 168, 76, ${warmAlpha})`);
        wg.addColorStop(0.4, `rgba(201, 168, 76, ${warmAlpha * 0.4})`);
        wg.addColorStop(1, "rgba(201, 168, 76, 0)");
        ctx.fillStyle = wg;
        ctx.beginPath();
        ctx.arc(CX, CY, auraRadius * 0.95, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // ── Clip to circle ──
    ctx.save();
    ctx.beginPath();
    ctx.arc(CX, CY, R, 0, Math.PI * 2);
    ctx.clip();

    // ── Background ──
    const bg = ctx.createRadialGradient(CX, CY - R * 0.2, R * 0.05, CX, CY, R);
    bg.addColorStop(0, `rgba(10,20,45,${0.35 + sb * 0.15})`);
    bg.addColorStop(0.3, `rgba(8,16,38,${0.5 + sb * 0.1})`);
    bg.addColorStop(0.7, "rgba(5,12,28,0.7)");
    bg.addColorStop(1, "rgba(3,8,18,0.88)");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, RES, RES);

    // ── Nebulae ──
    ctx.globalCompositeOperation = "screen";
    for (let i = 0; i < 3; i++) {
      const nx = CX + fbm(t * 0.12 + i, i * 3.7, 2) * R * 0.5;
      const ny = CY + fbm(i * 2.1, t * 0.1 + i, 2) * R * 0.35;
      const ns = R * (0.25 + fbm(t * 0.08 + i * 5, i, 1) * 0.12);
      const na = 0.015 + fbm(t * 0.15, i * 7, 1) * 0.008;
      const ng = ctx.createRadialGradient(nx, ny, 0, nx, ny, ns);
      ng.addColorStop(0, `rgba(37,99,235,${na})`);
      ng.addColorStop(1, "rgba(37,99,235,0)");
      ctx.fillStyle = ng;
      ctx.fillRect(0, 0, RES, RES);
    }

    // ── Fluid currents ──
    for (const c of this.currents) {
      const a = c.angle + t * c.speed;
      const drift = fbm(t * 0.15 + c.phase, c.phase, 2) * R * 0.08;
      let nx = CX + Math.cos(a) * c.orbitR + drift;
      let ny = CY + Math.sin(a) * c.orbitR * 0.6 + drift * 0.5;
      nx += (CX - nx) * sb * 0.25;
      ny += (CY + R * 0.2 - ny) * sb * 0.2;
      c.x += (nx - c.x) * 0.03;
      c.y += (ny - c.y) * 0.03;

      const pulse = 0.85 + Math.sin(t * 1.1 + c.phase) * 0.15;
      const sz = c.size * pulse * (1 + sb * 0.15);
      const breath = 0.8 + Math.sin(t * 0.6 + c.phase * 2) * 0.2;
      const alpha = c.baseAlpha * breath * (1 + sb * 0.5 + lb * 0.25);
      const h = c.hue + Math.sin(t * 0.3 + c.phase) * 8;
      const g = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, sz);
      g.addColorStop(0, `hsla(${h},${c.sat}%,${c.lit}%,${alpha * 1.2})`);
      g.addColorStop(0.4, `hsla(${h},${c.sat}%,${c.lit - 10}%,${alpha * 0.4})`);
      g.addColorStop(1, `hsla(${h},${c.sat}%,${c.lit}%,0)`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(c.x, c.y, sz, 0, Math.PI * 2);
      ctx.fill();
    }

    // ── Update particles ──
    for (const p of this.particles) {
      let ddx = Math.sin(t * p.driftFX + p.driftPX) * p.driftR;
      let ddy = Math.cos(t * p.driftFY + p.driftPY) * p.driftR;
      let tx = p.bx + ddx;
      let ty = p.by + ddy;
      if (this.orientAmount > 0.001) {
        const distC = Math.sqrt(p.bx * p.bx + p.by * p.by);
        const normD = distC / (R || 1);
        const shift = this.orientAmount * R * 0.18 * (0.3 + normD * 0.7);
        tx += 0; // UDX = 0
        ty += 0.5 * shift; // UDY = 0.5
      }
      p.x += (tx - p.x) * 0.05;
      p.y += (ty - p.y) * 0.05;
    }

    // ── Edges ──
    ctx.globalCompositeOperation = "screen";
    const edgeAlpha = this.mode === "speaking" ? 0.09 + this.orientAmount * 0.06 + this.sAmp * 0.05 : 0.035;
    ctx.lineWidth = 0.6;
    for (const e of this.edges) {
      const pa = this.particles[e.a];
      const pb = this.particles[e.b];
      const dx = (CX + pa.x) - (CX + pb.x);
      const dy = (CY + pa.y) - (CY + pb.y);
      const cd = Math.sqrt(dx * dx + dy * dy);
      const maxD = this.CONN_DIST * 1.4;
      if (cd > maxD) continue;
      const fade = 1 - cd / maxD;
      const depthF = (pa.depth + pb.depth + 2) / 4;
      const a = edgeAlpha * fade * depthF;
      if (a < 0.002) continue;
      ctx.beginPath();
      ctx.moveTo(CX + pa.x, CY + pa.y);
      ctx.lineTo(CX + pb.x, CY + pb.y);
      const warm = pa.colorMix > 0.85 || pb.colorMix > 0.85;
      if (warm) {
        ctx.strokeStyle = `rgba(201,168,76,${a * 0.7})`;
      } else {
        ctx.strokeStyle = `rgba(${37 + Math.round(depthF * 40)},${99 + Math.round(depthF * 30)},235,${a})`;
      }
      ctx.stroke();
    }

    // ── Signals ──
    for (let i = this.signals.length - 1; i >= 0; i--) {
      const s = this.signals[i];
      s.t += s.speed;
      if (s.t >= 1) {
        this.signals.splice(i, 1);
        continue;
      }
      const pa = this.particles[s.a];
      const pb = this.particles[s.b];
      const sx = CX + pa.x + (pb.x - pa.x) * s.t;
      const sy = CY + pa.y + (pb.y - pa.y) * s.t;
      const br = Math.sin(s.t * Math.PI);
      const sr = 1.5 + br * 2.5;
      const sg = ctx.createRadialGradient(sx, sy, 0, sx, sy, sr * 5);
      if (s.warm) {
        sg.addColorStop(0, `rgba(220,190,100,${br * 0.6})`);
        sg.addColorStop(0.4, `rgba(201,168,76,${br * 0.12})`);
      } else {
        sg.addColorStop(0, `rgba(120,170,250,${br * 0.6})`);
        sg.addColorStop(0.4, `rgba(37,99,235,${br * 0.12})`);
      }
      sg.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = sg;
      ctx.beginPath();
      ctx.arc(sx, sy, sr * 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(sx, sy, sr * 0.5, 0, Math.PI * 2);
      ctx.fillStyle = s.warm
        ? `rgba(255,230,160,${br * 0.9})`
        : `rgba(180,210,255,${br * 0.9})`;
      ctx.fill();
    }

    // ── Draw particles ──
    for (const p of this.particles) {
      const pulse = Math.sin(t * p.pSpeed * 1000 + p.pPhase) * 0.5 + 0.5;
      const dB = (p.depth + 1) / 2;
      let alpha = p.bright * (0.15 + dB * 0.55) * (0.6 + pulse * 0.4);
      // Stronger brightness boost during speech — particles come alive
      const speakMul = this.mode === "speaking" ? 1.6 + this.sAmp * 1.2 : 1;
      alpha = Math.min(1, alpha * speakMul);
      // Particles grow slightly with amplitude
      const ampSize = this.mode === "speaking" ? 1 + this.sAmp * 0.3 : 1;
      const sz = p.sz * (0.7 + dB * 0.5 + pulse * 0.12) * ampSize;
      let r: number, g: number, b: number;
      if (p.colorMix < 0.75) {
        // Blue particles — shift toward lighter blue during speech
        r = 37 + Math.round(dB * 50) + Math.round(sb * this.sAmp * 30);
        g = 99 + Math.round(dB * 40) + Math.round(sb * this.sAmp * 25);
        b = 200 + Math.round(dB * 35) + Math.round(sb * 15);
      } else if (p.colorMix < 0.9) {
        // Cyan/teal accent particles (new color variation)
        r = 40 + Math.round(dB * 30);
        g = 160 + Math.round(dB * 50) + Math.round(sb * this.sAmp * 20);
        b = 200 + Math.round(dB * 40);
      } else {
        // Gold particles — warmer and brighter during speech
        r = 190 + Math.round(dB * 40) + Math.round(sb * 20);
        g = 160 + Math.round(dB * 25) + Math.round(sb * 15);
        b = 60 + Math.round(dB * 20);
      }
      ctx.beginPath();
      ctx.arc(CX + p.x, CY + p.y, sz, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${r},${g},${b},${alpha})`;
      ctx.fill();
      // Glow halo around bright particles — more visible during speech
      if (p.bright > 0.5 && dB > 0.4) {
        const glowSize = sz + 3 + (sb * this.sAmp * 4);
        const glowAlpha = alpha * (0.06 + sb * 0.08);
        ctx.beginPath();
        ctx.arc(CX + p.x, CY + p.y, glowSize, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${r},${g},${b},${glowAlpha})`;
        ctx.fill();
      }
    }

    // ── Energy core (amplitude-reactive brightness) ──
    const coreBoost = this.coreBright * 0.2;
    const corePulse = Math.sin(t * 1.5) * 0.02 * (1 + sb * 2);
    const coreA = 0.04 + corePulse + sb * 0.1 + lb * 0.03 + coreBoost;
    const coreRadius = R * (0.4 + sb * this.sAmp * 0.1);
    const cg = ctx.createRadialGradient(CX, CY, 0, CX, CY, coreRadius);
    cg.addColorStop(0, `rgba(${90 + Math.round(this.coreBright * 60)},${160 + Math.round(this.coreBright * 40)},255,${coreA * 1.5})`);
    cg.addColorStop(0.4, `rgba(60,130,250,${coreA * 0.5})`);
    cg.addColorStop(0.7, `rgba(37,99,235,${coreA * 0.15})`);
    cg.addColorStop(1, "rgba(37,99,235,0)");
    ctx.fillStyle = cg;
    ctx.beginPath();
    ctx.arc(CX, CY, coreRadius, 0, Math.PI * 2);
    ctx.fill();

    // ── Caustic ──
    const ca = t * 0.1;
    const cx1 = CX + Math.cos(ca) * R * 0.3;
    const cy1 = CY + Math.sin(ca * 1.3) * R * 0.2;
    const caG = ctx.createRadialGradient(cx1, cy1, 0, cx1, cy1, R * 0.35);
    caG.addColorStop(0, `rgba(100,160,250,${0.025 + sb * 0.025})`);
    caG.addColorStop(1, "rgba(100,160,250,0)");
    ctx.fillStyle = caG;
    ctx.beginPath();
    ctx.arc(CX, CY, R, 0, Math.PI * 2);
    ctx.fill();

    // ── Speaking ripples (sound waves — amplitude reactive) ──
    ctx.globalCompositeOperation = "screen";
    this.ripples = this.ripples.filter((rp) => {
      const age = t - rp.birth;
      if (age > 2.0) return false;
      const prog = age / 2.0;
      const rr = R * 0.1 + R * 0.9 * prog;
      // Ripple intensity scales with speaking blend AND amplitude
      const intensity = Math.max(sb, 0.01) * (0.6 + this.sAmp * 0.8);
      const alpha = (1 - prog) * (1 - prog) * 0.12 * intensity;
      const w = 1.5 + prog * 4 + this.sAmp * 2;
      ctx.beginPath();
      ctx.arc(rp.cx, rp.cy, rr, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(80,150,250,${alpha})`;
      ctx.lineWidth = w;
      ctx.stroke();
      // Secondary warm ripple ring
      ctx.beginPath();
      ctx.arc(rp.cx, rp.cy, rr * 0.82, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(201,168,76,${alpha * 0.3})`;
      ctx.lineWidth = w * 0.6;
      ctx.stroke();
      return true;
    });

    ctx.globalCompositeOperation = "source-over";

    // ── Edge darkening ──
    const edgeG = ctx.createRadialGradient(CX, CY, R * 0.65, CX, CY, R);
    edgeG.addColorStop(0, "rgba(0,0,0,0)");
    edgeG.addColorStop(0.5, "rgba(0,4,12,0.12)");
    edgeG.addColorStop(1, "rgba(0,4,12,0.55)");
    ctx.fillStyle = edgeG;
    ctx.beginPath();
    ctx.arc(CX, CY, R, 0, Math.PI * 2);
    ctx.fill();

    // ── Rim ──
    const rimG = ctx.createRadialGradient(CX, CY, R * 0.86, CX, CY, R);
    rimG.addColorStop(0, "rgba(80,150,250,0)");
    rimG.addColorStop(0.5, `rgba(80,150,250,${0.025 + sb * 0.04})`);
    rimG.addColorStop(1, `rgba(100,170,255,${0.05 + sb * 0.05})`);
    ctx.fillStyle = rimG;
    ctx.beginPath();
    ctx.arc(CX, CY, R, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();

    // ── Ripple scheduling — faster when amplitude is high ──
    if (this.mode === "speaking") {
      this.rippleTimer += 0.016;
      // Ripple interval: faster when speaking louder (0.3s at peak, 0.6s at quiet)
      const rippleInterval = 0.6 - this.sAmp * 0.3 + Math.random() * 0.15;
      if (this.rippleTimer > rippleInterval) {
        this.ripples.push({
          birth: t,
          cx: CX + Math.random() * 6 - 3,
          cy: CY + Math.random() * 6 - 3,
        });
        if (this.ripples.length > 8) this.ripples.shift();
        this.rippleTimer = 0;
      }
    } else {
      this.rippleTimer = 0;
    }

    // ── Idle/speaking signals — more neural activity during speech ──
    if (this.mode === "idle" && Math.random() < 0.015) this.spawnSignal();
    if (this.mode === "speaking" && Math.random() < 0.12 + this.sAmp * 0.08) this.spawnSignal();
  }
}

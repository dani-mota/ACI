"use client";

import { useState, useCallback, useMemo } from "react";
import {
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  ResponsiveContainer, useChartWidth, useChartHeight, useOffset,
} from "recharts";
import { CONSTRUCTS, LAYER_INFO, type LayerType } from "@/lib/constructs";

// ─── types shared by overlay components ──────────────────────────────────────
type SpiderDataItem = {
  key: string;
  construct: string;
  fullName: string;
  definition: string;
  roleRelevance: string | undefined;
  percentile: number;
  benchmark: number;
  weight: number;
  layer: LayerType;
  layerColor: string;
};

// ─── LayerOverlay ─────────────────────────────────────────────────────────────
// Rendered as a direct child of RadarChart so Recharts context hooks work.
function LayerOverlay({ data }: { data: SpiderDataItem[] }) {
  const chartWidth = useChartWidth() ?? 0;
  const chartHeight = useChartHeight() ?? 0;
  const offset = useOffset();

  // Match Recharts' internal polar layout computation
  const plotW = chartWidth - (offset?.left ?? 0) - (offset?.right ?? 0);
  const plotH = chartHeight - (offset?.top ?? 0) - (offset?.bottom ?? 0);
  const maxRadius = Math.min(plotW, plotH) / 2;
  const outerRadius = maxRadius * 0.72;
  const cx = chartWidth / 2;
  const cy = chartHeight / 2;

  if (!outerRadius || !cx || !cy) return null;

  const count = data.length;

  const scorePoints = data.map((d, i) => {
    const angle = (Math.PI * 2 * i) / count - Math.PI / 2;
    const r = (d.percentile / 100) * outerRadius;
    return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle), color: d.layerColor, layer: d.layer };
  });

  // Per-sector gradient triangles: center → point[i] → point[i+1]
  // Each sector reuses the same gradient ID as its outline edge
  const sectors = scorePoints.map((pt, i) => {
    const next = scorePoints[(i + 1) % count];
    return {
      path: `M ${cx} ${cy} L ${pt.x} ${pt.y} L ${next.x} ${next.y} Z`,
      gradId: `edge-grad-${i}`,
    };
  });

  const edgeGradients = scorePoints.map((pt, i) => {
    const next = scorePoints[(i + 1) % count];
    const id = `edge-grad-${i}`;
    return { id, x1: pt.x, y1: pt.y, x2: next.x, y2: next.y, color1: pt.color, color2: next.color };
  });

  const gapSegments = data.map((d, i) => {
    if (!d.benchmark || d.benchmark <= 0 || d.percentile >= d.benchmark) return null;
    const angle = (Math.PI * 2 * i) / count - Math.PI / 2;
    const r1 = (d.percentile / 100) * outerRadius;
    const r2 = (d.benchmark / 100) * outerRadius;
    return {
      x1: cx + r1 * Math.cos(angle), y1: cy + r1 * Math.sin(angle),
      x2: cx + r2 * Math.cos(angle), y2: cy + r2 * Math.sin(angle),
    };
  }).filter(Boolean);

  return (
    <g>
      <defs>
        {edgeGradients.map((g) => (
          <linearGradient key={g.id} id={g.id} gradientUnits="userSpaceOnUse" x1={g.x1} y1={g.y1} x2={g.x2} y2={g.y2}>
            <stop offset="0%" stopColor={g.color1} />
            <stop offset="100%" stopColor={g.color2} />
          </linearGradient>
        ))}
      </defs>
      {sectors.map((s, i) => (
        <path key={`sector-${i}`} d={s.path} fill={`url(#${s.gradId})`} fillOpacity={0.2} stroke="none" />
      ))}
      {edgeGradients.map((seg) => (
        <line key={seg.id} x1={seg.x1} y1={seg.y1} x2={seg.x2} y2={seg.y2}
          stroke={`url(#${seg.id})`} strokeWidth={2.5} strokeLinecap="round" />
      ))}
      {gapSegments.map((seg, i) => (
        <line key={`gap-${i}`} x1={seg!.x1} y1={seg!.y1} x2={seg!.x2} y2={seg!.y2}
          stroke="#DC2626" strokeWidth={3} strokeOpacity={0.55} strokeLinecap="round" />
      ))}
    </g>
  );
}

// ─── ScoreLabels ──────────────────────────────────────────────────────────────
function ScoreLabels({ data, top3Keys }: { data: SpiderDataItem[]; top3Keys: string[] }) {
  const chartWidth = useChartWidth() ?? 0;
  const chartHeight = useChartHeight() ?? 0;
  const offset = useOffset();

  const plotW = chartWidth - (offset?.left ?? 0) - (offset?.right ?? 0);
  const plotH = chartHeight - (offset?.top ?? 0) - (offset?.bottom ?? 0);
  const maxRadius = Math.min(plotW, plotH) / 2;
  const outerRadius = maxRadius * 0.72;
  const cx = chartWidth / 2;
  const cy = chartHeight / 2;

  if (!outerRadius || !cx || !cy) return null;

  const count = data.length;

  return (
    <g>
      {data.map((d, i) => {
        if (d.percentile === 0) return null;
        const angle = (Math.PI * 2 * i) / count - Math.PI / 2;
        const r = (d.percentile / 100) * outerRadius;
        const isTop3 = top3Keys.includes(d.key);
        const belowBenchmark = d.benchmark > 0 && d.percentile < d.benchmark;
        const labelColor = belowBenchmark ? "#DC2626" : d.layerColor;
        const labelR = r + 13;
        const lx = cx + labelR * Math.cos(angle);
        const ly = cy + labelR * Math.sin(angle);
        const cosA = Math.cos(angle);
        const textAnchor = cosA > 0.15 ? "start" : cosA < -0.15 ? "end" : "middle";
        return (
          <text key={d.key} x={lx} y={ly} textAnchor={textAnchor} dominantBaseline="central"
            fill={labelColor} fontSize={isTop3 ? 11 : 9} fontWeight={isTop3 ? 700 : 400}
            opacity={isTop3 ? 0.9 : 0.55}
            style={{ fontFamily: "var(--font-mono, monospace)", pointerEvents: "none" }}
          >
            {d.percentile}
          </text>
        );
      })}
    </g>
  );
}

interface SpiderChartProps {
  subtestResults: any[];
  roleWeights: any[];
  cutline?: any;
  roleSlug?: string;
  roleName?: string;
  weightDiffs?: Record<string, number>;
  showAnimation?: boolean;
}

function getBenchmark(constructKey: string, layer: LayerType, cutline: any): number {
  if (!cutline) return 0;
  if (constructKey === "LEARNING_VELOCITY") return cutline.learningVelocity ?? 0;
  if (layer === "TECHNICAL_APTITUDE") return cutline.technicalAptitude ?? 0;
  if (layer === "BEHAVIORAL_INTEGRITY") return cutline.behavioralIntegrity ?? 0;
  return cutline.overallMinimum ?? 30;
}

export function SpiderChart({ subtestResults, roleWeights, cutline, roleSlug, roleName, weightDiffs, showAnimation }: SpiderChartProps) {
  const [viewType, setViewType] = useState<"radar" | "bar">("radar");
  const [hoveredLabel, setHoveredLabel] = useState<string | null>(null);
  const [labelPos, setLabelPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const data = useMemo(() => Object.entries(CONSTRUCTS).map(([key, meta]) => {
    const result = subtestResults.find((r: any) => r.construct === key);
    const weight = roleWeights.find((w: any) => w.constructId === key);
    const layer = meta.layer as LayerType;
    const percentile = result?.percentile ?? 0;
    const benchmark = getBenchmark(key, layer, cutline);

    return {
      key,
      construct: meta.abbreviation,
      fullName: meta.name,
      definition: meta.definition,
      roleRelevance: roleSlug ? meta.roleRelevance[roleSlug] : undefined,
      percentile,
      benchmark,
      weight: weight?.weight ?? 0,
      layer,
      layerColor: LAYER_INFO[layer].color,
    };
  }), [subtestResults, roleWeights, cutline, roleSlug]);

  // Top 3 weighted constructs — shown with bold score labels
  const top3Keys = useMemo(
    () => [...data].sort((a, b) => b.weight - a.weight).slice(0, 3).map((d) => d.key),
    [data]
  );

  const hoveredData = hoveredLabel ? data.find((d) => d.construct === hoveredLabel) : null;

  // Diamond dot — red when below benchmark, layer color otherwise
  const CustomDot = useCallback((props: any) => {
    const { cx, cy, payload } = props;
    if (!payload) return null;

    const belowBenchmark = payload.benchmark > 0 && payload.percentile < payload.benchmark;
    const dotColor = belowBenchmark ? "#DC2626" : payload.layerColor;
    const s = 4;
    const points = `${cx},${cy - s} ${cx + s},${cy} ${cx},${cy + s} ${cx - s},${cy}`;

    const diff = showAnimation && weightDiffs ? weightDiffs[payload.key] : 0;
    const pulseColor = diff > 0 ? "rgba(5, 150, 105, 0.6)" : diff < 0 ? "rgba(217, 119, 6, 0.6)" : null;

    return (
      <g>
        {pulseColor && (
          <circle cx={cx} cy={cy} r={10} fill="none" stroke={pulseColor} strokeWidth={2}>
            <animate attributeName="r" from="4" to="14" dur="0.6s" repeatCount="2" />
            <animate attributeName="opacity" from="1" to="0" dur="0.6s" repeatCount="2" />
          </circle>
        )}
        <polygon
          points={points}
          fill={dotColor}
          stroke="var(--card)"
          strokeWidth={1.5}
        />
      </g>
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showAnimation, weightDiffs]);

  // Axis labels — red when below benchmark
  const CustomTick = useCallback((props: any) => {
    const { x, y, payload } = props;
    const d = data.find((item) => item.construct === payload.value);
    const belowBenchmark = d && d.benchmark > 0 && d.percentile < d.benchmark;
    const baseColor = belowBenchmark ? "#DC2626" : (d?.layerColor ?? "var(--muted-foreground)");
    const diff = showAnimation && weightDiffs && d ? weightDiffs[d.key] : 0;
    const animColor = diff > 0 ? "#059669" : diff < 0 ? "#D97706" : null;
    const color = animColor ?? baseColor;

    return (
      <g
        onMouseEnter={(e) => {
          setHoveredLabel(payload.value);
          setLabelPos({ x: e.clientX, y: e.clientY });
        }}
        onMouseLeave={() => setHoveredLabel(null)}
        style={{ cursor: "pointer" }}
      >
        <circle cx={x} cy={y} r={12} fill="transparent" />
        {animColor && (
          <circle cx={x} cy={y} r={14} fill={animColor} fillOpacity={0.15}>
            <animate attributeName="fillOpacity" values="0.15;0.3;0.15" dur="0.6s" repeatCount="2" />
          </circle>
        )}
        <text
          x={x}
          y={y}
          textAnchor="middle"
          dominantBaseline="central"
          fill={color}
          fontSize={11}
          fontWeight={700}
          style={{ fontFamily: "var(--font-mono, monospace)" }}
        >
          {payload.value}
        </text>
      </g>
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, showAnimation, weightDiffs]);


  return (
    <div className="bg-card border border-border p-5 relative">
      <style>{`@keyframes spiderFadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }`}</style>

      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider" style={{ fontFamily: "var(--font-dm-sans)" }}>
          Construct Profile
        </h2>
        <div className="flex gap-0.5 bg-muted p-0.5">
          <button
            onClick={() => setViewType("radar")}
            className={`px-2.5 py-1 text-[10px] font-medium transition-colors ${
              viewType === "radar" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            RADAR
          </button>
          <button
            onClick={() => setViewType("bar")}
            className={`px-2.5 py-1 text-[10px] font-medium transition-colors ${
              viewType === "bar" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            BAR
          </button>
        </div>
      </div>

      {viewType === "radar" ? (
        <div className="h-[400px]">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart cx="50%" cy="50%" outerRadius="72%" data={data}>
              {/* Concentric rings + radial spokes — the full spider web grid */}
              <PolarGrid
                stroke="rgba(100, 116, 139, 0.18)"
                radialLines={true}
              />
              {/* Layer wedge fills + red gap segments (rendered behind data) */}
              <LayerOverlay data={data} />
              <PolarAngleAxis
                dataKey="construct"
                tick={<CustomTick />}
              />
              <PolarRadiusAxis
                angle={90}
                domain={[0, 100]}
                tick={{ fill: "var(--muted-foreground)", fontSize: 9 }}
                tickCount={5}
              />
              {/* Role benchmark — dashed muted polygon */}
              <Radar
                name="Benchmark"
                dataKey="benchmark"
                stroke="rgba(100, 116, 139, 0.45)"
                strokeDasharray="4 4"
                fill="none"
                strokeWidth={1}
                dot={false}
                activeDot={false}
                isAnimationActive={false}
              />
              {/* Single unified candidate profile polygon — stroke drawn by LayerOverlay */}
              <Radar
                name="Score"
                dataKey="percentile"
                stroke="transparent"
                fill="rgba(203, 213, 225, 0.04)"
                strokeWidth={0}
                dot={<CustomDot />}
                activeDot={false}
              />
              {/* Score labels positioned outward from each dot */}
              <ScoreLabels data={data} top3Keys={top3Keys} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="space-y-1.5">
          {data.map((d) => {
            const diff = showAnimation && weightDiffs ? weightDiffs[d.key] : 0;
            const animClass = diff > 0 ? "animate-pulse-green" : diff < 0 ? "animate-pulse-amber" : "";
            const belowBenchmark = d.benchmark > 0 && d.percentile < d.benchmark;
            return (
              <div key={d.construct} className={`flex items-center gap-3 ${animClass}`}>
                <span
                  className={`w-7 text-[10px] font-mono font-medium text-right ${diff > 0 ? "animate-pulse-green-text" : diff < 0 ? "animate-pulse-amber-text" : ""}`}
                  style={{ color: belowBenchmark ? "#DC2626" : d.layerColor }}
                >
                  {d.construct}
                </span>
                <div className="flex-1 h-5 bg-muted overflow-hidden relative">
                  <div
                    className="h-full transition-all duration-500"
                    style={{
                      width: `${d.percentile}%`,
                      backgroundColor: belowBenchmark ? "#DC2626" : d.layerColor,
                      opacity: 0.8,
                    }}
                  />
                  {/* Benchmark marker */}
                  <div
                    className="absolute top-0 bottom-0 w-px bg-muted-foreground/50"
                    style={{ left: `${d.benchmark}%` }}
                  />
                </div>
                <span
                  className="w-8 text-[10px] font-mono font-medium tabular-nums text-right"
                  style={{ color: belowBenchmark ? "#DC2626" : d.layerColor }}
                >
                  {d.percentile}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Tooltip — on axis label hover */}
      {hoveredData && (
        <div
          className="fixed z-50 bg-card/95 backdrop-blur-sm p-4 shadow-xl border border-border max-w-[280px]"
          style={{
            left: labelPos.x + 16,
            top: labelPos.y - 12,
            pointerEvents: "none",
            animation: "spiderFadeIn 120ms ease-out",
          }}
        >
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2" style={{ backgroundColor: hoveredData.layerColor }} />
            <p className="font-semibold text-xs text-foreground uppercase tracking-wider">{hoveredData.fullName}</p>
          </div>
          <p className="text-lg font-bold font-mono mb-1" style={{ color: hoveredData.layerColor }}>
            {hoveredData.percentile}<span className="text-[10px] font-normal text-muted-foreground ml-0.5">th percentile</span>
          </p>
          <p className="text-[10px] text-muted-foreground font-mono mb-2">
            Benchmark: {hoveredData.benchmark}th
            {hoveredData.percentile >= hoveredData.benchmark
              ? <span className="text-aci-green ml-1">(+{hoveredData.percentile - hoveredData.benchmark} above)</span>
              : <span className="text-aci-red ml-1">({hoveredData.percentile - hoveredData.benchmark} below)</span>
            }
          </p>
          <p className="text-[10px] text-muted-foreground leading-relaxed mb-2">{hoveredData.definition}</p>
          {hoveredData.roleRelevance && (
            <div className="pt-2 border-t border-border">
              <p className="text-[9px] text-aci-gold uppercase tracking-wider font-medium mb-1">Why This Matters</p>
              <p className="text-[10px] text-muted-foreground leading-relaxed">{hoveredData.roleRelevance}</p>
            </div>
          )}
        </div>
      )}

      {/* Legend */}
      <div className="flex justify-center gap-5 mt-4 pt-3 border-t border-border flex-wrap">
        {Object.entries(LAYER_INFO).map(([key, info]) => (
          <div key={key} className="flex items-center gap-1.5">
            <div className="w-2 h-2" style={{ backgroundColor: info.color }} />
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{info.name}</span>
          </div>
        ))}
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-0 border-t border-dashed" style={{ borderColor: "rgba(100, 116, 139, 0.5)" }} />
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
            Benchmark{roleName ? `: ${roleName}` : ""}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-0.5 rounded" style={{ backgroundColor: "rgba(220, 38, 38, 0.5)" }} />
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Below cutline</span>
        </div>
      </div>
    </div>
  );
}

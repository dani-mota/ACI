"use client";

import { useMemo } from "react";
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer } from "recharts";
import { CONSTRUCTS, LAYER_INFO, type LayerType } from "@/lib/constructs";

interface WeightRadarChartProps {
  weights: Record<string, number>;
}

// PRO-89 PR#2 sub-task 3. Presentational only — receives `weights` as
// a prop, no internal state, no AI calls. Re-renders whenever the
// parent's weights map changes (i.e. every slider release in
// WeightVisualizer).
//
// Domain is hardcoded [0, 25] per AC. Weight percentages cap at 25
// (per-construct max), and a fixed domain keeps the polygon shape
// comparable across roles. Auto-fit would rescale per role and make
// cross-role shape comparison meaningless.
//
// Stroke + fill use var(--color-aci-gold) to match the existing page
// accent semantic (◆ recommendation diamond, lock icons). The token
// currently resolves to sky-blue (#0EA5E9) due to PRO-185's misnaming
// — when PRO-185 ships, this recolors in lockstep with the rest of
// the page's gold accents. Deliberately ridden, not avoided.
export function WeightRadarChart({ weights }: WeightRadarChartProps) {
  // CONSTRUCTS insertion order (5 cognitive → 5 technical → 2 behavioral)
  // is load-bearing for the radar's layer grouping. See the warning at
  // constructs.ts:32-37.
  const data = useMemo(
    () =>
      Object.entries(CONSTRUCTS).map(([id, meta]) => ({
        construct: meta.abbreviation,
        value: weights[id] ?? 0,
        layerColor: LAYER_INFO[meta.layer as LayerType].color,
      })),
    [weights]
  );

  // Custom axis tick. Two responsibilities:
  // 1. Color each label by its layer (cognitive=blue, technical=green,
  //    behavioral=amber) — Recharts' built-in tick can't do per-tick color.
  // 2. Compute textAnchor from the label's x position vs chart center,
  //    so labels at 3 o'clock extend right (anchor: "start"), labels at
  //    9 o'clock extend left ("end"), and labels at top/bottom center
  //    ("middle"). Without this, all labels would anchor at middle and
  //    overlap the polygon edge on side positions. Recharts injects
  //    `cx`/`cy` (chart center) on every tick invocation at runtime.
  //
  // `any` typing mirrors spider-chart.tsx's CustomTick — Recharts'
  // BaseTickContentProps type is missing cx/cy fields even though they
  // are passed at runtime. Casting the whole prop object is the lowest-
  // friction workaround and matches the existing codebase pattern.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const CustomTick = (props: any) => {
    const { x, y, cx, payload } = props;
    const d = data.find((item) => item.construct === payload.value);
    const color = d?.layerColor ?? "var(--muted-foreground)";
    const anchor: "start" | "middle" | "end" =
      Math.abs(x - cx) < 8 ? "middle" : x > cx ? "start" : "end";
    return (
      <text
        x={x}
        y={y}
        textAnchor={anchor}
        dominantBaseline="central"
        fill={color}
        fontSize={10}
        fontWeight={600}
        style={{ fontFamily: "var(--font-mono, monospace)" }}
      >
        {payload.value}
      </text>
    );
  };

  return (
    <div className="h-[300px]">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart cx="50%" cy="50%" outerRadius="75%" data={data}>
          <PolarGrid stroke="rgba(100, 116, 139, 0.18)" radialLines={true} />
          {/* Recharts clones the tick element and injects real x/y/cx/cy/
              payload at render time, so the placeholder props passed here
              are ignored. Same pattern as spider-chart.tsx:312-315. */}
          <PolarAngleAxis dataKey="construct" tick={CustomTick} />
          <PolarRadiusAxis
            angle={90}
            domain={[0, 25]}
            tickCount={6}
            tick={{ fill: "var(--muted-foreground)", fontSize: 9 }}
          />
          <Radar
            name="Weight"
            dataKey="value"
            stroke="var(--color-aci-gold)"
            strokeWidth={2}
            fill="var(--color-aci-gold)"
            fillOpacity={0.15}
            isAnimationActive={false}
            dot={false}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}

"use client";

import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from "recharts";
import {
  CONSTRUCT_IDS,
  CONSTRUCT_SHORT_LABELS,
  type ConstructVector,
} from "@/lib/team-composition/types";

interface RadarSeries {
  label: string;
  data: ConstructVector;
  color: string;
  opacity?: number;
  strokeDash?: string;
}

interface TeamRadarChartProps {
  series: RadarSeries[];
  height?: number;
}

export function TeamRadarChart({ series, height = 400 }: TeamRadarChartProps) {
  const chartData = CONSTRUCT_IDS.map((cid) => {
    const point: Record<string, string | number> = {
      construct: CONSTRUCT_SHORT_LABELS[cid],
      fullMark: 100,
    };
    for (const s of series) {
      point[s.label] = Math.round(s.data[cid]);
    }
    return point;
  });

  return (
    <ResponsiveContainer width="100%" height={height}>
      <RadarChart cx="50%" cy="50%" outerRadius="72%" data={chartData}>
        <PolarGrid
          stroke="rgba(148, 163, 184, 0.15)"
          gridType="polygon"
        />
        <PolarAngleAxis
          dataKey="construct"
          tick={{ fill: "#94A3B8", fontSize: 11, fontWeight: 500 }}
          tickLine={false}
        />
        <PolarRadiusAxis
          angle={90}
          domain={[0, 100]}
          tick={{ fill: "#64748B", fontSize: 9 }}
          tickCount={5}
          axisLine={false}
        />
        {series.map((s) => (
          <Radar
            key={s.label}
            name={s.label}
            dataKey={s.label}
            stroke={s.color}
            fill={s.color}
            fillOpacity={s.opacity ?? 0.15}
            strokeWidth={2}
            strokeDasharray={s.strokeDash}
            dot={false}
          />
        ))}
        <Tooltip
          contentStyle={{
            backgroundColor: "rgba(15, 23, 41, 0.95)",
            border: "1px solid rgba(37, 99, 235, 0.25)",
            borderRadius: "6px",
            fontSize: "12px",
            color: "#c9d6e8",
          }}
          itemStyle={{ color: "#c9d6e8" }}
        />
        <Legend
          wrapperStyle={{ fontSize: "12px", color: "#94A3B8", paddingTop: "8px" }}
        />
      </RadarChart>
    </ResponsiveContainer>
  );
}

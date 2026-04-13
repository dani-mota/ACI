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
          stroke="var(--border)"
          gridType="polygon"
        />
        <PolarAngleAxis
          dataKey="construct"
          tick={{ fill: "var(--foreground)", fontSize: 11, fontWeight: 500 }}
          tickLine={false}
        />
        <PolarRadiusAxis
          angle={90}
          domain={[0, 100]}
          tick={{ fill: "var(--muted-foreground)", fontSize: 9 }}
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
            backgroundColor: "var(--popover)",
            border: "1px solid var(--border)",
            borderRadius: "6px",
            fontSize: "12px",
            color: "var(--popover-foreground)",
          }}
          itemStyle={{ color: "var(--popover-foreground)" }}
        />
        <Legend
          wrapperStyle={{ fontSize: "12px", color: "var(--muted-foreground)", paddingTop: "8px" }}
        />
      </RadarChart>
    </ResponsiveContainer>
  );
}

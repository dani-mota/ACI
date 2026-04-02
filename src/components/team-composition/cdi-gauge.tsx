"use client";

interface CDIGaugeProps {
  value: number; // 0-1
  interpretation: "low" | "moderate" | "high";
}

export function CDIGauge({ value, interpretation }: CDIGaugeProps) {
  const percentage = Math.round(value * 100);

  const interpretationConfig = {
    low: {
      color: "text-amber-400",
      bg: "from-amber-500/20 to-amber-600/5",
      border: "border-amber-500/30",
      arcColor: "#F59E0B",
      label: "Low Diversity",
      description:
        "Team members think similarly. Fast consensus and coordination, but higher risk of blind spots and groupthink. Consider adding cognitively diverse members.",
    },
    moderate: {
      color: "text-emerald-400",
      bg: "from-emerald-500/20 to-emerald-600/5",
      border: "border-emerald-500/30",
      arcColor: "#059669",
      label: "Moderate Diversity",
      description:
        "Healthy balance of shared cognitive baseline and complementary strengths. Team can reach consensus while benefiting from diverse perspectives.",
    },
    high: {
      color: "text-blue-400",
      bg: "from-blue-500/20 to-blue-600/5",
      border: "border-blue-500/30",
      arcColor: "#2563EB",
      label: "High Diversity",
      description:
        "Very different cognitive profiles across team members. Rich perspectives and creative problem-solving, but may require more coordination overhead and structured communication.",
    },
  };

  const config = interpretationConfig[interpretation];

  // SVG arc for gauge
  const radius = 60;
  const cx = 75;
  const cy = 70;
  const startAngle = -135;
  const endAngle = -45;
  const totalAngle = endAngle - startAngle;

  function polarToCartesian(angle: number) {
    const rad = (angle * Math.PI) / 180;
    return { x: cx + radius * Math.cos(rad), y: cy + radius * Math.sin(rad) };
  }

  const bgStart = polarToCartesian(startAngle);
  const bgEnd = polarToCartesian(endAngle);
  const valueAngle = startAngle + totalAngle * value;
  const valEnd = polarToCartesian(valueAngle);

  const bgArc = `M ${bgStart.x} ${bgStart.y} A ${radius} ${radius} 0 1 1 ${bgEnd.x} ${bgEnd.y}`;
  const valueArc =
    value > 0
      ? `M ${bgStart.x} ${bgStart.y} A ${radius} ${radius} 0 ${value > 0.5 ? 1 : 0} 1 ${valEnd.x} ${valEnd.y}`
      : "";

  return (
    <div className={`rounded-lg border ${config.border} bg-gradient-to-b ${config.bg} p-5`}>
      <div className="flex items-start gap-5">
        <div className="shrink-0">
          <svg width="150" height="100" viewBox="0 0 150 100">
            {/* Background arc */}
            <path
              d={bgArc}
              fill="none"
              stroke="rgba(148, 163, 184, 0.15)"
              strokeWidth="12"
              strokeLinecap="round"
            />
            {/* Value arc */}
            {value > 0 && (
              <path
                d={valueArc}
                fill="none"
                stroke={config.arcColor}
                strokeWidth="12"
                strokeLinecap="round"
                filter="url(#glow)"
              />
            )}
            {/* Glow filter */}
            <defs>
              <filter id="glow">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
            {/* Center text */}
            <text
              x={cx}
              y={cy - 5}
              textAnchor="middle"
              className={`text-2xl font-bold ${config.color}`}
              fill="currentColor"
              style={{ fontSize: "28px", fontWeight: 700 }}
            >
              {percentage}
            </text>
            <text
              x={cx}
              y={cy + 14}
              textAnchor="middle"
              fill="#94A3B8"
              style={{ fontSize: "10px" }}
            >
              CDI Score
            </text>
          </svg>
        </div>

        <div className="flex-1 pt-1">
          <div className={`text-sm font-semibold ${config.color} mb-1`}>
            {config.label}
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            {config.description}
          </p>
        </div>
      </div>
    </div>
  );
}

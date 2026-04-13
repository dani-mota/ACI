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

  // SVG arc for gauge — 270° sweep from lower-left to lower-right through the top
  const radius = 42;
  const cx = 75;
  const cy = 60;
  const startAngle = 135; // lower-left in SVG coords (y-down)
  const totalSweep = 270; // degrees counterclockwise

  function polarToCartesian(angleDeg: number) {
    const rad = (angleDeg * Math.PI) / 180;
    return { x: cx + radius * Math.cos(rad), y: cy + radius * Math.sin(rad) };
  }

  const start = polarToCartesian(startAngle);
  const end = polarToCartesian(startAngle + totalSweep); // 405° = 45° (lower-right)
  const valueAngle = startAngle + totalSweep * value;
  const valEnd = polarToCartesian(valueAngle);

  // sweep=0 = counterclockwise (goes upward through top)
  const bgArc = `M ${start.x} ${start.y} A ${radius} ${radius} 0 1 0 ${end.x} ${end.y}`;
  const valueArc =
    value > 0
      ? `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${value > 0.5 ? 1 : 0} 0 ${valEnd.x} ${valEnd.y}`
      : "";

  return (
    <div className={`rounded-lg border ${config.border} bg-gradient-to-b ${config.bg} p-5`}>
      <div className="flex items-start gap-5">
        <div className="shrink-0">
          <svg width="150" height="105" viewBox="0 0 150 105">
            {/* Background arc */}
            <path
              d={bgArc}
              fill="none"
              stroke="var(--border)"
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
              y={cy + 5}
              textAnchor="middle"
              className={`text-2xl font-bold ${config.color}`}
              fill="currentColor"
              style={{ fontSize: "28px", fontWeight: 700 }}
            >
              {percentage}
            </text>
            <text
              x={cx}
              y={cy + 22}
              textAnchor="middle"
              fill="var(--muted-foreground)"
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
          <p className="text-xs text-muted-foreground leading-relaxed">
            {config.description}
          </p>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { Clock, Eye, TrendingUp, AlertTriangle, ChevronDown } from "lucide-react";

const METHODOLOGY: Record<string, { constructs: string; explanation: string }> = {
  "Ramp Time": {
    constructs: "Learning Velocity + Technical Aptitude average",
    explanation:
      "Higher scores in both predict faster time to productivity.",
  },
  Supervision: {
    constructs: "Executive Control + Procedural Reliability",
    explanation:
      "Candidates with strong self-management and process adherence typically require less oversight.",
  },
  "Performance Ceiling": {
    constructs: "Fluid Reasoning + Systems Diagnostics + Learning Velocity",
    explanation:
      "These constructs predict long-term growth potential beyond initial role requirements.",
  },
  "Attrition Risk": {
    constructs: "Behavioral Integrity average + Learning Velocity",
    explanation:
      "Strong behavioral alignment and engagement in learning correlate with longer tenure.",
  },
};

interface PredictionsGridProps {
  prediction: any;
}

function PredictionCard({
  icon: Icon,
  label,
  value,
  detail,
  color,
  factors,
}: {
  icon: typeof Clock;
  label: string;
  value: string;
  detail: string | undefined;
  color: string;
  factors: any;
}) {
  const [expanded, setExpanded] = useState(false);
  const methodology = METHODOLOGY[label];
  const factorDescription =
    factors && typeof factors === "object" ? factors.description : null;

  return (
    <div className="border border-border p-3">
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-3.5 h-3.5" style={{ color }} />
        <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
          {label}
        </span>
      </div>
      <p className="text-sm font-bold font-mono" style={{ color }}>
        {value}
      </p>
      {detail && (
        <p className="text-[10px] text-muted-foreground mt-1 line-clamp-2 font-mono">
          {detail}
        </p>
      )}

      {/* Expandable methodology */}
      {methodology && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 mt-2 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronDown
            className="w-3 h-3 transition-transform"
            style={{ transform: expanded ? "rotate(180deg)" : "rotate(0)" }}
          />
          How is this calculated?
        </button>
      )}
      {expanded && methodology && (
        <div className="mt-2 p-2 bg-muted/50 rounded text-[10px] text-muted-foreground space-y-1">
          <p>
            <span className="font-medium text-foreground/70">Based on:</span>{" "}
            {methodology.constructs}
          </p>
          <p>{methodology.explanation}</p>
          {factorDescription && (
            <p className="italic opacity-80">{factorDescription}</p>
          )}
        </div>
      )}
    </div>
  );
}

export function PredictionsGrid({ prediction }: PredictionsGridProps) {
  if (!prediction) return null;

  const cards = [
    {
      icon: Clock,
      label: "Ramp Time",
      value: prediction.rampTimeLabel,
      detail: `${prediction.rampTimeMonths} months`,
      color:
        prediction.rampTimeMonths <= 1
          ? "#059669"
          : prediction.rampTimeMonths <= 2
          ? "#D97706"
          : "#DC2626",
      factors: prediction.rampTimeFactors,
    },
    {
      icon: Eye,
      label: "Supervision",
      value: prediction.supervisionLoad,
      detail: `Score: ${prediction.supervisionScore}`,
      color:
        prediction.supervisionLoad === "LOW"
          ? "#059669"
          : prediction.supervisionLoad === "MEDIUM"
          ? "#D97706"
          : "#DC2626",
      factors: prediction.supervisionFactors,
    },
    {
      icon: TrendingUp,
      label: "Performance Ceiling",
      value: prediction.performanceCeiling,
      detail: (prediction.ceilingCareerPath as string[])?.join(" → "),
      color:
        prediction.performanceCeiling === "HIGH"
          ? "#059669"
          : prediction.performanceCeiling === "MEDIUM"
          ? "#D97706"
          : "#DC2626",
      factors: prediction.ceilingFactors,
    },
    {
      icon: AlertTriangle,
      label: "Attrition Risk",
      value: prediction.attritionRisk,
      detail: (prediction.attritionStrategies as string[])
        ?.slice(0, 2)
        .join(", "),
      color:
        prediction.attritionRisk === "LOW"
          ? "#059669"
          : prediction.attritionRisk === "MEDIUM"
          ? "#D97706"
          : "#DC2626",
      factors: prediction.attritionFactors,
    },
  ];

  return (
    <div className="bg-card border border-border p-5">
      <h2
        className="text-xs font-semibold text-foreground mb-4 uppercase tracking-wider"
        style={{ fontFamily: "var(--font-dm-sans)" }}
      >
        Predictions
      </h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {cards.map((card) => (
          <PredictionCard key={card.label} {...card} />
        ))}
      </div>

      <p className="text-[9px] text-muted-foreground/60 mt-3 italic">
        Pre-validation estimates based on construct relationships. These
        predictions will be calibrated against actual outcomes after pilot
        deployment.
      </p>
    </div>
  );
}

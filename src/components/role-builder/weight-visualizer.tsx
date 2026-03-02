"use client";

import { useState, useCallback } from "react";
import { Lock, Unlock, RotateCcw } from "lucide-react";
import { CONSTRUCTS, LAYER_INFO, type LayerType } from "@/lib/constructs";
import { Button } from "@/components/ui/button";

const LAYER_ORDER: LayerType[] = ["COGNITIVE_CORE", "TECHNICAL_APTITUDE", "BEHAVIORAL_INTEGRITY"];
const CONSTRUCTS_BY_LAYER: Record<LayerType, string[]> = {
  COGNITIVE_CORE: ["FLUID_REASONING", "EXECUTIVE_CONTROL", "COGNITIVE_FLEXIBILITY", "METACOGNITIVE_CALIBRATION", "LEARNING_VELOCITY"],
  TECHNICAL_APTITUDE: ["SYSTEMS_DIAGNOSTICS", "PATTERN_RECOGNITION", "QUANTITATIVE_REASONING", "SPATIAL_VISUALIZATION", "MECHANICAL_REASONING"],
  BEHAVIORAL_INTEGRITY: ["PROCEDURAL_RELIABILITY", "ETHICAL_JUDGMENT"],
};

export interface WeightVisualizerProps {
  weights: Record<string, number>; // constructId → 0–100
  recommendations: Record<string, number>; // ACI-generated baseline
  onChange: (weights: Record<string, number>) => void;
}

export function WeightVisualizer({ weights, recommendations, onChange }: WeightVisualizerProps) {
  const [locked, setLocked] = useState<Set<string>>(new Set());

  const total = Object.values(weights).reduce((s, v) => s + v, 0);
  const isValid = Math.abs(total - 100) <= 1;

  const handleChange = useCallback(
    (constructId: string, newValue: number) => {
      const lockedSet = locked;
      const lockedTotal = Array.from(lockedSet).reduce((s, id) => s + (weights[id] ?? 0), 0);
      const unlockedIds = Object.keys(weights).filter((id) => id !== constructId && !lockedSet.has(id));
      const unlockedSum = unlockedIds.reduce((s, id) => s + (weights[id] ?? 0), 0);
      const budget = 100 - lockedTotal - newValue;

      const next: Record<string, number> = { ...weights, [constructId]: newValue };

      if (unlockedIds.length === 0) {
        // All others are locked — can't rebalance
        onChange(next);
        return;
      }

      if (unlockedSum <= 0) {
        // Distribute evenly
        const each = Math.max(2, Math.floor(budget / unlockedIds.length));
        for (const id of unlockedIds) next[id] = each;
      } else {
        // Proportional rebalance
        for (const id of unlockedIds) {
          const proportion = weights[id] / unlockedSum;
          next[id] = Math.max(2, Math.round(proportion * budget));
        }
        // Fix rounding drift: adjust the first unlocked construct
        const drift =
          100 - Object.values(next).reduce((s, v) => s + v, 0);
        if (drift !== 0 && unlockedIds[0]) next[unlockedIds[0]] = Math.max(2, next[unlockedIds[0]] + drift);
      }

      onChange(next);
    },
    [locked, weights, onChange]
  );

  const toggleLock = useCallback((constructId: string) => {
    setLocked((prev) => {
      const next = new Set(prev);
      if (next.has(constructId)) next.delete(constructId);
      else next.add(constructId);
      return next;
    });
  }, []);

  const resetToRecommendations = useCallback(() => {
    setLocked(new Set());
    onChange({ ...recommendations });
  }, [recommendations, onChange]);

  const allLocked = locked.size >= Object.keys(weights).length - 1;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Construct Weights</span>
          <span
            className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${
              isValid ? "bg-aci-green/10 text-aci-green" : "bg-aci-red/10 text-aci-red"
            }`}
          >
            {total}% total
          </span>
        </div>
        <Button
          variant="ghost"
          size="xs"
          onClick={resetToRecommendations}
          className="text-muted-foreground hover:text-aci-gold gap-1"
        >
          <RotateCcw className="w-3 h-3" />
          Reset to ACI recommendation
        </Button>
      </div>

      {allLocked && (
        <div className="bg-amber-50 border border-amber-200 text-amber-700 text-xs px-3 py-2 rounded mb-3">
          Unlock at least one construct to rebalance weights.
        </div>
      )}

      {LAYER_ORDER.map((layer) => {
        const layerInfo = LAYER_INFO[layer];
        const constructIds = CONSTRUCTS_BY_LAYER[layer];

        return (
          <div key={layer} className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: layerInfo.color }} />
              <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: layerInfo.color }}>
                {layerInfo.name}
              </span>
            </div>

            <div className="space-y-2">
              {constructIds.map((constructId) => {
                const meta = CONSTRUCTS[constructId];
                if (!meta) return null;
                const value = weights[constructId] ?? 0;
                const rec = recommendations[constructId] ?? 0;
                const isLocked = locked.has(constructId);
                const diff = value - rec;

                return (
                  <div key={constructId} className="grid grid-cols-[140px_1fr_44px_24px] items-center gap-2">
                    {/* Label */}
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] text-foreground">{meta.name}</span>
                      {diff !== 0 && (
                        <span
                          className={`text-[9px] font-mono ${diff > 0 ? "text-aci-green" : "text-aci-red"}`}
                        >
                          {diff > 0 ? `+${diff}` : diff}
                        </span>
                      )}
                    </div>

                    {/* Slider + ACI marker */}
                    <div className="relative flex items-center">
                      {/* ACI recommendation diamond */}
                      {rec > 0 && (
                        <div
                          className="absolute -top-2 text-aci-gold text-[8px] -translate-x-1/2 pointer-events-none select-none"
                          style={{ left: `${rec}%` }}
                          title={`ACI recommendation: ${rec}%`}
                        >
                          ◆
                        </div>
                      )}
                      <input
                        type="range"
                        min={2}
                        max={25}
                        step={1}
                        value={value}
                        disabled={isLocked}
                        onChange={(e) => handleChange(constructId, Number(e.target.value))}
                        className="w-full h-1.5 rounded-full appearance-none bg-muted disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                        style={{
                          background: isLocked
                            ? undefined
                            : `linear-gradient(to right, ${layerInfo.color} 0%, ${layerInfo.color} ${((value - 2) / 23) * 100}%, var(--muted) ${((value - 2) / 23) * 100}%, var(--muted) 100%)`,
                        }}
                      />
                    </div>

                    {/* Value */}
                    <span className="text-[11px] font-mono text-right font-semibold" style={{ color: isLocked ? "var(--muted-foreground)" : layerInfo.color }}>
                      {value}%
                    </span>

                    {/* Lock */}
                    <button
                      onClick={() => toggleLock(constructId)}
                      className="flex items-center justify-center w-5 h-5 rounded text-muted-foreground hover:text-foreground transition-colors"
                      title={isLocked ? "Unlock weight" : "Lock weight"}
                    >
                      {isLocked ? <Lock className="w-3 h-3 text-aci-gold" /> : <Unlock className="w-3 h-3" />}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

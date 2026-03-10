"use client";

import React, { useState, useMemo, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, ChevronUp, ChevronDown, Download, Image, Plus } from "lucide-react";
import { useBasePath } from "@/components/base-path-provider";
import { useContext } from "react";
import { AuthContext } from "@/components/auth-provider";
import { CONSTRUCTS, LAYER_INFO, type LayerType } from "@/lib/constructs";
import { getScoreTier } from "@/lib/format";
import { downloadCSV, captureElementAsPNG } from "@/lib/export";

interface HeatmapClientProps {
  candidates: any[];
  roles: any[];
  weights: any[];
  cutlines: any[];
}

const CONSTRUCT_ORDER = Object.keys(CONSTRUCTS);

type SortKey = "composite" | string; // "composite" or a construct key

const CONSTRUCT_COPY: Record<string, string> = {
  FLUID_REASONING: "Measures how quickly someone solves problems they have never encountered before.",
  EXECUTIVE_CONTROL: "Measures the ability to stay focused and manage competing priorities under pressure.",
  COGNITIVE_FLEXIBILITY: "Measures how easily someone shifts strategies when the current approach is not working.",
  METACOGNITIVE_CALIBRATION: "Measures whether someone accurately knows what they know and what they don't.",
  LEARNING_VELOCITY: "Measures how fast someone picks up new skills and becomes productive independently.",
  SYSTEMS_DIAGNOSTICS: "Measures the ability to understand complex systems and isolate root causes of failures.",
  PATTERN_RECOGNITION: "Measures the ability to spot meaningful trends and anomalies before they become problems.",
  QUANTITATIVE_REASONING: "Measures precision with numbers, tolerances, and mathematical relationships.",
  SPATIAL_VISUALIZATION: "Measures the ability to mentally rotate 3D objects and read complex technical drawings.",
  MECHANICAL_REASONING: "Measures intuition for how physical systems, forces, and mechanisms behave.",
  PROCEDURAL_RELIABILITY: "Measures consistency in following established procedures, especially when shortcuts are tempting.",
  ETHICAL_JUDGMENT: "Measures whether someone reports problems honestly and makes the right call under pressure.",
};

export function HeatmapClient({ candidates, roles, weights, cutlines }: HeatmapClientProps) {
  const router = useRouter();
  const basePath = useBasePath();
  const auth = useContext(AuthContext);
  const canCreateRole = auth ? ["TA_LEADER", "ADMIN"].includes(auth.user.role) : false;
  const tableRef = useRef<HTMLDivElement>(null);
  const [selectedRoleSlug, setSelectedRoleSlug] = useState(roles[0]?.slug || "");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sortKey, setSortKey] = useState<SortKey>("composite");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [hoveredCell, setHoveredCell] = useState<{ key: string; val: number; x: number; y: number } | null>(null);
  const [hoveredHeader, setHoveredHeader] = useState<{ key: string; x: number; y: number } | null>(null);
  const [hoveredCutline, setHoveredCutline] = useState<{ x: number; y: number } | null>(null);

  const selectedRole = roles.find((r: any) => r.slug === selectedRoleSlug);
  const roleWeights = weights.filter((w: any) => w.roleId === selectedRole?.id);
  const roleCutline = cutlines.find((c: any) => c.roleId === selectedRole?.id);

  const highWeightConstructs = useMemo(() => {
    const sorted = [...roleWeights].sort((a: any, b: any) => b.weight - a.weight);
    return new Set(sorted.slice(0, 3).map((w: any) => w.constructId));
  }, [roleWeights]);

  const weightMap = useMemo(() => {
    const map: Record<string, number> = {};
    for (const w of roleWeights) map[w.constructId] = w.weight;
    return map;
  }, [roleWeights]);

  const topWeightedConstructs = useMemo(() => {
    return [...roleWeights]
      .sort((a: any, b: any) => b.weight - a.weight)
      .slice(0, 4)
      .map((w: any) => ({
        name: CONSTRUCTS[w.constructId as keyof typeof CONSTRUCTS]?.name ?? w.constructId,
        weight: Math.round(w.weight * 100),
      }));
  }, [roleWeights]);

  const rows = useMemo(() => {
    const base = candidates
      .filter((c: any) => c.assessment?.subtestResults?.length > 0)
      .map((c: any) => {
        const composite = c.assessment?.compositeScores?.find(
          (cs: any) => cs.roleSlug === selectedRoleSlug
        );
        const scores: Record<string, number> = {};
        for (const r of c.assessment?.subtestResults || []) {
          scores[r.construct] = r.percentile;
        }
        return {
          id: c.id,
          name: `${c.firstName} ${c.lastName}`,
          firstName: c.firstName,
          lastName: c.lastName,
          composite: composite?.percentile ?? 0,
          passed: composite?.passed ?? false,
          scores,
        };
      });

    // Sort
    base.sort((a, b) => {
      let aVal: number, bVal: number;
      if (sortKey === "composite") {
        aVal = a.composite;
        bVal = b.composite;
      } else {
        aVal = a.scores[sortKey] ?? 0;
        bVal = b.scores[sortKey] ?? 0;
      }
      return sortDir === "desc" ? bVal - aVal : aVal - bVal;
    });

    return base;
  }, [candidates, selectedRoleSlug, sortKey, sortDir]);

  const handleRoleChange = (slug: string) => {
    setSelectedRoleSlug(slug);
    setSortKey("composite");
    setSortDir("desc");
  };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === "desc" ? "asc" : "desc");
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else if (next.size < 3) next.add(id);
    setSelectedIds(next);
  };

  const handleCompare = () => {
    if (selectedIds.size >= 2) {
      router.push(`${basePath}/compare?ids=${Array.from(selectedIds).join(",")}`);
    }
  };

  const handleExportCSV = () => {
    const headers = ["Candidate", "Composite", ...CONSTRUCT_ORDER.map((k) => CONSTRUCTS[k as keyof typeof CONSTRUCTS].abbreviation)];
    const csvRows = rows.map((row) => [
      row.name,
      String(row.composite),
      ...CONSTRUCT_ORDER.map((k) => String(row.scores[k] ?? 0)),
    ]);
    downloadCSV(`aci-heatmap-${selectedRoleSlug}.csv`, headers, csvRows);
  };

  const handleExportPNG = async () => {
    if (tableRef.current) {
      await captureElementAsPNG(tableRef.current, `aci-heatmap-${selectedRoleSlug}.png`);
    }
  };

  const getCellColor = (percentile: number) => {
    const tier = getScoreTier(percentile);
    return tier.color;
  };

  const getCellBg = (percentile: number) => {
    if (percentile >= 90) return "rgba(6, 95, 70, 0.15)";
    if (percentile >= 75) return "rgba(5, 150, 105, 0.12)";
    if (percentile >= 50) return "rgba(148, 163, 184, 0.1)";
    if (percentile >= 25) return "rgba(245, 158, 11, 0.12)";
    return "rgba(220, 38, 38, 0.12)";
  };

  // eslint-disable-next-line react-hooks/static-components
  const SortIndicator = useCallback(({ active, dir }: { active: boolean; dir: "asc" | "desc" }) => {
    if (!active) return null;
    return dir === "desc"
      ? <ChevronDown className="w-2.5 h-2.5 inline-block ml-0.5" />
      : <ChevronUp className="w-2.5 h-2.5 inline-block ml-0.5" />;
  }, []);

  const cutlineIndex = rows.findIndex((r) => !r.passed);

  return (
    <div className="p-6">
      <style>{`@keyframes heatmapFadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }`}</style>

      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-foreground" style={{ fontFamily: "var(--font-dm-sans)" }}>
            Role Matrix
          </h1>
          <p className="text-[10px] text-muted-foreground mt-0.5 uppercase tracking-wider">
            Candidate scores by construct for each role
          </p>
        </div>

        <div className="flex items-center gap-2">
          {canCreateRole && (
            <Link
              href={`${basePath}/roles/new`}
              className="flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-aci-blue border border-slate-200 rounded-lg hover:bg-accent transition-colors"
            >
              <Plus className="w-3 h-3" />
              New Role
            </Link>
          )}
          {selectedIds.size >= 2 && (
            <button
              onClick={handleCompare}
              className="px-3 py-1.5 bg-aci-gold text-aci-navy text-[10px] font-semibold uppercase tracking-wider hover:bg-aci-gold/90 transition-colors"
            >
              Compare ({selectedIds.size})
            </button>
          )}
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground border border-border hover:bg-accent transition-colors"
          >
            <Download className="w-3 h-3" />
            CSV
          </button>
          <button
            onClick={handleExportPNG}
            className="flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground border border-border hover:bg-accent transition-colors"
          >
            <Image className="w-3 h-3" />
            PNG
          </button>
          <select
            value={selectedRoleSlug}
            onChange={(e) => handleRoleChange(e.target.value)}
            className="h-7 border border-border px-2 text-[10px] bg-card text-foreground font-mono"
          >
            {roles.map((r: any) => (
              <option key={r.slug} value={r.slug}>{r.name}</option>
            ))}
          </select>
          <Link
            href={`${basePath}/roles/${selectedRoleSlug}`}
            className="flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-medium uppercase tracking-wider text-aci-gold border border-aci-gold/30 hover:bg-aci-gold/10 transition-colors"
          >
            Role Profile
            <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      </div>

      {/* Heatmap */}
      <div ref={tableRef} className="bg-card border border-border overflow-x-auto relative" data-tutorial="heatmap-table">
        <table className="w-full text-[9px] border-collapse table-fixed">
          <thead>
            <tr className="border-b border-border">
              <th className="sticky left-0 bg-card z-10 py-1.5 px-1.5 text-left font-medium text-muted-foreground w-7" />
              <th className="sticky left-7 bg-card z-10 py-1.5 px-1.5 text-left font-medium text-muted-foreground uppercase tracking-wider w-[45%]">
                Candidate
              </th>
              <th
                className="py-1.5 px-0 text-center font-semibold text-foreground uppercase tracking-wider cursor-pointer hover:bg-accent/30 select-none"
                onClick={() => handleSort("composite")}
              >
                CI
                {/* eslint-disable-next-line react-hooks/static-components */}
                <SortIndicator active={sortKey === "composite"} dir={sortDir} />
              </th>
              {CONSTRUCT_ORDER.map((key) => {
                const meta = CONSTRUCTS[key as keyof typeof CONSTRUCTS];
                const layerInfo = LAYER_INFO[meta.layer as LayerType];
                const isHighWeight = highWeightConstructs.has(key);

                return (
                  <th
                    key={key}
                    className={`py-1.5 px-0 text-center font-medium cursor-pointer hover:bg-accent/30 select-none ${isHighWeight ? "border-l-2 border-l-aci-gold" : ""}`}
                    style={{ borderTop: `2px solid ${layerInfo.color}` }}
                    onClick={() => handleSort(key)}
                    onMouseEnter={(e) => {
                      setHoveredHeader({ key, x: e.clientX, y: e.clientY });
                    }}
                    onMouseLeave={() => setHoveredHeader(null)}
                  >
                    <span className="font-mono" style={{ color: layerInfo.color }}>{meta.abbreviation}</span>
                    <SortIndicator active={sortKey === key} dir={sortDir} />
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const showCutlineBefore = cutlineIndex === i && cutlineIndex > 0;
              return (
                <React.Fragment key={row.id}>
                  {showCutlineBefore && (
                    <tr
                      onMouseEnter={(e) => setHoveredCutline({ x: e.clientX, y: e.clientY })}
                      onMouseMove={(e) => setHoveredCutline({ x: e.clientX, y: e.clientY })}
                      onMouseLeave={() => setHoveredCutline(null)}
                      className="cursor-help"
                    >
                      <td
                        colSpan={3 + CONSTRUCT_ORDER.length}
                        className="py-0 px-0 h-[18px] relative"
                        style={{ borderBottom: "none" }}
                      >
                        <div className="absolute inset-x-0 top-1/2 border-t-2 border-dashed border-aci-red/60" />
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 bg-card px-1.5 text-[8px] font-semibold uppercase tracking-wider text-aci-red/80">
                          Minimum threshold
                        </span>
                      </td>
                    </tr>
                  )}
                  <tr
                    className="hover:bg-accent/30 transition-colors"
                    style={{ borderBottom: "1px solid var(--border)" }}
                  >
                    <td className="sticky left-0 bg-card py-0 px-1.5">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(row.id)}
                        onChange={() => toggleSelect(row.id)}
                        className="border-border w-3 h-3"
                      />
                    </td>
                    <td className="sticky left-7 bg-card py-0 px-1.5 max-w-0 overflow-hidden">
                      <Link
                        href={`${basePath}/candidates/${row.id}`}
                        className="text-[10px] font-medium text-foreground hover:text-aci-gold transition-colors truncate block"
                      >
                        {row.name}
                      </Link>
                    </td>
                    <td className="py-0 px-0 text-center">
                      <span
                        className="inline-flex items-center justify-center w-full h-[22px] text-[9px] font-bold font-mono"
                        style={{
                          backgroundColor: getCellBg(row.composite),
                          color: getCellColor(row.composite),
                        }}
                      >
                        {row.composite}
                      </span>
                    </td>
                    {CONSTRUCT_ORDER.map((key, colIdx) => {
                      const val = row.scores[key] ?? 0;
                      const isHighWeight = highWeightConstructs.has(key);
                      return (
                        <td
                          key={key}
                          className={`py-0 px-0 text-center ${isHighWeight ? "border-l-2 border-l-aci-gold/30" : ""}`}
                          {...(i === 0 && colIdx === 0 ? { "data-tutorial": "heatmap-cell" } : {})}
                          onMouseEnter={(e) => {
                            setHoveredCell({ key, val, x: e.clientX, y: e.clientY });
                          }}
                          onMouseLeave={() => setHoveredCell(null)}
                        >
                          <span
                            className="inline-flex items-center justify-center w-full h-[22px] text-[9px] font-medium font-mono"
                            style={{
                              backgroundColor: getCellBg(val),
                              color: getCellColor(val),
                            }}
                          >
                            {val}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                </React.Fragment>
              );
            })}
          </tbody>
        </table>

        {/* Cell tooltip */}
        {hoveredCell && (() => {
          const meta = CONSTRUCTS[hoveredCell.key as keyof typeof CONSTRUCTS];
          const layerInfo = LAYER_INFO[meta.layer as LayerType];
          const tier = getScoreTier(hoveredCell.val);
          const weight = weightMap[hoveredCell.key];
          return (
            <div
              className="fixed z-50 bg-card/95 backdrop-blur-sm p-3 shadow-xl border border-border max-w-[220px]"
              style={{
                left: hoveredCell.x + 12,
                top: hoveredCell.y - 8,
                pointerEvents: "none",
              }}
            >
              <div className="flex items-center gap-1.5 mb-1">
                <div className="w-2 h-2" style={{ backgroundColor: layerInfo.color }} />
                <span className="text-[10px] font-semibold text-foreground uppercase tracking-wider">{meta.name}</span>
              </div>
              <p className="text-sm font-bold font-mono mb-1" style={{ color: tier.color }}>
                {hoveredCell.val}<span className="text-[9px] font-normal text-muted-foreground ml-0.5">th / {tier.label}</span>
              </p>
              <p className="text-[9px] text-muted-foreground font-mono">
                Layer: {layerInfo.name}
              </p>
              {weight !== undefined && (
                <p className="text-[9px] text-muted-foreground font-mono">
                  Role weight: {Math.round(weight * 100)}%
                </p>
              )}
            </div>
          );
        })()}

        {/* Header tooltip */}
        {hoveredHeader && (() => {
          const meta = CONSTRUCTS[hoveredHeader.key as keyof typeof CONSTRUCTS];
          const layerInfo = LAYER_INFO[meta.layer as LayerType];
          const copy = CONSTRUCT_COPY[hoveredHeader.key];
          return (
            <div
              className="fixed z-50 bg-card/95 backdrop-blur-sm p-3 shadow-xl border border-border max-w-[260px]"
              style={{
                left: hoveredHeader.x + 12,
                top: hoveredHeader.y + 16,
                pointerEvents: "none",
                animation: "heatmapFadeIn 120ms ease-out",
              }}
            >
              <div className="flex items-center gap-1.5 mb-1.5">
                <div className="w-2 h-2" style={{ backgroundColor: layerInfo.color }} />
                <span className="text-[10px] font-semibold text-foreground uppercase tracking-wider">{meta.name}</span>
              </div>
              {copy && (
                <p className="text-[10px] text-muted-foreground leading-relaxed">{copy}</p>
              )}
            </div>
          );
        })()}

        {/* Cutline tooltip */}
        {hoveredCutline && roleCutline && (
          <div
            className="fixed z-50 bg-card/95 backdrop-blur-sm p-4 shadow-xl border border-border max-w-[300px]"
            style={{
              left: hoveredCutline.x + 12,
              top: hoveredCutline.y - 12,
              pointerEvents: "none",
              animation: "heatmapFadeIn 120ms ease-out",
            }}
          >
            <p className="text-[10px] font-semibold text-aci-red/90 uppercase tracking-wider mb-2">
              {selectedRole?.name} Threshold
            </p>
            <p className="text-[10px] text-muted-foreground leading-relaxed mb-3">
              Candidates below this line did not meet the minimum requirements for this role. The threshold is based on three layer-level gates:
            </p>
            <div className="space-y-1.5 mb-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-medium" style={{ color: LAYER_INFO.TECHNICAL_APTITUDE.color }}>Technical Aptitude</span>
                <span className="text-[10px] font-bold font-mono" style={{ color: LAYER_INFO.TECHNICAL_APTITUDE.color }}>{roleCutline.technicalAptitude}th</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-medium" style={{ color: LAYER_INFO.BEHAVIORAL_INTEGRITY.color }}>Behavioral Integrity</span>
                <span className="text-[10px] font-bold font-mono" style={{ color: LAYER_INFO.BEHAVIORAL_INTEGRITY.color }}>{roleCutline.behavioralIntegrity}th</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-medium" style={{ color: LAYER_INFO.COGNITIVE_CORE.color }}>Cognitive Core</span>
                <span className="text-[10px] font-bold font-mono" style={{ color: LAYER_INFO.COGNITIVE_CORE.color }}>{roleCutline.learningVelocity}th</span>
              </div>
              {roleCutline.overallMinimum && (
                <div className="flex items-center justify-between pt-1 border-t border-border">
                  <span className="text-[10px] font-medium text-muted-foreground">Overall Minimum</span>
                  <span className="text-[10px] font-bold font-mono text-foreground">{roleCutline.overallMinimum}th</span>
                </div>
              )}
            </div>
            {topWeightedConstructs.length > 0 && (
              <>
                <p className="text-[9px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
                  Most weighted constructs
                </p>
                <div className="space-y-1">
                  {topWeightedConstructs.map((c) => (
                    <div key={c.name} className="flex items-center justify-between">
                      <span className="text-[10px] text-foreground">{c.name}</span>
                      <span className="text-[10px] font-mono text-muted-foreground">{c.weight}%</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-between mt-2 text-[9px] text-muted-foreground">
        <div className="flex items-center gap-2">
          <span className="font-medium uppercase tracking-wider">Tiers:</span>
          {[
            { label: "90+", color: "#065F46", bg: "rgba(6,95,70,0.15)" },
            { label: "75-89", color: "#059669", bg: "rgba(5,150,105,0.12)" },
            { label: "50-74", color: "#94A3B8", bg: "rgba(148,163,184,0.1)" },
            { label: "25-49", color: "#F59E0B", bg: "rgba(245,158,11,0.12)" },
            { label: "<25", color: "#DC2626", bg: "rgba(220,38,38,0.12)" },
          ].map((t) => (
            <div key={t.label} className="flex items-center gap-0.5">
              <span className="w-4 h-4 flex items-center justify-center text-[8px] font-bold font-mono" style={{ backgroundColor: t.bg, color: t.color }}>
                {t.label.split("-")[0]}
              </span>
              <span className="font-mono">{t.label}</span>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <div className="w-4 h-0.5 border-t-2 border-dashed border-aci-red/60" />
          <span className="uppercase tracking-wider text-aci-red/80">Minimum Threshold</span>
        </div>
      </div>
    </div>
  );
}

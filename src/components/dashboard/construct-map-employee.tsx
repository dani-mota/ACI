"use client";

/**
 * PRO-131: Employee Construct Map (Layer 2 of the Employee Dossier).
 *
 * Radar chart of all 12 construct scores with an optional second overlay
 * showing the role's cognitive demand profile. Color-coded gap dots at
 * each polygon vertex tell the developmental story:
 *   - green dot  → over-spec (employee score exceeds demand by 10+ points)
 *   - amber dot  → growth edge (demand exceeds employee score by 10+ points)
 *   - neutral    → within ±10 points
 *   - no dot     → no role demand profile yet (Phase 1 default)
 *
 * Why a sibling component (not extending SpiderChart): the candidate
 * SpiderChart has elaborate visual effects tied to candidate-specific UX
 * (role switching, weight diffs, layer gradients). Employee mode is simpler
 * and developmental — clean dual polygon + Recharts built-in tooltip.
 */

import { useMemo } from "react";
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { CONSTRUCTS, type LayerType } from "@/lib/constructs";
import { useTheme } from "@/components/theme-provider";
import {
  quartileLabel,
  type OrgConstructDistribution,
} from "@/lib/assessment/org-distribution";
// PRO-135: type ownership moved to lib/ so PRO-136+ resolver consumers can
// import without a `lib → components` dependency. Re-exported below for any
// existing component-side consumers.
import type { RoleDemandProfileEntry } from "@/lib/assessment/role-demand-resolution";
export type { RoleDemandProfileEntry };

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ConstructMapEmployeeProps {
  subtestResults: { construct: string; percentile: number; layer: string | null }[];
  /** Pass `undefined` (NOT `[]`) when no profile resolves — empty arrays would
   *  render a degenerate collapsed overlay polygon at radius zero. PRO-135. */
  roleDemandProfile?: RoleDemandProfileEntry[];
  /** PRO-134: org-wide quartile breakpoints for the developmental "Top quartile
   * in our company on X" tooltip line. Optional — when omitted or sample size
   * is < 10, the tooltip falls back to "compared to your colleagues". */
  orgDistributions?: OrgConstructDistribution[];
}

type GapDirection = "over" | "under" | "neutral" | "noProfile";

interface SpokeDatum {
  construct: string;
  abbreviation: string;
  name: string;
  layer: LayerType;
  employeeScore: number;
  demandScore?: number;
  gapDirection: GapDirection;
  /** PRO-134: pre-computed quartile label for the tooltip. Null when no
   * orgDistributions prop was passed. */
  quartileLabel: string | null;
}

// ─── Brand colors ────────────────────────────────────────────────────────────
// Recharts SVG props don't accept CSS variables at runtime, so we materialize
// the palette in JS. Source of truth stays in src/app/globals.css; these
// constants are framework escape hatches with comments tying each value to
// the corresponding --color-aci-* var.

interface ACIColors {
  blue: string;
  green: string;
  amber: string;
  gridStroke: string;
  axisText: string;
  neutralDot: string;
}

const ACI_COLORS_LIGHT: ACIColors = {
  blue: "#2563EB", // --color-aci-blue
  green: "#059669", // --color-aci-green
  amber: "#D97706", // --color-aci-amber
  gridStroke: "#E2E8F0", // --border (light)
  axisText: "#64748B", // --muted-foreground (light)
  neutralDot: "#94A3B8", // ACI slate
};

const ACI_COLORS_DARK: ACIColors = {
  blue: "#3B82F6", // --color-aci-blue-bright
  green: "#22D68A", // --color-aci-green-bright
  amber: "#F59E0B", // brighter amber for legibility on navy bg
  gridStroke: "#1E293B", // --border (dark)
  axisText: "#94A3B8", // --muted-foreground (dark)
  neutralDot: "#475569", // muted slate
};

// ─── Gap math ────────────────────────────────────────────────────────────────
// AC frames thresholds in "1 point on a 10-point scale." subtestResults store
// 0-100 percentiles, so 1 point on the 10-point scale = 10 percentile points.
const GAP_THRESHOLD = 10;

function classifyGap(employeeScore: number, demandScore: number | undefined): GapDirection {
  if (demandScore === undefined) return "noProfile";
  const gap = employeeScore - demandScore;
  if (gap >= GAP_THRESHOLD) return "over";
  if (gap <= -GAP_THRESHOLD) return "under";
  return "neutral";
}

// ─── Component ───────────────────────────────────────────────────────────────

export function ConstructMapEmployee({
  subtestResults,
  roleDemandProfile,
  orgDistributions,
}: ConstructMapEmployeeProps) {
  const { theme } = useTheme();
  const colors = theme === "dark" ? ACI_COLORS_DARK : ACI_COLORS_LIGHT;

  const data: SpokeDatum[] = useMemo(() => {
    const employeeByConstruct = new Map(
      subtestResults.map((r) => [r.construct, r.percentile]),
    );
    const demandByConstruct = roleDemandProfile
      ? new Map(roleDemandProfile.map((r) => [r.construct, r.demandScore]))
      : null;
    const distributionByConstruct = orgDistributions
      ? new Map(orgDistributions.map((d) => [d.construct, d]))
      : null;

    return Object.entries(CONSTRUCTS).map(([code, meta]) => {
      const employeeScore = employeeByConstruct.get(code) ?? 0;
      const demandScore = demandByConstruct?.get(code);
      const distribution = distributionByConstruct?.get(code);
      return {
        construct: code,
        abbreviation: meta.abbreviation,
        name: meta.name,
        layer: meta.layer,
        employeeScore,
        demandScore,
        gapDirection: classifyGap(employeeScore, demandScore),
        quartileLabel: distribution
          ? quartileLabel(employeeScore, distribution)
          : null,
      };
    });
  }, [subtestResults, roleDemandProfile, orgDistributions]);

  // Empty state: no scores at all
  if (subtestResults.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        Construct scores not yet available for this employee.
      </p>
    );
  }

  const showDemandOverlay = roleDemandProfile !== undefined;

  return (
    <div className="max-w-[640px] mx-auto">
      <ResponsiveContainer width="100%" height={420}>
        <RadarChart data={data} outerRadius="75%">
          <PolarGrid stroke={colors.gridStroke} />
          <PolarAngleAxis
            dataKey="abbreviation"
            tick={(props) => <CustomTick {...props} colors={colors} data={data} />}
          />
          <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
          <Radar
            name="Employee"
            dataKey="employeeScore"
            stroke={colors.blue}
            fill={colors.blue}
            fillOpacity={0.18}
            strokeWidth={2}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            dot={(props: any) => <GapDot {...props} colors={colors} />}
          />
          {showDemandOverlay && (
            <Radar
              name="Role Demand"
              dataKey="demandScore"
              stroke={colors.amber}
              fill="transparent"
              strokeDasharray="6 3"
              strokeWidth={2}
              dot={false}
            />
          )}
          <Tooltip
            cursor={false}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            content={(props: any) => <CustomTooltip {...props} hasDemand={showDemandOverlay} />}
          />
        </RadarChart>
      </ResponsiveContainer>

      <Legend hasDemand={showDemandOverlay} colors={colors} />

      {!showDemandOverlay && (
        <p className="text-[10px] text-muted-foreground text-center mt-3 italic">
          Role demand profile not yet configured
        </p>
      )}
    </div>
  );
}

// ─── CustomTick: spoke label, color-coded by gap direction ───────────────────

interface CustomTickProps {
  x?: number | string;
  y?: number | string;
  payload?: { value: string };
  textAnchor?: string;
  colors: ACIColors;
  data: SpokeDatum[];
}

function CustomTick({ x, y, payload, textAnchor, colors, data }: CustomTickProps) {
  if (x === undefined || y === undefined || !payload) return null;
  const spoke = data.find((d) => d.abbreviation === payload.value);
  const fill =
    spoke?.gapDirection === "over"
      ? colors.green
      : spoke?.gapDirection === "under"
        ? colors.amber
        : colors.axisText;
  const anchor = (textAnchor === "start" || textAnchor === "middle" || textAnchor === "end")
    ? textAnchor
    : "middle";

  return (
    <text
      x={x}
      y={y}
      textAnchor={anchor}
      dominantBaseline="central"
      fontSize={10}
      fontFamily="var(--font-jetbrains-mono), monospace"
      fontWeight={600}
      fill={fill}
    >
      {payload.value}
    </text>
  );
}

// ─── GapDot: colored dot at the employee polygon's vertex ────────────────────

interface GapDotProps {
  cx?: number;
  cy?: number;
  payload?: SpokeDatum;
  colors: ACIColors;
}

function GapDot({ cx, cy, payload, colors }: GapDotProps) {
  if (cx === undefined || cy === undefined || !payload) return null;

  const fill =
    payload.gapDirection === "over"
      ? colors.green
      : payload.gapDirection === "under"
        ? colors.amber
        : payload.gapDirection === "neutral"
          ? colors.neutralDot
          : colors.blue; // noProfile: keep on-brand for the lone polygon

  return <circle cx={cx} cy={cy} r={4} fill={fill} stroke="none" />;
}

// ─── CustomTooltip: Recharts built-in tooltip with developmental copy ────────

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: SpokeDatum }>;
  hasDemand: boolean;
}

function CustomTooltip({ active, payload, hasDemand }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const spoke = payload[0].payload;
  if (!spoke) return null;

  const interpretation = !hasDemand
    ? null
    : spoke.gapDirection === "over"
      ? "Over-Spec"
      : spoke.gapDirection === "under"
        ? "Growth Edge"
        : "Aligned with role demand";

  return (
    <div className="bg-popover border border-border rounded-md px-3 py-2 shadow-md text-xs">
      <p className="font-semibold text-foreground">{spoke.name}</p>
      <div className="mt-1 space-y-0.5 text-muted-foreground">
        <p>
          <span className="font-mono text-foreground">{spoke.employeeScore}</span> Employee
        </p>
        <p>
          <span className="font-mono text-foreground">
            {spoke.demandScore !== undefined ? spoke.demandScore : "—"}
          </span>{" "}
          Role Demand
        </p>
      </div>
      {/* PRO-134: developmental quartile label — replacement for forbidden
       *  "X percentile of candidates" framing. Renders only when the org has
       *  enough assessments to produce a meaningful distribution. */}
      {spoke.quartileLabel && (
        <p className="mt-1 text-[11px] text-foreground">{spoke.quartileLabel}</p>
      )}
      {interpretation && (
        <p
          className={`mt-1 text-[10px] font-semibold uppercase tracking-wider ${
            spoke.gapDirection === "over"
              ? "text-aci-green"
              : spoke.gapDirection === "under"
                ? "text-aci-amber"
                : "text-muted-foreground"
          }`}
        >
          {interpretation}
        </p>
      )}
    </div>
  );
}

// ─── Legend ──────────────────────────────────────────────────────────────────

interface LegendProps {
  hasDemand: boolean;
  colors: ACIColors;
}

function Legend({ hasDemand, colors }: LegendProps) {
  return (
    <div className="flex justify-center gap-6 mt-4 text-[10px] uppercase tracking-wider text-muted-foreground">
      <div className="flex items-center gap-1.5">
        <span
          className="inline-block w-3 h-2.5"
          style={{ backgroundColor: colors.blue, opacity: 0.6 }}
          aria-hidden="true"
        />
        Employee
      </div>
      {hasDemand && (
        <div className="flex items-center gap-1.5">
          <span
            className="inline-block w-3 h-0 border-t-2 border-dashed"
            style={{ borderColor: colors.amber }}
            aria-hidden="true"
          />
          Role Demand
        </div>
      )}
    </div>
  );
}

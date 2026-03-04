import {
  Document,
  Page,
  View,
  Text,
  StyleSheet,
} from "@react-pdf/renderer";
import {
  CONSTRUCTS,
  LAYER_INFO,
  type LayerType,
  type ConstructMeta,
} from "@/lib/constructs";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SubtestResult {
  construct: string;
  layer: string;
  percentile: number;
}

interface CompositeScore {
  roleSlug: string;
  percentile: number;
  passed: boolean;
  distanceFromCutline: number;
}

interface Predictions {
  rampTimeLabel: string;
  rampTimeMonths: number;
  supervisionLoad: string;
  supervisionScore: number;
  performanceCeiling: string;
  ceilingCareerPath: string[];
  attritionRisk: string;
  attritionStrategies: string[];
}

interface RedFlag {
  severity: string;
  title: string;
  description: string;
}

interface Note {
  content: string;
  author: { name: string };
  createdAt: string;
}

export interface PDFScorecardProps {
  candidate: {
    firstName: string;
    lastName: string;
    email: string;
    status: string;
    primaryRole: { name: string; slug: string };
    assessment: {
      subtestResults: SubtestResult[];
      compositeScores: CompositeScore[];
      predictions: Predictions | null;
      redFlags: RedFlag[];
    };
    notes: Note[];
  };
}

// ---------------------------------------------------------------------------
// Brand Palette
// ---------------------------------------------------------------------------

const NAVY = "#0F1729";
const GOLD = "#0EA5E9";
const WHITE = "#FFFFFF";
const LIGHT_GRAY = "#F1F5F9";
const MID_GRAY = "#94A3B8";
const DARK_TEXT = "#1E293B";
const GREEN = "#059669";
const RED = "#DC2626";
const AMBER = "#D97706";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getTierLabel(percentile: number): string {
  if (percentile >= 90) return "Exceptional";
  if (percentile >= 75) return "Strong";
  if (percentile >= 50) return "Average";
  if (percentile >= 25) return "Below Average";
  return "Concern";
}

function getTierColor(percentile: number): string {
  if (percentile >= 90) return "#065F46";
  if (percentile >= 75) return GREEN;
  if (percentile >= 50) return MID_GRAY;
  if (percentile >= 25) return AMBER;
  return RED;
}

function getStatusLabel(status: string): string {
  switch (status) {
    case "RECOMMENDED":
      return "STRONG FIT";
    case "REVIEW_REQUIRED":
      return "CONDITIONAL FIT";
    case "DO_NOT_ADVANCE":
      return "NOT A DIRECT FIT";
    case "INCOMPLETE":
      return "IN PROGRESS";
    case "SCORING":
      return "SCORING";
    default:
      return status;
  }
}

function getStatusColor(status: string): string {
  switch (status) {
    case "RECOMMENDED":
      return GREEN;
    case "REVIEW_REQUIRED":
      return AMBER;
    case "DO_NOT_ADVANCE":
      return RED;
    default:
      return MID_GRAY;
  }
}

function formatPercentile(n: number): string {
  if (n <= 0) return "0th";
  const lastTwo = n % 100;
  const lastOne = n % 10;
  if (lastTwo >= 11 && lastTwo <= 13) return `${n}th`;
  if (lastOne === 1) return `${n}st`;
  if (lastOne === 2) return `${n}nd`;
  if (lastOne === 3) return `${n}rd`;
  return `${n}th`;
}

function getConstructName(constructKey: string): string {
  return (
    (CONSTRUCTS[constructKey as keyof typeof CONSTRUCTS] as ConstructMeta | undefined)?.name ??
    constructKey.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

function getConstructAbbr(constructKey: string): string {
  return (
    (CONSTRUCTS[constructKey as keyof typeof CONSTRUCTS] as ConstructMeta | undefined)?.abbreviation ?? constructKey.slice(0, 2)
  );
}

function getLayerColor(layer: string): string {
  return LAYER_INFO[layer as LayerType]?.color ?? MID_GRAY;
}

function getLayerName(layer: string): string {
  return LAYER_INFO[layer as LayerType]?.name ?? layer;
}

function sortedResults(results: SubtestResult[]): SubtestResult[] {
  return [...results].sort((a, b) => b.percentile - a.percentile);
}

function formatDate(): string {
  return new Date().toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

// ---------------------------------------------------------------------------
// Layer grouping
// ---------------------------------------------------------------------------

const LAYER_ORDER: LayerType[] = [
  "COGNITIVE_CORE",
  "TECHNICAL_APTITUDE",
  "BEHAVIORAL_INTEGRITY",
];

function groupByLayer(results: SubtestResult[]) {
  return LAYER_ORDER.map((layer) => ({
    layer,
    name: getLayerName(layer),
    color: getLayerColor(layer),
    results: results.filter((r) => r.layer === layer),
    avg: (() => {
      const layerResults = results.filter((r) => r.layer === layer);
      if (layerResults.length === 0) return 0;
      return Math.round(
        layerResults.reduce((s, r) => s + r.percentile, 0) / layerResults.length
      );
    })(),
  }));
}

// ---------------------------------------------------------------------------
// Stylesheet
// ---------------------------------------------------------------------------

const s = StyleSheet.create({
  page: {
    paddingTop: 70,
    paddingBottom: 60,
    paddingHorizontal: 40,
    fontFamily: "Helvetica",
    fontSize: 9,
    color: DARK_TEXT,
    backgroundColor: WHITE,
  },

  // Header
  headerBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 50,
    backgroundColor: NAVY,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 40,
  },
  headerWordmark: {
    fontSize: 16,
    fontFamily: "Helvetica-Bold",
    color: GOLD,
    letterSpacing: 3,
  },
  headerMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  headerMetaText: {
    fontSize: 8,
    color: WHITE,
    opacity: 0.85,
  },

  // Footer
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 36,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 40,
    borderTopWidth: 1,
    borderTopColor: LIGHT_GRAY,
  },
  footerLeft: {
    fontSize: 7,
    color: MID_GRAY,
  },
  footerRight: {
    fontSize: 7,
    color: MID_GRAY,
  },

  // Section titles
  pageTitle: {
    fontSize: 16,
    fontFamily: "Helvetica-Bold",
    color: NAVY,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: NAVY,
    marginBottom: 8,
    marginTop: 14,
  },
  subTitle: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: DARK_TEXT,
    marginBottom: 6,
  },

  // Cards
  card: {
    backgroundColor: LIGHT_GRAY,
    borderRadius: 4,
    padding: 12,
    marginBottom: 10,
  },
  cardRow: {
    flexDirection: "row",
    gap: 10,
  },
  cardHalf: {
    flex: 1,
    backgroundColor: LIGHT_GRAY,
    borderRadius: 4,
    padding: 12,
  },

  // Table
  tableHeader: {
    flexDirection: "row",
    backgroundColor: NAVY,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 3,
    marginBottom: 2,
  },
  tableHeaderCell: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: WHITE,
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: "#E2E8F0",
  },
  tableRowAlt: {
    backgroundColor: "#F8FAFC",
  },
  tableCell: {
    fontSize: 8.5,
  },

  // Badge
  badge: {
    alignSelf: "flex-start",
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 3,
    marginBottom: 12,
  },
  badgeText: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: WHITE,
    letterSpacing: 1,
  },

  // Horizontal bar
  barContainer: {
    height: 12,
    backgroundColor: "#E2E8F0",
    borderRadius: 2,
    overflow: "hidden",
    marginTop: 3,
    marginBottom: 6,
  },
  barFill: {
    height: 12,
    borderRadius: 2,
  },

  // Misc
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
    marginVertical: 10,
  },
  goldAccent: {
    width: 3,
    backgroundColor: GOLD,
    borderRadius: 2,
    marginRight: 8,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
  },
  body: {
    fontSize: 9,
    lineHeight: 1.5,
    color: DARK_TEXT,
  },
  bodySmall: {
    fontSize: 8,
    lineHeight: 1.4,
    color: MID_GRAY,
  },
  bold: {
    fontFamily: "Helvetica-Bold",
  },
  mt4: { marginTop: 4 },
  mt8: { marginTop: 8 },
  mt12: { marginTop: 12 },
  mb4: { marginBottom: 4 },
  mb8: { marginBottom: 8 },
  mb12: { marginBottom: 12 },
  gap6: { gap: 6 },
});

// ---------------------------------------------------------------------------
// Shared page elements
// ---------------------------------------------------------------------------

function Header({
  candidateName,
  roleName,
}: {
  candidateName: string;
  roleName: string;
}) {
  return (
    <View style={s.headerBar} fixed>
      <Text style={s.headerWordmark}>ACI</Text>
      <View style={s.headerMeta}>
        <Text style={s.headerMetaText}>{candidateName}</Text>
        <Text style={[s.headerMetaText, { opacity: 0.5 }]}>|</Text>
        <Text style={s.headerMetaText}>{roleName}</Text>
        <Text style={[s.headerMetaText, { opacity: 0.5 }]}>|</Text>
        <Text style={s.headerMetaText}>{formatDate()}</Text>
      </View>
    </View>
  );
}

function Footer() {
  return (
    <View style={s.footer} fixed>
      <Text style={s.footerLeft}>
        ACI — Arklight Cognitive Index | Confidential
      </Text>
      <Text
        style={s.footerRight}
        render={({ pageNumber, totalPages }) =>
          `Page ${pageNumber} of ${totalPages}`
        }
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Page 1: Executive Summary
// ---------------------------------------------------------------------------

function ExecutiveSummaryPage({
  candidate,
}: {
  candidate: PDFScorecardProps["candidate"];
}) {
  const { assessment, primaryRole, status, firstName } = candidate;
  const sorted = sortedResults(assessment.subtestResults);
  const top3 = sorted.slice(0, 3);
  const bottom2 = sorted.slice(-2);

  const composite = assessment.compositeScores.find(
    (cs) => cs.roleSlug === primaryRole.slug
  );
  const percentile = composite?.percentile ?? 0;
  const passed = composite?.passed ?? false;
  const cutlineDist = composite?.distanceFromCutline ?? 0;

  // Narrative generation
  let narrative: string;
  if (percentile >= 85) {
    narrative = `${firstName} is an exceptional candidate for the ${primaryRole.name} role, scoring at the ${formatPercentile(percentile)} percentile overall. Their strongest dimensions — ${top3.map((t) => `${getConstructName(t.construct)} (${formatPercentile(t.percentile)})`).join(", ")} — indicate both the cognitive foundation and practical aptitude for immediate high-level contribution.`;
  } else if (percentile >= 65) {
    narrative = `${firstName} presents a solid profile for the ${primaryRole.name} role at the ${formatPercentile(percentile)} percentile. Strengths in ${top3.slice(0, 2).map((t) => `${getConstructName(t.construct)} (${formatPercentile(t.percentile)})`).join(" and ")} align well with role demands. ${bottom2[0].percentile < 40 ? `Development area in ${getConstructName(bottom2[0].construct)} (${formatPercentile(bottom2[0].percentile)}) warrants attention during onboarding.` : "No significant gaps that would impede standard onboarding."}`;
  } else if (percentile >= 45) {
    narrative = `${firstName} shows a mixed profile for the ${primaryRole.name} role at the ${formatPercentile(percentile)} percentile. While ${getConstructName(top3[0].construct)} (${formatPercentile(top3[0].percentile)}) is a relative strength, development areas in ${bottom2.map((d) => `${getConstructName(d.construct)} (${formatPercentile(d.percentile)})`).join(" and ")} should be weighed against role requirements.`;
  } else {
    narrative = `${firstName} scored at the ${formatPercentile(percentile)} percentile for the ${primaryRole.name} role, which falls below the typical hiring threshold. Limitations in ${bottom2.map((d) => `${getConstructName(d.construct)} (${formatPercentile(d.percentile)})`).join(" and ")} are likely to impact performance without significant intervention.`;
  }

  return (
    <View>
      <Text style={s.pageTitle}>Executive Summary</Text>

      {/* Status Badge */}
      <View
        style={[s.badge, { backgroundColor: getStatusColor(status) }]}
      >
        <Text style={s.badgeText}>{getStatusLabel(status)}</Text>
      </View>

      {/* Composite Score Card */}
      <View style={s.card}>
        <View style={[s.row, { justifyContent: "space-between" }]}>
          <View>
            <Text style={[s.bodySmall, s.mb4]}>
              Composite Score — {primaryRole.name}
            </Text>
            <Text style={{ fontSize: 28, fontFamily: "Helvetica-Bold", color: NAVY }}>
              {formatPercentile(percentile)}
            </Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <View
              style={[
                s.badge,
                {
                  backgroundColor: passed ? GREEN : RED,
                  marginBottom: 4,
                },
              ]}
            >
              <Text style={[s.badgeText, { fontSize: 8 }]}>
                {passed ? "PASSED" : "BELOW CUTLINE"}
              </Text>
            </View>
            <Text style={s.bodySmall}>
              {cutlineDist >= 0 ? "+" : ""}
              {cutlineDist.toFixed(1)} pts from cutline
            </Text>
          </View>
        </View>
      </View>

      {/* Strengths & Development */}
      <View style={s.cardRow}>
        <View style={s.cardHalf}>
          <Text style={s.subTitle}>Top 3 Strengths</Text>
          {top3.map((r, i) => (
            <View key={i} style={[s.row, s.mt4]}>
              <View style={s.goldAccent} />
              <View style={{ flex: 1 }}>
                <Text style={s.body}>
                  <Text style={s.bold}>{getConstructName(r.construct)}</Text>
                  {"  "}
                  <Text style={{ color: getTierColor(r.percentile) }}>
                    {formatPercentile(r.percentile)} — {getTierLabel(r.percentile)}
                  </Text>
                </Text>
              </View>
            </View>
          ))}
        </View>
        <View style={s.cardHalf}>
          <Text style={s.subTitle}>Development Areas</Text>
          {bottom2.map((r, i) => (
            <View key={i} style={[s.row, s.mt4]}>
              <View
                style={[
                  s.goldAccent,
                  { backgroundColor: getTierColor(r.percentile) },
                ]}
              />
              <View style={{ flex: 1 }}>
                <Text style={s.body}>
                  <Text style={s.bold}>{getConstructName(r.construct)}</Text>
                  {"  "}
                  <Text style={{ color: getTierColor(r.percentile) }}>
                    {formatPercentile(r.percentile)} — {getTierLabel(r.percentile)}
                  </Text>
                </Text>
              </View>
            </View>
          ))}
        </View>
      </View>

      {/* Narrative */}
      <View style={[s.card, s.mt8]}>
        <Text style={s.subTitle}>Assessment Narrative</Text>
        <Text style={s.body}>{narrative}</Text>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Page 2: Construct Scores
// ---------------------------------------------------------------------------

function ConstructScoresPage({
  candidate,
}: {
  candidate: PDFScorecardProps["candidate"];
}) {
  const { assessment } = candidate;
  const results = assessment.subtestResults;

  // Build ordered list grouped by layer
  const orderedResults: SubtestResult[] = [];
  for (const layer of LAYER_ORDER) {
    orderedResults.push(
      ...results
        .filter((r) => r.layer === layer)
        .sort((a, b) => {
          const aIdx = Object.keys(CONSTRUCTS).indexOf(a.construct);
          const bIdx = Object.keys(CONSTRUCTS).indexOf(b.construct);
          return aIdx - bIdx;
        })
    );
  }

  return (
    <View>
      <Text style={s.pageTitle}>Construct Scores</Text>

      {/* Table */}
      <View style={s.tableHeader}>
        <Text style={[s.tableHeaderCell, { width: "32%" }]}>Construct</Text>
        <Text style={[s.tableHeaderCell, { width: "26%" }]}>Layer</Text>
        <Text
          style={[s.tableHeaderCell, { width: "18%", textAlign: "center" }]}
        >
          Percentile
        </Text>
        <Text
          style={[s.tableHeaderCell, { width: "24%", textAlign: "center" }]}
        >
          Tier
        </Text>
      </View>
      {orderedResults.map((r, i) => (
        <View
          key={i}
          style={[s.tableRow, i % 2 === 1 ? s.tableRowAlt : {}]}
        >
          <Text style={[s.tableCell, s.bold, { width: "32%" }]}>
            {getConstructName(r.construct)} ({getConstructAbbr(r.construct)})
          </Text>
          <Text style={[s.tableCell, { width: "26%", color: getLayerColor(r.layer) }]}>
            {getLayerName(r.layer)}
          </Text>
          <Text
            style={[
              s.tableCell,
              s.bold,
              { width: "18%", textAlign: "center" },
            ]}
          >
            {formatPercentile(r.percentile)}
          </Text>
          <Text
            style={[
              s.tableCell,
              s.bold,
              {
                width: "24%",
                textAlign: "center",
                color: getTierColor(r.percentile),
              },
            ]}
          >
            {getTierLabel(r.percentile)}
          </Text>
        </View>
      ))}

      {/* Composite Scores */}
      <Text style={[s.sectionTitle, s.mt12]}>
        Composite Scores by Role
      </Text>
      <View style={s.tableHeader}>
        <Text style={[s.tableHeaderCell, { width: "40%" }]}>Role</Text>
        <Text
          style={[s.tableHeaderCell, { width: "20%", textAlign: "center" }]}
        >
          Percentile
        </Text>
        <Text
          style={[s.tableHeaderCell, { width: "20%", textAlign: "center" }]}
        >
          Result
        </Text>
        <Text
          style={[s.tableHeaderCell, { width: "20%", textAlign: "center" }]}
        >
          Cutline Dist.
        </Text>
      </View>
      {assessment.compositeScores.map((cs, i) => {
        const roleName = cs.roleSlug
          .split("-")
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(" ");
        const isPrimary = cs.roleSlug === candidate.primaryRole.slug;
        return (
          <View
            key={i}
            style={[
              s.tableRow,
              i % 2 === 1 ? s.tableRowAlt : {},
              isPrimary ? { backgroundColor: "#FFFBEB" } : {},
            ]}
          >
            <Text style={[s.tableCell, { width: "40%" }, isPrimary ? s.bold : {}]}>
              {roleName}
              {isPrimary ? " (Primary)" : ""}
            </Text>
            <Text
              style={[s.tableCell, s.bold, { width: "20%", textAlign: "center" }]}
            >
              {formatPercentile(cs.percentile)}
            </Text>
            <Text
              style={[
                s.tableCell,
                s.bold,
                {
                  width: "20%",
                  textAlign: "center",
                  color: cs.passed ? GREEN : RED,
                },
              ]}
            >
              {cs.passed ? "PASS" : "FAIL"}
            </Text>
            <Text
              style={[s.tableCell, { width: "20%", textAlign: "center" }]}
            >
              {cs.distanceFromCutline >= 0 ? "+" : ""}
              {cs.distanceFromCutline.toFixed(1)}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Page 3: Layer Analysis
// ---------------------------------------------------------------------------

function LayerAnalysisPage({
  candidate,
}: {
  candidate: PDFScorecardProps["candidate"];
}) {
  const groups = groupByLayer(candidate.assessment.subtestResults);

  return (
    <View>
      <Text style={s.pageTitle}>Layer Analysis</Text>

      {groups.map((group, gi) => (
        <View key={gi} style={[s.card, gi > 0 ? s.mt4 : {}]}>
          {/* Layer Header */}
          <View style={[s.row, { justifyContent: "space-between", marginBottom: 10 }]}>
            <View style={s.row}>
              <View
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 2,
                  backgroundColor: group.color,
                  marginRight: 6,
                }}
              />
              <Text style={[s.subTitle, { marginBottom: 0 }]}>
                {group.name}
              </Text>
            </View>
            <Text style={[s.body, s.bold]}>
              Avg: {formatPercentile(group.avg)}
            </Text>
          </View>

          {/* Layer Average Bar */}
          <View style={s.barContainer}>
            <View
              style={[
                s.barFill,
                {
                  width: `${Math.max(2, group.avg)}%`,
                  backgroundColor: group.color,
                },
              ]}
            />
          </View>

          {/* Individual Construct Bars */}
          {group.results.map((r, ri) => (
            <View key={ri} style={s.mt4}>
              <View style={[s.row, { justifyContent: "space-between" }]}>
                <Text style={[s.bodySmall, s.bold, { color: DARK_TEXT }]}>
                  {getConstructName(r.construct)} ({getConstructAbbr(r.construct)})
                </Text>
                <Text style={[s.bodySmall, s.bold, { color: getTierColor(r.percentile) }]}>
                  {formatPercentile(r.percentile)} — {getTierLabel(r.percentile)}
                </Text>
              </View>
              <View style={s.barContainer}>
                <View
                  style={[
                    s.barFill,
                    {
                      width: `${Math.max(2, r.percentile)}%`,
                      backgroundColor: group.color,
                      opacity: 0.7,
                    },
                  ]}
                />
              </View>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Page 4: Predictive Insights
// ---------------------------------------------------------------------------

function PredictionCard({
  label,
  value,
  details,
  color,
}: {
  label: string;
  value: string;
  details: string;
  color: string;
}) {
  return (
    <View style={{ flex: 1, backgroundColor: LIGHT_GRAY, borderRadius: 4, padding: 10 }}>
      <Text style={[s.bodySmall, { marginBottom: 4 }]}>{label}</Text>
      <Text style={{ fontSize: 14, fontFamily: "Helvetica-Bold", color, marginBottom: 4 }}>
        {value}
      </Text>
      <Text style={s.bodySmall}>{details}</Text>
    </View>
  );
}

function PredictiveInsightsPage({
  candidate,
}: {
  candidate: PDFScorecardProps["candidate"];
}) {
  const { predictions, redFlags } = candidate.assessment;

  return (
    <View>
      <Text style={s.pageTitle}>Predictive Insights</Text>

      {predictions ? (
        <>
          {/* Row 1 */}
          <View style={[s.cardRow, s.mb8]}>
            <PredictionCard
              label="Ramp Time"
              value={predictions.rampTimeLabel}
              details={`Estimated ${predictions.rampTimeMonths} month${predictions.rampTimeMonths !== 1 ? "s" : ""} to full productivity`}
              color={
                predictions.rampTimeMonths <= 2
                  ? GREEN
                  : predictions.rampTimeMonths <= 4
                    ? AMBER
                    : RED
              }
            />
            <PredictionCard
              label="Supervision Load"
              value={predictions.supervisionLoad}
              details={`Supervision score: ${predictions.supervisionScore}/100`}
              color={
                predictions.supervisionScore >= 70
                  ? GREEN
                  : predictions.supervisionScore >= 45
                    ? AMBER
                    : RED
              }
            />
          </View>

          {/* Row 2 */}
          <View style={[s.cardRow, s.mb8]}>
            <PredictionCard
              label="Performance Ceiling"
              value={predictions.performanceCeiling}
              details={
                predictions.ceilingCareerPath.length > 0
                  ? `Path: ${predictions.ceilingCareerPath.join(" → ")}`
                  : "No career path data available"
              }
              color={NAVY}
            />
            <PredictionCard
              label="Attrition Risk"
              value={predictions.attritionRisk}
              details={
                predictions.attritionStrategies.length > 0
                  ? predictions.attritionStrategies[0]
                  : "No specific strategies recommended"
              }
              color={
                predictions.attritionRisk === "LOW"
                  ? GREEN
                  : predictions.attritionRisk === "MEDIUM"
                    ? AMBER
                    : RED
              }
            />
          </View>

          {/* Attrition Strategies (if multiple) */}
          {predictions.attritionStrategies.length > 1 && (
            <View style={[s.card, s.mb8]}>
              <Text style={s.subTitle}>Retention Strategies</Text>
              {predictions.attritionStrategies.map((strategy, i) => (
                <Text key={i} style={[s.body, s.mt4]}>
                  {i + 1}. {strategy}
                </Text>
              ))}
            </View>
          )}
        </>
      ) : (
        <View style={s.card}>
          <Text style={s.body}>
            Predictive data is not yet available for this candidate.
          </Text>
        </View>
      )}

      {/* Red Flags */}
      <Text style={s.sectionTitle}>Red Flags</Text>
      {redFlags.length === 0 ? (
        <View style={s.card}>
          <Text style={[s.body, { color: GREEN }]}>
            No red flags identified in this assessment.
          </Text>
        </View>
      ) : (
        redFlags.map((flag, i) => {
          const severityColor =
            flag.severity === "CRITICAL"
              ? RED
              : flag.severity === "WARNING"
                ? AMBER
                : MID_GRAY;
          return (
            <View key={i} style={[s.card, { borderLeftWidth: 3, borderLeftColor: severityColor }]}>
              <View style={[s.row, { justifyContent: "space-between", marginBottom: 4 }]}>
                <Text style={[s.body, s.bold]}>{flag.title}</Text>
                <View
                  style={[
                    s.badge,
                    {
                      backgroundColor: severityColor,
                      paddingVertical: 2,
                      paddingHorizontal: 6,
                      marginBottom: 0,
                    },
                  ]}
                >
                  <Text style={[s.badgeText, { fontSize: 7 }]}>
                    {flag.severity}
                  </Text>
                </View>
              </View>
              <Text style={s.body}>{flag.description}</Text>
            </View>
          );
        })
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Page 5: Recommendations
// ---------------------------------------------------------------------------

function RecommendationsPage({
  candidate,
}: {
  candidate: PDFScorecardProps["candidate"];
}) {
  const sorted = sortedResults(candidate.assessment.subtestResults);
  const top2 = sorted.slice(0, 2);
  const bottom3 = sorted.slice(-3);

  // Development suggestions per construct
  function getSuggestion(constructKey: string, percentile: number): string {
    const meta = CONSTRUCTS[constructKey as keyof typeof CONSTRUCTS] as ConstructMeta | undefined;
    if (!meta) return "Provide targeted coaching and structured practice.";

    const layer = meta.layer;
    if (layer === "COGNITIVE_CORE") {
      if (percentile < 25)
        return `Provide structured scaffolding for ${meta.name.toLowerCase()} tasks. Pair with a mentor who can model the thinking process. Use progressive-difficulty training modules.`;
      return `Moderate development plan: provide periodic challenges that stretch ${meta.name.toLowerCase()} capabilities with guided feedback loops.`;
    }
    if (layer === "TECHNICAL_APTITUDE") {
      if (percentile < 25)
        return `Intensive hands-on training for ${meta.name.toLowerCase()}. Use simulation-based exercises before live work. Assign buddy system for first 90 days.`;
      return `Supplemental training in ${meta.name.toLowerCase()} through workshop-style learning. Review progress at 30/60/90 day intervals.`;
    }
    // BEHAVIORAL_INTEGRITY
    if (percentile < 25)
      return `Implement structured accountability frameworks for ${meta.name.toLowerCase()}. Frequent check-ins during first 90 days. Clear documentation of expectations and consequences.`;
    return `Reinforce ${meta.name.toLowerCase()} through team culture integration. Regular calibration conversations with supervisor.`;
  }

  return (
    <View>
      <Text style={s.pageTitle}>Recommendations</Text>

      {/* Interview Focus Areas */}
      <Text style={s.sectionTitle}>Interview Focus Areas</Text>
      <Text style={[s.bodySmall, s.mb8]}>
        These constructs scored lowest and should be explored during the structured
        interview to understand context, environment, and potential for growth.
      </Text>
      {bottom3.map((r, i) => (
        <View key={i} style={[s.card, { borderLeftWidth: 3, borderLeftColor: GOLD }]}>
          <View style={[s.row, { justifyContent: "space-between", marginBottom: 4 }]}>
            <Text style={[s.body, s.bold]}>
              {i + 1}. {getConstructName(r.construct)}
            </Text>
            <Text style={[s.body, s.bold, { color: getTierColor(r.percentile) }]}>
              {formatPercentile(r.percentile)} — {getTierLabel(r.percentile)}
            </Text>
          </View>
          <Text style={s.bodySmall}>
            Probe: How does the candidate approach situations that require{" "}
            {getConstructName(r.construct).toLowerCase()}? Ask for specific
            examples and observe their self-awareness about this dimension.
          </Text>
        </View>
      ))}

      {/* Strengths to Validate */}
      <Text style={s.sectionTitle}>Strengths to Validate</Text>
      <Text style={[s.bodySmall, s.mb8]}>
        Confirm these top-scoring constructs with behavioral interview questions to
        verify the assessment results align with real-world performance.
      </Text>
      {top2.map((r, i) => (
        <View key={i} style={[s.card, { borderLeftWidth: 3, borderLeftColor: GREEN }]}>
          <View style={[s.row, { justifyContent: "space-between", marginBottom: 4 }]}>
            <Text style={[s.body, s.bold]}>
              {getConstructName(r.construct)}
            </Text>
            <Text style={[s.body, s.bold, { color: getTierColor(r.percentile) }]}>
              {formatPercentile(r.percentile)} — {getTierLabel(r.percentile)}
            </Text>
          </View>
          <Text style={s.bodySmall}>
            Validate: Ask for concrete examples where {getConstructName(r.construct).toLowerCase()} made a
            difference in their past work. Look for depth and specificity.
          </Text>
        </View>
      ))}

      {/* Development Priorities */}
      <Text style={s.sectionTitle}>Development Priorities</Text>
      <Text style={[s.bodySmall, s.mb8]}>
        If the candidate is hired, these areas should be prioritized in their
        onboarding and individual development plan.
      </Text>
      {bottom3.map((r, i) => (
        <View key={i} style={s.card}>
          <View style={[s.row, { justifyContent: "space-between", marginBottom: 4 }]}>
            <Text style={[s.body, s.bold]}>
              {i + 1}. {getConstructName(r.construct)}
            </Text>
            <Text
              style={[
                s.body,
                { color: getTierColor(r.percentile) },
              ]}
            >
              {formatPercentile(r.percentile)}
            </Text>
          </View>
          <Text style={s.body}>
            {getSuggestion(r.construct, r.percentile)}
          </Text>
        </View>
      ))}

      {/* Closing */}
      <View style={[s.divider, s.mt12]} />
      <Text style={[s.bodySmall, { textAlign: "center", marginTop: 6 }]}>
        This scorecard was generated by the ACI platform. Assessment results
        should be used as one data point among many in the hiring decision. All
        scores are norm-referenced against the ACI manufacturing population.
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Main Document
// ---------------------------------------------------------------------------

export function PDFScorecard({ candidate }: PDFScorecardProps) {
  const candidateName = `${candidate.firstName} ${candidate.lastName}`;
  const roleName = candidate.primaryRole.name;

  return (
    <Document
      title={`ACI Scorecard — ${candidateName}`}
      author="ACI Platform"
      subject={`Candidate Assessment Scorecard for ${candidateName}`}
      creator="ACI — Arklight Cognitive Index"
    >
      {/* Page 1: Executive Summary */}
      <Page size="A4" style={s.page}>
        <Header candidateName={candidateName} roleName={roleName} />
        <ExecutiveSummaryPage candidate={candidate} />
        <Footer />
      </Page>

      {/* Page 2: Construct Scores */}
      <Page size="A4" style={s.page}>
        <Header candidateName={candidateName} roleName={roleName} />
        <ConstructScoresPage candidate={candidate} />
        <Footer />
      </Page>

      {/* Page 3: Layer Analysis */}
      <Page size="A4" style={s.page}>
        <Header candidateName={candidateName} roleName={roleName} />
        <LayerAnalysisPage candidate={candidate} />
        <Footer />
      </Page>

      {/* Page 4: Predictive Insights */}
      <Page size="A4" style={s.page}>
        <Header candidateName={candidateName} roleName={roleName} />
        <PredictiveInsightsPage candidate={candidate} />
        <Footer />
      </Page>

      {/* Page 5: Recommendations */}
      <Page size="A4" style={s.page}>
        <Header candidateName={candidateName} roleName={roleName} />
        <RecommendationsPage candidate={candidate} />
        <Footer />
      </Page>
    </Document>
  );
}

export default PDFScorecard;

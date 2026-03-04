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
import type { IntelligencePanel } from "@/lib/intelligence";

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
  performanceCeiling: string;
  attritionRisk: string;
}

export interface PDFOnePagerProps {
  candidate: {
    firstName: string;
    lastName: string;
    status: string;
    primaryRole: { name: string; slug: string };
    assessment: {
      subtestResults: SubtestResult[];
      compositeScores: CompositeScore[];
      predictions: Predictions | null;
      completedAt?: string | null;
    };
  };
  panels: IntelligencePanel[];
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

function getStatusLabel(status: string): string {
  switch (status) {
    case "RECOMMENDED": return "STRONG FIT";
    case "REVIEW_REQUIRED": return "CONDITIONAL FIT";
    case "DO_NOT_ADVANCE": return "NOT A DIRECT FIT";
    case "INCOMPLETE": return "IN PROGRESS";
    case "SCORING": return "SCORING";
    default: return status;
  }
}

function getStatusColor(status: string): string {
  switch (status) {
    case "RECOMMENDED": return GREEN;
    case "REVIEW_REQUIRED": return AMBER;
    case "DO_NOT_ADVANCE": return RED;
    default: return MID_GRAY;
  }
}

function getTierColor(percentile: number): string {
  if (percentile >= 90) return "#065F46";
  if (percentile >= 75) return GREEN;
  if (percentile >= 50) return MID_GRAY;
  if (percentile >= 25) return AMBER;
  return RED;
}

function formatDate(): string {
  return new Date().toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function getConstructAbbr(key: string): string {
  return (CONSTRUCTS[key as keyof typeof CONSTRUCTS] as ConstructMeta | undefined)?.abbreviation ?? key.slice(0, 2);
}

function getConstructName(key: string): string {
  return (CONSTRUCTS[key as keyof typeof CONSTRUCTS] as ConstructMeta | undefined)?.name ?? key.replace(/_/g, " ");
}

function getLayerColor(layer: string): string {
  return LAYER_INFO[layer as LayerType]?.color ?? MID_GRAY;
}

function getLayerName(layer: string): string {
  return LAYER_INFO[layer as LayerType]?.name ?? layer;
}

function getRiskColor(level: string): string {
  switch (level) {
    case "LOW": return GREEN;
    case "MEDIUM": return AMBER;
    case "HIGH": return RED;
    default: return MID_GRAY;
  }
}

// ---------------------------------------------------------------------------
// Stylesheet
// ---------------------------------------------------------------------------

const s = StyleSheet.create({
  page: {
    padding: 0,
    fontFamily: "Helvetica",
    fontSize: 8,
    color: DARK_TEXT,
    backgroundColor: WHITE,
  },

  // Top strip
  topStrip: {
    backgroundColor: NAVY,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingVertical: 14,
  },
  topLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  wordmark: {
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
    color: GOLD,
    letterSpacing: 3,
  },
  candidateName: {
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
    color: WHITE,
  },
  roleName: {
    fontSize: 9,
    color: WHITE,
    opacity: 0.8,
    marginTop: 1,
  },
  topRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  statusBadge: {
    paddingVertical: 3,
    paddingHorizontal: 10,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: WHITE,
    letterSpacing: 0.8,
  },
  scoreBox: {
    alignItems: "center",
  },
  scoreNumber: {
    fontSize: 22,
    fontFamily: "Helvetica-Bold",
    color: GOLD,
  },
  scoreLabel: {
    fontSize: 6,
    color: WHITE,
    opacity: 0.7,
    letterSpacing: 1,
  },
  dateText: {
    fontSize: 7,
    color: WHITE,
    opacity: 0.6,
  },

  // Body
  body: {
    flexDirection: "row",
    paddingHorizontal: 24,
    paddingTop: 14,
    gap: 16,
    flex: 1,
  },

  // Left panel
  leftPanel: {
    width: "28%",
  },
  panelTitle: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: NAVY,
    letterSpacing: 1,
    marginBottom: 8,
  },
  layerHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 4,
    marginTop: 6,
  },
  layerDot: {
    width: 6,
    height: 6,
    borderRadius: 1,
  },
  layerLabel: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 0.5,
  },
  constructRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 2.5,
    paddingHorizontal: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: "#E2E8F0",
  },
  constructLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  constructDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  constructAbbr: {
    fontSize: 7.5,
    fontFamily: "Helvetica-Bold",
    width: 20,
  },
  constructPercent: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
  },

  // Center panel
  centerPanel: {
    width: "42%",
  },
  actionItem: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 7,
    paddingLeft: 2,
  },
  bullet: {
    fontSize: 12,
    color: GOLD,
    lineHeight: 1.1,
  },
  actionText: {
    fontSize: 8,
    lineHeight: 1.5,
    color: DARK_TEXT,
    flex: 1,
  },

  // Right panel
  rightPanel: {
    width: "30%",
  },
  predictionCard: {
    backgroundColor: LIGHT_GRAY,
    borderRadius: 3,
    padding: 8,
    marginBottom: 6,
  },
  predLabel: {
    fontSize: 6.5,
    color: MID_GRAY,
    letterSpacing: 0.8,
    marginBottom: 3,
  },
  predValue: {
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
  },

  // Bottom strip
  bottomStrip: {
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
    paddingHorizontal: 24,
    paddingVertical: 10,
  },
  bottomTitle: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: NAVY,
    letterSpacing: 1,
    marginBottom: 6,
  },
  interviewRow: {
    flexDirection: "row",
    gap: 16,
  },
  interviewItem: {
    flex: 1,
    flexDirection: "row",
    gap: 6,
  },
  interviewAccent: {
    width: 2,
    backgroundColor: GOLD,
    borderRadius: 1,
  },
  interviewContent: {
    flex: 1,
  },
  interviewConstruct: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: NAVY,
    marginBottom: 2,
  },
  interviewQuestion: {
    fontSize: 7.5,
    lineHeight: 1.4,
    color: DARK_TEXT,
  },

  // Footer
  footer: {
    borderTopWidth: 0.5,
    borderTopColor: "#E2E8F0",
    paddingHorizontal: 24,
    paddingVertical: 6,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  footerText: {
    fontSize: 6,
    color: MID_GRAY,
  },
});

// ---------------------------------------------------------------------------
// Interview questions per construct (bottom 2)
// ---------------------------------------------------------------------------

const INTERVIEW_QUESTIONS: Record<string, string> = {
  FLUID_REASONING: "Describe a time you faced a problem you had never seen before. Walk me through how you figured out what to do.",
  EXECUTIVE_CONTROL: "Tell me about a time you had to manage multiple urgent priorities on the shop floor. How did you decide what came first?",
  COGNITIVE_FLEXIBILITY: "Give me an example of when your original approach to a task wasn't working. How did you adapt?",
  METACOGNITIVE_CALIBRATION: "When was the last time you realized mid-task that you were in over your head? What did you do?",
  LEARNING_VELOCITY: "Describe the last completely new skill or tool you had to learn. How long did it take to feel competent?",
  SYSTEMS_DIAGNOSTICS: "Walk me through how you would troubleshoot a machine that was producing out-of-spec parts intermittently.",
  PATTERN_RECOGNITION: "Tell me about a time you noticed something was 'off' before anyone else did. What tipped you off?",
  QUANTITATIVE_REASONING: "Describe how you work with tolerances and measurements day-to-day. Give me a specific example.",
  SPATIAL_VISUALIZATION: "How do you read and interpret complex engineering drawings? Describe your process for a tricky part.",
  MECHANICAL_REASONING: "Explain a time when understanding how forces or mechanics work helped you solve a practical problem.",
  PROCEDURAL_RELIABILITY: "Tell me about a time following the exact procedure felt slow or unnecessary. What did you do?",
  ETHICAL_JUDGMENT: "Describe a situation where you had to choose between the easy path and the right path at work. What happened?",
};

// ---------------------------------------------------------------------------
// Layers order
// ---------------------------------------------------------------------------

const LAYER_ORDER: LayerType[] = [
  "COGNITIVE_CORE",
  "TECHNICAL_APTITUDE",
  "BEHAVIORAL_INTEGRITY",
];

// ---------------------------------------------------------------------------
// Document
// ---------------------------------------------------------------------------

export function PDFOnePager({ candidate, panels }: PDFOnePagerProps) {
  const { assessment, primaryRole, status } = candidate;
  const candidateName = `${candidate.firstName} ${candidate.lastName}`;

  const composite = assessment.compositeScores.find(
    (cs) => cs.roleSlug === primaryRole.slug
  );
  const percentile = composite?.percentile ?? 0;

  // Group constructs by layer
  const groupedResults = LAYER_ORDER.map((layer) => ({
    layer,
    name: getLayerName(layer),
    color: getLayerColor(layer),
    results: assessment.subtestResults
      .filter((r) => r.layer === layer)
      .sort((a, b) => {
        const aIdx = Object.keys(CONSTRUCTS).indexOf(a.construct);
        const bIdx = Object.keys(CONSTRUCTS).indexOf(b.construct);
        return aIdx - bIdx;
      }),
  }));

  // Extract hiring actions from panels (up to 5)
  const hiringActions = panels
    .filter((p) => p.hiringAction)
    .map((p) => ({
      title: p.title,
      action: p.hiringAction!,
    }))
    .slice(0, 5);

  // Bottom 2 constructs for interview focus
  const sorted = [...assessment.subtestResults].sort((a, b) => a.percentile - b.percentile);
  const bottom2 = sorted.slice(0, 2);

  const predictions = assessment.predictions;

  return (
    <Document
      title={`ACI One-Pager — ${candidateName}`}
      author="ACI Platform"
      subject={`Hiring Manager Summary for ${candidateName}`}
      creator="ACI — Arklight Cognitive Index"
    >
      <Page size="A4" style={s.page}>
        {/* ── Top Strip ── */}
        <View style={s.topStrip}>
          <View style={s.topLeft}>
            <Text style={s.wordmark}>ACI</Text>
            <View>
              <Text style={s.candidateName}>{candidateName}</Text>
              <Text style={s.roleName}>{primaryRole.name}</Text>
            </View>
          </View>
          <View style={s.topRight}>
            <View style={[s.statusBadge, { backgroundColor: getStatusColor(status) }]}>
              <Text style={s.statusText}>{getStatusLabel(status)}</Text>
            </View>
            <View style={s.scoreBox}>
              <Text style={s.scoreNumber}>{percentile}</Text>
              <Text style={s.scoreLabel}>COMPOSITE</Text>
            </View>
            <Text style={s.dateText}>{formatDate()}</Text>
          </View>
        </View>

        {/* ── Three Column Body ── */}
        <View style={s.body}>
          {/* Left: Construct Scores */}
          <View style={s.leftPanel}>
            <Text style={s.panelTitle}>CONSTRUCT SCORES</Text>
            {groupedResults.map((group) => (
              <View key={group.layer}>
                <View style={s.layerHeader}>
                  <View style={[s.layerDot, { backgroundColor: group.color }]} />
                  <Text style={[s.layerLabel, { color: group.color }]}>{group.name}</Text>
                </View>
                {group.results.map((r) => (
                  <View key={r.construct} style={s.constructRow}>
                    <View style={s.constructLeft}>
                      <View style={[s.constructDot, { backgroundColor: getTierColor(r.percentile) }]} />
                      <Text style={s.constructAbbr}>{getConstructAbbr(r.construct)}</Text>
                    </View>
                    <Text style={[s.constructPercent, { color: getTierColor(r.percentile) }]}>
                      {r.percentile}
                    </Text>
                  </View>
                ))}
              </View>
            ))}
          </View>

          {/* Center: Manager Quick-Start */}
          <View style={s.centerPanel}>
            <Text style={s.panelTitle}>MANAGER QUICK-START</Text>
            {hiringActions.map((item, i) => (
              <View key={i} style={s.actionItem}>
                <Text style={s.bullet}>•</Text>
                <Text style={s.actionText}>
                  <Text style={{ fontFamily: "Helvetica-Bold" }}>{item.title}: </Text>
                  {item.action}
                </Text>
              </View>
            ))}
          </View>

          {/* Right: Predictions */}
          <View style={s.rightPanel}>
            <Text style={s.panelTitle}>PREDICTIONS</Text>
            {predictions ? (
              <>
                <View style={s.predictionCard}>
                  <Text style={s.predLabel}>RAMP TIME</Text>
                  <Text style={[s.predValue, { color: NAVY }]}>
                    {predictions.rampTimeLabel}
                  </Text>
                </View>
                <View style={s.predictionCard}>
                  <Text style={s.predLabel}>SUPERVISION LOAD</Text>
                  <Text style={[s.predValue, { color: getRiskColor(predictions.supervisionLoad) }]}>
                    {predictions.supervisionLoad}
                  </Text>
                </View>
                <View style={s.predictionCard}>
                  <Text style={s.predLabel}>PERFORMANCE CEILING</Text>
                  <Text style={[s.predValue, { color: NAVY }]}>
                    {predictions.performanceCeiling}
                  </Text>
                </View>
                <View style={s.predictionCard}>
                  <Text style={s.predLabel}>ATTRITION RISK</Text>
                  <Text style={[s.predValue, { color: getRiskColor(predictions.attritionRisk) }]}>
                    {predictions.attritionRisk}
                  </Text>
                </View>
              </>
            ) : (
              <View style={s.predictionCard}>
                <Text style={{ fontSize: 8, color: MID_GRAY }}>
                  Predictions not yet available.
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* ── Bottom Strip: Interview Focus ── */}
        <View style={s.bottomStrip}>
          <Text style={s.bottomTitle}>INTERVIEW FOCUS</Text>
          <View style={s.interviewRow}>
            {bottom2.map((r) => (
              <View key={r.construct} style={s.interviewItem}>
                <View style={s.interviewAccent} />
                <View style={s.interviewContent}>
                  <Text style={s.interviewConstruct}>
                    {getConstructName(r.construct)} ({getConstructAbbr(r.construct)}) — {r.percentile}th
                  </Text>
                  <Text style={s.interviewQuestion}>
                    {INTERVIEW_QUESTIONS[r.construct] ?? "Explore how the candidate approaches situations requiring this capability."}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* ── Footer ── */}
        <View style={s.footer}>
          <Text style={s.footerText}>ACI — Arklight Cognitive Index | Confidential | Hiring Manager One-Pager</Text>
          <Text style={s.footerText}>{formatDate()}</Text>
        </View>
      </Page>
    </Document>
  );
}

export default PDFOnePager;

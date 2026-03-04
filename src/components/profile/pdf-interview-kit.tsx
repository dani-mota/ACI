import {
  Document,
  Page,
  View,
  Text,
  StyleSheet,
} from "@react-pdf/renderer";
import { CONSTRUCTS, LAYER_INFO, type LayerType, type ConstructMeta } from "@/lib/constructs";
import { INTERVIEW_QUESTIONS } from "./interview-guide";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SubtestResult {
  construct: string;
  layer: string;
  percentile: number;
}

interface RedFlag {
  severity: string;
  title: string;
  description: string;
}

export interface PDFInterviewKitProps {
  candidate: {
    firstName: string;
    lastName: string;
    status: string;
    primaryRole: { name: string; slug: string };
    assessment: {
      subtestResults: SubtestResult[];
      redFlags: RedFlag[];
    };
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

function getConstructName(key: string): string {
  return (CONSTRUCTS[key as keyof typeof CONSTRUCTS] as ConstructMeta | undefined)?.name ?? key.replace(/_/g, " ");
}

function getConstructAbbr(key: string): string {
  return (CONSTRUCTS[key as keyof typeof CONSTRUCTS] as ConstructMeta | undefined)?.abbreviation ?? key.slice(0, 2);
}

function getLayerColor(layer: string): string {
  return LAYER_INFO[layer as LayerType]?.color ?? MID_GRAY;
}

function getTierColor(percentile: number): string {
  if (percentile >= 90) return "#065F46";
  if (percentile >= 75) return GREEN;
  if (percentile >= 50) return MID_GRAY;
  if (percentile >= 25) return AMBER;
  return RED;
}

function formatDate(): string {
  return new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

// ---------------------------------------------------------------------------
// Stylesheet
// ---------------------------------------------------------------------------

const s = StyleSheet.create({
  page: {
    paddingTop: 60,
    paddingBottom: 50,
    paddingHorizontal: 36,
    fontFamily: "Helvetica",
    fontSize: 9,
    color: DARK_TEXT,
    backgroundColor: WHITE,
  },
  headerBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 44,
    backgroundColor: NAVY,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 36,
  },
  wordmark: {
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
    color: GOLD,
    letterSpacing: 3,
  },
  headerMeta: {
    fontSize: 8,
    color: WHITE,
    opacity: 0.85,
  },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 30,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 36,
    borderTopWidth: 1,
    borderTopColor: LIGHT_GRAY,
  },
  footerText: {
    fontSize: 7,
    color: MID_GRAY,
  },
  title: {
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
    color: NAVY,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: NAVY,
    marginBottom: 8,
    marginTop: 12,
  },
  timeBox: {
    backgroundColor: LIGHT_GRAY,
    borderRadius: 3,
    padding: 10,
    marginBottom: 12,
    flexDirection: "row",
    justifyContent: "space-around",
  },
  timeItem: {
    alignItems: "center",
  },
  timeValue: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    color: NAVY,
  },
  timeLabel: {
    fontSize: 7,
    color: MID_GRAY,
    marginTop: 2,
  },
  constructCard: {
    borderLeftWidth: 3,
    borderRadius: 3,
    padding: 10,
    marginBottom: 8,
    backgroundColor: LIGHT_GRAY,
  },
  constructHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  constructName: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: DARK_TEXT,
  },
  percentileText: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
  },
  questionText: {
    fontSize: 8.5,
    lineHeight: 1.5,
    color: DARK_TEXT,
    marginBottom: 4,
    paddingLeft: 8,
  },
  listenFor: {
    fontSize: 7.5,
    color: MID_GRAY,
    fontStyle: "italic",
    lineHeight: 1.4,
    marginTop: 4,
    paddingLeft: 8,
  },
  listenLabel: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: MID_GRAY,
    letterSpacing: 0.5,
    paddingLeft: 8,
  },
  flagCard: {
    borderLeftWidth: 3,
    borderRadius: 3,
    padding: 10,
    marginBottom: 6,
    backgroundColor: LIGHT_GRAY,
  },
  flagTitle: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: DARK_TEXT,
    marginBottom: 3,
  },
  flagDesc: {
    fontSize: 8,
    lineHeight: 1.5,
    color: DARK_TEXT,
  },
  notesSection: {
    marginTop: 14,
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
    paddingTop: 10,
  },
  notesLine: {
    borderBottomWidth: 0.5,
    borderBottomColor: "#E2E8F0",
    height: 22,
    marginBottom: 4,
  },
});

// ---------------------------------------------------------------------------
// Document
// ---------------------------------------------------------------------------

export function PDFInterviewKit({ candidate }: PDFInterviewKitProps) {
  const candidateName = `${candidate.firstName} ${candidate.lastName}`;
  const { assessment, primaryRole } = candidate;

  const sorted = [...assessment.subtestResults].sort((a, b) => a.percentile - b.percentile);
  const weakest = sorted.slice(0, 3);
  const strongest = sorted.slice(-2).reverse();
  const { redFlags } = assessment;

  return (
    <Document
      title={`ACI Interview Kit — ${candidateName}`}
      author="ACI Platform"
      subject={`Interview Preparation Kit for ${candidateName}`}
      creator="ACI — Arklight Cognitive Index"
    >
      {/* Page 1: Probe Areas + Validate Strengths */}
      <Page size="A4" style={s.page}>
        <View style={s.headerBar} fixed>
          <Text style={s.wordmark}>ACI</Text>
          <Text style={s.headerMeta}>{candidateName} · {primaryRole.name} · Interview Kit · {formatDate()}</Text>
        </View>

        <Text style={s.title}>Interview Preparation Kit</Text>

        {/* Time Allocation */}
        <View style={s.timeBox}>
          <View style={s.timeItem}>
            <Text style={s.timeValue}>15 min</Text>
            <Text style={s.timeLabel}>Probe Areas</Text>
          </View>
          <View style={s.timeItem}>
            <Text style={s.timeValue}>10 min</Text>
            <Text style={s.timeLabel}>Validate Strengths</Text>
          </View>
          <View style={s.timeItem}>
            <Text style={s.timeValue}>10 min</Text>
            <Text style={s.timeLabel}>Cultural Fit</Text>
          </View>
          <View style={s.timeItem}>
            <Text style={s.timeValue}>10 min</Text>
            <Text style={s.timeLabel}>Candidate Q&A</Text>
          </View>
        </View>

        {/* Probe Areas */}
        <Text style={s.sectionTitle}>Probe These Areas</Text>
        {weakest.map((r) => {
          const questions = INTERVIEW_QUESTIONS[r.construct];
          return (
            <View key={r.construct} style={[s.constructCard, { borderLeftColor: AMBER }]}>
              <View style={s.constructHeader}>
                <Text style={s.constructName}>
                  {getConstructName(r.construct)} ({getConstructAbbr(r.construct)})
                </Text>
                <Text style={[s.percentileText, { color: getTierColor(r.percentile) }]}>
                  {r.percentile}th percentile
                </Text>
              </View>
              {questions?.questions.map((q, i) => (
                <Text key={i} style={s.questionText}>Q{i + 1}. {q}</Text>
              ))}
              {questions && (
                <>
                  <Text style={s.listenLabel}>WHAT TO LISTEN FOR</Text>
                  <Text style={s.listenFor}>{questions.listenFor}</Text>
                </>
              )}
            </View>
          );
        })}

        {/* Validate Strengths */}
        <Text style={s.sectionTitle}>Validate Strengths</Text>
        {strongest.map((r) => {
          const questions = INTERVIEW_QUESTIONS[r.construct];
          return (
            <View key={r.construct} style={[s.constructCard, { borderLeftColor: GREEN }]}>
              <View style={s.constructHeader}>
                <Text style={s.constructName}>
                  {getConstructName(r.construct)} ({getConstructAbbr(r.construct)})
                </Text>
                <Text style={[s.percentileText, { color: getTierColor(r.percentile) }]}>
                  {r.percentile}th percentile
                </Text>
              </View>
              {questions?.questions.slice(0, 1).map((q, i) => (
                <Text key={i} style={s.questionText}>Q{i + 1}. {q}</Text>
              ))}
              {questions && (
                <>
                  <Text style={s.listenLabel}>WHAT TO LISTEN FOR</Text>
                  <Text style={s.listenFor}>{questions.listenFor}</Text>
                </>
              )}
            </View>
          );
        })}

        <View style={s.footer} fixed>
          <Text style={s.footerText}>ACI — Arklight Cognitive Index | Confidential</Text>
          <Text style={s.footerText} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>

      {/* Page 2: Red Flags + Notes */}
      <Page size="A4" style={s.page}>
        <View style={s.headerBar} fixed>
          <Text style={s.wordmark}>ACI</Text>
          <Text style={s.headerMeta}>{candidateName} · {primaryRole.name} · Interview Kit · {formatDate()}</Text>
        </View>

        {/* Red Flag Follow-ups */}
        <Text style={s.title}>Red Flag Follow-ups</Text>
        {redFlags.length === 0 ? (
          <View style={[s.constructCard, { borderLeftColor: GREEN }]}>
            <Text style={{ fontSize: 9, color: GREEN }}>
              No red flags identified. Proceed with standard interview flow.
            </Text>
          </View>
        ) : (
          redFlags.map((flag, i) => {
            const severityColor = flag.severity === "CRITICAL" ? RED : flag.severity === "WARNING" ? AMBER : MID_GRAY;
            return (
              <View key={i} style={[s.flagCard, { borderLeftColor: severityColor }]}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                  <Text style={s.flagTitle}>{flag.title}</Text>
                  <View style={{ backgroundColor: severityColor, paddingVertical: 2, paddingHorizontal: 6, borderRadius: 2 }}>
                    <Text style={{ fontSize: 7, fontFamily: "Helvetica-Bold", color: WHITE }}>{flag.severity}</Text>
                  </View>
                </View>
                <Text style={s.flagDesc}>{flag.description}</Text>
                <Text style={[s.questionText, { marginTop: 6 }]}>
                  Follow-up: Ask the candidate to describe a specific situation related to {flag.title.toLowerCase()}. Listen for self-awareness and corrective actions taken.
                </Text>
              </View>
            );
          })
        )}

        {/* Interview Notes Section */}
        <View style={s.notesSection}>
          <Text style={s.sectionTitle}>Interview Notes</Text>
          {Array.from({ length: 10 }).map((_, i) => (
            <View key={i} style={s.notesLine} />
          ))}
        </View>

        <View style={s.footer} fixed>
          <Text style={s.footerText}>ACI — Arklight Cognitive Index | Confidential</Text>
          <Text style={s.footerText} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}

export default PDFInterviewKit;

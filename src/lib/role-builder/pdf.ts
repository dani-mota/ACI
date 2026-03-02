import React from "react";
import { Document, Page, Text, View, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import type { ResearchRationale, GeneratedWeights } from "./pipeline";
import { CONSTRUCTS } from "@/lib/constructs";

const styles = StyleSheet.create({
  page: { padding: 48, fontFamily: "Helvetica", backgroundColor: "#ffffff" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 24, paddingBottom: 12, borderBottomWidth: 2, borderBottomColor: "#0F1729" },
  headerLeft: { flex: 1 },
  logoText: { fontSize: 18, fontWeight: "bold", color: "#0F1729" },
  subTitle: { fontSize: 9, color: "#64748B", marginTop: 2 },
  roleName: { fontSize: 22, fontWeight: "bold", color: "#0F1729", marginBottom: 4 },
  roleSubtitle: { fontSize: 11, color: "#64748B" },
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 13, fontWeight: "bold", color: "#0F1729", marginBottom: 8, paddingBottom: 4, borderBottomWidth: 1, borderBottomColor: "#E2E8F0" },
  bodyText: { fontSize: 10, color: "#334155", lineHeight: 1.6 },
  smallText: { fontSize: 9, color: "#64748B" },
  constructRow: { flexDirection: "row", alignItems: "center", marginBottom: 5 },
  constructName: { fontSize: 9, color: "#334155", width: 140 },
  barBg: { flex: 1, height: 8, backgroundColor: "#F1F5F9", borderRadius: 4 },
  barFill: { height: 8, borderRadius: 4 },
  weightLabel: { fontSize: 9, color: "#334155", width: 28, textAlign: "right" },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4, marginRight: 6 },
  badgeText: { fontSize: 8, fontWeight: "bold" },
  cutlineRow: { flexDirection: "row", marginBottom: 8 },
  cutlineLabel: { fontSize: 10, color: "#334155", width: 160 },
  cutlineValue: { fontSize: 10, fontWeight: "bold", color: "#0F1729" },
  footer: { position: "absolute", bottom: 32, left: 48, right: 48, flexDirection: "row", justifyContent: "space-between", borderTopWidth: 1, borderTopColor: "#E2E8F0", paddingTop: 8 },
  footerText: { fontSize: 8, color: "#94A3B8" },
  complianceBox: { backgroundColor: "#F8FAFC", borderWidth: 1, borderColor: "#E2E8F0", borderRadius: 4, padding: 10, marginTop: 8 },
  layerHeader: { fontSize: 10, fontWeight: "bold", color: "#64748B", marginTop: 10, marginBottom: 4 },
});

const LAYER_COLORS: Record<string, string> = {
  COGNITIVE_CORE: "#2563EB",
  TECHNICAL_APTITUDE: "#059669",
  BEHAVIORAL_INTEGRITY: "#D97706",
};

interface PDFRoleBriefProps {
  roleName: string;
  complexityLevel: string;
  closestTemplate: string;
  rationale: ResearchRationale;
  weights: GeneratedWeights;
  generatedAt: string;
}

function RoleBriefDocument({ roleName, complexityLevel, closestTemplate, rationale, weights, generatedAt }: PDFRoleBriefProps) {
  const sortedWeights = Object.entries(weights.weights).sort(([, a], [, b]) => b - a);
  const maxWeight = sortedWeights[0]?.[1] ?? 25;

  const layers: Record<string, string[]> = {
    COGNITIVE_CORE: ["FLUID_REASONING", "EXECUTIVE_CONTROL", "COGNITIVE_FLEXIBILITY", "METACOGNITIVE_CALIBRATION", "LEARNING_VELOCITY"],
    TECHNICAL_APTITUDE: ["SYSTEMS_DIAGNOSTICS", "PATTERN_RECOGNITION", "QUANTITATIVE_REASONING", "SPATIAL_VISUALIZATION", "MECHANICAL_REASONING"],
    BEHAVIORAL_INTEGRITY: ["PROCEDURAL_RELIABILITY", "ETHICAL_JUDGMENT"],
  };

  return React.createElement(
    Document,
    null,
    React.createElement(
      Page,
      { size: "LETTER", style: styles.page },
      // Header
      React.createElement(
        View,
        { style: styles.header },
        React.createElement(
          View,
          { style: styles.headerLeft },
          React.createElement(Text, { style: styles.logoText }, "ACI — Arklight Cognitive Index"),
          React.createElement(Text, { style: styles.subTitle }, "Role Research Brief  ·  Confidential")
        )
      ),
      // Role name + meta
      React.createElement(
        View,
        { style: { marginBottom: 20 } },
        React.createElement(Text, { style: styles.roleName }, roleName),
        React.createElement(Text, { style: styles.roleSubtitle },
          `Complexity: ${complexityLevel.replace("_", " ")}  ·  Closest Template: ${closestTemplate.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}  ·  Generated: ${generatedAt}`
        )
      ),
      // Summary
      React.createElement(
        View,
        { style: styles.section },
        React.createElement(Text, { style: styles.sectionTitle }, "Role Summary"),
        React.createElement(Text, { style: styles.bodyText }, rationale.summary),
        React.createElement(Text, { style: { ...styles.bodyText, marginTop: 6 } }, rationale.complexityExplanation)
      ),
      // Construct Weights
      React.createElement(
        View,
        { style: styles.section },
        React.createElement(Text, { style: styles.sectionTitle }, "Construct Weight Profile"),
        ...Object.entries(layers).map(([layerKey, constructs]) =>
          React.createElement(
            View,
            { key: layerKey },
            React.createElement(Text, { style: { ...styles.layerHeader, color: LAYER_COLORS[layerKey] } },
              layerKey.replace("_", " ")
            ),
            ...constructs.map((constructId) => {
              const w = weights.weights[constructId] ?? 0;
              const barWidth = (w / maxWeight) * 100;
              const meta = CONSTRUCTS[constructId];
              return React.createElement(
                View,
                { key: constructId, style: styles.constructRow },
                React.createElement(Text, { style: styles.constructName }, meta?.name ?? constructId),
                React.createElement(
                  View,
                  { style: styles.barBg },
                  React.createElement(View, { style: { ...styles.barFill, width: `${barWidth}%`, backgroundColor: LAYER_COLORS[layerKey] } })
                ),
                React.createElement(Text, { style: styles.weightLabel }, `${w}%`)
              );
            })
          )
        )
      ),
      // Cutlines
      React.createElement(
        View,
        { style: styles.section },
        React.createElement(Text, { style: styles.sectionTitle }, "Cutline Thresholds"),
        React.createElement(
          View,
          { style: styles.cutlineRow },
          React.createElement(Text, { style: styles.cutlineLabel }, "Technical Aptitude (Layer 2 Avg)"),
          React.createElement(Text, { style: styles.cutlineValue }, `≥ ${weights.cutlines.technicalAptitude}th percentile`)
        ),
        React.createElement(
          View,
          { style: styles.cutlineRow },
          React.createElement(Text, { style: styles.cutlineLabel }, "Behavioral Integrity (Layer 3 Avg)"),
          React.createElement(Text, { style: styles.cutlineValue }, `≥ ${weights.cutlines.behavioralIntegrity}th percentile`)
        ),
        React.createElement(
          View,
          { style: styles.cutlineRow },
          React.createElement(Text, { style: styles.cutlineLabel }, "Learning Velocity"),
          React.createElement(Text, { style: styles.cutlineValue }, `≥ ${weights.cutlines.learningVelocity}th percentile`)
        ),
        React.createElement(Text, { style: { ...styles.bodyText, marginTop: 8 } }, rationale.cutlineRationale)
      ),
      // Top construct rationales
      rationale.topConstructRationales.length > 0
        ? React.createElement(
            View,
            { style: styles.section },
            React.createElement(Text, { style: styles.sectionTitle }, "Weight Rationale — Top Constructs"),
            ...rationale.topConstructRationales.slice(0, 5).map((item) =>
              React.createElement(
                View,
                { key: item.construct, style: { marginBottom: 10 } },
                React.createElement(Text, { style: { fontSize: 10, fontWeight: "bold", color: "#0F1729", marginBottom: 3 } },
                  CONSTRUCTS[item.construct]?.name ?? item.construct
                ),
                React.createElement(Text, { style: styles.bodyText }, item.rationale)
              )
            )
          )
        : null,
      // Template comparison
      React.createElement(
        View,
        { style: styles.section },
        React.createElement(Text, { style: styles.sectionTitle }, "Comparison to ACI Default Profiles"),
        React.createElement(Text, { style: styles.bodyText }, rationale.templateComparison)
      ),
      // Compliance note
      React.createElement(
        View,
        { style: styles.complianceBox },
        React.createElement(Text, { style: { ...styles.smallText, fontWeight: "bold", marginBottom: 4 } }, "Compliance Notice"),
        React.createElement(Text, { style: styles.smallText }, rationale.complianceNote)
      ),
      // Footer
      React.createElement(
        View,
        { style: styles.footer },
        React.createElement(Text, { style: styles.footerText }, "ACI — Arklight Cognitive Index  ·  Confidential"),
        React.createElement(Text, { style: styles.footerText }, `Generated ${generatedAt}`)
      )
    )
  );
}

export async function generateRoleBriefPDF(props: PDFRoleBriefProps): Promise<Buffer> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const element = React.createElement(RoleBriefDocument, props) as any;
  const buffer = await renderToBuffer(element);
  return Buffer.from(buffer);
}

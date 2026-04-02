// ──────────────────────────────────────────────
// Mission Planner — Mock Mission Data
// ──────────────────────────────────────────────

import type { Mission, MissionPhase, CognitiveDemand, ConstructId } from "./types";
import { CONSTRUCT_IDS } from "./types";
import type { TutorialIndustry } from "@/stores/app-store";

// ── Helpers ─────────────────────────────────────

/** Shorthand to build a demand map from sparse critical/high/moderate specs */
function demands(
  spec: { critical?: ConstructId[]; high?: ConstructId[]; moderate?: ConstructId[] }
): Record<ConstructId, CognitiveDemand> {
  const map = {} as Record<ConstructId, CognitiveDemand>;
  for (const cid of CONSTRUCT_IDS) map[cid] = "low";
  for (const cid of spec.critical ?? []) map[cid] = "critical";
  for (const cid of spec.high ?? []) map[cid] = "high";
  for (const cid of spec.moderate ?? []) map[cid] = "moderate";
  return map;
}

// ──────────────────────────────────────────────
// Dashboard Mock Missions (authenticated mode)
// ──────────────────────────────────────────────

export const MOCK_MISSIONS: Mission[] = [
  {
    id: "mission-cerberus",
    name: "Project Cerberus",
    codename: "CERBERUS",
    description: "Build an autonomous threat detection platform that fuses satellite imagery, SIGINT, and HUMINT into a unified threat picture. 18-month timeline. ITAR compliance. Novel ML + air-gapped deployment + 3 legacy DoD integrations.",
    totalMonths: 18,
    status: "planning",
    assembledTeamIds: [],
    phases: [
      {
        id: "cerb-p1", name: "Discovery & Architecture", description: "Novel problem space exploration, system design decisions, domain immersion",
        startMonth: 1, endMonth: 4,
        demands: demands({
          critical: ["FLUID_REASONING", "ARCHITECTURAL_REASONING"],
          high: ["DOMAIN_FLUENCY", "METACOGNITIVE_AWARENESS"],
          moderate: ["COLLABORATIVE_CAPACITY", "SYSTEM_DIAGNOSTICS"],
        }),
      },
      {
        id: "cerb-p2", name: "Core Development", description: "Heavy build phase — ML pipelines, data ingestion, UI, concurrent subsystems",
        startMonth: 5, endMonth: 10,
        demands: demands({
          critical: ["TOOL_PROFICIENCY", "WORKING_MEMORY"],
          high: ["SYSTEM_DIAGNOSTICS", "PROCESSING_SPEED", "ARCHITECTURAL_REASONING"],
          moderate: ["COLLABORATIVE_CAPACITY", "DOMAIN_FLUENCY", "FLUID_REASONING"],
        }),
      },
      {
        id: "cerb-p3", name: "Hardening & Compliance", description: "ITAR compliance, air-gap deployment, fault finding, edge case coverage",
        startMonth: 11, endMonth: 15,
        demands: demands({
          critical: ["PROCEDURAL_RELIABILITY", "SYSTEM_DIAGNOSTICS", "METACOGNITIVE_AWARENESS"],
          high: ["ADAPTIVE_RESILIENCE", "DOMAIN_FLUENCY"],
          moderate: ["TOOL_PROFICIENCY", "WORKING_MEMORY"],
        }),
      },
      {
        id: "cerb-p4", name: "Deployment & Handoff", description: "Operator training, knowledge transfer, production support, runbook authoring",
        startMonth: 16, endMonth: 18,
        demands: demands({
          critical: ["COLLABORATIVE_CAPACITY", "LEADERSHIP_DISPOSITION"],
          high: ["ADAPTIVE_RESILIENCE", "PROCEDURAL_RELIABILITY", "DOMAIN_FLUENCY"],
          moderate: ["METACOGNITIVE_AWARENESS"],
        }),
      },
    ],
  },
  {
    id: "mission-phoenix",
    name: "Project Phoenix",
    codename: "PHOENIX",
    description: "Migrate a 12-year-old monolithic ERP system to microservices architecture while maintaining 99.95% uptime for 2,000 active users. Zero-downtime cutover required.",
    totalMonths: 14,
    status: "planning",
    assembledTeamIds: [],
    phases: [
      {
        id: "phx-p1", name: "System Archaeology", description: "Map the existing monolith — dependencies, data flows, undocumented behaviors",
        startMonth: 1, endMonth: 3,
        demands: demands({
          critical: ["SYSTEM_DIAGNOSTICS", "METACOGNITIVE_AWARENESS"],
          high: ["ARCHITECTURAL_REASONING", "DOMAIN_FLUENCY", "FLUID_REASONING"],
          moderate: ["PROCEDURAL_RELIABILITY", "WORKING_MEMORY"],
        }),
      },
      {
        id: "phx-p2", name: "Strangler Fig Migration", description: "Incrementally extract services. Dual-write patterns. Feature flags. Traffic splitting.",
        startMonth: 4, endMonth: 9,
        demands: demands({
          critical: ["ARCHITECTURAL_REASONING", "TOOL_PROFICIENCY", "PROCEDURAL_RELIABILITY"],
          high: ["SYSTEM_DIAGNOSTICS", "WORKING_MEMORY", "PROCESSING_SPEED"],
          moderate: ["ADAPTIVE_RESILIENCE", "COLLABORATIVE_CAPACITY"],
        }),
      },
      {
        id: "phx-p3", name: "Cutover & Stabilization", description: "Zero-downtime switch, canary deployments, runback procedures, 24/7 war room",
        startMonth: 10, endMonth: 14,
        demands: demands({
          critical: ["ADAPTIVE_RESILIENCE", "COLLABORATIVE_CAPACITY", "PROCEDURAL_RELIABILITY"],
          high: ["SYSTEM_DIAGNOSTICS", "LEADERSHIP_DISPOSITION", "METACOGNITIVE_AWARENESS"],
          moderate: ["PROCESSING_SPEED", "TOOL_PROFICIENCY"],
        }),
      },
    ],
  },
];

// ──────────────────────────────────────────────
// Tutorial Industry Missions
// ──────────────────────────────────────────────

const DEFENSE_MISSIONS: Mission[] = [
  {
    id: "def-mission-trident",
    name: "Project Trident",
    codename: "TRIDENT",
    description: "Design and qualify a next-generation precision guidance assembly for hypersonic vehicle integration. AS9100 compliance, MIL-STD-810 environmental testing, 24-month LRIP-to-FRP pipeline.",
    totalMonths: 24,
    status: "active",
    assembledTeamIds: [],
    phases: [
      {
        id: "tri-p1", name: "Design & Prototyping", description: "GD&T definition, tolerance stackup analysis, rapid prototype iteration with DFM constraints",
        startMonth: 1, endMonth: 6,
        demands: demands({
          critical: ["ARCHITECTURAL_REASONING", "DOMAIN_FLUENCY"],
          high: ["FLUID_REASONING", "TOOL_PROFICIENCY", "SYSTEM_DIAGNOSTICS"],
          moderate: ["METACOGNITIVE_AWARENESS", "COLLABORATIVE_CAPACITY"],
        }),
      },
      {
        id: "tri-p2", name: "First Article & Qualification", description: "FAI execution, destructive/non-destructive testing, AS9102 documentation, PPAP submission",
        startMonth: 7, endMonth: 14,
        demands: demands({
          critical: ["PROCEDURAL_RELIABILITY", "SYSTEM_DIAGNOSTICS", "METACOGNITIVE_AWARENESS"],
          high: ["DOMAIN_FLUENCY", "TOOL_PROFICIENCY"],
          moderate: ["ADAPTIVE_RESILIENCE", "WORKING_MEMORY", "COLLABORATIVE_CAPACITY"],
        }),
      },
      {
        id: "tri-p3", name: "LRIP Production", description: "Low-rate initial production, SPC implementation, yield optimization, operator training",
        startMonth: 15, endMonth: 20,
        demands: demands({
          critical: ["PROCEDURAL_RELIABILITY", "TOOL_PROFICIENCY"],
          high: ["PROCESSING_SPEED", "COLLABORATIVE_CAPACITY", "SYSTEM_DIAGNOSTICS"],
          moderate: ["LEADERSHIP_DISPOSITION", "ADAPTIVE_RESILIENCE", "METACOGNITIVE_AWARENESS"],
        }),
      },
      {
        id: "tri-p4", name: "FRP Transition & Handoff", description: "Full-rate production ramp, process transfer to production floor, continuous improvement handoff",
        startMonth: 21, endMonth: 24,
        demands: demands({
          critical: ["COLLABORATIVE_CAPACITY", "LEADERSHIP_DISPOSITION", "PROCEDURAL_RELIABILITY"],
          high: ["ADAPTIVE_RESILIENCE", "DOMAIN_FLUENCY"],
          moderate: ["METACOGNITIVE_AWARENESS", "PROCESSING_SPEED"],
        }),
      },
    ],
  },
];

const SPACE_MISSIONS: Mission[] = [
  {
    id: "space-mission-horizon",
    name: "Horizon LEO Constellation",
    codename: "HORIZON",
    description: "Deploy a 48-satellite LEO communications constellation with inter-satellite laser links. Radiation-hardened avionics, autonomous orbit management, ground segment integration. 30-month development cycle.",
    totalMonths: 30,
    status: "planning",
    assembledTeamIds: [],
    phases: [
      {
        id: "hor-p1", name: "Architecture & Link Budget", description: "Constellation geometry, RF/optical link budgets, orbit mechanics, ground segment architecture",
        startMonth: 1, endMonth: 6,
        demands: demands({
          critical: ["ARCHITECTURAL_REASONING", "FLUID_REASONING", "DOMAIN_FLUENCY"],
          high: ["SYSTEM_DIAGNOSTICS", "METACOGNITIVE_AWARENESS"],
          moderate: ["WORKING_MEMORY", "COLLABORATIVE_CAPACITY"],
        }),
      },
      {
        id: "hor-p2", name: "Subsystem Development", description: "Avionics boards, propulsion modules, optical terminals, flight software, ground control software",
        startMonth: 7, endMonth: 16,
        demands: demands({
          critical: ["TOOL_PROFICIENCY", "SYSTEM_DIAGNOSTICS", "WORKING_MEMORY"],
          high: ["DOMAIN_FLUENCY", "PROCESSING_SPEED", "ARCHITECTURAL_REASONING"],
          moderate: ["COLLABORATIVE_CAPACITY", "PROCEDURAL_RELIABILITY"],
        }),
      },
      {
        id: "hor-p3", name: "Integration & Environmental Test", description: "Satellite AIT, thermal vacuum, vibration, EMC/EMI, radiation lot acceptance",
        startMonth: 17, endMonth: 24,
        demands: demands({
          critical: ["PROCEDURAL_RELIABILITY", "SYSTEM_DIAGNOSTICS", "METACOGNITIVE_AWARENESS"],
          high: ["ADAPTIVE_RESILIENCE", "DOMAIN_FLUENCY", "TOOL_PROFICIENCY"],
          moderate: ["COLLABORATIVE_CAPACITY", "WORKING_MEMORY"],
        }),
      },
      {
        id: "hor-p4", name: "Launch Campaign & Commissioning", description: "Launch manifest coordination, deployment sequence, on-orbit checkout, constellation activation",
        startMonth: 25, endMonth: 30,
        demands: demands({
          critical: ["COLLABORATIVE_CAPACITY", "ADAPTIVE_RESILIENCE", "LEADERSHIP_DISPOSITION"],
          high: ["PROCEDURAL_RELIABILITY", "SYSTEM_DIAGNOSTICS", "METACOGNITIVE_AWARENESS"],
          moderate: ["PROCESSING_SPEED", "DOMAIN_FLUENCY"],
        }),
      },
    ],
  },
];

const HARDWARE_AI_MISSIONS: Mission[] = [
  {
    id: "hw-mission-atlas",
    name: "Project Atlas",
    codename: "ATLAS",
    description: "Build an autonomous mobile manipulation platform — perception, planning, and control for warehouse fulfillment. Custom ASIC for on-device inference, ROS2 stack, sim-to-real transfer, 20-month hardware+software co-development.",
    totalMonths: 20,
    status: "planning",
    assembledTeamIds: [],
    phases: [
      {
        id: "atl-p1", name: "Sensing & Perception", description: "Sensor suite selection, 3D perception pipeline, object detection/segmentation, calibration framework",
        startMonth: 1, endMonth: 5,
        demands: demands({
          critical: ["FLUID_REASONING", "DOMAIN_FLUENCY", "ARCHITECTURAL_REASONING"],
          high: ["TOOL_PROFICIENCY", "WORKING_MEMORY"],
          moderate: ["SYSTEM_DIAGNOSTICS", "METACOGNITIVE_AWARENESS"],
        }),
      },
      {
        id: "atl-p2", name: "Motion Planning & Control", description: "Manipulation planning, motion primitives, force control, sim-to-real transfer, safety constraints",
        startMonth: 6, endMonth: 11,
        demands: demands({
          critical: ["FLUID_REASONING", "SYSTEM_DIAGNOSTICS", "WORKING_MEMORY"],
          high: ["TOOL_PROFICIENCY", "ARCHITECTURAL_REASONING", "DOMAIN_FLUENCY"],
          moderate: ["ADAPTIVE_RESILIENCE", "PROCESSING_SPEED"],
        }),
      },
      {
        id: "atl-p3", name: "Hardware Integration", description: "ASIC bringup, firmware, thermal management, power budget, mechanical integration, safety certification",
        startMonth: 12, endMonth: 17,
        demands: demands({
          critical: ["SYSTEM_DIAGNOSTICS", "PROCEDURAL_RELIABILITY", "TOOL_PROFICIENCY"],
          high: ["ADAPTIVE_RESILIENCE", "METACOGNITIVE_AWARENESS", "DOMAIN_FLUENCY"],
          moderate: ["COLLABORATIVE_CAPACITY", "WORKING_MEMORY"],
        }),
      },
      {
        id: "atl-p4", name: "Field Trials & Deployment", description: "Warehouse pilot, operator training, edge case triage, fleet management software, scaling plan",
        startMonth: 18, endMonth: 20,
        demands: demands({
          critical: ["ADAPTIVE_RESILIENCE", "COLLABORATIVE_CAPACITY", "LEADERSHIP_DISPOSITION"],
          high: ["PROCEDURAL_RELIABILITY", "SYSTEM_DIAGNOSTICS", "METACOGNITIVE_AWARENESS"],
          moderate: ["PROCESSING_SPEED", "DOMAIN_FLUENCY"],
        }),
      },
    ],
  },
];

const AI_SOFTWARE_MISSIONS: Mission[] = [
  {
    id: "ai-mission-nova",
    name: "Project Nova",
    codename: "NOVA",
    description: "Build an enterprise AI copilot platform — multi-model orchestration, RAG pipeline, custom fine-tuning infrastructure, SOC2 compliance, multi-tenant deployment. Ship v1 in 12 months, scale to 500 enterprise customers.",
    totalMonths: 12,
    status: "active",
    assembledTeamIds: [],
    phases: [
      {
        id: "nova-p1", name: "Foundation & RAG Pipeline", description: "Embedding pipeline, vector store, retrieval chain, model router, evaluation framework",
        startMonth: 1, endMonth: 3,
        demands: demands({
          critical: ["ARCHITECTURAL_REASONING", "FLUID_REASONING"],
          high: ["DOMAIN_FLUENCY", "TOOL_PROFICIENCY", "WORKING_MEMORY"],
          moderate: ["METACOGNITIVE_AWARENESS", "SYSTEM_DIAGNOSTICS"],
        }),
      },
      {
        id: "nova-p2", name: "Product Build & Fine-tuning Infra", description: "User-facing product, fine-tuning pipeline, prompt management, observability, multi-model support",
        startMonth: 4, endMonth: 7,
        demands: demands({
          critical: ["TOOL_PROFICIENCY", "PROCESSING_SPEED", "WORKING_MEMORY"],
          high: ["ARCHITECTURAL_REASONING", "COLLABORATIVE_CAPACITY", "DOMAIN_FLUENCY"],
          moderate: ["FLUID_REASONING", "SYSTEM_DIAGNOSTICS"],
        }),
      },
      {
        id: "nova-p3", name: "Enterprise Hardening", description: "SOC2 compliance, multi-tenancy isolation, audit logging, SSO/SCIM, rate limiting, data residency",
        startMonth: 8, endMonth: 10,
        demands: demands({
          critical: ["PROCEDURAL_RELIABILITY", "SYSTEM_DIAGNOSTICS", "METACOGNITIVE_AWARENESS"],
          high: ["ADAPTIVE_RESILIENCE", "ARCHITECTURAL_REASONING"],
          moderate: ["COLLABORATIVE_CAPACITY", "DOMAIN_FLUENCY", "TOOL_PROFICIENCY"],
        }),
      },
      {
        id: "nova-p4", name: "Scale & Customer Success", description: "Performance optimization, customer onboarding playbook, support tooling, usage analytics, upsell triggers",
        startMonth: 11, endMonth: 12,
        demands: demands({
          critical: ["COLLABORATIVE_CAPACITY", "LEADERSHIP_DISPOSITION", "ADAPTIVE_RESILIENCE"],
          high: ["PROCESSING_SPEED", "METACOGNITIVE_AWARENESS"],
          moderate: ["SYSTEM_DIAGNOSTICS", "PROCEDURAL_RELIABILITY", "DOMAIN_FLUENCY"],
        }),
      },
    ],
  },
];

// ──────────────────────────────────────────────
// Exports
// ──────────────────────────────────────────────

const INDUSTRY_MISSIONS: Record<TutorialIndustry, Mission[]> = {
  "defense-manufacturing": DEFENSE_MISSIONS,
  "space-satellite": SPACE_MISSIONS,
  "hardware-ai": HARDWARE_AI_MISSIONS,
  "ai-software": AI_SOFTWARE_MISSIONS,
};

export function getMissions(industry: TutorialIndustry | null): Mission[] {
  return INDUSTRY_MISSIONS[industry ?? "defense-manufacturing"];
}

export function getMockMissions(): Mission[] {
  return MOCK_MISSIONS;
}

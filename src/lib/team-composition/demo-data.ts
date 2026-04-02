// ──────────────────────────────────────────────
// Team Composition — Industry-Specific Demo Data
// ──────────────────────────────────────────────
//
// Four demo datasets, one per tutorial industry.
// Each has 3 teams, 5-7 members each, 8-12 candidates.

import type { IndividualProfile, Team, ConstructVector, MissionType } from "./types";
import type { TutorialIndustry } from "@/stores/app-store";

// ── Helpers ─────────────────────────────────────

function seededRandom(seed: string): () => number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = ((h << 5) - h + seed.charCodeAt(i)) | 0;
  }
  return () => {
    h = (h * 16807) % 2147483647;
    return (h & 0x7fffffff) / 2147483647;
  };
}

function gaussian(rng: () => number, mean: number, sd: number): number {
  const u1 = rng();
  const u2 = rng();
  const z = Math.sqrt(-2 * Math.log(u1 || 0.001)) * Math.cos(2 * Math.PI * u2);
  return Math.round(Math.max(15, Math.min(98, mean + z * sd)));
}

function makeProfile(
  id: string,
  name: string,
  role: string,
  department: string,
  teamId: string,
  type: "candidate" | "internal",
  base: Partial<ConstructVector>,
  seed: string,
): IndividualProfile {
  const rng = seededRandom(seed);
  const d = 60;
  const s = 11;
  const scores: ConstructVector = {
    PROCEDURAL_RELIABILITY: gaussian(rng, base.PROCEDURAL_RELIABILITY ?? d, s),
    COLLABORATIVE_CAPACITY: gaussian(rng, base.COLLABORATIVE_CAPACITY ?? d, s),
    ADAPTIVE_RESILIENCE: gaussian(rng, base.ADAPTIVE_RESILIENCE ?? d, s),
    LEADERSHIP_DISPOSITION: gaussian(rng, base.LEADERSHIP_DISPOSITION ?? d, s),
    SYSTEM_DIAGNOSTICS: gaussian(rng, base.SYSTEM_DIAGNOSTICS ?? d, s),
    DOMAIN_FLUENCY: gaussian(rng, base.DOMAIN_FLUENCY ?? d, s),
    TOOL_PROFICIENCY: gaussian(rng, base.TOOL_PROFICIENCY ?? d, s),
    ARCHITECTURAL_REASONING: gaussian(rng, base.ARCHITECTURAL_REASONING ?? d, s),
    FLUID_REASONING: gaussian(rng, base.FLUID_REASONING ?? d, s),
    WORKING_MEMORY: gaussian(rng, base.WORKING_MEMORY ?? d, s),
    PROCESSING_SPEED: gaussian(rng, base.PROCESSING_SPEED ?? d, s),
    METACOGNITIVE_AWARENESS: gaussian(rng, base.METACOGNITIVE_AWARENESS ?? d, s),
  };
  return {
    id, name, role, department, teamId,
    assessmentDate: "2026-03-20",
    assessmentType: type,
    scores,
    avatarSeed: name.replace(/\s/g, "").toLowerCase(),
  };
}

interface DemoDataset {
  teams: Team[];
  profiles: Record<string, IndividualProfile>;
  getMembers: (team: Team) => IndividualProfile[];
  getCandidates: (team: Team) => IndividualProfile[];
}

function buildDataset(
  teamDefs: Array<{
    id: string;
    name: string;
    department: string;
    missionType: MissionType;
    members: Array<{ id: string; name: string; role: string; base: Partial<ConstructVector> }>;
    candidateIds: string[];
  }>,
  candidateDefs: Array<{ id: string; name: string; role: string; base: Partial<ConstructVector> }>,
  industryPrefix: string,
): DemoDataset {
  const allProfiles: IndividualProfile[] = [];

  const teams: Team[] = teamDefs.map((td) => {
    const members = td.members.map((m) =>
      makeProfile(m.id, m.name, m.role, td.department, td.id, "internal", m.base, `${industryPrefix}-${m.id}`)
    );
    allProfiles.push(...members);
    return {
      id: td.id,
      name: td.name,
      department: td.department,
      missionType: td.missionType,
      memberIds: td.members.map((m) => m.id),
      candidateIds: td.candidateIds,
    };
  });

  const candidates = candidateDefs.map((c) =>
    makeProfile(c.id, c.name, c.role, "Candidates", "none", "candidate", c.base, `${industryPrefix}-${c.id}`)
  );
  allProfiles.push(...candidates);

  const profiles = Object.fromEntries(allProfiles.map((p) => [p.id, p]));

  return {
    teams,
    profiles,
    getMembers: (team) => team.memberIds.map((id) => profiles[id]).filter(Boolean),
    getCandidates: (team) => team.candidateIds.map((id) => profiles[id]).filter(Boolean),
  };
}

// ════════════════════════════════════════════════
// 1. DEFENSE & AEROSPACE MANUFACTURING
// ════════════════════════════════════════════════

const defenseData = buildDataset(
  [
    {
      id: "def-precision", name: "Precision Cell", department: "Manufacturing Floor", missionType: "safety_critical_embedded",
      members: [
        { id: "def-m1", name: "Marcus Reeves", role: "Lead CNC Machinist", base: { PROCEDURAL_RELIABILITY: 92, SYSTEM_DIAGNOSTICS: 85, METACOGNITIVE_AWARENESS: 82, TOOL_PROFICIENCY: 90, DOMAIN_FLUENCY: 88, COLLABORATIVE_CAPACITY: 55, LEADERSHIP_DISPOSITION: 65 } },
        { id: "def-m2", name: "Linda Cho", role: "Quality Inspector", base: { PROCEDURAL_RELIABILITY: 95, METACOGNITIVE_AWARENESS: 88, SYSTEM_DIAGNOSTICS: 80, FLUID_REASONING: 85, COLLABORATIVE_CAPACITY: 62, LEADERSHIP_DISPOSITION: 45 } },
        { id: "def-m3", name: "Dave Kowalski", role: "CNC Programmer", base: { TOOL_PROFICIENCY: 92, DOMAIN_FLUENCY: 85, ARCHITECTURAL_REASONING: 78, PROCEDURAL_RELIABILITY: 82, SYSTEM_DIAGNOSTICS: 75, COLLABORATIVE_CAPACITY: 58 } },
        { id: "def-m4", name: "Rosa Martinez", role: "Manufacturing Technician", base: { PROCEDURAL_RELIABILITY: 88, TOOL_PROFICIENCY: 82, PROCESSING_SPEED: 78, ADAPTIVE_RESILIENCE: 72, COLLABORATIVE_CAPACITY: 70, METACOGNITIVE_AWARENESS: 65 } },
        { id: "def-m5", name: "James Wright", role: "Junior Machinist", base: { TOOL_PROFICIENCY: 68, DOMAIN_FLUENCY: 58, PROCEDURAL_RELIABILITY: 72, PROCESSING_SPEED: 75, COLLABORATIVE_CAPACITY: 78, METACOGNITIVE_AWARENESS: 70 } },
      ],
      candidateIds: ["def-c1", "def-c2", "def-c3", "def-c4", "def-c5", "def-c6"],
    },
    {
      id: "def-engineering", name: "Process Engineering", department: "Engineering", missionType: "platform_infrastructure",
      members: [
        { id: "def-e1", name: "Sarah Chen", role: "Senior Process Engineer", base: { ARCHITECTURAL_REASONING: 88, SYSTEM_DIAGNOSTICS: 90, DOMAIN_FLUENCY: 85, FLUID_REASONING: 82, METACOGNITIVE_AWARENESS: 80, LEADERSHIP_DISPOSITION: 72 } },
        { id: "def-e2", name: "Mike Torres", role: "Manufacturing Engineer", base: { TOOL_PROFICIENCY: 85, SYSTEM_DIAGNOSTICS: 82, DOMAIN_FLUENCY: 80, ARCHITECTURAL_REASONING: 75, PROCEDURAL_RELIABILITY: 78, COLLABORATIVE_CAPACITY: 70 } },
        { id: "def-e3", name: "Anika Patel", role: "Quality Systems Engineer", base: { PROCEDURAL_RELIABILITY: 90, METACOGNITIVE_AWARENESS: 85, SYSTEM_DIAGNOSTICS: 78, COLLABORATIVE_CAPACITY: 82, DOMAIN_FLUENCY: 75, LEADERSHIP_DISPOSITION: 62 } },
        { id: "def-e4", name: "Tom Henderson", role: "Automation Engineer", base: { TOOL_PROFICIENCY: 88, ARCHITECTURAL_REASONING: 82, SYSTEM_DIAGNOSTICS: 80, FLUID_REASONING: 78, PROCESSING_SPEED: 75, COLLABORATIVE_CAPACITY: 55 } },
        { id: "def-e5", name: "Grace Kim", role: "Junior Engineer", base: { FLUID_REASONING: 75, METACOGNITIVE_AWARENESS: 78, WORKING_MEMORY: 72, DOMAIN_FLUENCY: 58, TOOL_PROFICIENCY: 65, COLLABORATIVE_CAPACITY: 80 } },
        { id: "def-e6", name: "Omar Hassan", role: "Tooling Engineer", base: { TOOL_PROFICIENCY: 90, DOMAIN_FLUENCY: 82, SYSTEM_DIAGNOSTICS: 72, PROCEDURAL_RELIABILITY: 80, WORKING_MEMORY: 85, COLLABORATIVE_CAPACITY: 60 } },
      ],
      candidateIds: ["def-c1", "def-c3", "def-c5", "def-c6", "def-c7", "def-c8"],
    },
    {
      id: "def-test", name: "Test & Evaluation", department: "T&E", missionType: "safety_critical_embedded",
      members: [
        { id: "def-t1", name: "Col. Ray Brooks", role: "T&E Director", base: { LEADERSHIP_DISPOSITION: 90, PROCEDURAL_RELIABILITY: 88, METACOGNITIVE_AWARENESS: 85, COLLABORATIVE_CAPACITY: 82, SYSTEM_DIAGNOSTICS: 78, DOMAIN_FLUENCY: 80 } },
        { id: "def-t2", name: "Karen Sullivan", role: "Senior Test Engineer", base: { SYSTEM_DIAGNOSTICS: 90, PROCEDURAL_RELIABILITY: 88, METACOGNITIVE_AWARENESS: 82, DOMAIN_FLUENCY: 85, TOOL_PROFICIENCY: 78, FLUID_REASONING: 75 } },
        { id: "def-t3", name: "Victor Reyes", role: "Test Technician", base: { TOOL_PROFICIENCY: 82, PROCEDURAL_RELIABILITY: 85, PROCESSING_SPEED: 80, SYSTEM_DIAGNOSTICS: 72, COLLABORATIVE_CAPACITY: 75, ADAPTIVE_RESILIENCE: 70 } },
        { id: "def-t4", name: "Diana Foster", role: "Data Analyst", base: { FLUID_REASONING: 82, WORKING_MEMORY: 85, PROCESSING_SPEED: 80, METACOGNITIVE_AWARENESS: 78, TOOL_PROFICIENCY: 75, DOMAIN_FLUENCY: 68 } },
        { id: "def-t5", name: "Nathan Park", role: "Environmental Test Eng", base: { DOMAIN_FLUENCY: 85, SYSTEM_DIAGNOSTICS: 82, PROCEDURAL_RELIABILITY: 80, TOOL_PROFICIENCY: 78, ADAPTIVE_RESILIENCE: 75, COLLABORATIVE_CAPACITY: 65 } },
      ],
      candidateIds: ["def-c2", "def-c4", "def-c5", "def-c7", "def-c8"],
    },
  ],
  [
    { id: "def-c1", name: "Elena Torres", role: "Experienced Machinist", base: { TOOL_PROFICIENCY: 88, PROCEDURAL_RELIABILITY: 85, DOMAIN_FLUENCY: 82, PROCESSING_SPEED: 80, SYSTEM_DIAGNOSTICS: 72, COLLABORATIVE_CAPACITY: 65 } },
    { id: "def-c2", name: "Derek Washington", role: "Production Supervisor", base: { LEADERSHIP_DISPOSITION: 90, COLLABORATIVE_CAPACITY: 88, PROCEDURAL_RELIABILITY: 78, ADAPTIVE_RESILIENCE: 82, SYSTEM_DIAGNOSTICS: 65, TOOL_PROFICIENCY: 60 } },
    { id: "def-c3", name: "Yuki Tanaka", role: "Precision Grinder", base: { PROCEDURAL_RELIABILITY: 92, TOOL_PROFICIENCY: 90, DOMAIN_FLUENCY: 85, METACOGNITIVE_AWARENESS: 80, COLLABORATIVE_CAPACITY: 42, LEADERSHIP_DISPOSITION: 35 } },
    { id: "def-c4", name: "Brian Foster", role: "General Machinist", base: { PROCEDURAL_RELIABILITY: 58, COLLABORATIVE_CAPACITY: 62, TOOL_PROFICIENCY: 60, DOMAIN_FLUENCY: 55, SYSTEM_DIAGNOSTICS: 55, METACOGNITIVE_AWARENESS: 52 } },
    { id: "def-c5", name: "Amara Osei", role: "Process Technician", base: { ADAPTIVE_RESILIENCE: 85, METACOGNITIVE_AWARENESS: 82, FLUID_REASONING: 78, COLLABORATIVE_CAPACITY: 80, PROCEDURAL_RELIABILITY: 68, TOOL_PROFICIENCY: 65 } },
    { id: "def-c6", name: "Thomas Klein", role: "Quality Lead", base: { PROCEDURAL_RELIABILITY: 92, METACOGNITIVE_AWARENESS: 85, COLLABORATIVE_CAPACITY: 82, LEADERSHIP_DISPOSITION: 75, SYSTEM_DIAGNOSTICS: 72, DOMAIN_FLUENCY: 68 } },
    { id: "def-c7", name: "Jessica Liu", role: "Test Technician", base: { SYSTEM_DIAGNOSTICS: 80, TOOL_PROFICIENCY: 82, PROCEDURAL_RELIABILITY: 78, PROCESSING_SPEED: 85, DOMAIN_FLUENCY: 72, COLLABORATIVE_CAPACITY: 70 } },
    { id: "def-c8", name: "Carlos Mendez", role: "Automation Specialist", base: { TOOL_PROFICIENCY: 88, ARCHITECTURAL_REASONING: 82, SYSTEM_DIAGNOSTICS: 85, FLUID_REASONING: 80, PROCEDURAL_RELIABILITY: 72, COLLABORATIVE_CAPACITY: 62 } },
  ],
  "defense",
);

// ════════════════════════════════════════════════
// 2. SPACE & SATELLITE SYSTEMS
// ════════════════════════════════════════════════

const spaceData = buildDataset(
  [
    {
      id: "sp-avionics", name: "Avionics", department: "Flight Systems", missionType: "safety_critical_embedded",
      members: [
        { id: "sp-a1", name: "Dr. Kenji Sato", role: "Lead Avionics Engineer", base: { SYSTEM_DIAGNOSTICS: 92, DOMAIN_FLUENCY: 90, PROCEDURAL_RELIABILITY: 88, ARCHITECTURAL_REASONING: 85, METACOGNITIVE_AWARENESS: 82, LEADERSHIP_DISPOSITION: 72 } },
        { id: "sp-a2", name: "Rachel Evans", role: "Flight Software Engineer", base: { TOOL_PROFICIENCY: 88, DOMAIN_FLUENCY: 85, PROCEDURAL_RELIABILITY: 85, SYSTEM_DIAGNOSTICS: 80, FLUID_REASONING: 78, COLLABORATIVE_CAPACITY: 70 } },
        { id: "sp-a3", name: "Oleg Petrov", role: "GNC Engineer", base: { FLUID_REASONING: 90, WORKING_MEMORY: 88, DOMAIN_FLUENCY: 85, SYSTEM_DIAGNOSTICS: 82, ARCHITECTURAL_REASONING: 80, COLLABORATIVE_CAPACITY: 55 } },
        { id: "sp-a4", name: "Maria Santos", role: "Power Systems Engineer", base: { SYSTEM_DIAGNOSTICS: 85, DOMAIN_FLUENCY: 82, PROCEDURAL_RELIABILITY: 80, TOOL_PROFICIENCY: 78, METACOGNITIVE_AWARENESS: 78, COLLABORATIVE_CAPACITY: 72 } },
        { id: "sp-a5", name: "Jake Morrison", role: "Test & Integration", base: { PROCEDURAL_RELIABILITY: 88, TOOL_PROFICIENCY: 82, SYSTEM_DIAGNOSTICS: 78, COLLABORATIVE_CAPACITY: 80, PROCESSING_SPEED: 75, ADAPTIVE_RESILIENCE: 72 } },
      ],
      candidateIds: ["sp-c1", "sp-c2", "sp-c3", "sp-c4", "sp-c5", "sp-c6"],
    },
    {
      id: "sp-propulsion", name: "Propulsion", department: "Propulsion Division", missionType: "rd_applied_research",
      members: [
        { id: "sp-p1", name: "Dr. Lena Eriksson", role: "Chief Propulsion Eng", base: { FLUID_REASONING: 92, DOMAIN_FLUENCY: 90, ARCHITECTURAL_REASONING: 88, WORKING_MEMORY: 85, METACOGNITIVE_AWARENESS: 82, LEADERSHIP_DISPOSITION: 78 } },
        { id: "sp-p2", name: "David Kim", role: "Combustion Analyst", base: { FLUID_REASONING: 88, DOMAIN_FLUENCY: 85, WORKING_MEMORY: 82, METACOGNITIVE_AWARENESS: 80, SYSTEM_DIAGNOSTICS: 78, COLLABORATIVE_CAPACITY: 62 } },
        { id: "sp-p3", name: "Fatima Al-Rashid", role: "Materials Scientist", base: { DOMAIN_FLUENCY: 90, FLUID_REASONING: 85, METACOGNITIVE_AWARENESS: 82, WORKING_MEMORY: 80, PROCEDURAL_RELIABILITY: 75, COLLABORATIVE_CAPACITY: 70 } },
        { id: "sp-p4", name: "Ryan O'Brien", role: "Test Engineer", base: { PROCEDURAL_RELIABILITY: 85, TOOL_PROFICIENCY: 82, SYSTEM_DIAGNOSTICS: 80, PROCESSING_SPEED: 78, DOMAIN_FLUENCY: 75, ADAPTIVE_RESILIENCE: 72 } },
        { id: "sp-p5", name: "Ana Petrova", role: "Junior Propulsion Eng", base: { FLUID_REASONING: 78, WORKING_MEMORY: 75, DOMAIN_FLUENCY: 62, METACOGNITIVE_AWARENESS: 80, TOOL_PROFICIENCY: 68, COLLABORATIVE_CAPACITY: 75 } },
      ],
      candidateIds: ["sp-c1", "sp-c3", "sp-c5", "sp-c6", "sp-c7"],
    },
    {
      id: "sp-ground", name: "Ground Systems", department: "Operations", missionType: "devops_sre",
      members: [
        { id: "sp-g1", name: "Marcus Johnson", role: "Lead Ground Sys Eng", base: { SYSTEM_DIAGNOSTICS: 88, TOOL_PROFICIENCY: 90, ARCHITECTURAL_REASONING: 85, PROCEDURAL_RELIABILITY: 82, DOMAIN_FLUENCY: 80, LEADERSHIP_DISPOSITION: 70 } },
        { id: "sp-g2", name: "Priya Gupta", role: "Mission Operations", base: { PROCEDURAL_RELIABILITY: 90, ADAPTIVE_RESILIENCE: 85, COLLABORATIVE_CAPACITY: 82, SYSTEM_DIAGNOSTICS: 78, METACOGNITIVE_AWARENESS: 80, PROCESSING_SPEED: 78 } },
        { id: "sp-g3", name: "Tyler Chen", role: "Network Engineer", base: { TOOL_PROFICIENCY: 88, SYSTEM_DIAGNOSTICS: 85, ARCHITECTURAL_REASONING: 80, PROCEDURAL_RELIABILITY: 78, PROCESSING_SPEED: 82, COLLABORATIVE_CAPACITY: 65 } },
        { id: "sp-g4", name: "Sofia Rodriguez", role: "RF Systems Engineer", base: { DOMAIN_FLUENCY: 88, SYSTEM_DIAGNOSTICS: 82, TOOL_PROFICIENCY: 80, FLUID_REASONING: 78, PROCEDURAL_RELIABILITY: 82, COLLABORATIVE_CAPACITY: 70 } },
        { id: "sp-g5", name: "Ben Watkins", role: "Operations Specialist", base: { PROCEDURAL_RELIABILITY: 85, PROCESSING_SPEED: 82, ADAPTIVE_RESILIENCE: 80, COLLABORATIVE_CAPACITY: 78, TOOL_PROFICIENCY: 75, SYSTEM_DIAGNOSTICS: 72 } },
        { id: "sp-g6", name: "Jenny Park", role: "Junior Sys Admin", base: { TOOL_PROFICIENCY: 72, PROCESSING_SPEED: 78, COLLABORATIVE_CAPACITY: 80, ADAPTIVE_RESILIENCE: 75, PROCEDURAL_RELIABILITY: 70, METACOGNITIVE_AWARENESS: 72 } },
      ],
      candidateIds: ["sp-c2", "sp-c4", "sp-c5", "sp-c7"],
    },
  ],
  [
    { id: "sp-c1", name: "Dr. Yuki Yamamoto", role: "Senior Systems Eng", base: { SYSTEM_DIAGNOSTICS: 90, ARCHITECTURAL_REASONING: 88, DOMAIN_FLUENCY: 85, METACOGNITIVE_AWARENESS: 82, FLUID_REASONING: 80, COLLABORATIVE_CAPACITY: 68 } },
    { id: "sp-c2", name: "Alex Rivera", role: "Mission Analyst", base: { ADAPTIVE_RESILIENCE: 85, COLLABORATIVE_CAPACITY: 82, PROCESSING_SPEED: 80, PROCEDURAL_RELIABILITY: 78, METACOGNITIVE_AWARENESS: 75, SYSTEM_DIAGNOSTICS: 72 } },
    { id: "sp-c3", name: "Nina Volkov", role: "Thermal Engineer", base: { DOMAIN_FLUENCY: 88, FLUID_REASONING: 85, WORKING_MEMORY: 82, SYSTEM_DIAGNOSTICS: 80, METACOGNITIVE_AWARENESS: 78, COLLABORATIVE_CAPACITY: 62 } },
    { id: "sp-c4", name: "Jordan Blake", role: "Flight Ops Specialist", base: { PROCEDURAL_RELIABILITY: 88, ADAPTIVE_RESILIENCE: 85, COLLABORATIVE_CAPACITY: 82, PROCESSING_SPEED: 80, TOOL_PROFICIENCY: 75, LEADERSHIP_DISPOSITION: 70 } },
    { id: "sp-c5", name: "Maya Chen", role: "Junior Engineer", base: { FLUID_REASONING: 78, METACOGNITIVE_AWARENESS: 85, WORKING_MEMORY: 75, ADAPTIVE_RESILIENCE: 80, DOMAIN_FLUENCY: 55, TOOL_PROFICIENCY: 62 } },
    { id: "sp-c6", name: "Sam Okafor", role: "Electronics Engineer", base: { TOOL_PROFICIENCY: 88, DOMAIN_FLUENCY: 82, SYSTEM_DIAGNOSTICS: 80, PROCEDURAL_RELIABILITY: 78, COLLABORATIVE_CAPACITY: 45, LEADERSHIP_DISPOSITION: 38 } },
    { id: "sp-c7", name: "Emma Blackwell", role: "Software Engineer", base: { TOOL_PROFICIENCY: 85, ARCHITECTURAL_REASONING: 82, FLUID_REASONING: 80, PROCESSING_SPEED: 82, PROCEDURAL_RELIABILITY: 72, COLLABORATIVE_CAPACITY: 75 } },
  ],
  "space",
);

// ════════════════════════════════════════════════
// 3. HARDWARE + AI / ROBOTICS
// ════════════════════════════════════════════════

const roboticsData = buildDataset(
  [
    {
      id: "hw-perception", name: "Perception", department: "AI Systems", missionType: "rd_applied_research",
      members: [
        { id: "hw-p1", name: "Dr. Wei Zhang", role: "Lead Perception Eng", base: { FLUID_REASONING: 92, DOMAIN_FLUENCY: 90, WORKING_MEMORY: 88, ARCHITECTURAL_REASONING: 85, METACOGNITIVE_AWARENESS: 82, COLLABORATIVE_CAPACITY: 65 } },
        { id: "hw-p2", name: "Priya Sharma", role: "Computer Vision Eng", base: { FLUID_REASONING: 88, DOMAIN_FLUENCY: 85, TOOL_PROFICIENCY: 82, WORKING_MEMORY: 80, PROCESSING_SPEED: 78, COLLABORATIVE_CAPACITY: 72 } },
        { id: "hw-p3", name: "Lucas Fischer", role: "ML Engineer", base: { FLUID_REASONING: 85, TOOL_PROFICIENCY: 88, DOMAIN_FLUENCY: 82, WORKING_MEMORY: 80, ARCHITECTURAL_REASONING: 78, COLLABORATIVE_CAPACITY: 58 } },
        { id: "hw-p4", name: "Zara Ahmed", role: "Sensor Fusion Eng", base: { SYSTEM_DIAGNOSTICS: 85, DOMAIN_FLUENCY: 82, FLUID_REASONING: 80, WORKING_MEMORY: 82, TOOL_PROFICIENCY: 78, METACOGNITIVE_AWARENESS: 75 } },
        { id: "hw-p5", name: "Chris Nakamura", role: "Junior ML Eng", base: { FLUID_REASONING: 78, WORKING_MEMORY: 75, TOOL_PROFICIENCY: 72, METACOGNITIVE_AWARENESS: 80, DOMAIN_FLUENCY: 58, COLLABORATIVE_CAPACITY: 78 } },
      ],
      candidateIds: ["hw-c1", "hw-c2", "hw-c3", "hw-c4", "hw-c5", "hw-c6"],
    },
    {
      id: "hw-firmware", name: "Firmware & Controls", department: "Embedded Systems", missionType: "safety_critical_embedded",
      members: [
        { id: "hw-f1", name: "Sarah Kowalski", role: "Lead Firmware Eng", base: { PROCEDURAL_RELIABILITY: 90, SYSTEM_DIAGNOSTICS: 88, DOMAIN_FLUENCY: 85, TOOL_PROFICIENCY: 82, ARCHITECTURAL_REASONING: 80, METACOGNITIVE_AWARENESS: 78 } },
        { id: "hw-f2", name: "Ray Patel", role: "Controls Engineer", base: { SYSTEM_DIAGNOSTICS: 88, DOMAIN_FLUENCY: 85, FLUID_REASONING: 82, WORKING_MEMORY: 80, TOOL_PROFICIENCY: 80, PROCEDURAL_RELIABILITY: 78 } },
        { id: "hw-f3", name: "Nina Torres", role: "RTOS Developer", base: { TOOL_PROFICIENCY: 90, DOMAIN_FLUENCY: 88, PROCEDURAL_RELIABILITY: 85, SYSTEM_DIAGNOSTICS: 80, ARCHITECTURAL_REASONING: 75, COLLABORATIVE_CAPACITY: 55 } },
        { id: "hw-f4", name: "David Osei", role: "Hardware-Software Int.", base: { SYSTEM_DIAGNOSTICS: 85, TOOL_PROFICIENCY: 82, DOMAIN_FLUENCY: 80, PROCEDURAL_RELIABILITY: 82, COLLABORATIVE_CAPACITY: 72, ADAPTIVE_RESILIENCE: 70 } },
        { id: "hw-f5", name: "Lena Bergstrom", role: "Safety Engineer", base: { PROCEDURAL_RELIABILITY: 92, METACOGNITIVE_AWARENESS: 88, SYSTEM_DIAGNOSTICS: 82, DOMAIN_FLUENCY: 78, COLLABORATIVE_CAPACITY: 75, LEADERSHIP_DISPOSITION: 65 } },
      ],
      candidateIds: ["hw-c1", "hw-c3", "hw-c5", "hw-c6", "hw-c7"],
    },
    {
      id: "hw-integration", name: "Systems Integration", department: "Integration", missionType: "platform_infrastructure",
      members: [
        { id: "hw-i1", name: "Marcus Johnson", role: "Integration Lead", base: { COLLABORATIVE_CAPACITY: 85, LEADERSHIP_DISPOSITION: 82, SYSTEM_DIAGNOSTICS: 82, ARCHITECTURAL_REASONING: 80, ADAPTIVE_RESILIENCE: 78, METACOGNITIVE_AWARENESS: 78 } },
        { id: "hw-i2", name: "Emma Chen", role: "Test Engineer", base: { PROCEDURAL_RELIABILITY: 85, SYSTEM_DIAGNOSTICS: 82, TOOL_PROFICIENCY: 80, PROCESSING_SPEED: 78, COLLABORATIVE_CAPACITY: 78, ADAPTIVE_RESILIENCE: 75 } },
        { id: "hw-i3", name: "Jake Morrison", role: "DevOps Engineer", base: { TOOL_PROFICIENCY: 88, SYSTEM_DIAGNOSTICS: 82, ARCHITECTURAL_REASONING: 78, PROCESSING_SPEED: 82, PROCEDURAL_RELIABILITY: 78, COLLABORATIVE_CAPACITY: 72 } },
        { id: "hw-i4", name: "Aisha Williams", role: "QA Lead", base: { PROCEDURAL_RELIABILITY: 88, METACOGNITIVE_AWARENESS: 82, COLLABORATIVE_CAPACITY: 82, SYSTEM_DIAGNOSTICS: 75, LEADERSHIP_DISPOSITION: 72, ADAPTIVE_RESILIENCE: 72 } },
        { id: "hw-i5", name: "Tom Garcia", role: "Junior Sys Eng", base: { COLLABORATIVE_CAPACITY: 80, ADAPTIVE_RESILIENCE: 78, TOOL_PROFICIENCY: 72, PROCESSING_SPEED: 75, METACOGNITIVE_AWARENESS: 72, SYSTEM_DIAGNOSTICS: 65 } },
        { id: "hw-i6", name: "Kim Park", role: "Build & Release Eng", base: { TOOL_PROFICIENCY: 85, PROCEDURAL_RELIABILITY: 82, PROCESSING_SPEED: 80, SYSTEM_DIAGNOSTICS: 72, COLLABORATIVE_CAPACITY: 75, ARCHITECTURAL_REASONING: 68 } },
      ],
      candidateIds: ["hw-c2", "hw-c4", "hw-c5", "hw-c7"],
    },
  ],
  [
    { id: "hw-c1", name: "Dr. Alex Rivera", role: "Senior ML Research", base: { FLUID_REASONING: 92, WORKING_MEMORY: 88, DOMAIN_FLUENCY: 85, ARCHITECTURAL_REASONING: 82, METACOGNITIVE_AWARENESS: 80, COLLABORATIVE_CAPACITY: 62 } },
    { id: "hw-c2", name: "Jordan Lee", role: "Robotics Eng", base: { SYSTEM_DIAGNOSTICS: 85, TOOL_PROFICIENCY: 82, DOMAIN_FLUENCY: 80, COLLABORATIVE_CAPACITY: 78, ADAPTIVE_RESILIENCE: 78, FLUID_REASONING: 75 } },
    { id: "hw-c3", name: "Maya Okonkwo", role: "Embedded ML Eng", base: { FLUID_REASONING: 88, TOOL_PROFICIENCY: 85, DOMAIN_FLUENCY: 82, WORKING_MEMORY: 85, PROCEDURAL_RELIABILITY: 65, COLLABORATIVE_CAPACITY: 60 } },
    { id: "hw-c4", name: "Andre Jackson", role: "Integration Specialist", base: { COLLABORATIVE_CAPACITY: 90, ADAPTIVE_RESILIENCE: 85, LEADERSHIP_DISPOSITION: 82, SYSTEM_DIAGNOSTICS: 75, PROCEDURAL_RELIABILITY: 78, TOOL_PROFICIENCY: 72 } },
    { id: "hw-c5", name: "Zoe Chen", role: "Junior Eng", base: { METACOGNITIVE_AWARENESS: 85, FLUID_REASONING: 78, ADAPTIVE_RESILIENCE: 80, COLLABORATIVE_CAPACITY: 78, DOMAIN_FLUENCY: 55, TOOL_PROFICIENCY: 62 } },
    { id: "hw-c6", name: "William Burke", role: "Controls Specialist", base: { SYSTEM_DIAGNOSTICS: 88, DOMAIN_FLUENCY: 85, PROCEDURAL_RELIABILITY: 82, TOOL_PROFICIENCY: 80, METACOGNITIVE_AWARENESS: 78, COLLABORATIVE_CAPACITY: 55 } },
    { id: "hw-c7", name: "Aisha Patel", role: "Full-Stack / Embedded", base: { TOOL_PROFICIENCY: 88, PROCESSING_SPEED: 85, ADAPTIVE_RESILIENCE: 82, FLUID_REASONING: 78, COLLABORATIVE_CAPACITY: 75, PROCEDURAL_RELIABILITY: 60 } },
  ],
  "robotics",
);

// ════════════════════════════════════════════════
// 4. AI & SOFTWARE
// ════════════════════════════════════════════════

const aiSoftwareData = buildDataset(
  [
    {
      id: "ai-platform", name: "Platform", department: "Core Platform", missionType: "platform_infrastructure",
      members: [
        { id: "ai-p1", name: "Taylor Mitchell", role: "Staff Platform Eng", base: { ARCHITECTURAL_REASONING: 90, TOOL_PROFICIENCY: 88, SYSTEM_DIAGNOSTICS: 85, DOMAIN_FLUENCY: 82, PROCEDURAL_RELIABILITY: 78, COLLABORATIVE_CAPACITY: 72 } },
        { id: "ai-p2", name: "Jordan Lee", role: "Senior SRE", base: { SYSTEM_DIAGNOSTICS: 90, TOOL_PROFICIENCY: 88, PROCEDURAL_RELIABILITY: 85, ARCHITECTURAL_REASONING: 80, PROCESSING_SPEED: 80, COLLABORATIVE_CAPACITY: 68 } },
        { id: "ai-p3", name: "Casey Williams", role: "Backend Engineer", base: { TOOL_PROFICIENCY: 85, ARCHITECTURAL_REASONING: 78, DOMAIN_FLUENCY: 78, SYSTEM_DIAGNOSTICS: 75, COLLABORATIVE_CAPACITY: 80, PROCEDURAL_RELIABILITY: 78 } },
        { id: "ai-p4", name: "Morgan Davis", role: "Cloud Architect", base: { ARCHITECTURAL_REASONING: 92, SYSTEM_DIAGNOSTICS: 82, DOMAIN_FLUENCY: 88, TOOL_PROFICIENCY: 80, FLUID_REASONING: 80, LEADERSHIP_DISPOSITION: 65 } },
        { id: "ai-p5", name: "Riley Thompson", role: "Junior Platform Eng", base: { TOOL_PROFICIENCY: 72, COLLABORATIVE_CAPACITY: 82, ADAPTIVE_RESILIENCE: 78, PROCESSING_SPEED: 75, METACOGNITIVE_AWARENESS: 72, DOMAIN_FLUENCY: 58 } },
      ],
      candidateIds: ["ai-c1", "ai-c2", "ai-c3", "ai-c4", "ai-c5", "ai-c6", "ai-c7"],
    },
    {
      id: "ai-ml", name: "ML Research", department: "AI Research", missionType: "data_ml_engineering",
      members: [
        { id: "ai-m1", name: "Dr. Lena Bergstrom", role: "Principal Scientist", base: { FLUID_REASONING: 95, WORKING_MEMORY: 92, DOMAIN_FLUENCY: 90, ARCHITECTURAL_REASONING: 88, METACOGNITIVE_AWARENESS: 85, COLLABORATIVE_CAPACITY: 62 } },
        { id: "ai-m2", name: "David Huang", role: "Senior ML Eng", base: { FLUID_REASONING: 88, TOOL_PROFICIENCY: 85, WORKING_MEMORY: 85, DOMAIN_FLUENCY: 82, SYSTEM_DIAGNOSTICS: 78, COLLABORATIVE_CAPACITY: 68 } },
        { id: "ai-m3", name: "Nina Volkov", role: "Research Engineer", base: { FLUID_REASONING: 90, DOMAIN_FLUENCY: 85, WORKING_MEMORY: 82, METACOGNITIVE_AWARENESS: 80, ARCHITECTURAL_REASONING: 82, COLLABORATIVE_CAPACITY: 65 } },
        { id: "ai-m4", name: "Kai Nakamura", role: "ML Infrastructure", base: { TOOL_PROFICIENCY: 88, ARCHITECTURAL_REASONING: 85, SYSTEM_DIAGNOSTICS: 82, DOMAIN_FLUENCY: 78, PROCESSING_SPEED: 80, COLLABORATIVE_CAPACITY: 60 } },
        { id: "ai-m5", name: "Sophie Park", role: "Junior ML Eng", base: { FLUID_REASONING: 80, WORKING_MEMORY: 78, METACOGNITIVE_AWARENESS: 82, DOMAIN_FLUENCY: 62, TOOL_PROFICIENCY: 70, COLLABORATIVE_CAPACITY: 78 } },
      ],
      candidateIds: ["ai-c1", "ai-c3", "ai-c5", "ai-c6", "ai-c8"],
    },
    {
      id: "ai-product", name: "Product Engineering", department: "Product", missionType: "growth_product_engineering",
      members: [
        { id: "ai-pr1", name: "Alex Chen", role: "Engineering Manager", base: { LEADERSHIP_DISPOSITION: 88, COLLABORATIVE_CAPACITY: 85, ADAPTIVE_RESILIENCE: 82, ARCHITECTURAL_REASONING: 78, METACOGNITIVE_AWARENESS: 80, SYSTEM_DIAGNOSTICS: 72 } },
        { id: "ai-pr2", name: "Emma Blackwell", role: "Senior Frontend Eng", base: { TOOL_PROFICIENCY: 88, PROCESSING_SPEED: 85, COLLABORATIVE_CAPACITY: 82, ADAPTIVE_RESILIENCE: 80, DOMAIN_FLUENCY: 78, FLUID_REASONING: 72 } },
        { id: "ai-pr3", name: "Marcus Rivera", role: "Full-Stack Eng", base: { TOOL_PROFICIENCY: 85, ADAPTIVE_RESILIENCE: 82, PROCESSING_SPEED: 82, COLLABORATIVE_CAPACITY: 80, SYSTEM_DIAGNOSTICS: 75, ARCHITECTURAL_REASONING: 72 } },
        { id: "ai-pr4", name: "Priya Gupta", role: "Backend Eng", base: { ARCHITECTURAL_REASONING: 82, SYSTEM_DIAGNOSTICS: 80, TOOL_PROFICIENCY: 82, DOMAIN_FLUENCY: 78, PROCEDURAL_RELIABILITY: 75, COLLABORATIVE_CAPACITY: 78 } },
        { id: "ai-pr5", name: "Jake Morrison", role: "Junior Eng", base: { PROCESSING_SPEED: 80, COLLABORATIVE_CAPACITY: 82, ADAPTIVE_RESILIENCE: 78, TOOL_PROFICIENCY: 72, METACOGNITIVE_AWARENESS: 70, DOMAIN_FLUENCY: 58 } },
        { id: "ai-pr6", name: "Sofia Rodriguez", role: "Design Engineer", base: { COLLABORATIVE_CAPACITY: 88, ADAPTIVE_RESILIENCE: 85, METACOGNITIVE_AWARENESS: 78, FLUID_REASONING: 75, PROCESSING_SPEED: 78, TOOL_PROFICIENCY: 72 } },
      ],
      candidateIds: ["ai-c2", "ai-c4", "ai-c5", "ai-c7", "ai-c8"],
    },
  ],
  [
    { id: "ai-c1", name: "Dr. Alex Rivera", role: "Senior ML Scientist", base: { FLUID_REASONING: 92, WORKING_MEMORY: 90, DOMAIN_FLUENCY: 88, ARCHITECTURAL_REASONING: 85, METACOGNITIVE_AWARENESS: 82, COLLABORATIVE_CAPACITY: 60 } },
    { id: "ai-c2", name: "Derek Washington", role: "Eng Manager", base: { LEADERSHIP_DISPOSITION: 90, COLLABORATIVE_CAPACITY: 88, ADAPTIVE_RESILIENCE: 85, METACOGNITIVE_AWARENESS: 80, SYSTEM_DIAGNOSTICS: 68, TOOL_PROFICIENCY: 65 } },
    { id: "ai-c3", name: "Maya Okonkwo", role: "Research Engineer", base: { FLUID_REASONING: 90, WORKING_MEMORY: 88, ARCHITECTURAL_REASONING: 85, METACOGNITIVE_AWARENESS: 82, TOOL_PROFICIENCY: 72, COLLABORATIVE_CAPACITY: 65 } },
    { id: "ai-c4", name: "Andre Jackson", role: "Product Engineer", base: { COLLABORATIVE_CAPACITY: 90, ADAPTIVE_RESILIENCE: 88, LEADERSHIP_DISPOSITION: 82, PROCESSING_SPEED: 80, TOOL_PROFICIENCY: 78, SYSTEM_DIAGNOSTICS: 68 } },
    { id: "ai-c5", name: "Zoe Chen", role: "Junior Engineer", base: { METACOGNITIVE_AWARENESS: 88, FLUID_REASONING: 78, ADAPTIVE_RESILIENCE: 82, COLLABORATIVE_CAPACITY: 80, DOMAIN_FLUENCY: 55, TOOL_PROFICIENCY: 65 } },
    { id: "ai-c6", name: "William Burke", role: "Senior Platform Eng", base: { ARCHITECTURAL_REASONING: 88, TOOL_PROFICIENCY: 85, SYSTEM_DIAGNOSTICS: 82, DOMAIN_FLUENCY: 80, PROCEDURAL_RELIABILITY: 78, COLLABORATIVE_CAPACITY: 65 } },
    { id: "ai-c7", name: "Aisha Patel", role: "Full-Stack Dev", base: { TOOL_PROFICIENCY: 88, PROCESSING_SPEED: 90, ADAPTIVE_RESILIENCE: 82, COLLABORATIVE_CAPACITY: 78, FLUID_REASONING: 75, PROCEDURAL_RELIABILITY: 60 } },
    { id: "ai-c8", name: "Carlos Mendez", role: "ML Infrastructure Eng", base: { TOOL_PROFICIENCY: 85, SYSTEM_DIAGNOSTICS: 82, ARCHITECTURAL_REASONING: 85, DOMAIN_FLUENCY: 80, FLUID_REASONING: 80, COLLABORATIVE_CAPACITY: 68 } },
  ],
  "ai-software",
);

// ════════════════════════════════════════════════
// EXPORT: Industry → Dataset mapping
// ════════════════════════════════════════════════

const DEMO_DATASETS: Record<TutorialIndustry, DemoDataset> = {
  "defense-manufacturing": defenseData,
  "space-satellite": spaceData,
  "hardware-ai": roboticsData,
  "ai-software": aiSoftwareData,
};

export function getDemoDataset(industry: TutorialIndustry | null): DemoDataset {
  return DEMO_DATASETS[industry ?? "defense-manufacturing"];
}

export type { DemoDataset };

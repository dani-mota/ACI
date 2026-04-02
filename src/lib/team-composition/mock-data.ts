// ──────────────────────────────────────────────
// Team Composition Analysis — Realistic Mock Data
// ──────────────────────────────────────────────

import type { IndividualProfile, Team, ConstructVector } from "./types";

/** Deterministic pseudo-random based on seed string */
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
  // Box-Muller
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
  assessmentType: "candidate" | "internal",
  baseScores: Partial<ConstructVector>,
  seed: string
): IndividualProfile {
  const rng = seededRandom(seed);
  const defaultMean = 60;
  const defaultSd = 12;

  const scores: ConstructVector = {
    PROCEDURAL_RELIABILITY: gaussian(rng, baseScores.PROCEDURAL_RELIABILITY ?? defaultMean, defaultSd),
    COLLABORATIVE_CAPACITY: gaussian(rng, baseScores.COLLABORATIVE_CAPACITY ?? defaultMean, defaultSd),
    ADAPTIVE_RESILIENCE: gaussian(rng, baseScores.ADAPTIVE_RESILIENCE ?? defaultMean, defaultSd),
    LEADERSHIP_DISPOSITION: gaussian(rng, baseScores.LEADERSHIP_DISPOSITION ?? defaultMean, defaultSd),
    SYSTEM_DIAGNOSTICS: gaussian(rng, baseScores.SYSTEM_DIAGNOSTICS ?? defaultMean, defaultSd),
    DOMAIN_FLUENCY: gaussian(rng, baseScores.DOMAIN_FLUENCY ?? defaultMean, defaultSd),
    TOOL_PROFICIENCY: gaussian(rng, baseScores.TOOL_PROFICIENCY ?? defaultMean, defaultSd),
    ARCHITECTURAL_REASONING: gaussian(rng, baseScores.ARCHITECTURAL_REASONING ?? defaultMean, defaultSd),
    FLUID_REASONING: gaussian(rng, baseScores.FLUID_REASONING ?? defaultMean, defaultSd),
    WORKING_MEMORY: gaussian(rng, baseScores.WORKING_MEMORY ?? defaultMean, defaultSd),
    PROCESSING_SPEED: gaussian(rng, baseScores.PROCESSING_SPEED ?? defaultMean, defaultSd),
    METACOGNITIVE_AWARENESS: gaussian(rng, baseScores.METACOGNITIVE_AWARENESS ?? defaultMean, defaultSd),
  };

  return {
    id,
    name,
    role,
    department,
    teamId,
    assessmentDate: "2026-03-15",
    assessmentType,
    scores,
    avatarSeed: name.replace(/\s/g, "").toLowerCase(),
  };
}

// ──────────────────────────────────────────────
// TEAM 1: Anvil — Safety-Critical Embedded Systems
// ──────────────────────────────────────────────
// High procedural reliability, strong diagnostics, cautious culture.
// Gap: leadership and collaboration could be stronger.

const anvilMembers: IndividualProfile[] = [
  makeProfile("anvil-1", "Marcus Chen", "Lead Embedded Engineer", "Embedded Systems", "team-anvil", "internal",
    { PROCEDURAL_RELIABILITY: 91, SYSTEM_DIAGNOSTICS: 88, METACOGNITIVE_AWARENESS: 85, DOMAIN_FLUENCY: 82, TOOL_PROFICIENCY: 78, COLLABORATIVE_CAPACITY: 58, LEADERSHIP_DISPOSITION: 72, FLUID_REASONING: 75 },
    "marcus-chen-anvil"
  ),
  makeProfile("anvil-2", "Sarah Kowalski", "Senior Firmware Engineer", "Embedded Systems", "team-anvil", "internal",
    { PROCEDURAL_RELIABILITY: 88, SYSTEM_DIAGNOSTICS: 84, METACOGNITIVE_AWARENESS: 80, DOMAIN_FLUENCY: 79, TOOL_PROFICIENCY: 85, COLLABORATIVE_CAPACITY: 62, LEADERSHIP_DISPOSITION: 45, FLUID_REASONING: 70 },
    "sarah-kowalski-anvil"
  ),
  makeProfile("anvil-3", "James Okoro", "Safety Assurance Engineer", "Embedded Systems", "team-anvil", "internal",
    { PROCEDURAL_RELIABILITY: 95, SYSTEM_DIAGNOSTICS: 78, METACOGNITIVE_AWARENESS: 92, DOMAIN_FLUENCY: 75, TOOL_PROFICIENCY: 65, COLLABORATIVE_CAPACITY: 70, LEADERSHIP_DISPOSITION: 55, FLUID_REASONING: 62 },
    "james-okoro-anvil"
  ),
  makeProfile("anvil-4", "Lisa Park", "Embedded Software Engineer", "Embedded Systems", "team-anvil", "internal",
    { PROCEDURAL_RELIABILITY: 82, SYSTEM_DIAGNOSTICS: 90, METACOGNITIVE_AWARENESS: 76, DOMAIN_FLUENCY: 88, TOOL_PROFICIENCY: 80, COLLABORATIVE_CAPACITY: 55, LEADERSHIP_DISPOSITION: 42, FLUID_REASONING: 80 },
    "lisa-park-anvil"
  ),
  makeProfile("anvil-5", "Robert Vasquez", "RTOS Specialist", "Embedded Systems", "team-anvil", "internal",
    { PROCEDURAL_RELIABILITY: 86, SYSTEM_DIAGNOSTICS: 82, METACOGNITIVE_AWARENESS: 78, DOMAIN_FLUENCY: 92, TOOL_PROFICIENCY: 88, COLLABORATIVE_CAPACITY: 48, LEADERSHIP_DISPOSITION: 38, FLUID_REASONING: 68 },
    "robert-vasquez-anvil"
  ),
  makeProfile("anvil-6", "Priya Sharma", "Test & Validation Lead", "Embedded Systems", "team-anvil", "internal",
    { PROCEDURAL_RELIABILITY: 90, SYSTEM_DIAGNOSTICS: 75, METACOGNITIVE_AWARENESS: 88, DOMAIN_FLUENCY: 72, TOOL_PROFICIENCY: 70, COLLABORATIVE_CAPACITY: 72, LEADERSHIP_DISPOSITION: 68, FLUID_REASONING: 65 },
    "priya-sharma-anvil"
  ),
];

// ──────────────────────────────────────────────
// TEAM 2: Horizon — R&D / Applied Research
// ──────────────────────────────────────────────
// High fluid reasoning, creative problem solvers, less procedural.
// Gap: procedural reliability and tool proficiency.

const horizonMembers: IndividualProfile[] = [
  makeProfile("horizon-1", "Dr. Alex Rivera", "Principal Research Scientist", "R&D", "team-horizon", "internal",
    { FLUID_REASONING: 94, ARCHITECTURAL_REASONING: 90, WORKING_MEMORY: 88, METACOGNITIVE_AWARENESS: 85, DOMAIN_FLUENCY: 92, PROCEDURAL_RELIABILITY: 52, TOOL_PROFICIENCY: 65, COLLABORATIVE_CAPACITY: 68 },
    "alex-rivera-horizon"
  ),
  makeProfile("horizon-2", "Nina Volkov", "Research Engineer", "R&D", "team-horizon", "internal",
    { FLUID_REASONING: 88, ARCHITECTURAL_REASONING: 82, WORKING_MEMORY: 85, METACOGNITIVE_AWARENESS: 78, DOMAIN_FLUENCY: 80, PROCEDURAL_RELIABILITY: 58, TOOL_PROFICIENCY: 72, COLLABORATIVE_CAPACITY: 75 },
    "nina-volkov-horizon"
  ),
  makeProfile("horizon-3", "David Huang", "Applied ML Researcher", "R&D", "team-horizon", "internal",
    { FLUID_REASONING: 90, ARCHITECTURAL_REASONING: 85, WORKING_MEMORY: 92, METACOGNITIVE_AWARENESS: 82, DOMAIN_FLUENCY: 88, PROCEDURAL_RELIABILITY: 48, TOOL_PROFICIENCY: 78, COLLABORATIVE_CAPACITY: 62 },
    "david-huang-horizon"
  ),
  makeProfile("horizon-4", "Emma Blackwell", "Prototype Engineer", "R&D", "team-horizon", "internal",
    { FLUID_REASONING: 82, ARCHITECTURAL_REASONING: 78, WORKING_MEMORY: 75, METACOGNITIVE_AWARENESS: 72, DOMAIN_FLUENCY: 70, PROCEDURAL_RELIABILITY: 65, TOOL_PROFICIENCY: 82, COLLABORATIVE_CAPACITY: 80 },
    "emma-blackwell-horizon"
  ),
  makeProfile("horizon-5", "Kai Nakamura", "Systems Architect", "R&D", "team-horizon", "internal",
    { FLUID_REASONING: 86, ARCHITECTURAL_REASONING: 92, WORKING_MEMORY: 80, METACOGNITIVE_AWARENESS: 88, DOMAIN_FLUENCY: 78, PROCEDURAL_RELIABILITY: 55, TOOL_PROFICIENCY: 68, COLLABORATIVE_CAPACITY: 58 },
    "kai-nakamura-horizon"
  ),
];

// ──────────────────────────────────────────────
// TEAM 3: Forge — Platform Infrastructure
// ──────────────────────────────────────────────
// Balanced technical team, strong tooling. Gap: leadership depth.

const forgeMembers: IndividualProfile[] = [
  makeProfile("forge-1", "Taylor Mitchell", "Staff Platform Engineer", "Platform", "team-forge", "internal",
    { ARCHITECTURAL_REASONING: 88, TOOL_PROFICIENCY: 90, SYSTEM_DIAGNOSTICS: 85, DOMAIN_FLUENCY: 82, PROCEDURAL_RELIABILITY: 78, COLLABORATIVE_CAPACITY: 72, LEADERSHIP_DISPOSITION: 75, WORKING_MEMORY: 80 },
    "taylor-mitchell-forge"
  ),
  makeProfile("forge-2", "Jordan Lee", "Senior SRE", "Platform", "team-forge", "internal",
    { ARCHITECTURAL_REASONING: 80, TOOL_PROFICIENCY: 92, SYSTEM_DIAGNOSTICS: 88, DOMAIN_FLUENCY: 78, PROCEDURAL_RELIABILITY: 85, COLLABORATIVE_CAPACITY: 68, LEADERSHIP_DISPOSITION: 52, WORKING_MEMORY: 75 },
    "jordan-lee-forge"
  ),
  makeProfile("forge-3", "Casey Williams", "Infrastructure Engineer", "Platform", "team-forge", "internal",
    { ARCHITECTURAL_REASONING: 75, TOOL_PROFICIENCY: 85, SYSTEM_DIAGNOSTICS: 80, DOMAIN_FLUENCY: 75, PROCEDURAL_RELIABILITY: 82, COLLABORATIVE_CAPACITY: 78, LEADERSHIP_DISPOSITION: 48, WORKING_MEMORY: 72 },
    "casey-williams-forge"
  ),
  makeProfile("forge-4", "Morgan Davis", "Cloud Architect", "Platform", "team-forge", "internal",
    { ARCHITECTURAL_REASONING: 92, TOOL_PROFICIENCY: 82, SYSTEM_DIAGNOSTICS: 78, DOMAIN_FLUENCY: 88, PROCEDURAL_RELIABILITY: 72, COLLABORATIVE_CAPACITY: 65, LEADERSHIP_DISPOSITION: 62, WORKING_MEMORY: 85 },
    "morgan-davis-forge"
  ),
  makeProfile("forge-5", "Riley Thompson", "Platform Engineer", "Platform", "team-forge", "internal",
    { ARCHITECTURAL_REASONING: 72, TOOL_PROFICIENCY: 88, SYSTEM_DIAGNOSTICS: 75, DOMAIN_FLUENCY: 72, PROCEDURAL_RELIABILITY: 80, COLLABORATIVE_CAPACITY: 82, LEADERSHIP_DISPOSITION: 45, WORKING_MEMORY: 68 },
    "riley-thompson-forge"
  ),
  makeProfile("forge-6", "Avery Robinson", "DevOps Lead", "Platform", "team-forge", "internal",
    { ARCHITECTURAL_REASONING: 82, TOOL_PROFICIENCY: 86, SYSTEM_DIAGNOSTICS: 90, DOMAIN_FLUENCY: 80, PROCEDURAL_RELIABILITY: 88, COLLABORATIVE_CAPACITY: 75, LEADERSHIP_DISPOSITION: 70, WORKING_MEMORY: 78 },
    "avery-robinson-forge"
  ),
  makeProfile("forge-7", "Sam Patel", "Junior Platform Engineer", "Platform", "team-forge", "internal",
    { ARCHITECTURAL_REASONING: 62, TOOL_PROFICIENCY: 72, SYSTEM_DIAGNOSTICS: 65, DOMAIN_FLUENCY: 58, PROCEDURAL_RELIABILITY: 75, COLLABORATIVE_CAPACITY: 80, LEADERSHIP_DISPOSITION: 42, WORKING_MEMORY: 70 },
    "sam-patel-forge"
  ),
];

// ──────────────────────────────────────────────
// CANDIDATES — Mix of strong, mediocre, and spiky profiles
// ──────────────────────────────────────────────

const candidates: IndividualProfile[] = [
  // Strong all-around — good individual merit but may be redundant
  makeProfile("cand-1", "Elena Rossi", "Senior Engineer", "Candidates", "none", "candidate",
    { PROCEDURAL_RELIABILITY: 80, COLLABORATIVE_CAPACITY: 78, ADAPTIVE_RESILIENCE: 82, LEADERSHIP_DISPOSITION: 75, SYSTEM_DIAGNOSTICS: 82, DOMAIN_FLUENCY: 80, TOOL_PROFICIENCY: 85, ARCHITECTURAL_REASONING: 82, FLUID_REASONING: 80, WORKING_MEMORY: 78, PROCESSING_SPEED: 80, METACOGNITIVE_AWARENESS: 82 },
    "elena-rossi-cand"
  ),
  // Gap filler — strong leadership + collaboration (what Anvil needs)
  makeProfile("cand-2", "Derek Washington", "Engineering Manager", "Candidates", "none", "candidate",
    { PROCEDURAL_RELIABILITY: 72, COLLABORATIVE_CAPACITY: 90, ADAPTIVE_RESILIENCE: 85, LEADERSHIP_DISPOSITION: 92, SYSTEM_DIAGNOSTICS: 65, DOMAIN_FLUENCY: 68, TOOL_PROFICIENCY: 62, ARCHITECTURAL_REASONING: 70, FLUID_REASONING: 72, WORKING_MEMORY: 68, PROCESSING_SPEED: 65, METACOGNITIVE_AWARENESS: 78 },
    "derek-washington-cand"
  ),
  // Technical specialist — deep but narrow
  makeProfile("cand-3", "Yuki Tanaka", "Embedded Systems Expert", "Candidates", "none", "candidate",
    { PROCEDURAL_RELIABILITY: 88, COLLABORATIVE_CAPACITY: 45, ADAPTIVE_RESILIENCE: 55, LEADERSHIP_DISPOSITION: 35, SYSTEM_DIAGNOSTICS: 92, DOMAIN_FLUENCY: 95, TOOL_PROFICIENCY: 90, ARCHITECTURAL_REASONING: 78, FLUID_REASONING: 75, WORKING_MEMORY: 82, PROCESSING_SPEED: 72, METACOGNITIVE_AWARENESS: 80 },
    "yuki-tanaka-cand"
  ),
  // Mediocre across the board — the "average" candidate
  makeProfile("cand-4", "Brian Foster", "Software Engineer", "Candidates", "none", "candidate",
    { PROCEDURAL_RELIABILITY: 58, COLLABORATIVE_CAPACITY: 62, ADAPTIVE_RESILIENCE: 60, LEADERSHIP_DISPOSITION: 55, SYSTEM_DIAGNOSTICS: 60, DOMAIN_FLUENCY: 58, TOOL_PROFICIENCY: 62, ARCHITECTURAL_REASONING: 55, FLUID_REASONING: 58, WORKING_MEMORY: 60, PROCESSING_SPEED: 62, METACOGNITIVE_AWARENESS: 55 },
    "brian-foster-cand"
  ),
  // Creative innovator — spiky R&D profile
  makeProfile("cand-5", "Maya Okonkwo", "Research Engineer", "Candidates", "none", "candidate",
    { PROCEDURAL_RELIABILITY: 48, COLLABORATIVE_CAPACITY: 72, ADAPTIVE_RESILIENCE: 88, LEADERSHIP_DISPOSITION: 62, SYSTEM_DIAGNOSTICS: 72, DOMAIN_FLUENCY: 78, TOOL_PROFICIENCY: 65, ARCHITECTURAL_REASONING: 88, FLUID_REASONING: 95, WORKING_MEMORY: 90, PROCESSING_SPEED: 58, METACOGNITIVE_AWARENESS: 85 },
    "maya-okonkwo-cand"
  ),
  // Process champion — strong behavioral, moderate technical
  makeProfile("cand-6", "Thomas Klein", "Quality Assurance Lead", "Candidates", "none", "candidate",
    { PROCEDURAL_RELIABILITY: 92, COLLABORATIVE_CAPACITY: 85, ADAPTIVE_RESILIENCE: 75, LEADERSHIP_DISPOSITION: 70, SYSTEM_DIAGNOSTICS: 68, DOMAIN_FLUENCY: 62, TOOL_PROFICIENCY: 70, ARCHITECTURAL_REASONING: 58, FLUID_REASONING: 60, WORKING_MEMORY: 65, PROCESSING_SPEED: 72, METACOGNITIVE_AWARENESS: 82 },
    "thomas-klein-cand"
  ),
  // Speed demon — fast but sometimes sloppy
  makeProfile("cand-7", "Aisha Patel", "Full-Stack Developer", "Candidates", "none", "candidate",
    { PROCEDURAL_RELIABILITY: 55, COLLABORATIVE_CAPACITY: 72, ADAPTIVE_RESILIENCE: 80, LEADERSHIP_DISPOSITION: 58, SYSTEM_DIAGNOSTICS: 68, DOMAIN_FLUENCY: 72, TOOL_PROFICIENCY: 88, ARCHITECTURAL_REASONING: 65, FLUID_REASONING: 78, WORKING_MEMORY: 72, PROCESSING_SPEED: 92, METACOGNITIVE_AWARENESS: 62 },
    "aisha-patel-cand"
  ),
  // Systems thinker — strong diagnostics + architecture
  makeProfile("cand-8", "Carlos Mendez", "Systems Engineer", "Candidates", "none", "candidate",
    { PROCEDURAL_RELIABILITY: 78, COLLABORATIVE_CAPACITY: 68, ADAPTIVE_RESILIENCE: 72, LEADERSHIP_DISPOSITION: 60, SYSTEM_DIAGNOSTICS: 90, DOMAIN_FLUENCY: 82, TOOL_PROFICIENCY: 78, ARCHITECTURAL_REASONING: 88, FLUID_REASONING: 82, WORKING_MEMORY: 80, PROCESSING_SPEED: 70, METACOGNITIVE_AWARENESS: 85 },
    "carlos-mendez-cand"
  ),
  // Young high-potential — moderate scores but high metacognition
  makeProfile("cand-9", "Zoe Chen", "Junior Engineer", "Candidates", "none", "candidate",
    { PROCEDURAL_RELIABILITY: 65, COLLABORATIVE_CAPACITY: 78, ADAPTIVE_RESILIENCE: 82, LEADERSHIP_DISPOSITION: 55, SYSTEM_DIAGNOSTICS: 62, DOMAIN_FLUENCY: 55, TOOL_PROFICIENCY: 68, ARCHITECTURAL_REASONING: 60, FLUID_REASONING: 72, WORKING_MEMORY: 70, PROCESSING_SPEED: 75, METACOGNITIVE_AWARENESS: 88 },
    "zoe-chen-cand"
  ),
  // Veteran leader — strong behavioral, solid technical base
  makeProfile("cand-10", "William Burke", "Senior Technical Lead", "Candidates", "none", "candidate",
    { PROCEDURAL_RELIABILITY: 82, COLLABORATIVE_CAPACITY: 88, ADAPTIVE_RESILIENCE: 78, LEADERSHIP_DISPOSITION: 90, SYSTEM_DIAGNOSTICS: 75, DOMAIN_FLUENCY: 78, TOOL_PROFICIENCY: 72, ARCHITECTURAL_REASONING: 80, FLUID_REASONING: 70, WORKING_MEMORY: 72, PROCESSING_SPEED: 68, METACOGNITIVE_AWARENESS: 80 },
    "william-burke-cand"
  ),
  // High potential researcher
  makeProfile("cand-11", "Lena Bergstrom", "Applied Mathematician", "Candidates", "none", "candidate",
    { PROCEDURAL_RELIABILITY: 60, COLLABORATIVE_CAPACITY: 65, ADAPTIVE_RESILIENCE: 72, LEADERSHIP_DISPOSITION: 48, SYSTEM_DIAGNOSTICS: 75, DOMAIN_FLUENCY: 85, TOOL_PROFICIENCY: 70, ARCHITECTURAL_REASONING: 82, FLUID_REASONING: 92, WORKING_MEMORY: 95, PROCESSING_SPEED: 65, METACOGNITIVE_AWARENESS: 88 },
    "lena-bergstrom-cand"
  ),
  // Collaborative builder
  makeProfile("cand-12", "Andre Jackson", "Platform Engineer", "Candidates", "none", "candidate",
    { PROCEDURAL_RELIABILITY: 75, COLLABORATIVE_CAPACITY: 92, ADAPTIVE_RESILIENCE: 85, LEADERSHIP_DISPOSITION: 82, SYSTEM_DIAGNOSTICS: 72, DOMAIN_FLUENCY: 70, TOOL_PROFICIENCY: 80, ARCHITECTURAL_REASONING: 75, FLUID_REASONING: 68, WORKING_MEMORY: 72, PROCESSING_SPEED: 78, METACOGNITIVE_AWARENESS: 75 },
    "andre-jackson-cand"
  ),
];

// ──────────────────────────────────────────────
// Teams
// ──────────────────────────────────────────────

export const MOCK_TEAMS: Team[] = [
  {
    id: "team-anvil",
    name: "Anvil",
    department: "Embedded Systems Division",
    missionType: "safety_critical_embedded",
    memberIds: anvilMembers.map((m) => m.id),
    candidateIds: ["cand-1", "cand-2", "cand-3", "cand-4", "cand-5", "cand-6", "cand-8", "cand-10"],
  },
  {
    id: "team-horizon",
    name: "Horizon",
    department: "Research & Development",
    missionType: "rd_applied_research",
    memberIds: horizonMembers.map((m) => m.id),
    candidateIds: ["cand-1", "cand-4", "cand-5", "cand-7", "cand-9", "cand-11"],
  },
  {
    id: "team-forge",
    name: "Forge",
    department: "Platform Engineering",
    missionType: "platform_infrastructure",
    memberIds: forgeMembers.map((m) => m.id),
    candidateIds: ["cand-1", "cand-2", "cand-4", "cand-7", "cand-8", "cand-10", "cand-12"],
  },
];

const allProfiles = [...anvilMembers, ...horizonMembers, ...forgeMembers, ...candidates];

export const MOCK_PROFILES: Record<string, IndividualProfile> = Object.fromEntries(
  allProfiles.map((p) => [p.id, p])
);

export function getTeamMembers(team: Team): IndividualProfile[] {
  return team.memberIds.map((id) => MOCK_PROFILES[id]).filter(Boolean);
}

export function getTeamCandidates(team: Team): IndividualProfile[] {
  return team.candidateIds.map((id) => MOCK_PROFILES[id]).filter(Boolean);
}

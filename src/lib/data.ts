import prisma from "@/lib/prisma";
import { type AppUserRole, filterCandidateForRole } from "@/lib/rbac";
import { CONSTRUCTS } from "@/lib/constructs";
import type { Construct } from "@/generated/prisma/enums";
import { CURRENT_PROMPT_VERSION as CURRENT_COGNITIVE_SIGNATURE_PROMPT_VERSION } from "@/lib/assessment/prompts/cognitive-signature";
import {
  type OrgConstructDistribution,
  quartileLabel,
} from "@/lib/assessment/org-distribution";

// Re-export so existing call sites keep importing from `@/lib/data`.
export { quartileLabel };
export type { OrgConstructDistribution };

/**
 * Shared data-fetching helpers used by both the live dashboard and tutorial demo.
 * Each function accepts an optional orgId to scope queries.
 */

export async function getDashboardData(orgId: string, opts?: { userId?: string; role?: AppUserRole }) {
  const isEC = opts?.role === "EXTERNAL_COLLABORATOR" && opts?.userId;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = { orgId };
  if (isEC) {
    where.assignments = { some: { userId: opts.userId } };
  }
  const roleWhere = { orgId };

  const [candidates, roles] = await Promise.all([
    prisma.candidate.findMany({
      where,
      include: {
        primaryRole: true,
        assessment: {
          include: {
            compositeScores: true,
            redFlags: { where: { archivedAt: null } },
          },
        },
      },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.role.findMany({
      where: roleWhere,
      include: {
        candidates: true,
      },
    }),
  ]);

  const rolePipelines = roles.map((role) => {
    const roleCandidates = candidates.filter((c) => c.primaryRoleId === role.id);
    return {
      slug: role.slug,
      name: role.name,
      isCustom: role.isCustom,
      complexityLevel: role.complexityLevel,
      sourceType: role.sourceType,
      total: roleCandidates.length,
      recommended: roleCandidates.filter((c) => c.status === "RECOMMENDED").length,
      review: roleCandidates.filter((c) => c.status === "REVIEW_REQUIRED").length,
      doNotAdvance: roleCandidates.filter((c) => c.status === "DO_NOT_ADVANCE").length,
    };
  });

  const totalAssessed = candidates.length;
  const recommended = candidates.filter((c) => c.status === "RECOMMENDED").length;
  const strongFitRate = totalAssessed > 0 ? Math.round((recommended / totalAssessed) * 100) : 0;

  const durations = candidates
    .map((c) => c.assessment?.durationMinutes)
    .filter((d): d is number => d != null);
  const avgDuration = durations.length > 0 ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0;

  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
  const weeklyVolume = candidates.filter((c) => new Date(c.createdAt) > oneWeekAgo).length;

  const serialized = JSON.parse(JSON.stringify(candidates));
  const filtered = opts?.role
    ? serialized.map((c: unknown) => filterCandidateForRole(c, opts.role!))
    : serialized;

  return {
    candidates: filtered,
    rolePipelines,
    stats: { totalAssessed, strongFitRate, avgDuration, weeklyVolume },
  };
}

export async function getCandidateData(id: string, orgId: string, opts?: { userId?: string; role?: AppUserRole }) {
  const candidate = await prisma.candidate.findUnique({
    where: { id },
    include: {
      primaryRole: true,
      notes: {
        include: { author: true },
        orderBy: { createdAt: "desc" },
      },
      assessment: {
        include: {
          subtestResults: true,
          compositeScores: true,
          predictions: { where: { archivedAt: null } },
          redFlags: { where: { archivedAt: null } },
          aiInteractions: true,
        },
      },
      outcomes: {
        orderBy: { observedAt: "desc" },
      },
    },
  });

  if (!candidate) return null;

  // Verify candidate belongs to the requesting org
  if (candidate.orgId !== orgId) return null;

  // External collaborators can only view candidates assigned to them
  if (opts?.role === "EXTERNAL_COLLABORATOR" && opts?.userId) {
    const assignment = await prisma.candidateAssignment.findUnique({
      where: { candidateId_userId: { candidateId: id, userId: opts.userId } },
    });
    if (!assignment) return null;
  }

  const allRoles = await prisma.role.findMany({
    where: { orgId },
    include: { compositeWeights: true },
  });

  const cutlines = await prisma.cutline.findMany({
    where: { orgId },
  });

  const serialized = JSON.parse(JSON.stringify(candidate));
  const filteredCandidate = opts?.role
    ? filterCandidateForRole(serialized, opts.role)
    : serialized;

  return {
    candidate: filteredCandidate,
    allRoles: JSON.parse(JSON.stringify(allRoles)),
    cutlines: JSON.parse(JSON.stringify(cutlines)),
  };
}

export async function getRolesData(orgId: string) {
  const where = { orgId };

  const roles = await prisma.role.findMany({
    where,
    include: {
      compositeWeights: true,
      cutlines: true,
      candidates: {
        include: {
          assessment: {
            include: {
              subtestResults: true,
              compositeScores: true,
              redFlags: { where: { archivedAt: null } },
            },
          },
        },
      },
    },
  });

  return JSON.parse(JSON.stringify(roles));
}

export async function getCompareData(ids: string[], orgId: string) {
  const candidates = await prisma.candidate.findMany({
    where: {
      id: { in: ids },
      orgId,
    },
    include: {
      primaryRole: true,
      assessment: {
        include: {
          subtestResults: true,
          compositeScores: true,
          predictions: { where: { archivedAt: null } },
          redFlags: { where: { archivedAt: null } },
        },
      },
    },
  });

  const roles = await prisma.role.findMany({
    where: { orgId },
    include: { compositeWeights: true },
  });

  return {
    candidates: JSON.parse(JSON.stringify(candidates)),
    roles: JSON.parse(JSON.stringify(roles)),
  };
}

export async function getHeatmapData(orgId: string) {
  const where = { orgId };

  const [candidates, roles, weights, cutlines] = await Promise.all([
    prisma.candidate.findMany({
      where,
      include: {
        primaryRole: true,
        assessment: {
          include: {
            subtestResults: true,
            compositeScores: true,
          },
        },
      },
    }),
    prisma.role.findMany({ where }),
    prisma.compositeWeight.findMany({
      where: { role: { orgId } },
    }),
    prisma.cutline.findMany({ where: { orgId } }),
  ]);

  return {
    candidates: JSON.parse(JSON.stringify(candidates)),
    roles: JSON.parse(JSON.stringify(roles)),
    weights: JSON.parse(JSON.stringify(weights)),
    cutlines: JSON.parse(JSON.stringify(cutlines)),
  };
}

export async function getRoleDetailData(slug: string, orgId: string) {
  const role = await prisma.role.findFirst({
    where: { slug, orgId },
    include: {
      compositeWeights: true,
      cutlines: true,
    },
  });

  if (!role) return null;

  const where = { orgId };
  const [allRoles, candidates] = await Promise.all([
    prisma.role.findMany({ where, orderBy: { name: "asc" } }),
    prisma.candidate.findMany({
      where,
      include: {
        primaryRole: true,
        assessment: {
          include: {
            subtestResults: true,
            compositeScores: true,
            redFlags: { where: { archivedAt: null } },
          },
        },
      },
    }),
  ]);

  return {
    role: JSON.parse(JSON.stringify(role)),
    allRoles: JSON.parse(JSON.stringify(allRoles)),
    candidates: JSON.parse(JSON.stringify(candidates)),
  };
}

/**
 * PRO-129: People Table data fetcher.
 * Returns all converted employees for an org. Client filters/sorts via useMemo.
 */
export async function getEmployeesData(orgId: string) {
  const employees = await prisma.candidate.findMany({
    where: {
      orgId,
      assessment: {
        assessmentMode: "EMPLOYEE",
      },
    },
    include: {
      primaryRole: { select: { name: true, slug: true } },
      assessment: {
        select: {
          id: true,
          completedAt: true,
          convertedAt: true,
          department: true,
          roleFamily: true,
          employeeStatus: true,
        },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  return JSON.parse(JSON.stringify(employees));
}

/**
 * PRO-178: Suggestion lists for the conversion modal's Department + Role Family
 * comboboxes. Returns distinct stored values across the org's assessments,
 * sorted case-insensitively (so duplicates like "Engineering"/"engineering"
 * land adjacent and stay visible — we don't normalize).
 */
export async function getOrgDepartmentsAndRoleFamilies(orgId: string) {
  const rows = await prisma.assessment.findMany({
    where: {
      candidate: { orgId },
      OR: [{ department: { not: null } }, { roleFamily: { not: null } }],
    },
    select: { department: true, roleFamily: true },
  });
  const sortCi = (a: string, b: string) => a.toLowerCase().localeCompare(b.toLowerCase());
  const departments = Array.from(
    new Set(rows.map((r) => r.department).filter((v): v is string => !!v)),
  ).sort(sortCi);
  const roleFamilies = Array.from(
    new Set(rows.map((r) => r.roleFamily).filter((v): v is string => !!v)),
  ).sort(sortCi);
  return { departments, roleFamilies };
}

/**
 * PRO-130: Employee Dossier data fetcher.
 * Returns a single employee's dossier-ready data scoped to the user's org.
 * Deliberately omits redFlags and predictions — those are archived in employee mode.
 */
export async function getEmployeeDossierData(employeeId: string, orgId: string) {
  const candidate = await prisma.candidate.findFirst({
    where: {
      id: employeeId,
      orgId,
      assessment: { assessmentMode: "EMPLOYEE" },
    },
    include: {
      primaryRole: { select: { name: true, slug: true } },
      assessment: {
        select: {
          id: true,
          completedAt: true,
          convertedAt: true,
          department: true,
          roleFamily: true,
          employeeStatus: true,
          cognitiveSignature: true,
          // PRO-134: needed so a stale-version row reads as null and the client
          // triggers regeneration on mount (skeleton, never v1 evaluative text).
          cognitiveSignaturePromptVersion: true,
          subtestResults: { select: { construct: true, percentile: true, layer: true } },
        },
      },
    },
  });
  if (!candidate) return null;

  // PRO-134: zero-leak regeneration window. If the cached signature was written
  // under a previous prompt version, treat it as null on the read path so the
  // client component sees null → renders skeleton → POSTs the regen route → v2
  // narrative replaces the skeleton. Never v1 evaluative text on screen.
  const a = candidate.assessment;
  if (
    a &&
    a.cognitiveSignature !== null &&
    a.cognitiveSignaturePromptVersion < CURRENT_COGNITIVE_SIGNATURE_PROMPT_VERSION
  ) {
    a.cognitiveSignature = null;
  }
  return JSON.parse(JSON.stringify(candidate));
}

// ─── PRO-132: Evidence Layer (Layer 3) ───────────────────────────────────────

/** Minimum content length for a message to qualify as an evidence excerpt.
 * Filters out useless one-liners ("yeah, sometimes") that score high but
 * read as junk evidence to a manager. */
const EVIDENCE_MIN_CONTENT_LENGTH = 50;

export interface EvidenceLayerEntry {
  construct: string;
  message: { id: string; content: string } | null;
  annotation: string | null;
  promptVersion: number | null;
  /** True when annotation is non-null AND promptVersion matches the current. */
  hasCurrentAnnotation: boolean;
}

/**
 * Per-construct evidence map for the Employee Dossier Layer 3 (PRO-132).
 *
 * For each of the 12 constructs:
 *   - find the highest-aggregateScore CANDIDATE message with content.length >= 50
 *   - left-join the cached EvidenceAnnotation (if any)
 *
 * Lazy-on-expand generation in the API route fills in missing annotations.
 */
export async function getEvidenceLayerData(
  assessmentId: string,
  currentPromptVersion: number,
): Promise<EvidenceLayerEntry[]> {
  // AIEvaluationRun.messageId is a loose string FK (no relation declared in
  // schema), so we fetch runs and messages separately and join in app code.
  const [runs, annotations] = await Promise.all([
    prisma.aIEvaluationRun.findMany({
      where: { assessmentId },
      orderBy: { aggregateScore: "desc" },
    }),
    prisma.evidenceAnnotation.findMany({ where: { assessmentId } }),
  ]);

  const messageIds = Array.from(new Set(runs.map((r) => r.messageId)));
  const messages =
    messageIds.length === 0
      ? []
      : await prisma.conversationMessage.findMany({
          where: { id: { in: messageIds }, role: "CANDIDATE" },
          select: { id: true, content: true },
        });
  const messageById = new Map(messages.map((m) => [m.id, m]));

  // Group runs by construct and pick the top qualifying CANDIDATE message per construct.
  const topByConstruct = new Map<string, { id: string; content: string }>();
  for (const run of runs) {
    if (topByConstruct.has(run.construct)) continue;
    const msg = messageById.get(run.messageId);
    if (!msg) continue; // not a candidate message (filtered above) or missing
    if (msg.content.length < EVIDENCE_MIN_CONTENT_LENGTH) continue;
    topByConstruct.set(run.construct, { id: msg.id, content: msg.content });
  }

  const annotationByConstruct = new Map(annotations.map((a) => [a.construct, a]));

  // Iterate the 12 constructs in CONSTRUCTS insertion order so the layer
  // mirrors the radar chart's spoke ordering.
  const constructCodes = Object.keys(CONSTRUCTS) as Construct[];
  return constructCodes.map((code) => {
    const message = topByConstruct.get(code) ?? null;
    const annotation = annotationByConstruct.get(code);
    const hasCurrent =
      annotation !== undefined &&
      annotation.annotation !== null &&
      annotation.promptVersion === currentPromptVersion;
    return {
      construct: code,
      message,
      annotation: annotation?.annotation ?? null,
      promptVersion: annotation?.promptVersion ?? null,
      hasCurrentAnnotation: hasCurrent,
    };
  });
}

// ─── PRO-134: Org-wide construct distributions ──────────────────────────────

/**
 * Per-construct quartile breakpoints for an org's existing assessments.
 * Lets Employee Mode dossier surfaces render "Top quartile in our company on
 * Ambiguity Tolerance" instead of "73rd percentile of candidates".
 *
 * Computed on-the-fly. No caching for v1 — small orgs, small data. Add
 * memoization or a scheduled recomputation if dossier latency becomes an issue.
 */
export async function getOrgConstructDistributions(
  orgId: string,
): Promise<OrgConstructDistribution[]> {
  const rows = await prisma.subtestResult.findMany({
    where: { assessment: { candidate: { orgId } } },
    select: { construct: true, percentile: true },
  });

  const byConstruct = new Map<string, number[]>();
  for (const r of rows) {
    const arr = byConstruct.get(r.construct) ?? [];
    arr.push(r.percentile);
    byConstruct.set(r.construct, arr);
  }

  const result: OrgConstructDistribution[] = [];
  for (const code of Object.keys(CONSTRUCTS)) {
    const arr = byConstruct.get(code) ?? [];
    const sorted = [...arr].sort((a, b) => a - b);
    const n = sorted.length;
    result.push({
      construct: code,
      q1: n ? sorted[Math.floor(n * 0.25)] : 0,
      q2: n ? sorted[Math.floor(n * 0.5)] : 0,
      q3: n ? sorted[Math.floor(n * 0.75)] : 0,
      sampleSize: n,
    });
  }
  return result;
}

/**
 * Get the demo organization ID for a given industry segment.
 * Falls back to the first demo org if no industry is specified or matched.
 */
const DEMO_ORG_SLUGS: Record<string, string> = {
  "defense-manufacturing": "atlas-defense",
  "space-satellite": "orbital-dynamics",
  "hardware-ai": "nexus-robotics",
  "ai-software": "vertex-ai-labs",
};

export async function getDemoOrgId(industry?: string | null): Promise<string | null> {
  const slug = industry ? DEMO_ORG_SLUGS[industry] : null;
  const org = await prisma.organization.findFirst({
    where: slug ? { slug, isDemo: true } : { isDemo: true },
  });
  return org?.id ?? null;
}

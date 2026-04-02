import prisma from "@/lib/prisma";
import { type AppUserRole, filterCandidateForRole } from "@/lib/rbac";

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
            redFlags: true,
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
          predictions: true,
          redFlags: true,
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
              redFlags: true,
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
          predictions: true,
          redFlags: true,
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
            redFlags: true,
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

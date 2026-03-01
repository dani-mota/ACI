import prisma from "@/lib/prisma";

/**
 * Shared data-fetching helpers used by both the live dashboard and tutorial demo.
 * Each function accepts an optional orgId to scope queries.
 */

export async function getDashboardData(orgId?: string) {
  const where = orgId ? { orgId } : {};
  const roleWhere = orgId ? { orgId } : {};

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

  return {
    candidates: JSON.parse(JSON.stringify(candidates)),
    rolePipelines,
    stats: { totalAssessed, strongFitRate, avgDuration, weeklyVolume },
  };
}

export async function getCandidateData(id: string, orgId?: string) {
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

  // If orgId provided, verify candidate belongs to that org
  if (orgId && candidate.orgId !== orgId) return null;

  const roleWhere = orgId ? { orgId } : {};
  const allRoles = await prisma.role.findMany({
    where: roleWhere,
    include: { compositeWeights: true },
  });

  const cutlines = await prisma.cutline.findMany({
    where: orgId ? { orgId } : {},
  });

  return {
    candidate: JSON.parse(JSON.stringify(candidate)),
    allRoles: JSON.parse(JSON.stringify(allRoles)),
    cutlines: JSON.parse(JSON.stringify(cutlines)),
  };
}

export async function getRolesData(orgId?: string) {
  const where = orgId ? { orgId } : {};

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

export async function getCompareData(ids: string[], orgId?: string) {
  const candidates = await prisma.candidate.findMany({
    where: {
      id: { in: ids },
      ...(orgId ? { orgId } : {}),
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

  const roleWhere = orgId ? { orgId } : {};
  const roles = await prisma.role.findMany({
    where: roleWhere,
    include: { compositeWeights: true },
  });

  return {
    candidates: JSON.parse(JSON.stringify(candidates)),
    roles: JSON.parse(JSON.stringify(roles)),
  };
}

export async function getHeatmapData(orgId?: string) {
  const where = orgId ? { orgId } : {};

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
      where: orgId ? { role: { orgId } } : {},
    }),
    prisma.cutline.findMany({ where: orgId ? { orgId } : {} }),
  ]);

  return {
    candidates: JSON.parse(JSON.stringify(candidates)),
    roles: JSON.parse(JSON.stringify(roles)),
    weights: JSON.parse(JSON.stringify(weights)),
    cutlines: JSON.parse(JSON.stringify(cutlines)),
  };
}

export async function getRoleDetailData(slug: string, orgId?: string) {
  const role = await prisma.role.findFirst({
    where: { slug, ...(orgId ? { orgId } : {}) },
    include: {
      compositeWeights: true,
      cutlines: true,
    },
  });

  if (!role) return null;

  const where = orgId ? { orgId } : {};
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
 * Get the demo organization ID. Returns null if no demo org exists.
 */
export async function getDemoOrgId(): Promise<string | null> {
  const org = await prisma.organization.findFirst({
    where: { isDemo: true },
  });
  return org?.id ?? null;
}

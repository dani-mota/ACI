/**
 * PRO-137: Prisma I/O helpers for EmployeeInsights.
 *
 * Keeps the pure compute layer (`under-leverage.ts`) free of Prisma.
 * Callers at the three invalidation trigger sites (conversion, profile
 * save, scoring-pipeline completion) reuse the same helper.
 */

import prisma from "@/lib/prisma";
import { resolveRoleDemandProfileForEmployee } from "@/lib/data";
import { computeRoleFitDelta } from "@/lib/assessment/insights/role-fit-delta";
import { computeUnderLeverageScore } from "@/lib/assessment/insights/under-leverage";

/**
 * Recomputes the under-leverage score for one assessment, upserts the
 * EmployeeInsights row, and returns the computed score so callers can
 * avoid a re-read.
 *
 * Idempotent + deterministic. Concurrent stale-recompute requests
 * converge on the same value because the compute is a pure function of
 * (subtestResults, demands) at read time — no locking needed. If the
 * compute is ever made non-deterministic, this property breaks; revisit
 * then.
 *
 * Side effects: 2 Prisma reads (resolve profile, fetch subtest results)
 * + 1 upsert. Caller is responsible for whether this runs inside or
 * outside a transaction — see the three call sites for context.
 */
export async function recomputeUnderLeverageForAssessment(
  assessmentId: string,
  orgId: string,
  roleFamily: string,
): Promise<number | null> {
  const resolved = await resolveRoleDemandProfileForEmployee(orgId, roleFamily);
  const results = await prisma.subtestResult.findMany({
    where: { assessmentId },
    select: { construct: true, percentile: true },
  });
  const deltas = resolved ? computeRoleFitDelta(results, resolved.demands) : [];
  const score = resolved ? computeUnderLeverageScore(deltas) : null;

  await prisma.employeeInsights.upsert({
    where: { assessmentId },
    create: {
      assessmentId,
      underLeverageScore: score,
      orgId,
      roleFamily,
      profileId: resolved?.profileId ?? null,
      profileUpdatedAt: resolved?.updatedAt ?? null,
    },
    update: {
      underLeverageScore: score,
      orgId,
      roleFamily,
      profileId: resolved?.profileId ?? null,
      profileUpdatedAt: resolved?.updatedAt ?? null,
    },
  });

  return score;
}

/**
 * Batch invalidation on role-demand profile save. Marks every
 * EmployeeInsights row in the affected (orgId, roleFamily) set as stale
 * by nulling profileUpdatedAt + profileId. The next dossier read for
 * each row triggers lazy recompute.
 *
 * Single indexed UPDATE — no N+1, no eager recompute. Uses the
 * EmployeeInsights_orgId_roleFamily_idx index. Case-insensitive
 * roleFamily match mirrors PRO-135's resolver semantics.
 *
 * Sort-accuracy trade-off (documented in PR description): between save
 * and the first dossier read on each affected employee, People Table
 * sort uses stale scores. Mitigation via refresh cron is out of scope.
 */
export async function batchInvalidateByRoleFamily(
  orgId: string,
  roleFamily: string,
): Promise<number> {
  // $executeRaw returns affected row count.
  return prisma.$executeRaw`
    UPDATE "EmployeeInsights"
    SET "profileUpdatedAt" = NULL, "profileId" = NULL
    WHERE "orgId" = ${orgId}
      AND LOWER("roleFamily") = LOWER(${roleFamily})
  `;
}

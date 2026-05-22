import { notFound, redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import {
  getEmployeeDossierData,
  getEvidenceLayerData,
  getOrgConstructDistributions,
  resolveRoleDemandProfileForEmployee,
} from "@/lib/data";
import { canAccessMode } from "@/lib/rbac";
import { getEmployeeDataVisibility } from "@/lib/employee-permissions";
import { EmployeeDossier } from "@/components/dashboard/employee-dossier";
import { CURRENT_PROMPT_VERSION as EVIDENCE_PROMPT_VERSION } from "@/lib/assessment/prompts/evidence-annotation";
import { recomputeUnderLeverageForAssessment } from "@/lib/assessment/insights/employee-insights-persistence";
import { computeTrajectoryReadiness } from "@/lib/assessment/insights/trajectory-readiness";
import { ARCHETYPE_LIBRARY } from "@/lib/assessment/archetypes";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EmployeeDossierPage({ params }: PageProps) {
  const session = await requireAuth();

  // PRO-133 mode-level gate.
  if (!canAccessMode(session, "employees")) {
    redirect("/dashboard");
  }

  const { id } = await params;
  const data = await getEmployeeDossierData(id, session.user.orgId);

  // 404 (not 403) for cross-org or non-EMPLOYEE — don't leak existence
  if (!data) notFound();

  // PRO-133 PR#2 per-target capability gate. EMPLOYEE sees only their own
  // dossier (Candidate.userId === session.user.id); PEOPLE_MANAGER sees
  // only direct reports (User.managerId === session.user.id); HR/TA/ADMIN
  // see org-wide. "none" = redirect to dashboard.
  // Known UX gap (follow-up): a friendly "you don't have access" page
  // would be clearer than a silent redirect. Out of scope for PR#2.
  const visibility = getEmployeeDataVisibility("constructs", {
    session,
    targetEmployeeUserId: data.user?.id ?? null,
    targetEmployeeManagerId: data.user?.managerId ?? null,
  });
  if (visibility === "none") {
    redirect("/dashboard");
  }

  // PRO-132: per-construct evidence map.
  // PRO-134: org-wide quartile breakpoints for the developmental "Top quartile
  //   in our company on X" tooltip line.
  // PRO-135: org-scoped role demand profile for the radar overlay.
  // All three fetches are independent of the dossier; run in parallel.
  const [evidence, orgDistributions, resolvedDemand] = await Promise.all([
    getEvidenceLayerData(data.assessment.id, EVIDENCE_PROMPT_VERSION),
    getOrgConstructDistributions(session.user.orgId),
    resolveRoleDemandProfileForEmployee(session.user.orgId, data.assessment.roleFamily),
  ]);

  // PRO-137: lazy-on-read under-leverage staleness check. Compare cached
  // (profileId, profileUpdatedAt) against the just-resolved demand profile.
  // If mismatched (profile was edited since last cache, never computed, or
  // batch-invalidated by a profile save), recompute synchronously and use
  // the fresh score. Concurrent stale-recompute requests converge on the
  // same value because the compute is pure of its inputs — see
  // employee-insights-persistence.ts docstring.
  let underLeverageScore = data.assessment.insights?.underLeverageScore ?? null;
  const cachedProfileId = data.assessment.insights?.profileId ?? null;
  const cachedProfileUpdatedAt = data.assessment.insights?.profileUpdatedAt
    ? new Date(data.assessment.insights.profileUpdatedAt).getTime()
    : null;
  const resolvedProfileId = resolvedDemand?.profileId ?? null;
  const resolvedProfileUpdatedAt = resolvedDemand?.updatedAt?.getTime() ?? null;
  const stale =
    cachedProfileId !== resolvedProfileId ||
    cachedProfileUpdatedAt !== resolvedProfileUpdatedAt;
  if (stale && data.assessment.roleFamily) {
    underLeverageScore = await recomputeUnderLeverageForAssessment(
      data.assessment.id,
      session.user.orgId,
      data.assessment.roleFamily,
    );
  }

  // PRO-138: trajectory readiness, gated by visibility. Compute returns null
  // until commit 3 lands the real metric (held pending Dani confirmation of
  // Euclidean vs cosine). Page-level gate also returns null for EXECUTIVE
  // (visibility "aggregated") since no individual panel is shipped for that
  // role in PRO-138 — PRO-145 owns the aggregated-executive view.
  const trajectoryVisibility = getEmployeeDataVisibility("trajectoryReadiness", {
    session,
    targetEmployeeUserId: data.user?.id ?? null,
    targetEmployeeManagerId: data.user?.managerId ?? null,
  });
  const trajectory =
    trajectoryVisibility === "full"
      ? computeTrajectoryReadiness(data.assessment.subtestResults, ARCHETYPE_LIBRARY)
      : null;

  // PRO-135: pass `undefined` (NOT `[]`) when no profile resolves — empty
  // arrays would render a degenerate collapsed overlay polygon at radius zero.
  // PRO-139 PR#2: `nextLevelDemand` is wired through as `undefined` until
  // PR#1's schema + resolver extension land. Once `RoleDemandProfile.nextLevelProfileId`
  // exists and `resolveRoleDemandProfileForEmployee` eager-loads it via
  // Prisma `include`, this becomes `resolvedDemand?.nextLevel?.demands`. The
  // Promotion Fit tab renders the empty-state copy in the meantime.
  return (
    <EmployeeDossier
      candidate={data}
      initialEvidence={evidence}
      orgDistributions={orgDistributions}
      roleDemandProfile={resolvedDemand?.demands}
      nextLevelDemand={undefined}
      underLeverageScore={underLeverageScore}
      trajectory={trajectory}
    />
  );
}

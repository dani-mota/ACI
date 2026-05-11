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

  // PRO-135: pass `undefined` (NOT `[]`) when no profile resolves — empty
  // arrays would render a degenerate collapsed overlay polygon at radius zero.
  return (
    <EmployeeDossier
      candidate={data}
      initialEvidence={evidence}
      orgDistributions={orgDistributions}
      roleDemandProfile={resolvedDemand?.demands}
    />
  );
}

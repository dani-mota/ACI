import { notFound, redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import {
  getEmployeeDossierData,
  getEvidenceLayerData,
  getOrgConstructDistributions,
  resolveRoleDemandProfileForEmployee,
} from "@/lib/data";
import { canAccessMode } from "@/lib/rbac";
import { EmployeeDossier } from "@/components/dashboard/employee-dossier";
import { CURRENT_PROMPT_VERSION as EVIDENCE_PROMPT_VERSION } from "@/lib/assessment/prompts/evidence-annotation";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EmployeeDossierPage({ params }: PageProps) {
  const session = await requireAuth();

  // RBAC: same gate as the Employees dashboard tab (PRO-128 MODE_ACCESS).
  // TODO(PRO-133): expand canAccessMode to include PEOPLE_MANAGER and HR_TALENT_LEADER.
  if (!canAccessMode(session.user.role, "employees")) {
    redirect("/dashboard");
  }

  const { id } = await params;
  const data = await getEmployeeDossierData(id, session.user.orgId);

  // 404 (not 403) for cross-org or non-EMPLOYEE — don't leak existence
  if (!data) notFound();

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

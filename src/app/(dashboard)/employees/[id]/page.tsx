import { notFound, redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { getEmployeeDossierData } from "@/lib/data";
import { canAccessMode } from "@/lib/rbac";
import { EmployeeDossier } from "@/components/dashboard/employee-dossier";

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

  return <EmployeeDossier candidate={data} />;
}

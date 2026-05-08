export const dynamic = "force-dynamic";

import { getDashboardData, getEmployeesData } from "@/lib/data";
import { requireAuth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PipelineCards } from "@/components/dashboard/pipeline-cards";
import { QuickStats } from "@/components/dashboard/quick-stats";
import { CandidateTable } from "@/components/dashboard/candidate-table";
import { AttentionItems } from "@/components/dashboard/attention-items";
import { EmptyState } from "@/components/dashboard/empty-state";
import { InviteButton } from "@/components/invitation/invite-button";
import { ModeTabs } from "@/components/dashboard/mode-tabs";
import { PeopleTable } from "@/components/dashboard/people-table";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { getAccessibleModes, type DashboardMode, type AppUserRole } from "@/lib/rbac";

interface PageProps {
  searchParams: Promise<{ mode?: string }>;
}

export default async function DashboardPage({ searchParams }: PageProps) {
  const session = await requireAuth();
  const orgId = session.user.orgId;
  const params = await searchParams;

  const accessibleModes = getAccessibleModes(session);
  const requestedMode = params.mode as DashboardMode | undefined;

  if (!requestedMode || !accessibleModes.includes(requestedMode)) {
    redirect(`/dashboard?mode=${accessibleModes[0]}`);
  }

  const activeMode = requestedMode;
  const canCreateRole = ["TA_LEADER", "ADMIN"].includes(session.user.role);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground" style={{ fontFamily: "var(--font-dm-sans)" }}>
            Assessment Dashboard
          </h1>
          <p className="text-xs text-muted-foreground mt-1 uppercase tracking-wider">
            Overview of your talent assessment pipeline
          </p>
        </div>
        {activeMode === "candidates" && canCreateRole && (
          <Link href="/roles/new">
            <Button variant="outline" size="sm" className="gap-1.5 rounded-lg">
              <Plus className="w-3.5 h-3.5" />
              New Role
            </Button>
          </Link>
        )}
      </div>

      <ModeTabs accessibleModes={accessibleModes} activeMode={activeMode} />

      {activeMode === "candidates" && (
        <CandidatesContent orgId={orgId} userId={session.user.id} role={session.user.role} canCreateRole={canCreateRole} />
      )}
      {activeMode === "employees" && <EmployeesContent orgId={orgId} />}
    </div>
  );
}

async function EmployeesContent({ orgId }: { orgId: string }) {
  const employees = await getEmployeesData(orgId);
  return <PeopleTable employees={employees} />;
}

async function CandidatesContent({
  orgId,
  userId,
  role,
  canCreateRole,
}: {
  orgId: string;
  userId: string;
  role: AppUserRole;
  canCreateRole: boolean;
}) {
  const { candidates, rolePipelines, stats } = await getDashboardData(orgId, {
    userId,
    role,
  });

  const roles = await prisma.role.findMany({
    where: { orgId },
    include: { compositeWeights: true },
  });
  const serializedRoles = JSON.parse(JSON.stringify(roles));

  if (candidates.length === 0) {
    return <EmptyState roles={serializedRoles} canCreateRole={canCreateRole} />;
  }

  return (
    <>
      <div className="flex justify-end">
        <InviteButton roles={serializedRoles} canCreateRole={canCreateRole} />
      </div>
      <QuickStats {...stats} />
      <AttentionItems candidates={candidates} />
      <div>
        <h2 className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-3">Pipeline by Role</h2>
        <PipelineCards roles={rolePipelines} />
      </div>
      <div>
        <h2 className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-3">All Candidates</h2>
        <CandidateTable candidates={candidates} />
      </div>
    </>
  );
}

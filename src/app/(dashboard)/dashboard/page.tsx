export const dynamic = "force-dynamic";

import { getDashboardData } from "@/lib/data";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import Link from "next/link";
import { PipelineCards } from "@/components/dashboard/pipeline-cards";
import { QuickStats } from "@/components/dashboard/quick-stats";
import { CandidateTable } from "@/components/dashboard/candidate-table";
import { AttentionItems } from "@/components/dashboard/attention-items";
import { EmptyState } from "@/components/dashboard/empty-state";
import { InviteButton } from "@/components/invitation/invite-button";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export default async function DashboardPage() {
  const session = await getSession();
  const orgId = session?.user.orgId ?? undefined;
  const { candidates, rolePipelines, stats } = await getDashboardData(orgId);
  const canCreateRole = session?.user.role && ["TA_LEADER", "ADMIN"].includes(session.user.role);

  const roles = await prisma.role.findMany({
    where: orgId ? { orgId } : {},
    include: { compositeWeights: true },
  });
  const serializedRoles = JSON.parse(JSON.stringify(roles));

  if (candidates.length === 0) {
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
          {canCreateRole && (
            <Link href="/roles/new">
              <Button variant="outline" size="sm" className="gap-1.5">
                <Plus className="w-3.5 h-3.5" />
                New Role
              </Button>
            </Link>
          )}
        </div>
        <EmptyState roles={serializedRoles} canCreateRole={!!canCreateRole} />
      </div>
    );
  }

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
        <div className="flex items-center gap-2">
          {canCreateRole && (
            <Link href="/roles/new">
              <Button variant="outline" size="sm" className="gap-1.5">
                <Plus className="w-3.5 h-3.5" />
                New Role
              </Button>
            </Link>
          )}
          <InviteButton roles={serializedRoles} canCreateRole={!!canCreateRole} />
        </div>
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
    </div>
  );
}

import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { canManageTeam } from "@/lib/rbac";
import type { AppUserRole } from "@/lib/rbac";
import prisma from "@/lib/prisma";
import { TeamManagement } from "@/components/settings/team-management";
import { PendingRequests } from "@/components/settings/pending-requests";

export default async function TeamSettingsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!canManageTeam(session.user.role)) redirect("/dashboard");

  // Fetch pending access requests for this org
  const pendingRequests = await prisma.accessRequest.findMany({
    where: { orgId: session.user.orgId, status: "PENDING" },
    orderBy: { createdAt: "desc" },
  });

  // Check for deactivated users matching pending request emails
  const requestEmails = pendingRequests.map((r) => r.email);
  const deactivatedUsers = requestEmails.length > 0
    ? await prisma.user.findMany({
        where: {
          email: { in: requestEmails },
          orgId: session.user.orgId,
          isActive: false,
        },
        select: { email: true },
      })
    : [];
  const deactivatedEmails = new Set(deactivatedUsers.map((u) => u.email));

  const requestsForClient = pendingRequests.map((r) => ({
    id: r.id,
    email: r.email,
    firstName: r.firstName,
    lastName: r.lastName,
    jobTitle: r.jobTitle,
    reason: r.reason,
    requestedRole: r.requestedRole,
    createdAt: r.createdAt.toISOString(),
    deactivatedUserExists: deactivatedEmails.has(r.email),
  }));

  return (
    <div>
      <TeamManagement currentUser={session.user} />
      {requestsForClient.length > 0 && (
        <div className="max-w-[1200px] mx-auto px-6 pb-6">
          <PendingRequests
            requests={requestsForClient}
            currentUserRole={session.user.role as AppUserRole}
          />
        </div>
      )}
    </div>
  );
}

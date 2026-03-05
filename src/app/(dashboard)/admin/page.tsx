export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { AccessRequestsTable } from "@/components/admin/access-requests-table";

export default async function AdminPage() {
  const session = await requireAuth();

  if (session.user.role !== "ADMIN") {
    redirect("/dashboard");
  }

  // Platform admin sees only requests without an org (new company inquiries)
  const requests = await prisma.accessRequest.findMany({
    where: { orgId: null },
    orderBy: { createdAt: "desc" },
  });

  const organizations = await prisma.organization.findMany({
    where: { isDemo: false },
    orderBy: { name: "asc" },
  });

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1
          className="text-xl font-bold text-foreground"
          style={{ fontFamily: "var(--font-dm-sans)" }}
        >
          Admin
        </h1>
        <p className="text-xs text-muted-foreground mt-1 uppercase tracking-wider">
          Manage access requests and user approvals
        </p>
      </div>

      <AccessRequestsTable
        initialRequests={JSON.parse(JSON.stringify(requests))}
        organizations={JSON.parse(JSON.stringify(organizations))}
      />
    </div>
  );
}

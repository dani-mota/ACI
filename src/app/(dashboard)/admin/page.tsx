export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import prisma from "@/lib/prisma";

export default async function AdminPage() {
  const session = await requireAuth();

  if (session.user.role !== "ADMIN") {
    redirect("/dashboard");
  }

  const organizations = await prisma.organization.findMany({
    where: { isDemo: false },
    orderBy: { name: "asc" },
    include: { _count: { select: { users: true } } },
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
          Platform administration
        </p>
      </div>

      <div className="bg-card border border-border">
        <div className="px-4 py-3 border-b border-border">
          <h2 className="text-xs font-semibold text-foreground uppercase tracking-wider">
            Organizations
          </h2>
        </div>
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-2.5 px-3 text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Name</th>
              <th className="text-left py-2.5 px-3 text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Slug</th>
              <th className="text-left py-2.5 px-3 text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Domain</th>
              <th className="text-right py-2.5 px-3 text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Users</th>
            </tr>
          </thead>
          <tbody>
            {organizations.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-8 text-center text-muted-foreground text-xs">
                  No organizations provisioned yet
                </td>
              </tr>
            ) : (
              organizations.map((org) => (
                <tr key={org.id} className="border-b border-border last:border-0 hover:bg-accent/30">
                  <td className="py-2.5 px-3 font-medium text-foreground">{org.name}</td>
                  <td className="py-2.5 px-3 text-muted-foreground font-mono">{org.slug}</td>
                  <td className="py-2.5 px-3 text-muted-foreground">{org.domain || "—"}</td>
                  <td className="py-2.5 px-3 text-right text-muted-foreground">{org._count.users}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

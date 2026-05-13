import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";

// PRO-189: read-only profile page for the signed-in user. Wired from
// the top-right user menu's Profile item. Editing flows are out of
// scope for v1; file a follow-up if needed.
export default async function ProfilePage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const { user } = session;

  const [manager, org] = await Promise.all([
    user.managerId
      ? prisma.user.findUnique({
          where: { id: user.managerId },
          select: { name: true, email: true },
        })
      : Promise.resolve(null),
    prisma.organization.findUnique({
      where: { id: user.orgId },
      select: { name: true },
    }),
  ]);

  return (
    <div className="px-6 py-8 space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground tracking-tight">Profile</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Your account details. Contact your administrator to update name, email, or
          reporting lines.
        </p>
      </div>

      <div className="border border-border bg-card divide-y divide-border">
        <Row label="Name" value={user.name} />
        <Row label="Email" value={user.email} />
        <Row
          label="Role"
          value={
            <div className="flex items-center gap-2">
              <RolePill value={user.role} />
              {user.employeeRole && <RolePill value={user.employeeRole} />}
            </div>
          }
        />
        <Row
          label="Reports to"
          value={
            manager ? (
              <div className="flex flex-col">
                <span className="text-xs font-medium text-foreground">{manager.name}</span>
                <span className="text-[11px] text-muted-foreground">{manager.email}</span>
              </div>
            ) : (
              <span className="text-xs text-muted-foreground">No manager assigned</span>
            )
          }
        />
        <Row label="Organization" value={org?.name ?? "—"} />
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[180px_1fr] items-center px-4 py-3">
      <span className="text-[11px] uppercase tracking-wide font-medium text-muted-foreground">
        {label}
      </span>
      <div className="text-xs text-foreground">{value}</div>
    </div>
  );
}

function RolePill({ value }: { value: string }) {
  return (
    <span className="inline-block text-[10px] px-1.5 py-0.5 bg-aci-blue/10 text-aci-blue font-mono font-medium tracking-wide uppercase">
      {value.replace(/_/g, " ")}
    </span>
  );
}

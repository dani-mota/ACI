import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { MyTeamSection } from "@/components/team/my-team-section";

// PRO-184: PEOPLE_MANAGER + anyone else with direct reports can see
// their team here. Distinct from /settings/team (which is gated to
// canManageTeam roles only — ADMIN/TA_LEADER). This page has no role
// gate beyond authentication; the underlying endpoint enforces
// self-scoping for non-team-management roles.
export default async function MyTeamPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <div className="px-6 py-8 space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground tracking-tight">My team</h1>
        <p className="text-sm text-muted-foreground mt-1">
          The people who report directly to you. Contact your administrator to update
          reporting lines.
        </p>
      </div>
      <MyTeamSection userId={session.user.id} />
    </div>
  );
}

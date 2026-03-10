import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { canManageTeam } from "@/lib/rbac";
import { TeamManagement } from "@/components/settings/team-management";

export default async function TeamSettingsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!canManageTeam(session.user.role)) redirect("/dashboard");

  return (
    <div>
      <TeamManagement currentUser={session.user} />
    </div>
  );
}

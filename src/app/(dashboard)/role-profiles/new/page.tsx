import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { canView } from "@/lib/rbac";
import { RoleProfileEditor } from "@/components/dashboard/role-profile-editor";

export default async function NewRoleProfilePage() {
  const session = await requireAuth();
  if (!canView(session.user.role, "roleProfiles")) {
    redirect("/dashboard");
  }
  return <RoleProfileEditor mode="create" />;
}

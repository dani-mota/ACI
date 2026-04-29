import { notFound, redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { canView } from "@/lib/rbac";
import prisma from "@/lib/prisma";
import { RoleProfileEditor } from "@/components/dashboard/role-profile-editor";
import type { AuthoringScores } from "@/lib/assessment/role-demand-resolution";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EditRoleProfilePage({ params }: PageProps) {
  const session = await requireAuth();
  if (!canView(session.user.role, "roleProfiles")) {
    redirect("/dashboard");
  }

  const { id } = await params;
  const profile = await prisma.roleDemandProfile.findFirst({
    where: { id, orgId: session.user.orgId },
    select: {
      id: true,
      name: true,
      roleFamily: true,
      constructScores: true,
    },
  });

  // 404 (not 403) for cross-org or missing — don't leak existence.
  if (!profile) notFound();

  return (
    <RoleProfileEditor
      mode="edit"
      initial={{
        id: profile.id,
        name: profile.name,
        roleFamily: profile.roleFamily,
        constructScores: profile.constructScores as AuthoringScores,
      }}
    />
  );
}

import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { RoleBuilderInputClient } from "@/components/role-builder/input-client";

export const dynamic = "force-dynamic";

export default async function NewRolePage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!["TA_LEADER", "ADMIN"].includes(session.user.role)) redirect("/roles");

  // Fetch only system default templates for the Clone tab
  const templates = await prisma.role.findMany({
    where: { isCustom: false },
    select: { id: true, slug: true, name: true, description: true },
    orderBy: { name: "asc" },
  });

  return <RoleBuilderInputClient templates={templates} />;
}

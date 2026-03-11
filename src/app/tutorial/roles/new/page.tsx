import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { getDemoOrgId } from "@/lib/data";
import { TutorialRoleBuilderInput } from "@/components/tutorial/tutorial-role-builder-input";

export const dynamic = "force-dynamic";

export default async function TutorialNewRolePage() {
  const cookieStore = await cookies();
  const raw = cookieStore.get("aci-tutorial")?.value;
  const _parsed = raw ? JSON.parse(decodeURIComponent(raw)) : null;
  const industry = (_parsed?.state?.tutorialIndustry ?? _parsed?.tutorialIndustry ?? null) as string | null;
  const demoOrgId = await getDemoOrgId(industry);
  if (!demoOrgId) redirect("/tutorial");

  // Fetch demo org roles as clone templates
  const templates = await prisma.role.findMany({
    where: { orgId: demoOrgId },
    select: { id: true, slug: true, name: true, description: true },
    orderBy: { name: "asc" },
  });

  return <TutorialRoleBuilderInput templates={templates} />;
}

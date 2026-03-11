import { cookies } from "next/headers";
import { getRoleDetailData, getDemoOrgId } from "@/lib/data";
import { notFound, redirect } from "next/navigation";
import { RoleDetailClient } from "@/components/roles/role-detail-client";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function TutorialRoleDetailPage({ params }: PageProps) {
  const cookieStore = await cookies();
  const raw = cookieStore.get("aci-tutorial")?.value;
  const _parsed = raw ? JSON.parse(decodeURIComponent(raw)) : null;
  const industry = (_parsed?.state?.tutorialIndustry ?? _parsed?.tutorialIndustry ?? null) as string | null;
  const demoOrgId = await getDemoOrgId(industry);
  if (!demoOrgId) redirect("/tutorial");

  const { slug } = await params;
  const data = await getRoleDetailData(slug, demoOrgId);

  if (!data) notFound();

  return <RoleDetailClient {...data} />;
}

import { cookies } from "next/headers";
import { getCandidateData, getDemoOrgId } from "@/lib/data";
import { notFound, redirect } from "next/navigation";
import { ProfileClient } from "@/components/profile/profile-client";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function TutorialCandidateProfilePage({ params }: PageProps) {
  const cookieStore = await cookies();
  const raw = cookieStore.get("aci-tutorial")?.value;
  const _parsed = raw ? JSON.parse(decodeURIComponent(raw)) : null;
  const industry = (_parsed?.state?.tutorialIndustry ?? _parsed?.tutorialIndustry ?? null) as string | null;
  const demoOrgId = await getDemoOrgId(industry);
  if (!demoOrgId) redirect("/tutorial");

  const { id } = await params;
  const data = await getCandidateData(id, demoOrgId);

  if (!data) notFound();

  return <ProfileClient {...data} />;
}

import { getCandidateData } from "@/lib/data";
import { getSession } from "@/lib/auth";
import { notFound } from "next/navigation";
import { ProfileClient } from "@/components/profile/profile-client";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function CandidateProfilePage({ params }: PageProps) {
  const session = await getSession();
  const orgId = session?.user.orgId ?? undefined;
  const userRole = session?.user.role ?? undefined;
  const { id } = await params;
  const data = await getCandidateData(id, orgId);

  if (!data) notFound();

  return <ProfileClient {...data} userRole={userRole} />;
}

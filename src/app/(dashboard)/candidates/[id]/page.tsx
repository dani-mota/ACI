import { getCandidateData } from "@/lib/data";
import { requireAuth } from "@/lib/auth";
import { notFound } from "next/navigation";
import { ProfileClient } from "@/components/profile/profile-client";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function CandidateProfilePage({ params }: PageProps) {
  const session = await requireAuth();
  const orgId = session.user.orgId;
  const userRole = session.user.role;
  const { id } = await params;
  const data = await getCandidateData(id, orgId, {
    userId: session.user.id,
    role: session.user.role,
  });

  if (!data) notFound();

  return <ProfileClient {...data} userRole={userRole} />;
}

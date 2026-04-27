import { getCandidateData, getOrgDepartmentsAndRoleFamilies } from "@/lib/data";
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
  const [data, suggestions] = await Promise.all([
    getCandidateData(id, orgId, {
      userId: session.user.id,
      role: session.user.role,
    }),
    getOrgDepartmentsAndRoleFamilies(orgId),
  ]);

  if (!data) notFound();

  return <ProfileClient {...data} suggestions={suggestions} userRole={userRole} />;
}

import prisma from "@/lib/prisma";
import { OrgRequestForm } from "./org-request-form";
import { AuthCard } from "@/components/auth/auth-card";
import Link from "next/link";

export default async function OrgRequestAccessPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;

  const org = await prisma.organization.findUnique({
    where: { slug: orgSlug },
    select: { id: true, name: true },
  });

  // Generic error for any invalid slug — prevents org enumeration
  if (!org) {
    return (
      <AuthCard
        title="Invalid Link"
        subtitle="This link is not valid."
        footer={
          <span>
            Looking to evaluate ACI for your company?{" "}
            <Link href="/signup" className="text-aci-gold hover:text-aci-gold/80 font-medium">
              Request access
            </Link>
          </span>
        }
      >
        <div className="text-center py-4">
          <p className="text-sm text-muted-foreground">
            If you&apos;re looking to evaluate ACI for your company, visit our signup page.
          </p>
        </div>
      </AuthCard>
    );
  }

  return <OrgRequestForm orgId={org.id} orgName={org.name} />;
}

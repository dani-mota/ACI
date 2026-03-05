import prisma from "@/lib/prisma";
import { getRoleLabel } from "@/lib/rbac";
import type { AppUserRole } from "@/lib/rbac";
import { AcceptInviteForm } from "./accept-form";

export default async function AcceptInvitePage({
  params,
  searchParams,
}: {
  params: Promise<{ orgSlug: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const { orgSlug } = await params;
  const { token } = await searchParams;

  if (!token) {
    return <InvalidInvite />;
  }

  // Validate the token
  const invitation = await prisma.teamInvitation.findUnique({
    where: { token },
    include: { org: { select: { name: true, slug: true } } },
  });

  // Security: don't reveal whether the org exists or the token was ever valid
  if (
    !invitation ||
    invitation.org.slug !== orgSlug ||
    invitation.status !== "PENDING" ||
    invitation.expiresAt <= new Date()
  ) {
    return <InvalidInvite />;
  }

  return (
    <AcceptInviteForm
      token={token}
      orgName={invitation.org.name}
      orgSlug={invitation.org.slug}
      role={invitation.role as AppUserRole}
      roleLabel={getRoleLabel(invitation.role as AppUserRole)}
      prefillName={invitation.name || ""}
      email={invitation.email}
    />
  );
}

function InvalidInvite() {
  return (
    <div className="w-full max-w-md mx-auto">
      <div className="bg-card border border-border shadow-lg p-8 relative z-10">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold tracking-tight text-foreground" style={{ fontFamily: "var(--font-dm-sans)" }}>
            ACI
          </h1>
          <p className="text-[10px] tracking-[0.3em] text-muted-foreground mt-1 uppercase font-mono">
            Arklight Cognitive Index
          </p>
        </div>
        <h2 className="text-lg font-semibold text-foreground mb-2">Invalid Invitation</h2>
        <p className="text-sm text-muted-foreground mb-6">
          This invitation link is no longer valid. Please contact your team administrator for a new invitation.
        </p>
        <a
          href="/login"
          className="block w-full text-center text-sm text-aci-blue hover:text-aci-blue/80"
        >
          Go to Login
        </a>
      </div>
    </div>
  );
}

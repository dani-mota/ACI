import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { isExternalCollaborator } from "@/lib/rbac";
import { BatchInviteClient } from "./batch-invite-client";

export default async function BatchInvitePage() {
  const session = await requireAuth();
  if (isExternalCollaborator(session.user.role)) redirect("/dashboard");

  return <BatchInviteClient />;
}

import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { ReviewShell } from "@/components/role-builder/review-shell";

export const dynamic = "force-dynamic";

export default async function RoleBuilderReviewPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!["TA_LEADER", "ADMIN"].includes(session.user.role)) redirect("/roles");

  return <ReviewShell />;
}

export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { getHeatmapData } from "@/lib/data";
import { requireAuth } from "@/lib/auth";
import { isExternalCollaborator } from "@/lib/rbac";
import { HeatmapClient } from "@/components/roles/heatmap-client";

export default async function RolesPage() {
  const session = await requireAuth();
  if (isExternalCollaborator(session.user.role)) redirect("/dashboard");
  const orgId = session.user.orgId;
  const data = await getHeatmapData(orgId);
  return <HeatmapClient {...data} />;
}

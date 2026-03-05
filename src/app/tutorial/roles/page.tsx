import { getHeatmapData, getDemoOrgId } from "@/lib/data";
import { HeatmapClient } from "@/components/roles/heatmap-client";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function TutorialRolesPage() {
  const demoOrgId = await getDemoOrgId();
  if (!demoOrgId) redirect("/login");

  const data = await getHeatmapData(demoOrgId);
  return <HeatmapClient {...data} />;
}

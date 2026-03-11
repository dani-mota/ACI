import { cookies } from "next/headers";
import { getHeatmapData, getDemoOrgId } from "@/lib/data";
import { HeatmapClient } from "@/components/roles/heatmap-client";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function TutorialRolesPage() {
  const cookieStore = await cookies();
  const raw = cookieStore.get("aci-tutorial")?.value;
  const _parsed = raw ? JSON.parse(decodeURIComponent(raw)) : null;
  const industry = (_parsed?.state?.tutorialIndustry ?? _parsed?.tutorialIndustry ?? null) as string | null;
  const demoOrgId = await getDemoOrgId(industry);
  if (!demoOrgId) redirect("/tutorial");

  const data = await getHeatmapData(demoOrgId);
  return <HeatmapClient {...data} />;
}

export const dynamic = "force-dynamic";

import { cookies } from "next/headers";
import { TutorialTeamsClient } from "./client";
import type { TutorialIndustry } from "@/stores/app-store";

export default async function TutorialTeamsPage() {
  const cookieStore = await cookies();
  const raw = cookieStore.get("aci-tutorial")?.value;
  const parsed = raw ? JSON.parse(decodeURIComponent(raw)) : null;
  const industry = (parsed?.state?.tutorialIndustry ?? parsed?.tutorialIndustry ?? null) as TutorialIndustry | null;

  return <TutorialTeamsClient industry={industry} />;
}

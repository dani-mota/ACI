import { cookies } from "next/headers";
import { TutorialAssessmentStage } from "@/components/tutorial/tutorial-assessment-stage";

export const dynamic = "force-dynamic";

export default async function TutorialAssessmentPage() {
  const cookieStore = await cookies();
  const raw = cookieStore.get("aci-tutorial")?.value;
  const _parsed = raw ? JSON.parse(decodeURIComponent(raw)) : null;
  const industry = (_parsed?.state?.tutorialIndustry ?? _parsed?.tutorialIndustry ?? null) as string | null;

  return <TutorialAssessmentStage segment={industry} />;
}

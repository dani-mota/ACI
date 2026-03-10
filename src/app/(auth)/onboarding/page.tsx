export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { getAuthStatus } from "@/lib/auth";
import { OnboardingForm } from "@/components/auth/onboarding-form";

export default async function OnboardingPage() {
  const { status } = await getAuthStatus();

  if (status === "authenticated") redirect("/dashboard");
  if (status === "unauthenticated") redirect("/login");

  // status === "needs_onboarding" — show the form
  return <OnboardingForm />;
}

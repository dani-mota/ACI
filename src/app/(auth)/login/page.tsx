export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { getAuthStatus } from "@/lib/auth";
import { LoginForm } from "@/components/auth/login-form";

export default async function LoginPage() {
  const { status } = await getAuthStatus();

  if (status === "authenticated") redirect("/dashboard");
  if (status === "needs_onboarding") redirect("/onboarding");

  return <LoginForm />;
}

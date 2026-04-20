"use client";

import { useRouter } from "next/navigation";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { DashboardMode } from "@/lib/rbac";

interface ModeTabsProps {
  accessibleModes: DashboardMode[];
  activeMode: DashboardMode;
}

export function ModeTabs({ accessibleModes, activeMode }: ModeTabsProps) {
  const router = useRouter();

  if (accessibleModes.length <= 1) return null;

  return (
    <Tabs
      value={activeMode}
      onValueChange={(value) => router.replace(`/dashboard?mode=${value}`)}
    >
      <TabsList variant="line">
        {accessibleModes.includes("candidates") && (
          <TabsTrigger value="candidates">Candidates</TabsTrigger>
        )}
        {accessibleModes.includes("employees") && (
          <TabsTrigger value="employees">Employees</TabsTrigger>
        )}
      </TabsList>
    </Tabs>
  );
}

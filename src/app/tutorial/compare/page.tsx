import Link from "next/link";
import { getCompareData, getDemoOrgId } from "@/lib/data";
import { CompareClient } from "@/components/compare/compare-client";
import { redirect } from "next/navigation";

interface PageProps {
  searchParams: Promise<{ ids?: string }>;
}

export default async function TutorialComparePage({ searchParams }: PageProps) {
  const demoOrgId = await getDemoOrgId();
  if (!demoOrgId) redirect("/login");

  const params = await searchParams;
  const ids = params.ids?.split(",").filter(Boolean) || [];

  if (ids.length < 2) {
    return (
      <div className="p-6">
        <div className="bg-card border border-border p-12 text-center">
          <h2 className="text-sm font-semibold text-foreground mb-2 uppercase tracking-wider">Select Candidates to Compare</h2>
          <p className="text-xs text-muted-foreground">
            Go to the{" "}
            <Link href="/tutorial/roles" className="text-aci-gold hover:underline">Role Matrix</Link>{" "}
            and select 2-3 candidates to compare side-by-side.
          </p>
        </div>
      </div>
    );
  }

  const data = await getCompareData(ids, demoOrgId);
  return <CompareClient {...data} />;
}

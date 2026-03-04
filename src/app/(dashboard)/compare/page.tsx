export const dynamic = "force-dynamic";

import Link from "next/link";
import { getCompareData } from "@/lib/data";
import { getSession } from "@/lib/auth";
import { CompareClient } from "@/components/compare/compare-client";

interface PageProps {
  searchParams: Promise<{ ids?: string }>;
}

export default async function ComparePage({ searchParams }: PageProps) {
  const session = await getSession();
  const orgId = session?.user.orgId ?? undefined;
  const params = await searchParams;
  const ids = params.ids?.split(",").filter(Boolean) || [];

  if (ids.length < 2) {
    return (
      <div className="p-6">
        <div className="bg-card border border-border p-12 text-center">
          <h2 className="text-sm font-semibold text-foreground mb-2 uppercase tracking-wider">Select Candidates to Compare</h2>
          <p className="text-xs text-muted-foreground">
            Go to the{" "}
            <Link href="/roles" className="text-aci-gold hover:underline">Role Matrix</Link>{" "}
            and select 2-3 candidates to compare side-by-side.
          </p>
        </div>
      </div>
    );
  }

  const data = await getCompareData(ids, orgId);
  return <CompareClient {...data} />;
}

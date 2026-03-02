"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { ReviewClient } from "./review-client";
import type { RoleBuilderPipelineResult } from "@/lib/role-builder/pipeline";

export function ReviewShell() {
  const router = useRouter();
  const [result, setResult] = useState<RoleBuilderPipelineResult | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("roleBuilderResult");
      if (!raw) {
        setError(true);
        return;
      }
      setResult(JSON.parse(raw));
    } catch {
      setError(true);
    }
  }, []);

  if (error) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <p className="text-sm text-muted-foreground">No role analysis found. Please start from the beginning.</p>
        <button
          onClick={() => router.push("/roles/new")}
          className="text-sm text-aci-gold hover:underline"
        >
          Create New Role →
        </button>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-muted-foreground animate-spin" />
      </div>
    );
  }

  return <ReviewClient result={result} />;
}

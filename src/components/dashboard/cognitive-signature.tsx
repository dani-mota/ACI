"use client";

import { useEffect, useRef, useState } from "react";

interface CognitiveSignatureProps {
  candidateId: string;
  firstName: string;
  initialSignature: string | null;
  subtestResults: { construct: string; percentile: number; layer: string | null }[];
}

export function CognitiveSignature({
  candidateId,
  initialSignature,
}: CognitiveSignatureProps) {
  const [signature, setSignature] = useState<string | null>(initialSignature);
  const [loading, setLoading] = useState<boolean>(initialSignature === null);
  const [error, setError] = useState<string | null>(null);
  // Guard against React strict-mode double-fire of useEffect in dev
  const requestedRef = useRef(false);

  useEffect(() => {
    if (initialSignature !== null) return;
    if (requestedRef.current) return;
    requestedRef.current = true;

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/employees/${candidateId}/cognitive-signature`, {
          method: "POST",
        });
        if (!res.ok) {
          if (!cancelled) {
            setError("Could not generate the cognitive signature.");
            setLoading(false);
          }
          return;
        }
        const json = (await res.json()) as { signature: string; source: "ai" | "fallback" };
        if (!cancelled) {
          setSignature(json.signature);
          setLoading(false);
        }
      } catch {
        if (!cancelled) {
          setError("Could not generate the cognitive signature.");
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [candidateId, initialSignature]);

  return (
    <section className="bg-card border border-border p-6">
      <h2 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">
        Cognitive Signature
      </h2>
      {loading && <SignatureSkeleton />}
      {!loading && error && (
        <p className="text-sm text-aci-red" role="alert">
          {error}
        </p>
      )}
      {!loading && !error && signature && (
        <p className="text-sm text-foreground leading-relaxed">{signature}</p>
      )}
    </section>
  );
}

function SignatureSkeleton() {
  return (
    <div className="space-y-2" aria-busy="true" aria-live="polite">
      <div className="h-4 bg-muted/60 dark:bg-muted rounded animate-pulse w-3/4" />
      <div className="h-4 bg-muted/60 dark:bg-muted rounded animate-pulse w-full" />
      <div className="h-4 bg-muted/60 dark:bg-muted rounded animate-pulse w-5/6" />
    </div>
  );
}

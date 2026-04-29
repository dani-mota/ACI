"use client";

/**
 * PRO-132: Evidence Layer (Layer 3 of the Employee Dossier).
 *
 * Renders all 12 constructs as collapsible accordion items. Each expanded
 * item shows the highest-scoring candidate response excerpt + an
 * AI-generated 1-sentence annotation explaining the signal.
 *
 * Lazy generation: when a manager expands a construct WITHOUT a current
 * cached annotation, we POST to the per-construct API. A Set ref keyed
 * on construct guards against React strict-mode double-mount in dev.
 *
 * The accordion uses Radix's default unmount-on-close — collapsed content
 * literally doesn't exist in the DOM, so there's no "fetched but hidden"
 * gymnastics needed.
 */

import { useRef, useState } from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { CONSTRUCTS, LAYER_INFO } from "@/lib/constructs";
import type { EvidenceLayerEntry } from "@/lib/data";

interface EvidenceLayerProps {
  candidateId: string;
  initialEvidence: EvidenceLayerEntry[];
}

interface RuntimeState {
  excerpt: string | null;
  annotation: string | null;
  loading: boolean;
  error: boolean;
}

const EXCERPT_PREVIEW_CHARS = 300;

export function EvidenceLayer({ candidateId, initialEvidence }: EvidenceLayerProps) {
  // Convert the server-loaded data into per-construct runtime state.
  const initialMap = new Map<string, RuntimeState>(
    initialEvidence.map((e) => [
      e.construct,
      {
        excerpt: e.message?.content ?? null,
        annotation: e.hasCurrentAnnotation ? e.annotation : null,
        loading: false,
        error: false,
      },
    ]),
  );

  const [state, setState] = useState<Map<string, RuntimeState>>(initialMap);
  const [expandedFull, setExpandedFull] = useState<Set<string>>(new Set());

  // Strict-mode double-mount fires effects/handlers twice in dev; this Set
  // guards the second fire. Production single-mount is unaffected.
  const requestedRef = useRef<Set<string>>(new Set());

  const evidenceByConstruct = new Map(initialEvidence.map((e) => [e.construct, e]));

  async function fetchAnnotation(construct: string) {
    if (requestedRef.current.has(construct)) return;
    const entry = evidenceByConstruct.get(construct);
    if (!entry || !entry.message) return; // no excerpt → nothing to annotate
    if (entry.hasCurrentAnnotation) return; // already cached at current version

    requestedRef.current.add(construct);
    setState((prev) => {
      const next = new Map(prev);
      next.set(construct, {
        ...(next.get(construct) ?? { excerpt: entry.message?.content ?? null, annotation: null, loading: false, error: false }),
        loading: true,
        error: false,
      });
      return next;
    });

    try {
      const res = await fetch(
        `/api/employees/${candidateId}/evidence/${construct}`,
        { method: "POST" },
      );
      if (!res.ok) {
        setState((prev) => {
          const next = new Map(prev);
          const cur = next.get(construct);
          if (cur) next.set(construct, { ...cur, loading: false, error: true });
          return next;
        });
        return;
      }
      const json = (await res.json()) as {
        excerpt: string | null;
        annotation: string | null;
        source: "ai" | "fallback" | "no_evidence";
      };
      setState((prev) => {
        const next = new Map(prev);
        next.set(construct, {
          excerpt: json.excerpt,
          annotation: json.annotation,
          loading: false,
          error: false,
        });
        return next;
      });
    } catch {
      setState((prev) => {
        const next = new Map(prev);
        const cur = next.get(construct);
        if (cur) next.set(construct, { ...cur, loading: false, error: true });
        return next;
      });
    }
  }

  function handleValueChange(values: string[]) {
    // Trigger lazy fetch for any newly-opened construct that doesn't have
    // a current annotation in state yet.
    for (const construct of values) {
      const cur = state.get(construct);
      if (!cur) continue;
      if (cur.annotation !== null) continue;
      if (cur.loading) continue;
      if (!cur.excerpt) continue; // no evidence message → nothing to fetch
      void fetchAnnotation(construct);
    }
  }

  function toggleFull(construct: string) {
    setExpandedFull((prev) => {
      const next = new Set(prev);
      if (next.has(construct)) next.delete(construct);
      else next.add(construct);
      return next;
    });
  }

  // Iterate constructs in the same insertion order as the radar chart spokes.
  const constructCodes = Object.keys(CONSTRUCTS);

  return (
    <Accordion type="multiple" onValueChange={handleValueChange}>
      {constructCodes.map((code) => {
        const meta = CONSTRUCTS[code];
        const cur = state.get(code) ?? {
          excerpt: null,
          annotation: null,
          loading: false,
          error: false,
        };
        const layerInfo = LAYER_INFO[meta.layer];
        const hasEvidence = cur.excerpt !== null;
        const isFullExpanded = expandedFull.has(code);
        const showFullToggle =
          hasEvidence && cur.excerpt !== null && cur.excerpt.length > EXCERPT_PREVIEW_CHARS;
        const displayedExcerpt = !cur.excerpt
          ? null
          : isFullExpanded || cur.excerpt.length <= EXCERPT_PREVIEW_CHARS
            ? cur.excerpt
            : `${cur.excerpt.slice(0, EXCERPT_PREVIEW_CHARS).trimEnd()}…`;

        return (
          <AccordionItem key={code} value={code}>
            <AccordionTrigger>
              <span className="flex items-center gap-2">
                <span
                  className="inline-block w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: layerInfo.color }}
                  aria-hidden="true"
                />
                <span>{meta.name}</span>
                {!hasEvidence && (
                  <span className="text-[10px] text-muted-foreground font-normal">
                    (no evidence)
                  </span>
                )}
              </span>
            </AccordionTrigger>
            <AccordionContent>
              {!hasEvidence && (
                <p className="text-xs text-muted-foreground italic">
                  No direct excerpt available for this construct.
                </p>
              )}
              {hasEvidence && (
                <div className="space-y-3">
                  <blockquote className="border-l-2 border-aci-gold/40 pl-4 py-1 text-sm text-foreground italic whitespace-pre-wrap">
                    {displayedExcerpt}
                  </blockquote>
                  {showFullToggle && (
                    <button
                      type="button"
                      onClick={() => toggleFull(code)}
                      className="text-[11px] text-aci-gold hover:underline"
                    >
                      {isFullExpanded ? "Show less" : "Show full response"}
                    </button>
                  )}
                  {cur.loading && (
                    <div className="space-y-1.5 mt-2">
                      <div className="h-3 bg-muted/60 dark:bg-muted rounded animate-pulse w-3/4" />
                      <div className="h-3 bg-muted/60 dark:bg-muted rounded animate-pulse w-full" />
                    </div>
                  )}
                  {!cur.loading && cur.annotation && (
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {cur.annotation}
                    </p>
                  )}
                  {!cur.loading && !cur.annotation && cur.error && (
                    <p className="text-xs text-aci-red" role="alert">
                      Could not generate the annotation. Try again later.
                    </p>
                  )}
                </div>
              )}
            </AccordionContent>
          </AccordionItem>
        );
      })}
    </Accordion>
  );
}

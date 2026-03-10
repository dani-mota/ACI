"use client";

import Link from "next/link";
import { Clock, AlertTriangle, CheckCircle2 } from "lucide-react";
import { useBasePath } from "@/components/base-path-provider";
import { StatusBadge } from "@/components/ui/status-badge";
import { InitialsBadge } from "@/components/ui/initials-badge";
import { formatRelativeDate } from "@/lib/format";

interface AttentionCandidate {
  id: string;
  firstName: string;
  lastName: string;
  status: string;
  updatedAt: string;
  primaryRole: { name: string };
  assessment?: {
    completedAt?: string | null;
  } | null;
}

interface AttentionItemsProps {
  candidates: AttentionCandidate[];
}

function getAttentionItems(candidates: AttentionCandidate[]) {
  const now = new Date();
  const fortyEightHoursAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const awaitingDecision = candidates.filter(
    (c) =>
      (c.status === "RECOMMENDED" || c.status === "REVIEW_REQUIRED") &&
      new Date(c.updatedAt) < fortyEightHoursAgo
  );

  const needsReview = candidates.filter(
    (c) => c.status === "REVIEW_REQUIRED" && !awaitingDecision.some((a) => a.id === c.id)
  );

  const recentlyCompleted = candidates.filter(
    (c) =>
      c.assessment?.completedAt &&
      new Date(c.assessment.completedAt) > sevenDaysAgo &&
      c.status !== "INCOMPLETE" &&
      c.status !== "SCORING" &&
      !awaitingDecision.some((a) => a.id === c.id) &&
      !needsReview.some((n) => n.id === c.id)
  );

  return { awaitingDecision, needsReview, recentlyCompleted };
}

export function AttentionItems({ candidates }: AttentionItemsProps) {
  const { awaitingDecision, needsReview, recentlyCompleted } = getAttentionItems(candidates);

  const totalItems = awaitingDecision.length + needsReview.length + recentlyCompleted.length;

  if (totalItems === 0) {
    return (
      <div className="border border-aci-green/20 bg-aci-green/5 rounded-md p-3 flex items-center gap-2">
        <CheckCircle2 className="h-4 w-4 text-aci-green" />
        <span className="text-xs text-aci-green font-medium">All clear — no items need attention</span>
      </div>
    );
  }

  return (
    <div data-tutorial="attention-items">
      <h2 className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-3">
        Needs Attention ({totalItems})
      </h2>
      <div className="flex gap-3 overflow-x-auto pb-1">
        {awaitingDecision.map((c) => (
          <AttentionCard
            key={c.id}
            candidate={c}
            icon={<Clock className="h-3.5 w-3.5 text-aci-amber" />}
            label="Awaiting Decision"
            detail={`Updated ${formatRelativeDate(new Date(c.updatedAt))}`}
            borderColor="border-l-aci-amber"
          />
        ))}
        {needsReview.map((c) => (
          <AttentionCard
            key={c.id}
            candidate={c}
            icon={<AlertTriangle className="h-3.5 w-3.5 text-aci-amber" />}
            label="Needs Review"
            detail="Conditional fit — hiring manager input needed"
            borderColor="border-l-aci-amber"
          />
        ))}
        {recentlyCompleted.slice(0, 3).map((c) => (
          <AttentionCard
            key={c.id}
            candidate={c}
            icon={<CheckCircle2 className="h-3.5 w-3.5 text-aci-blue" />}
            label="Recently Completed"
            detail={c.assessment?.completedAt ? `Completed ${formatRelativeDate(new Date(c.assessment.completedAt))}` : ""}
            borderColor="border-l-aci-blue"
          />
        ))}
      </div>
    </div>
  );
}

function AttentionCard({
  candidate,
  icon,
  label,
  detail,
  borderColor,
}: {
  candidate: AttentionCandidate;
  icon: React.ReactNode;
  label: string;
  detail: string;
  borderColor: string;
}) {
  const basePath = useBasePath();
  return (
    <Link
      href={`${basePath}/candidates/${candidate.id}`}
      className={`min-w-[240px] max-w-[280px] bg-card border border-border ${borderColor} border-l-2 rounded-md p-3 hover:bg-accent/50 transition-colors flex-shrink-0`}
    >
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{label}</span>
      </div>
      <div className="flex items-center gap-2 mb-1.5">
        <InitialsBadge
          firstName={candidate.firstName}
          lastName={candidate.lastName}
          size="sm"
        />
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground truncate">
            {candidate.firstName} {candidate.lastName}
          </p>
          <p className="text-xs text-muted-foreground truncate">{candidate.primaryRole.name}</p>
        </div>
      </div>
      <div className="flex items-center justify-between gap-3 mt-2 flex-wrap">
        <StatusBadge status={candidate.status} size="sm" />
        <span className="text-[10px] text-muted-foreground whitespace-nowrap">{detail}</span>
      </div>
    </Link>
  );
}

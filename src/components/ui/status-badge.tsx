import { getStatusLabel } from "@/lib/format";

interface StatusBadgeProps {
  status: string;
  size?: "sm" | "md";
  // PRO-134: when "employee", candidate verdicts (RECOMMENDED, REVIEW_REQUIRED,
  // DO_NOT_ADVANCE) render nothing — never leak verdict labels into Employee
  // Mode surfaces. Employee statuses (ACTIVE/REASSESSMENT_DUE/IN_TRANSITION) and
  // HIRED still render normally. Defaults to "candidate" for backwards compat.
  mode?: "candidate" | "employee";
}

const CANDIDATE_VERDICT_STATUSES = new Set(["RECOMMENDED", "REVIEW_REQUIRED", "DO_NOT_ADVANCE"]);

const STATUS_CONFIG: Record<string, { bg: string; text: string; border: string; dot: string }> = {
  RECOMMENDED: {
    bg: "bg-aci-green/10 dark:bg-aci-green/15",
    text: "text-aci-green",
    border: "border-aci-green/20",
    dot: "bg-aci-green",
  },
  REVIEW_REQUIRED: {
    bg: "bg-aci-amber/10 dark:bg-aci-amber/15",
    text: "text-aci-amber",
    border: "border-aci-amber/20",
    dot: "bg-aci-amber",
  },
  DO_NOT_ADVANCE: {
    bg: "bg-aci-red-muted/10 dark:bg-aci-red-muted/15",
    text: "text-aci-red-muted dark:text-aci-red",
    border: "border-aci-red-muted/20",
    dot: "bg-aci-red-muted dark:bg-aci-red",
  },
  INCOMPLETE: {
    bg: "bg-muted",
    text: "text-muted-foreground",
    border: "border-border",
    dot: "bg-muted-foreground",
  },
  INVITED: {
    bg: "bg-aci-blue/10 dark:bg-aci-blue/15",
    text: "text-aci-blue",
    border: "border-aci-blue/20",
    dot: "bg-aci-blue",
  },
  HIRED: {
    bg: "bg-purple-100 dark:bg-purple-900/20",
    text: "text-purple-700 dark:text-purple-300",
    border: "border-purple-300/40 dark:border-purple-700/40",
    dot: "bg-purple-600 dark:bg-purple-400",
  },
  // PRO-129: Employee lifecycle statuses (different enum than CandidateStatus, same badge surface)
  ACTIVE: {
    bg: "bg-aci-green/10 dark:bg-aci-green/15",
    text: "text-aci-green",
    border: "border-aci-green/20",
    dot: "bg-aci-green",
  },
  REASSESSMENT_DUE: {
    bg: "bg-aci-amber/10 dark:bg-aci-amber/15",
    text: "text-aci-amber",
    border: "border-aci-amber/20",
    dot: "bg-aci-amber",
  },
  IN_TRANSITION: {
    bg: "bg-aci-blue/10 dark:bg-aci-blue/15",
    text: "text-aci-blue",
    border: "border-aci-blue/20",
    dot: "bg-aci-blue",
  },
};

export function StatusBadge({ status, size = "md", mode = "candidate" }: StatusBadgeProps) {
  if (mode === "employee" && CANDIDATE_VERDICT_STATUSES.has(status)) return null;

  const label = getStatusLabel(status);
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.INCOMPLETE;

  return (
    <span
      className={`inline-flex items-center border font-mono uppercase tracking-wider ${config.bg} ${config.text} ${config.border} ${
        size === "sm" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-[10px]"
      }`}
    >
      <span className={`w-1.5 h-1.5 mr-1.5 ${config.dot}`} />
      {label}
    </span>
  );
}

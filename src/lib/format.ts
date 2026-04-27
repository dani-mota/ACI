export function formatPercentile(n: number): string {
  if (n <= 0) return "0th";
  const lastTwo = n % 100;
  const lastOne = n % 10;
  if (lastTwo >= 11 && lastTwo <= 13) return `${n}th`;
  if (lastOne === 1) return `${n}st`;
  if (lastOne === 2) return `${n}nd`;
  if (lastOne === 3) return `${n}rd`;
  return `${n}th`;
}

export function formatRelativeDate(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  const weeks = Math.floor(days / 7);

  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  if (weeks === 1) return "1 week ago";
  if (weeks < 4) return `${weeks} weeks ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function getStatusLabel(status: string): string {
  switch (status) {
    case "RECOMMENDED": return "Strong Fit";
    case "REVIEW_REQUIRED": return "Conditional Fit";
    case "DO_NOT_ADVANCE": return "Not a Direct Fit";
    case "INVITED": return "Invited";
    case "INCOMPLETE": return "In Progress";
    case "SCORING": return "Scoring";
    case "HIRED": return "Hired";
    default: return status;
  }
}

export function getStatusVariant(status: string): string {
  switch (status) {
    case "RECOMMENDED": return "recommended";
    case "REVIEW_REQUIRED": return "review";
    case "DO_NOT_ADVANCE": return "doNotAdvance";
    case "INVITED": return "invited";
    case "INCOMPLETE": return "incomplete";
    default: return "secondary";
  }
}

export function getStatusColor(status: string): string {
  switch (status) {
    case "RECOMMENDED": return "#059669";
    case "REVIEW_REQUIRED": return "#D97706";
    case "DO_NOT_ADVANCE": return "#9B1C1C";
    case "INVITED": return "#3B82F6";
    case "INCOMPLETE": return "#64748B";
    default: return "#64748B";
  }
}

export function getInitials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

export function getScoreTier(percentile: number): { label: string; color: string; bgClass: string } {
  if (percentile >= 90) return { label: "Exceptional", color: "#065F46", bgClass: "bg-heat-exceptional" };
  if (percentile >= 75) return { label: "Strong", color: "#059669", bgClass: "bg-heat-strong" };
  if (percentile >= 50) return { label: "Average", color: "#94A3B8", bgClass: "bg-heat-average" };
  if (percentile >= 25) return { label: "Below Average", color: "#F59E0B", bgClass: "bg-heat-below" };
  return { label: "Concern", color: "#DC2626", bgClass: "bg-heat-concern" };
}

export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}

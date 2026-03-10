export type NotificationType =
  | "ASSESSMENT_COMPLETED"
  | "AWAITING_DECISION"
  | "STATUS_CHANGED"
  | "NEW_CANDIDATE"
  | "RED_FLAG_DETECTED";

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  candidateId?: string;
  linkTo?: string;
}

function hoursAgo(hours: number): Date {
  return new Date(Date.now() - hours * 60 * 60 * 1000);
}

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

interface CandidateData {
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

export function generateMockNotifications(candidates: CandidateData[]): Notification[] {
  const notifications: Notification[] = [];

  // Completed assessments
  const completed = candidates.filter((c) => c.assessment?.completedAt);
  for (const c of completed.slice(0, 3)) {
    const completedAt = c.assessment?.completedAt
      ? new Date(c.assessment.completedAt)
      : hoursAgo(Math.floor(Math.random() * 48) + 1);
    notifications.push({
      id: `notif-completed-${c.id}`,
      type: "ASSESSMENT_COMPLETED",
      title: "Assessment Completed",
      message: `${c.firstName} ${c.lastName} completed their ${c.primaryRole.name} assessment.`,
      timestamp: completedAt,
      read: false,
      candidateId: c.id,
    });
  }

  // Awaiting decision
  const awaiting = candidates.filter(
    (c) =>
      (c.status === "RECOMMENDED" || c.status === "REVIEW_REQUIRED") &&
      new Date(c.updatedAt) < hoursAgo(48)
  );
  for (const c of awaiting.slice(0, 2)) {
    const daysSince = Math.floor(
      (Date.now() - new Date(c.updatedAt).getTime()) / (1000 * 60 * 60 * 24)
    );
    notifications.push({
      id: `notif-awaiting-${c.id}`,
      type: "AWAITING_DECISION",
      title: "Awaiting Decision",
      message: `${c.firstName} ${c.lastName} has been awaiting decision for ${daysSince} day${daysSince !== 1 ? "s" : ""}.`,
      timestamp: hoursAgo(daysSince * 24),
      read: false,
      candidateId: c.id,
    });
  }

  // Status changes (read notifications)
  const statusChanged = candidates.filter(
    (c) => c.status === "DO_NOT_ADVANCE" || c.status === "RECOMMENDED"
  );
  for (const c of statusChanged.slice(0, 2)) {
    const label = c.status === "RECOMMENDED" ? "Strong Fit" : "Not a Direct Fit";
    notifications.push({
      id: `notif-status-${c.id}`,
      type: "STATUS_CHANGED",
      title: "Status Updated",
      message: `${c.firstName} ${c.lastName} marked as ${label} for ${c.primaryRole.name}.`,
      timestamp: daysAgo(Math.floor(Math.random() * 3) + 1),
      read: true,
      candidateId: c.id,
    });
  }

  // New candidate added
  const newest = candidates
    .slice()
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 1);
  for (const c of newest) {
    notifications.push({
      id: `notif-new-${c.id}`,
      type: "NEW_CANDIDATE",
      title: "New Candidate",
      message: `${c.firstName} ${c.lastName} was added to the ${c.primaryRole.name} pipeline.`,
      timestamp: daysAgo(1),
      read: true,
      candidateId: c.id,
    });
  }

  // Sort by timestamp descending
  return notifications.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
}

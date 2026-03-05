// RBAC roles aligned with Prisma UserRole enum and PRD Section 7.1
export type AppUserRole = "RECRUITER_COORDINATOR" | "RECRUITING_MANAGER" | "HIRING_MANAGER" | "TA_LEADER" | "ADMIN";

export interface FieldAccess {
  // Universal (all roles)
  candidateStatus: boolean;
  contactInfo: boolean;
  compositeScores: boolean;
  interviewGuide: boolean;
  developmentPlan: boolean;
  predictions: boolean;
  // Recruiting Manager+
  redFlags: boolean;
  intelligenceReport: boolean;
  // Hiring Manager+
  subtestDetail: boolean;
  questionLevel: boolean;
  aiTranscripts: boolean;
  peerComparison: boolean;
  // TA Leader / Admin only
  rawIrt: boolean;
  validityMetrics: boolean;
  auditTrail: boolean;
  // Operational permissions
  notes: boolean;
  pdfExport: boolean;
  bulkActions: boolean;
}

const ACCESS_MAP: Record<AppUserRole, FieldAccess> = {
  RECRUITER_COORDINATOR: {
    candidateStatus: true,
    contactInfo: true,
    compositeScores: true,
    interviewGuide: true,
    developmentPlan: true,
    predictions: true,
    redFlags: false,
    intelligenceReport: false,
    subtestDetail: false,
    questionLevel: false,
    aiTranscripts: false,
    peerComparison: false,
    rawIrt: false,
    validityMetrics: false,
    auditTrail: false,
    notes: true,
    pdfExport: false,
    bulkActions: true,
  },
  RECRUITING_MANAGER: {
    candidateStatus: true,
    contactInfo: true,
    compositeScores: true,
    interviewGuide: true,
    developmentPlan: true,
    predictions: true,
    redFlags: true,
    intelligenceReport: true,
    subtestDetail: false,
    questionLevel: false,
    aiTranscripts: false,
    peerComparison: false,
    rawIrt: false,
    validityMetrics: false,
    auditTrail: false,
    notes: true,
    pdfExport: true,
    bulkActions: true,
  },
  HIRING_MANAGER: {
    candidateStatus: true,
    contactInfo: true,
    compositeScores: true,
    interviewGuide: true,
    developmentPlan: true,
    predictions: true,
    redFlags: true,
    intelligenceReport: true,
    subtestDetail: true,
    questionLevel: true,
    aiTranscripts: true,
    peerComparison: true,
    rawIrt: false,
    validityMetrics: false,
    auditTrail: false,
    notes: true,
    pdfExport: true,
    bulkActions: false,
  },
  TA_LEADER: {
    candidateStatus: true,
    contactInfo: true,
    compositeScores: true,
    interviewGuide: true,
    developmentPlan: true,
    predictions: true,
    redFlags: true,
    intelligenceReport: true,
    subtestDetail: true,
    questionLevel: true,
    aiTranscripts: true,
    peerComparison: true,
    rawIrt: true,
    validityMetrics: true,
    auditTrail: true,
    notes: true,
    pdfExport: true,
    bulkActions: true,
  },
  ADMIN: {
    candidateStatus: true,
    contactInfo: true,
    compositeScores: true,
    interviewGuide: true,
    developmentPlan: true,
    predictions: true,
    redFlags: true,
    intelligenceReport: true,
    subtestDetail: true,
    questionLevel: true,
    aiTranscripts: true,
    peerComparison: true,
    rawIrt: true,
    validityMetrics: true,
    auditTrail: true,
    notes: true,
    pdfExport: true,
    bulkActions: true,
  },
};

export function canView(userRole: AppUserRole, field: keyof FieldAccess): boolean {
  return ACCESS_MAP[userRole]?.[field] ?? false;
}

export function getAccessibleFields(userRole: AppUserRole): FieldAccess {
  return ACCESS_MAP[userRole];
}

// ─── Team management permissions ──────────────────────────

export const ROLE_LEVEL: Record<AppUserRole, number> = {
  RECRUITER_COORDINATOR: 1,
  RECRUITING_MANAGER: 2,
  HIRING_MANAGER: 2,
  TA_LEADER: 3,
  ADMIN: 4,
};

/** Roles that can manage team (invite, deactivate, change roles) */
const TEAM_MANAGEMENT_ROLES: AppUserRole[] = ["TA_LEADER", "ADMIN"];

/** Roles that can be assigned by org admins (ADMIN is platform-only) */
const ASSIGNABLE_ROLES: AppUserRole[] = [
  "RECRUITER_COORDINATOR",
  "RECRUITING_MANAGER",
  "HIRING_MANAGER",
  "TA_LEADER",
];

export function canManageTeam(role: AppUserRole): boolean {
  return TEAM_MANAGEMENT_ROLES.includes(role);
}

export function canAssignRole(assignerRole: AppUserRole, targetRole: AppUserRole): boolean {
  if (targetRole === "ADMIN") return false;
  if (!ASSIGNABLE_ROLES.includes(targetRole)) return false;
  return ROLE_LEVEL[assignerRole] >= ROLE_LEVEL[targetRole];
}

export function getAssignableRoles(assignerRole: AppUserRole): AppUserRole[] {
  return ASSIGNABLE_ROLES.filter((r) => canAssignRole(assignerRole, r));
}

export function getRoleLabel(role: AppUserRole): string {
  const labels: Record<AppUserRole, string> = {
    RECRUITER_COORDINATOR: "Recruiter Coordinator",
    RECRUITING_MANAGER: "Recruiting Manager",
    HIRING_MANAGER: "Hiring Manager",
    TA_LEADER: "TA Leader",
    ADMIN: "Admin",
  };
  return labels[role] || role;
}
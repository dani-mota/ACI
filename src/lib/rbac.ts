// RBAC roles aligned with Prisma UserRole enum and PRD Section 7.1
export type AppUserRole = "EXTERNAL_COLLABORATOR" | "RECRUITER_COORDINATOR" | "RECRUITING_MANAGER" | "HIRING_MANAGER" | "TA_LEADER" | "ADMIN";

// PRO-133: Employee Mode roles. Aligned with Prisma EmployeeUserRole enum.
// Additive to AppUserRole — a user can hold both (cross-mode case).
export type AppEmployeeUserRole = "EMPLOYEE" | "PEOPLE_MANAGER" | "HR_TALENT_LEADER" | "EXECUTIVE";

// Local AppSession-shape import — avoid circular dep on `@/lib/auth` by
// duplicating the minimal interface helpers consume. Keep in sync with
// AppSession in lib/auth.ts.
interface SessionLike {
  user: {
    id: string;
    role: AppUserRole;
    employeeRole: AppEmployeeUserRole | null;
  };
}

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
  // PRO-135: write access to RoleDemandProfile (create/edit/delete profiles).
  // Read access uses canAccessMode("employees") instead — resolution is server-side
  // and the radar overlay is visible to anyone who can view employees.
  roleProfiles: boolean;
}

const ACCESS_MAP: Record<AppUserRole, FieldAccess> = {
  EXTERNAL_COLLABORATOR: {
    candidateStatus: true,
    contactInfo: true,
    compositeScores: true,
    interviewGuide: true,
    developmentPlan: false,
    predictions: false,
    redFlags: false,
    intelligenceReport: false,
    subtestDetail: false,
    questionLevel: false,
    aiTranscripts: false,
    peerComparison: false,
    rawIrt: false,
    validityMetrics: false,
    auditTrail: false,
    notes: false,
    pdfExport: false,
    bulkActions: false,
    roleProfiles: false,
  },
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
    roleProfiles: false,
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
    roleProfiles: false,
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
    roleProfiles: false,
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
    roleProfiles: true,
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
    roleProfiles: true,
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
  EXTERNAL_COLLABORATOR: 0,
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

/**
 * PRO-133: Employee Mode roles assignable by org admins.
 * EMPLOYEE is intentionally NOT here — it's auto-assigned at conversion
 * (PR#2's conversion-flow integration), mirroring the EXTERNAL_COLLABORATOR
 * domain-auto-assignment pattern.
 */
export const ASSIGNABLE_EMPLOYEE_ROLES: AppEmployeeUserRole[] = [
  "PEOPLE_MANAGER",
  "HR_TALENT_LEADER",
  "EXECUTIVE",
];

export function canManageTeam(role: AppUserRole): boolean {
  return TEAM_MANAGEMENT_ROLES.includes(role);
}

export function canAssignRole(assignerRole: AppUserRole, targetRole: AppUserRole): boolean {
  if (targetRole === "ADMIN") return false;
  if (targetRole === "EXTERNAL_COLLABORATOR") return false; // Auto-assigned by domain check, not manually
  if (!ASSIGNABLE_ROLES.includes(targetRole)) return false;
  return ROLE_LEVEL[assignerRole] >= ROLE_LEVEL[targetRole];
}

export function getAssignableRoles(assignerRole: AppUserRole): AppUserRole[] {
  return ASSIGNABLE_ROLES.filter((r) => canAssignRole(assignerRole, r));
}

/**
 * PRO-133: Employee Mode roles assignable by the given Candidate Mode admin.
 * TA_LEADER and ADMIN can assign any Employee Mode role; lower roles cannot.
 * (Granting HR_TALENT_LEADER is a permission-expansion event; gate it to
 * org admins only.)
 */
export function getAssignableEmployeeRoles(assignerRole: AppUserRole): AppEmployeeUserRole[] {
  if (assignerRole !== "TA_LEADER" && assignerRole !== "ADMIN") return [];
  return [...ASSIGNABLE_EMPLOYEE_ROLES];
}

export function isExternalCollaborator(role: AppUserRole): boolean {
  return role === "EXTERNAL_COLLABORATOR";
}

// ─── Server-side candidate data filtering ──────────────────

/**
 * Strips restricted fields from a candidate object (including nested assessment)
 * based on the user's role. Operates on the serialized (plain object) form.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function filterCandidateForRole(candidate: any, role: AppUserRole): any {
  if (!candidate) return candidate;
  const access = ACCESS_MAP[role];
  // TA_LEADER and ADMIN see everything — skip filtering
  if (access.rawIrt && access.auditTrail) return candidate;

  const filtered = { ...candidate };

  // Strip notes if not allowed
  if (!access.notes) {
    delete filtered.notes;
  }

  // Strip assessment sub-fields based on access
  if (filtered.assessment) {
    const a = { ...filtered.assessment };

    if (!access.redFlags) {
      delete a.redFlags;
    }
    if (!access.predictions) {
      delete a.predictions;
    }
    if (!access.subtestDetail) {
      delete a.subtestResults;
    }
    if (!access.aiTranscripts) {
      delete a.aiInteractions;
    }
    if (!access.compositeScores) {
      delete a.compositeScores;
    }

    filtered.assessment = a;
  }

  return filtered;
}

export function getRoleLabel(role: AppUserRole | AppEmployeeUserRole): string {
  const labels: Record<AppUserRole | AppEmployeeUserRole, string> = {
    EXTERNAL_COLLABORATOR: "External Collaborator",
    RECRUITER_COORDINATOR: "Recruiter Coordinator",
    RECRUITING_MANAGER: "Recruiting Manager",
    HIRING_MANAGER: "Hiring Manager",
    TA_LEADER: "TA Leader",
    ADMIN: "Admin",
    // PRO-133 Employee Mode roles
    EMPLOYEE: "Employee",
    PEOPLE_MANAGER: "People Manager",
    HR_TALENT_LEADER: "HR / Talent Leader",
    EXECUTIVE: "Executive",
  };
  return labels[role] || role;
}

// ─── Dashboard mode access ──────────────────────────────────

export type DashboardMode = "candidates" | "employees";

export const MODE_ACCESS: Record<AppUserRole, DashboardMode[]> = {
  EXTERNAL_COLLABORATOR: ["candidates"],
  RECRUITER_COORDINATOR: ["candidates"],
  RECRUITING_MANAGER: ["candidates"],
  HIRING_MANAGER: ["candidates", "employees"],
  TA_LEADER: ["candidates", "employees"],
  ADMIN: ["candidates", "employees"],
};

// PRO-133: parallel map for Employee Mode roles. Kept separate from
// MODE_ACCESS (Candidate Mode) so the type system rejects cross-mode
// confusion at the map level.
export const EMPLOYEE_MODE_ACCESS: Record<AppEmployeeUserRole, DashboardMode[]> = {
  EMPLOYEE: ["employees"],
  PEOPLE_MANAGER: ["employees"],
  HR_TALENT_LEADER: ["candidates", "employees"],
  EXECUTIVE: ["employees"],
};

/**
 * Returns the accessible dashboard modes for the given session, taking
 * BOTH role slots into account (additive). PRO-133: a TA_LEADER user
 * with `employeeRole = "HR_TALENT_LEADER"` gets the union of both
 * slots' modes, so cross-mode access works correctly.
 */
export function getAccessibleModes(session: SessionLike): DashboardMode[] {
  const candidateModes = MODE_ACCESS[session.user.role] ?? [];
  const employeeModes = session.user.employeeRole
    ? EMPLOYEE_MODE_ACCESS[session.user.employeeRole] ?? []
    : [];
  const union = new Set<DashboardMode>([...candidateModes, ...employeeModes]);
  if (union.size === 0) return ["candidates"];
  return Array.from(union);
}

export function canAccessMode(session: SessionLike, mode: DashboardMode): boolean {
  return getAccessibleModes(session).includes(mode);
}

// ─── Candidate → Employee conversion (PRO-127 + PRO-133) ────
const CONVERT_CANDIDATE_ROLES: AppUserRole[] = ["RECRUITING_MANAGER", "TA_LEADER", "ADMIN"];
// PRO-133: Employee Mode roles that can convert candidates.
const CONVERT_CANDIDATE_EMPLOYEE_ROLES: AppEmployeeUserRole[] = ["PEOPLE_MANAGER", "HR_TALENT_LEADER"];

/**
 * PRO-133: now session-based. Checks both `role` and `employeeRole`
 * additively — either slot granting permission is sufficient.
 *
 * Overload preserved for the client component that only has the
 * Candidate Mode role available (`profile-client.tsx`); when called
 * with a single role string, only the Candidate Mode allow-list is
 * consulted (no Employee Mode check possible without session).
 */
export function canConvertCandidate(session: SessionLike): boolean;
export function canConvertCandidate(role: AppUserRole | null | undefined): boolean;
export function canConvertCandidate(arg: SessionLike | AppUserRole | null | undefined): boolean {
  if (!arg) return false;
  if (typeof arg === "string") {
    return CONVERT_CANDIDATE_ROLES.includes(arg);
  }
  // SessionLike — additive check across both slots
  if (CONVERT_CANDIDATE_ROLES.includes(arg.user.role)) return true;
  if (arg.user.employeeRole && CONVERT_CANDIDATE_EMPLOYEE_ROLES.includes(arg.user.employeeRole)) return true;
  return false;
}
/**
 * PRO-134: Single source of truth for "is this assessment in Employee Mode?".
 *
 * No inline `assessmentMode === 'EMPLOYEE'` checks should exist anywhere else
 * in the codebase. Importing components/routes consume these helpers so the
 * mode-discrimination logic stays one place to audit.
 */

import type { AssessmentMode } from "@/generated/prisma/enums";

interface ModeBearing {
  assessmentMode?: AssessmentMode | null;
}

export function isEmployeeMode(assessment: ModeBearing | null | undefined): boolean {
  return assessment?.assessmentMode === "EMPLOYEE";
}

export function isCandidateMode(assessment: ModeBearing | null | undefined): boolean {
  // Null/undefined assessments default to candidate-mode rendering (e.g., a
  // candidate hasn't been assessed yet, or the caller passes a partial object).
  return !assessment || assessment.assessmentMode !== "EMPLOYEE";
}

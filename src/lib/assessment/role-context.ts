import prisma from "@/lib/prisma";

export interface RoleContext {
  roleName: string;
  domain: string;
  technicalSkills: string[];
  keyTasks: string[];
  consequenceOfError: string;
  environment: string;
  isGeneric: boolean;
}

const NEUTRAL_CONTEXT: RoleContext = {
  roleName: "General",
  domain: "General",
  technicalSkills: [],
  keyTasks: [],
  consequenceOfError: "",
  environment: "General professional environment",
  isGeneric: true,
};

/**
 * Sanitize a string for safe inclusion in AI prompts.
 * Strips control characters and known prompt injection patterns,
 * enforces length limit per field.
 */
function sanitizeForPrompt(text: string, maxLength = 200): string {
  return text
    .replace(/[\x00-\x1f\x7f]/g, "") // strip control characters
    .slice(0, maxLength)
    .trim();
}

function sanitizeStringArray(arr: string[], maxItems = 10, maxLen = 200): string[] {
  return arr
    .slice(0, maxItems)
    .map((s) => sanitizeForPrompt(String(s), maxLen))
    .filter(Boolean);
}

/**
 * Load structured role domain context from persisted JD extraction data.
 * Returns a domain-neutral default when the role has no JD context or is generic.
 */
export async function getRoleContext(roleId: string): Promise<RoleContext> {
  const role = await prisma.role.findUnique({
    where: { id: roleId },
    select: { name: true, jdContext: true, isGeneric: true },
  });

  if (!role || role.isGeneric) return NEUTRAL_CONTEXT;

  const jd = role.jdContext as Record<string, unknown> | null;
  if (!jd) return { ...NEUTRAL_CONTEXT, roleName: role.name, isGeneric: false };

  // Handle environment field — ExtractedJD stores it as an object { setting, physicalDemands, shiftWork }
  const rawEnv = jd.environment;
  const envString =
    typeof rawEnv === "object" && rawEnv !== null
      ? (rawEnv as Record<string, unknown>).setting as string || "General"
      : typeof rawEnv === "string"
        ? rawEnv
        : "General";

  // Handle consequenceOfError — may be an object { safetyCritical, qualityCritical, costImpact }
  const rawCoe = jd.consequenceOfError;
  const coeString =
    typeof rawCoe === "object" && rawCoe !== null
      ? [
          (rawCoe as Record<string, unknown>).safetyCritical ? "safety-critical" : "",
          (rawCoe as Record<string, unknown>).qualityCritical ? "quality-critical" : "",
          `${(rawCoe as Record<string, unknown>).costImpact || "MEDIUM"} cost impact`,
        ].filter(Boolean).join(", ")
      : typeof rawCoe === "string"
        ? rawCoe
        : "";

  return {
    roleName: sanitizeForPrompt(role.name, 100),
    domain: sanitizeForPrompt(envString, 100),
    technicalSkills: sanitizeStringArray(
      Array.isArray(jd.technicalSkills) ? (jd.technicalSkills as string[]) : [],
    ),
    keyTasks: sanitizeStringArray(
      Array.isArray(jd.keyTasks) ? (jd.keyTasks as string[]) : [],
    ),
    consequenceOfError: sanitizeForPrompt(coeString),
    environment: sanitizeForPrompt(
      envString === "General" ? "General professional environment" : envString,
      200,
    ),
    isGeneric: false,
  };
}

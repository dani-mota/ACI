import type { ScenarioShell, DomainAdaptedContent } from "../types";
import type { RoleContext } from "../role-context";
import { AI_CONFIG } from "../config";

/**
 * Generates domain-adapted scenario content from a scenario shell and role context.
 *
 * When JD context is available, uses Claude Sonnet to create domain-specific surface content
 * that preserves the shell's structural and construct-measurement properties.
 *
 * Returns null for generic roles — use shell's domainNeutralContent instead.
 */
export async function generateDomainContent(
  shell: ScenarioShell,
  roleContext: RoleContext,
): Promise<DomainAdaptedContent | null> {
  if (roleContext.isGeneric) return null;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const prompt = buildGenerationPrompt(shell, roleContext);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), AI_CONFIG.generationTimeoutMs);

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: AI_CONFIG.generationModel,
        max_tokens: 2000,
        messages: [{ role: "user", content: prompt }],
      }),
      signal: controller.signal,
    });

    if (!response.ok) return null;

    const data = await response.json();
    const text = data.content?.[0]?.text || "";

    const parsed = JSON.parse(text);

    return validateDomainContent(parsed, roleContext);
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

function buildGenerationPrompt(shell: ScenarioShell, roleContext: RoleContext): string {
  return `You are a scenario content generator for a workplace assessment. Your task is to adapt a domain-neutral scenario template into domain-specific content for a particular role.

ROLE: ${roleContext.roleName}
DOMAIN: ${roleContext.domain}
ENVIRONMENT: ${roleContext.environment}
KEY TASKS: ${roleContext.keyTasks.join(", ")}
TECHNICAL SKILLS: ${roleContext.technicalSkills.join(", ")}
CONSEQUENCE OF ERROR: ${roleContext.consequenceOfError}

SCENARIO TEMPLATE:
Name: ${shell.name}
Description: ${shell.description}
Primary Constructs: ${shell.primaryConstructs.join(", ")}

NEUTRAL CONTENT:
Setting: ${shell.domainNeutralContent.setting}
Characters: ${shell.domainNeutralContent.characters.join(", ")}
Initial Situation: ${shell.domainNeutralContent.initialSituation}

BEAT STRUCTURE:
${shell.beats.map((b) => `Beat ${b.beatNumber} (${b.type}): ${b.agentPromptTemplate.slice(0, 150)}...`).join("\n")}

REQUIREMENTS:
1. Adapt the setting, characters, and initial situation to match the role's domain
2. Preserve the STRUCTURE: same number of beats, same beat types, same constructs tested
3. The scenario must feel realistic for someone in the ${roleContext.roleName} role
4. Characters should have domain-appropriate job titles and responsibilities
5. The initial situation must involve challenges realistic to this role's environment
6. Do NOT change what the scenario measures — only the surface content

Return JSON only (no other text):
{
  "roleSlug": "${roleContext.roleName.toLowerCase().replace(/\\s+/g, "-")}",
  "setting": "domain-specific setting description",
  "characters": ["character 1 with role", "character 2 with role", ...],
  "initialSituation": "domain-adapted initial situation paragraph",
  "beatAdaptations": {
    "0": "how beat 0 should be adapted for this domain",
    "1": "how beat 1 should be adapted",
    "2": "how beat 2 should be adapted",
    "3": "how beat 3 should be adapted",
    "4": "how beat 4 should be adapted",
    "5": "how beat 5 should be adapted"
  }
}`;
}

function validateDomainContent(
  parsed: Record<string, unknown>,
  roleContext: RoleContext,
): DomainAdaptedContent | null {
  if (!parsed || typeof parsed !== "object") return null;

  const setting = typeof parsed.setting === "string" ? parsed.setting : null;
  const characters = Array.isArray(parsed.characters)
    ? (parsed.characters as string[]).filter((c) => typeof c === "string")
    : null;
  const initialSituation = typeof parsed.initialSituation === "string" ? parsed.initialSituation : null;
  const beatAdaptations =
    typeof parsed.beatAdaptations === "object" && parsed.beatAdaptations !== null
      ? Object.fromEntries(
          Object.entries(parsed.beatAdaptations as Record<string, unknown>)
            .filter(([_, v]) => typeof v === "string")
            .map(([k, v]) => [Number(k), v as string]),
        )
      : null;

  if (!setting || !characters || !initialSituation || !beatAdaptations) return null;

  return {
    roleSlug: roleContext.roleName.toLowerCase().replace(/\s+/g, "-"),
    setting,
    characters,
    initialSituation,
    beatAdaptations,
  };
}

/**
 * Get scenario content for a given scenario and role.
 * Uses domain-adapted content if available, otherwise falls back to neutral content.
 */
export function getScenarioContent(
  shell: ScenarioShell,
  domainContent: DomainAdaptedContent | null,
): {
  setting: string;
  characters: string[];
  initialSituation: string;
  beatAdaptation: (beatNumber: number) => string | undefined;
} {
  if (domainContent) {
    return {
      setting: domainContent.setting,
      characters: domainContent.characters,
      initialSituation: domainContent.initialSituation,
      beatAdaptation: (beatNumber: number) => domainContent.beatAdaptations[beatNumber],
    };
  }

  return {
    setting: shell.domainNeutralContent.setting,
    characters: shell.domainNeutralContent.characters,
    initialSituation: shell.domainNeutralContent.initialSituation,
    beatAdaptation: () => undefined,
  };
}

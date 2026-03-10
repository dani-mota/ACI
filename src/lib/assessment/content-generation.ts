import { AI_CONFIG } from "./config";
import { SCENARIOS } from "./scenarios";
import { getRoleContext, type RoleContext } from "./role-context";
import type {
  ContentLibraryData,
  Act1ScenarioContent,
  Act1Variant,
  Act1BeatContent,
  ScenarioReferenceData,
  BranchContent,
} from "./content-types";
import type { ScenarioShell, BeatTemplate, ResponseClassification } from "./types";
import prisma from "@/lib/prisma";

const VARIANTS_PER_SCENARIO = 3;

/**
 * Generate a complete content library for a role.
 * Runs ~24 Sonnet calls (4 scenarios × 6 beats) over 1-3 minutes.
 */
export async function generateContentLibrary(roleId: string): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");

  // Create the library record in GENERATING state
  const existingCount = await prisma.contentLibrary.count({ where: { roleId } });
  const library = await prisma.contentLibrary.create({
    data: {
      roleId,
      version: existingCount + 1,
      status: "GENERATING",
      content: {},
      generationStartedAt: new Date(),
    },
  });

  try {
    const roleContext = await getRoleContext(roleId);

    // Generate all 4 scenarios in parallel
    const scenarioResults = await Promise.all(
      SCENARIOS.map((scenario) =>
        generateScenarioContent(apiKey, scenario, roleContext),
      ),
    );

    const contentData: ContentLibraryData = {
      version: existingCount + 1,
      generatedAt: new Date().toISOString(),
      modelId: AI_CONFIG.generationModel,
      roleContext: roleContext.isGeneric
        ? null
        : {
            environment: roleContext.environment,
            skills: roleContext.technicalSkills,
            tasks: roleContext.keyTasks,
            errorConsequences: [roleContext.consequenceOfError].filter(Boolean),
          },
      act1: { scenarios: scenarioResults },
      act2: { diagnosticProbes: [] }, // Populated separately if needed
      act3: null,
    };

    await prisma.contentLibrary.update({
      where: { id: library.id },
      data: {
        status: "READY",
        content: contentData as any,
        generationCompletedAt: new Date(),
      },
    });

    return library.id;
  } catch (error) {
    await prisma.contentLibrary.update({
      where: { id: library.id },
      data: {
        status: "FAILED",
        errorLog: {
          message: error instanceof Error ? error.message : String(error),
          timestamp: new Date().toISOString(),
        },
      },
    });
    throw error;
  }
}

/**
 * Generate content for a single scenario (3 variants × 6 beats).
 * Beats are generated sequentially (beat N context feeds N+1).
 * Variants for each beat are generated in a single call.
 */
async function generateScenarioContent(
  apiKey: string,
  scenario: ScenarioShell,
  roleContext: RoleContext,
): Promise<Act1ScenarioContent> {
  const variants: Act1Variant[] = Array.from({ length: VARIANTS_PER_SCENARIO }, (_, i) => ({
    variantId: `${scenario.id}-v${i}`,
    beats: [],
  }));

  // Generate beats sequentially — each beat's context informs the next
  for (let beatIdx = 0; beatIdx < scenario.beats.length; beatIdx++) {
    const beat = scenario.beats[beatIdx];
    const previousBeats = variants.map((v) => v.beats);

    const beatContents = await generateBeatContent(
      apiKey,
      scenario,
      beat,
      beatIdx,
      previousBeats,
      roleContext,
    );

    for (let v = 0; v < VARIANTS_PER_SCENARIO; v++) {
      variants[v].beats.push(beatContents[v]);
    }
  }

  return { scenarioId: scenario.id, variants };
}

/**
 * Generate content for a single beat across all 3 variants in one API call.
 */
async function generateBeatContent(
  apiKey: string,
  scenario: ScenarioShell,
  beat: BeatTemplate,
  beatIdx: number,
  previousBeats: Act1BeatContent[][],
  roleContext: RoleContext,
): Promise<Act1BeatContent[]> {
  const roleContextStr = roleContext.isGeneric
    ? ""
    : `\nROLE CONTEXT: ${roleContext.roleName} — ${roleContext.environment}. Key tasks: ${roleContext.keyTasks.slice(0, 3).join(", ")}. Consequence of error: ${roleContext.consequenceOfError}.`;

  const previousContext = previousBeats[0]
    .map((b, i) => `Beat ${i}: ${b.spokenText || "(branched)"}`)
    .join("\n");

  const isBeat0 = beatIdx === 0;

  const prompt = isBeat0
    ? buildBeat0GenerationPrompt(scenario, beat, roleContextStr)
    : buildBranchedBeatGenerationPrompt(scenario, beat, beatIdx, previousContext, roleContextStr);

  const response = await callGenerationAI(apiKey, prompt);
  const parsed = parseJSONResponse(response);

  if (isBeat0) {
    return parseBeat0Response(parsed, beat);
  }
  return parseBranchedBeatResponse(parsed, beat, beatIdx);
}

function buildBeat0GenerationPrompt(
  scenario: ScenarioShell,
  beat: BeatTemplate,
  roleContextStr: string,
): string {
  return `You are generating pre-written assessment content for a conversational assessment engine.

SCENARIO: ${scenario.name}
DESCRIPTION: ${scenario.description}
DOMAIN-NEUTRAL SETTING: ${scenario.domainNeutralContent.setting}
CHARACTERS: ${scenario.domainNeutralContent.characters.join(", ")}
INITIAL SITUATION: ${scenario.domainNeutralContent.initialSituation}
${roleContextStr}

BEAT 0 — INITIAL SITUATION
Template: ${beat.agentPromptTemplate}

Generate ${VARIANTS_PER_SCENARIO} VARIANTS of this opening beat. Each variant must have:
1. Different surface details (names, specifics) but the same structural demands
2. A spoken text of EXACTLY 4-5 short sentences (each under 20 words). Plain English, no markdown.
3. A reference card with compressed shorthand items (each under 60 chars)

Rules for spoken text:
- Sentence 1: Who they are and where they are
- Sentence 2: How the system normally works (one sentence)
- Sentence 3: What went wrong
- Sentence 4: What makes it tricky
- Sentence 5: The question
- NO specifications, numbers, or process details in spoken text — those go in the reference card

Rules for reference card items:
- Use compressed shorthand: "120 units/min · Weigh → Label → Seal"
- Each item under 60 characters
- Max 4 sections, max 4 items per section

Return JSON only:
{
  "variants": [
    {
      "spokenText": "sentence one. sentence two. ...",
      "referenceCard": {
        "role": "short role title",
        "context": "10-word scenario context",
        "sections": [
          {"label": "The System", "items": ["compressed spec", "compressed spec"]},
          {"label": "The Problem", "items": ["what changed", "impact"], "highlight": true},
          {"label": "Constraints", "items": ["constraint"]}
        ],
        "question": "the question being asked"
      }
    }
  ]
}`;
}

function buildBranchedBeatGenerationPrompt(
  scenario: ScenarioShell,
  beat: BeatTemplate,
  beatIdx: number,
  previousContext: string,
  roleContextStr: string,
): string {
  return `You are generating pre-written assessment content for a conversational assessment engine.

SCENARIO: ${scenario.name}
${roleContextStr}

PREVIOUS BEATS (for narrative continuity):
${previousContext}

BEAT ${beatIdx} — ${beat.type}
Template: ${beat.agentPromptTemplate}

BRANCH SCRIPTS:
- STRONG: ${beat.branchScripts.STRONG}
- ADEQUATE: ${beat.branchScripts.ADEQUATE}
- WEAK: ${beat.branchScripts.WEAK}

Generate ${VARIANTS_PER_SCENARIO} VARIANTS. For each variant, generate all 3 branches (STRONG, ADEQUATE, WEAK).

Rules for spoken text:
- 1-2 short sentences each (under 20 words per sentence)
- Plain English, no markdown
- Do NOT repeat information from previous beats
- Acknowledge the candidate's response naturally, then present the beat's content

Rules for reference updates:
- Only include newInformation if this beat reveals new facts
- Each item under 60 characters, compressed shorthand
- If no new facts, use empty array

Return JSON only:
{
  "variants": [
    {
      "branches": {
        "STRONG": {
          "spokenText": "one or two sentences",
          "referenceUpdate": {"newInformation": ["compressed new fact"], "question": "updated question"}
        },
        "ADEQUATE": {
          "spokenText": "one or two sentences",
          "referenceUpdate": {"newInformation": ["compressed new fact"], "question": "updated question"}
        },
        "WEAK": {
          "spokenText": "one or two sentences",
          "referenceUpdate": {"newInformation": [], "question": "updated question"}
        }
      }
    }
  ]
}`;
}

function parseBeat0Response(
  parsed: { variants: Array<{ spokenText: string; referenceCard: ScenarioReferenceData }> },
  beat: BeatTemplate,
): Act1BeatContent[] {
  return parsed.variants.map((v) => ({
    beatIndex: 0,
    beatType: beat.type,
    constructs: beat.primaryConstructs as string[],
    spokenText: v.spokenText,
    referenceCard: v.referenceCard,
  }));
}

function parseBranchedBeatResponse(
  parsed: { variants: Array<{ branches: Record<ResponseClassification, { spokenText: string; referenceUpdate: { newInformation: string[]; question: string } | null }> }> },
  beat: BeatTemplate,
  beatIdx: number,
): Act1BeatContent[] {
  return parsed.variants.map((v) => ({
    beatIndex: beatIdx,
    beatType: beat.type,
    constructs: beat.primaryConstructs as string[],
    branches: {
      STRONG: normalizeBranch(v.branches.STRONG),
      ADEQUATE: normalizeBranch(v.branches.ADEQUATE),
      WEAK: normalizeBranch(v.branches.WEAK),
    },
  }));
}

function normalizeBranch(raw: { spokenText: string; referenceUpdate: { newInformation: string[]; question: string } | null }): BranchContent {
  return {
    spokenText: raw.spokenText,
    referenceUpdate: raw.referenceUpdate && raw.referenceUpdate.newInformation?.length > 0
      ? raw.referenceUpdate
      : null,
  };
}

/**
 * Parse JSON from AI response, handling common issues like
 * unescaped newlines inside strings and trailing commas.
 */
function parseJSONResponse(text: string): any {
  try {
    return JSON.parse(text);
  } catch {
    // Try fixing common JSON issues from LLM output:
    // 1. Remove trailing commas before } or ]
    let cleaned = text.replace(/,\s*([}\]])/g, "$1");
    // 2. Escape unescaped newlines inside string values
    cleaned = cleaned.replace(/"([^"]*?)"/g, (match) => {
      return match.replace(/\n/g, "\\n").replace(/\r/g, "\\r").replace(/\t/g, "\\t");
    });
    try {
      return JSON.parse(cleaned);
    } catch (e) {
      throw new Error(`Failed to parse JSON after cleanup: ${(e as Error).message}\nFirst 500 chars: ${text.slice(0, 500)}`);
    }
  }
}

const MAX_RETRIES = 2;

async function callGenerationAI(apiKey: string, prompt: string): Promise<string> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
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
          max_tokens: 4000,
          system: "You are a JSON generator. Return ONLY valid JSON with no markdown, no commentary, no code fences. Ensure all strings are properly escaped.",
          messages: [{ role: "user", content: prompt }],
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const body = await response.text();
        // Handle rate limiting with backoff
        if (response.status === 429 && attempt < MAX_RETRIES) {
          const retryAfter = response.headers.get("retry-after");
          const waitMs = retryAfter ? parseInt(retryAfter) * 1000 : (attempt + 1) * 30_000;
          await new Promise((r) => setTimeout(r, waitMs));
          continue;
        }
        throw new Error(`API returned ${response.status}: ${body}`);
      }

      const data = await response.json();
      const text = data.content?.[0]?.text || "";

      // Extract JSON from potential markdown code blocks
      const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
      const jsonStr = jsonMatch ? jsonMatch[1].trim() : text.trim();

      // Find the outermost JSON object
      const objMatch = jsonStr.match(/\{[\s\S]*\}/);
      if (!objMatch) throw new Error("No JSON object found in response");

      // Validate it parses before returning
      parseJSONResponse(objMatch[0]);
      return objMatch[0];
    } catch (e) {
      lastError = e as Error;
      if (attempt < MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, 2000));
        continue;
      }
    } finally {
      clearTimeout(timeoutId);
    }
  }

  throw lastError!;
}

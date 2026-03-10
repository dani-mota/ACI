/**
 * Parse an AI scenario response into spoken text (sentences) and
 * an optional structured reference card for Act 1 scenarios.
 *
 * Supports three formats:
 * 1. Beat 0: text + `---REFERENCE---` + JSON (full reference card)
 * 2. Beats 1-5: text + `---REFERENCE_UPDATE---` + JSON (incremental update)
 * 3. Fallback: auto-parse from raw AI text (strip metadata, detect sections)
 */

export interface ReferenceSection {
  label: string;
  items: string[];
  highlight?: boolean;
}

export interface ScenarioReference {
  role?: string;
  context: string;
  sections: ReferenceSection[];
  question?: string;
  newInformation: string[];
}

export interface ReferenceUpdate {
  newInformation: string[];
  question: string;
}

export interface ParsedScenarioResponse {
  spokenText: string;
  sentences: string[];
  reference: ScenarioReference | null;
  /** True when reference came from an explicit ---REFERENCE--- delimiter, false for fallback auto-parse. */
  referenceIsExplicit: boolean;
  referenceUpdate: ReferenceUpdate | null;
}

/** Strip markdown, beat headers, and structural markers from raw text. */
export function cleanText(raw: string): string {
  return raw
    // Beat headers: # BEAT 1: INITIAL_SITUATION, ## BEAT 2: COMPLICATION, etc.
    .replace(/^#+\s+BEAT\s+\d+[:\s].*$/gm, "")
    // Any line starting with # (markdown headers)
    .replace(/^#+\s+.*$/gm, "")
    // Beat type labels on their own line: INITIAL_SITUATION, COMPLICATION, SOCIAL_PRESSURE, etc.
    .replace(/^(?:INITIAL[_\s]SITUATION|SITUATION|COMPLICATION|SOCIAL[_\s]PRESSURE|CONSEQUENCE[_\s]REVEAL|REFLECTIVE[_\s]SYNTHESIS)\s*$/gm, "")
    // "SITUATION ---" pattern (label followed by dashes)
    .replace(/^[A-Z][A-Z_\s]+\s*---.*$/gm, "")
    // Bracket tags anywhere: [spoken text], [SPOKEN], [Reference Card], [REFERENCE], etc.
    .replace(/\[(?:spoken\s*text|SPOKEN|spoken|REFERENCE|REFERENCE_UPDATE|Reference\s*Card|pause|silence|beat|Beat\s*\d*)[^\]]*\]/gi, "")
    // Delimiter lines: ---REFERENCE---, ---REFERENCE_UPDATE---, --- (horizontal rules)
    .replace(/-{3,}\s*(?:REFERENCE[_\s]*UPDATE?|REFERENCE)?\s*-{0,}/g, "")
    // Standalone triple dashes (horizontal rules)
    .replace(/^-{3,}\s*$/gm, "")
    // Markdown: **bold**, *italic*, __bold__, _italic_, ~~strike~~, `code`
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/__(.+?)__/g, "$1")
    .replace(/_(.+?)_/g, "$1")
    .replace(/~~(.+?)~~/g, "$1")
    .replace(/`(.+?)`/g, "$1")
    // Collapse excessive whitespace
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Split text into sentences, preserving abbreviations and decimals. */
export function splitSentences(text: string): string[] {
  const raw = text.split(/(?<=[.!?])\s+/);
  return raw
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/**
 * Build a reference card by detecting section-like patterns in the text.
 * This is a best-effort fallback when the AI doesn't use ---REFERENCE---.
 */
function buildFallbackReference(text: string): ScenarioReference | null {
  const sentences = splitSentences(text);
  if (sentences.length < 4) return null; // Too short for a scenario — skip

  // Extract question (last sentence ending with ?)
  const lastSentence = sentences[sentences.length - 1];
  const question = lastSentence?.endsWith("?") ? lastSentence : undefined;

  // Try to detect labeled sections (e.g., "The Normal Process:", "What's Happening:")
  const sectionPatterns = [
    { pattern: /(?:normal|standard|usual|typical)\s+(?:process|workflow|system)/i, label: "Normal Process" },
    { pattern: /(?:what'?s happening|the problem|the issue|something (?:odd|strange|unusual)|has (?:dropped|changed|shifted))/i, label: "The Problem", highlight: true },
  ];

  const sections: ReferenceSection[] = [];
  const paragraphs = text.split(/\n\n+/);

  for (const para of paragraphs) {
    const trimmed = para.trim();
    if (!trimmed || trimmed.endsWith("?")) continue;

    for (const sp of sectionPatterns) {
      if (sp.pattern.test(trimmed)) {
        // Extract key facts as bullet items (split on sentence boundaries)
        const items = splitSentences(trimmed)
          .filter((s) => s.length > 15 && s.length < 200)
          .slice(0, 4);
        if (items.length > 0) {
          sections.push({ label: sp.label, items, highlight: sp.highlight });
        }
        break;
      }
    }
  }

  // Only return a reference if we found meaningful sections
  if (sections.length === 0 && !question) return null;

  return { context: "", sections, question, newInformation: [] };
}

/** Extract first JSON object from a string (handles nested braces). */
function extractJson(text: string): string | null {
  const start = text.indexOf("{");
  if (start === -1) return null;
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    if (text[i] === "{") depth++;
    else if (text[i] === "}") {
      depth--;
      if (depth === 0) return text.substring(start, i + 1);
    }
  }
  return null; // Unbalanced braces
}

export function parseScenarioResponse(rawContent: string): ParsedScenarioResponse {
  let spokenText: string;
  let referenceJson: string | null = null;
  let updateJson: string | null = null;

  // Flexible delimiter matching — handle spaces, dashes, and formatting variations
  // Check update FIRST (more specific) to avoid "REFERENCE" matching "REFERENCE_UPDATE"
  const updateMatch = rawContent.match(/-{3,}\s*REFERENCE[_\s]UPDATE\s*-{3,}/i);
  const refMatch = !updateMatch ? rawContent.match(/-{3,}\s*REFERENCE\s*-{3,}/i) : null;

  if (updateMatch && updateMatch.index !== undefined) {
    spokenText = rawContent.substring(0, updateMatch.index);
    const afterDelimiter = rawContent.substring(updateMatch.index + updateMatch[0].length);
    updateJson = extractJson(afterDelimiter);
  } else if (refMatch && refMatch.index !== undefined) {
    spokenText = rawContent.substring(0, refMatch.index);
    const afterDelimiter = rawContent.substring(refMatch.index + refMatch[0].length);
    referenceJson = extractJson(afterDelimiter);
  } else {
    spokenText = rawContent;
  }

  // Clean the spoken text — strip markdown, beat headers, structural markers
  spokenText = cleanText(spokenText);

  // Safety net: strip any remaining JSON blocks from spoken text
  spokenText = spokenText.replace(/\{[\s\S]*?"(?:role|context|sections|newInformation)"[\s\S]*?\}/g, "").trim();

  const sentences = splitSentences(spokenText);

  // Parse explicit reference JSON
  let reference: ScenarioReference | null = null;
  let referenceIsExplicit = false;
  let referenceUpdate: ReferenceUpdate | null = null;

  if (referenceJson) {
    try {
      const parsed = JSON.parse(referenceJson);
      reference = {
        role: parsed.role,
        context: parsed.context || "",
        sections: parsed.sections || [],
        question: parsed.question,
        newInformation: [],
      };
      referenceIsExplicit = true;
    } catch (e) {
      console.warn("[parseScenarioResponse] Failed to parse reference JSON:", e);
      reference = buildFallbackReference(spokenText);
    }
  } else if (updateJson) {
    try {
      referenceUpdate = JSON.parse(updateJson);
    } catch {
      // No update available — that's fine
    }
  } else {
    reference = buildFallbackReference(spokenText);
  }

  return { spokenText, sentences, reference, referenceIsExplicit, referenceUpdate };
}

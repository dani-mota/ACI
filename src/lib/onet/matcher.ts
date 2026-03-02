import { ONET_OCCUPATIONS, type OnetOccupation } from "./dataset";

export interface OnetMatchResult {
  occupation: OnetOccupation;
  score: number;          // 0–100 match confidence
  matchedKeywords: string[];
}

interface MatchInput {
  title: string;
  description?: string;
  keywords?: string[];
}

// Normalize a string to lowercase tokens, removing punctuation
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2);
}

// Score one occupation against the input
function scoreOccupation(
  occ: OnetOccupation,
  inputTokens: Set<string>,
  inputTitle: string
): { score: number; matchedKeywords: string[] } {
  const matched: string[] = [];
  let score = 0;

  // Title-level match (high weight)
  const occTitleTokens = tokenize(occ.title);
  const inputTitleTokens = tokenize(inputTitle);
  for (const token of inputTitleTokens) {
    if (occTitleTokens.includes(token)) {
      score += 15;
      if (!matched.includes(token)) matched.push(token);
    }
  }

  // Keyword match
  for (const kw of occ.keywords) {
    const kwTokens = tokenize(kw);
    // Check if the kw phrase is fully contained in the input
    const kwStr = kwTokens.join(" ");
    const inputStr = Array.from(inputTokens).join(" ");
    if (inputStr.includes(kwStr) || kwStr.split(" ").every((t) => inputTokens.has(t))) {
      score += kwStr.split(" ").length > 1 ? 20 : 8; // bonus for multi-word matches
      if (!matched.includes(kw)) matched.push(kw);
    }
  }

  // Individual token overlap against occ title + keywords
  const occAllText = [occ.title, ...occ.keywords].join(" ");
  const occTokens = new Set(tokenize(occAllText));
  for (const token of inputTokens) {
    if (occTokens.has(token) && !matched.includes(token)) {
      score += 3;
      matched.push(token);
    }
  }

  // Cap at 100
  return { score: Math.min(score, 100), matchedKeywords: matched.slice(0, 8) };
}

export function matchOnetOccupations(input: MatchInput, topN = 5): OnetMatchResult[] {
  const fullText = [input.title, input.description ?? "", ...(input.keywords ?? [])].join(" ");
  const inputTokens = new Set(tokenize(fullText));
  const inputTitle = input.title;

  const scored = ONET_OCCUPATIONS.map((occ) => {
    const { score, matchedKeywords } = scoreOccupation(occ, inputTokens, inputTitle);
    return { occupation: occ, score, matchedKeywords };
  });

  // Sort by score descending, take topN, filter out zero-match entries (min score 5)
  return scored
    .filter((r) => r.score >= 5)
    .sort((a, b) => b.score - a.score)
    .slice(0, topN);
}

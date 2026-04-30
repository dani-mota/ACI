#!/usr/bin/env -S npx tsx
/**
 * PRO-134: Employee Mode evaluative-vocabulary audit.
 *
 * Greps the source tree for forbidden phrases inside files that are part of
 * the Employee Mode rendering surface (the dossier page + its component
 * dependency closure). Reports any leaks. Not shipped — runs as part of the
 * PRO-134 manual verification step before the PR is opened.
 *
 * Usage:
 *   npx tsx scripts/audit-employee-mode-vocabulary.ts
 *
 * Exit code: 0 if clean, 1 if any leaks found.
 *
 * Limitations (acknowledged):
 * - Static text only. Dynamic strings (Haiku output) are gated separately by
 *   FORBIDDEN_PATTERNS / containsForbiddenLanguage at write time.
 * - Manually maintained employee-mode surface list. Update when new
 *   employee-mode pages or components ship.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// ─── Employee-mode surface (page + component graph) ─────────────────────────
// Only includes files whose string literals can render to an Employee Mode
// viewer. The prompt-definition files are intentionally excluded — they define
// the forbidden phrases as the LLM instruction text, not as output, so flagging
// them produces false positives every run.

const EMPLOYEE_MODE_SURFACES = [
  // Page entrypoint
  "src/app/(dashboard)/employees/[id]/page.tsx",

  // Dossier components
  "src/components/dashboard/employee-dossier.tsx",
  "src/components/dashboard/cognitive-signature.tsx",
  "src/components/dashboard/construct-map-employee.tsx",
  "src/components/dashboard/evidence-layer.tsx",
  "src/components/dashboard/role-fit-delta-panel.tsx",

  // Server-side data shaping (text that flows into the UI)
  "src/lib/data.ts",
  "src/lib/assessment/insights/role-fit-delta.ts",

  // Mode-aware shared UI
  "src/components/ui/status-badge.tsx",
];

// ─── Forbidden phrases ──────────────────────────────────────────────────────
// Mirror of FORBIDDEN_PATTERNS in src/lib/assessment/prompts/evaluative-vocabulary.ts.
// Kept in sync manually — if you add to that list, add here too.

const FORBIDDEN_PATTERNS: { name: string; re: RegExp }[] = [
  { name: "red flag", re: /\bred[ -]?flag\b/i },
  { name: "concern", re: /\bconcern\b/i },
  { name: "risk", re: /\brisk\b/i },
  { name: "not recommended", re: /\bnot[ -]?recommended\b/i },
  { name: "decline", re: /\bdecline\b/i },
  { name: "cutline", re: /\bcutline\b/i },
  { name: "threshold", re: /\bthreshold\b/i },
  { name: "percentile of candidates", re: /\bpercentile\s+of\s+candidates\b/i },
];

// String-literal extractor: picks up text inside "..." and `...` only.
// Intentionally narrow — it ignores comments, identifiers, and prop names.
const STRING_LITERAL_RE = /"((?:[^"\\\n]|\\.)*)"|'((?:[^'\\\n]|\\.)*)'|`((?:[^`\\]|\\.)*?)`/g;

interface Leak {
  file: string;
  line: number;
  phrase: string;
  literal: string;
}

function auditFile(absPath: string, relPath: string): Leak[] {
  let content: string;
  try {
    content = readFileSync(absPath, "utf-8");
  } catch (err) {
    console.warn(`  [skip] could not read ${relPath}: ${(err as Error).message}`);
    return [];
  }

  const leaks: Leak[] = [];
  const lines = content.split("\n");

  // Lines starting with a comment marker are skipped — comments are docs, not
  // user-facing strings. Inline comments at end of lines are not stripped, but
  // STRING_LITERAL_RE only matches actual quoted strings, so an inline comment
  // mentioning "red flag" wouldn't match unless it's inside quotes.
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/*")) {
      continue;
    }

    const literals: string[] = [];
    let m: RegExpExecArray | null;
    STRING_LITERAL_RE.lastIndex = 0;
    while ((m = STRING_LITERAL_RE.exec(line)) !== null) {
      literals.push(m[1] ?? m[2] ?? m[3] ?? "");
    }

    for (const literal of literals) {
      for (const pat of FORBIDDEN_PATTERNS) {
        if (pat.re.test(literal)) {
          leaks.push({
            file: relPath,
            line: i + 1,
            phrase: pat.name,
            literal: literal.length > 80 ? literal.slice(0, 77) + "…" : literal,
          });
        }
      }
    }
  }

  return leaks;
}

// ─── Run ────────────────────────────────────────────────────────────────────

function main(): number {
  const repoRoot = resolve(__dirname, "..");
  console.log("PRO-134 Employee Mode vocabulary audit");
  console.log(`repo root: ${repoRoot}`);
  console.log(`surfaces:  ${EMPLOYEE_MODE_SURFACES.length} files`);
  console.log("");

  const allLeaks: Leak[] = [];
  for (const rel of EMPLOYEE_MODE_SURFACES) {
    const abs = resolve(repoRoot, rel);
    const leaks = auditFile(abs, rel);
    allLeaks.push(...leaks);
  }

  if (allLeaks.length === 0) {
    console.log("✓ No forbidden phrases found in any Employee Mode surface.");
    return 0;
  }

  console.log(`✗ Found ${allLeaks.length} leak(s):\n`);
  for (const leak of allLeaks) {
    console.log(`  ${leak.file}:${leak.line}`);
    console.log(`    phrase:  "${leak.phrase}"`);
    console.log(`    literal: ${leak.literal}`);
    console.log("");
  }
  return 1;
}

process.exit(main());

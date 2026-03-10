import type { ContentLibraryData, Act1BeatContent } from "./content-types";

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  stats: {
    totalScenarios: number;
    totalVariants: number;
    totalBeats: number;
    totalBranches: number;
  };
}

const MAX_ITEM_LENGTH = 60;
const MAX_SECTIONS = 4;
const MAX_ITEMS_PER_SECTION = 4;
const MIN_SPOKEN_LENGTH = 50;
const MAX_SPOKEN_LENGTH = 2000;

/**
 * Validate a generated content library for structural correctness.
 * Checks all scenarios, variants, beats, and branches.
 */
export function validateContentLibrary(data: ContentLibraryData): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  let totalVariants = 0;
  let totalBeats = 0;
  let totalBranches = 0;

  if (!data.act1?.scenarios || data.act1.scenarios.length !== 4) {
    errors.push(`Expected 4 scenarios, got ${data.act1?.scenarios?.length ?? 0}`);
  }

  for (let s = 0; s < (data.act1?.scenarios?.length ?? 0); s++) {
    const scenario = data.act1.scenarios[s];

    if (!scenario.variants || scenario.variants.length !== 3) {
      errors.push(`Scenario ${s}: expected 3 variants, got ${scenario.variants?.length ?? 0}`);
      continue;
    }

    totalVariants += scenario.variants.length;

    for (let v = 0; v < scenario.variants.length; v++) {
      const variant = scenario.variants[v];

      if (!variant.beats || variant.beats.length !== 6) {
        errors.push(`Scenario ${s} variant ${v}: expected 6 beats, got ${variant.beats?.length ?? 0}`);
        continue;
      }

      for (let b = 0; b < variant.beats.length; b++) {
        totalBeats++;
        const beat = variant.beats[b];
        const prefix = `S${s}V${v}B${b}`;

        if (b === 0) {
          // Beat 0: unbranched
          validateBeat0(beat, prefix, errors, warnings);
        } else {
          // Beats 1-5: branched
          validateBranchedBeat(beat, prefix, errors, warnings);
          totalBranches += 3;
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    stats: {
      totalScenarios: data.act1?.scenarios?.length ?? 0,
      totalVariants,
      totalBeats,
      totalBranches,
    },
  };
}

function validateBeat0(beat: Act1BeatContent, prefix: string, errors: string[], warnings: string[]): void {
  if (!beat.spokenText) {
    errors.push(`${prefix}: missing spokenText`);
  } else {
    validateSpokenText(beat.spokenText, prefix, errors, warnings);
  }

  if (!beat.referenceCard) {
    errors.push(`${prefix}: missing referenceCard`);
  } else {
    const card = beat.referenceCard;
    if (!card.role) errors.push(`${prefix}: referenceCard missing role`);
    if (!card.question) errors.push(`${prefix}: referenceCard missing question`);

    if (card.sections) {
      if (card.sections.length > MAX_SECTIONS) {
        warnings.push(`${prefix}: referenceCard has ${card.sections.length} sections (max ${MAX_SECTIONS})`);
      }
      for (const section of card.sections) {
        if (section.items?.length > MAX_ITEMS_PER_SECTION) {
          warnings.push(`${prefix}: section "${section.label}" has ${section.items.length} items (max ${MAX_ITEMS_PER_SECTION})`);
        }
        for (const item of section.items ?? []) {
          if (item.length > MAX_ITEM_LENGTH) {
            warnings.push(`${prefix}: item too long (${item.length} chars): "${item.slice(0, 40)}..."`);
          }
        }
      }
    }
  }

  if (hasMarkdown(beat.spokenText || "")) {
    errors.push(`${prefix}: spokenText contains markdown formatting`);
  }
}

function validateBranchedBeat(beat: Act1BeatContent, prefix: string, errors: string[], warnings: string[]): void {
  if (!beat.branches) {
    errors.push(`${prefix}: missing branches`);
    return;
  }

  for (const branch of ["STRONG", "ADEQUATE", "WEAK"] as const) {
    const content = beat.branches[branch];
    if (!content) {
      errors.push(`${prefix}: missing ${branch} branch`);
      continue;
    }
    if (!content.spokenText) {
      errors.push(`${prefix} ${branch}: missing spokenText`);
    } else {
      validateSpokenText(content.spokenText, `${prefix} ${branch}`, errors, warnings);
    }
  }
}

function validateSpokenText(text: string, prefix: string, errors: string[], warnings: string[]): void {
  if (text.length < MIN_SPOKEN_LENGTH) {
    warnings.push(`${prefix}: spokenText too short (${text.length} chars)`);
  }
  if (text.length > MAX_SPOKEN_LENGTH) {
    errors.push(`${prefix}: spokenText too long (${text.length} chars)`);
  }
  if (hasMarkdown(text)) {
    errors.push(`${prefix}: spokenText contains markdown formatting`);
  }
}

function hasMarkdown(text: string): boolean {
  return /[*#`]|^-{3,}/m.test(text);
}

import type {
  ContentLibraryData,
  Act1BeatContent,
  ScenarioReferenceData,
  BranchContent,
} from "./content-types";
import type { ResponseClassification } from "./types";
import prisma from "@/lib/prisma";

/**
 * Load a content library by ID, with in-memory caching.
 * Libraries are immutable once READY, so caching is safe.
 */
const libraryCache = new Map<string, ContentLibraryData>();

export async function loadContentLibrary(libraryId: string): Promise<ContentLibraryData> {
  const cached = libraryCache.get(libraryId);
  if (cached) return cached;

  const library = await prisma.contentLibrary.findUnique({
    where: { id: libraryId },
    select: { content: true, status: true },
  });

  if (!library || library.status !== "READY") {
    throw new Error(`Content library ${libraryId} not available (status: ${library?.status})`);
  }

  const data = library.content as unknown as ContentLibraryData;
  libraryCache.set(libraryId, data);
  return data;
}

/**
 * Get the latest READY content library for a role, if one exists.
 */
export async function getReadyLibrary(roleId: string): Promise<{ id: string; content: ContentLibraryData } | null> {
  const library = await prisma.contentLibrary.findFirst({
    where: { roleId, status: "READY" },
    orderBy: { version: "desc" },
    select: { id: true, content: true },
  });

  if (!library) return null;
  return { id: library.id, content: library.content as unknown as ContentLibraryData };
}

/**
 * Select random variant indices for each scenario.
 * Called once when an assessment starts.
 */
export function selectRandomVariants(
  library: ContentLibraryData,
): Record<string, number> {
  const selections: Record<string, number> = {};
  for (const scenario of library.act1.scenarios) {
    selections[scenario.scenarioId] = Math.floor(Math.random() * scenario.variants.length);
  }
  return selections;
}

export interface LookedUpContent {
  spokenText: string;
  referenceCard?: ScenarioReferenceData;
  referenceUpdate?: { newInformation: string[]; question: string };
}

/**
 * Look up pre-generated content for a specific beat.
 */
export function lookupBeatContent(
  library: ContentLibraryData,
  scenarioIndex: number,
  beatIndex: number,
  classification: ResponseClassification,
  variantSelections: Record<string, number>,
): LookedUpContent {
  const scenario = library.act1.scenarios[scenarioIndex];
  if (!scenario) throw new Error(`Scenario ${scenarioIndex} not found in content library`);

  const variantIdx = variantSelections[scenario.scenarioId] ?? 0;
  const variant = scenario.variants[variantIdx];
  if (!variant) throw new Error(`Variant ${variantIdx} not found for scenario ${scenario.scenarioId}`);

  const beat = variant.beats[beatIndex];
  if (!beat) throw new Error(`Beat ${beatIndex} not found in variant`);

  // Beat 0: unbranched
  if (beatIndex === 0) {
    return {
      spokenText: beat.spokenText || "",
      referenceCard: beat.referenceCard,
    };
  }

  // Beats 1-5: branched by classification
  if (!beat.branches) {
    throw new Error(`Beat ${beatIndex} has no branches`);
  }

  const branch = beat.branches[classification];
  if (!branch) {
    // Fallback to ADEQUATE if classification branch missing
    const fallback = beat.branches.ADEQUATE;
    if (!fallback) throw new Error(`No ADEQUATE fallback for beat ${beatIndex}`);
    return {
      spokenText: fallback.spokenText,
      referenceUpdate: fallback.referenceUpdate || undefined,
    };
  }

  return {
    spokenText: branch.spokenText,
    referenceUpdate: branch.referenceUpdate || undefined,
  };
}

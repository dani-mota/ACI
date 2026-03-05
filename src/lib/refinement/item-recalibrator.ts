/**
 * Item Recalibration Utility
 *
 * Computes classical item statistics from real response data and upserts
 * new ItemCalibration records. Called manually from admin endpoints —
 * not a cron job.
 */

import prisma from "@/lib/prisma";
import { ITEM_BANK } from "@/lib/assessment/item-bank";

/**
 * Recompute calibration statistics for all items that have at least
 * `minSampleSize` responses. Upserts a new ItemCalibration version for
 * each qualifying item.
 */
export async function recalibrateItems(minSampleSize = 10): Promise<{
  processed: number;
  skipped: number;
}> {
  // Fetch all item responses
  const responses = await prisma.itemResponse.findMany({
    where: {
      itemType: { in: ["MULTIPLE_CHOICE", "LIKERT"] },
    },
    select: {
      itemId: true,
      rawScore: true,
      responseTimeMs: true,
    },
  });

  // Group by itemId
  const grouped = new Map<string, { rawScore: number; responseTimeMs: number | null }[]>();
  for (const r of responses) {
    if (r.rawScore === null) continue;
    if (!grouped.has(r.itemId)) grouped.set(r.itemId, []);
    grouped.get(r.itemId)!.push({ rawScore: r.rawScore, responseTimeMs: r.responseTimeMs });
  }

  let processed = 0;
  let skipped = 0;

  for (const item of ITEM_BANK) {
    const itemResponses = grouped.get(item.id);
    if (!itemResponses || itemResponses.length < minSampleSize) {
      skipped++;
      continue;
    }

    const n = itemResponses.length;
    // p-value: proportion correct (or mean score for polytomous items)
    const pValue = itemResponses.reduce((sum, r) => sum + r.rawScore, 0) / n;

    // Point-biserial correlation as discrimination proxy
    // Simplified: correlation between item score and mean item score rank
    const mean = pValue;
    const variance = itemResponses.reduce((sum, r) => sum + Math.pow(r.rawScore - mean, 2), 0) / n;
    const sd = Math.sqrt(variance);

    // Discrimination: normalized variance (proxy for point-biserial)
    const discrimination = sd > 0 ? Math.min(1, sd / 0.5) : 0;

    // Get next version number
    const existing = await prisma.itemCalibration.findFirst({
      where: { itemId: item.id },
      orderBy: { version: "desc" },
      select: { version: true },
    });
    const nextVersion = (existing?.version ?? 0) + 1;

    await prisma.itemCalibration.create({
      data: {
        itemId: item.id,
        construct: item.construct as any,
        version: nextVersion,
        difficulty: 1 - pValue, // higher difficulty = lower p-value
        discrimination,
        guessing: item.options && item.options.length === 4 ? 0.25 : 0,
        sampleSize: n,
        calibratedAt: new Date(),
      },
    });

    processed++;
  }

  return { processed, skipped };
}

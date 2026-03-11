/**
 * Offline script: Generate tutorial assessment audio using ElevenLabs API.
 *
 * Reads the 4 tutorial scripts, extracts the spoken text for each step,
 * and writes MP3s to public/audio/tutorial/{segment}/{stepId}.mp3.
 *
 * Prerequisites:
 *   ELEVENLABS_API_KEY and ELEVENLABS_VOICE_ID must be set in .env
 *
 * Usage:
 *   npx tsx scripts/generate-tutorial-audio.ts
 *   npx tsx scripts/generate-tutorial-audio.ts --segment space-satellite
 *   npx tsx scripts/generate-tutorial-audio.ts --dry-run
 */

import "dotenv/config";
import fs from "fs";
import path from "path";

// Import scripts dynamically to avoid TS compilation issues
// The getScript helper returns the script for a given segment
const SEGMENTS = ["defense-manufacturing", "space-satellite", "hardware-ai", "ai-software"];

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const VOICE_ID = process.env.ELEVENLABS_VOICE_ID ?? "EXAVITQu4vr4xnSDxMaL"; // Default: Aria-like voice

const OUTPUT_BASE = path.join(process.cwd(), "public", "audio", "tutorial");
const DRY_RUN = process.argv.includes("--dry-run");
const SEGMENT_FILTER = (() => {
  const idx = process.argv.indexOf("--segment");
  return idx >= 0 ? process.argv[idx + 1] : null;
})();

interface ScriptStep {
  id: string;
  type: string;
  text: string;
  ackText?: string;
  ackByOption?: Record<string, string>;
}

interface TutorialScript {
  segment: string;
  steps: ScriptStep[];
}

/**
 * Collect all (stepId, text) pairs to generate for a given script.
 * Includes main step text + ack texts for choice/timed-choice/numeric steps.
 */
function collectAudioItems(script: TutorialScript): { id: string; text: string }[] {
  const items: { id: string; text: string }[] = [];

  for (const step of script.steps) {
    // Main spoken text for all step types except 'complete' (complete uses same text)
    if (step.text) {
      items.push({ id: step.id, text: step.text });
    }

    // Ack texts for choice steps (A/B/C/D variants)
    if (step.type === "choice" && step.ackByOption) {
      for (const [letter, ackText] of Object.entries(step.ackByOption)) {
        items.push({ id: `${step.id}-ack-${letter.toLowerCase()}`, text: ackText });
      }
      // Also generate a generic ack (used as fallback)
      const firstAck = Object.values(step.ackByOption)[0];
      if (firstAck) {
        items.push({ id: `${step.id}-ack`, text: firstAck });
      }
    }

    // Ack text for timed-choice and numeric steps
    if ((step.type === "timed-choice" || step.type === "numeric") && step.ackText) {
      items.push({ id: `${step.id}-ack`, text: step.ackText });
      if (step.type === "timed-choice") {
        items.push({ id: `${step.id}-timeout`, text: "Time's up. Let's keep moving." });
      }
    }
  }

  return items;
}

async function generateAudio(text: string, outputPath: string): Promise<void> {
  if (!ELEVENLABS_API_KEY) {
    throw new Error("ELEVENLABS_API_KEY environment variable not set");
  }

  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}/stream`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "xi-api-key": ELEVENLABS_API_KEY,
      },
      body: JSON.stringify({
        text,
        model_id: "eleven_turbo_v2",
        voice_settings: {
          stability: 0.45,
          similarity_boost: 0.82,
          style: 0.08,
          use_speaker_boost: true,
        },
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`ElevenLabs API error ${response.status}: ${error}`);
  }

  const buffer = await response.arrayBuffer();
  fs.writeFileSync(outputPath, Buffer.from(buffer));
}

async function processSegment(segment: string): Promise<void> {
  // Dynamically require the script
  // We use a relative path import since this script runs from the project root
  let scriptModule;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    scriptModule = require("../src/lib/tutorial/mini-assessment-scripts");
  } catch (e) {
    console.error("Failed to load mini-assessment-scripts:", e);
    process.exit(1);
  }

  const script = scriptModule.getScript(segment) as TutorialScript;
  const items = collectAudioItems(script);
  const outDir = path.join(OUTPUT_BASE, segment);

  if (!DRY_RUN) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  console.log(`\n[${segment}] ${items.length} audio items to generate`);

  let generated = 0;
  let skipped = 0;

  for (const item of items) {
    const outPath = path.join(outDir, `${item.id}.mp3`);

    if (fs.existsSync(outPath)) {
      console.log(`  SKIP  ${item.id} (exists)`);
      skipped++;
      continue;
    }

    const preview = item.text.slice(0, 60).replace(/\n/g, " ");
    if (DRY_RUN) {
      console.log(`  DRY   ${item.id}: "${preview}…"`);
      generated++;
      continue;
    }

    try {
      process.stdout.write(`  GEN   ${item.id}…`);
      await generateAudio(item.text, outPath);
      console.log(` ✓ (${fs.statSync(outPath).size} bytes)`);
      generated++;

      // Rate limit: ElevenLabs allows ~3 req/s on most plans
      await new Promise((r) => setTimeout(r, 400));
    } catch (err) {
      console.log(` ✗ ERROR: ${(err as Error).message}`);
    }
  }

  console.log(`  Done: ${generated} generated, ${skipped} skipped`);
}

async function main(): Promise<void> {
  console.log("Tutorial Audio Generator");
  console.log("========================");

  if (DRY_RUN) {
    console.log("Mode: DRY RUN (no files written)");
  } else if (!ELEVENLABS_API_KEY) {
    console.error("ERROR: ELEVENLABS_API_KEY not set. Use --dry-run to preview without generating.");
    process.exit(1);
  }

  console.log(`Voice ID: ${VOICE_ID}`);
  console.log(`Output:   ${OUTPUT_BASE}`);

  const segments = SEGMENT_FILTER ? [SEGMENT_FILTER] : SEGMENTS;

  for (const segment of segments) {
    await processSegment(segment);
  }

  console.log("\nComplete.");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});

# ACI Sprint 4 Execution Plan — "It's Production-Ready"

**Duration:** 5 days
**Sprint Goal:** The assessment is fast, fully scored, observable, and has foundational test coverage. A paying customer could use it.
**Prompt Range:** 39–58 (20 prompts)

---

## Audit Findings Summary

### 1. TTS Performance — CRITICAL LATENCY BOTTLENECK

| Aspect | Status | Detail |
|--------|--------|--------|
| Chunk fetching | ❌ Sequential blocking | `tts-engine.ts:119-169` — ALL chunks fetched+decoded BEFORE first playback |
| Sentence pre-fetch | ❌ None | `assessment-stage.tsx:270-328` — strictly sequential: play N → wait → fetch N+1 |
| Inter-sentence gap | ⚠️ 400ms hardcoded | `assessment-stage.tsx:325-326` — adds 400ms pause between every sentence |
| Client audio cache | ❌ None | `no-cache, no-store` headers; identical text re-fetches every time |
| Server audio cache | ❌ None | TTS route is a simple proxy to ElevenLabs |
| ElevenLabs model | ✅ Fast | `eleven_flash_v2_5` — latency-optimized model |
| Output format | ✅ Good | MP3 44.1kHz 128kbps |
| WebSocket | ❌ None | No WebSocket infrastructure exists |
| **Estimated cold-start** | | **~4.25s for 5-sentence response before ANY audio plays** |

### 2. Content Library & Beat 0

| Aspect | Status | Detail |
|--------|--------|--------|
| Beat 0 from library | ✅ Works | `content-serving.ts:88-93` — served from library when available |
| Beats 1-5 from library | ✅ Works | `chat/route.ts:514-603` — classification → content lookup |
| Fallback path | ✅ Graceful | Falls back to streaming with diagnostic log |
| Content storage | Text only | `spokenText + referenceCard/referenceUpdate` — no audio stored |
| Acknowledgment parallel | ⚠️ Sequential | `chat/route.ts:543` — awaited AFTER classification, not in parallel |
| API calls per turn | 2 Haiku | Classification + acknowledgment (pre-gen path) |
| Expected latency | ~1-2s | Pre-generated content path |

### 3. Classification Quality

| Aspect | Status | Detail |
|--------|--------|--------|
| Few-shot examples | ❌ Zero-shot | `classification.ts:66-99` — no example classifications provided |
| Rubric indicators | ✅ Per-beat | Each beat has 2-3 indicators with positive/negative criteria |
| Output format | ✅ Structured JSON | Well-defined schema with constructSignals |
| Dual evaluation | ✅ Robust | 2 parallel calls, conservative on disagreement |
| JSON parse error handling | ⚠️ Missing | `classification.ts:128` — no try-catch on parse |
| Fallback | ✅ Exists | Word-count heuristic defaults to ADEQUATE |

### 4. Item Bank

| Construct | Easy (<0.35) | Medium (0.35-0.65) | Hard (>0.65) | Total |
|-----------|-------------|-------------------|-------------|-------|
| QUANTITATIVE_REASONING | 5 | 8 | 7 | **20** |
| SPATIAL_VISUALIZATION | 4 | 7 | 7 | **18** |
| MECHANICAL_REASONING | 4 | 6 | 5 | **15** |
| PATTERN_RECOGNITION | 4 | 7 | 7 | **18** |
| FLUID_REASONING | 4 | 6 | 5 | **15** |
| **Total** | **21** | **34** | **31** | **86** |

- **Spatial visualization:** ALL 18 items are text-only. 0 have `imageUrl`. Hard items (net-folding, projection) lose fidelity without diagrams.
- **Difficulty gaps:** No significant gaps — adaptive loop has coverage across all constructs at all difficulty levels.
- **Item IDs:** Stable, hardcoded. Adding items won't break existing data.

### 5. Act 3 Scoring

| Aspect | Status | Detail |
|--------|--------|--------|
| Parallel scenarios | ⚠️ Live LLM | `engine.ts:522-550` — generated dynamically, no construct validation |
| Scenario reference | ✅ Explicit | Prompt names the source Act 1 scenario and its constructs |
| Confidence items | ✅ Real items | Pulled from actual item bank, not placeholders |
| Self-assessment | Stored only | Not scored — 3 reflective questions, no rubric |
| Consistency validation | ✅ Operational | Act 1 vs Act 3 comparison with 0.15 threshold, 0.75x downweight |

### 6. Scoring Pipeline

| Aspect | Status | Detail |
|--------|--------|--------|
| Token tracking | ✅ Tracked+logged | `layer-b.ts:198-202` — per-evaluation input/output tokens |
| Cost estimation | ⚠️ Logged only | Calculated but NOT persisted to DB field |
| Norm tables | ⚠️ Placeholder | `norm-tables.ts:10-17` — sigmoid curves, not empirical |
| Norm recalibrator | ✅ Exists | `norm-recalibrator.ts` — functional but manually invoked |
| Consistency | ✅ Operational | 0.15 threshold, 0.75x downweight for LOW agreement |
| Red flags | ✅ 12 checks | 7 original + 5 V2; persisted to DB; surfaced on dashboard |
| Layer A | ✅ Deterministic | Item scoring by construct |
| Layer B | ✅ AI-evaluated | Triple-evaluation with variance detection |
| Layer C | ✅ Ceiling chars | Converts diagnostic probes → qualitative ceiling types |

### 7. Observability

| Aspect | Status | Detail |
|--------|--------|--------|
| Structured logging | ✅ Exists | `logger.ts` — JSON in production, pretty in dev |
| createLogger usage | ⚠️ 3 modules only | scoring-pipeline, layer-b, layer-c |
| Sentry | ✅ Configured | 10% traces, 100% error replays |
| Analytics API | ❌ None | No endpoint for completion rate, drop-off, duration, classification dist |
| Admin health endpoint | ❌ None | No system health or pipeline status API |
| Cost persistence | ❌ Missing | Token costs logged but not queryable from DB |
| Feature flags | ✅ Minimal | Only `CONTENT_LIBRARY_ENABLED` |

### 8. Test Coverage

| Aspect | Status | Detail |
|--------|--------|--------|
| Test framework | ❌ None | No jest/vitest/playwright configured |
| Test files | ❌ Zero | No `*.test.ts` or `*.spec.ts` in codebase |
| Package.json scripts | Data setup only | `test:setup` creates test data, not unit tests |
| Engine tests | ❌ None | 873-line state machine with zero tests |
| Adaptive loop tests | ❌ None | 356-line adaptive algorithm untested |
| Scoring pipeline tests | ❌ None | Multi-layer scoring with zero tests |
| Content library tests | ❌ None | |

### 9. STT

| Aspect | Status | Detail |
|--------|--------|--------|
| Web Speech API | ✅ Implemented | `mic-button.tsx` — continuous, interimResults, en-US |
| Confidence check | ❌ Missing | `event.results[i][0].confidence` available but unused |
| Re-prompt on garbled | ❌ Missing | No quality gate on STT output |
| Third-party STT | ❌ None | Web Speech API only |

---

## Success Criteria

1. **TTS latency:** First audio plays within ~800ms of response (down from ~4.25s)
2. **Classification calibration:** Few-shot examples added; JSON parse wrapped in try-catch
3. **Cost tracking:** Per-assessment cost persisted to DB and queryable
4. **Analytics API:** Endpoint returning completion rate, avg duration, classification distribution
5. **Test foundation:** Vitest configured; 20+ unit tests across engine, adaptive loop, and scoring
6. **Acknowledgment parallel:** Classification and acknowledgment run concurrently

---

## Sprint Structure

| Day | Theme | Prompts | Key Deliverables |
|-----|-------|---------|-----------------|
| 1 | TTS Performance | 39-42 | Sentence pre-fetch pipeline, inter-sentence optimization, acknowledgment parallelization |
| 2 | Scoring Completeness I | 43-47 | Classification calibration, JSON robustness, parallel scenario validation, cost persistence |
| 3 | Scoring Completeness II | 48-50 | Spatial visualization SVGs, item bank gap analysis, norm table review |
| 4 | Observability | 51-55 | Analytics API, structured logging migration, admin health endpoint |
| 5 | Test Coverage | 56-58 | Vitest setup, engine tests, adaptive loop tests, scoring tests |

---

## Day 1: TTS Performance (Prompts 39-42)

### Prompt 39 of 58: TTS Sentence Pre-Fetch Pipeline

**What it fixes:** Currently ALL chunks within a sentence are fetched+decoded sequentially BEFORE playback starts. A 5-chunk sentence has ~4.25s cold-start. This implements a pipeline where chunk 1 starts playing while chunks 2-N fetch in parallel.
**Severity:** P0
**Time:** 45 min
**Audit finding:** `tts-engine.ts:119-169` — sequential for-loop over chunks; `playQueue` populated only after ALL fetches complete at line 178.

```
File: src/components/assessment/voice/tts-engine.ts

Current behavior (lines 119-182):
The speak() method has a for-loop that sequentially fetches and decodes ALL chunks,
pushes them into a `buffers` array, THEN assigns `this.playQueue = buffers` and calls
`this.playNext()`. No audio plays until every chunk has been fetched and decoded.

Target behavior:
Start playing chunk 0 as soon as it's decoded. Fetch chunks 1-N concurrently in the background.
As each subsequent chunk decodes, append it to playQueue so playNext() picks it up seamlessly.

Implementation:
1. Replace the sequential for-loop (lines 119-169) with a pipelined approach:
   - Fetch+decode chunk 0 immediately
   - Start playback of chunk 0 (move lines 174-182 up)
   - Launch remaining chunk fetches in parallel via Promise.all (or 2-at-a-time to respect rate limits)
   - As each buffer resolves, push to this.playQueue

2. Modify playNext() to handle dynamic queue growth:
   - After playing the current buffer, check if more buffers have been added
   - If playQueue is empty but fetches are still in-flight, await a signal (resolve a promise when next buffer arrives)

3. Keep the existing fallback logic intact — if chunk 0 fails, fall back to SpeechSynthesis

Target latency: First audio within ~800ms (1 chunk fetch+decode) instead of ~4250ms (5 chunks).

Show me the updated speak() method and modified playNext().
```

---

### Prompt 40 of 58: Sentence-Level Pre-Fetch (N+1 Lookahead)

**What it fixes:** In `playSentenceSequence`, each sentence is fully played before the NEXT sentence is even fetched. This adds a 1-sentence lookahead: while sentence N plays, sentence N+1 is fetched and decoded.
**Severity:** P0
**Time:** 35 min
**Audit finding:** `assessment-stage.tsx:270-328` — `await ttsRef.current.speak(sentence, ...)` blocks until complete, then 400ms pause, then next sentence fetch begins.

```
File: src/components/assessment/voice/tts-engine.ts
File: src/components/assessment/stage/assessment-stage.tsx

Current behavior (assessment-stage.tsx lines 277-328):
for-loop calls `await ttsRef.current.speak(sentence, token, startReveal)` per sentence.
Each call blocks until that sentence's audio finishes playing. Zero pre-fetching.

Target behavior:
While sentence N plays, pre-fetch sentence N+1's audio chunks so they're ready instantly.

Implementation:
1. Add a `prefetch(text: string, token: string): Promise<AudioBuffer[]>` method to TTSEngine that:
   - Fetches and decodes all chunks for a given text
   - Returns the array of AudioBuffers without playing them
   - Caches the result keyed by text content

2. Add a `speakPrefetched(buffers: AudioBuffer[], onPlaybackStart?)` method that:
   - Takes pre-decoded buffers and plays them immediately (no fetch step)
   - Same playback logic as current speak() but skips the fetch loop

3. Modify playSentenceSequence in assessment-stage.tsx:
   - Before the loop: prefetch sentence 0
   - Inside the loop:
     a. If prefetched buffers exist for sentence[i], use speakPrefetched()
     b. Else fall back to normal speak()
     c. While sentence[i] plays, kick off prefetch for sentence[i+1]

4. Add an in-memory Map<string, AudioBuffer[]> cache to TTSEngine for the session.
   Clear on stop().

Target: Eliminate inter-sentence fetch latency entirely. Sentences play back-to-back
with only the natural 400ms pause (or less) between them.

Show me the new prefetch() and speakPrefetched() methods, and the updated playSentenceSequence.
```

---

### Prompt 41 of 58: Reduce Inter-Sentence Gap

**What it fixes:** There's a hardcoded 400ms pause between every sentence. For flowing narration this creates an unnatural staccato feel. Reduce to 150ms (a natural breath pause) and make it configurable.
**Severity:** P1
**Time:** 10 min
**Audit finding:** `assessment-stage.tsx:325-326` — `await new Promise((r) => setTimeout(r, 400))` between every sentence.

```
File: src/components/assessment/stage/assessment-stage.tsx

Current behavior (line 325-326):
```typescript
if (i < sentences.length - 1 && sequenceIdRef.current === myId) {
  await new Promise((r) => setTimeout(r, 400));
}
```

Target behavior:
Reduce to 150ms. When pre-fetched audio is ready, the gap can be even shorter (50ms)
since there's no fetch latency to mask.

Change:
1. Line 326: Change 400 → 150
2. Optionally: if the next sentence's audio is already prefetched (from Prompt 40),
   reduce to 50ms since there's no need to mask any loading time.

Show me the updated gap logic.
```

---

### Prompt 42 of 58: Parallelize Acknowledgment with Classification

**What it fixes:** In the pre-generated content path, acknowledgment generation awaits AFTER classification completes. Since they're independent, they should run in parallel, saving ~200-400ms per turn.
**Severity:** P1
**Time:** 20 min
**Audit finding:** `chat/route.ts:543-549` — `generateAcknowledgment()` called sequentially after classification result is available. Classification takes ~500-800ms, acknowledgment takes ~200-400ms. Running in parallel saves the acknowledgment time entirely.

```
File: src/app/api/assess/[token]/chat/route.ts

Current behavior:
1. Classification runs (lines 302-336): ~500-800ms
2. Content lookup using classification result (line 534)
3. Acknowledgment generates (lines 543-549): ~200-400ms
4. Total: ~800-1200ms

The acknowledgment doesn't depend on the classification result — it only needs
the candidate's last message, scenario context, and beat type.

Target behavior:
1. Launch classification AND acknowledgment in parallel
2. When both resolve, use classification for content lookup
3. Total: ~500-800ms (acknowledgment runs during classification)

Implementation:
Find the section where classification is called for the pre-generated path.
Wrap both calls in Promise.all or Promise.allSettled:

```typescript
const [classificationResult, acknowledgment] = await Promise.all([
  classifyResponse(...),
  generateAcknowledgment(lastUserMessage, beat.type, beat.primaryConstructs, scenario.name, lastAriaMessage),
]);
```

Ensure the acknowledgment fallback (canned acknowledgments) still works if it fails.

Show me the updated parallel section.
```

---

## Day 2: Scoring Completeness I (Prompts 43-47)

### Prompt 43 of 58: Classification Few-Shot Examples

**What it fixes:** Classification is zero-shot — the LLM has no examples of what STRONG/ADEQUATE/WEAK looks like. Adding 2-3 few-shot examples per beat type will improve classification consistency.
**Severity:** P0
**Time:** 40 min
**Audit finding:** `classification.ts:66-99` — prompt provides rubric indicators and branch scripts but zero example classifications. The LLM must infer the threshold between STRONG/ADEQUATE/WEAK purely from text descriptions.

```
File: src/lib/assessment/classification.ts

Current classification prompt (lines 66-99):
```
You are an assessment classification engine. Classify the candidate's response...
SCENARIO: ${scenario.name}
BEAT TYPE: ${beat.type}
...
RUBRIC INDICATORS:
${indicators}
BRANCH SCRIPTS:
- STRONG: ${beat.branchScripts.STRONG}
- ADEQUATE: ${beat.branchScripts.ADEQUATE}
- WEAK: ${beat.branchScripts.WEAK}
Classify the response...
```

Target: Add a FEW_SHOT_EXAMPLES section between BRANCH SCRIPTS and the classify instruction.

Implementation:
1. Create a few-shot examples object keyed by beat type (INITIAL_RESPONSE, COMPLICATION,
   SOCIAL_PRESSURE, RESOLUTION, etc.):

```typescript
const FEW_SHOT_EXAMPLES: Record<string, string> = {
  INITIAL_RESPONSE: `
EXAMPLE CLASSIFICATIONS:
Example 1 — STRONG (rubricScore: 0.82):
Response: "First I'd check whether the pressure drop is upstream or downstream of the valve. If upstream, that suggests a supply issue. If downstream, the valve itself may be the problem. I'd also want to know if this happened gradually or suddenly, because that tells us whether it's wear vs. a discrete failure."
Rationale: Identifies multiple variables systematically, considers temporal patterns, proposes diagnostic framework.

Example 2 — ADEQUATE (rubricScore: 0.50):
Response: "I'd probably look at the valve first since that's what changed recently. Maybe check if it's opening and closing properly."
Rationale: Reasonable starting point but focuses on single variable, doesn't consider system context or alternative causes.

Example 3 — WEAK (rubricScore: 0.18):
Response: "I'd call my supervisor and ask what to do."
Rationale: Delegates without analysis, no variable identification, no diagnostic reasoning.
`,
  COMPLICATION: `...similar for complication beats...`,
  // Add for: SOCIAL_PRESSURE, TIME_PRESSURE, RESOLUTION, META_REFLECTION
};
```

2. Insert into the prompt after BRANCH SCRIPTS:
   `${FEW_SHOT_EXAMPLES[beat.type] ?? ""}`

3. Write examples for all 6 beat types. Each should have:
   - 1 STRONG example with rubricScore ~0.80
   - 1 ADEQUATE example with rubricScore ~0.50
   - 1 WEAK example with rubricScore ~0.20
   - Brief rationale explaining WHY each was classified that way

Show me the complete FEW_SHOT_EXAMPLES object and the updated prompt template.
```

---

### Prompt 44 of 58: Classification JSON Parse Robustness

**What it fixes:** If the LLM returns malformed JSON, `callClassificationAI` crashes instead of falling back gracefully. Wrap the parse in try-catch and fall back to ADEQUATE.
**Severity:** P0
**Time:** 15 min
**Audit finding:** `classification.ts:102-141` — `callClassificationAI()` calls `JSON.parse()` on LLM output without try-catch. If the response contains markdown fences or commentary, the function throws.

```
File: src/lib/assessment/classification.ts

Read the callClassificationAI function (lines 102-141). Find where JSON.parse is called
on the LLM response.

Add:
1. Try to extract JSON from markdown code fences first (like content-generation.ts does):
   ```typescript
   const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
   const jsonStr = jsonMatch ? jsonMatch[1].trim() : text.trim();
   const objMatch = jsonStr.match(/\{[\s\S]*\}/);
   if (!objMatch) throw new Error("No JSON found");
   ```

2. Wrap the parse in try-catch:
   ```typescript
   try {
     const parsed = JSON.parse(objMatch[0]);
     // validate parsed has required fields
   } catch {
     // Try cleanup (trailing commas, unescaped newlines) like parseJSONResponse in content-generation.ts
     // If still fails, return fallbackClassification()
   }
   ```

3. Validate the parsed object has the required fields before returning.
   If classification is not one of STRONG/ADEQUATE/WEAK, coerce to ADEQUATE.

Show me the updated callClassificationAI with robust JSON handling.
```

---

### Prompt 45 of 58: Parallel Scenario Construct Validation

**What it fixes:** Act 3 parallel scenarios are generated by the LLM with instructions to match Act 1 constructs, but there's no post-generation validation that the LLM actually complied.
**Severity:** P1
**Time:** 20 min
**Audit finding:** `engine.ts:522-550` — LLM is instructed "same constructs, different surface details" but the response is used as-is without checking construct alignment.

```
File: src/lib/assessment/engine.ts

Current behavior (lines 522-550):
The parallel scenario system prompt tells the LLM to create a scenario matching
the source scenario's constructs. But the LLM's response is used directly —
there's no validation that the generated scenario actually tests the intended constructs.

Target behavior:
Add a construct validation step after the LLM generates the parallel scenario.

Implementation:
1. In the system prompt for parallel scenarios, add an explicit instruction:
   "End your scenario with a JSON block: { "constructsTargeted": ["CONSTRUCT_1", "CONSTRUCT_2"] }"

2. After the LLM response comes back (in the message handling/state update),
   extract the constructsTargeted JSON and compare against the source scenario's primaryConstructs.

3. Log a warning (via createLogger) if there's a mismatch, but don't block the assessment.
   This gives us observability into prompt compliance without disrupting the candidate.

4. Store the construct validation result in the message metadata for later analysis.

Show me the updated system prompt and the validation logic in computeStateUpdate.
```

---

### Prompt 46 of 58: Persist Assessment Cost to Database

**What it fixes:** Token usage and cost are calculated during scoring but only logged — not persisted to a queryable DB field. Adds a `costEstimate` field to the assessment record.
**Severity:** P1
**Time:** 25 min
**Audit finding:** `layer-b.ts:198-208` tracks tokens; `pipeline.ts:160-165` logs cost but doesn't persist it. No DB field exists for per-assessment cost.

```
File: prisma/schema.prisma
File: src/lib/assessment/scoring/pipeline.ts

Step 1: Add cost tracking fields to the Assessment model in schema.prisma:
```prisma
model Assessment {
  // ... existing fields ...
  scoringCostUsd    Float?    // Total LLM cost in USD for scoring this assessment
  scoringTokensIn   Int?      // Total input tokens used in scoring
  scoringTokensOut  Int?      // Total output tokens used in scoring
}
```

Step 2: Run `npx prisma migrate dev --name add-scoring-cost-fields`

Step 3: In pipeline.ts, after the pipeline completes successfully (around line 160),
persist the token usage:

```typescript
const tokenUsage = getTokenUsage();
const costUsd = (tokenUsage.inputTokens * 0.8 + tokenUsage.outputTokens * 4) / 1_000_000;

await prisma.assessment.update({
  where: { id: assessmentId },
  data: {
    scoringCostUsd: costUsd,
    scoringTokensIn: tokenUsage.inputTokens,
    scoringTokensOut: tokenUsage.outputTokens,
  },
});
```

Show me the schema change, migration, and pipeline update.
```

---

### Prompt 47 of 58: Classification Cost Tracking

**What it fixes:** Classification and acknowledgment LLM calls during the assessment (not just scoring) are not tracked. These are the majority of per-assessment LLM spend.
**Severity:** P1
**Time:** 20 min
**Audit finding:** `classification.ts:102-141` and `generate-acknowledgment.ts` make Haiku API calls but don't track input/output tokens. Only Layer B scoring tracks tokens.

```
File: src/lib/assessment/classification.ts
File: src/lib/assessment/generate-acknowledgment.ts
File: src/app/api/assess/[token]/chat/route.ts

Current behavior:
- Classification makes 2 parallel Haiku calls per candidate turn (lines 27-30)
- Acknowledgment makes 1 Haiku call per turn
- Neither tracks token usage from the API response

Target behavior:
Track cumulative real-time LLM costs during the assessment (not just scoring).

Implementation:
1. In classification.ts callClassificationAI(), after parsing the API response,
   extract `data.usage?.input_tokens` and `data.usage?.output_tokens`.
   Return them alongside the classification result.

2. In generate-acknowledgment.ts, similarly extract token usage from the response.

3. In chat/route.ts, accumulate tokens per assessment session.
   Store cumulative token count in AssessmentState (add `realtimeTokensIn` and
   `realtimeTokensOut` fields) and update on each turn.

4. When the assessment completes, the total real-time cost is:
   realtimeTokens + scoringTokens = total assessment cost.

Show me the token extraction in classification and the accumulation in chat/route.ts.
```

---

## Day 3: Scoring Completeness II (Prompts 48-50)

### Prompt 48 of 58: Spatial Visualization — Text Descriptions for Hard Items

**What it fixes:** All 18 SPATIAL_VISUALIZATION items are text-only. The 7 hard items (net-folding, projection, 3D transformation) lose assessment fidelity without visual aids. Since SVG generation is complex and risky, this prompt instead improves the text descriptions to be more spatially precise and adds ASCII art where possible.
**Severity:** P1
**Time:** 35 min
**Audit finding:** `item-bank.ts` — SPATIAL_VISUALIZATION has 18 items, 0 with `imageUrl`. Hard items like `sv-h3` (net-folding: "How many distinct nets can fold into a cube?") and `sv-h7` (projection: "L-shaped 3D piece viewed from front, side, top") are difficult to assess without visual representation.

```
File: src/lib/assessment/item-bank.ts

Current spatial hard items (sv-h1 through sv-h7):
Read each one and evaluate whether the text description is sufficient.

For items that NEED visual support but can be described with ASCII art, add an
`asciiDiagram` field to the item type and populate it:

Example for a net-folding item:
```
asciiDiagram: `
  ┌───┐
  │ 1 │
┌─┼───┼─┐
│2│ 3 │4│
└─┼───┼─┘
  │ 5 │
  └───┘
Which face is opposite face 3?`
```

For items where text is genuinely insufficient (e.g., complex 3D transformations),
consider replacing with text-solvable alternatives that test the same construct
at the same difficulty level.

Rules:
- Each hard spatial item should be solvable from text alone OR have ASCII art
- ASCII art must render correctly in a monospace-font UI component
- Don't change item IDs (they must remain stable)
- Keep difficulty values unchanged

Show me the updated spatial hard items with ASCII diagrams where needed.
```

---

### Prompt 49 of 58: Mechanical Reasoning — Add 5 Items to Match Other Constructs

**What it fixes:** MECHANICAL_REASONING and FLUID_REASONING have only 15 items each vs. 18-20 for others. Adding 5 items to each ensures the adaptive loop has equal runway across all constructs.
**Severity:** P2
**Time:** 30 min
**Audit finding:** `item-bank.ts` — MR has 15 items (4 easy, 6 medium, 5 hard), FR has 15 items (4 easy, 6 medium, 5 hard). Other constructs have 18-20. This means the adaptive loop could exhaust MR/FR items before fully resolving the boundary.

```
File: src/lib/assessment/item-bank.ts

Add 5 items to MECHANICAL_REASONING and 5 to FLUID_REASONING:
- 1 easy (difficulty 0.20-0.30)
- 2 medium (difficulty 0.40, 0.55)
- 2 hard (difficulty 0.70, 0.80)

For MECHANICAL_REASONING:
- Follow the existing subtypes: lever, pulley, gear, fluid, thermal, friction
- Use the same MCQ format: prompt, options (4 choices), correctAnswer, difficulty
- ID format: mr-e5, mr-m7, mr-m8, mr-h6, mr-h7

For FLUID_REASONING:
- Follow existing subtypes: analogy, series, matrix, deduction, conditional
- Same MCQ format
- ID format: fr-e5, fr-m7, fr-m8, fr-h6, fr-h7

Each item must have:
- Clear, unambiguous prompt
- 4 options (A, B, C, D)
- One correct answer
- Difficulty calibrated to match existing items at that tier
- A subtype tag

Show me the 10 new items added to the ITEM_BANK array.
```

---

### Prompt 50 of 58: Norm Table Documentation and Recalibration Guide

**What it fixes:** Norm tables are placeholder sigmoid curves with no documentation on when/how to recalibrate. Adds a header comment explaining the current state and a runbook for recalibration.
**Severity:** P2
**Time:** 15 min
**Audit finding:** `norm-tables.ts:3-4` — comment says "will be replaced with IRT-based tables after norming" but no instructions exist for when/how. `norm-recalibrator.ts` exists but is manually invoked with no documentation.

```
File: src/lib/assessment/norm-tables.ts

Add a comprehensive header comment:

```typescript
/**
 * Norm Tables — Percentile Mapping for Construct Scores
 *
 * CURRENT STATE (as of Sprint 4):
 * Using placeholder logistic (sigmoid) curves with k=6, midpoint=0.5.
 * Per-construct difficulty offsets adjust for known construct-level biases.
 *
 * These are NOT empirical norms. They are designed to produce reasonable-looking
 * percentile distributions for initial customer deployments.
 *
 * RECALIBRATION PROCEDURE:
 * 1. Accumulate 200+ completed assessments
 * 2. Run: npx tsx scripts/recalibrate-norms.ts [--orgId=optional]
 *    This calls norm-recalibrator.ts which:
 *    a. Pulls all SubtestResult records from the database
 *    b. Computes empirical mean, SD, and percentile breakpoints per construct
 *    c. Outputs a ConstructNorm[] array for each construct
 * 3. Replace defaultMapping() with empirical lookup tables
 * 4. After IRT calibration study (Q2): replace with IRT theta-to-percentile curves
 *
 * KNOWN OFFSETS:
 * - FLUID_REASONING: -0.05 (items tend to be harder)
 * - COGNITIVE_FLEXIBILITY: +0.05 (scenario scoring tends generous)
 * - PROCEDURAL_RELIABILITY: +0.10 (Likert responses skew positive)
 */
```

Also create the script file referenced above:
File: scripts/recalibrate-norms.ts

A simple wrapper that calls recalibrateNorms() from norm-recalibrator.ts
and prints the results as a JSON table.

Show me the updated norm-tables.ts header and the new script.
```

---

## Day 4: Observability (Prompts 51-55)

### Prompt 51 of 58: Assessment Analytics API Route

**What it fixes:** No API endpoint exists to query assessment analytics. Adds an admin API route returning completion rates, average duration, drop-off by act, and classification distribution.
**Severity:** P1
**Time:** 35 min
**Audit finding:** No analytics endpoint found in the codebase. Completion tracking exists in `complete/route.ts` but is not aggregated. No drop-off or classification distribution queries.

```
File: src/app/api/admin/analytics/route.ts (NEW)

Create an authenticated admin API route that returns:

1. **Assessment completion metrics** (last 30 days):
   - Total started
   - Total completed
   - Completion rate (%)
   - Average duration (minutes)

2. **Drop-off by phase** (where candidates abandoned):
   - Count per orchestrator phase (PHASE_0, ACT_1, ACT_2, ACT_3)
   - Derived from assessments that started but didn't complete,
     using the last known phase from AssessmentState

3. **Classification distribution** (Act 1 only):
   - STRONG / ADEQUATE / WEAK counts and percentages
   - From ConversationMessage records where metadata contains classification

4. **Scoring pipeline health** (last 30 days):
   - Pipeline runs (count from ScoringRun or assessment completedAt)
   - Success rate
   - Average pipeline duration
   - Total LLM cost (from scoringCostUsd if persisted in Prompt 46)

Authentication: Require the user to be authenticated with role ADMIN or TA_LEADER.
Use the existing auth pattern from other admin routes.

Query approach: Use Prisma aggregations (groupBy, count, avg) — not raw SQL.

Return JSON with clear field names and ISO timestamps.

Show me the complete route file.
```

---

### Prompt 52 of 58: Admin Health Check Endpoint

**What it fixes:** No system health endpoint exists. Adds a lightweight health check that verifies DB connectivity and returns system status.
**Severity:** P1
**Time:** 15 min
**Audit finding:** No health/status endpoints found. The only system verification is Sentry error tracking.

```
File: src/app/api/admin/health/route.ts (NEW)

Create a simple health check endpoint:

1. Check database connectivity (SELECT 1)
2. Check environment variables are set (ANTHROPIC_API_KEY, ELEVENLABS_API_KEY, etc.)
3. Return:
   ```json
   {
     "status": "ok" | "degraded",
     "timestamp": "ISO string",
     "checks": {
       "database": { "status": "ok", "latencyMs": 12 },
       "anthropicKey": { "status": "ok" },
       "elevenLabsKey": { "status": "ok" },
       "sentryDsn": { "status": "ok" | "missing" }
     },
     "version": "from package.json"
   }
   ```

4. Authentication: Allow unauthenticated access (for uptime monitors)
   but ONLY return status — no secrets or internal details.

5. Return 200 for "ok", 503 for "degraded" (DB unreachable).

Show me the complete route file.
```

---

### Prompt 53 of 58: Migrate Console Logging to createLogger

**What it fixes:** Many critical code paths use `console.log/warn/error` instead of the structured `createLogger` system. This makes production log aggregation inconsistent.
**Severity:** P1
**Time:** 25 min
**Audit finding:** Only 3 modules use `createLogger` (scoring-pipeline, layer-b, layer-c). The chat route, engine, classification, content-serving, and other modules use raw `console.*`.

```
File: src/app/api/assess/[token]/chat/route.ts
File: src/lib/assessment/engine.ts
File: src/lib/assessment/classification.ts
File: src/lib/assessment/content-serving.ts
File: src/lib/assessment/generate-acknowledgment.ts
File: src/app/api/assess/[token]/complete/route.ts

For each file:
1. Import createLogger from "@/lib/assessment/logger"
2. Create a module-level logger: `const log = createLogger("module-name")`
3. Replace all console.log → log.info, console.warn → log.warn, console.error → log.error
4. Add structured context where available:
   - assessmentId (from route params or state)
   - construct (when scoring-related)
   - durationMs (when timing operations)

Module names to use:
- chat-route
- engine
- classification
- content-serving
- acknowledgment
- complete-route

Do NOT change log content — just migrate the transport from console to createLogger.
Do NOT touch modules that already use createLogger (pipeline.ts, layer-b.ts, layer-c.ts).

Show me each file with the console.* calls replaced.
```

---

### Prompt 54 of 58: Assessment Duration Tracking Per Act

**What it fixes:** Assessment duration is tracked at the session level only. Per-act timing enables drop-off analysis and identifies which acts take longest.
**Severity:** P2
**Time:** 20 min
**Audit finding:** `complete/route.ts` calculates total `durationMinutes`. No per-act duration exists. AssessmentState tracks `currentAct` but not act start/end timestamps.

```
File: src/app/api/assess/[token]/chat/route.ts

In the chat route, when act transitions occur (detected via metadata.transition
or when currentAct changes in state updates), record the timestamp.

Implementation:
1. In the state update logic (computeStateUpdate or the equivalent in chat/route.ts),
   detect act transitions by comparing old state.currentAct to new state.currentAct.

2. When an act transition occurs, record:
   ```typescript
   await prisma.assessmentState.update({
     where: { assessmentId },
     data: {
       [`${previousAct.toLowerCase()}CompletedAt`]: new Date(),
     },
   });
   ```

3. This requires adding timestamp fields to AssessmentState:
   ```prisma
   model AssessmentState {
     // existing fields...
     phase0CompletedAt    DateTime?
     act1CompletedAt      DateTime?
     act2CompletedAt      DateTime?
     act3CompletedAt      DateTime?
   }
   ```

4. Run migration: `npx prisma migrate dev --name add-act-timestamps`

Show me the schema change and the transition detection logic.
```

---

### Prompt 55 of 58: Feature Flag for Classification Few-Shot

**What it fixes:** Adding a feature flag for the few-shot classification examples (from Prompt 43) allows gradual rollout and A/B comparison of classification accuracy.
**Severity:** P2
**Time:** 10 min
**Audit finding:** `config.ts:33-36` — only `CONTENT_LIBRARY_ENABLED` exists. No flag for classification variants.

```
File: src/lib/assessment/config.ts

Add to FEATURE_FLAGS:
```typescript
export const FEATURE_FLAGS = {
  CONTENT_LIBRARY_ENABLED: process.env.FEATURE_CONTENT_LIBRARY === "true",
  CLASSIFICATION_FEW_SHOT: process.env.FEATURE_CLASSIFICATION_FEW_SHOT !== "false", // Default ON
} as const;
```

In classification.ts, wrap the few-shot examples insertion behind this flag:
```typescript
const fewShotSection = FEATURE_FLAGS.CLASSIFICATION_FEW_SHOT
  ? FEW_SHOT_EXAMPLES[beat.type] ?? ""
  : "";
```

This allows disabling few-shot examples in production if they cause unexpected
classification shifts during initial rollout.

Show me the config update and the conditional in classification.ts.
```

---

## Day 5: Test Coverage (Prompts 56-58)

### Prompt 56 of 58: Vitest Setup + Engine State Machine Tests

**What it fixes:** Zero test infrastructure exists. Sets up Vitest and writes foundational tests for the engine state machine — the most critical untested code path (873 lines).
**Severity:** P1
**Time:** 45 min
**Audit finding:** No test framework configured. No `*.test.ts` files. `package.json` has no test runner script. `engine.ts` has 873 lines of untested state machine logic.

```
Step 1: Install Vitest
```bash
npm install -D vitest @vitest/coverage-v8
```

Step 2: Create vitest.config.ts at project root:
```typescript
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
```

Step 3: Add to package.json scripts:
```json
"test": "vitest run",
"test:watch": "vitest",
"test:coverage": "vitest run --coverage"
```

Step 4: Create src/lib/assessment/__tests__/engine.test.ts

Write tests for the engine state machine. Since engine.ts depends on Prisma and
external APIs, test the PURE LOGIC functions by extracting or testing via the
public interface with mocked dependencies.

Test cases (minimum 8):
1. getNextAction returns ACT_1 action when currentAct is ACT_1
2. getNextAction returns TRANSITION when Act 1 is complete (all scenarios done)
3. getNextAction returns ACT_2 action when currentAct is ACT_2
4. getNextAction returns TRANSITION when Act 2 is complete (all constructs done)
5. getNextAction returns ACT_3 action when currentAct is ACT_3
6. getNextAction returns COMPLETE when Act 3 is complete
7. computeStateUpdate advances beat correctly for Act 1
8. computeStateUpdate advances scenario when all beats complete

Mock the SCENARIOS import and any Prisma calls.
Use vi.mock() for external dependencies.

Show me vitest.config.ts, the package.json changes, and the complete test file.
```

---

### Prompt 57 of 58: Adaptive Loop Unit Tests

**What it fixes:** The adaptive loop (356 lines) has zero tests. It implements a multi-phase item selection algorithm with boundary detection that could silently break.
**Severity:** P1
**Time:** 35 min
**Audit finding:** `adaptive-loop.ts` — 356 lines with functions `initLoopState`, `getNextItem`, `recordResult`, `evaluatePressureTest`, `computeAdaptiveScore`. All untested.

```
File: src/lib/assessment/__tests__/adaptive-loop.test.ts

Write unit tests for the adaptive loop. These functions are mostly PURE
(operate on state objects, return new state objects), making them easy to test.

Test cases (minimum 10):

initLoopState:
1. Returns CALIBRATION phase with correct construct
2. Returns empty results arrays

getNextItem:
3. In CALIBRATION phase, returns items at the correct difficulty targets
4. In BOUNDARY_MAPPING phase, returns items between floor and ceiling
5. Returns null when all items at target difficulty are exhausted
6. Skips already-used item IDs

recordResult:
7. After 3 calibration items, transitions to BOUNDARY_MAPPING
8. Sets floor/ceiling correctly from calibration results
9. In BOUNDARY_MAPPING, narrows the boundary range on correct/incorrect
10. After boundary is confirmed, transitions to PRESSURE_TEST

computeAdaptiveScore:
11. Returns 1.0 when all items correct
12. Returns 0.0 when all items incorrect
13. Weights harder items slightly more

evaluatePressureTest:
14. Returns confirmed:true when correctRate <= 0.3
15. Returns contradiction:true when correctRate >= 0.7

Import the actual functions — don't mock them. Only mock
getItemsForConstruct if needed (to control available items).

Show me the complete test file.
```

---

### Prompt 58 of 58: Scoring Aggregation Unit Tests

**What it fixes:** Scoring aggregation combines Layer A, Layer B, consistency, and ceiling characterization — all with specific formulas and thresholds that could silently drift.
**Severity:** P1
**Time:** 35 min
**Audit finding:** `scoring/aggregation.ts`, `scoring/consistency.ts`, `scoring/layer-a.ts` — multi-layer scoring logic with configurable thresholds (consistency: 0.15, downweight: 0.75x, high-variance: 0.5x weight) and zero tests.

```
File: src/lib/assessment/scoring/__tests__/scoring.test.ts

Write unit tests for scoring functions. Focus on the PURE computation functions
(no Prisma mocking needed for most of these).

Test cases (minimum 10):

Layer A (scoreItem, aggregateLayerA):
1. scoreItem returns correct:true for matching answer
2. scoreItem returns correct:false for wrong answer
3. aggregateLayerA computes weighted average by difficulty

Consistency (validateConsistency):
4. Returns "HIGH" when Act 1 - Act 3 delta < 0.15
5. Returns "LOW" when delta >= 0.15
6. Applies 0.75x downweight factor for LOW consistency

Aggregation (aggregateConstructScore):
7. Returns weighted combination of Layer A and Layer B scores
8. Applies consistency downweight when consistencyLevel is LOW
9. Layer B high-variance responses get 0.5x weight

Norm tables (rawScoreToPercentile):
10. Maps 0.5 raw score to ~50th percentile (sigmoid midpoint)
11. Maps 0.0 to near 1st percentile
12. Maps 1.0 to near 99th percentile
13. Applies construct difficulty offsets

Import actual functions from layer-a, consistency, aggregation, norm-tables.
These are pure math functions — no mocking needed.

Show me the complete test file.
```

---

## Test Checkpoint

After completing all prompts, run:

```bash
# Type check
npx tsc --noEmit

# Unit tests
npm test

# Build
npm run build
```

**Expected results:**
- Type check: clean (scripts/ excluded)
- Tests: 28+ passing (8 engine + 10 adaptive + 10+ scoring)
- Build: clean production build

---

## Deferred Items (Q2 Scope)

| Item | Reason |
|------|--------|
| WebSocket TTS | Requires ElevenLabs streaming API integration + WS infrastructure |
| Pre-generated audio files | Requires storage architecture (S3/CDN) + voice consistency across sessions |
| Deepgram/Scribe STT | Requires API integration + quality comparison + fallback logic |
| IRT-based norm tables | Requires 200+ completed assessments for calibration study |
| Multi-language support | Requires TTS voice selection + STT language config + prompt translation |
| SOC 2 / ITAR compliance | Legal + infrastructure project |
| Comprehensive test coverage (200+ tests) | Sprint 4 establishes foundation; expand in Sprint 5 |
| Construct validation study | Research project requiring statistical analysis |
| Adverse impact analysis | Requires 200+ real candidate results across demographics |
| White-label deployment | Requires theming architecture + multi-tenant DNS |
| Self-assessment scoring rubric | Requires psychometric design for reflective response evaluation |

---

## Troubleshooting Reference

### TTS Pre-Fetch Issues
- **Symptom:** Audio gaps between sentences despite pre-fetch
- **Check:** Verify `prefetch()` resolves before current sentence ends
- **Fix:** Increase lookahead to 2 sentences if network is slow

### Classification Few-Shot Drift
- **Symptom:** Classification distribution shifts significantly after adding examples
- **Check:** Compare STRONG/ADEQUATE/WEAK ratios before/after via analytics API
- **Fix:** Disable via `FEATURE_CLASSIFICATION_FEW_SHOT=false`, adjust example rubricScores

### Vitest Path Alias Issues
- **Symptom:** `Cannot find module '@/lib/...'` in tests
- **Fix:** Ensure vitest.config.ts has the `@` alias matching tsconfig paths

### Migration Conflicts
- **Symptom:** Prisma migrate fails on existing DB
- **Fix:** `npx prisma migrate reset` on dev only; for prod use `npx prisma migrate deploy`

### Cost Tracking Accuracy
- **Symptom:** `scoringCostUsd` seems too low
- **Check:** Verify Haiku pricing hasn't changed from $0.80/$4.00 per MTok
- **Fix:** Update cost constants in `layer-b.ts:306` and `pipeline.ts:165`

---

## Critical Files

| File | Prompts |
|------|---------|
| `src/components/assessment/voice/tts-engine.ts` | 39, 40 |
| `src/components/assessment/stage/assessment-stage.tsx` | 40, 41 |
| `src/app/api/assess/[token]/chat/route.ts` | 42, 47, 53, 54 |
| `src/lib/assessment/classification.ts` | 43, 44, 53, 55 |
| `src/lib/assessment/scoring/pipeline.ts` | 46, 53 |
| `src/lib/assessment/scoring/layer-b.ts` | 47 |
| `src/lib/assessment/engine.ts` | 45, 53 |
| `src/lib/assessment/item-bank.ts` | 48, 49 |
| `src/lib/assessment/norm-tables.ts` | 50 |
| `src/lib/assessment/config.ts` | 55 |
| `src/lib/assessment/generate-acknowledgment.ts` | 47, 53 |
| `src/lib/assessment/content-serving.ts` | 53 |
| `src/app/api/assess/[token]/complete/route.ts` | 53 |
| `src/app/api/admin/analytics/route.ts` | 51 (NEW) |
| `src/app/api/admin/health/route.ts` | 52 (NEW) |
| `vitest.config.ts` | 56 (NEW) |
| `src/lib/assessment/__tests__/engine.test.ts` | 56 (NEW) |
| `src/lib/assessment/__tests__/adaptive-loop.test.ts` | 57 (NEW) |
| `src/lib/assessment/scoring/__tests__/scoring.test.ts` | 58 (NEW) |
| `prisma/schema.prisma` | 46, 54 |

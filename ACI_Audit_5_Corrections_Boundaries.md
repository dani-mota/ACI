# Audit 5: Corrections & Boundaries

**Purpose:** Correct factual errors from earlier analysis and documentation. Document what's working and should not be changed. Prevent future work from being based on wrong assumptions.

**Methodology:** Every claim below was verified against the actual source code, with file:line references.

---

## Part 1: Corrections to Prior Claims

### Correction 1: "Streaming Sonnet" — WRONG MODEL

**Claim (in PRD v1.15, Architecture Reference, Audit 2):** Multiple documents describe the real-time streaming path as "streaming Sonnet" or "live Sonnet streaming."

**Reality:** Every real-time AI call in the assessment uses `AI_CONFIG.realtimeModel` = `claude-haiku-4-5-20251001`.

| Call Site | Model Used | File:Line |
|-----------|-----------|-----------|
| Streaming response generation | Haiku | [chat/route.ts:720](src/app/api/assess/[token]/chat/route.ts#L720) |
| Classification (dual-eval) | Haiku | [classification.ts:213](src/lib/assessment/classification.ts#L213) |
| Acknowledgment generation | Haiku | [generate-acknowledgment.ts:39](src/lib/assessment/generate-acknowledgment.ts#L39) |
| Layer B scoring (triple-eval) | Haiku | [layer-b.ts:180](src/lib/assessment/scoring/layer-b.ts#L180) |
| Diagnostic probe classification | Haiku | [diagnostic-probe.ts:41](src/lib/assessment/diagnostic-probe.ts#L41) |

Sonnet (`claude-sonnet-4-20250514`) is ONLY used in offline content generation:
- [content-generation.ts:361](src/lib/assessment/content-generation.ts#L361) — batch content library generation
- [scenarios/generator.ts:36](src/lib/assessment/scenarios/generator.ts#L36) — scenario shell generation

**Documents with this error that need correction:**
1. [ACI_PRD_v1_15.md:1020](ACI_PRD_v1_15.md) — "serves pre-generated text instead of streaming Sonnet"
2. [ACI_PRD_v1_15.md:1198](ACI_PRD_v1_15.md) — "Without it, each beat streams from Sonnet"
3. [ACI_Architecture_Reference.md:360](ACI_Architecture_Reference.md) — "live Sonnet streaming"
4. [ACI_Architecture_Reference.md:468](ACI_Architecture_Reference.md) — "When disabled, the assessment falls back to live Sonnet streaming"
5. [ACI_Audit_2_Request_Flow_Traces.md:98](ACI_Audit_2_Request_Flow_Traces.md) — "Model: AI_CONFIG.realtimeModel (claude-sonnet-4-20250514)" — wrong model ID in parenthetical

**Why this matters:** If someone reads the PRD and decides to "optimize" by switching from Sonnet to Haiku for latency, they'll discover Haiku is already in use. If someone reads the Architecture Reference and budgets for Sonnet pricing on the real-time path, they'll overestimate costs by ~10×.

---

### Correction 2: "Classification can run fully in background" — OVERSIMPLIFIED

**Claim:** Earlier analysis suggested classification could be decoupled from response generation.

**Reality:** In the content library path (beats 3-5), classification determines WHICH pre-generated branch to serve.

The flow at [chat/route.ts:354-402](src/app/api/assess/[token]/chat/route.ts#L354):
1. Classification runs → returns `"STRONG"`, `"ADEQUATE"`, or `"NEEDS_DEVELOPMENT"`
2. `computeStateUpdate(state, action, classification)` advances the beat
3. State re-fetched (line 388)
4. Content lookup uses `branchPath[last]` to select the variant: [chat/route.ts:618-619](src/app/api/assess/[token]/chat/route.ts#L618):
   ```typescript
   const branchPath = (state.branchPath as ResponseClassification[] | null) ?? [];
   preGenClassification = branchPath[branchPath.length - 1] ?? "ADEQUATE";
   ```
5. `lookupBeatContent(library, scenarioIndex, beatIndex, preGenClassification, ...)` serves the matching branch

Classification → branch selection → content lookup is a serial dependency. You cannot serve the correct pre-generated content without first knowing the classification.

**Where this is legitimately decoupled:** In the streaming path (beats 1-2), the LLM generates content in real-time and adapts to the candidate on its own. Classification still runs for scoring/state, but the content doesn't depend on it. Here, classification COULD run in parallel with streaming.

---

### Correction 3: Remediation Plan Items Already Implemented

**Claim (remediation plan):** Several items are listed as "NEW file" to be created.

**Reality:** The following have already been implemented:

| Plan Item | File | Status |
|-----------|------|--------|
| 1.1 Env validation | [src/lib/env.ts](src/lib/env.ts) | Implemented — Zod schema with all required vars |
| 1.2 Resilient HTTP client | [src/lib/api-client.ts](src/lib/api-client.ts) | Implemented — `resilientFetch()` with retry + backoff + 429 handling |
| 1.3 Shared API handler | [src/lib/api-handler.ts](src/lib/api-handler.ts) | Implemented — `withApiHandler()` with Sentry + auth + logging |
| 1.5 Client error utility | [src/lib/errors.ts](src/lib/errors.ts) | Implemented — `mapApiError()` used in store |
| 3.1 Item bank `server-only` | [item-bank.ts:1](src/lib/assessment/item-bank.ts) | Implemented — `import "server-only"` guard |
| 5.3 `.stage-animate` CSS | [globals.css:296](src/app/globals.css) | Implemented — `transition: opacity 300ms ease, transform 300ms ease` |

**Items NOT yet implemented (still valid work):**
- 1.4 Logger requestId correlation — `createLogger` doesn't accept requestId
- 2.1 Schema hardening — `ERROR` enum, unique constraints on `ConversationMessage` and `AIEvaluationRun`
- 2.2 Scoring pipeline idempotency — already implemented in code but not via the plan's approach
- 2.3 Pipeline `after()` + `maxDuration` — already implemented in [complete/route.ts:7,89](src/app/api/assess/[token]/complete/route.ts#L7)
- 3.3 Prompt injection defense — `sanitizeForPrompt` exists but not extended per plan
- 3.4 Redis rate limiter — still in-memory only

---

### Correction 4: Audit 2 Model Label Error

**Claim (Audit 2, line 98):** Lists the acknowledgment model as `claude-sonnet-4-20250514`.

**Reality:** The acknowledgment generator at [generate-acknowledgment.ts:39](src/lib/assessment/generate-acknowledgment.ts#L39) uses `AI_CONFIG.realtimeModel` which is `claude-haiku-4-5-20251001`. The parenthetical model ID in the audit is wrong.

---

### Correction 5: Audit 3 Bug 6 Was Self-Corrected

**Original claim:** Bug 6 (displayEvent double-fire) was listed as P2.

**Self-correction in the same audit:** After deeper analysis, the audit downgraded it to P3 and noted "No actual double-fire occurs. The code is complex but correct." The self-correction is accurate — `displayEvent` only increments inside `displayMessage()`, not when reference card data is set. The summary table correctly shows P3, but the heading still says P2. Cosmetic inconsistency.

---

### Correction 6: "responseTimeMs used as time penalty in Layer A" — WRONG

**Claim (user's Audit 4 template):** Listed "Time penalty if response > 2× slow threshold" under Act 2 scoring.

**Reality:** Layer A at [layer-a.ts:24-37](src/lib/assessment/scoring/layer-a.ts#L24) has NO time penalty. The formula is purely binary accuracy × difficulty weight:
```
rawScore = correct ? 1 × (1 + (difficulty - 0.5) × 0.3) : 0
```

`responseTimeMs` is recorded in `ItemResponse` and passed through to `aggregateLayerA` for reporting (`avgResponseTimeMs`), but it never affects the score calculation. Audit 4 correctly documents this ("Note: responseTimeMs is recorded but NOT factored into the score"), correcting the template.

---

## Part 2: What Is Working and Must Not Be Changed

### TTS Engine (`src/components/assessment/voice/tts-engine.ts`)

The audio pipeline is correct. It:
- Fetches chunks from ElevenLabs via `/api/assess/[token]/tts`
- Decodes to `AudioBuffer` via `AudioContext.decodeAudioData()`
- Pipelines playback: starts first chunk immediately while fetching remaining
- N+1 prefetch in `playSentenceSequence` via `ttsRef.current.prefetch()`
- Reads amplitude from `AnalyserNode` for orb animation
- Falls back to `SpeechSynthesis` when ElevenLabs unavailable or `AudioContext` suspended
- Caches buffers + text for replay: `Map<string, { text: string; buffers: AudioBuffer[] }>`
- `preSplit` parameter (v1.13) prevents double-splitting when caller already segmented sentences

**Known issues (from Audit 3):** AudioContext fallback is permanent (Bug 8), TTS timeout creates word snap (Bug 7). These are upstream coordination issues, not TTS engine bugs.

### Adaptive Loop (`src/lib/assessment/adaptive-loop.ts`)

Fully correct implementation:
- `getCalibrationItem()` — fixed difficulty bands [0.15-0.35], [0.4-0.6], [0.65-0.85]
- `getBoundaryItem()` — binary search targeting midpoint of correct/incorrect difficulties
- `getPressureTestItem()` — near-boundary items with different `subType`
- `computeBoundary()` — floor/ceiling/confidence calculation with gap-based confidence
- `recordResult()` — phase transitions gated by count, confidence, and contradiction detection
- `computeAdaptiveScore()` — difficulty-weighted accuracy across all phases

No connection to conversational issues. No changes needed.

### Item Bank (`src/lib/assessment/item-bank.ts`)

86 static items across 5 constructs. Each has: `id`, `construct`, `subType`, `difficulty` (0.0-1.0), `correctAnswer`, `prompt`, `options`, `timingExpectation`. Protected by `import "server-only"` guard. No issues.

### Scoring Pipeline (`src/lib/assessment/scoring/`)

All 13 steps verified in Audit 4. Key properties:
- **Layer A:** Deterministic, difficulty-weighted, no time penalty
- **Layer B:** Triple-eval, median score, variance downweight (SD > 0.3 → 0.5×)
- **Aggregation:** 55/45 A/B split, 0.75× consistency downweight
- **Composites:** Role-weighted percentiles via `CompositeWeight` records
- **Cutlines:** 3-layer threshold (tech/behavioral/LV)
- **Red flags:** 12 checks (7 original + 5 V2)
- **Idempotency:** Layer B guard on `AIEvaluationRun` count, all writes via upsert
- **Atomicity:** Single `$transaction` for all DB writes
- **Missing data:** Handled gracefully across all scenarios

### Phase 0 (`src/lib/assessment/phase-0.ts`)

4 scripted segments with candidate name + company name interpolation. No AI calls. No issues.

### Transitions (`src/lib/assessment/transitions.ts`)

Scripted act transition narration with orb resize, layout crossfade, act label animations. All via `TransitionLine[]` with `onStart`/`onComplete` callbacks. Working correctly.

### Nudge System (`src/lib/assessment/nudge-system.ts`)

Three-tier silence detection per act context. Correctly uses `setTimeout` chains with `start`/`reset`/`pause`/`resume`/`stop`. Callbacks use `getStore()` for fresh state (verified in Audit 3, FP4). **One issue:** `[NO_RESPONSE]` sentinel creates infinite loop (Audit 3, Bug 1) — but this is a chat route handling issue, not a nudge system bug.

### Interactive Element Components

`StageChoiceCards`, `StageNumericInput`, `StageTimedChallenge`, `StageConfidenceRating`, `InteractiveRenderer` — all render correctly and submit responses through `sendElementResponse()`.

### Visual Components

| Component | Driven By | Status |
|-----------|-----------|--------|
| Assessment orb | `audioAmplitude`, `orbMode`, `orbTargetSize` | Working |
| SubtitleDisplay | `subtitleText`, `subtitleRevealedWords` | Working |
| ScenarioReferenceCard | `referenceCard`, `referenceRevealCount` | Working |
| ActLabel | `currentAct` | Working |
| StageProgressBar | `actProgress` | Working |
| TransitionScreen | `orchestratorPhase` | Working |
| CompletionScreen | `isComplete` | Working |

### Database Schema (`prisma/schema.prisma`)

No model changes needed. The schema supports:
- `ConversationMessage` with `metadata: Json?` for flexible construct tagging
- `ItemResponse` with upsert via `assessmentId_itemId` compound unique
- `AssessmentState` with JSON blobs for `act2Progress`, `branchPath`, `variantSelections`
- `AIEvaluationRun` with compound unique for idempotent scoring
- `CompositeWeight` with versioning and `effectiveTo` for weight lifecycle
- `Cutline` with per-role-per-org thresholds
- `RedFlag`, `Prediction`, `CompositeScore`, `SubtestResult` — all with proper relations

### Authentication & Dashboard

Supabase auth, role-based access (TA_LEADER, ADMIN), invitation management, candidate management, assessment results display — all unrelated to assessment experience issues.

### Tutorial System

Industry selector, 4 demo orgs, mini assessment, test infrastructure — all working independently of the live assessment path.

---

## Part 3: Where the Problems Actually Are

| Area | Status | Root Cause | Audit Reference |
|------|--------|------------|-----------------|
| `[NO_RESPONSE]` sentinel handling | **Broken** | Sentinel skips classification → beat never advances → infinite loop | Audit 3, Bug 1 |
| Stale message history in classification | **Broken** | `assessment.messages` not updated after candidate message persistence | Audit 3, Bug 2 |
| AudioContext fallback permanent | **Broken** | `fallbackActive` never reset after tab background | Audit 3, Bug 8 |
| Pre-v1.15 content libraries | **Stale** | May contain baked-in meta-narration from old prompts | Audit 3, Bug 4 |
| Metadata type safety | **Risk** | `Json?` metadata with no TypeScript interface — silent breakage if construct tags dropped | Audit 4, Finding 1 |
| Classification constructSignals | **Gap** | Per-response signal strengths computed but not persisted | Audit 4, Finding 2 |
| Rate limiter scope | **Weak** | In-memory only — ineffective across serverless isolates | Audit 3, Bug 9 |
| TTS timeout word snap | **Minor** | Safety timeout jumps remaining words instead of progressive reveal | Audit 3, Bug 7 |
| `findFirst` vs `findUnique` | **Minor** | Consistency issue only — `candidateId` is `@unique` | Audit 3, Bug 3 |

### What Is NOT Broken

| Area | Prior Claim | Actual Status |
|------|-------------|---------------|
| Beat advancement logic | "Off-by-one" | Working — classification advances, engine produces for new beat (Audit 3, FP1) |
| State update sequencing | "Double state update" | Working — second `computeStateUpdate` returns `{}` without classification (Audit 3, FP2) |
| Acknowledgment parallelism | "Race condition" | Working — acknowledgment is classification-independent by design (Audit 3, FP3) |
| NudgeManager callbacks | "Stale closures" | Working — `getStore()` returns fresh state (Audit 3, FP4) |
| displayEvent mechanism | "Double-fire" | Working — only increments inside `displayMessage()` (Audit 3, Bug 6 downgraded) |
| Scoring pipeline | "Needs idempotency" | Already has it — Layer B guard + upserts + transaction (Audit 4, Finding 6) |
| Pipeline `after()` + `maxDuration` | "Not implemented" | Already implemented (complete/route.ts:7,89) |
| `resilientFetch` | "Needs creation" | Already exists (src/lib/api-client.ts) |
| `withApiHandler` | "Needs creation" | Already exists (src/lib/api-handler.ts) |
| `mapApiError` | "Needs creation" | Already exists (src/lib/errors.ts) |
| `.stage-animate` CSS | "Never defined" | Already defined (globals.css:296) |
| `server-only` on item-bank | "Needs addition" | Already present (item-bank.ts:1) |

---

## Part 4: Model Usage Summary (Corrected)

| Context | Model | Cost Tier | Latency |
|---------|-------|-----------|---------|
| Real-time streaming (beats 1-2) | Haiku | ~$0.80/$4.00 per M tokens | ~1-3s |
| Classification (dual-eval) | Haiku | ~$0.80/$4.00 per M tokens | ~0.5-1s |
| Acknowledgment (single call) | Haiku | ~$0.80/$4.00 per M tokens | ~0.2-0.4s |
| Layer B scoring (triple-eval) | Haiku | ~$0.80/$4.00 per M tokens | Post-assessment |
| Diagnostic probe classification | Haiku | ~$0.80/$4.00 per M tokens | Post-assessment |
| Content library generation (batch) | **Sonnet** | ~$3.00/$15.00 per M tokens | Offline batch |
| Scenario shell generation (batch) | **Sonnet** | ~$3.00/$15.00 per M tokens | Offline batch |

**Rule:** Haiku handles everything that touches the candidate in real-time. Sonnet handles everything that runs offline before the candidate arrives.

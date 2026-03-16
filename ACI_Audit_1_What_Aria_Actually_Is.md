# Audit 1: What Aria Actually Is

## Executive Summary

"Aria" is not a standalone AI entity. She is a **fictional persona assembled from four independent components** at runtime. No single system is "Aria" — she emerges from the coordinated output of a deterministic engine, two AI APIs, and a pre-written content library. Understanding this architecture is essential because every quality problem (leaked metadata, robotic speech, broken audio) traces back to a specific component, not to "Aria" as a whole.

---

## The Four Components

### 1. Claude API (The Brain)

**What it does:** Generates the actual words Aria "says." Also classifies candidate responses and generates bridging acknowledgments.

**Models used:**
- **Haiku** (`claude-haiku-4-5-20251001`) — All real-time calls during a live assessment. Three call sites:
  1. `classifyResponse()` — Dual-evaluation (2 parallel calls) to classify candidate responses as STRONG/ADEQUATE/WEAK. Returns rubricScore, construct signals, branch rationale. ~500 output tokens, 15s timeout. (`src/lib/assessment/classification.ts`)
  2. `generateAcknowledgment()` — Single sentence (~20 words) that references something specific the candidate said. 80 max tokens, 5s timeout. Falls back to static array if API fails. (`src/lib/assessment/generate-acknowledgment.ts`)
  3. `streamText()` — Vercel AI SDK streaming. Generates Aria's spoken text + reference card JSON based on system prompt from engine. 500 max tokens, 0.7 temperature, 15s timeout. (`src/app/api/assess/[token]/chat/route.ts`)

- **Sonnet** (`claude-sonnet-4-20250514`) — Offline content generation only. Never used during live assessments. Generates content library variants (4000 max tokens, 30s timeout). Can be overridden to Haiku via `ASSESSMENT_TEST_MODE=true`. (`src/lib/assessment/content-generation.ts`)

**Key architectural decision:** Classification and acknowledgment run in **parallel** — classification determines the branch path while acknowledgment generates a personalized bridge sentence. Both complete before the next beat's content is served.

**Config location:** `src/lib/assessment/config.ts` — `AI_CONFIG` object defines models, timeouts, evaluation run counts.

### 2. ElevenLabs API (The Voice)

**What it does:** Converts Aria's text into natural-sounding speech audio. Completely stateless — it receives text, returns audio bytes.

**Model:** `eleven_flash_v2_5` (low-latency streaming model)

**Architecture:**
- **Server proxy** (`src/app/api/assess/[token]/tts/route.ts`) — Keeps the ElevenLabs API key server-side. Validates assessment token, rate-limits (`RATE_LIMITS.tts`), and streams audio back as `audio/mpeg`. Max duration: 30s. Text capped at 2000 chars.
- **Client engine** (`src/components/assessment/voice/tts-engine.ts`) — `TTSEngine` class managing:
  - **AudioContext + Web Audio API** — Creates `AudioBufferSourceNode` per chunk, routed through `GainNode` → `AnalyserNode` → `destination`
  - **Amplitude extraction** — `requestAnimationFrame` loop reading `getByteFrequencyData()` from the `AnalyserNode`, normalized to 0–1. This drives the orb's visual pulsing.
  - **Pipelined playback** — First chunk fetched and decoded, playback starts immediately. Remaining chunks fetched in background. Gapless playback via sequential `AudioBufferSourceNode.start(0)`.
  - **Session-level cache** — `Map<string, { text: string; buffers: AudioBuffer[] }>`. Stores both text and decoded audio buffers. Text is preserved so that if `AudioContext` becomes suspended on cache replay, `SpeechSynthesis` fallback has the original text available.
  - **Prefetch** — `prefetch(text, token)` can be called during previous sentence playback to eliminate inter-sentence latency. Best-effort, errors swallowed.
  - **SpeechSynthesis fallback** — If ElevenLabs fails (API error, AudioContext suspended, first chunk decode failure), `fallbackActive` is set and all subsequent `speak()` calls use browser `SpeechSynthesisUtterance`. Fallback can be cleared by `resumeContext()` on user gesture if AudioContext recovers.

**Voice settings:** `stability: 0.6, similarity_boost: 0.8, style: 0.3, use_speaker_boost: true`

**Failure modes:**
- ElevenLabs API down → server returns `{ fallback: true }` → client activates SpeechSynthesis
- AudioContext suspended (no user gesture) → immediate SpeechSynthesis fallback
- Chunk too small (<100 bytes) → skipped with warning
- Rate limited (429) → client sees error, retries on next sentence

### 3. Engine (The Script)

**What it does:** Decides what happens next at every step of the assessment. It is a **pure function** — no network calls, no database access, no side effects. It reads the current state and returns an action.

**Entry point:** `getNextAction(state, messages, lastCandidateMessage)` in `src/lib/assessment/engine.ts`

**Returns one of four action types:**
| Action | When | What it contains |
|--------|------|-----------------|
| `AGENT_MESSAGE` | Aria needs to speak | `systemPrompt`, `userContext`, `act`, `metadata` |
| `INTERACTIVE_ELEMENT` | Candidate gets a UI element | `elementType`, `elementData`, `act` |
| `TRANSITION` | Moving between acts | `from`, `to`, `transitionMessage` |
| `COMPLETE` | Assessment is done | `closingMessage` |

**State machine:**
```
ACT_1 (Scenario Gauntlet)
  └─ 4 scenarios × 6 beats each = 24 beats
     Beat 0: INITIAL_SITUATION (scenario intro + reference card)
     Beat 1: INITIAL_RESPONSE (open-ended "what do you do?")
     Beat 2: COMPLICATION (new info contradicts approach)
     Beat 3: SOCIAL_PRESSURE (interpersonal pushback)
     Beat 4: CONSEQUENCE_REVEAL (outcome of choices)
     Beat 5: REFLECTIVE_SYNTHESIS (self-assessment)
  └─ Branching: candidate classified as STRONG/ADEQUATE/WEAK → selects branchScript → adapts difficulty
  └─ Inter-scenario transitions: 1-2 sentence bridge, then Beat 0 of next scenario

ACT_2 (Precision Gauntlet)
  └─ 5 constructs: QUANTITATIVE_REASONING, SPATIAL_VISUALIZATION, MECHANICAL_REASONING, PATTERN_RECOGNITION, FLUID_REASONING
  └─ Per construct: 4 phases (CALIBRATION → BOUNDARY_MAPPING → PRESSURE_TEST → DIAGNOSTIC_PROBE)
  └─ Phases 0-2: structured items from item bank (INTERACTIVE_ELEMENT actions)
  └─ Phase 3: conversational diagnostic probes (AGENT_MESSAGE actions, max 3 exchanges)
  └─ Adaptive loop: `getNextItem()` selects items based on prior performance

ACT_3 (Calibration & Consistency)
  └─ Phase 1: Confidence-tagged MCQ items (3 items, each followed by confidence rating)
  └─ Phase 2: Parallel scenario re-presentation (2 scenarios, structurally isomorphic to Act 1 but different surface details)
  └─ Phase 3: Reflective self-assessment (3 questions, hardcoded strings)
```

**State advancement:** `computeStateUpdate(currentState, action, classification?)` — also a pure function. Returns a partial state update (scenario index, beat index, branch path, act2/act3 progress). Applied via `prisma.assessmentState.update()` in the chat route.

**Progress computation:** `computeProgress(state)` returns `{ act1: 0-1, act2: 0-1, act3: 0-1 }`. Act 1: linear by beats. Act 2: by completed constructs. Act 3: weighted (40% confidence items, 35% parallel scenarios, 25% self-assessment).

**Prompt construction hierarchy:**
1. `ARIA_PERSONA` — Character definition + voice rules (constant, prepended to all system prompts)
2. `buildAct1SystemPrompt(scenario, beatIndex)` — Scenario context + output format rules + reference card format
3. `buildBeatPrompt(scenario, beat, classification)` — Beat-specific instructions + adaptation by classification level
4. Chat route augments with: role context, candidate name, COMPLICATION personalization

**Scenario data:** `src/lib/assessment/scenarios/index.ts` — 4 `ScenarioShell` objects, each containing:
- `id`, `name`, `description`, `primaryConstructs`
- `beats[]` — 6 beat templates, each with `agentPromptTemplate`, `branchScripts` (STRONG/ADEQUATE/WEAK), `rubricIndicators`
- `domainNeutralContent` — setting, characters, initial situation (used by content generation)

### 4. Content Library (Pre-Written Scripts)

**What it does:** Stores pre-generated Aria speech + reference card data for Act 1 scenarios. When enabled, Act 1 content is served from the library with no live AI call — only the acknowledgment sentence is generated in real-time.

**Feature flag:** `FEATURE_CONTENT_LIBRARY=true` in env (`FEATURE_FLAGS.CONTENT_LIBRARY_ENABLED`)

**Structure:**
```
ContentLibrary (DB record)
  └─ content: ContentLibraryData (JSON blob)
       └─ act1.scenarios[4]
            └─ variants[3]         ← 3 surface-detail variants per scenario
                 └─ beats[6]
                      └─ Beat 0: { spokenText, referenceCard }
                      └─ Beats 1-5: { branches: { STRONG, ADEQUATE, WEAK } }
                           └─ Each branch: { spokenText, referenceUpdate? }
```

**Total content volume:** 4 scenarios × 3 variants × 6 beats × 3 branches (beats 1-5) = ~216 content units

**Generation:** `generateContentLibrary(roleId)` in `src/lib/assessment/content-generation.ts` — runs ~24 Sonnet API calls (4 scenarios × 6 beats, variants batched per call). Takes 1-3 minutes. Stores result in DB with status lifecycle: `GENERATING → READY | FAILED`.

**Serving:** `src/lib/assessment/content-serving.ts`
- `loadContentLibrary(id)` — DB fetch with in-memory cache (libraries are immutable once READY)
- `selectRandomVariants(library)` — Called once at assessment start, persists in `AssessmentState.variantSelections`
- `lookupBeatContent(library, scenarioIndex, beatIndex, classification, variantSelections)` — Returns `{ spokenText, referenceCard?, referenceUpdate? }`

**Content path in chat route:**
1. **Beat 0 path** — If content library enabled + Act 1 + sentinel message + beat 0: look up Beat 0 content, return as JSON (not streamed). Reference card sent as separate `referenceCard` field.
2. **Pre-generated path** — If content library enabled + Act 1 + real candidate message + not beats 1-2 + not transition: look up branched content by classification, prepend acknowledgment. Reference update sent as separate `referenceUpdate` field. Beats 1-2 force streaming because personalization is critical at those points.
3. **Streaming path (default/fallback)** — Engine provides `systemPrompt` + `userContext`, Claude streams response. Client-side `parseScenarioResponse()` extracts spoken text from `---REFERENCE---` / `---REFERENCE_UPDATE---` delimiters.

---

## The Assembly: How the Four Components Work Together

### The Runtime Flow (per candidate turn)

```
1. Candidate speaks/types response
   └─ Client: speech recognition or text input
   └─ Client: POST /api/assess/[token]/chat { messages, candidateInput?, elementResponse? }

2. Chat route receives request
   └─ Validate token, rate limit, load assessment state
   └─ Persist candidate message to ConversationMessage table (with scenario/beat metadata)

3. Engine decides what happens next
   └─ getNextAction(state, messages, lastCandidateMessage)
   └─ Returns: AGENT_MESSAGE | INTERACTIVE_ELEMENT | TRANSITION | COMPLETE

4. If AGENT_MESSAGE in Act 1:
   a. Classification + Acknowledgment fire in parallel
      └─ classifyResponse() → STRONG/ADEQUATE/WEAK (2 parallel Haiku calls)
      └─ generateAcknowledgment() → 1 sentence (1 Haiku call, 5s timeout)

   b. Content delivery (one of three paths):
      Path A: Content library Beat 0 → JSON response, no streaming
      Path B: Content library Beat 3-5 → acknowledgment + pre-gen content, JSON response
      Path C: Streaming → Claude streams response via Vercel AI SDK

   c. State update
      └─ computeStateUpdate() applied to DB
      └─ For streaming: happens in onFinish callback after stream completes

5. Client receives response
   └─ JSON path: displayMessage() directly
   └─ Streaming path: accumulates text, then displayMessage()

6. Client processes display
   └─ parseScenarioResponse() → { spokenText, sentences, reference, referenceUpdate }
   └─ cleanText() strips markdown, beat headers, stage directions, structural markers
   └─ splitSentences() breaks text into sentence array
   └─ If streaming: reference extracted from ---REFERENCE--- delimiter
   └─ If pre-gen: reference comes from JSON response field

7. TTS playback (per sentence)
   └─ For each sentence in sentenceList:
      └─ TTSEngine.speak(sentence, token, onPlaybackStart, preSplit=true)
      └─ Next sentence prefetched during current playback
      └─ Amplitude data drives orb pulsing via onAmplitude callback
      └─ Subtitle text revealed word-by-word, timed to audio duration

8. Candidate's turn
   └─ Orb switches to "listening" mode
   └─ Voice input: SpeechRecognition API (or text fallback)
   └─ Cycle repeats from step 1
```

### What Happens When Components Fail

| Component | Failure Mode | Fallback Behavior |
|-----------|-------------|-------------------|
| Claude (streaming) | API timeout/error | 502 response, client shows error toast via `mapApiError()` |
| Claude (classification) | API timeout/error | Falls back to ADEQUATE classification, logs warning |
| Claude (acknowledgment) | API timeout/error | Returns random from `FALLBACK_ACKNOWLEDGMENTS` array |
| ElevenLabs | API down/503 | Server returns `{ fallback: true }`, client activates browser SpeechSynthesis |
| ElevenLabs | AudioContext suspended | Client sets `fallbackActive=true`, uses SpeechSynthesis |
| Content Library | Lookup fails | Falls through to streaming path (Claude generates live) |
| Content Library | Not enabled | Streaming path is the default for all content |
| Engine | Invalid state | Returns COMPLETE or TRANSITION action (safe defaults) |

---

## Output Sanitization Pipeline

Aria's text passes through multiple layers of sanitization before reaching the candidate's ears:

1. **Prompt-level prevention** — `ARIA_PERSONA` voice rules + `buildAct1SystemPrompt` CRITICAL rules instruct Claude to never narrate in third person, never describe actions, never echo structural markers.

2. **Server-side stripping** — `construct_check` tags stripped from parallel scenario output in `onFinish` callback. Only `cleanText` is persisted to DB.

3. **Client-side parsing** — `parseScenarioResponse()` in `src/lib/assessment/parse-scenario-response.ts`:
   - `cleanText()` removes: beat headers, markdown, structural labels (`SPOKEN TEXT:`, `PART 1 —`), bracket tags (`[BEAT:]`, `[REFERENCE]`), delimiter lines (`---REFERENCE---`), stage directions (`*pauses*`, `(Aria nods)`), third-person narration (`Aria considers...`, `She turns...`), leaked template labels (`Template:`, `Branch script:`), `<construct_check>` tags
   - Safety net regex: strips any remaining JSON blocks containing `role`, `context`, `sections`, `newInformation` keys from spoken text
   - `splitSentences()` splits on sentence-ending punctuation, preserving abbreviations and decimals. Filters fragments under 2 words.

4. **Sentence-level filtering** — `playSentenceSequence` in the client store filters out fragments shorter than 2 words or lone numbers/units before TTS.

---

## Scoring Architecture (Layer A + Layer B)

Separate from Aria's conversational behavior, the scoring pipeline runs after assessment completion:

- **Layer A** (deterministic, weight: 0.55) — Scored from `ItemResponse` records (structured items from Act 2 + Act 3)
- **Layer B** (AI-evaluated, weight: 0.45) — `AIEvaluationRun` records. 3 independent Haiku calls per (message, construct) pair. Scores aggregated with high-variance detection (SD > 0.3 → downweight by 0.5x).
- **Idempotency** — Existing `AIEvaluationRun` records are reused on retry (no duplicate API calls)
- **Transactional** — Steps 7-13 of the pipeline wrapped in `prisma.$transaction()`
- **Consistency check** — Act 1 vs Act 3 parallel scenario scores compared; >0.15 delta triggers 0.75x downweight

---

## Key Files Reference

| Component | File | Purpose |
|-----------|------|---------|
| Engine | `src/lib/assessment/engine.ts` | `getNextAction()`, `computeStateUpdate()`, `computeProgress()`, all prompt builders |
| Scenarios | `src/lib/assessment/scenarios/index.ts` | 4 scenario shells with 6 beats each, prompt templates, branch scripts, rubric indicators |
| Config | `src/lib/assessment/config.ts` | AI models, timeouts, feature flags, assessment structure constants |
| Classification | `src/lib/assessment/classification.ts` | Dual-evaluation response classification with few-shot examples |
| Acknowledgment | `src/lib/assessment/generate-acknowledgment.ts` | Bridging sentence generation |
| Content Gen | `src/lib/assessment/content-generation.ts` | Offline Sonnet-based content library generation |
| Content Serve | `src/lib/assessment/content-serving.ts` | Library loading, variant selection, beat lookup |
| Output Parser | `src/lib/assessment/parse-scenario-response.ts` | `cleanText()`, `splitSentences()`, `parseScenarioResponse()` |
| Chat Route | `src/app/api/assess/[token]/chat/route.ts` | Orchestrator: state management, content routing, streaming, DB persistence |
| TTS Proxy | `src/app/api/assess/[token]/tts/route.ts` | Server-side ElevenLabs proxy |
| TTS Engine | `src/components/assessment/voice/tts-engine.ts` | Client-side audio playback, amplitude extraction, fallback |
| Client Store | `src/stores/chat-assessment-store.ts` | Zustand store: message handling, display state, TTS coordination |
| Item Bank | `src/lib/assessment/item-bank.ts` | Structured items for Act 2 + Act 3 |
| Adaptive Loop | `src/lib/assessment/adaptive-loop.ts` | Item selection algorithm for Act 2 |
| Scoring | `src/lib/assessment/scoring/pipeline.ts` | Post-assessment Layer A + Layer B scoring |

---

## What "Aria" Is NOT

- **Not a persistent agent** — No memory between sessions. No long-running process. Each HTTP request is stateless; state lives in the DB.
- **Not a single model** — Three different Claude call sites, each with different prompts, token limits, and timeouts. Plus ElevenLabs for voice.
- **Not autonomous** — The engine script determines every decision. Claude fills in the words, but the structure (which beat, which branch, when to transition) is entirely deterministic.
- **Not her own voice** — ElevenLabs is a text-to-audio converter. The voice settings (stability, style, similarity_boost) are fixed configuration, not learned from Aria's "personality."
- **Not always AI-generated** — When the content library is enabled, most Act 1 content is pre-written. Only acknowledgment sentences are generated live. Acts 2 and 3 are always live.

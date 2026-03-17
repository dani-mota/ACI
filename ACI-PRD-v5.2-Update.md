# ACI PRD v5.2 — Post-Implementation Update

**Purpose:** This document updates the PRD to reflect what was ACTUALLY built in Stages 1-7, corrects discrepancies between the spec and reality, and specifies the legacy code cutover required to eliminate the race conditions causing speech skipping.

**This document should be applied to `ACI-Complete-PRD-v5.1-AMENDED.md` to produce v5.2.**

---

## CRITICAL: The Legacy Cutover Problem

### What's Happening

The new unified pipeline IS active — the server returns `{ type: "turn" }`, the client's `handleTurn()` processes it, and the TurnPlayer drives delivery. But the old code paths are still in the codebase and still reacting to Zustand state changes. Specifically:

1. `handleTurn()` sets `lastTurn` (for TurnPlayer) BUT ALSO sets `displayEvent`, `sentenceList`, `subtitleText` (old state fields)
2. The old `displayEvent` useEffect in `assessment-stage.tsx` reacts to `displayEvent` changes and tries to drive its own TTS playback
3. Even with the guard `if (FEATURE_FLAGS.TURN_PLAYER) return;`, React effect scheduling can cause the old effect to fire before the guard evaluates
4. Result: two competing audio systems, causing sentence skipping, cut-off speech, and overlapping audio — the exact bugs from the original bug report

### The Root Cause

`handleTurn()` was designed to be additive — set the new state AND the old state, so the old components could still render. This was correct during the migration (Stages 2-6) when we needed both paths to coexist. Now that Stage 7 has enabled the unified pipeline, the old state updates are poison. They trigger old effects that compete with the new TurnPlayer.

### The Fix: Complete Legacy Cutover

`handleTurn()` must STOP setting old Zustand state fields. The TurnPlayer is now the sole driver of all delivery. The old fields (`displayEvent`, `sentenceList`, `currentSentenceIndex`, `displayIsHistory`) must not be updated by the unified path.

This is the final step of the migration that the original Unified Turn PRD described as "Phase 7: Remove deprecated fields."

---

## Part 4 Updates: The Unified Architecture (As Built)

### 4.1 Replace — The Problem Description

The previous implementation had five different response shapes. The current implementation has REPLACED these with one on the server side, but the client still contains both old and new state management. The architecture is:

**Server (COMPLETE — unified):**
```
POST /assess/[token]/chat
  → normalizeInput() (P-9: empty→sentinel, 3000-char cap)
  → Lifecycle guard (P0-5: reject if SCORING/COMPLETED)
  → Engine.getNextAction(state)
  → Dispatcher → TurnBuilder (format-specific)
  → sanitizeAriaOutput() (15 regex patterns)
  → checkLeakage() (12 construct names, classification tokens, rubric vocabulary)
  → stripSensitiveFields() (whitelist — no correctAnswer)
  → validateTurn() (Zod schema, Act 2 discriminated union)
  → validateMetadata() (P-11: .strict() before persist)
  → Persist messages + advance state (single transaction)
  → Return AssessmentTurnResponse JSON
```

**Client (NEEDS CUTOVER — both old and new):**
```
CURRENT (broken — two systems competing):
  sendMessage() → POST → response { type: "turn" }
    → handleTurn() sets BOTH:
      - lastTurn (new) → TurnPlayer activates → TTS sentence-by-sentence
      - displayEvent++ (old) → old useEffect activates → old TTS pipeline
    → TWO audio systems fire → speech skipping

TARGET (after cutover):
  sendMessage() → POST → response { type: "turn" }
    → handleTurn() sets ONLY:
      - lastTurn → TurnPlayer activates → TTS sentence-by-sentence
      - referenceCard, progress, completion (visual state — not delivery)
    → ONE audio system → clean playback
```

### 4.3 Replace — The Request Cycle (As Built)

```
Candidate acts (speaks/taps/types)
    → POST /assess/[token]/chat
    → normalizeInput(): empty → [NO_RESPONSE], truncate at 3000 chars
    → Lifecycle guard: reject SCORING (409), reject COMPLETED (409)
    → Validate token → get assessmentId
    → Optimistic lock (prisma.assessment.updateMany with compound WHERE)
    → Persist candidate message with validated metadata (P-11)
    → Engine.getNextAction(state) → EngineAction
    → Dispatcher routes EngineAction → TurnBuilder
    → TurnBuilder constructs Turn:
        - F2/F8: classify (2× parallel Haiku, P0-2 matrix) → generate (Haiku) → verify probe → buffer
        - F6/F9: generate (Haiku, buffered per B-1) → sanitize
        - F1/F3-F5/F7: content library / item bank → static Turn
        - TRANSITION/COMPLETION: static Turn
    → Post-build pipeline: sanitize → leakage filter → strip sensitive → Zod validate
    → Persist agent message + turnPayload (P-2) + advance state (SINGLE transaction)
    → Return Turn JSON to client
```

### 4.4 Replace — One Client Pipeline (As Built)

The TurnPlayer is a headless React component that drives store state. It does NOT render UI — the existing assessment components (SubtitleDisplay, ScenarioReferenceCard, InteractiveRenderer, etc.) render from the store.

```
Turn arrives → store.handleTurn(turn)
    → Sets: lastTurn, referenceCard, progress, completion state
    → Does NOT set: displayEvent, sentenceList, currentSentenceIndex (CUTOVER)

TurnPlayer detects lastTurn change:
    → Generate new sequenceId (monotonic counter)
    → ttsEngine.stop() (cancel any in-flight audio)
    → Set orb to "speaking"
    
    For each sentence[i]:
      1. Set subtitle text, reset word reveal
      2. Progressive reference card reveal (section i+1)
      3. Prefetch sentence[i+1] in background (N+1 prefetch)
      4. ttsEngine.speak(sentence[i]):
         → HTTP POST to /api/assess/{token}/tts (ElevenLabs proxy)
         → Decode AudioBuffer → play via Web Audio API
         → Word reveal interval: msPerWord = max(60, duration / wordCount)
         → Amplitude extraction drives orb animation
      5. If speak() fails: reveal all words instantly (text fallback)
         Next sentence still tries audio (per-sentence independence)
      6. Enforce MIN_SENTENCE_MS_VOICE (2500ms)
      7. 150ms inter-sentence pause
      8. Check sequenceId — if changed, abort (new Turn arrived)
    
    All sentences done:
      → Reveal all remaining words and reference card sections
      → Set orb to "idle", amplitude to 0
      → Fire onDeliveryComplete()
      → Nudge system starts (15s / 30s / 45s)
      → If interactiveElement: show after 300ms delay
      → Activate input mechanism based on input.type
```

### 4.5 Add — Feature Flags (As Built)

Three feature flags control the unified pipeline. All default to ON (active) in Stage 7+.

| Flag | Env Var | Default | Controls |
|------|---------|---------|----------|
| UNIFIED_TURNS | `FEATURE_UNIFIED_TURNS` | ON | Server: chat route returns Turn JSON vs legacy shapes |
| TURN_PLAYER | `FEATURE_TURN_PLAYER` | ON | Client: TurnPlayer drives delivery vs legacy displayEvent chain |
| CONTENT_LIBRARY | `FEATURE_CONTENT_LIBRARY` | ON | Server: content library integration for scenarios/items |

**Invalid combination guard:** `TURN_PLAYER && !UNIFIED_TURNS` is rejected — TurnPlayer cannot consume legacy response shapes.

**Note on client-side flags:** These env vars are NOT prefixed with `NEXT_PUBLIC_`. On the client, `process.env.FEATURE_X` evaluates to `undefined`. The default logic `undefined !== "false"` evaluates to `true`, which is the intended behavior — flags default to ON in the browser. To disable a flag, set it to `"false"` in the Vercel environment.

---

## Part 5 Updates: The Voice Pipeline (As Built)

### 5.1 Replace — Overview

The voice pipeline uses the EXISTING HTTP TTS proxy, not browser-direct WebSocket. This is a deliberate architectural decision — the proxy works, keeps the API key server-side, and the latency difference (~50-100ms) is imperceptible with N+1 sentence prefetch.

**System → Candidate (TTS):**
```
Server produces delivery.sentences
  → TurnPlayer iterates sentences
  → For each: POST /api/assess/{token}/tts (HTTP proxy to ElevenLabs)
  → ElevenLabs returns audio
  → Decode to AudioBuffer
  → Play via Web Audio API
  → Amplitude extraction for orb animation
  → Word reveal synced to audio duration (msPerWord = duration / wordCount)
```

**Candidate → System (STT):**
```
Candidate taps mic button
  → Browser SpeechRecognition API captures audio
  → Transcript sent via sendMessage()
  → (Deepgram/Scribe upgrade deferred — SpeechRecognition works for pilot)
```

### 5.4 Replace — TTS Connection

The TTS proxy at `/api/assess/{token}/tts` handles ElevenLabs communication server-side. The TurnPlayer sends sentences one at a time via HTTP POST. N+1 prefetch overlaps the next sentence's fetch with the current sentence's playback, hiding most of the HTTP latency.

A `GET /api/assess/{token}/tts-config` endpoint exists, returning voice settings and availability. It does NOT expose the ElevenLabs API key. Rate limited to 1 request per 60 minutes per token. Prepared for future WebSocket migration.

**AudioContext recovery (P-8):** Before every `speak()` call, if `fallbackActive` is true, attempt `audioContext.resume()`. If AudioContext recovers to "running" state, clear `fallbackActive` and resume ElevenLabs audio. Known limitation: on Safari, `resume()` outside a user gesture handler silently fails — Safari users who background the tab stay on SpeechSynthesis. Chrome recovers correctly.

### 5.8 Replace — Fallback Chain (As Built)

```
ElevenLabs HTTP proxy fails (rate limit, decode error, network)
  → SpeechSynthesis fallback (robot voice but functional)
  → SpeechSynthesis also fails
  → Text-only fallback (words revealed instantly, no audio)

Per-sentence independence:
  Sentence 1: audio succeeds ✓
  Sentence 2: audio fails → text fallback for THIS sentence
  Sentence 3: audio tries again → may succeed ✓
  (One failure doesn't kill the rest of the Turn)

AudioContext suspended (tab backgrounded):
  → fallbackActive = true → SpeechSynthesis for subsequent sentences
  → On next speak() with recovered AudioContext → ElevenLabs resumes
  → Safari: stays on SpeechSynthesis (known limitation)

TTS engine not available:
  → textOnly mode → word-by-word text reveal at 55ms stagger
  → Assessment fully functional, just no audio
```

### Deferred Voice Features (Accepted for Pilot)

| Feature | Status | Why Deferred |
|---------|--------|-------------|
| Browser-direct WebSocket to ElevenLabs | Deferred | HTTP proxy works, ~50-100ms overhead hidden by prefetch |
| Deepgram/Scribe STT | Deferred | SpeechRecognition API functional for pilot |
| Silero VAD | Deferred | Barge-in via mic toggle. Nudge can interrupt speaking candidate (cosmetic) |
| Word-level timestamps from ElevenLabs | Deferred | msPerWord estimate works (~400ms/word matches natural speech) |
| Proactive credential refresh at 75% TTL | Deferred | HTTP proxy authenticates server-side per-request |
| Safari "Tap to resume audio" overlay | Deferred | Chrome-first pilot, Safari stays on SpeechSynthesis |

---

## Part 9 Updates: Data Model (As Built)

### Assessment Lifecycle (As Built)

```
PENDING (invitation created, link sent)
  → ACTIVE (candidate opens link, assessment started)
  → SCORING (assessment complete, scoring pipeline running)
  → SCORED / RECOMMENDED / REVIEW_REQUIRED / NOT_A_FIT (results available)
  → ERROR (scoring pipeline failed — functionally equivalent to SCORING_FAILED)

EXPIRED (link validity window passed)
ABANDONED (candidate didn't complete within validity window)
```

Note: The Prisma schema uses `ERROR` instead of `SCORING_FAILED` (P-12). Functionally identical — avoids a Prisma migration for a label change.

### Database (As Built)

The database is Neon PostgreSQL (not Supabase as originally specified in the PRD). Connection via Prisma with Neon serverless driver. Neon databases auto-suspend after inactivity — first request after suspension may be slow (cold start).

---

## Part 12 Updates: Content Framework (As Built)

### Content Library (As Built)

| Component | Status | Detail |
|-----------|--------|--------|
| Scenarios | 4 complete | Escalating System Failure, Integrity Pressure Cooker, Learning Gauntlet, Prioritization Crisis |
| Beats per scenario | 6 | INITIAL_SITUATION → INITIAL_RESPONSE → COMPLICATION → SOCIAL_PRESSURE → CONSEQUENCE_REVEAL → REFLECTIVE_SYNTHESIS |
| Branch scripts | Complete | STRONG/ADEQUATE/WEAK on all 24 beats |
| Content variants | 3 per scenario | Random selection at start, persisted in state |
| Item bank | 96 items | QR: 20, SV: 18, MR: 20, PR: 18, FR: 20 (all ≥15 minimum) |
| Constructs with structured items | 5 | QR, SV, MR, PR, FR |

### probeConfig (As Built — Stage 6 Fix)

Canonical probes per BEAT TYPE (not per individual beat):

| Beat Type | Primary Probe | Approved Variants |
|-----------|--------------|-------------------|
| INITIAL_SITUATION | (none — narration) | — |
| INITIAL_RESPONSE | "What would you do first?" | "How would you approach this?", "Where would you start?", "What's your first move?" |
| COMPLICATION | "How does that change your approach?" | "What does that mean for your plan?", "How would you adjust given this?", "Does that change anything for you?" |
| SOCIAL_PRESSURE | "How do you respond to that?" | "What do you say?", "How do you handle that?", "What would you tell them?" |
| CONSEQUENCE_REVEAL | "How do you evaluate that outcome?" | "What do you make of that?", "How does that land for you?", "What would you do differently?" |
| REFLECTIVE_SYNTHESIS | "What was the hardest part of this situation?" | "What did you learn from this?", "What would you do differently next time?", "Looking back, what stands out?" |

Probe verification runs in the open-probe TurnBuilder: verify → retry at temp 0.3 → content library fallback.

### Not Implemented (V2)

| Feature | PRD Section | Status |
|---------|-------------|--------|
| hiddenInformation | §3.11, §12.3 | Not built — requires content authoring |
| Standalone fallbackContent | §12.3 | Branches ARE the fallback |
| Per-beat probeConfig | §12.3 | Canonical per beat-type instead |
| Per-beat constructIndicators | §12.3 | Merged from scenario-level rubric data |

---

## Part 13 Updates: Technical Architecture (As Built)

### 13.1 Tech Stack (Corrections)

| PRD Says | Actually Using | Note |
|----------|---------------|------|
| PostgreSQL via Supabase | PostgreSQL via Neon | Neon serverless, auto-suspend |
| Supabase Auth (dashboard) | Supabase Auth | Correct |
| ElevenLabs WebSocket | ElevenLabs HTTP proxy | Proxy at /api/assess/{token}/tts |
| Deepgram Nova-3 or Scribe | Browser SpeechRecognition | Deepgram deferred |
| Silero VAD | Not implemented | Mic toggle for barge-in |
| `claude-haiku-4-5-20251001` | Verify actual model string | Check config |

### 13.2 Project Structure (As Built)

```
src/
  app/
    (dashboard)/                    ← EXISTING — unchanged
    (assess)/                       ← Assessment routes
      assess/[token]/
        page.tsx                    ← Welcome page (SSR)
        v2/page.tsx                 ← Assessment stage page
        api/
          chat/route.ts             ← POST: candidate input → Turn (unified)
          tts/route.ts              ← POST: TTS proxy to ElevenLabs
          tts-config/route.ts       ← GET: voice settings + availability
  
  lib/
    types/                          ← SHARED: Stage 1 type system
      turn.ts                       ← AssessmentTurnResponse contract
      formats.ts                    ← TurnFormat, BeatType, AdaptivePhase enums
      constructs.ts                 ← Construct, Layer + mapping utilities
      metadata.ts                   ← CandidateMessageMetadata, AgentMessageMetadata
      lifecycle.ts                  ← AssessmentLifecycle including ERROR
      index.ts                      ← Barrel export
    
    assessment/                     ← Assessment engine
      engine.ts                     ← State machine (pre-existing)
      dispatcher.ts                 ← Stage 2: EngineAction → TurnBuilder routing
      config.ts                     ← Feature flags
      sanitize.ts                   ← Stage 1: sanitizeAriaOutput, stripSensitiveFields
      probe-verification.ts         ← Stage 6: verifyProbePresent, addProbeReinforcement
      scenario-probes.ts            ← Stage 6: canonical probes per beat type
      
      validation/                   ← Stage 1: Zod schemas
        turn-schema.ts
        metadata-schema.ts
        input-schema.ts
      
      filters/                      ← Stage 1: output filtering
        leakage.ts
      
      turn-builders/                ← Stage 2: one per format
        scenario-setup.ts           ← F1
        open-probe.ts               ← F2 (with probe verification)
        multiple-choice.ts          ← F3
        numeric-input.ts            ← F4
        timed-challenge.ts          ← F5
        diagnostic-probe.ts         ← F6
        confidence-rating.ts        ← F7
        parallel-scenario.ts        ← F8
        reflective.ts               ← F9
        transition.ts               ← TRANSITION + COMPLETION
        context.ts                  ← TurnBuilderContext type
        helpers.ts                  ← splitSentences, postBuildPipeline
      
      prompts/                      ← Stage 2: prompt assembly
        aria-persona.ts             ← Layer 1 (with P-5 protected characteristics)
        prompt-assembly.ts          ← Layers 2-4 (with P0-7 injection booster)
      
      scoring/                      ← Stage 5: scoring pipeline
        pipeline.ts                 ← 13-step pipeline
        aggregation.ts              ← B-3 formula, P0-1 data availability
        layer-b.ts                  ← 3-perspective rotation (P-10)
        consistency.ts              ← P1-2 empty guard
      
      content-library/              ← Content serving
        content-serving.ts
        content-types.ts
  
  stores/
    chat-assessment-store.ts        ← Zustand store (NEEDS CUTOVER — see below)
  
  components/assessment/            ← UI components (pre-existing, driven by store)
    stage/
      assessment-stage.tsx          ← Main stage component (NEEDS CUTOVER)
      turn-player.tsx               ← Stage 3-4: headless TurnPlayer
    voice/
      tts-engine.ts                 ← Stage 4: AudioContext recovery
    error-boundary.tsx              ← Stage 3: Tier 1 + Tier 2
```

---

## APPENDIX D: LEGACY CUTOVER SPECIFICATION

### The Problem

The unified pipeline (TurnPlayer) and the legacy pipeline (displayEvent chain) are both active. `handleTurn()` in the store sets state fields that both systems react to, causing competing audio delivery — the root cause of speech skipping on the new pipeline.

### What Must Change

#### 1. Store: handleTurn() — Stop Setting Legacy State

**File:** `src/stores/chat-assessment-store.ts`

`handleTurn()` currently sets:
```typescript
// NEW state (keep):
set({ lastTurn: turn });
set({ referenceCard: turn.delivery.referenceCard });
set({ progress: turn.meta.progress });
set({ isComplete: turn.meta.isComplete });

// OLD state (REMOVE from handleTurn):
set({ displayEvent: s.displayEvent + 1 });  // ← REMOVE
set({ sentenceList: turn.delivery.sentences }); // ← REMOVE
set({ subtitleText: turn.delivery.sentences.join(' ') }); // ← REMOVE
set({ currentSentenceIndex: 0 }); // ← REMOVE
```

After cutover, `handleTurn()` sets ONLY:
- `lastTurn` — for TurnPlayer
- `referenceCard` / `referenceUpdate` — for ScenarioReferenceCard component
- `progress` — for ProgressBar component
- `isComplete` — for completion flow
- `transition` — for act transitions

The TurnPlayer sets subtitle state directly (`subtitleText`, `subtitleRevealedWords`) as it delivers each sentence. No other code path sets these fields during unified Turn delivery.

#### 2. Assessment Stage: Remove Legacy TTS Trigger

**File:** `src/components/assessment/stage/assessment-stage.tsx`

The `displayEvent` useEffect that calls `playSentenceSequence()` must be completely disabled when the unified pipeline is active — not guarded with an early return (which can race), but not registered at all:

```typescript
// BEFORE (race-prone guard):
useEffect(() => {
  if (FEATURE_FLAGS.TURN_PLAYER) return; // Guard can lose the race
  playSentenceSequence(sentenceList, ...);
}, [displayEvent]);

// AFTER (effect not registered):
useEffect(() => {
  // Only register this effect when legacy pipeline is active
  if (!FEATURE_FLAGS.TURN_PLAYER) {
    playSentenceSequence(sentenceList, ...);
  }
}, FEATURE_FLAGS.TURN_PLAYER ? [] : [displayEvent]);
// When TURN_PLAYER is true: dependency array is [] → effect runs once on mount, does nothing
// When TURN_PLAYER is false: dependency array is [displayEvent] → legacy behavior preserved
```

Or simpler: wrap the entire useEffect body in a condition that can't race:
```typescript
useEffect(() => {
  if (FEATURE_FLAGS.TURN_PLAYER) return;
  // ... legacy TTS logic
}, [displayEvent, lastTurn]); 
// Adding lastTurn as dependency ensures the guard re-evaluates
```

#### 3. Remove Deprecated Zustand Fields (After Verification)

Once the cutover is verified (speech skipping eliminated), mark these store fields as deprecated:

```typescript
// @deprecated — only used by legacy pipeline (FEATURE_TURN_PLAYER=false)
displayEvent: number;
sentenceList: string[];
currentSentenceIndex: number;
displayIsHistory: boolean;
```

Do NOT delete them yet — they're needed for the legacy fallback path (`FEATURE_TURN_PLAYER=false`). Delete after 2 weeks of production with zero issues on the unified path.

### Verification

After applying the cutover:

1. **Speech skipping eliminated:** Open the assessment. Aria speaks every sentence in order. No skipping, no cut-off, no overlapping audio.
2. **Legacy path still works:** Set `FEATURE_TURN_PLAYER=false`. Assessment works with old pipeline (degraded but functional).
3. **291 tests still pass.** No regressions.
4. **Console clean:** No `[PIPELINE-DIAGNOSTIC]` warnings. No competing TTS logs.

### Test Checklist

- [ ] Aria speaks 3+ sentences for Beat 0 narration — all play in order, no skips
- [ ] Candidate responds → Aria responds — no overlapping audio between turns
- [ ] Rapid interaction (submit immediately after Aria finishes) — no orphaned audio
- [ ] Tab background → return → audio resumes or falls back (no crash)
- [ ] Complete full scenario (6 beats) with clean audio throughout
- [ ] Complete Act 1 → Act 2 transition — layout changes, audio continues correctly
- [ ] Act 2 multiple choice — Aria reads question, then interactive element appears AFTER
- [ ] Act 2 timed challenge — timer starts AFTER Aria finishes reading

---

## APPENDIX E: IMPLEMENTATION STATUS (Post Stage 7)

### Audit Finding Status

| Finding | Status | Stage |
|---------|--------|-------|
| B-1 Browser-direct WebSocket | DEFERRED — HTTP proxy works | Stage 4 decision |
| B-2 Prisma optimistic lock | Applied | Stage 2 |
| B-3 Scoring formula | Fixed | Stage 5 |
| B-4 TRANSITION/COMPLETION formats | Implemented | Stage 1 |
| P0-1 Data availability guard | Implemented | Stage 5 |
| P0-2 Classification matrix | Fixed (was WEAK, now ADEQUATE) | Stage 2 fix |
| P0-3 rubricScore removed | Removed from metadata | Stage 1 |
| P0-4 stripSensitiveFields | Implemented (whitelist) | Stage 1 |
| P0-5 Scoring lifecycle guard | Implemented (409 on SCORING) | Stage 2 |
| P0-7 Prompt injection booster | Implemented | Stage 2 fix |
| P-1 Runtime Turn validation | Implemented (Zod) | Stage 1 |
| P-2 Session recovery | Implemented (recovery flag + lastReferenceCard) | Stage 7 |
| P-3 Empty Haiku guard | Implemented | Stage 2 |
| P-4 Error boundaries | Implemented (Tier 1 + Tier 2) | Stage 3 |
| P-5 Protected characteristics | Implemented in ARIA_PERSONA | Stage 2 |
| P-6 Leakage filter | Implemented (4 categories) | Stage 1 |
| P-9 Input normalization | Wired into chat route | Stage 2 fix |
| P-10 Layer B perspective rotation | Implemented (3 framings) | Stage 5 fix |
| P-11 Metadata validation | Wired before persist | Stage 2 fix |
| P-12 SCORING_FAILED lifecycle | Using ERROR (equivalent) | Stage 5 |
| P-13 Reference card reveal timing | Progressive via TurnPlayer | Stage 3 |
| P-14 Nudge VAD guard | NOT IMPLEMENTED — nudge can interrupt | Deferred |
| P-15 Auto-advance UX | Implemented (45s → [NO_RESPONSE]) | Stage 3 |
| P-16 Timed challenge timer | Starts after onDeliveryComplete | Stage 4 |
| P1-2 Consistency empty guard | Implemented (default 1.0) | Stage 5 |
| P1-3 Layer B per-construct | Implemented (~36 calls, not 150) | Stage 5 |
| P1-6 SequenceOrder unique | Constraint in schema | Stage 2 |
| P1-7 Sanitizer regex fix | Implemented | Stage 1 |
| P1-8 Brier score | Implemented | Stage 5 fix |
| P2-2 No correctCount in prompt | Removed | Stage 5 fix |

### Cumulative Test Count

| Suite | Tests |
|-------|-------|
| Stage 1 unit | 56 |
| Stage 1 behavioral | 38 |
| Stage 2 behavioral | 32 |
| Stage 4 behavioral | 37 |
| Stage 5 behavioral | 39 |
| Stage 6 content audit | 27 |
| Stage 6 fixes | 25 |
| Stage 7 integration | 37 |
| **Total** | **291** |

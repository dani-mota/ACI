# Audit 3: Bug Diagnosis

**Purpose:** Document what's broken, trace the root cause through the code, and separate real bugs from architectural opinions.

**Methodology:** Every claim was verified by reading the actual code paths end-to-end. False positives from automated scanning are called out explicitly.

---

## Severity Definitions

| Level | Meaning |
|-------|---------|
| **P0 — Critical** | Data loss, stuck assessment, scoring corruption |
| **P1 — High** | Candidate-facing UX degradation, reliability issue under normal conditions |
| **P2 — Medium** | Edge case bug, minor UX issue, code smell with potential consequences |
| **P3 — Low** | Cosmetic, consistency issue, defense-in-depth improvement |

---

## Bug 1: `[NO_RESPONSE]` Sentinel Creates Infinite Loop

**Severity:** P0 — Critical
**Status:** Confirmed
**Affected flow:** Act 1 silence → nudge escalation → auto-advance

### Symptom

When a candidate goes silent through all three nudge levels, the system enters an infinite loop: Aria repeats the same beat content forever, alternating with silence and nudge escalation.

### Root Cause Trace

1. **Nudge fires `[NO_RESPONSE]`** — [assessment-stage.tsx:453](src/components/assessment/stage/assessment-stage.tsx#L453):
   ```
   playSegmentTTS(NUDGE_FINAL[ctx]).then(() => {
     getStore().sendMessage("[NO_RESPONSE]");
   });
   ```

2. **Server receives `[NO_RESPONSE]`** — [chat/route.ts:269](src/app/api/assess/[token]/chat/route.ts#L269):
   ```
   const isSentinel = lastUserMessage && /^\[.+\]$/.test(lastUserMessage.trim());
   ```
   `isSentinel = true` → message is NOT persisted (line 270), classification is SKIPPED (line 354).

3. **No classification → no beat advancement** — [engine.ts:656](src/lib/assessment/engine.ts#L656):
   `computeStateUpdate()` requires `classification` to advance the beat in Act 1. Without it, returns `{}`. Beat stays the same.

4. **Engine produces same beat's content** — [engine.ts:187](src/lib/assessment/engine.ts#L187):
   `getNextAction()` sees `hasRealCandidateMessage = false` (sentinel), current beat unchanged. For beats 0-1, the explicit guards (`beatIndex === 0 && !hasRealCandidateMessage`) re-produce the same content. For beats 2+, the default path produces content for the same beat index.

5. **Client displays, TTS plays, nudge restarts** — After Aria speaks the repeated content, `startNudgeForCurrentAct()` fires. Candidate is still silent. Nudges escalate again to `[NO_RESPONSE]`. **Infinite loop.**

### The Cycle

```
silence → NUDGE_FIRST (30s) → NUDGE_SECOND (55s) → NUDGE_FINAL (90s)
→ sendMessage("[NO_RESPONSE]") → server skips classification → beat unchanged
→ engine produces same beat → Aria speaks same content → nudge restarts
→ silence → NUDGE_FIRST → ... (forever)
```

### Fix

The `[NO_RESPONSE]` sentinel should force-advance the beat with a default classification (e.g., `"INADEQUATE"` or a new `"NO_RESPONSE"` classification). In [chat/route.ts](src/app/api/assess/[token]/chat/route.ts), after the sentinel check at line 354, add:

```typescript
// Force-advance on [NO_RESPONSE] — treat silence as INADEQUATE
if (state.currentAct === "ACT_1" && isSentinel && lastUserMessage === "[NO_RESPONSE]") {
  const stateUpdate = computeStateUpdate(state, { type: "AGENT_MESSAGE" } as any, "INADEQUATE");
  if (Object.keys(stateUpdate).length > 0) {
    await prisma.assessmentState.update({
      where: { assessmentId: assessment.id },
      data: stateUpdate as any,
    });
    state = (await prisma.assessmentState.findUnique({
      where: { assessmentId: assessment.id },
    }))!;
  }
}
```

Also persist a placeholder `ConversationMessage` with `content: "[NO_RESPONSE]"` and metadata `{ sentinel: true }` so the scoring pipeline can see the silence event.

---

## Bug 2: Stale Message History in Classification Context

**Severity:** P1 — High
**Status:** Confirmed
**Affected flow:** All Act 1 candidate responses

### Symptom

Classification and engine action decisions are made against a message history that does NOT include the candidate's current message. This means the AI classifies the response without seeing it in the conversation context, and the engine generates content without knowing what the candidate just said.

### Root Cause Trace

1. **Assessment loaded at line 73** — [chat/route.ts:73](src/app/api/assess/[token]/chat/route.ts#L73):
   ```typescript
   const assessment = await prisma.assessment.findFirst({
     where: { candidateId: invitation.candidateId },
     include: { messages: { orderBy: { sequenceOrder: "asc" } } },
   });
   ```

2. **Candidate message persisted at line 272** — [chat/route.ts:272](src/app/api/assess/[token]/chat/route.ts#L272):
   ```typescript
   await prisma.conversationMessage.create({ data: { ... } });
   ```
   But `assessment.messages` is NOT updated after this write. It's the stale array from step 1.

3. **Classification uses stale history at line 359** — [chat/route.ts:359](src/app/api/assess/[token]/chat/route.ts#L359):
   ```typescript
   const conversationHistory = assessment.messages
     .slice(-10)
     .map((m) => `${m.role}: ${m.content.slice(0, 300)}`)
     .join("\n");
   ```
   The candidate's current message is NOT in `assessment.messages` yet.

4. **Engine uses stale history at line 405** — [chat/route.ts:405](src/app/api/assess/[token]/chat/route.ts#L405):
   ```typescript
   const action = getNextAction(state, assessment.messages, lastUserMessage);
   ```
   `lastUserMessage` is passed separately, but `assessment.messages` still lacks it.

### Mitigating Factors

- Classification receives `lastUserMessage` as a separate argument, so the response IS classified. The stale history means the LLM sees the conversation context minus the latest message — a context quality issue, not a missing-data issue.
- The engine also receives `lastUserMessage` as a third argument and uses it for sentinel detection and beat gating.
- Impact grows with conversation length — earlier in a scenario it matters less.

### Fix

After persisting the candidate message at line 286, push it onto the in-memory array:

```typescript
assessment.messages.push({
  id: "pending", role: "CANDIDATE", content: lastUserMessage,
  act: state.currentAct, sequenceOrder: nextSeq,
  // ...remaining fields
});
```

---

## Bug 3: `findFirst` vs `findUnique` in POST Handler

**Severity:** P3 — Low
**Status:** Confirmed (consistency issue, not correctness bug)
**Affected flow:** POST /api/assess/[token]/chat

### Detail

The POST handler at [chat/route.ts:73](src/app/api/assess/[token]/chat/route.ts#L73) uses `prisma.assessment.findFirst({ where: { candidateId } })` while the GET handler at [line 862](src/app/api/assess/[token]/chat/route.ts#L862) correctly uses `findUnique`. Since `candidateId` has a `@unique` constraint on Assessment ([schema.prisma:258](prisma/schema.prisma#L258)), both produce identical results, but `findUnique` is semantically correct and marginally faster (skips table scan planning).

### Fix

Change line 73 from `findFirst` to `findUnique`:
```typescript
const assessment = await prisma.assessment.findUnique({
  where: { candidateId: invitation.candidateId },
  // ...
});
```

---

## Bug 4: LLM Meta-Narration Leaking into Aria's Speech

**Severity:** P2 — Medium (was P1 before v1.15 prompt hardening)
**Status:** Partially fixed — residual risk from pre-v1.15 content libraries

### Symptom

Aria occasionally speaks text like "*she pauses thoughtfully*", "## BEAT 2: COMPLICATION", or "SPOKEN TEXT:" — LLM structural artifacts that should never reach the candidate.

### Root Cause Trace

**Two sources of contamination:**

**Source A: Streaming path (beats 1-2) — MITIGATED**

The LLM generates scenario content in real-time via [chat/route.ts:686](src/app/api/assess/[token]/chat/route.ts#L686) → Vercel AI SDK `streamText`. The raw output goes to the client, where `displayMessage()` → `cleanText()` strips artifacts before TTS.

`cleanText()` at [parse-scenario-response.ts:40](src/lib/assessment/parse-scenario-response.ts#L40) handles:
- Beat headers: `# BEAT 1: INITIAL_SITUATION`
- Stage directions: `*she pauses thoughtfully*`, `(Aria nods)`
- Third-person narration: `Aria considers for a moment.`
- Markdown formatting: `**bold**`, `*italic*`
- Structural labels: `SPOKEN TEXT:`, `PART 1 — SPOKEN TEXT:`
- Template leaks: `Template:`, `Branch script:`, `Beat type:`

This is defensive and covers most patterns. The v1.15 prompt rewrite ([scenarios/index.ts](src/lib/assessment/scenarios/index.ts)) changed templates from meta-instructions ("Describe a situation where...") to Aria-voice directives ("You are presenting a workplace scenario..."), which dramatically reduced LLM meta-narration at the source.

**Source B: Pre-generated content libraries — STILL AT RISK**

Content libraries generated before v1.15 may have baked-in meta-narration in the stored `spokenText`. These bypass `cleanText()` partially — the pre-generated path at [chat/route.ts:630](src/app/api/assess/[token]/chat/route.ts#L630) serves `content.spokenText` directly to the client, where `displayMessage()` does run `cleanText()`. However, if the pre-gen content contains novel patterns not in `cleanText()`'s regex arsenal, they leak through.

### Residual Patterns Not Caught by `cleanText()`

- `[pause]` or `[silence]` mid-sentence (only caught as standalone bracket tags, not inline)
- `---` embedded in spoken text (only caught as standalone lines)
- Construct check tags are stripped: `<construct_check>` ✓
- But any novel XML-like tags the LLM invents are not caught

### Fix

1. **Regenerate all content libraries** using v1.15 prompts (runtime task, not code change)
2. **Add catch-all cleanup** in `cleanText()`: strip any remaining `[...]` bracket tags inline, not just at known positions:
   ```typescript
   .replace(/\[[A-Z_]{3,}[^\]]*\]/g, "")  // catch-all for uppercase bracket tags
   ```

---

## Bug 5: Pre-Generated Content Quality Gap

**Severity:** Design limitation, not a code bug
**Status:** By design

### Context

Beats 3-5 serve pre-generated content from the content library for speed (~50ms vs ~3s streaming). The trade-off: these responses are generic (branched by classification: STRONG/ADEQUATE/NEEDS_DEVELOPMENT) but not personalized to the candidate's specific words.

### Why This Is Not a Bug

- The system acknowledges this explicitly: an `acknowledgment` sentence is generated in real-time via [generate-acknowledgment.ts](src/lib/assessment/generate-acknowledgment.ts) and prepended to the pre-generated content at [chat/route.ts:632](src/app/api/assess/[token]/chat/route.ts#L632).
- Beats 1-2 are force-streamed specifically because they require personalization ([chat/route.ts:603](src/app/api/assess/[token]/chat/route.ts#L603)).
- The 3-branch variant system (STRONG/ADEQUATE/NEEDS_DEVELOPMENT) means the LLM's next beat is directionally appropriate even if not word-for-word personalized.

### Observation

The `acknowledgment` quality depends on the LLM prompt at [generate-acknowledgment.ts:44](src/lib/assessment/generate-acknowledgment.ts#L44), which is well-constrained (20 words max, no evaluation, reference something specific). When the acknowledgment works well, the transition feels natural. When it falls back to generic fallbacks like "Let me build on what you've shared," the seam is noticeable.

---

## Bug 6: displayEvent Double-Fire on Pre-Generated Content Path

**Severity:** P2 — Medium
**Status:** Confirmed

### Symptom

On the pre-generated content path, `displayEvent` increments twice — once when the store processes reference card data, and again when `displayMessage()` is called. This causes the TTS trigger `useEffect` at [assessment-stage.tsx:796](src/components/assessment/stage/assessment-stage.tsx#L796) to fire twice, potentially starting two overlapping TTS playback sequences.

### Root Cause Trace

1. **Store receives JSON with `referenceCard`** — [chat-assessment-store.ts:430](src/stores/chat-assessment-store.ts#L430):
   The `sendMessage()` handler detects `data.referenceCard`, calls `set()` to update `referenceCard` state.

2. **Then calls `displayMessage()`** — [chat-assessment-store.ts:470](src/stores/chat-assessment-store.ts#L470):
   `displayMessage()` increments `displayEvent` at line 260.

3. **Then overrides `referenceRevealCount`** — [chat-assessment-store.ts:474](src/stores/chat-assessment-store.ts#L474):
   Sets `referenceRevealCount: 0` for Beat 0 progressive reveal.

The double state update (steps 1 and 2) triggers React re-renders. However, `displayEvent` only increments once (inside `displayMessage()`). The reference card `set()` at step 1 does NOT increment `displayEvent`.

### Revised Assessment

**This is NOT a double-fire.** After closer inspection, the reference card data is set in step 1 WITHOUT incrementing `displayEvent`. Only `displayMessage()` at step 2 increments `displayEvent`. The `useEffect` triggers once.

The actual risk is subtler: between step 1 (setting `referenceCard`) and step 3 (setting `referenceRevealCount: 0`), there's a window where `displayMessage()` at step 2 computes `referenceRevealCount` via `computeRevealCount()`. If `computeRevealCount` returns `-1` (show all), then step 3 overrides it to `0` (progressive reveal). This is the correct behavior — step 3 is an intentional override.

**Downgrading to P3.** No actual double-fire occurs. The code is complex but correct.

---

## Bug 7: TTS Safety Timeout Resolves Silently

**Severity:** P2 — Medium
**Status:** Confirmed
**Affected flow:** Any TTS playback (Act 1 sentences, Act 2/3 subtitles)

### Symptom

When TTS takes too long (e.g., network latency, ElevenLabs slowdown), the safety timeout fires and calls `ttsRef.current?.stop()`. The `speak()` promise resolves, but the word reveal may be incomplete — words stop appearing mid-sentence, then suddenly all words appear at once.

### Root Cause Trace

1. **Safety timeout at [assessment-stage.tsx:223](src/components/assessment/stage/assessment-stage.tsx#L223):**
   ```typescript
   const ttsTimeout = Math.max(30000, words.length * 800);
   await Promise.race([
     ttsRef.current.speak(text, token, syncReveal),
     new Promise<void>((resolve) => setTimeout(() => {
       console.warn("[TTS] Safety timeout reached, continuing");
       ttsRef.current?.stop();
       resolve();
     }, ttsTimeout)),
   ]);
   ```

2. **After the race resolves** — [assessment-stage.tsx:236](src/components/assessment/stage/assessment-stage.tsx#L236):
   ```typescript
   getStore().setSubtitleRevealedWords(words.length);  // Jump to all words
   ```

3. The word reveal interval (`syncReveal`) was started when TTS playback began but is cleared at line 235. If TTS timed out before completing, the reveal was pacing to audio that stopped mid-playback. The jump at line 236 covers this, but creates a visual "snap" — words appear progressively, freeze, then jump to completion.

### In `playSentenceSequence`

The same pattern exists at [assessment-stage.tsx:362](src/components/assessment/stage/assessment-stage.tsx#L362), but with `preSplit = true` and a `MIN_SENTENCE_MS = 2500` floor that mitigates the snap effect for short sentences.

### Fix

When the safety timeout fires, calculate remaining unrevealed words and reveal them progressively over ~500ms instead of jumping:

```typescript
setTimeout(() => {
  ttsRef.current?.stop();
  // Progressive fallback reveal
  const remaining = words.length - revealed;
  if (remaining > 0) {
    const msPerWord = 500 / remaining;
    const fallbackInterval = setInterval(() => {
      revealed++;
      getStore().setSubtitleRevealedWords(revealed);
      if (revealed >= words.length) clearInterval(fallbackInterval);
    }, msPerWord);
  }
  resolve();
}, ttsTimeout);
```

---

## Bug 8: AudioContext Suspended After Tab Background

**Severity:** P1 — High
**Status:** Confirmed
**Affected flow:** Any return from backgrounded tab during assessment

### Symptom

If the candidate switches tabs during the assessment (e.g., to look something up) and returns, the browser may have suspended the AudioContext. The TTS engine calls `ensureAudioContext()` which tries `ctx.resume()`, but if resume fails (e.g., no user gesture since return), the engine sets `fallbackActive = true` permanently. All subsequent TTS uses browser SpeechSynthesis for the rest of the session — lower quality voice, no amplitude data for orb animation.

### Root Cause Trace

1. **`ensureAudioContext()` at [tts-engine.ts:84](src/components/assessment/voice/tts-engine.ts#L84):**
   ```typescript
   if (this.audioContext.state === "suspended") {
     try { await this.audioContext.resume(); }
     catch (err) { console.warn("[TTS] AudioContext resume failed:", err); }
   }
   ```
   Note: the catch logs but does NOT set `fallbackActive`. It returns the suspended context.

2. **`speak()` checks again at [tts-engine.ts:126](src/components/assessment/voice/tts-engine.ts#L126):**
   ```typescript
   if (ctx.state === "suspended") {
     this.fallbackActive = true;
     this.onFallback();
     return this.speakFallback(text, onPlaybackStart);
   }
   ```
   This permanently switches to SpeechSynthesis fallback.

3. **`fallbackActive` is never reset.** Once set to `true`, every subsequent `speak()` call goes to `speakFallback()` at [line 105](src/components/assessment/voice/tts-engine.ts#L105), even if the AudioContext would now resume successfully (e.g., after a user click).

### Fix

Instead of permanently setting `fallbackActive`, retry AudioContext resume on each `speak()` call:

```typescript
async speak(text: string, token: string, onPlaybackStart?: ..., preSplit = false): Promise<void> {
  this.stop();

  // Try to recover from fallback on each call (user gesture may have occurred)
  if (this.fallbackActive && this.audioContext) {
    try {
      await this.audioContext.resume();
      if (this.audioContext.state === "running") {
        this.fallbackActive = false; // Recovered!
      }
    } catch { /* still in fallback */ }
  }

  if (this.fallbackActive) {
    return this.speakFallback(text, onPlaybackStart);
  }
  // ... rest of speak()
}
```

---

## Bug 9: Rate Limiter Ineffective Across Serverless Isolates

**Severity:** P2 — Medium
**Status:** Confirmed (known architectural limitation)
**Affected flow:** All API routes using `checkRateLimit()`

### Detail

The rate limiter at [rate-limit.ts](src/lib/rate-limit.ts) uses an in-memory `Map<string, { count, resetTime }>`. In a serverless environment (Vercel), each function invocation may run in a different isolate with its own memory. Rate limit state is not shared across isolates, so a client can exceed the limit by hitting different isolates.

### Impact

- **Assessment chat:** 30 req/min limit per token. A candidate sending messages faster than this would only be limited within a single isolate.
- **Practical risk is low:** Candidates interact via voice or typing, which is inherently slow. The rate limiter still protects against single-isolate bursts.
- **Bot/abuse risk is real:** An automated client could bypass rate limits entirely.

### Fix

Use Redis-backed rate limiting (e.g., `@upstash/ratelimit` with `@upstash/redis`). Fall back to in-memory when Redis is not configured. This is already in the remediation plan (Phase 3.4).

---

## Bug 10: GET Handler Missing try/catch

**Severity:** P2 — Medium
**Status:** Confirmed
**Affected flow:** Session recovery (GET /api/assess/[token]/chat)

### Detail

The GET handler at [chat/route.ts:834](src/app/api/assess/[token]/chat/route.ts#L834) has a try/catch wrapping the body (added at line 841). ✓ This was already fixed.

**Revised: NOT a bug.** The GET handler does have error handling.

---

## False Positives — Claims That Are NOT Bugs

### FP1: "Off-by-one in beat content lookup"

**Claim:** Classification advances the beat, then the engine produces content for the wrong beat.

**Why it's wrong:** The flow is intentionally sequential:
1. Classification runs → `computeStateUpdate()` advances `currentBeat` from N to N+1
2. State is saved and re-fetched (line 388)
3. Engine runs with NEW state → produces content for beat N+1

This is correct. The engine produces content for the NEXT beat after classification, which is the intended behavior.

### FP2: "Double state update — computeStateUpdate called twice"

**Claim:** State advances twice because `computeStateUpdate` is called at line 376 (with classification) and again at line 565/662 (for content path).

**Why it's wrong:** The second `computeStateUpdate()` call (line 565 for beat 0, line 662 for pre-generated) is called WITHOUT the `classification` parameter. For Act 1, `computeStateUpdate()` without classification returns `{}` (empty update) at [engine.ts:676](src/lib/assessment/engine.ts#L676) — unless it detects a `transition` in metadata (inter-scenario advance). No double advancement occurs.

### FP3: "Acknowledgment race condition with classification"

**Claim:** Acknowledgment fires before classification completes, so it might use stale state.

**Why it's wrong:** Acknowledgment is intentionally generic — it references what the candidate SAID, not how they were classified. It doesn't depend on classification results. The parallelism is correct by design: both fire at the same time, acknowledgment is awaited after classification completes at [chat/route.ts:622](src/app/api/assess/[token]/chat/route.ts#L622).

### FP4: "Stale NudgeManager callbacks"

**Claim:** NudgeManager callbacks capture stale state via closure.

**Why it's wrong:** All nudge callbacks use `getStore()` at fire time ([assessment-stage.tsx:442](src/components/assessment/stage/assessment-stage.tsx#L442)), which returns the current Zustand state, not a stale closure capture.

---

## Summary Table

| # | Bug | Severity | Status | Fix Complexity |
|---|-----|----------|--------|---------------|
| 1 | `[NO_RESPONSE]` infinite loop | P0 | Confirmed | Medium — add force-advance logic |
| 2 | Stale message history in classification | P1 | Confirmed | Simple — push to array after persist |
| 3 | `findFirst` vs `findUnique` | P3 | Confirmed | Trivial — one-line change |
| 4 | LLM meta-narration in speech | P2 | Partially fixed | Regenerate content libraries + catch-all regex |
| 5 | Pre-gen content quality gap | — | By design | N/A |
| 6 | displayEvent double-fire | P3 | Downgraded | No fix needed (code is correct) |
| 7 | TTS safety timeout word snap | P2 | Confirmed | Simple — progressive fallback reveal |
| 8 | AudioContext permanently stuck in fallback | P1 | Confirmed | Simple — retry resume on each speak() |
| 9 | Rate limiter serverless isolation | P2 | Confirmed | Medium — Redis-backed limiter |
| 10 | GET handler missing error handling | — | Already fixed | N/A |

### Priority Order for Fixes

1. **Bug 1** (P0) — `[NO_RESPONSE]` infinite loop. Assessment-breaking.
2. **Bug 8** (P1) — AudioContext fallback is permanent. Degrades entire session.
3. **Bug 2** (P1) — Stale history. Affects classification quality every request.
4. **Bug 4** (P2) — Meta-narration. Regenerate content libraries.
5. **Bug 7** (P2) — TTS timeout snap. Visual polish.
6. **Bug 9** (P2) — Rate limiter. Security hardening.
7. **Bug 3** (P3) — findFirst/findUnique. Trivial cleanup.

# Audit 2: Request Flow Traces

**Purpose:** Trace every request path end-to-end — what happens when the candidate speaks, taps a button, or stays silent. Every file, every function, every state change.

**Codebase version:** v1.15 (post-conversational quality hardening)

---

## Flow 1: Act 1 Conversational Exchange — Content Library ON

This is the "golden path" for Act 1, beats 3-5 (pre-generated content with acknowledgment). Beats 1-2 force-stream (see Flow 2). Beat 0 has a separate entry path (sentinel `[BEGIN_ASSESSMENT]`).

### Step 1: Candidate speaks

**File:** `src/components/assessment/stage/assessment-stage.tsx:897-930`
**Function:** `handleVoiceTranscript(text: string)`

The `MicButton` component fires its `onTranscript` callback with the recognized speech text.

**State changes:**
- `candidateTranscript` → the spoken text
- `showTranscript` → `true` (fades after 3s via `transcriptTimeout`)
- `orbMode` → `"processing"` (set at line 924)
- `ttsRef.current.stop()` — kills any playing audio
- `nudgeRef.current.stop()` — clears silence timers
- `sequenceIdRef.current++` — invalidates any running sentence sequence

### Step 2: Store sends message to server

**File:** `src/stores/chat-assessment-store.ts:308-531`
**Function:** `sendMessage(content: string)`

**State changes (immediate):**
- Appends `userMessage` and empty `assistantMessage` to `messages[]`
- `isLoading` → `true`
- `error` → `null`
- `orbMode` → `"processing"`

**Network request:**
```
POST /api/assess/{token}/chat
Content-Type: application/json
Body: { messages: [...allMessages] }
Signal: AbortSignal.timeout(30_000)
```

Retry logic: on failure, waits 2s, retries once (lines 366-372).

### Step 3: Server validates token and loads state

**File:** `src/app/api/assess/[token]/chat/route.ts:33-154`
**Function:** `POST(request, { params })`

**Database reads (sequential):**
1. `checkRateLimit("chat:{token}", RATE_LIMITS.assessmentChat)` — in-memory sliding window
2. `prisma.assessmentInvitation.findUnique({ where: { linkToken: token }, include: { candidate, role } })`
3. `prisma.assessment.findFirst({ where: { candidateId }, include: { assessmentState, messages } })`

**Guards:** Returns 429 (rate limit), 401 (expired/invalid token), 404 (no assessment), 400 (already completed).

On first request ever: creates `AssessmentState` with content library snapshot:
- `getReadyLibrary(roleId)` → finds latest `READY` ContentLibrary
- `selectRandomVariants(library)` → picks random variant index per scenario
- `prisma.assessmentState.create({ data: { assessmentId, contentLibraryId, variantSelections } })`

**State snapshot captured** for Sentry error context (line 144-152).

### Step 4: Candidate message persisted to DB

**File:** `src/app/api/assess/[token]/chat/route.ts:268-286`

**Guard:** Skips sentinels (messages matching `/^\[.+\]$/`).

**Database write:**
```typescript
prisma.conversationMessage.create({
  data: {
    assessmentId, role: "CANDIDATE", content: lastUserMessage,
    act: state.currentAct, sequenceOrder: nextSeq,
    metadata: { scenarioIndex, beatIndex, construct? }
  }
})
```

### Step 5: Acknowledgment generation fires (parallel)

**File:** `src/app/api/assess/[token]/chat/route.ts:324-349`
**Condition:** `currentAct === "ACT_1" && currentBeat > 2 && CONTENT_LIBRARY_ENABLED && contentLibraryId`

Beats 0-2 skip acknowledgment: beat 0 is intro, beats 1-2 are force-streamed with native personalization.

**File:** `src/lib/assessment/generate-acknowledgment.ts:15-89`
**Function:** `generateAcknowledgment(candidateInput, beatType, constructs, scenarioName, lastAriaMessage)`

**API call:**
```
POST https://api.anthropic.com/v1/messages
Model: AI_CONFIG.realtimeModel (claude-sonnet-4-20250514)
max_tokens: 80
Timeout: 5000ms (AbortController)
```

Returns a single bridging sentence (~20 words). Falls back to random `FALLBACK_ACKNOWLEDGMENTS[]` on any error.

**This promise is NOT awaited yet** — it runs concurrently with classification (Step 6).

### Step 6: Classification runs

**File:** `src/app/api/assess/[token]/chat/route.ts:351-402`
**Condition:** `currentAct === "ACT_1" && lastUserMessage && !isSentinel`

**File:** `src/lib/assessment/classification.ts:102-151`
**Function:** `classifyResponse(candidateResponse, scenario, beat, conversationHistory, roleContext)`

**Dual-evaluation:** 2 parallel Anthropic API calls via `Promise.allSettled()`.

Each call:
```
POST https://api.anthropic.com/v1/messages
Model: AI_CONFIG.realtimeModel
max_tokens: 500
Timeout: AI_CONFIG.realtimeTimeoutMs (from config)
```

**Prompt construction** (`buildClassificationPrompt`, line 153-198):
- Includes scenario name, beat type, primary constructs, rubric indicators
- Includes sanitized conversation history (last 10 messages, 4000 char cap)
- Candidate response wrapped in `<candidate_response>` tags
- Few-shot examples injected per beat type (when `CLASSIFICATION_FEW_SHOT` enabled)
- Returns JSON: `{ classification, indicatorsPresent, indicatorsAbsent, rubricScore, constructSignals, branchRationale }`

**Agreement logic:**
- Both agree → use the one with higher `rubricScore`
- Disagree → use the one with lower `rubricScore` (conservative)
- 0 successes → `fallbackClassification()`: ADEQUATE (rubricScore 0.5), or WEAK if <10 words

**Result:** `ClassificationResult` with `classification: "STRONG" | "ADEQUATE" | "WEAK"`

### Step 7: State updated with classification

**File:** `src/app/api/assess/[token]/chat/route.ts:376-391`

**Function:** `computeStateUpdate(state, action, classification)` (engine.ts:621-676)

For Act 1 with classification, computes:
- `currentBeat` → incremented by 1
- `branchPath` → appends the classification ("STRONG"/"ADEQUATE"/"WEAK")
- If `newBeat >= maxBeats`: `currentScenario` incremented, `currentBeat` reset to 0

**Database write:**
```typescript
prisma.assessmentState.update({
  where: { assessmentId },
  data: { ...stateUpdate, realtimeTokensIn: { increment }, realtimeTokensOut: { increment } }
})
```

State is re-fetched after update (`findUnique`) so engine sees the latest beat/scenario.

### Step 8: Engine determines next action

**File:** `src/lib/assessment/engine.ts:42-67`
**Function:** `getNextAction(state, messages, lastCandidateMessage)`

Dispatches to `getAct1Action(state, messages, lastCandidateMessage)` (line 56).

Returns `AgentMessageAction` with:
- `type: "AGENT_MESSAGE"`
- `systemPrompt`: from `buildAct1SystemPrompt(scenario, beatIndex)`
- `userContext`: from `buildBeatPrompt(scenario, beat, lastClassification)`
- `metadata`: `{ scenarioIndex, beatIndex, beatType, primaryConstructs }`

### Step 9: Pre-generated content path activates

**File:** `src/app/api/assess/[token]/chat/route.ts:591-684`

**Conditions checked (all must be true):**
1. `FEATURE_FLAGS.CONTENT_LIBRARY_ENABLED` ✓
2. `state.contentLibraryId` exists ✓
3. `currentAct === "ACT_1"` ✓
4. `lastUserMessage` exists (real candidate response) ✓
5. `!isSentinel` ✓
6. No transition metadata ✓
7. `!forceStreaming` → `beatIndex` must be ≥ 3 (beats 1-2 force-stream, line 603)

### Step 10: Content library lookup

**File:** `src/lib/assessment/content-serving.ts:16-32`
**Function:** `loadContentLibrary(contentLibraryId)`

Loads from `prisma.contentLibrary.findUnique()` with in-memory cache (`libraryCache` Map). Libraries are immutable once READY — cache is permanent.

**File:** `src/lib/assessment/content-serving.ts:71-116`
**Function:** `lookupBeatContent(library, scenarioIndex, beatIndex, classification, variantSelections)`

Navigates: `library.act1.scenarios[scenarioIndex].variants[variantIdx].beats[beatIndex]`

For beats 1-5: reads `beat.branches[classification]` → returns `{ spokenText, referenceUpdate? }`.
Falls back to `beat.branches.ADEQUATE` if the classification branch is missing.

### Step 11: Acknowledgment awaited

**File:** `src/app/api/assess/[token]/chat/route.ts:622-624`

The `acknowledgmentPromise` from Step 5 is now awaited. By this point, it has likely resolved (~200-400ms) since classification took ~1-2s.

### Step 12: Compose full response

**File:** `src/app/api/assess/[token]/chat/route.ts:630-638`

```typescript
const fullText = beatIndex === 0
  ? content.spokenText
  : `${acknowledgment} ${content.spokenText}`;
```

Beat 0 gets no acknowledgment (it's the intro). Beats 3-5 get: `"[acknowledgment sentence] [pre-generated content]"`.

### Step 13: Agent message persisted to DB

**File:** `src/app/api/assess/[token]/chat/route.ts:645-659`

```typescript
prisma.conversationMessage.create({
  data: {
    assessmentId, role: "AGENT", content: preGenContent.spokenText,
    act: action.act, sequenceOrder: nextSeq,
    metadata: { ...action.metadata, preGenerated: true, classification }
  }
})
```

### Step 14: State update applied

**File:** `src/app/api/assess/[token]/chat/route.ts:661-670`

`computeStateUpdate(state, action)` — for a non-transition AGENT_MESSAGE without classification, this typically returns `{}` (classification already advanced the beat in Step 7).

### Step 15: JSON response sent to client

**File:** `src/app/api/assess/[token]/chat/route.ts:673-683`

```json
{
  "type": "agent_message",
  "message": "[acknowledgment] [pre-generated spoken text]",
  "referenceCard": { "role": "...", "context": "...", "sections": [...], "question": "..." },
  "referenceUpdate": { "newInformation": ["..."], "question": "..." },
  "progress": { "act1": 0.42, "act2": 0, "act3": 0 }
}
```

Content-Type: `application/json` (NOT a stream).

### Step 16: Client receives JSON response

**File:** `src/stores/chat-assessment-store.ts:376-480`

The `contentType.includes("application/json")` branch activates. The response has a `data.message`, so:

1. Creates `ChatMessage` and appends to `messages[]`
2. Sets `isLoading` → `false`
3. If `data.referenceCard`: sets `referenceCard` in store directly (lines 430-440)
4. If `data.referenceUpdate`: merges into existing card (lines 441-465)
5. Calls `displayMessage(data.message, currentAct, false)`
6. If `hasReferenceCard`: sets `referenceRevealCount` → `0` (progressive reveal)
7. Calls `applyProgress(data.progress)` — updates `actProgress.act1/act2/act3`

### Step 17: displayMessage processes Act 1 content

**File:** `src/stores/chat-assessment-store.ts:203-306`
**Function:** `displayMessage(content, act, isHistory)`

For `act === "ACT_1"`:

1. **Calls** `parseScenarioResponse(content)` from `parse-scenario-response.ts:153-214`
   - Checks for `---REFERENCE---` or `---REFERENCE_UPDATE---` delimiters
   - For pre-generated content: usually NO delimiters (reference data sent separately in JSON)
   - Calls `cleanText(spokenText)` — strips markdown, stage directions, structural labels
   - Calls `splitSentences(spokenText)` — splits on `.!?` followed by whitespace + capital letter
   - Returns `{ spokenText, sentences[], reference, referenceIsExplicit, referenceUpdate }`

2. **Sets state:**
   - `subtitleText` → first sentence
   - `subtitleRevealedWords` → `0`
   - `sentenceList` → all sentences
   - `currentSentenceIndex` → `0`
   - `referenceCard` → computed (keeps existing if no explicit delimiter; reference was set in Step 16)
   - `referenceRevealCount` → computed (preserved if already `0` from Step 16)
   - `orbMode` → `"speaking"`
   - `displayEvent` → incremented (+1)
   - `displayIsHistory` → `false`

### Step 18: TTS trigger fires

**File:** `src/components/assessment/stage/assessment-stage.tsx:796-817`

The `useEffect` watching `displayEvent` fires:
- Guards: not history, not Phase 0, not transition, not already in a sequence
- `ttsRef.current.stop()` — stops any existing audio
- `sentenceList.length >= 1` → calls `playSentenceSequence(sentenceList)`

### Step 19: Sentence-by-sentence TTS playback

**File:** `src/components/assessment/stage/assessment-stage.tsx:310-401`
**Function:** `playSentenceSequence(sentences: string[])`

Filters out invalid sentences (< 2 words, lone numbers). Captures `sequenceId` for cancellation.

**For each sentence `i`:**

1. Sets `currentSentenceIndex` → `i`
2. Sets `subtitleText` → current sentence
3. If progressive reveal active: `setReferenceRevealCount(i + 1)` — reveals one more card section per sentence
4. **Prefetches** next sentence: `ttsRef.current.prefetch(sentences[i+1], token)` (N+1 lookahead)

### Step 20: TTS engine fetches audio

**File:** `src/components/assessment/voice/tts-engine.ts:102-196`
**Function:** `TTSEngine.speak(text, token, onPlaybackStart, preSplit=true)`

**Cache check:** `audioCache.get(text)` → if hit, plays cached buffers directly.

If miss:
- `chunks = preSplit ? [text] : chunkText(text)` — since `preSplit=true` from `playSentenceSequence`, no re-chunking
- Ensures AudioContext is running (creates if needed, resumes if suspended)
- Falls back to `speakFallback()` (browser SpeechSynthesis) if context won't resume

### Step 21: Audio fetch from server

**File:** `src/components/assessment/voice/tts-engine.ts:199-237`
**Function:** `fetchAndDecodeChunk(chunk, token, ctx, signal)`

```
POST /api/assess/{token}/tts
Content-Type: application/json
Body: { text: chunk }
```

### Step 22: TTS server proxy

**File:** `src/app/api/assess/[token]/tts/route.ts:19-127`

1. Rate limit: `checkRateLimit("tts:{token}", RATE_LIMITS.tts)`
2. Validate invitation token (same as chat route)
3. Check `ELEVENLABS_API_KEY` and `ELEVENLABS_VOICE_ID` → 503 with `fallback: true` if missing

**External API call:**
```
POST https://api.elevenlabs.io/v1/text-to-speech/{voiceId}/stream?output_format=mp3_44100_128
Headers: { "xi-api-key": apiKey }
Body: {
  text,
  model_id: "eleven_flash_v2_5",
  voice_settings: { stability: 0.6, similarity_boost: 0.8, style: 0.3, use_speaker_boost: true }
}
```

Response: streams `audio/mpeg` back to client (passthrough).

### Step 23: Audio decoded and queued

**File:** `src/components/assessment/voice/tts-engine.ts:222-230`

```typescript
const arrayBuffer = await res.arrayBuffer();
if (arrayBuffer.byteLength < 100) return null; // Too small
return await ctx.decodeAudioData(arrayBuffer);
```

Returns `AudioBuffer` which gets pushed to `playQueue`.

### Step 24: Pipelined audio playback

**File:** `src/components/assessment/voice/tts-engine.ts:287-330`
**Function:** `playNext()`

Creates `AudioBufferSourceNode`, connects to `gainNode → analyser → destination`.
- `source.start(0)` — begins playback
- Safety timeout: `(buffer.duration + 2) * 1000` ms
- On ended: recursively calls `playNext()` for gapless playback

### Step 25: Amplitude extraction drives orb

**File:** `src/components/assessment/voice/tts-engine.ts:332-348`
**Function:** `startAmplitudeLoop()`

`requestAnimationFrame` loop:
- `analyser.getByteFrequencyData(amplitudeData)`
- Computes average across frequency bins: `sum / length / 255`
- Fires `onAmplitude(avg)` callback → `store.setAudioAmplitude(amplitude)`

The `AssessmentOrb` component subscribes to `audioAmplitude` for visual pulsing.

### Step 26: Word reveal synchronized to audio

**File:** `src/components/assessment/stage/assessment-stage.tsx:346-354`

When TTS fires `onPlaybackStart(durationSec)`:
- Computes `msPerWord = max(60, (durationSec * 1000) / totalWords)`
- Starts `setInterval` that increments `subtitleRevealedWords` at that pace

The `SubtitleDisplay` component renders words up to `subtitleRevealedWords`, creating a word-by-word reveal synchronized to speech.

### Step 27: Sentence complete → next sentence or nudge

After TTS finishes a sentence:
- `revealInterval` cleared, all words revealed
- Minimum 2500ms enforced per sentence (line 376-380)
- 150ms pause between sentences (line 383-385)
- Loop continues to next sentence

After ALL sentences:
- `orbMode` → `"idle"`
- `audioAmplitude` → `0`
- `isTTSPlaying` → `false`
- `referenceRevealCount` → `-1` (reveal all card sections)
- `startNudgeForCurrentAct()` called → begins silence detection timers

---

## Flow 2: Act 1 Conversational Exchange — Content Library OFF / Streaming

Diverges from Flow 1 at Step 9. This path is also used for beats 1-2 even when content library is ON (force-streaming for personalization).

### Steps 1-8: Identical to Flow 1

Same candidate input → server validation → message persistence → classification → state update → engine action.

### Step 9 (diverged): Pre-generated conditions fail

One or more conditions fail:
- `CONTENT_LIBRARY_ENABLED` is false, OR
- No `contentLibraryId` in state, OR
- `forceStreaming = true` (beats 1-2), OR
- Beat 0 sentinel path not met

Falls through to streaming path (line 686).

### Step 10: Conversation history built

**File:** `src/app/api/assess/[token]/chat/route.ts:689`
**Function:** `buildConversationHistory(assessment.messages, clientMessages)` (line 931-955)

- Uses DB messages as source of truth
- Filters out `SYSTEM` role and `PHASE_0` act messages
- Maps `AGENT` → `assistant`, `CANDIDATE` → `user`
- Sanitizes user messages: strips XML tags, caps at 2000 chars
- Returns last 40 messages

### Step 11: System prompt enriched

**File:** `src/app/api/assess/[token]/chat/route.ts:692-716`

Appends to `action.systemPrompt`:
1. **Role context** (if available): role name, domain, key tasks, technical skills
2. **Candidate name**: "You may address them by name once"
3. **Beat-aware personalization** (Act 1 streaming only):
   - Beat 2 (COMPLICATION): must challenge the candidate's specific stated approach
   - Beat 3+: begin with brief acknowledgment of something specific they said

### Step 12: Vercel AI SDK streaming

**File:** `src/app/api/assess/[token]/chat/route.ts:718-788`

```typescript
const result = streamText({
  model: anthropic(AI_CONFIG.realtimeModel),
  system: systemPrompt,
  messages: [...conversationHistory, { role: "user", content: action.userContext }],
  maxOutputTokens: 500,
  temperature: 0.7,
  abortSignal: AbortSignal.timeout(AI_CONFIG.realtimeTimeoutMs),
  async onFinish({ text }) { ... }
});
```

**Progress header:** `X-ACI-Progress` set from `computeProgress(state)` before stream starts.

**Response:** `result.toTextStreamResponse()` — streams text chunks to client.

### Step 13: onFinish callback (after stream completes)

**File:** `src/app/api/assess/[token]/chat/route.ts:729-780`

Runs after all chunks are sent:
1. Strips `<construct_check>` tags (Act 3 parallel scenarios)
2. **Persists agent message** to `ConversationMessage`
3. **Updates assessment state** via `computeStateUpdate(state, action)`

Errors captured by `Sentry.captureException`.

### Step 14: Client reads stream

**File:** `src/stores/chat-assessment-store.ts:482-520`

The response body is a `ReadableStream`:
1. Reads `x-aci-progress` header → applies progress
2. Reads chunks via `reader.read()` in a while loop
3. Accumulates text, updates `assistantMessage.content` in store on each chunk
4. On done: `isLoading` → `false`
5. Calls `displayMessage(finalContent, currentAct, false)`

### Step 15: displayMessage + TTS

Same as Flow 1, Steps 17-27. The streaming path produces the full text only after all chunks arrive, then displays and speaks it sentence-by-sentence.

**Key difference:** Reference cards in streamed responses rely on `---REFERENCE---` / `---REFERENCE_UPDATE---` delimiters in the AI output text, parsed by `parseScenarioResponse()`. Pre-generated content (Flow 1) sends reference data separately in the JSON envelope.

---

## Flow 3: Act 2 Interactive Element (MC / Numeric / Timed)

### Step 1: Engine serves an interactive element

After the previous response is processed, `getAct2Action()` runs:

**File:** `src/lib/assessment/engine.ts:301-425`

**Adaptive loop:**
1. Gets `constructId` from `state.currentConstruct`
2. Gets `loopState` from `state.act2Progress[constructId]`
3. Calls `getNextItem(loopState)` from `adaptive-loop.ts` — selects next item based on performance

**Returns:**
```typescript
{
  type: "INTERACTIVE_ELEMENT",
  elementType: nextItem.elementType,  // "MULTIPLE_CHOICE" | "NUMERIC_INPUT" | "TIMED_CHALLENGE"
  elementData: { prompt, construct, itemId, options, timingExpectations },
  act: "ACT_2",
  followUpPrompt: "Walk me through your thinking on that one."
}
```

### Step 2: Chat route handles INTERACTIVE_ELEMENT action

**File:** `src/app/api/assess/[token]/chat/route.ts:442-481`

1. **Persists** element as `ConversationMessage` with `elementType` and `elementData`
2. **Updates state** via `computeStateUpdate()` — for Act 2 elements, may set `currentConstruct` and `currentPhase`
3. **Strips** `correctAnswer` from response data (line 468)
4. Returns JSON:

```json
{
  "type": "interactive_element",
  "elementType": "MULTIPLE_CHOICE",
  "elementData": { "prompt": "...", "options": [...], "itemId": "..." },
  "followUpPrompt": "Walk me through your thinking on that one.",
  "progress": { ... }
}
```

### Step 3: Client renders element

**File:** `src/stores/chat-assessment-store.ts:382-397`

Sets `activeElement`:
```typescript
{
  elementType: data.elementType,
  elementData: data.elementData,
  followUpPrompt: data.followUpPrompt,
  responded: false
}
```

`isLoading` → `false`, `orbMode` → `"idle"`.

### Step 4: Element appearance + nudge

**File:** `src/components/assessment/stage/assessment-stage.tsx:852-866`

The `useEffect` watching `activeElement`:
- Delays 300ms, then `setShowElements(true)` — triggers CSS transition
- Calls `startNudgeForCurrentAct()` with `act_2` thresholds: first=15s, second=30s, final=45s

### Step 5: InteractiveRenderer displays element

**File:** `src/components/assessment/interactive/interactive-renderer.tsx`

Renders the appropriate element type (MultipleChoice, NumericInput, TimedChallenge) based on `activeElement.elementType`.

### Step 6: Candidate taps an option

**File:** `src/components/assessment/stage/assessment-stage.tsx:932-946`
**Function:** `handleElementResponse(value: string)`

1. `ttsRef.current.stop()` — stops any audio
2. `nudgeRef.current.stop()` — clears silence timers
3. Calls `store.sendElementResponse({ elementType, value, itemId, construct })`

### Step 7: Element response sent to server

**File:** `src/stores/chat-assessment-store.ts:533-704`
**Function:** `sendElementResponse(response)`

**Network request:**
```
POST /api/assess/{token}/chat
Body: {
  messages: [...allMessages],
  elementResponse: { elementType, value, itemId?, construct?, responseTimeMs? }
}
```

Retry logic: up to 3 attempts with backoff (1s, 2s).

On success: `activeElement.responded` → `true`.

### Step 8: Server persists element response

**File:** `src/app/api/assess/[token]/chat/route.ts:223-266`

Two database writes:
1. `ConversationMessage` with `elementType`, `candidateInput`, `responseTimeMs`, metadata
2. `ItemResponse` upsert (for scoring pipeline) with `act` field

### Step 9: Adaptive loop records result

**File:** `src/app/api/assess/[token]/chat/route.ts:289-322`

Only for Act 2 with `itemId`:
1. Finds item in `ITEM_BANK`
2. Gets or initializes `AdaptiveLoopState` for the construct
3. Calls `recordResult(loopState, { itemId, difficulty, correct, responseTimeMs, candidateResponse })`
4. Checks for phase transition (CALIBRATION → BOUNDARY_MAPPING → PRESSURE_TEST → DIAGNOSTIC_PROBE)
5. Updates `act2Progress` and `currentPhase` in state

### Step 10: Engine determines next action

`getAct2Action()` runs again with updated state. Could return:
- Another `INTERACTIVE_ELEMENT` (next item in same phase)
- An `AGENT_MESSAGE` (diagnostic probe, phase transition, or construct wrap-up)
- A `TRANSITION` (all constructs complete → Act 3)

The cycle repeats.

---

## Flow 4: Phase 0 Warmup (Scripted, No AI)

### Step 1: Assessment page loads, audio context initialized

**File:** `src/components/assessment/stage/assessment-stage.tsx:157-178`

- `TTSEngine` created with callbacks for amplitude, state, fallback
- Auto-unlock: `ttsRef.current.resumeContext()` after 200ms delay

### Step 2: GET /api/assess/{token}/chat — session recovery

**File:** `src/components/assessment/stage/assessment-stage.tsx:653-730`

Fetches existing state. If no messages and `currentAct === "PHASE_0"`:
- `setPhase0Ready(true)` — triggers Phase 0 orchestration
- `orchestratorPhase` → `"PHASE_0"`

### Step 3: Phase 0 orchestration begins

**File:** `src/components/assessment/stage/assessment-stage.tsx:736-790`

`useEffect` watching `phase0Ready`:
- Guards: `phase0Ready && orchestratorPhase === "PHASE_0" && phase0Ref.current === "idle"`
- Sets `phase0Ref.current` → `"playing"`

### Step 4: Segments play sequentially

**File:** `src/lib/assessment/phase-0.ts:23-49`
**Function:** `getPhase0Segments(candidateName, companyName)`

Returns 4 segments:
1. **"introduction"**: `"Hello {name}, I'm Aria. Welcome to your assessment with {company}..."` (9s estimate)
2. **"format_orientation"**: `"Here's how this will work..."` (18s estimate)
3. **"mic_check"**: `"Before we begin, let's confirm your microphone..."` (9s, `showMic: true`)
4. **"confirmation"**: `"I can hear you clearly. Let's get started."` (4s, `triggersTransition: true`)

**Playback loop** (assessment-stage.tsx:747-774):

For segments 0-1 (introduction + format):
1. `playSegmentTTS(segment.text)` — speaks via TTS
2. `persistPhase0Msg(segment.text, "AGENT")` — fire-and-forget POST to server
3. `sleep(segment.pauseAfterMs)` — inter-segment pause

For segment 2 (mic_check):
1. `playSegmentTTS(micSegment.text)`
2. `persistPhase0Msg(micSegment.text, "AGENT")`
3. `phase0Ref.current` → `"mic_check"`
4. `setPhase0MicCheck(true)` — shows mic button

### Step 5: Mic nudge timers start

**File:** `src/components/assessment/stage/assessment-stage.tsx:765-774`

- **15s timer:** `playSegmentTTS(MIC_NUDGE_15S)` — "Take your time. If your microphone isn't cooperating..."
- **30s timer:** switches to text mode + `playSegmentTTS(MIC_NUDGE_30S)` — "No problem at all — let's switch to typing."

### Step 6: Candidate responds (voice or text)

**File:** `src/components/assessment/stage/hooks/use-phase0.ts:56-78`
**Function:** `handlePhase0Response(text: string)`

1. Sets `phase0Ref.current` → `"completing"`
2. `setPhase0MicCheck(false)` — hides mic check UI
3. `clearMicNudgeTimers()` — cancels 15s/30s nudges
4. `persistPhase0Msg(text, "CANDIDATE")` — fire-and-forget
5. `playSegmentTTS(confirmationText)` — "I can hear you clearly. Let's get started."
6. `persistPhase0Msg(confirmationText, "AGENT")` — fire-and-forget
7. Calls `handlePhase0Complete()`

### Step 7: Phase 0 message persistence

**File:** `src/app/api/assess/[token]/chat/route.ts:183-204`

`trigger: "phase_0_message"`:
```typescript
prisma.conversationMessage.create({
  data: {
    assessmentId, role, content, act: "PHASE_0",
    sequenceOrder: nextSeq
  }
})
```

Returns `{ ok: true }`.

### Step 8: Phase 0 completion

**File:** `src/components/assessment/stage/hooks/use-phase0.ts:35-54`
**Function:** `handlePhase0Complete()`

1. `phase0Ref.current` → `"done"`
2. Fire-and-forget POST with `trigger: "phase_0_complete"` — server sets `currentAct: "ACT_1"` and `phase0Complete: true`
3. **Store updates:**
   - `orchestratorPhase` → `"TRANSITION_0_1"`
   - `loadHistory([], { currentAct: "ACT_1", isComplete: false })`
   - `orbMode` → `"idle"`
   - `orbTargetSize` → `FULL`
   - `subtitleText` → `""`

The Phase 0 break screen renders, waiting for the candidate to click "Begin".

### Step 9: Candidate clicks "Begin" → Act 1 starts

**File:** `src/components/assessment/stage/assessment-stage.tsx:482-530`
**Function:** `handleBeginAct1()`

1. Orb glides from center → sidebar (1200ms animation)
2. Layout fades out (600ms)
3. `orchestratorPhase` → `"ACT_1"` — switches to split layout
4. Layout fades in
5. Plays `ACT1_WARMUP_LINES` via `playSentenceSequence()`:
   - "I'm going to walk you through some workplace situations now."
   - "For each one, I'll describe what's happening and ask how you'd handle it."
   - "There's no single right answer — I'm interested in how you think through these kinds of problems. Let's start with the first one."
6. `sendMessage("[BEGIN_ASSESSMENT]")` — triggers first scenario via engine

---

## Flow 5: Act Transitions (Scripted, No AI)

### Act 1 → Act 2

**Trigger:** `sendMessage()` response returns JSON with `data.type === "transition"` and `data.to.act === "ACT_2"`.

**File:** `src/stores/chat-assessment-store.ts:399-416`

Store sets `currentAct` → `"ACT_2"`, which triggers:

**File:** `src/components/assessment/stage/assessment-stage.tsx:823-844`

`useEffect` detects `currentAct` changed from `"ACT_1"` to `"ACT_2"` → calls `handleTransition1to2()`.

**File:** `src/components/assessment/stage/assessment-stage.tsx:532-574`
**Function:** `handleTransition1to2()`

1. `orchestratorPhase` → `"TRANSITION_1_2"`
2. `isTransitioning` → `true`
3. `referenceCard` → `null` (clears scenario card)

**Builds transition lines** from `buildTransition1to2()` (transitions.ts:68-87):

Line 1: *"You handled those scenarios well. Now we're going to shift gears."*
- `onStart`: orb compresses to `COMPACT` size

Line 2: *"I'm going to present you with a series of problems — some timed, some not."*
- `onStart`: act label crossfade

Line 3: *"Take your time where you can."*
- `onComplete`: sets `orchestratorPhase` → `"ACT_2"`, `isTransitioning` → `false`, starts Act 2 nudge

4. `playTransitionScript(lines)` — plays each line through TTS with callbacks
5. `sendMessage("[BEGIN_ACT_2]")` — triggers first Act 2 construct via engine

### Act 2 → Act 3

**File:** `src/components/assessment/stage/assessment-stage.tsx:576-621`
**Function:** `handleTransition2to3()`

Same pattern. Builds from `buildTransition2to3()` (transitions.ts:92-115):

Line 1: *"We're in the final stretch now..."*
- Orb expands, interactive elements cleared

Line 2: *"This last part is more reflective — there are no right or wrong answers here."*
- Act label crossfade

Line 3: *"Let's wrap things up."*
- Sets `orchestratorPhase` → `"ACT_3"`, starts Act 3 nudge

Then `sendMessage("[BEGIN_ACT_3]")`.

### Assessment Completion

**Trigger:** `isComplete` → `true` in store.

**File:** `src/components/assessment/stage/assessment-stage.tsx:623-647`
**Function:** `handleCompletion()`

1. `orchestratorPhase` → `"COMPLETING"`
2. Builds from `buildCompletionScript()` (transitions.ts:120-139):

Line 1: *"That's everything, {name}. Thank you for your time..."*
- `onStart`: orb settles (idle mode)

Line 2: *"Your results will be reviewed by the hiring team..."*
- `onComplete`: subtitles fade out, completion screen appears
- After 2s delay: `POST /api/assess/{token}/complete` (triggers scoring pipeline)
- After 4s: redirect to `/assess/{token}/survey`

**Server-side transition persistence:**

**File:** `src/app/api/assess/[token]/chat/route.ts:483-519`

For `action.type === "TRANSITION"`:
1. Persists transition message as `ConversationMessage` with `metadata: { transition: true, from, to }`
2. `computeStateUpdate()` resets: `currentScenario: 0, currentBeat: 0, currentConstruct: null, currentPhase: null`
3. Records per-act completion timestamps (`act1CompletedAt`, `act2CompletedAt`, `act3CompletedAt`)

---

## Flow 6: Nudge / Silence Detection

### Step 1: Nudge timers start

**File:** `src/components/assessment/stage/assessment-stage.tsx:426-458`
**Function:** `startNudgeForCurrentAct()`

Called after:
- TTS finishes playing (Flow 1 Step 27, line 813)
- Interactive element appears (line 857)
- Act transition completes (lines 551, 598)

Maps current act to `NudgeContext`:
- `"ACT_1"` → `"act_1"` — thresholds: 30s / 55s / 90s
- `"ACT_2"` → `"act_2"` — thresholds: 15s / 30s / 45s
- `"ACT_3"` → `"act_3"` — thresholds: 25s / 50s / 75s

### Step 2: NudgeManager sets timers

**File:** `src/lib/assessment/nudge-system.ts:37-61`
**Function:** `NudgeManager.start(context, callbacks)`

Clears previous timers, creates 3 `setTimeout()` calls:
- `setTimeout(onNudge("first"), first * 1000)`
- `setTimeout(onNudge("second"), second * 1000)`
- `setTimeout(onNudge("final"), final * 1000)`

### Step 3: First nudge (supportive)

**File:** `src/lib/assessment/nudge-system.ts:117-123`

Text per context:
- `act_1`: "Take your time — there's no rush. I'm here whenever you're ready."
- `act_2`: "No pressure — take a moment if you need it."
- `act_3`: "Take your time to reflect. There's no rush."

**Delivery** (assessment-stage.tsx:446): `playSegmentTTS(NUDGE_FIRST[ctx])` — spoken through TTS with word reveal.

### Step 4: Second nudge (text fallback offer)

**File:** `src/lib/assessment/nudge-system.ts:126-131`

Switches input mode to text: `s.setInputMode("text")`.

Text per context:
- `act_1`: "Take your time — when you're ready, tap the microphone or type your thoughts."
- `act_2`: "You can type your answer if that's easier."
- `act_3`: "Feel free to type your thoughts if you'd prefer."

### Step 5: Final nudge (auto-advance)

**File:** `src/lib/assessment/nudge-system.ts:134-139`

Text per context:
- `act_1`: "I'll move us along, but we can revisit this if you'd like."
- `act_2`: "Let's continue with the next question."
- `act_3`: "Let's keep going."

After TTS plays: `sendMessage("[NO_RESPONSE]")` — sends a sentinel that the engine treats as "no real response."

**Engine handling of `[NO_RESPONSE]`:** The sentinel matches `/^\[.+\]$/`, so `isSentinel = true` and `hasRealCandidateMessage = false`. The engine treats it as if the candidate hasn't responded and advances accordingly (typically serves the next beat/element).

### Step 6: Nudge cancellation

Nudge timers are cancelled when:
- Candidate speaks or types: `nudgeRef.current.stop()` (line 906 in `handleVoiceTranscript`, line 955 in `handleTextSend`)
- TTS starts playing: nudge callback guards check `s.isTTSPlaying` (line 443)
- Transition begins: `nudgeRef.current.pause()` (line 408 in `playTransitionScript`)
- Phase 0: nudges don't start for Phase 0 (handled separately with mic nudge timers)

### Phase 0 Mic Nudges (separate system)

Phase 0 uses its own nudge timers (not `NudgeManager`):

**File:** `src/components/assessment/stage/assessment-stage.tsx:765-774`

- **15s:** `playSegmentTTS(MIC_NUDGE_15S)` — "Take your time. If your microphone isn't cooperating, you're welcome to type."
- **30s:** Switches to text mode + `playSegmentTTS(MIC_NUDGE_30S)` — "No problem at all — let's switch to typing."

No auto-advance at 45s for Phase 0 — waits indefinitely for mic check response (the candidate must provide some response to proceed).

---

## Cross-Cutting Concerns

### Request ID Correlation

Every POST to chat route generates `requestId = crypto.randomUUID().slice(0, 8)` (line 38), passed to `createLogger("chat-route", requestId)`. All log entries in that request share the same ID.

### Optimistic Concurrency

`updateStateOptimistic()` (line 163-169) uses `updatedAt` timestamp as version check. Returns `count: 0` on conflict (another request modified state first). Currently used for state reads but not consistently enforced on all writes.

### Rate Limiting

Three rate limit buckets per token:
- `chat:{token}` — `RATE_LIMITS.assessmentChat` (chat POST)
- `chat-get:{token}` — 20/min hardcoded (chat GET)
- `tts:{token}` — `RATE_LIMITS.tts` (TTS POST)

All in-memory (per-isolate in serverless). See Audit architecture plan Phase 3.4 for Redis upgrade.

### Error Recovery

| Layer | Error | Recovery |
|-------|-------|----------|
| TTS fetch fails | Returns `null` from `fetchAndDecodeChunk` | First chunk null → SpeechSynthesis fallback. Subsequent chunk null → skipped |
| AudioContext suspended | `speakFallback()` | Uses browser `SpeechSynthesisUtterance` with estimated duration |
| Classification fails | catch at line 392 | Logs warning, proceeds with existing state (ADEQUATE default) |
| Acknowledgment fails | `.catch()` at line 344 | Returns empty string, pre-gen content served without bridge sentence |
| Streaming fails | catch at line 789 | Returns 502 JSON with Sentry capture |
| sendMessage fails | catch at line 521 | Shows error toast via `mapApiError()`, removes failed assistant message |
| sendElementResponse fails | Retry 3x with backoff | After exhaustion: shows error, resets `activeElement.responded` to false |
| Content library lookup fails | catch at lines 542, 639 | Falls through to streaming path |

### State Machine Summary

```
PHASE_0 → TRANSITION_0_1 → ACT_1 → TRANSITION_1_2 → ACT_2 → TRANSITION_2_3 → ACT_3 → COMPLETING → done
```

Server-side `currentAct`: `"PHASE_0"` → `"ACT_1"` → `"ACT_2"` → `"ACT_3"`
Client-side `orchestratorPhase`: matches above with transition phases interleaved.

Transitions are client-orchestrated (TTS narration with visual callbacks). The server stores `currentAct` only — transitions happen between client state changes.

---

## Key Files Reference

| File | Role in Request Flow |
|------|---------------------|
| `src/components/assessment/stage/assessment-stage.tsx` | Client orchestrator — Phase 0, transitions, TTS trigger, nudges, input handlers |
| `src/stores/chat-assessment-store.ts` | State management — sendMessage, sendElementResponse, displayMessage |
| `src/app/api/assess/[token]/chat/route.ts` | Server orchestrator — validation, classification, content serving, streaming |
| `src/lib/assessment/engine.ts` | Pure function — getNextAction, computeStateUpdate, computeProgress |
| `src/lib/assessment/classification.ts` | Dual-evaluation classifier — STRONG/ADEQUATE/WEAK |
| `src/lib/assessment/generate-acknowledgment.ts` | Bridge sentence generator (~200ms) |
| `src/lib/assessment/content-serving.ts` | Content library loading, variant selection, beat lookup |
| `src/lib/assessment/parse-scenario-response.ts` | Output parser — cleanText, splitSentences, reference extraction |
| `src/components/assessment/voice/tts-engine.ts` | Client TTS — ElevenLabs audio, pipelined playback, amplitude extraction |
| `src/app/api/assess/[token]/tts/route.ts` | Server TTS proxy — ElevenLabs API, rate limiting |
| `src/lib/assessment/phase-0.ts` | Phase 0 segment definitions |
| `src/lib/assessment/transitions.ts` | Transition scripts with visual callbacks |
| `src/lib/assessment/nudge-system.ts` | Silence detection — thresholds, escalation, nudge messages |
| `src/lib/assessment/adaptive-loop.ts` | Act 2 item selection — 4-phase adaptive algorithm |
| `src/lib/assessment/scenarios/index.ts` | 4 scenario shells with 6 beats each |
| `src/lib/assessment/config.ts` | AI_CONFIG, FEATURE_FLAGS, ASSESSMENT_STRUCTURE |

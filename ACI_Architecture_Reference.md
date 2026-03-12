# ACI Assessment System — Component Architecture Reference

**Prepared for:** Engineers and non-technical stakeholders
**Codebase:** ACI (Arklight Cognitive Index) — Next.js 15, Prisma, Supabase, Vercel
**Last updated:** March 2026

---

## How to Use This Document

This reference covers every major component of the ACI assessment system. Each section is written in two registers simultaneously: precise enough that an engineer can use it as a coding guide, and accessible enough that a non-technical CEO can understand what the system is doing and why it was built this way. Wherever a component has known bugs or gaps, those are noted explicitly in the "Current State" section at the end.

The assessment itself has three acts. Phase 0 is a warm-up. Act 1 is the Scenario Gauntlet: four workplace situations, each with six conversational beats. Act 2 is the Precision Gauntlet: five structured ability constructs measured with adaptive item selection. Act 3 is Calibration and Consistency: re-verification items, parallel scenarios for cross-referencing, and a reflective self-assessment. All of this is orchestrated by the components described below.

---

## A. The State Machine (Engine)

### What It Is

The engine is the brain of the assessment. It sits at `src/lib/assessment/engine.ts` and contains a single exported function, `getNextAction()`, that takes the current assessment state and the candidate's last message and returns a precise instruction for what should happen next. That instruction might be "generate an agent message," "present this interactive element," "transition to the next act," or "end the assessment." Nothing else in the system makes structural decisions about what comes next — that responsibility is entirely centralized here.

To a non-technical reader: the engine is like a stage director who always knows which actor should speak next, what they should say, and when to ring the curtain on a scene. The director doesn't improvise — they work from a script template, but fill in the details based on what the candidate actually did.

### How It Works (Internal Mechanics)

`getNextAction()` dispatches to one of three act-level functions — `getAct1Action()`, `getAct2Action()`, `getAct3Action()` — based on `state.currentAct`. Within each act, the function reads state fields (`currentScenario`, `currentBeat`, `act2Progress`, `act3Progress`) to determine precisely where in the sequence the candidate is.

The engine returns one of four action types:

- **`AGENT_MESSAGE`**: Instructs the chat route to call the LLM and stream a response. Contains a `systemPrompt` (full Aria persona and beat context), a `userContext` (the templated instruction for what this particular beat should produce), and `metadata` (scenario index, beat index, construct tags for scoring).
- **`INTERACTIVE_ELEMENT`**: Instructs the client to render a structured element (multiple choice, numeric input, confidence rating, or timed response). Contains the item data directly — no LLM call needed.
- **`TRANSITION`**: Instructs the system to advance to the next act. Contains a `transitionMessage` for Aria to speak and a `from`/`to` structure for state tracking.
- **`COMPLETE`**: Signals end-of-assessment, triggers the scoring pipeline.

The sentinel detection pattern is important: the engine recognizes special-format messages like `[BEGIN_ASSESSMENT]`, `[NO_RESPONSE]`, `[BEGIN_ACT_2]`, and `[BEGIN_ACT_3]` by the regex `/^\[.+\]$/`. These control signals allow the frontend to trigger specific engine paths without sending real text into the conversation history.

**Act 1 prompt architecture**: Beat 0 (INITIAL_SITUATION) instructs the LLM to produce 4–5 narrative sentences followed by a `---REFERENCE---` JSON block containing the scenario reference card. Beats 1–5 produce 1–2 sentences plus an optional `---REFERENCE_UPDATE---` JSON block. The system prompt specifies exact output format, beat type, construct tags, and the branch path from the preceding classification. `buildBeatPrompt()` selects the branch script based on `lastClassification ?? "ADEQUATE"`, so the narrative content actively adapts to how well the candidate responded.

**Act 2 orchestration**: The engine calls `getNextItem()` from the adaptive loop module to determine the next structured item. If the adaptive loop signals a phase is complete, the engine handles the diagnostic probe transition by generating an AGENT_MESSAGE instructing Aria to ask a reflective question. The engine tracks which construct is being measured and advances to the next once all phases are complete.

**Act 3**: Serves confidence-tagged items (re-presents Act 2 items), two parallel scenario paths, and the final reflective self-assessment. The off-by-one bug in the confidence item counter (described in Current State) lives in this section.

`computeStateUpdate()` is the companion to `getNextAction()`. While `getNextAction()` determines what comes next, `computeStateUpdate()` persists the outcome of what just happened — updating `currentBeat`, `currentScenario`, `act2Progress`, and so on. These two functions together implement the state machine pattern.

### How It Connects to Other Components

The engine is called by the chat route (`src/app/api/assess/[token]/chat/route.ts`) on every POST request. It receives `state` (a `AssessmentState` database record), `messages` (the full conversation history), and `lastCandidateMessage` as a string. The engine does not call any database — all I/O is handled by the chat route. The engine imports `SCENARIOS` from the scenarios module and `ASSESSMENT_STRUCTURE` from config. It calls `getNextItem()` and `initLoopState()` from the adaptive loop module.

### How the Candidate Experiences It

Candidates never see the engine directly. They experience its decisions as Aria's responses feeling contextually appropriate — the narrative progresses logically, the interactive elements appear at the right moments, and the assessment ends when all evidence has been gathered. The engine's quality shows up in whether transitions feel natural or abrupt, and whether Aria's responses reflect what the candidate actually said.

### Architecture Decisions and Trade-offs

The decision to make the engine a pure function (no I/O, no side effects) was deliberate. It makes the engine testable in isolation: you can pass any state and any message and verify the output without a database. The trade-off is that the chat route becomes responsible for all I/O orchestration, which makes the route handler complex.

The separation of `getNextAction()` and `computeStateUpdate()` follows the command/query separation principle. `getNextAction()` reads; `computeStateUpdate()` writes. This means the engine can be called speculatively for inspection without risk of corrupting state.

The inter-scenario transitions use `AGENT_MESSAGE` with `metadata.transition: true` rather than the formal `TRANSITION` action type. This was a practical choice — generating a warm 1–2 sentence bridge to the next scenario requires LLM output, which TRANSITION doesn't support. The trade-off is that these transitions aren't as visually distinct as act transitions, and the metadata flag must be explicitly checked by the frontend.

### Current State (Bugs, Gaps, What's Solid)

**Solid:** The act routing logic, beat progression, sentinel detection, and prompt construction are all well-implemented. The engine has been the most stable component in the system.

**Bug (Act 3 off-by-one):** The confidence item counter in `getAct3Action()` is incremented when the CONFIDENCE_RATING element is dispatched rather than when the response is received back. This means the counter reads "3 items served" when only 2 responses have been received, causing the engine to advance past the confidence phase one item early. The fix is to increment the counter in `computeStateUpdate()` when the element response is processed.

**Gap (Aria persona):** The system prompts instruct Aria on format (sentence count, no markdown) but not on personality. There is no persona block saying "you are warm, curious, never evaluative, never say Certainly." This causes Aria to occasionally produce hollow affirmations or clinical language that breaks the conversational feeling. The fix is a persona block at the top of every system prompt.

---

## B. The Adaptive Loop

### What It Is

The adaptive loop is the algorithm that runs Act 2. It lives at `src/lib/assessment/adaptive-loop.ts` and implements a miniature adaptive test for each of five cognitive ability constructs: Quantitative Reasoning, Spatial Visualization, Mechanical Reasoning, Pattern Recognition, and Fluid Reasoning. The core insight driving its design is that the most informative items to give a candidate are the ones at the edge of what they can do — too easy, and you learn nothing; too hard, and the same. The loop systematically hunts for that edge.

To a non-technical reader: think of a librarian who needs to understand your reading level. Rather than giving you a standardized test, they first try an easy book, a medium book, and a hard book to get a rough sense (calibration). Then they narrow in, trying books just above and just below what seems to be your limit. Finally, they try one from a completely different genre at the same difficulty level to confirm the pattern isn't genre-specific. Then they ask you about it conversationally.

### How It Works (Internal Mechanics)

Each construct gets its own `AdaptiveLoopState`, initialized by `initLoopState()`. The state records the current phase, all item results by phase (calibration, boundary, pressure), any probe exchanges, the current boundary estimate, and the full list of items served.

**Phase 1 — CALIBRATION (2–3 items):** Items are served at three fixed difficulty windows: easy (0.15–0.35), medium (0.40–0.60), and hard (0.65–0.85). The goal is rapid placement — getting a rough sense of ability with minimal items. Early exit after 2 items is possible if the candidate misses an easy item (difficulty < 0.3), since that already signals placement below the midpoint. After calibration completes, the loop transitions to Boundary Mapping.

**Phase 2 — BOUNDARY_MAPPING (3–5 items):** This phase implements binary search. After each item result, `computeBoundary()` is called on all results so far. The boundary estimate is the midpoint between `confirmedFloor` (highest difficulty they got correct) and `confirmedCeiling` (lowest difficulty they got wrong). The next item is selected at the midpoint ± 0.10, progressively narrowing the window. Transition to Pressure Test occurs when boundary confidence reaches 0.7 or five items have been served.

Confidence is computed as: `confidence = dataConfidence × gapConfidence`. Data confidence scales from 0 to 1 over 6 items. Gap confidence is 1.0 if the floor-to-ceiling gap is under 0.30, 0.6 if under 0.50, and 0.3 otherwise. A narrow gap with few items still needs more data; many items with a wide gap are similarly inconclusive.

**Phase 3 — PRESSURE_TEST (2–3 items):** Items are served near the estimated boundary but from a different `subType` than previously seen — testing from a different angle. If 70%+ of pressure test items are answered correctly, the boundary estimate was too conservative (they're stronger than thought), and the loop loops back to Boundary Mapping. If 30% or fewer are correct, the boundary is confirmed. Ambiguous results (30–70%) trigger one more item, up to the 3-item maximum.

**Phase 4 — DIAGNOSTIC_PROBE:** No structured items are served. The engine instead triggers Aria to ask a conversational question about what the candidate found difficult. The candidate's response is recorded as a probe exchange. This feeds Layer C ceiling characterization during scoring.

**`computeAdaptiveScore()`** produces a raw score from all calibration + boundary + pressure results. Each item is weighted by difficulty: `weight = 1 + (difficulty - 0.5) × 0.3`, so a difficulty-0.9 item carries about 15% more weight than a difficulty-0.5 item. The score is weighted accuracy (correct items' weighted sum / total weighted sum).

### How It Connects to Other Components

The adaptive loop is consumed by the engine (`getAct2Action()` calls `getNextItem()` and `recordResult()`) and by the scoring pipeline (`computeAdaptiveScore()` is called during pipeline step 6 to produce the effective Layer A score when no formal item responses exist). The item bank provides the candidate pool. The diagnostic probe module (`diagnostic-probe.ts`) processes the qualitative Phase 4 exchanges.

### How the Candidate Experiences It

Candidates see Act 2 as a series of focused problem-solving questions. They don't see the phases — they just notice that questions get harder when they're doing well and easier when they struggle. The construct boundaries are invisible. The diagnostic probe appears as a natural conversational moment: Aria asks what was going through their mind on the hardest question. Candidates who are comfortable reflecting on their own thinking provide rich Layer C data.

### Architecture Decisions and Trade-offs

The loop is implemented as pure functions operating on an immutable `AdaptiveLoopState` object. Each call to `recordResult()` returns a new state rather than mutating in place. This follows functional programming principles and makes the loop easy to test: any state can be replicated exactly.

The confidence formula was tuned to balance speed (exit early with high confidence) against accuracy (require enough items to trust the estimate). The threshold of 0.7 was chosen to allow exit after 3–4 items when a candidate's performance is consistent, while requiring up to 5 items when performance is mixed.

One important design decision: the loop can loop back from Pressure Test to Boundary Mapping if the boundary is contradicted. This adds up to 3 items but improves accuracy on candidates who perform inconsistently. The loop-back also resets `boundary` to null, forcing recomputation from all accumulated data.

### Current State

**Solid:** The boundary detection algorithm is well-implemented and mathematically sound. Phase transitions, loop-back logic, and item selection are all correct. The confidence scoring formula appropriately balances data quantity and boundary precision.

**Gap (Pressure Test item diversity):** The pressure test explicitly seeks items with a different `subType` to test from "a different angle." In practice, the item bank has limited subType diversity at some difficulty levels, so this often falls back to any unserved item near the boundary. Adding more subType variety to the item bank would improve this.

**Gap (Construct ordering):** Act 2 processes constructs in a fixed order defined in `ASSESSMENT_STRUCTURE.act2Constructs`. There is no adaptive ordering based on relative construct difficulty or candidate performance patterns. An improvement would be to serve the construct where boundary detection is most uncertain first.

---

## C. The Scoring Pipeline

### What It Is

The scoring pipeline is the offline processing step that runs after a candidate completes the assessment. It lives at `src/lib/assessment/scoring/pipeline.ts` and implements 13 sequential steps that transform raw conversation data and item responses into a comprehensive cognitive profile: per-construct percentile scores, composite index, cutline evaluation, predictions, red flags, and candidate status. It is not a simple formula — it is a multi-layer evidence synthesis that combines deterministic correctness scoring, AI-evaluated behavioral rubric scoring, and qualitative ceiling characterization into a single coherent picture.

To a non-technical reader: once the interview is over, the scoring pipeline is the analyst who reviews all the recordings, applies systematic rubrics, checks for inconsistencies, and writes the final report. The report goes to the hiring team within minutes of the assessment ending.

### How It Works (Internal Mechanics)

**Step 1 — Data Fetch:** Loads the assessment with all messages, the assessment state (which contains the Act 2 adaptive loop progress as a JSON field), the candidate's role, and all item responses. Phase 0 messages are immediately filtered out — they are warmup material and contain no assessable content.

**Step 2 — Layer A (Deterministic Scoring):** Processes Act 2 and Act 3 structured item responses. Each item response is matched against the item bank entry by `itemId`. Binary correctness (response === correctAnswer) is scaled by a difficulty multiplier: `score = 1 × (1 + (difficulty - 0.5) × 0.3)`. A difficulty-0.9 item awarded correctly scores 1.12; a difficulty-0.2 item scores 0.85. Aggregation normalizes by the maximum possible score for that item set, producing a per-construct proportion in [0, 1].

If no formal item responses exist (the adaptive loop data is in `act2Progress` rather than the `itemResponses` table), `computeAdaptiveScore()` is used as the effective Layer A score.

**Step 3 — Layer B (AI Rubric Scoring):** For each construct, the pipeline identifies the candidate messages that are relevant to that construct. Relevance is determined by metadata on the preceding agent message — each agent turn is tagged with `primaryConstructs` and `secondaryConstructs` at generation time. The pipeline scans backward from each candidate message to find the preceding agent message and extracts these tags.

For each relevant candidate message, `evaluateResponse()` is called. This function runs three parallel calls to Claude Haiku (temperature 0.3, 0.4, 0.5 respectively for variation), each evaluating the response against the construct's 3–5 behavioral indicators. Each indicator is binary: present (1) or absent (0). The aggregate score for one run is `present_count / indicator_count`. The three run scores are sorted; the median run is selected. Standard deviation across runs is computed; if SD > 0.3 (the high-variance threshold), the score is flagged and downweighted by 0.5× in aggregation.

The concurrency limit of 6 prevents API rate exhaustion when a candidate has many relevant messages.

**Step 4 — Layer C (Ceiling Characterization):** Calls `classifyCeiling()` for each construct that reached the DIAGNOSTIC_PROBE phase with at least one probe exchange. This produces a qualitative classification: HARD_CEILING, SOFT_CEILING_TRAINABLE, SOFT_CEILING_CONTEXT_DEPENDENT, STRESS_INDUCED, or INSUFFICIENT_DATA. Layer C does not produce a numeric score — it produces narrative and prediction inputs.

**Step 5 — Consistency Validation:** Compares Layer B scores between Act 1 and Act 3 for each construct. If the scores differ by more than 0.15 (the `consistencyThreshold`), a consistency flag is raised and the construct score is downweighted by 0.75× in final aggregation. This catches cases where a candidate performed well in Act 1 scenarios but poorly on the same construct's parallel scenarios in Act 3 (or vice versa), which suggests either test anxiety effects, inconsistent effort, or lucky patterning.

**Step 6 — Construct Aggregation:** Combines Layer A (55% weight), Layer B (45% weight), consistency adjustment, and ceiling type into a final per-construct raw score. The aggregation is not a simple weighted average — it also factors in item count and response count to handle cases where one layer has minimal data. `aggregateConstructScore()` in `aggregation.ts` handles these edge cases.

**Steps 7–9 — SubtestResults, Composites, Cutlines:** Upserts a `SubtestResult` record per construct (scoringVersion=2), then calls the existing `calculateComposite()` and `evaluateCutline()` functions from `src/lib/scoring.ts`. These reuse battle-tested composite weight logic tied to role-specific `CompositeWeight` and `Cutline` database records. For generic roles, `computeRoleFitRankings()` generates cross-role composite scores.

**Step 10 — Red Flags:** `detectRedFlags()` runs 12+ checks across construct scores, messages, consistency results, and Layer B scores. Flags include: construct score below threshold for role, high Layer B variance across multiple constructs, significant Act 1/Act 3 inconsistency, very short response patterns, and sentinel message patterns suggesting gaming.

**Steps 11–13 — Predictions, Status, Candidate Update:** Generates four predictions (ramp time, supervision load, performance ceiling, attrition risk) using rule-based logic from `predictions.ts`. Calls `determineStatus()` with composite pass/fail and red flag data. Updates `candidate.status` in the database.

### How It Connects to Other Components

The pipeline is invoked by the `POST /api/assess/[token]/complete` route handler after the assessment state is marked `isComplete`. It reads from `assessmentState.act2Progress` (the adaptive loop state), `itemResponses`, and `messages`. It writes to `SubtestResult`, `CompositeScore`, `RedFlag`, `Prediction`, `AIEvaluationRun`, and `Candidate.status`. The `AIEvaluationRun` table preserves every Layer B raw output for audit purposes.

### How the Candidate Experiences It

The pipeline is invisible to candidates. They complete the assessment and are redirected to a survey. Pipeline output is surfaced in the hiring team's profile view — the percentile spider chart, predictions block, and red flag summary all come from pipeline output.

### Architecture Decisions and Trade-offs

The decision to run Layer B as three parallel calls rather than one was driven by measurement reliability. A single LLM call produces variance — the same response might score 0.60 on one call and 0.45 on another. Three calls with median selection reduces this variance significantly. The downweight mechanism for high-variance responses is an additional reliability safeguard.

The 55/45 default weighting of Layer A vs. Layer B reflects a philosophical position: deterministic correctness data (Layer A) is more reliable than AI rubric scoring (Layer B), so it carries more weight. However, some constructs — particularly those in the behavioral layer like METACOGNITIVE_CALIBRATION — have no Layer A items, so Layer B carries 100% of their weight.

`ASSESSMENT_TEST_MODE=true` swaps the generation model to Haiku (from Sonnet) and reduces `evaluationRunCount` to 1 (from 3). This cuts costs by approximately 20× for development testing, at the cost of lower scoring quality. The test mode flag also applies to content generation but not to real-time interactions (classification and acknowledgment always use Haiku regardless).

### Current State

**Solid:** All 13 steps are implemented with real logic. The three-layer scoring architecture, consistency validation, and red flag detection are well-designed. The AIEvaluationRun audit trail is thorough.

**Gap (Act 3 parallel scenario scoring):** Act 3 serves two parallel scenarios (same rubric, different domain content) for Act 1 vs. Act 3 cross-validation. The scenarios are served correctly, but the pipeline's consistency validation currently compares Layer B scores from the full Act 1 and Act 3 message pools without specifically isolating the parallel scenario responses. The intended comparison is tighter — the parallel scenarios should directly mirror Act 1 scenario 2 and scenario 4 constructs for a clean cross-validation signal.

**Gap (Token cost logging):** Token usage is tracked per Layer B run but not surfaced as a first-class metric. Cost awareness requires querying `AIEvaluationRun` manually.

---

## D. The Classification System

### What It Is

The classification system sits at `src/lib/assessment/classification.ts` and solves a critical problem: after a candidate responds to an Act 1 beat, the engine needs to know whether the response was strong, adequate, or weak so it can select the right narrative branch for the next beat. This classification decision happens in real time — the candidate is waiting. And it needs to be reliable, because a wrong classification leads to Aria delivering the wrong narrative, which feels jarring and can misrepresent the candidate's capability in subsequent turns.

To a non-technical reader: the classification system is a fast, careful judge who reads what the candidate said and gives it one of three ratings — impressive, acceptable, or thin — so that Aria knows how to respond. The system double-checks its own judgment by making the call twice and comparing.

### How It Works (Internal Mechanics)

`classifyResponse()` takes the candidate's response text, the current scenario and beat template, conversation history, and role context. It builds a classification prompt and fires two parallel AI calls to Claude Haiku (not three — unlike Layer B, classification uses dual evaluation for speed).

**Prompt structure:** The prompt provides: scenario name and beat type, role context if non-generic, conversation history (sanitized), the candidate response in a `<candidate_response>` XML tag, rubric indicators (each with positive and negative criteria), and branch scripts for all three classifications. The output is a JSON object containing classification, indicator presence/absence list, rubricScore (0–1), constructSignals, and branchRationale.

**Agreement logic:** If both calls return the same classification, the one with the higher rubricScore is used (richer evidence). If they disagree, the one with the lower rubricScore is used (conservative). This is a deliberate bias toward caution: the system is more willing to underestimate than overestimate. An ADEQUATE-flagged candidate who was actually STRONG will still receive a thoughtful branch narrative; a STRONG-flagged candidate who was actually ADEQUATE might receive a narrative that creates unrealistic expectations in the assessment context.

**Fallback behavior:** If both API calls fail, `fallbackClassification()` returns ADEQUATE (or WEAK if the response is fewer than 10 words). It never returns STRONG from fallback, because STRONG should require active confirmation, not assumption.

**Prompt injection prevention:** The classification prompt sanitizes history using `sanitizeHistory()`, which strips XML-like tags, caps each line to 500 characters, and caps total history to 4000 characters. The candidate response is wrapped in `<candidate_response>` XML tags, and the `</candidate_response>` closing tag is HTML-entity-encoded within the response text itself to prevent injection escape.

### How It Connects to Other Components

Classification is called by the chat route after every candidate message in Act 1. The resulting `ClassificationResult` (especially `classification` and `constructSignals`) is stored on the conversation message's metadata field. The engine's `buildBeatPrompt()` reads `lastClassification` from state to select the branch script. The scoring pipeline does not re-run classification — it uses the stored `constructSignals` from the original call as part of the `msgConstructMap` for Layer B.

### How the Candidate Experiences It

Candidates don't see classification. They see Aria's response, which branches based on it. A STRONG response gets a narrative that leans into the candidate's specific reasoning. A WEAK response gets a more guiding narrative that introduces what was missed. Done well, this feels like natural conversation; done poorly (with generic branches), it feels formulaic.

### Architecture Decisions and Trade-offs

Dual evaluation (2 calls) rather than triple (3 calls) was a latency trade-off. Classification needs to complete before Aria can begin streaming her response, so it sits on the critical path. Triple evaluation at classification latency would add 30–50% to perceived response time. Two calls with the conservative disagreement rule provides acceptable reliability within the latency budget.

The conservative disagreement rule (use the lower score on disagreement) was preferred over random selection or averaging because it biases toward honest representation of candidate performance. A candidate who genuinely produced an ambiguous response deserves the more thoughtful "adequate" branch rather than the affirming "strong" branch.

### Current State

**Solid:** The dual-evaluation pattern, agreement logic, fallback, and prompt injection prevention are all correctly implemented and have been stable.

**Gap (No calibration examples):** The classification prompt lists rubric indicators but provides no canonical examples of what STRONG, ADEQUATE, and WEAK look like for each beat type. Classification models are sensitive to anchoring — providing 2–3 concrete examples per beat type would significantly reduce inter-rater variance and improve classification accuracy. This is a P3 improvement that doesn't require structural change.

---

## E. The TTS Engine

### What It Is

The TTS (text-to-speech) engine converts Aria's streamed text into synchronized audio playback with real-time visual feedback. It is a client-side component that manages the full lifecycle of audio: requesting synthesis from ElevenLabs while text is still streaming, buffering the audio while it downloads, playing it back with gapless queuing, extracting amplitude data for the orb animation, and gracefully falling back to browser-native speech synthesis when ElevenLabs is unavailable.

To a non-technical reader: the TTS engine is what makes Aria sound human and makes the animated orb pulse with her voice. It has to handle a tricky problem: Aria starts speaking before she's finished thinking, because the text is generated word by word. The engine must be ready to play audio continuously without gaps, hiccups, or losing track of where in the transcript the audio is.

### How It Works (Internal Mechanics)

The TTS system splits Aria's streaming text into sentence-level chunks as they arrive from the server. Each sentence is sent to the ElevenLabs `/v1/text-to-speech/{voice_id}/stream` endpoint as an independent streaming request with `optimize_streaming_latency=4`. The audio chunks come back as binary PCM/MP3 data.

For playback, the engine uses the Web Audio API rather than HTML `<audio>` elements. Audio chunks are decoded via `AudioContext.decodeAudioData()` and queued as `AudioBufferSourceNode` instances scheduled with precise start times. This gapless scheduling eliminates the buffer gaps that HTML audio elements produce between segments. The source nodes are connected through an `AnalyserNode` which continuously extracts the frequency-domain amplitude data — the root-mean-square of the PCM samples every 16ms. This amplitude stream feeds the orb's animated ring pulse.

**Subtitle sync:** When playback begins on a sentence chunk, the engine calls `onPlaybackStart(sentenceIndex)`. The frontend uses this callback to advance the subtitle display by sentence, and the TTS engine estimates character-level timing using a `msPerWord` calculation based on the actual audio duration divided by word count.

**Fallback:** When ElevenLabs requests fail (no API key, rate limit, or network error), the engine falls back to `window.speechSynthesis.speak()`. The browser TTS produces no amplitude data, so the orb animation switches to a static idle state. Subtitles continue to advance based on the `msPerWord` estimation.

**Race condition protection (previously fixed):** A prior version of the TTS engine used a boolean guard (`isPlaying`) to prevent concurrent playback. Under rapid message succession, this caused silent drops — messages were discarded while the flag was true but no audio was actually playing. The fix replaced the boolean with a monotonic sequence counter. Each playback request is assigned an incrementing sequence number; any request with a stale sequence is dropped.

### How It Connects to Other Components

The TTS engine is instantiated inside `assessment-stage.tsx` and fed text from the Zustand store via the `onAssistantMessage` callback. The orb component subscribes to the amplitude data stream via a ref. The subtitle component subscribes to the `onPlaybackStart` callback. The nudge system's `pause()` and `resume()` calls must coordinate with TTS playback — nudge timers should only run while Aria is not speaking. This coordination is managed in `assessment-stage.tsx` through TTS lifecycle callbacks.

### How the Candidate Experiences It

When working correctly, the TTS creates the sensation of a real conversation: Aria's voice begins within about 400ms of her text appearing, the orb pulses naturally with her speech rhythm, and subtitles advance in sync with what she's saying. The candidate never has to wait for a full response to be generated before hearing it begin.

### Architecture Decisions and Trade-offs

The Web Audio API was chosen over HTML `<audio>` specifically for gapless playback and amplitude extraction. HTML audio elements have irreducible gaps between sequential playbacks (typically 50–200ms) that create a choppy cadence during multi-sentence responses. The Web Audio approach eliminates this entirely by scheduling source nodes with sub-millisecond precision.

The sentence-level chunking (rather than word-level or full-message-level) balances latency against synthesis quality. ElevenLabs produces more natural prosody with complete sentences than with single words, but waiting for the full message would delay audio onset by 2–4 seconds.

### Current State

**Solid:** The gapless Web Audio playback, amplitude extraction, fallback to SpeechSynthesis, and monotonic sequence counter are all working correctly.

**Gap (No amplitude data in fallback):** Browser TTS produces no amplitude events, so the orb goes static during fallback. A low-effort improvement would be a CSS animation that simulates voice pulse during browser TTS, rather than a static orb.

---

## F. The Scenarios

### What It Is

The scenarios module at `src/lib/assessment/scenarios/index.ts` contains the four workplace situation templates that constitute Act 1. Each scenario is a `ScenarioShell` — a structured narrative container with exactly six `BeatTemplate` entries. Each beat carries the situation description, the rubric indicators for scoring, and three branch scripts (STRONG/ADEQUATE/WEAK) that Aria uses to respond depending on how the candidate performed. The scenarios are the primary vehicle for measuring cognitive constructs through naturalistic, job-relevant situations.

To a non-technical reader: the scenarios are the roleplay situations — "you're a data analyst and your numbers don't add up" or "you're managing a team and a stakeholder is pushing back on your approach." Each situation has six chapters. After each chapter, Aria responds differently depending on how insightful your answer was.

### How It Works (Internal Mechanics)

Each `ScenarioShell` contains:
- A scenario name and premise (1–2 sentences of situational setup)
- Six `BeatTemplate` objects indexed 0–5
- Each beat specifies: `type` (INITIAL_SITUATION, COMPLICATION, TRADEOFF_SELECTION, SOCIAL_PRESSURE, CONSEQUENCE_REVEAL, REFLECTIVE_SYNTHESIS), `beatNumber`, `primaryConstructs` and `secondaryConstructs` arrays, `rubricIndicators` (3–5 indicators each with `positiveCriteria` and `negativeCriteria`), and `branchScripts` object with STRONG/ADEQUATE/WEAK narrative text

The beat types map to cognitive constructs deliberately. Beat 0 (INITIAL_SITUATION) primarily probes problem-recognition and information-seeking behavior. Beat 2 (TRADEOFF_SELECTION) probes decision-making under uncertainty. Beat 3 (SOCIAL_PRESSURE) probes resistance to normative pressure while maintaining analytical rigor. Beat 5 (REFLECTIVE_SYNTHESIS) probes metacognitive calibration — can the candidate accurately identify what they got right and wrong?

**Branch scripts:** The STRONG branch affirms the candidate's approach and deepens the complication. The ADEQUATE branch acknowledges the response and introduces the next element neutrally. The WEAK branch provides a gentle redirect — "here's what happened next, even though..." — without directly correcting. The engine's `buildBeatPrompt()` passes the appropriate branch script to the LLM as the narrative template to follow.

### How It Connects to Other Components

The scenarios are imported by the engine (for beat access and prompt construction), the classification system (for rubric indicator access), the content generation module (for generating content library variants), and the chat route (for scenario indexing). The `SCENARIOS` array is imported directly — scenarios are a static data structure, not a database resource.

### How the Candidate Experiences It

Act 1 feels like a conversation with an investigator who is presenting workplace situations and asking "what would you do?" The candidate never sees rubric indicators or construct labels. They see a scenario unfold through Aria's narration, accompanied by a reference card that fills in visual details. The branching means that two candidates taking the same scenario will have meaningfully different conversation paths if their responses diverge.

### Architecture Decisions and Trade-offs

Hardcoding scenarios as static TypeScript data rather than database records was a deliberate choice for reliability and simplicity. Scenarios change infrequently and are used by every assessment — a database query on every chat request would add latency with no benefit. The trade-off is that modifying scenarios requires a code deployment.

### Current State

**Solid:** The four scenario shells are well-designed, with meaningful rubric indicator coverage across constructs and realistic workplace premises.

**Gap (Branch scripts are static templates):** The branch scripts do not reference what the candidate said in prior beats. Beat 3's STRONG branch might say "You've identified the conflicting priorities — now a stakeholder is pushing back" regardless of whether the candidate's Beat 1 response was specifically about conflicting priorities. This creates the feeling that Aria isn't listening to earlier answers. The fix requires the LLM to weave prior-beat specifics into the branch narrative, which requires an instruction in the system prompt.

---

## G. The Item Bank

### What It Is

The item bank at `src/lib/assessment/item-bank.ts` is the repository of structured cognitive ability items used in Act 2. It contains 86 items across five constructs, each calibrated on a 0–1 difficulty scale and assigned to a 1–5 difficulty level. Items are the raw material for the adaptive loop — the pool from which items are selected during boundary detection. They represent the most traditional psychometric component of the assessment: standardized problems with objectively correct answers.

To a non-technical reader: the item bank is the question library. Unlike the scenario conversations where there's no single right answer, the item bank contains precisely calibrated problems with one correct answer — math problems, spatial reasoning puzzles, mechanical physics questions — that tell us exactly how far a candidate can go in each ability domain.

### How It Works (Internal Mechanics)

Each `Act2Item` contains:
- `id`: unique string identifier (e.g., "qr-h3")
- `construct`: one of five `Construct` enum values
- `subType`: the specific problem type within the construct (e.g., "arithmetic", "rotation", "levers")
- `difficulty`: float in [0, 1] — calibrated position on the ability scale
- `difficultyLevel`: integer 1–5 for human readability
- `prompt`: the problem text, including all options for multiple-choice items
- `elementType`: `NUMERIC_INPUT` or `MULTIPLE_CHOICE_INLINE`
- `correctAnswer`: string (number as string for numeric, letter for MC)
- `options`: array of choice labels for multiple-choice items
- `timingExpectations`: `{ fast, typical, slow }` in milliseconds — used to compute response time z-scores
- `imageUrl`: string (empty for all spatial items — a known gap)

**Difficulty calibration:** The five difficulty bands are: easy (0.15–0.35), medium-easy (0.40–0.55), medium-hard (0.55–0.65), hard (0.70–0.80), very hard (0.85–0.90). Coverage is highest in the medium range and thinner at extremes, which is appropriate — most candidates cluster near the middle. Each construct has 15–20 items.

**`getAvailableItems(construct, minDiff, maxDiff, served)`:** Returns items within the difficulty range that haven't been served yet. Used by the adaptive loop's item selection functions. If the difficulty window is too narrow to find candidates, item selection falls back to the closest available item across the full range.

**`getItemsForConstruct(construct)`:** Returns all items for a construct. Used by the pressure test to find items with different subTypes.

### How It Connects to Other Components

The item bank is imported by the adaptive loop (for item selection), the chat route (for serving items as interactive elements), the scoring pipeline (for looking up difficulty and correctAnswer to compute Layer A scores), and the content generation module. The item bank is a static export — no database involvement.

### How the Candidate Experiences It

Items appear as structured UI elements below the orb during Act 2. Multiple-choice items show A/B/C/D buttons. Numeric input items show a text field with numeric validation. Candidates answer once — the element is disabled after submission. Response time is measured from element appearance to submission.

### Architecture Decisions and Trade-offs

Static TypeScript data was chosen over a database-driven item bank for the same reasons as scenarios: zero latency, no database dependency at read time, and simplicity. The trade-off is that adding or recalibrating items requires a deployment. A database-driven item bank would enable A/B testing of difficulty calibrations and dynamic item addition, at the cost of added infrastructure.

The 86-item total provides approximately 12–20 items per construct, which is enough for the adaptive loop to run without exhausting candidates while maintaining selection diversity across difficulty levels.

### Current State

**Solid:** 86 well-calibrated items cover five constructs with appropriate difficulty spread. SubType diversity within constructs enables the pressure test's "different angle" selection.

**Gap (Missing imageUrl for spatial items):** Items with subTypes like `rotation`, `cross-section`, `net-folding`, and `projection` have `imageUrl: ""`. The adaptive loop correctly selects these items, but the rendered element shows only text — no visual stimulus. Spatial visualization questions involving 3D rotation or cross-sections are significantly harder to interpret without diagrams. Either SVG diagrams need to be generated for these 12–15 items, or their prompts need to be rewritten as purely verbal descriptions.

---

## H. The Chat Route (API Orchestrator)

### What It Is

The chat route at `src/app/api/assess/[token]/chat/route.ts` is the server-side coordinator that connects every other component into a functioning assessment. Every interaction between the candidate and the assessment system passes through this endpoint. It authenticates the request, routes between the two content-serving paths (pre-generated Content Library vs. live Sonnet streaming), calls the classification system, generates acknowledgments, calls the engine for the next action, streams Aria's response to the browser, and persists everything to the database. It is the busiest file in the codebase and runs on every single message.

To a non-technical reader: the chat route is the air traffic controller. Every time the candidate says something, the message lands at this controller, which figures out who should respond, what they should say, whether it needs to be pre-scripted or generated live, and then directs the response back to the candidate while simultaneously filing records.

### How It Works (Internal Mechanics)

**Authentication:** Every request carries the assessment's unique URL token in the path (`/api/assess/[token]/chat`). The route looks up the token against `AssessmentInvitation.linkToken`, validates that the invitation hasn't expired, and fetches the associated assessment and state.

**Rate limiting:** Each request is checked against a per-token rate limit using an in-memory sliding window. The limit prevents rapid-fire submissions that could exhaust LLM API quotas or corrupt message sequence ordering.

**Concurrency safeguard:** Assessment state updates use optimistic concurrency via `updateStateOptimistic()`. The state's `updatedAt` timestamp is captured at request start; state writes include a `WHERE updatedAt = capturedVersion` condition. If the state was updated by a concurrent request between read and write, the update affects 0 rows. This prevents state corruption from double-submissions or browser retry storms.

**Phase 0 handling:** Phase 0 is purely scripted — Aria's four segments are hardcoded in the `PHASE_0_SEGMENTS` constant in `phase-0.ts`. Phase 0 messages are persisted via a dedicated `phase_0_message` trigger body, bypassing the LLM entirely. The `phase_0_complete` trigger advances state to ACT_1.

**The dual content paths:** When state has a `contentLibraryId`, the route takes the pre-generated path: it calls `lookupBeatContent()` to retrieve the exact spoken text and reference card from the content library, combines it with a real-time acknowledgment sentence from `generateAcknowledgment()`, and streams the combined text using the Vercel AI SDK's `streamText()`. When no content library is available, the route calls the engine's `getNextAction()` for the system prompt and streams a full LLM response.

**Classification timing:** After a candidate message arrives, the route fires `classifyResponse()` before calling `getNextAction()`. The classification must complete before the engine can select the correct branch script. This adds ~200–400ms to the critical path but is unavoidable given the branching architecture.

**Message persistence:** Every candidate message and every Aria message is persisted to `ConversationMessage` with a `sequenceOrder` field computed by `nextSequenceOrder()` (which queries the database's max sequence value to prevent duplicates even under concurrency). Agent messages receive `metadata` including construct tags, scenario index, and beat index.

**Element responses:** When `elementResponse` is present in the request body, the route persists the response to both `ConversationMessage` and `ItemResponse`. The `ItemResponse` record is what the scoring pipeline uses for Layer A. After persisting, the route calls `recordResult()` in the adaptive loop and updates `act2Progress` in the assessment state.

**Streaming:** The route uses the Vercel AI SDK's `streamText()` for live generation and `streamObject()` is not used here — text-mode streaming returns raw SSE chunks. The `onFinish` callback on the streamText call persists the agent message to the database after streaming completes.

### How It Connects to Other Components

The chat route is the integration point for nearly every other component: it calls the engine, classification system, acknowledgment generator, content serving module, adaptive loop's `recordResult()`, and the Vercel AI SDK. It reads from `AssessmentInvitation`, `Assessment`, `AssessmentState`, `ConversationMessage`, and writes to all of those plus `ItemResponse` and `AIEvaluationRun` (indirectly through the pipeline).

### How the Candidate Experiences It

The chat route's quality shows up as response latency. The critical path is: classify the previous response (~200ms) → call the engine for the next action (~10ms) → start streaming (~200ms to first token). Total time from submission to first Aria word: roughly 400–600ms on a fast connection. On the pre-generated path, the acknowledgment is generated in parallel with the content library lookup, so total time is similar.

### Architecture Decisions and Trade-offs

The `maxDuration = 60` export is a Vercel configuration that allows the serverless function to run for up to 60 seconds. Standard Vercel timeout is 10 seconds. The 60-second limit accommodates long Layer B evaluations and content generation calls that can take 20–30 seconds.

The optimistic concurrency guard was added after a browser retry bug caused double-processing of classification and state updates. The `updatedAt`-based version check is simpler than a dedicated version field and leverages Prisma's automatic timestamp management.

### Current State

**Solid:** Token validation, rate limiting, Phase 0 handling, element response persistence, optimistic concurrency, and streaming are all correctly implemented.

**Bug (History cap too low):** Line 674 contains `messages.slice(-20)`. For a 24-turn Act 1 with 2-turn Phase 0, the LLM loses the beginning of Act 1 by scenario 3. The LLM can't reference what the candidate said in scenario 1 when scoring scenario 3. This cap should be raised to 40.

**Bug (Reference card override on pre-generated path):** When the route uses the content library path, it explicitly sets `referenceCard` from the content library's pre-generated JSON. But then `displayMessage()` in the client store parses the streamed text looking for `---REFERENCE---` blocks, potentially overwriting the explicitly-set card with a fallback or partial parse. The fix is to pass a `skipReferenceCardParsing` flag to `displayMessage()` when the card was already set from the server-side response headers.

---

## I. The Nudge System

### What It Is

The nudge system at `src/lib/assessment/nudge-system.ts` is the silence detection and re-engagement mechanism that prevents candidates from getting stuck. After Aria finishes speaking, the nudge system starts a countdown. If the candidate doesn't respond within context-dependent thresholds, it escalates through three levels: a supportive prompt ("take your time"), an offer of the text fallback ("you can type instead"), and finally an auto-advance that sends `[NO_RESPONSE]` to the engine. Without this system, a candidate who freezes on a hard question would wait indefinitely.

To a non-technical reader: the nudge system is the patient pause-and-prompt mechanism. Aria doesn't just wait in silence — after enough time has passed, she gently checks in, offers an alternative input method, and eventually moves on so the assessment doesn't stall.

### How It Works (Internal Mechanics)

`NudgeManager` is a class with instance state rather than a React hook or global singleton. This allows `assessment-stage.tsx` to hold a ref to a stable instance (`nudgeRef.current`) across renders.

The public API is: `start(context, callbacks)`, `pause()`, `resume()`, `stop()`, `reset()`.

**`start()`** clears any existing timers, sets the context (`phase_0`, `act_1`, `act_2`, `act_3`), and schedules three `setTimeout` calls at the context-specific thresholds:

| Context | First nudge | Second nudge | Final auto-advance |
|---------|-------------|--------------|-------------------|
| phase_0 | 15 seconds  | 30 seconds   | 45 seconds        |
| act_1   | 30 seconds  | 55 seconds   | 90 seconds        |
| act_2   | 15 seconds  | 30 seconds   | 45 seconds        |
| act_3   | 25 seconds  | 50 seconds   | 75 seconds        |

The Act 1 thresholds are longer because narrative responses require genuine reflection. Act 2 thresholds are shorter because structured items have more bounded response times.

**`pause()`** clears the timers and records the elapsed time since start. **`resume()`** restarts timers with the remaining time: `remaining(ms) = Math.max(0, ms - pausedElapsed)`. This allows act transitions (which pause the nudge while Aria speaks a narration segment) to resume without resetting the full timer. A candidate who had already waited 25 seconds before Aria's transition narration began shouldn't get a full 30-second reset when the narration ends.

**`reset()`** clears timers and restores context, intended to be called when the candidate begins interacting (first keystroke or mic activation). This prevents nudges from firing after the candidate has already started responding.

### How It Connects to Other Components

The nudge system is instantiated in `assessment-stage.tsx` and managed through `nudgeRef`. The component calls `nudgeRef.current.start()` after Aria's TTS playback completes for each turn. It calls `nudgeRef.current.pause()` when Act transitions begin. It calls `nudgeRef.current.reset()` when the candidate's mic activates or they begin typing. Nudge callbacks trigger TTS calls (`playNudge()`) and, for the second nudge, switch the input mode to text.

### How the Candidate Experiences It

Candidates experience nudges as Aria checking in during long silences. The first nudge is purely supportive — "take your time." The second is practical — "you can type if you prefer." The final nudge moves the assessment forward. From a candidate's perspective, the system communicates that silence is acceptable but the conversation will continue.

### Architecture Decisions and Trade-offs

Separate thresholds per context reflect real differences in expected response time. Spatial visualization items (Act 2) have expected response times of 30–80 seconds for hard items, but most responses come in 15–30 seconds. A 90-second threshold would be too patient for structured items. Act 1 narrative responses can legitimately take 60+ seconds of articulation after 20 seconds of thought.

The class-based design rather than a functional module was chosen because nudge state (timers, elapsed time) needs to persist across React renders. Refs can hold class instances stably without causing re-renders on state changes.

### Current State

**CRITICAL BUG (Nudge never resumes after transitions):** The single most important bug in the system. During act transitions, `nudgeRef.current.pause()` is called correctly. But `nudgeRef.current.start()` is never called in the `onTransitionComplete` callbacks for either the Act 1→2 or Act 2→3 transitions. This means:
- Candidates in Act 2 receive zero nudges, ever. If they stall on a structured item, nothing happens.
- Candidates in Act 3 receive zero nudges.
- Only Act 1 and Phase 0 nudges work.

The fix is to call `nudgeRef.current.start("act_2", callbacks)` inside the `onTransitionComplete` callback of `handleTransition1to2()`, and similarly for Act 3.

**Bug (Double-pause elapsed time):** If `pause()` is called twice before `resume()` is called, `pausedElapsed` double-counts: it adds `Date.now() - this.startTime` twice. The second `pause()` call should be a no-op when already paused (the `if (this.paused)` guard handles this correctly — checking the code again: `if (this.paused || !this.context) return;` — this is actually correctly guarded). Re-examining: the guard `if (this.paused)` on line 72 returns early, so double-pause is already protected. What isn't protected is calling `pause()` after `stop()` — `this.context` would be null, so the guard handles that too. The double-pause issue from the audit may be a theoretical concern rather than an active bug. Verify in testing.

---

## J. The Content Library

### What It Is

The Content Library is an optional pre-generation system that produces and caches Aria's Act 1 content before any candidate uses it. Instead of generating each beat's narrative live using Sonnet, the content library pre-generates all 24 beats (4 scenarios × 6 beats) with 3 variant sets, stores them in the database, and serves them at near-zero latency when candidates arrive. The system is gated behind a feature flag (`FEATURE_CONTENT_LIBRARY=true`). When disabled, the assessment falls back to live Sonnet streaming.

To a non-technical reader: the Content Library is a pre-recorded library of Aria's lines. Instead of Aria improvising every response live (which takes time and costs money on each call), someone prepared her lines in advance with three different "takes" per scene. When a candidate starts, a random take is selected for each scene, and Aria delivers from that script rather than improvising. The library is regenerated whenever the role configuration changes.

### How It Works (Internal Mechanics)

**Generation (`content-generation.ts`):** `generateContentLibrary(roleId)` creates a `ContentLibrary` database record in `GENERATING` status, then fires four parallel Sonnet calls — one per scenario. Each scenario call generates all six beats in one request, producing a `ContentLibraryData` object with `act1.scenarios[]`, each scenario having three `variants[]`, each variant having six `beats[]`. Beat 0 contains `spokenText` and `referenceCard`. Beats 1–5 contain `branches: { STRONG, ADEQUATE, WEAK }`, each with `spokenText` and optionally `referenceUpdate`. On completion, status is set to `READY`. On any error, status is set to `FAILED`.

**Role context injection:** If the role has specific context (domain, environment, key tasks), this is injected into the generation prompt so scenarios feel domain-relevant. Generic roles produce domain-neutral scenarios.

**Serving (`content-serving.ts`):** `loadContentLibrary(libraryId)` fetches and caches the library content in process memory. Libraries are treated as immutable once `READY`, so caching is safe and the database is only hit once per server process per library. `lookupBeatContent()` addresses the content by `(scenarioIndex, beatIndex, classification, variantSelections)`. Variant selections are determined once at assessment start by `selectRandomVariants()` (stored in `assessmentState.variantSelections`) so the same candidate always gets the same variant on resume.

**Acknowledgment bridging:** Pre-generated content is static — it was generated before the candidate answered anything. The acknowledgment system bridges this gap: the chat route generates a real-time acknowledgment sentence that references what the candidate specifically said, prepends it to the pre-generated spoken text, and streams the combined result. This creates the illusion that Aria heard the candidate's specific response.

### How It Connects to Other Components

The content library is checked at assessment state creation in the chat route. If a `READY` library exists for the role, its `id` is snapshotted into `assessmentState.contentLibraryId` and variant selections are stored in `assessmentState.variantSelections`. The engine does not interact with the content library — that path is handled entirely in the chat route. The content library is generated via `POST /api/roles/[roleId]/generate-content`, which calls `generateContentLibrary()`.

### How the Candidate Experiences It

When the content library is enabled and working, candidates experience faster response latency — Aria begins speaking almost immediately after classification completes, because the spoken text was already waiting. The acknowledgment sentence is the only dynamically generated part, and it arrives in under 200ms from a single fast Haiku call.

### Architecture Decisions and Trade-offs

The three-variant system exists because static pre-generated content would be identical for every candidate at the same organization. With three variants selected randomly per scenario per candidate, candidates in the same hiring cohort are unlikely to compare notes and recognize the same lines. Three variants triples generation cost but also triples variation. Additional variants could be added (the database JSONB field supports arbitrary depth) without structural changes.

The in-memory cache (`libraryCache`) is a Map indexed by library ID. In a serverless environment, this cache is per-function-instance, not globally shared. Cold starts will re-fetch from the database. This is acceptable for a library of roughly 10–20KB of text that can be fetched in ~50ms.

### Current State

**Bug (Reference card override):** When the content library path sends `referenceCard` in the response JSON (for Beat 0), the client-side `displayMessage()` function parses the streamed message text looking for `---REFERENCE---` delimiters. If the text doesn't contain this delimiter (because it's a clean spoken-only stream from the content library), `displayMessage()` may initialize a blank reference card, overwriting the `referenceCard` that was explicitly set from the server-sent JSON fields. This is a P0 bug that makes Beat 0 reference cards broken on the content library path. The fix involves passing a `skipReferenceCardParsing` flag when the server has already provided an explicit card.

**Gap (Act 2 and Act 3 content not pre-generated):** The `ContentLibraryData` type has `act2.diagnosticProbes` and `act3` fields. These are stubbed but not populated by `generateContentLibrary()`. Act 2 and Act 3 content continues to be generated live regardless of the feature flag. Pre-generating Act 2 diagnostic probe questions and Act 3 scenarios would complete the content library's coverage.

---

## K. The Frontend Component Structure

### What It Is

The assessment's frontend is built around a single orchestrator component (`src/components/assessment/stage/assessment-stage.tsx`) that manages the entire candidate experience from Phase 0 through assessment completion. Supporting components render Aria's output (the orb, subtitles, reference card), capture candidate input (voice, text, interactive elements), and display act-level UI chrome (act labels, progress indicators). State is managed across two Zustand stores: `chat-assessment-store.ts` (assessment-specific runtime state) and `app-store.ts` (application-level persistent preferences).

To a non-technical reader: the assessment's visual interface is like a theatre production managed from a single control room. The control room (assessment-stage.tsx) directs lights, sound, actor entrances and exits — all the visual elements that candidates see and interact with. The Zustand stores are the backstage communication system that keeps every element in sync with the others.

### How It Works (Internal Mechanics)

**`assessment-stage.tsx` (1392 lines):** This is the most complex file in the frontend. It holds refs to the TTS engine, nudge manager, and audio capture system. It defines effect hooks for: initial assessment load (fetch conversation history, resume if already started), act transitions (Phase 0 → Act 1, Act 1 → Act 2, Act 2 → Act 3), orb size management, and nudge lifecycle.

Key flows:

1. **Message receipt:** When the store receives a new Aria message, `assessment-stage.tsx` dispatches it to the TTS engine for playback. When TTS playback begins, subtitles start. When TTS playback ends, the nudge timer starts.

2. **Act transitions:** `handleTransition1to2()` is called when the engine returns a TRANSITION action. It calls `nudgeRef.current.pause()`, changes the orb to COMPACT size, plays the transition narration, updates the act label, and on completion calls `store.sendMessage("[BEGIN_ACT_2]")` to advance state. The `onTransitionComplete` callback is where `nudgeRef.current.start("act_2", callbacks)` should be called (currently the bug — this call is missing).

3. **Interactive elements:** When the store receives an `INTERACTIVE_ELEMENT` action, `assessment-stage.tsx` renders the appropriate element component (MultipleChoiceInline, NumericInput, TimedResponse, ConfidenceRating) below the orb. Element submission calls `store.sendElementResponse()`.

4. **Input mode management:** The store tracks `inputMode` ("mic" or "text"). The second nudge callback switches this to "text" by calling `store.setInputMode("text")`. This is the UI change that offers text entry after extended silence.

**Zustand store (`chat-assessment-store.ts`):**

The store manages: `messages` (display array), `activeElement` (current interactive element state), `referenceCard` (current scenario reference data), `inputMode`, `actProgress`, `isStreaming`, `orbSize`, and the `sendMessage()` / `sendElementResponse()` async actions.

`sendMessage()` POSTs to `/api/assess/[token]/chat` with the full message history, receives the streaming SSE response, appends tokens to the last message in real time, and parses the completed response for `---REFERENCE---` and `---REFERENCE_UPDATE---` delimiters to update the reference card state.

`sendElementResponse()` POSTs to `/api/assess/[token]/chat` with `elementResponse` in the body. If the POST fails, the element's `responded` state should be reset so the candidate can retry — this is the missing retry logic bug.

**Supporting components:**

- `orb.tsx`: Renders the animated circle. Subscribes to amplitude data from TTS engine via a shared amplitude ref. Supports FULL, COMPACT, and VOICE_PROBE size modes.
- `reference-card.tsx`: Renders the scenario context card. Progressive reveal: each section (situation, stakes, data, question) appears as Aria narrates, driven by the TTS subtitle position.
- `act-label.tsx`: Shows the current act name with a crossfade transition.
- `interactive-element.tsx`: Renders the appropriate input widget based on `elementType`.
- `subtitle-display.tsx`: Shows the current Aria sentence synchronized to TTS playback position.

**`app-store.ts` (Zustand with persist middleware):** Stores tutorial completion state, last-used theme, and audio preferences. Persisted to `localStorage`. The tutorial is the only application-level state that affects assessment behavior — a completed tutorial skips the tutorial overlay on next assessment start.

### How It Connects to Other Components

`assessment-stage.tsx` imports the TTS engine class, NudgeManager, and AudioCapture. It reads from both Zustand stores. Aria's responses come through the store's `messages` array; interactive elements come through `activeElement`. The component communicates upward via the store's action functions (`sendMessage`, `sendElementResponse`, `setOrbSize`).

### How the Candidate Experiences It

The assessment frontend is the totality of what candidates see and interact with. At its best, it presents as a calm, focused conversation interface with responsive audio, smooth animations, and interactive elements that appear naturally when needed. At its worst, the bugs described below create jarring gaps: an orb that starts too large, silence with no nudge, and reference cards that don't load.

### Architecture Decisions and Trade-offs

The decision to put all orchestration logic in one 1392-line component was pragmatic initially but has accumulated technical debt. The component is now too large to navigate easily and mixes concerns (Phase 0 logic, Act 1 logic, Act 2 logic, Act 3 logic, transition logic) in the same effect hooks. The audit plan recommends splitting into `phase0-orchestrator.tsx`, `act1-orchestrator.tsx`, `act2-orchestrator.tsx`, `act3-orchestrator.tsx`, and `transition-orchestrator.tsx`, each wired to the parent `assessment-stage.tsx` as a thin router.

Zustand was chosen over React Context for performance: deep state updates (individual message token appends during streaming) don't re-render the entire tree. Only components subscribed to specific slices re-render.

### Current State

**CRITICAL BUG (Nudge system stuck after transitions):** As described in the Nudge System section. After `handleTransition1to2()` and `handleTransition2to3()` complete, `nudgeRef.current.start()` is never called. Act 2 and Act 3 candidates receive zero nudges.

**HIGH BUG (Reference card override):** As described in the Content Library section. When the server sends `referenceCard` in the response JSON, `displayMessage()` may overwrite it by re-parsing the text. Requires `skipReferenceCardParsing` flag.

**HIGH BUG (No retry on element failure):** If `sendElementResponse()` fails due to network error, the interactive element is disabled (`responded: true`) but the answer was never received by the server. The candidate is permanently stuck — the element won't re-enable and no retry is attempted. Fix: wrap in retry loop (3 attempts, 1s backoff), reset `responded` state if all retries fail.

**MEDIUM BUG (Act progress counter never updated):** `actProgress` exists in the store as `{ act1: number, act2: number, act3: number }` and is displayed in the progress indicator, but `setActProgress()` is never called anywhere in `assessment-stage.tsx`. The progress bar shows 0/4 scenarios throughout Act 1, 0/5 constructs throughout Act 2.

**LOW BUG (Orb size flash at Act 2 entry):** The orb renders at FULL size (its default) briefly on Act 2 entry before the `useEffect` that compresses it to COMPACT fires. This causes a ~300ms visual flash. Fix: set orb to COMPACT immediately in `handleTransition1to2()` before any Act 2 message is sent.

---

## Appendix: Quick Reference — File Locations

| Component | Primary File | Lines |
|-----------|-------------|-------|
| State Machine | `src/lib/assessment/engine.ts` | 718 |
| Adaptive Loop | `src/lib/assessment/adaptive-loop.ts` | 357 |
| Scoring Pipeline | `src/lib/assessment/scoring/pipeline.ts` | 507 |
| Layer A | `src/lib/assessment/scoring/layer-a.ts` | 75 |
| Layer B | `src/lib/assessment/scoring/layer-b.ts` | 310 |
| Layer C | `src/lib/assessment/scoring/layer-c.ts` | 102 |
| Classification | `src/lib/assessment/classification.ts` | 186 |
| Nudge System | `src/lib/assessment/nudge-system.ts` | 140 |
| Content Generation | `src/lib/assessment/content-generation.ts` | ~200 |
| Content Serving | `src/lib/assessment/content-serving.ts` | 117 |
| Item Bank | `src/lib/assessment/item-bank.ts` | ~700 |
| Scenarios | `src/lib/assessment/scenarios/index.ts` | ~500 |
| Chat Route | `src/app/api/assess/[token]/chat/route.ts` | ~800 |
| Assessment Stage | `src/components/assessment/stage/assessment-stage.tsx` | 1392 |
| Chat Store | `src/stores/chat-assessment-store.ts` | ~400 |
| Config | `src/lib/assessment/config.ts` | 67 |
| Acknowledgment | `src/lib/assessment/generate-acknowledgment.ts` | 72 |

## Appendix: Active Bugs — Priority Order

| Priority | Bug | File | Status |
|----------|-----|------|--------|
| P0-CRITICAL | Nudge system never resumes after act transitions | `assessment-stage.tsx` | Unresolved |
| P0-HIGH | Reference card override on content library path | `chat-assessment-store.ts` | Unresolved |
| P0-HIGH | No retry on interactive element network failure | `chat-assessment-store.ts` | Unresolved |
| P1-MEDIUM | Conversation history cap too low (20 → 40) | `chat/route.ts` | Unresolved |
| P1 | No Aria persona in system prompts | `engine.ts`, `generate-acknowledgment.ts` | Unresolved |
| P2-MEDIUM | Act progress counter never incremented | `assessment-stage.tsx` | Unresolved |
| P2-MEDIUM | Act 3 confidence item off-by-one | `engine.ts` | Unresolved |
| P2-LOW | Orb FULL→COMPACT flash at Act 2 entry | `assessment-stage.tsx` | Unresolved |
| P3 | No calibration examples in classification prompt | `classification.ts` | Unresolved |
| P3 | Missing imageUrl for spatial visualization items | `item-bank.ts` | Unresolved |
| P3 | assessment-stage.tsx needs component split | `assessment-stage.tsx` | Unresolved |

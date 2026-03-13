
# ACI — Arklight Cognitive Index

## Product Requirements Document

**Version 1.14 • March 2026 • Confidential**

Supersedes: All prior versions (v1.13 through v1.1, NAIB Engineering PRD v3.0, NAIB PRD v4, ACI Finalization Doc)

---

## How to Use This Document

This PRD is the **single source of truth** for the ACI platform. It is structured for two audiences:

1. **Engineers and AI coding assistants (Claude Code)** — Use the Architecture Reference (Sections 4–8) and Implementation Reference for file paths, data models, API contracts, and implementation details. Every code-relevant section includes file paths relative to project root.

2. **Product stakeholders** — Use Sections 1–3 for strategic context and Sections 14–15 for metrics and roadmap.

**Conventions:**
- ✅ = Implemented and live in production
- 🔶 = Partially implemented
- ⏳ = Pending / not started
- 🗑️ = Removed (kept for historical reference only)
- File paths are relative to project root (e.g., `src/lib/auth.ts`)
- `[token]` in routes = dynamic route parameter

---

## Change Log

<details>
<summary><strong>v1.14 Change Log (March 2026)</strong></summary>

This revision documents **Architecture Audit Remediation** — 6-phase hardening across infrastructure, data integrity, security, observability, UX, and CI/CD. Driven by findings from 7 specialized audit agents (50+ issues consolidated into scalable architectural fixes).

**Phase 1: Foundational Infrastructure**
1. **Zod environment validation** (`src/lib/env.ts`) — All 20+ server env vars validated at import time via Zod schema. Missing/malformed vars cause clear startup errors instead of cryptic runtime crashes. Feature flags use `.default().transform()` pattern. Hardcoded fallback URLs removed — `NEXT_PUBLIC_APP_URL` is now required.
2. **Resilient HTTP client** (`src/lib/api-client.ts`) — Shared `resilientFetch()` with configurable retry policy: exponential backoff (`baseDelay × 2^attempt`), honors `Retry-After` header on 429, aborts on `AbortError`. Default: 3 retries, 1s base delay, retryable statuses [429, 502, 503, 504]. Adopted by Layer B evaluation and classification.
3. **API route wrapper** (`src/lib/api-handler.ts`) — `withApiHandler(handler, opts)` HOF wrapping all API routes with try/catch, Sentry capture, requestId correlation, optional auth/admin checks. Standardizes error handling across N routes without per-route boilerplate.
4. **Logger upgrade** (`src/lib/assessment/logger.ts`) — `createLogger(module, requestId?)` auto-includes requestId in every log entry for cross-request correlation. Fixed production `warn` routing (was using `console.log` instead of `console.warn`).
5. **Client error utility** (`src/lib/errors.ts`) — `mapApiError(err)` as single source of truth for user-friendly error messages. Handles TimeoutError, AbortError, HTTP 500/502/429, SEND_BLOCKED_LOADING. Replaces duplicated inline error mapping in `sendMessage` and `sendElementResponse`.

**Phase 2: Data Integrity & Scoring Pipeline**
6. **Schema hardening** (`prisma/schema.prisma`) — Added `ERROR` to `CandidateStatus` enum. Added `@@unique([assessmentId, sequenceOrder])` on `ConversationMessage` (prevents duplicate sequence numbers on retry). Added `@@unique([assessmentId, messageId, construct, runIndex])` on `AIEvaluationRun` (enables idempotent upserts). Removed redundant `@@index([linkToken])` on `AssessmentInvitation`.
7. **Scoring pipeline idempotency** (`src/lib/assessment/scoring/pipeline.ts`) — Before calling `evaluateConstruct()`, checks for existing `AIEvaluationRun` records. If found, reconstructs `LayerBScore` from stored runs — skips API calls entirely. Makes retries free (no duplicate API calls, no cost explosion).
8. **Transactional save** — Steps 7-13 of the scoring pipeline wrapped in single `prisma.$transaction()`. Either ALL scoring data is committed, or NONE is. Prevents partial scoring states on failure.
9. **Background execution** (`src/app/api/assess/[token]/complete/route.ts`) — `export const maxDuration = 300` + `after(() => runPipelineWithRetry(...))` ensures scoring pipeline runs after HTTP response (Vercel background execution).
10. **Connection pool** (`src/lib/prisma.ts`) — `pg.Pool` configured with `max: 1, idleTimeoutMillis: 10_000, connectionTimeoutMillis: 5_000` for serverless.

**Phase 3: Security Hardening**
11. **Item bank server-only guard** (`src/lib/assessment/item-bank.ts`) — `import "server-only"` at top prevents client-side import at build time.
12. **Admin route middleware** — Health endpoint uses `withApiHandler` + explicit `HEALTH_SECRET` bearer token check (returns 404 if missing/wrong — doesn't confirm route exists).
13. **Prompt injection defense** (`src/lib/assessment/role-context.ts`) — Extended `sanitizeForPrompt` with XML tag stripping (`<system>`, `<human>`, `<assistant>`) and code fence removal. Exported for reuse in classification and engine.
14. **Redis-backed rate limiting** (`src/lib/rate-limit.ts`) — `@upstash/ratelimit` + `@upstash/redis` with in-memory fallback. Distributed enforcement across serverless isolates when Redis configured; graceful degradation to in-memory when not.

**Phase 4: Observability & Error Handling**
15. **Chat route Sentry** (`src/app/api/assess/[token]/chat/route.ts`) — `Sentry.captureException(err)` at 3 catch sites (outer, streaming, onFinish). GET handler wrapped in try/catch. `assessmentId` added to `stateSnapshot`. Acknowledgment failures now logged instead of silently swallowed.
16. **Server-side sample rate** (`sentry.server.config.ts`) — `tracesSampleRate: 0.1` → `1.0` (every server request traced).
17. **Client store cleanup** (`src/stores/chat-assessment-store.ts`) — Removed debug `console.log` calls. Replaced inline error mapping in `sendMessage` and `sendElementResponse` with shared `mapApiError()`.
18. **Error toast** (`src/components/assessment/stage/assessment-stage.tsx`) — Displays actual error message (`{error}`) instead of hardcoded "Something went wrong". Removed destructive `setSubtitleText("")` from dismiss handler.

**Phase 5: UX & Client Resilience**
19. **TTS cache fix** (`src/components/assessment/voice/tts-engine.ts`) — Audio cache now stores `{ text, buffers }` instead of bare `AudioBuffer[]`. `playCachedBuffers` falls back to SpeechSynthesis when AudioContext is suspended instead of silently returning. Added error logging for AudioContext resume failures and SpeechSynthesis errors.
20. **MicButton graceful degradation** (`src/components/assessment/voice/mic-button.tsx`) — Shows "Voice input unavailable in this browser" instead of rendering nothing when SpeechRecognition is unsupported.
21. **InputModeToggle** — Hides Voice option when SpeechRecognition unavailable. Assessment stage auto-switches to text mode on unsupported browsers.
22. **Accessibility** — Added `aria-label="Type your response"` to textarea. Defined `.stage-animate` CSS class (referenced 19+ times, never defined) in `globals.css`.

**Phase 6: Platform & CI**
23. **CI pipeline** (`.github/workflows/ci.yml`) — Added `npm run build` step after type check (catches runtime errors tsc misses). Added `npm audit --audit-level=high` step. Prisma generate uses placeholder DATABASE_URL (no live connection needed).
24. **`.env.example`** — Documented all 20+ variables from Zod schema, grouped by service, marked required vs optional.

**New Dependencies:**
- `zod` — Environment validation schema
- `server-only` — Build-time client import guard
- `@upstash/redis` — Distributed rate limiting store
- `@upstash/ratelimit` — Sliding window rate limiter

</details>

<details>
<summary><strong>v1.13 Change Log (March 2026)</strong></summary>

This revision documents **Sprint 3 bug fixes**: production error handling hardening, TTS playback stability, Phase 0 personalization, and sentence parsing improvements.

**Error Handling Hardening (Chat API Route):**
1. **Outer try/catch** — Entire POST handler wrapped in try/catch with diagnostic `stateSnapshot` logging (act, scenario, beat, contentLibraryId, variantSelections). Returns 500 with safe error message; includes `detail` in development mode only.
2. **Streaming try/catch** — `streamText()` call wrapped separately; returns 502 ("AI response generation failed") with structured logging of model, act, beat.
3. **Narrowed content library try/catch** — Beat 0 and pre-gen content lookups wrapped individually; on failure, falls back to streaming path. DB writes remain outside try/catch to propagate critical errors.
4. **Classification guard** — `classifyResponse()` wrapped in try/catch. On failure (API timeout, JSON parse error, rate limit), logs error and proceeds with ADEQUATE default path. Previously, classification failures crashed the entire request with 500.
5. **Diagnostic logging** — `log.info("Assessment state loaded", {...})` after state creation; `log.info("Entering streaming path", {...})` before streaming. Classification results logged with act/beat/score.

**TTS Playback Stability:**
6. **displayEvent guard hole fix** — `ttsSequenceActiveRef` now triggers early return in the `displayEvent` useEffect, preventing competing `playSentenceSequence` calls from launching parallel sequences that kill each other mid-sentence.
7. **`preSplit` parameter** — `TTSEngine.speak()` accepts `preSplit = true` to skip internal `chunkText()` re-splitting. `playSentenceSequence` passes `preSplit = true` since sentences are already split by `splitSentences()`. Eliminates double-splitting that fragmented decimals and units.
8. **Promise.race timeout removed** — `playSentenceSequence` no longer races TTS against a timeout that called `ttsRef.current?.stop()`. Audio now plays to natural completion. Previously, the timeout could kill audio mid-sentence on slow ElevenLabs responses.
9. **MIN_SENTENCE_MS increased** — From 1000ms to 2500ms. Ensures each sentence gets adequate display time even when TTS fails or resolves instantly, preventing the "rushing" feel during warmup lines.
10. **Sentence validation filter** — `playSentenceSequence` filters out fragments shorter than 2 words or lone numbers/units before playback. Prevents bad TTS calls on fragments like "2C" or "165".

**Sentence Parsing:**
11. **Hardened `splitSentences()` regex** — New lookbehind pattern: `(?<![0-9])(?<!\b[A-Z])(?<!\b(?:e\.g|i\.e|vs|etc|approx|Dr|Mr|Ms|Mrs|Jr|Sr|St))(?<=[.!?])\s+(?=[A-Z"])`. Preserves decimals ("165C  2C"), abbreviations ("Dr. Smith"), and unit suffixes. Filter removes sub-2-word fragments.

**Phase 0 Personalization:**
12. **`getPhase0Segments(candidateName, companyName)`** — Phase 0 script now uses candidate's first name and company name. Replaced static `PHASE_0_SEGMENTS` array with parameterized function.
13. **`buildCompletionScript(candidateName, callbacks)`** — Completion script addresses candidate by name.

**Client Error Messages:**
14. **Contextual error messages** — `sendMessage()` catch block now maps error types: 500 → "Something went wrong on our end", 502 → "AI service temporarily unavailable", 429 → "Too many requests", timeout → "Response timed out". Previously all errors showed generic "Something went wrong".

</details>

<details>
<summary><strong>v1.12 Change Log (March 2026)</strong></summary>

This revision adds **Tutorial/Demo System v2.0**, **ASSESSMENT_TEST_MODE**, **Content Library system** detail, and brings every section up to full codebase parity.

**Tutorial/Demo System v2.0:**
1. **Audience Selector** — `/tutorial` now renders a 4-card industry selector (`src/components/tutorial/audience-selector.tsx`). Each card routes to an industry-specific demo org after storing selection in a cookie via Zustand persist middleware.
2. **Industry Verticals** — 4 demo orgs seeded: Atlas Defense Corp (defense-manufacturing), Orbital Dynamics (space-satellite), Nexus Robotics (hardware-ai), Vertex AI Labs (ai-software). Each has 5–6 roles and 6+ candidates with full scored assessments.
3. **Zustand Cookie Persistence Fix** — Server pages now correctly read the Zustand persist format `{"state":{"tutorialIndustry":"..."},"version":0}` via dual-path parsing (`_parsed?.state?.tutorialIndustry ?? _parsed?.tutorialIndustry`).
4. **Demo Watermark Removal** — Tutorial layout strips `DemoBanner` and `DemoWatermark`. TopNav shows "Back to Dashboard" instead of "Exit Tutorial".
5. **AI & Software Vertical** — Vertex AI Labs org includes Senior AI Engineer and Software Engineer roles with assessed candidates: Kai Nakamura, Simone Delacroix, Rafael Morales, Ingrid Svensson.

**Assessment Test Mode:**
1. **`ASSESSMENT_TEST_MODE=true`** env flag added to `src/lib/assessment/config.ts`. Swaps `generationModel` → Haiku, `evaluationRunCount` → 1. Approximately 20× cost reduction for local UX testing.
2. **`prisma/create-test-invitation.ts`** script — Wipes existing invitation + assessment (cascade-safe delete order), creates fresh invitation, prints test URL.

**Seed & Demo Data:**
1. **`prisma/seed-demo-only.ts`** — Dedicated seed script for 4 demo orgs. Final counts: 4 orgs, 26 roles, 73 candidates.
2. Corrected all Prisma schema mismatches in seed (CompositeScore fields, Prediction enum fields, RedFlag constructs[], AIInteraction fields, ActivityLog cascade).

**Content Library:**
1. Full `ContentLibrary` model, generation pipeline, and serving layer documented in detail in Section 9.

</details>

<details>
<summary><strong>v1.11 Change Log (March 2026)</strong></summary>

TTS/Subtitle Synchronization, Orb Glide Transition, Phase 0 Break Screen Refinement.

1. **`onPlaybackStart` callback** — `TTSEngine.speak()` now accepts `onPlaybackStart(totalDurationSec)` that fires when playback begins after all chunks are fetched and decoded.
2. **Subtitle sync** — `sentenceList` pre-split at sentence boundaries. `currentSentenceIndex` advances in lockstep with TTS playback using `onPlaybackStart` duration.
3. **Orb glide** — `orbTargetSize` drives CSS transition. Size changes animate over 2000ms with cubic-bezier easing.
4. **Phase 0 break screen** — Dedicated interstitial between Phase 0 warmup and Act 1 start. Orb compresses, subtitle fades.

</details>

<details>
<summary><strong>v1.10 Change Log (February 2026)</strong></summary>

Content Library, Phase 0 Warmup, Act Label Crossfade.

1. **ContentLibrary data model** — New Prisma model for pre-generated assessment content. `FEATURE_CONTENT_LIBRARY` flag gates the serving path.
2. **Phase 0 (Warmup)** — Pre-assessment mic check phase using scripted Aria segments. `phase_0_complete` POST unlocks Act 1.
3. **Act label crossfade** — `ActLabel` component crossfades between "Act 1 — Scenario Gauntlet" etc. during transitions.
4. **`generateAcknowledgment()`** — Haiku micro-call for personalised one-line acknowledgments in the content library path.

</details>

<details>
<summary><strong>v1.9 Change Log (January 2026)</strong></summary>

V2 Scoring Pipeline, Triple-Run AI Evaluation, Ceiling Characterization, Predictions V2.

1. **`scoringVersion: 2`** on SubtestResult — Distinguishes V2 pipeline output.
2. **Layer A + B split** — SubtestResult now carries `layerARawScore/layerAWeight` and `layerBRawScore/layerBWeight` separately.
3. **Triple-run eval** — 3 independent AI evaluation runs per construct; high-variance runs (SD > 0.3) downweighted 0.5×.
4. **Ceiling types** — `CeilingType` enum: HARD_CEILING, SOFT_CEILING_TRAINABLE, SOFT_CEILING_CONTEXT_DEPENDENT, STRESS_INDUCED, INSUFFICIENT_DATA.
5. **Predictions V2** — Full `Prediction` schema with ramp time, supervision load, performance ceiling, attrition risk — all with supporting factors JSON arrays.
6. **Red Flags V2** — `RedFlag.constructs` (array), `category`, `title`, severity CRITICAL/WARNING/INFO.

</details>

<details>
<summary><strong>v1.8 Change Log (December 2025)</strong></summary>

Adaptive Loop (Act 2), Act 3 Framework, Consistency Validation.

1. **`adaptive-loop.ts`** — Four-phase psychometric loop: Calibration → Boundary Mapping → Pressure Test → Diagnostic Probe.
2. **Act 3 progress tracking** — `act3Progress` JSON in AssessmentState: confidenceItemsComplete, parallelScenariosComplete, selfAssessmentComplete.
3. **Consistency validation** — Layer B Act 1 vs Act 3 comparison; delta > 0.15 → LOW consistency, 0.75× downweight.
4. **ITEM_BANK** — Static item bank with 60+ items across 5 Act 2 constructs.

</details>

<details>
<summary><strong>v1.7 and earlier</strong></summary>

See git history for full details. Key milestones: Role Builder (v1.6), Compare View (v1.5), Profile/PDF export (v1.4), Dashboard V1 (v1.3), Assessment V1 (v1.2), Initial schema (v1.1).

</details>

---

## Section 1: Executive Summary

### What ACI Is

ACI (Arklight Cognitive Index) is an AI-powered pre-employment cognitive assessment platform for technical and industrial roles. It replaces résumé screening and generic aptitude tests with a structured, conversational 2–3 hour assessment delivered by an AI interviewer named **Aria**.

Candidates experience a full-screen, voice-first interaction that measures 12 cognitive and behavioral constructs across three acts. ACI produces a rich output: per-construct scores, composite indexes, ceiling characterization, ramp time predictions, supervision load predictions, red flags, and hire/no-hire recommendations.

### Target Customers

- **Defense & Aerospace Manufacturing** — Factory technicians, CNC machinists, systems engineers, avionics techs
- **Space & Satellite Systems** — Systems engineers, propulsion engineers, flight test engineers
- **Hardware + AI / Robotics** — Robotics engineers, firmware engineers, ML engineers
- **AI & Software** — Senior AI engineers, software engineers, ML researchers, data engineers

### Business Model

- B2B SaaS with per-seat and per-assessment pricing
- Organization-level accounts with role-level configuration
- Enterprise onboarding with custom role calibration

### Revenue Model

- Per-assessment consumption (primary)
- Platform fee per seat (recruiter, TA leader, hiring manager)
- Outcome tracking add-on (longitudinal model refinement)

---

## Section 2: User Personas

### Hiring Manager (HM)
Wants to understand which candidates are ready to perform on day one. Reads composite scores, ramp time, and supervision load. May not review raw construct data.

### TA Leader / Recruiting Manager
Configures roles, sets cutlines, monitors pipeline health. Reviews red flags. Makes go/no-go on borderline candidates.

### Recruiter / Coordinator
Invites candidates, tracks invitation status, monitors pipeline. Does not change role configuration.

### External Collaborator (EC)
Guest user scoped to a specific candidate or role. Read-only. Cannot see other candidates.

### Candidate
Takes the assessment via a magic link (no account required). Interacts with Aria via voice or text. Has no visibility into scores.

### Admin
Full access. Manages users, roles, cutlines, weights. Can impersonate roles for testing.

---

## Section 3: What ACI Measures

### 12 Constructs

ACI measures 12 constructs organized into three layers:

#### Cognitive Core (5 constructs)
| Construct | Definition |
|-----------|-----------|
| FLUID_REASONING | Novel problem-solving without prior knowledge |
| EXECUTIVE_CONTROL | Inhibitory control, working memory, planning |
| COGNITIVE_FLEXIBILITY | Switching between mental sets, adapting to new rules |
| METACOGNITIVE_CALIBRATION | Accuracy of self-assessment; knowing what you don't know |
| LEARNING_VELOCITY | Speed of skill acquisition from minimal examples |

#### Technical Aptitude (5 constructs)
| Construct | Definition |
|-----------|-----------|
| SYSTEMS_DIAGNOSTICS | Causal tracing in multi-variable systems |
| PATTERN_RECOGNITION | Identification of regularities in data or sequences |
| QUANTITATIVE_REASONING | Mathematical reasoning under time pressure |
| SPATIAL_VISUALIZATION | Mental rotation, cross-section reasoning |
| MECHANICAL_REASONING | Force, torque, leverage, fluid dynamics intuition |

#### Behavioral Integrity (2 constructs)
| Construct | Definition |
|-----------|-----------|
| PROCEDURAL_RELIABILITY | Adherence to protocol even under pressure |
| ETHICAL_JUDGMENT | Recognition and navigation of ethical dilemmas |

### Three Measurement Layers

**Layer A — Deterministic Items**
- Act 2: Multiple choice, numeric input, timed challenges
- Objective correct/incorrect scoring
- Default weight: 55%

**Layer B — AI-Evaluated Open Responses**
- Act 1 scenario responses and Act 3 reflections
- Triple independent AI evaluation runs (3 runs per construct)
- Rubric-anchored indicator scoring (present/absent)
- High-variance runs downweighted (SD > 0.3 → 0.5× factor)
- Default weight: 45%

**Layer C — Ceiling Characterization**
- Derived from Act 2 adaptive loop diagnostic probe
- Types: HARD_CEILING, SOFT_CEILING_TRAINABLE, SOFT_CEILING_CONTEXT_DEPENDENT, STRESS_INDUCED, INSUFFICIENT_DATA
- Not a score; qualifies Layer A/B results

---

## Section 4: Technical Architecture

### Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15 App Router |
| Language | TypeScript 5 |
| Database | PostgreSQL (Supabase) |
| ORM | Prisma 6 with `@prisma/adapter-pg` |
| AI | Anthropic Claude API (Haiku + Sonnet) |
| TTS | ElevenLabs streaming API |
| Auth | NextAuth.js v5 (magic link + OAuth) |
| State | Zustand (client), Prisma (server) |
| Styling | Tailwind CSS 4 + CSS variables |
| Deployment | Vercel (serverless) |

### Project Structure

```
/
├── prisma/
│   ├── schema.prisma                  # Full data model (21 models)
│   ├── seed.ts                        # Primary seed (all data)
│   ├── seed-demo-only.ts              # Demo-only re-seed (4 orgs, 26 roles, 73 candidates)
│   └── create-test-invitation.ts      # Generate fresh test assessment URL
│
├── src/
│   ├── app/
│   │   ├── (assess)/                  # Assessment group (no dashboard nav)
│   │   │   ├── layout.tsx
│   │   │   └── assess/[token]/
│   │   │       ├── page.tsx           # Welcome / continue / complete screen
│   │   │       ├── v2/page.tsx        # Main assessment UI
│   │   │       ├── survey/page.tsx    # Post-assessment feedback survey
│   │   │       └── thank-you/page.tsx # Completion confirmation
│   │   │
│   │   ├── (auth)/                    # Auth pages
│   │   │   └── auth/
│   │   │       ├── signin/page.tsx
│   │   │       └── error/page.tsx
│   │   │
│   │   ├── (dashboard)/               # Dashboard group (with nav)
│   │   │   ├── layout.tsx
│   │   │   ├── dashboard/page.tsx     # Pipeline overview
│   │   │   ├── candidates/[id]/page.tsx
│   │   │   ├── roles/page.tsx         # Role list
│   │   │   ├── roles/[slug]/page.tsx  # Role detail
│   │   │   ├── roles/new/page.tsx     # Role builder
│   │   │   └── compare/page.tsx       # Multi-candidate comparison
│   │   │
│   │   ├── api/
│   │   │   ├── assess/[token]/
│   │   │   │   ├── start/route.ts     # Create assessment
│   │   │   │   ├── chat/route.ts      # Main chat endpoint (POST+GET)
│   │   │   │   ├── tts/route.ts       # ElevenLabs TTS proxy (token-scoped)
│   │   │   │   └── complete/route.ts  # Finalize + trigger scoring
│   │   │   ├── generate/route.ts      # Role JD → role context extraction
│   │   │   ├── ingest/route.ts        # ContentLibrary generation trigger
│   │   │   ├── score/[id]/route.ts    # Manual scoring re-run trigger
│   │   │   ├── tts/route.ts           # ElevenLabs proxy (streaming)
│   │   │   └── auth/[...nextauth]/route.ts
│   │   │
│   │   ├── tutorial/                  # Tutorial/Demo system
│   │   │   ├── layout.tsx             # Tutorial layout (no demo banner)
│   │   │   ├── page.tsx               # Audience selector (industry picker)
│   │   │   ├── dashboard/page.tsx
│   │   │   ├── roles/page.tsx
│   │   │   ├── roles/[slug]/page.tsx
│   │   │   ├── roles/new/page.tsx     # Read-only role builder
│   │   │   ├── candidates/[id]/page.tsx
│   │   │   ├── compare/page.tsx
│   │   │   └── assessment/
│   │   │       ├── layout.tsx         # Empty (overrides tutorial layout)
│   │   │       └── page.tsx           # Mini assessment entry
│   │   │
│   │   ├── demo/                      # Legacy demo (deprecated)
│   │   ├── layout.tsx                 # Root layout
│   │   ├── page.tsx                   # Landing / redirect
│   │   └── globals.css
│   │
│   ├── components/
│   │   ├── assessment/
│   │   │   ├── stage/
│   │   │   │   ├── assessment-stage.tsx        # Main assessment orchestrator
│   │   │   │   ├── act-label.tsx               # Act crossfade header
│   │   │   │   ├── scenario-reference-card.tsx # Quick-reference cheat sheet
│   │   │   │   ├── stage-choice-cards.tsx      # Multiple choice UI
│   │   │   │   ├── stage-numeric-input.tsx     # Numeric input UI
│   │   │   │   ├── stage-timed-challenge.tsx   # Countdown timer UI
│   │   │   │   └── stage-confidence-rating.tsx # Confidence scale UI
│   │   │   ├── orb/
│   │   │   │   └── assessment-orb.tsx          # Audio-reactive animated orb
│   │   │   └── voice/
│   │   │       └── tts-engine.ts               # ElevenLabs TTS + Web Audio
│   │   │
│   │   ├── profile/
│   │   │   ├── profile-client.tsx      # Full candidate profile view
│   │   │   ├── predictions-grid.tsx    # Ramp time / supervision / ceiling cards
│   │   │   ├── spider-chart.tsx        # Construct radar chart
│   │   │   └── (other profile subcomponents)
│   │   │
│   │   ├── role-builder/
│   │   │   ├── input-client.tsx        # JD input + role generation UI
│   │   │   └── hiring-intelligence-brief.tsx
│   │   │
│   │   ├── roles/
│   │   │   └── construct-importance.tsx
│   │   │
│   │   ├── tutorial/
│   │   │   ├── audience-selector.tsx           # 4-card industry picker
│   │   │   ├── role-builder-readonly.tsx       # InputClient with overlay
│   │   │   ├── tutorial-assessment-stage.tsx   # Scripted mini assessment UI
│   │   │   ├── tooltip-overlay.tsx             # Step-by-step tooltips
│   │   │   └── (other tutorial components)
│   │   │
│   │   ├── nav/
│   │   │   └── top-nav.tsx
│   │   │
│   │   └── (ui components, shared primitives)
│   │
│   ├── lib/
│   │   ├── assessment/
│   │   │   ├── types.ts               # All core types + enums
│   │   │   ├── engine.ts              # State machine orchestrator
│   │   │   ├── classification.ts      # Response classification + branching
│   │   │   ├── adaptive-loop.ts       # Act 2 psychometric loop
│   │   │   ├── config.ts              # AI models + feature flags + constants
│   │   │   ├── content-generation.ts  # ContentLibrary generation pipeline
│   │   │   ├── content-serving.ts     # ContentLibrary lookup + cache
│   │   │   ├── generate-acknowledgment.ts  # Personalized Haiku acknowledgment
│   │   │   ├── nudge-system.ts        # Silence detection + re-engagement
│   │   │   ├── parse-scenario-response.ts  # AI response → sentences + reference card
│   │   │   ├── phase-0.ts             # Scripted Phase 0 segments (personalized)
│   │   │   ├── role-context.ts        # Domain adaptation + sanitization
│   │   │   ├── scenarios/index.ts     # Act 1 scenario definitions
│   │   │   ├── item-bank.ts           # Act 2 static item bank
│   │   │   ├── transitions.ts         # Act transition scripts + callbacks
│   │   │   └── scoring/
│   │   │       ├── pipeline.ts        # 13-step V2 scoring pipeline
│   │   │       ├── layer-a.ts         # Deterministic item scoring
│   │   │       ├── layer-b.ts         # AI-evaluated response scoring
│   │   │       ├── layer-c.ts         # Ceiling characterization
│   │   │       └── predictions.ts     # Ramp time, supervision, ceiling, attrition
│   │   │
│   │   ├── env.ts                     # Zod-based server env validation (fail-fast)
│   │   ├── api-client.ts              # Resilient HTTP client (retry, backoff, 429)
│   │   ├── api-handler.ts             # Shared API route wrapper (try/catch, Sentry, auth)
│   │   ├── errors.ts                  # Client error mapping utility (mapApiError)
│   │   ├── data.ts                    # Data access functions (dashboard, profile, etc.)
│   │   ├── auth.ts                    # NextAuth config
│   │   ├── email.ts                   # Email sending (invitations, results)
│   │   ├── rate-limit.ts              # Redis-backed rate limiting (Upstash + in-memory fallback)
│   │   └── utils.ts
│   │
│   ├── stores/
│   │   ├── chat-assessment-store.ts   # Candidate-side assessment state (Zustand)
│   │   └── app-store.ts               # App-level state + tutorial mode (Zustand persist)
│   │
│   └── generated/
│       └── prisma/                    # Generated Prisma client
│
├── scripts/
│   └── create-test-invitation.ts      # Unused (Prisma requires prisma/ dir)
│
└── public/
    └── audio/
        └── tutorial/                  # Pre-generated tutorial audio (MP3s)
```

---

## Section 5: Data Model

**File:** `prisma/schema.prisma`

### Organization
Multi-tenant container.
```
id, name, slug (unique), domain?, isDemo (bool), createdAt, updatedAt
Relations: users, roles, candidates, teamInvitations
```

### User
Platform team members.
```
id, email (unique), name?, orgId, role (UserRole enum), createdAt, updatedAt
UserRole enum: EXTERNAL_COLLABORATOR | RECRUITER_COORDINATOR | RECRUITING_MANAGER | HIRING_MANAGER | TA_LEADER | ADMIN
```

### TeamInvitation
```
id, email, orgId, invitedBy (userId), role (UserRole), token (unique), status (TeamInvitationStatus), expiresAt, createdAt
TeamInvitationStatus: PENDING | ACCEPTED | EXPIRED | REVOKED
```

### Role
Job role definition.
```
id, orgId, name, slug (unique per org), description?,
complexityLevel (ComplexityLevel: LOW|MEDIUM|MEDIUM_HIGH|HIGH),
sourceType (RoleSourceType: SYSTEM_DEFAULT|JD_UPLOAD|TEMPLATE_CLONE|MANUAL_ENTRY),
isCustom (bool),
jobDescriptionText?,
onetCodes (String[]),
researchRationale (Json?),      -- Research backing for construct selection
confidenceScores (Json?),       -- Model confidence per construct
hiringIntelligence (Json?),     -- Hiring context and recommendations
jdContext (Json?),              -- Parsed: environment, skills, tasks, errorConsequences
createdAt, updatedAt
Relations: compositeWeights, cutlines, candidates, assessmentInvitations, contentLibraries
```

### CompositeWeight
Role-specific construct weights (versioned).
```
id, roleId, construct (Construct enum), weight (Float),
version (Int), source (WeightSource: RESEARCH_VALIDATED|EMPIRICALLY_ADJUSTED|CLIENT_CUSTOMIZED),
effectiveFrom (DateTime), effectiveTo (DateTime?),
createdAt, updatedAt
```

### Cutline
Pass/fail thresholds per role.
```
id, roleId,
technicalAptitude (Float),   -- 0-100 composite threshold
behavioralIntegrity (Float), -- 0-100 composite threshold
learningVelocity (Float),    -- 0-100 composite threshold
overallMinimum (Float),      -- 0-100 minimum across all
createdAt, updatedAt
```

### RoleVersion
Full audit trail of weight+cutline changes.
```
id, roleId, version (Int), weights (Json), cutlines (Json), changedBy (userId), createdAt
```

### ContentLibrary ✅
Pre-generated assessment content per role.
```
id, roleId,
version (Int),               -- Incremented per generation
status (ContentLibraryStatus: GENERATING|READY|FAILED|DEPRECATED),
content (Json?),             -- Full ContentLibraryData tree (Act 1 scenarios, variants, beats)
generationStartedAt (DateTime),
generationCompletedAt (DateTime?),
errorLog (Json?),
createdAt, updatedAt
```

### Candidate
Candidate profile.
```
id, orgId, firstName, lastName, email?,
primaryRoleId,
status (CandidateStatus: INVITED|INCOMPLETE|SCORING|RECOMMENDED|REVIEW_REQUIRED|DO_NOT_ADVANCE|ERROR),
resultsEmailSentAt (DateTime?),
createdAt, updatedAt
Relations: primaryRole, assessment, notes, assignments, invitations, outcomes
```

### CandidateAssignment
Visibility scoping for External Collaborators.
```
id, candidateId, userId, createdAt
```

### AssessmentInvitation
Candidate entry point.
```
id, candidateId, roleId, invitedBy (userId),
linkToken (String unique),   -- UUID used in /assess/[token] URL
status (InvitationStatus: PENDING|STARTED|COMPLETED|EXPIRED),
expiresAt (DateTime),
emailSentAt (DateTime?),
linkOpenedAt (DateTime?),
reminderCount (Int default 0),
createdAt, updatedAt
```

### Assessment
Core assessment record (one per candidate).
```
id, candidateId (unique),
startedAt (DateTime),
completedAt (DateTime?),
durationMinutes (Int?),
scoringVersion (Int default 2),
createdAt, updatedAt
Relations: state, messages, itemResponses, subtestResults, compositeScores, predictions, redFlags, aiInteractions, evaluationRuns, calibrations
```

### AssessmentState
Live session state machine.
```
id, assessmentId (unique),
currentAct (AssessmentAct: PHASE_0|ACT_1|ACT_2|ACT_3),
currentScenario (Int default 0),
currentBeat (Int default 0),
currentConstruct (Construct?),      -- Act 2 current construct
currentPhase (AdaptivePhase?),      -- Act 2 current phase
branchPath (Json default []),       -- Array of ResponseClassification per beat
act2Progress (Json default {}),     -- Map<construct, AdaptiveLoopState>
act3Progress (Json default {}),     -- { confidenceItemsComplete, parallelScenariosComplete, selfAssessmentComplete }
phase0Complete (Bool default false),
contentLibraryId (String?),         -- Snapshot of content library used
variantSelections (Json?),          -- { scenarioId: variantIndex }
updatedAt (DateTime)                -- Used for optimistic locking
```

### ConversationMessage
Complete message history.
```
id, assessmentId,
role (MessageRole: AGENT|CANDIDATE|SYSTEM),
act (AssessmentAct?),
content (String),
elementType (InteractionElementType?),
elementData (Json?),                -- Full element config (options, correctAnswer, timer)
candidateInput (Json?),             -- Candidate's structured response
responseTimeMs (Int?),
sequenceOrder (Int),                -- Monotonic, prevents TTS race conditions
metadata (Json?),                   -- construct signals, beat type, variant info, preGenerated flag
createdAt
```

**InteractionElementType enum:**
`TEXT_RESPONSE | MULTIPLE_CHOICE_INLINE | NUMERIC_INPUT | TIMED_CHALLENGE | CONFIDENCE_RATING | TRADEOFF_SELECTION`

### ItemResponse
Individual item response linked to ConversationMessage.
```
id, assessmentId, messageId?, itemId (String), itemType (ItemType), response (String),
rawScore (Float?), act (AssessmentAct?), responseTimeMs (Int?), createdAt
ItemType: MULTIPLE_CHOICE | LIKERT | OPEN_RESPONSE | AI_PROBE | TIMED_SEQUENCE
```

### AIEvaluationRun
One of 3 independent AI evaluation runs per construct per response.
```
id, assessmentId, messageId,
construct (Construct), runIndex (Int 0–2),
indicatorScores (Json),             -- [{ indicatorId, present, reasoning }]
aggregateScore (Float),
modelId (String), latencyMs (Int), rawOutput (String),
createdAt
```

### SubtestResult
Per-construct score (V2 layered fields).
```
id, assessmentId, construct (Construct), layer (ConstructLayer),
rawScore (Float), percentile (Float), itemCount (Int),
scoringVersion (Int default 2),
-- Layer A (deterministic items)
layerARawScore (Float?), layerAWeight (Float?),
-- Layer B (AI-evaluated)
layerBRawScore (Float?), layerBWeight (Float?),
-- Consistency validation
consistencyLevel (ConsistencyLevel: HIGH|LOW)?,
consistencyDownweighted (Bool default false),
-- Ceiling characterization
ceilingType (CeilingType?),
createdAt

ConstructLayer enum: COGNITIVE_CORE | TECHNICAL_APTITUDE | BEHAVIORAL_INTEGRITY
CeilingType enum: HARD_CEILING | SOFT_CEILING_TRAINABLE | SOFT_CEILING_CONTEXT_DEPENDENT | STRESS_INDUCED | INSUFFICIENT_DATA
```

### CompositeScore
Role-level indexed composite.
```
id, assessmentId, roleSlug (String),
indexName (String),                 -- e.g., "Overall Fit", "Technical Aptitude Index"
score (Float),                      -- 0–100
percentile (Float),
passed (Bool),                      -- Evaluated against cutline
distanceFromCutline (Float),        -- score - cutline threshold
createdAt
```

### Prediction
Outcome predictions.
```
id, assessmentId,
rampTimeMonths (Int),               -- Estimated months to full productivity
rampTimeLabel (String),             -- Human-readable: "2–3 months"
rampTimeFactors (Json),             -- String[] supporting evidence
supervisionLoad (SupervisionLoad: LOW|MEDIUM|HIGH),
supervisionScore (Float),
supervisionFactors (Json),          -- String[]
performanceCeiling (PerformanceCeiling: HIGH|MEDIUM|LOW),
ceilingFactors (Json),              -- String[]
ceilingCareerPath (String?),
attritionRisk (AttritionRisk: LOW|MEDIUM|HIGH),
attritionFactors (Json),            -- String[]
attritionStrategies (Json),         -- String[]
createdAt
```

### RedFlag
Risk indicators.
```
id, assessmentId,
severity (FlagSeverity: CRITICAL|WARNING|INFO),
category (String),                  -- e.g., "Cognitive Concern"
title (String),                     -- Short label
description (String),
constructs (String[]),              -- Construct tags
createdAt
```

### AIInteraction
AI-evaluated interaction records (for audit + retraining).
```
id, assessmentId,
construct (Construct),
sequenceOrder (Int),
aiPrompt (String),
response (String?),
createdAt
```

### PostAssessmentSurvey
Candidate UX feedback (optional).
```
id, assessmentId,
difficulty (Int 1–5),
fairness (Int 1–5),
faceValidity (Int 1–5),
openFeedback (String?),
createdAt
```

### ItemCalibration
Psychometric calibration per item version.
```
id, itemId (String), itemVersion (String),
difficulty (Float), discrimination (Float), guessing (Float),
sampleSize (Int), fitStatistic (Float?), flagged (Bool default false),
createdAt
```

### Note
Candidate notes from team members.
```
id, candidateId, authorId, content, createdAt, updatedAt
```

### ActivityLog
Full audit trail.
```
id, orgId, entityType (String), entityId (String), actorId (userId?),
action (String), metadata (Json?), createdAt
```

### OutcomeRecord
Real-world outcome data for model refinement.
```
id, candidateId,
metricType (OutcomeMetricType),     -- TRAINING_COMPLETION_DAYS | RAMP_TIME_MONTHS | NINETY_DAY_RETENTION | SUPERVISOR_RATING | QUALITY_SCORE | SAFETY_INCIDENT | TRAINING_TEST_SCORE | PROMOTION
value (Float), observedAt (DateTime),
recordedBy (userId?), notes (String?), createdAt
```

---

## Section 6: Composite Weights & Cutlines

### CompositeWeight

Each role has a set of `CompositeWeight` records — one per construct. Weights are floating-point values that sum to 1.0 per composite index. The `source` field tracks provenance:

- **RESEARCH_VALIDATED** — Default weights from O*NET and psychometric research
- **EMPIRICALLY_ADJUSTED** — Adjusted based on observed outcome data
- **CLIENT_CUSTOMIZED** — Modified by client organization

Multiple versions can coexist with `effectiveFrom`/`effectiveTo` ranges. Active weights are those where `effectiveTo IS NULL` (or current date is in range).

### Cutline Structure

Per-role thresholds stored in the `Cutline` model:
- `technicalAptitude` — minimum composite for the Technical Aptitude index
- `behavioralIntegrity` — minimum composite for the Behavioral Integrity index
- `learningVelocity` — minimum composite for Learning Velocity
- `overallMinimum` — minimum across all composites

Cutlines are percentile-equivalent scores (0–100). A candidate with any composite below its respective cutline is classified as REVIEW_REQUIRED or DO_NOT_ADVANCE depending on severity.

### Demo Org Cutline Profiles

| Org | Technical | Behavioral | Overall |
|-----|-----------|------------|---------|
| Atlas Defense Corp | 65 | 60 | 55 |
| Orbital Dynamics | 70 | 65 | 60 |
| Nexus Robotics | 68 | 62 | 58 |
| Vertex AI Labs | 72 | 58 | 62 |

---

## Section 7: RBAC (Role-Based Access Control)

### User Roles (least → most privileged)

| Role | Can See | Can Modify |
|------|---------|-----------|
| EXTERNAL_COLLABORATOR | Assigned candidates only (via CandidateAssignment) | Nothing |
| RECRUITER_COORDINATOR | All candidates in org | Invite candidates, send reminders |
| RECRUITING_MANAGER | All candidates + role pipelines | Invite, manage invitations |
| HIRING_MANAGER | All candidates + role pipelines | Invite, manage invitations |
| TA_LEADER | All + analytics | Add/edit roles, manage cutlines |
| ADMIN | Everything | All + user management, org settings |

### CandidateAssignment

When an External Collaborator needs to review a specific candidate, an Admin or TA_Leader creates a `CandidateAssignment` linking the user to the candidate. Data functions check this relationship for EC-scoped queries.

### Data Layer Enforcement

All dashboard data functions accept an optional `opts: { userId, userRole }` parameter. Functions filter candidates based on `CandidateAssignment` records when `userRole === "EXTERNAL_COLLABORATOR"`. Server pages pass the session user's role and ID.

---

## Section 8: Scoring Engine

### Overview

The scoring pipeline runs asynchronously after `POST /api/assess/[token]/complete`. It is fire-and-forget from the HTTP handler, with retry logic and error state.

**File:** `src/lib/assessment/scoring/pipeline.ts`

### 13-Step Pipeline

#### Step 1: Fetch Assessment
Load Assessment with all relations:
- ConversationMessages (ordered by sequenceOrder)
- AssessmentState
- Candidate + primaryRole + compositeWeights
- ItemResponses (with act field)

#### Step 2: Layer A Scoring (Deterministic)
**File:** `src/lib/assessment/scoring/layer-a.ts`

Process Act 2 ItemResponses:
- Group by construct
- Score each item: 1.0 if correct, 0.0 if incorrect (partial credit for numeric inputs ±5%)
- Penalize slow responses: response > 2× `timingExpectations.slow` → 0.8× multiplier
- `aggregateLayerA()`: mean across items per construct → `LayerAScore[]`

#### Step 3: Layer B Scoring (AI-Evaluated)
**File:** `src/lib/assessment/scoring/layer-b.ts`

Process Act 1 and Act 3 ConversationMessages with role=CANDIDATE:
1. For each CANDIDATE message, find the preceding AGENT message
2. Extract construct tags from AGENT message metadata
3. Run `evaluateConstruct(candidateMessage, agentMessage, construct, roleContext)` via Claude
4. Repeat `evaluationRunCount` times (3 in production, 1 in test mode)
5. Each run produces `AIEvaluationRun` with:
   - `indicatorScores`: [{ indicatorId, present, reasoning }]
   - `aggregateScore`: mean of present/total indicators
6. Aggregate runs:
   - Compute SD across runs
   - If SD > `highVarianceThreshold` (0.3) → apply `highVarianceDownweight` (0.5×)
   - Final `layerBRawScore` = mean of run scores (possibly downweighted)
7. Log `AIEvaluationRun` records for audit

#### Step 4: Layer C Ceiling Characterization
**File:** `src/lib/assessment/scoring/layer-c.ts`

For each Act 2 construct, examine the DIAGNOSTIC_PROBE conversation:
- Identify language patterns indicating ceiling type
- Classify: HARD_CEILING (cognitive limit) vs SOFT_CEILING_TRAINABLE (knowledge gap) vs SOFT_CEILING_CONTEXT_DEPENDENT (domain-specific) vs STRESS_INDUCED (test anxiety) vs INSUFFICIENT_DATA
- Store in `SubtestResult.ceilingType`

#### Step 5: Consistency Validation
Compare Layer B scores from Act 1 vs Act 3 (parallel scenarios):
- Compute delta per construct
- Delta > `consistencyThreshold` (0.15) → mark `consistencyLevel = LOW`
- LOW consistency triggers `consistencyDownweightFactor` (0.75×) on final composite

#### Step 6: Construct Aggregation
Per construct:
```
finalScore = (layerAWeight × layerARawScore) + (layerBWeight × layerBRawScore)
```
- Default weights: 55% A, 45% B (from `ASSESSMENT_STRUCTURE`)
- Apply consistency downweight if triggered
- Normalize to 0–100 scale

#### Step 7: Populate SubtestResults
Write `SubtestResult` records for each construct:
- rawScore, percentile (lookup against norm table)
- All Layer A/B/C fields
- `scoringVersion: 2`

#### Step 8: Calculate Composites
Group constructs by composite index (defined in role's `CompositeWeight` records):
- Weighted mean: `Σ(weight × constructScore) / Σ(weight)`
- Write `CompositeScore` per roleSlug per index

#### Step 9: Evaluate Cutlines
Compare each CompositeScore against corresponding `Cutline`:
- `passed = score >= cutline`
- `distanceFromCutline = score - cutline`

#### Step 10: Red Flags V2
**File:** `src/lib/assessment/scoring/pipeline.ts` → `detectRedFlags()`

Generate `RedFlag` records for notable patterns:
- CRITICAL: `distanceFromCutline < -20` on overallMinimum
- WARNING: Inconsistency (LOW consistencyLevel) on behavioral constructs
- WARNING: HARD_CEILING on constructs with high role weight
- INFO: STRESS_INDUCED ceiling (indicates trainable with support)

#### Step 11: Predictions
**File:** `src/lib/assessment/scoring/predictions.ts`

`generateAllPredictions(assessment, compositeScores, subtestResults, role)`:

**Ramp Time** — Based on Learning Velocity construct percentile:
- ≥75th → 1–2 months
- 50–74th → 2–3 months
- 25–49th → 3–5 months
- <25th → 5+ months

**Supervision Load** — Based on Executive Control + Procedural Reliability:
- Both ≥70th → LOW
- Either 50–69th → MEDIUM
- Either <50th → HIGH

**Performance Ceiling** — Based on Fluid Reasoning + ceiling characterization:
- HARD_CEILING on key construct + low score → LOW
- SOFT_CEILING_TRAINABLE → MEDIUM
- High scores, no hard ceiling → HIGH

**Attrition Risk** — Based on Metacognitive Calibration + Cognitive Flexibility:
- High calibration + high flexibility → LOW
- Mismatch patterns → MEDIUM or HIGH

#### Step 12: Status Determination
```
RECOMMENDED         — all composites passed cutlines
REVIEW_REQUIRED     — 1-2 composites below cutline (moderate gap)
DO_NOT_ADVANCE      — overallMinimum failed OR CRITICAL red flag
```

#### Step 13: Update Candidate
- Set `candidate.status` to determined status
- Mark `assessmentInvitation.status = COMPLETED`
- If applicable, trigger results email

### Scoring Retry Logic

```
runPipelineWithRetry(assessmentId, maxAttempts=3):
  for attempt in [1, 2, 3]:
    try:
      await runScoringPipeline(assessmentId)
      return
    catch e:
      if attempt < maxAttempts:
        await delay(2^(attempt-1) * 1000ms)  // 1s, 2s, 4s
      else:
        await setErrorStatus(assessmentId)
        throw
```

---

## Section 9: Assessment Content System

### 9A: Scenario Structure

Act 1 consists of 4 domain-adaptive scenarios, each with 6 beats:

| Beat | Type | Description |
|------|------|-------------|
| 0 | INITIAL_SITUATION | Set scene, establish normal operations context |
| 1 | INITIAL_RESPONSE | "What do you do?" — open-ended first action |
| 2 | COMPLICATION | New information reveals added complexity |
| 3 | SOCIAL_PRESSURE | Interpersonal/stakeholder conflict |
| 4 | CONSEQUENCE_REVEAL | Impact of candidate's prior choice |
| 5 | REFLECTIVE_SYNTHESIS | Meta-cognition — what did you learn? |

Each beat in the engine (`engine.ts`) has:
- A system prompt instructing Aria on format (Beat 0: 4–5 sentences + REFERENCE JSON; Beats 1–5: 1–2 sentences + optional REFERENCE_UPDATE JSON)
- Branch scripts: STRONG / ADEQUATE / WEAK (content that follows after classification)
- Rubric indicators: behavioral signals being measured

### 9B: Content Library (Pre-Generated Content)

**Feature flag:** `FEATURE_FLAGS.CONTENT_LIBRARY_ENABLED = process.env.FEATURE_CONTENT_LIBRARY === "true"`

**Purpose:** Eliminate live AI generation during assessments. A background job generates all 4 scenarios × 6 beats × 3 variants = 72 beat contents per role. Cached in database as `ContentLibrary.content` (JSON). During assessment, engine serves pre-generated text instead of streaming Sonnet.

#### Generation Pipeline
**File:** `src/lib/assessment/content-generation.ts`

`generateContentLibrary(roleId)`:
1. Set `ContentLibrary.status = GENERATING`
2. Load role context (`getRoleContext(roleId)`)
3. For each scenario (0–3):
   - For each beat (0–5):
     - Single Sonnet call: generate 3 variants (STRONG, ADEQUATE, WEAK branches + Beat 0 reference card)
     - 24 total Sonnet calls (sequential within scenario, parallel across scenarios possible)
4. Set `ContentLibrary.status = READY`, store full content tree
5. On any error: `status = FAILED`, store `errorLog`

**ContentLibraryData structure:**
```typescript
{
  version: number,
  generatedAt: string,          // ISO
  modelId: string,
  roleContext: {
    environment: string,
    skills: string[],
    tasks: string[],
    errorConsequences: string
  },
  act1: {
    scenarios: Array<{
      scenarioId: string,
      variants: Array<{
        variantId: string,
        beats: Array<{
          spokenText: string,
          referenceCard?: ScenarioReferenceData,   // Beat 0 only
          branches?: {
            STRONG:   { spokenText: string, referenceUpdate?: RefUpdate },
            ADEQUATE: { spokenText: string, referenceUpdate?: RefUpdate },
            WEAK:     { spokenText: string, referenceUpdate?: RefUpdate }
          }
        }>
      }>
    }>
  }
}
```

#### Content Serving
**File:** `src/lib/assessment/content-serving.ts`

`loadContentLibrary(libraryId)` — Loads + caches (in-memory, server-side). Immutable once READY.

`getReadyLibrary(roleId)` — Fetches latest READY library for role. Returns `null` if none available (fallback to streaming).

`selectRandomVariants(library)` — Called once at assessment start. Returns `Record<scenarioId, variantIndex>`. Stored in `AssessmentState.variantSelections`.

`lookupBeatContent(library, scenarioIndex, beatIndex, classification, variantSelections)` — Serves the correct pre-generated content given:
- Scenario position (0–3)
- Beat position (0–5)
- Classification of previous response (STRONG/ADEQUATE/WEAK, used for beat ≥ 1)
- The variant selected for this assessment

#### Acknowledgment Generation
**File:** `src/lib/assessment/generate-acknowledgment.ts`

`generateAcknowledgment(candidateResponse, beatType, constructs)`:
- Single Haiku call (~200ms)
- Produces 1 personalized sentence: "That's a thoughtful approach." / "I see where you're going with that."
- Used in content library path to bridge candidate response → pre-generated branch content

### 9C: AI Model Configuration

**File:** `src/lib/assessment/config.ts`

```typescript
const TEST_MODE = process.env.ASSESSMENT_TEST_MODE === "true";

export const AI_CONFIG = {
  realtimeModel: "claude-haiku-4-5-20251001",   // Classification, follow-ups, probes
  generationModel: TEST_MODE
    ? "claude-haiku-4-5-20251001"               // TEST: cheap, fast
    : "claude-sonnet-4-20250514",               // PROD: quality scenarios
  realtimeTimeoutMs: 15_000,
  generationTimeoutMs: 30_000,
  evaluationRunCount: TEST_MODE ? 1 : 3,        // TEST: 1 run; PROD: 3 runs
  highVarianceThreshold: 0.3,
  highVarianceDownweight: 0.5,
} as const;

export const FEATURE_FLAGS = {
  CONTENT_LIBRARY_ENABLED: process.env.FEATURE_CONTENT_LIBRARY === "true",
} as const;

export const ASSESSMENT_STRUCTURE = {
  act1ScenarioCount: 4,
  beatsPerScenario: 6,
  act2Constructs: [
    "QUANTITATIVE_REASONING",
    "SPATIAL_VISUALIZATION",
    "MECHANICAL_REASONING",
    "PATTERN_RECOGNITION",
    "FLUID_REASONING",
  ],
  act3ConfidenceItems: 3,
  act3ParallelScenarios: 2,
  consistencyThreshold: 0.15,
  defaultLayerAWeight: 0.55,
  defaultLayerBWeight: 0.45,
  consistencyDownweightFactor: 0.75,
} as const;
```

**ASSESSMENT_TEST_MODE:**
Set `ASSESSMENT_TEST_MODE=true` in `.env.local` for local development. This flag:
- Swaps `generationModel` from Sonnet → Haiku (~20× cheaper)
- Reduces `evaluationRunCount` from 3 → 1 (~3× faster scoring)
- Combined: approximately 20× cost reduction for a full assessment run
- Does NOT affect assessment UX or any non-AI logic

---

## Section 10: Aria Assessment Experience (Production)

### Overview

The production assessment is a full-screen, voice-first experience. No traditional form UI. Candidate sees an animated orb (Aria's visual presence) and subtitle text. Voice-primary with text fallback.

**Entry points:**
- `/assess/[token]` — Welcome screen with candidate name, role, company name
- `/assess/[token]/v2` — Main assessment stage
- `/assess/[token]/survey` — Optional post-assessment survey
- `/assess/[token]/thank-you` — Completion confirmation

**Files:**
- `src/app/(assess)/assess/[token]/page.tsx` — Welcome/continue/complete gate
- `src/app/(assess)/assess/[token]/v2/page.tsx` — Mounts AssessmentStage
- `src/components/assessment/stage/assessment-stage.tsx` — Main orchestrator

### Phase 0: Warmup & Mic Check

Scripted segment (not AI-generated). Aria introduces herself using candidate's name and company, explains the format, prompts a brief voice test.

**Files:** `src/lib/assessment/phase-0.ts`

```typescript
getPhase0Segments(candidateName: string, companyName: string): Array<{ text: string, pauseAfterMs?: number }>
MIC_NUDGE_15S: string    // "Say anything into the mic to continue."
MIC_NUDGE_30S: string    // "Try typing if voice isn't working."
```

**Personalization:** `getPhase0Segments()` interpolates `candidateName` (from `invitation.candidate.firstName`) and `companyName` (from `invitation.candidate.primaryRole.organization.name`) into the greeting and context segments.

**Flow:**
1. TTS plays each segment from `getPhase0Segments()`
2. Orb shows in speaking mode, subtitle syncs with word reveal
3. After final segment: activate voice/text input
4. Candidate records any response ("Hi, this is Alex")
5. POST `phase_0_message` to persist scripted Aria messages
6. POST `phase_0_complete` to unlock Act 1

**Nudge behavior (Phase 0 silence thresholds):**
- 15s → First nudge: "Take your time — there's no rush."
- 30s → Second nudge: "If you'd prefer to type your response, that's completely fine too."
- 45s → Final nudge + auto-advance: "No worries — let's move on."

### Act 1: Scenario Gauntlet

4 scenarios × 6 beats = 24 interactive turns.

**Warmup lines:** Before Beat 0, Aria plays 3 warmup lines via `playSentenceSequence(ACT1_WARMUP_LINES)` from `src/lib/assessment/transitions.ts`:
1. "I'm going to walk you through some workplace situations now."
2. "For each one, I'll describe what's happening and ask how you'd handle it."
3. "There's no single right answer — I'm interested in how you think through these kinds of problems. Let's start with the first one."

After warmup lines finish, `sendMessage("[BEGIN_ASSESSMENT]")` is sent to trigger Beat 0.

**Domain adaptation:** Aria's scenarios are tailored to the role via `getRoleContext()`. A CNC Machinist gets manufacturing scenarios. A Systems Engineer gets aerospace scenarios. If role is generic (no JD context), neutral scenarios are used.

**Content serving:** With `CONTENT_LIBRARY_ENABLED`, pre-generated content is served instantly (no AI latency). Without it, each beat streams from Sonnet.

**Beat 0 — Reference Card:**
- Beat 0 response includes a `---REFERENCE---` JSON block
- Parsed by `parseScenarioResponse()` (`src/lib/assessment/parse-scenario-response.ts`) in the store
- `splitSentences()` uses hardened regex with lookbehinds for decimals, abbreviations (Dr., e.g., etc.), and unit suffixes — fragments < 2 words are filtered out
- `cleanText()` strips markdown, beat headers, bracket tags, and structural markers before sentence splitting
- Renders as `ScenarioReferenceCard` component (right panel on desktop, collapsible on mobile)
- Progressive reveal: sections animate in one-by-one as sentences play via `referenceRevealCount` state

**Beats 1–5 — Branching:**
- After candidate responds, `classifyResponse()` classifies as STRONG/ADEQUATE/WEAK
- Next beat's Aria text is the corresponding branch from the beat template
- Optional `---REFERENCE_UPDATE---` JSON adds new information to the reference card

**Reference Card structure:**
```typescript
{
  role: string,         // Candidate's role in scenario
  context: string,      // Brief scenario context
  sections: Array<{
    label: string,      // "The System", "The Problem", "Constraints"
    items: string[]     // Bullet points
  }>,
  question: string,     // The current question Aria is asking
  newInformation?: string  // For REFERENCE_UPDATE beats
}
```

**Act 1 silence thresholds:**
- 30s → First nudge: "Take your time — I'm here whenever you're ready."
- 55s → Second nudge: "Tap the microphone or type your thoughts."
- 90s → Final nudge + auto-advance

### Act 1 → Act 2 Transition

`buildTransition1to2(callbacks)` plays a scripted transition:
- Aria narrates: "You handled those scenarios well. Now we shift gears."
- `onOrbCompress` callback fires → orb shrinks from FULL (160px) to COMPACT (72px)
- `onActLabelChange` callback fires → `ActLabel` crossfades to "Act 2 — Precision Gauntlet"
- `onComplete` fires → engine transitions state to ACT_2

### Act 2: Precision Gauntlet

5 constructs, each with a 4-phase adaptive psychometric loop.

**Constructs tested:** QUANTITATIVE_REASONING, SPATIAL_VISUALIZATION, MECHANICAL_REASONING, PATTERN_RECOGNITION, FLUID_REASONING

**File:** `src/lib/assessment/adaptive-loop.ts`

#### Phase 1: Calibration (2–3 items)
Items at varied difficulty levels to establish rough ability placement.
- Items at difficulty 0.2, 0.5, 0.8
- After 3 items (or 2 if easy items missed) → advance to BOUNDARY_MAPPING

#### Phase 2: Boundary Mapping (3–5 items)
Find the threshold where accuracy drops from consistent to inconsistent.
```
boundary = (confirmedFloor + confirmedCeiling) / 2
confidence = based on item count + boundary stability
```
- Transition at confidence ≥ 0.7 OR 5 items served
- `confirmedFloor`: highest difficulty with correct response
- `confirmedCeiling`: lowest difficulty with incorrect response

#### Phase 3: Pressure Test (2–3 items)
Confirm the boundary from a different problem variant or subtype.
- Re-test items at computed boundary ±0.1 difficulty
- `evaluatePressureTest()`: if boundary shifts > 0.15 → extend boundary mapping; else confirm
- Max 3 items

#### Phase 4: Diagnostic Probe (conversational)
Aria asks a guided reflection question: "Walk me through what you were thinking on that last problem — where did it get difficult?"
- AI evaluates response for ceiling type language
- Updates `AdaptiveLoopState.ceilingType` based on response patterns
- No new item served

**Item Bank:**
**File:** `src/lib/assessment/item-bank.ts`

`ITEM_BANK`: Static array of `Act2Item` objects. Example structure:

```typescript
{
  id: "qr-001",
  construct: "QUANTITATIVE_REASONING",
  subType: "multi-variable",
  difficulty: 0.65,
  difficultyLevel: 3,
  prompt: "A production line processes 480 units/hour at 95% yield. If downtime increases by 12 minutes/hour...",
  elementType: "NUMERIC_INPUT",
  correctAnswer: "418",
  timingExpectations: { fast: 30000, typical: 90000, slow: 180000 },
  distractorRationale: "..."
}
```

**Item types:**
- `MULTIPLE_CHOICE_INLINE` — 4 options, rendered as choice cards
- `NUMERIC_INPUT` — Free numeric entry with unit label
- `TIMED_CHALLENGE` — Countdown timer (typically 45–90s), choice cards

**Spatial visualization items** include `imageUrl` pointing to static SVG diagrams.

**Act 2 silence thresholds:**
- 15s → First nudge
- 30s → Second nudge
- 45s → Final nudge + auto-advance

### Act 2 → Act 3 Transition

`buildTransition2to3(callbacks)`:
- Aria: "We're in the final stretch now..."
- Orb expands from COMPACT → FULL
- ActLabel crossfades to "Act 3 — Calibration & Consistency"
- `clearInteractiveElement()` in store

### Act 3: Calibration & Consistency Audit

Three sequential phases:

#### Phase 1: Confidence-Tagged Items (3 items)
- Re-present Act 2 items (or structurally similar items)
- After candidate answers: show `CONFIDENCE_RATING` element (VERY_CONFIDENT / SOMEWHAT_CONFIDENT / NOT_SURE)
- Scores calibration accuracy: `calibrationScore = |confidence - accuracy|` (lower = better calibrated)

#### Phase 2: Parallel Scenarios (2 scenarios)
- Structurally identical to Act 1 scenarios but different surface content (different industry, different names)
- Same rubric indicators → enables Act 1 vs Act 3 consistency comparison
- Scored identically to Act 1 Layer B

#### Phase 3: Reflective Self-Assessment (conversational)
Aria: "Which parts felt most uncertain, and why? Were there moments where you weren't sure you were on the right track?"
- Open response, scored for metacognitive construct
- No classification branching; single response

**Act 3 silence thresholds:**
- 25s → First nudge
- 50s → Second nudge
- 75s → Final nudge + auto-advance

### Completion

Engine returns COMPLETE action when all Act 3 phases are done.

`buildCompletionScript(callbacks)`:
- Aria: "That's everything — you've done a remarkable job today."
- Orb settles (amplitude to 0)
- Subtitles fade with 2s delay
- `isComplete = true` → assessment stage shows completion card

Completion card:
- Thank-you message
- POST `complete` endpoint is triggered
- Redirect to `/assess/[token]/thank-you`

---

## Section 11: TTS Engine & Audio

**File:** `src/components/assessment/voice/tts-engine.ts`

### Architecture

ElevenLabs streaming API → `AudioContext` (Web Audio API) → `AnalyserNode` → amplitude data → orb animation.

**Streaming with gapless playback:**
1. Split text into sentences via internal `chunkText()` — or skip if `preSplit = true` (caller already split)
2. Fetch each sentence from ElevenLabs as ArrayBuffer (via `/api/assess/[token]/tts` proxy route)
3. Decode to `AudioBuffer` immediately
4. Pipeline: first chunk plays immediately while remaining chunks fetch in background
5. `AnalyserNode` reads amplitude data at 60fps → `setAudioAmplitude()` in store
6. Session-level `audioCache` (Map<text, AudioBuffer[]>) prevents re-fetching on replay

**`preSplit` parameter (v1.13):** When `playSentenceSequence` calls `speak()` per-sentence, it passes `preSplit = true` to skip the internal `chunkText()` re-splitting. This prevents double-splitting that fragmented decimals, units, and abbreviations into tiny audio chunks.

**TTS Proxy:** `src/app/api/assess/[token]/tts/route.ts`
- Proxies to ElevenLabs API (hides API key)
- Token-scoped: validates assessment invitation token before proxying
- Request: `{ text: string }`
- Response: streaming audio bytes
- Returns `{ fallback: true }` on ElevenLabs failure → client switches to browser SpeechSynthesis

**`onPlaybackStart` callback:**
- Fires when the first chunk starts playing (remaining chunks fetch in background)
- Provides `totalDurationSec` (estimated: `firstBuffer.duration × chunks.length`) → drives subtitle word reveal animation
- `speakFallback()` estimates duration as `wordCount × 0.4`

**Prefetch (N+1 lookahead):** `playSentenceSequence` calls `ttsRef.current.prefetch(nextSentence, token)` while the current sentence plays, pre-fetching and decoding audio into the session cache to eliminate inter-sentence latency.

### SpeechSynthesis Fallback

If ElevenLabs is unavailable or `ttsFallbackActive = true`:
- `window.speechSynthesis.speak(new SpeechSynthesisUtterance(text))`
- Duration estimated via word count
- `onPlaybackStart` still fires with estimated duration
- Orb shows at fixed amplitude (no real amplitude data)

### Race Condition Prevention

**Server-side:** `sequenceOrder` on `ConversationMessage`:
- Monotonically increasing per assessment
- Client tracks last received sequence
- Discards out-of-order TTS triggers
- Prevents double-play if two messages arrive simultaneously

**Client-side:** `ttsSequenceActiveRef` + `sequenceIdRef`:
- `ttsSequenceActiveRef` (boolean ref): set `true` when `playSentenceSequence` starts, `false` when it ends
- `displayEvent` useEffect early-returns when `ttsSequenceActiveRef` is true, preventing competing sequences
- `sequenceIdRef` (incrementing counter): each `playSentenceSequence` call gets a unique ID; inner loop breaks if `sequenceIdRef.current !== myId` (sequence was superseded)

**Sentence pacing:**
- `MIN_SENTENCE_MS = 2500`: each sentence gets at least 2.5 seconds of display time even if TTS fails
- 150ms inter-sentence pause between sentences
- `validSentences` filter removes fragments < 2 words before playback

---

## Section 12: Assessment State Machine (Engine)

**File:** `src/lib/assessment/engine.ts`

### `getNextAction(state, messages, lastCandidateMessage)`

Returns `EngineAction`:
```typescript
type EngineAction =
  | { type: "AGENT_MESSAGE"; systemPrompt: string; context: string }
  | { type: "INTERACTIVE_ELEMENT"; element: InteractiveElement }
  | { type: "TRANSITION"; to: AssessmentAct; script: TransitionScript }
  | { type: "COMPLETE"; script: CompletionScript }
```

### State Transitions

```
PHASE_0 → (phase_0_complete trigger) → ACT_1
ACT_1 → (scenario 3, beat 5 complete) → TRANSITION → ACT_2
ACT_2 → (all 5 constructs complete) → TRANSITION → ACT_3
ACT_3 → (all 3 phases complete) → COMPLETE
```

### Act 1 State Tracking
- `currentScenario`: 0–3
- `currentBeat`: 0–5
- `branchPath`: classification per beat (array of STRONG/ADEQUATE/WEAK)
- Scenario change: currentBeat → 0, currentScenario++

### Act 2 State Tracking
- `currentConstruct`: current construct index
- `currentPhase`: CALIBRATION | BOUNDARY_MAPPING | PRESSURE_TEST | DIAGNOSTIC_PROBE
- `act2Progress`: `{ [construct]: AdaptiveLoopState }` — full state per construct
- Construct change: load next construct from `ASSESSMENT_STRUCTURE.act2Constructs`

### Act 3 State Tracking
- `act3Progress.confidenceItemsComplete`: 0 → 3
- `act3Progress.parallelScenariosComplete`: 0 → 2
- `act3Progress.selfAssessmentComplete`: false → true

---

## Section 13: Response Classification

**File:** `src/lib/assessment/classification.ts`

### `classifyResponse(candidateResponse, scenario, beat, conversationHistory, roleContext)`

**Strategy:** Dual independent AI evaluation for reliability.
- Run 2 parallel `classifyOnce()` calls (each: a single Haiku call)
- If both return same classification → use higher `rubricScore`
- If they disagree → use more conservative result (lower rubricScore)

**ClassificationResult:**
```typescript
{
  classification: "STRONG" | "ADEQUATE" | "WEAK",
  indicatorsPresent: string[],
  indicatorsAbsent: string[],
  rubricScore: number,            // 0.0–1.0 confidence
  constructSignals: {
    [construct: string]: {
      signalStrength: number,     // 0.0–1.0
      evidence: string            // quoted text from response
    }
  },
  branchRationale: string,        // 1–2 sentence internal justification
  isFallback: boolean
}
```

**Fallback (AI unavailable):**
- Word count < 10 → WEAK (rubricScore: 0.25)
- Otherwise → ADEQUATE (rubricScore: 0.50)
- Never STRONG without AI confirmation

**Error handling (v1.13):** `classifyResponse()` is wrapped in try/catch in the chat route. If classification fails (API timeout, JSON parse error, rate limit), the error is logged and the request proceeds without classification — the streaming path generates the next beat content using an ADEQUATE default. This prevents classification failures from crashing the entire candidate session.

**Prompt Safety:**
- Conversation history sanitized: 500 chars per line, 4000 chars total
- XML-like tags stripped
- Candidate response wrapped in `<candidate_response>` tags
- Embedded `</candidate_response>` tokens escaped

---

## Section 14: Nudge System

**File:** `src/lib/assessment/nudge-system.ts`

### NudgeManager Class

Monitors silence duration after Aria finishes speaking. Three escalating interventions per context.

**Silence thresholds (in seconds):**

| Context | First | Second | Final |
|---------|-------|--------|-------|
| phase_0 | 15 | 30 | 45 |
| act_1   | 30 | 55 | 90 |
| act_2   | 15 | 30 | 45 |
| act_3   | 25 | 50 | 75 |

**First nudge** — Supportive, no pressure:
- "Take your time — there's no rush."
- "No pressure — take a moment if you need it."

**Second nudge** — Offer text fallback:
- "If you'd prefer to type your response, that's completely fine too."
- "You can type your answer if that's easier."

**Final nudge** — Auto-advance:
- "No worries — let's move on."
- "Let's continue with the next question."

**Methods:**
```typescript
start(context: NudgeContext, callbacks: NudgeCallbacks): void
reset(): void           // Candidate started responding
pause(): void           // During transitions
resume(): void          // After transition completes
stop(): void            // Session ending
isPaused(): boolean
```

---

## Section 15: Act Transitions

**File:** `src/lib/assessment/transitions.ts`

### TransitionScript

Ordered array of `TransitionLine`:
```typescript
{
  text: string,
  callback?: "orbCompress" | "orbExpand" | "actLabelChange" | "clearInteractive" | "subtitleFade",
  callbackDelay?: number,   // ms delay before callback fires
  pauseAfter?: number       // ms pause after line before next
}
```

### `buildTransition1to2(callbacks)`
```
"You handled those scenarios well."
"Now we're going to shift gears into something more structured."
→ [callback: orbCompress at 500ms]
→ [callback: actLabelChange to "Precision Gauntlet" at 1000ms]
"This next section focuses on precise analytical problems."
```

### `buildTransition2to3(callbacks)`
```
"We're in the final stretch now — great work getting here."
→ [callback: orbExpand at 1000ms]
→ [callback: actLabelChange to "Calibration & Consistency" at 1500ms]
"This last section helps us calibrate what we've seen so far."
```

### `buildCompletionScript(candidateName, callbacks)`
```
"That's everything, {candidateName} — you've done a remarkable job today."
"Your results will be processed and shared with the hiring team shortly."
→ [callback: orbSettle]
→ [callback: subtitleFade at 2000ms]
```

---

## Section 16: Chat API Route

**File:** `src/app/api/assess/[token]/chat/route.ts`

### POST Handler

**Request body:**
```typescript
{
  messages?: ChatMessage[],
  elementResponse?: {
    elementType: InteractionElementType,
    value: string | number,
    itemId?: string,
    construct?: string,
    responseTimeMs?: number
  },
  trigger?: "phase_0_message" | "phase_0_complete"
}
```

**Processing flow:**
1. Validate token → load invitation + candidate + role
2. Rate limit check (per-token)
3. Handle special triggers:
   - `phase_0_message`: Persist scripted messages, return `{ type: "phase_0_ack" }`
   - `phase_0_complete`: Set `phase0Complete = true`, transition to ACT_1
4. Handle `elementResponse`:
   - Persist `ConversationMessage` with elementType, elementData, candidateInput, responseTimeMs
   - Persist `ItemResponse`
   - If Act 2: `recordResult()` → update `act2Progress` in state
   - Optimistic lock via `AssessmentState.updatedAt`
5. `getNextAction(state, messages, lastCandidateMessage)`
6. Execute action:
   - `AGENT_MESSAGE` with content library: `lookupBeatContent()` → `generateAcknowledgment()` → return JSON
   - `AGENT_MESSAGE` streaming: `streamText()` with Haiku → stream → `onFinish` persists to DB
   - `INTERACTIVE_ELEMENT`: persist to DB, return JSON (strip `correctAnswer`)
   - `TRANSITION`: persist transition messages, update state
   - `COMPLETE`: persist completion message, update state

**Concurrency safety:**
- `nextSequenceOrder()`: `MAX(sequenceOrder) + 1` per assessment
- State updates use `AssessmentState.updatedAt` version check
- Transactional element response + state update in single Prisma transaction

**Error handling layers (v1.13):**

| Layer | Scope | Response | Logging |
|-------|-------|----------|---------|
| Outer try/catch | Entire POST body | 500 + `"Internal server error"` (detail in dev) | `log.error("Unhandled error in chat route", { stateSnapshot })` |
| Classification try/catch | `classifyResponse()` only | Fall through with ADEQUATE default | `log.error("Classification failed", { beat, scenario })` |
| Content library try/catch | `loadContentLibrary()` + `lookupBeatContent()` only | Fall through to streaming path | `log.error("Beat 0 content library lookup failed")` |
| Streaming try/catch | `streamText()` call | 502 + `"AI response generation failed"` | `log.error("Streaming failed", { model, act, beat })` |
| `onFinish` try/catch | DB persistence after streaming | Silent (stream already sent) | `log.error("onFinish failed", { assessmentId })` |

**Diagnostic logging:**
- `log.info("Assessment state loaded", { contentLibraryId, hasVariants })` — after state creation
- `log.info("Entering streaming path", { act, beat, hasContentLibrary })` — before streaming
- `log.info("Classification complete", { classification, rubricScore })` — after successful classification
- `log.info("State after classification", { act, beat, scenario, construct })` — after state update

### GET Handler

Returns session recovery data:
- Assessment state (currentAct, progress)
- Message history (AGENT → assistant, CANDIDATE → user)
- `correctAnswer` stripped from elementData
- Active incomplete interactive element (for session resume)

---

## Section 17: Assessment Start & Complete Routes

### `POST /api/assess/[token]/start`
**File:** `src/app/api/assess/[token]/start/route.ts`

1. Load `AssessmentInvitation` where `linkToken = token`
2. Validate: not expired, status = PENDING or STARTED
3. If no existing Assessment: create with `startedAt = now()`
4. Update invitation: `status = STARTED`, `linkOpenedAt` if null
5. Update candidate: `status = INCOMPLETE`
6. Return `{ assessmentId }`

### `POST /api/assess/[token]/complete`
**File:** `src/app/api/assess/[token]/complete/route.ts`

1. Rate limit check
2. Load assessment, confirm not already completed
3. Atomic transaction:
   - `assessment.completedAt = now()`
   - `assessment.durationMinutes = round((now - startedAt) / 60000)`
   - `invitation.status = COMPLETED`
   - `candidate.status = SCORING`
4. Fire `runPipelineWithRetry(assessmentId)` — non-blocking (no `await`)
5. Return `{ success: true, durationMinutes }`

---

## Section 18: Frontend Application

### Design System

**CSS variables** defined in `src/app/globals.css`:
```css
--aci-gold: hsl(43 74% 66%)       /* Primary brand accent */
--aci-navy: hsl(220 45% 8%)        /* Deep background */
--background: var(--aci-navy)
--foreground: hsl(220 10% 95%)
--card: hsl(220 40% 12%)
--border: hsl(220 30% 20%)
--muted-foreground: hsl(220 10% 60%)
```

**Typography:** System monospace for labels, sans-serif for body.

### Routes

#### Dashboard Group `(dashboard)/`

| Route | Component | Data |
|-------|-----------|------|
| `/dashboard` | Pipeline overview | `getDashboardData()` |
| `/candidates/[id]` | `ProfileClient` | `getCandidateData()` |
| `/roles` | Role list | `getRolesData()` |
| `/roles/[slug]` | Role detail + pipeline | `getRoleDetailData()` |
| `/roles/new` | `InputClient` | — |
| `/compare?ids=...` | Comparison table + charts | `getCompareData()` |

#### Assessment Group `(assess)/`

| Route | Component | Notes |
|-------|-----------|-------|
| `/assess/[token]` | Welcome screen | Token validation gate |
| `/assess/[token]/v2` | `AssessmentStage` | Main experience |
| `/assess/[token]/survey` | Survey form | Optional, post-completion |
| `/assess/[token]/thank-you` | Completion confirmation | — |

#### Tutorial Group `/tutorial/`

| Route | Component | Notes |
|-------|-----------|-------|
| `/tutorial` | `AudienceSelector` | Industry picker |
| `/tutorial/dashboard` | Same as `/dashboard` | Demo org data |
| `/tutorial/roles` | Same as `/roles` | Demo org data |
| `/tutorial/roles/[slug]` | Same as `/roles/[slug]` | Demo org data |
| `/tutorial/roles/new` | `RoleBuilderReadonly` | Overlaid InputClient |
| `/tutorial/candidates/[id]` | `ProfileClient` | Demo org data |
| `/tutorial/compare` | Comparison | Demo org data |
| `/tutorial/assessment` | `TutorialAssessmentStage` | Scripted mini assessment |

### Key Client Components

#### `ProfileClient` (`src/components/profile/profile-client.tsx`)
Full candidate profile. Sections:
- Header: name, role, company, status badge
- `SpiderChart`: Radar chart of all 12 construct percentiles
- `PredictionsGrid`: 4 prediction cards (ramp time, supervision load, performance ceiling, attrition risk)
- Construct breakdown table: layerA, layerB, consistency, ceiling type
- CompositeScore summaries with cutline indicators
- RedFlags list (sorted by severity: CRITICAL → WARNING → INFO)
- PDF export button (renders profile as printable PDF)
- Notes panel (team annotations)
- Outcome records (if tracked)

#### `InputClient` (`src/components/role-builder/input-client.tsx`)
Role builder UI. Accepts:
- Job description text paste
- O*NET code lookup
- Manual construct weight sliders
On submit → `POST /api/generate` → streams role context + suggested weights + hiring intelligence → renders `HiringIntelligenceBrief`

#### `AssessmentStage` (`src/components/assessment/stage/assessment-stage.tsx`)
Main assessment orchestrator (described exhaustively in Section 10).

---

## Section 19: Client State Management

### `useChatAssessmentStore` (`src/stores/chat-assessment-store.ts`)

Zustand store managing the entire candidate-side assessment experience.

**Identity:**
```typescript
token: string
assessmentId: string
```

**Display:**
```typescript
subtitleText: string
subtitleRevealedWords: number
sentenceList: string[]
currentSentenceIndex: number
referenceCard: ScenarioReferenceData | null
referenceRevealCount: number            // -1 = show all; N = progressive reveal
orbMode: "idle" | "speaking" | "listening" | "processing"
displayEvent: number                    // Increment triggers re-renders
displayIsHistory: boolean
```

**Interactive Elements:**
```typescript
activeElement: {
  elementType: InteractionElementType
  elementData: Record<string, unknown>
  responded: boolean
} | null
```

**Progress:**
```typescript
currentAct: AssessmentAct
isComplete: boolean
orchestratorPhase: OrchestratorPhase    // PHASE_0 | TRANSITION_0_1 | ACT_1 | ...
actProgress: {
  act1: number,    // scenarios complete
  act2: number,    // constructs complete
  act3: number     // phases complete
}
```

**Orb:**
```typescript
orbSize: "full" | "compact"
orbTargetSize: number                   // px
audioAmplitude: number                  // 0–255 from AnalyserNode
```

**TTS:**
```typescript
isTTSPlaying: boolean
ttsFallbackActive: boolean
```

**Input:**
```typescript
inputMode: "voice" | "text"
candidateTranscript: string
showTranscript: boolean
isTransitioning: boolean
```

**Timer:**
```typescript
timerActive: boolean
timerSeconds: number
```

**Key actions:**
```typescript
init(token, assessmentId): void
loadHistory(messages, state?): void
displayMessage(content, act, isHistory): void
sendMessage(content): Promise<void>
sendElementResponse(response): Promise<void>
setActiveElement(element): void
clearActiveElement(): void
setOrbMode(mode): void
setAudioAmplitude(amplitude): void
setReferenceCard(card): void
setReferenceRevealCount(n): void
setTimerActive(active, seconds?): void
setInputMode(mode): void
setIsTransitioning(v): void
```

**Error handling (v1.13):** `sendMessage()` catch block maps HTTP status codes to user-friendly messages:
- 500 → "Something went wrong on our end. Please try again in a moment."
- 502 → "The AI service is temporarily unavailable. Please try again."
- 429 → "Too many requests. Please wait a moment and try again."
- Timeout → "The response timed out. Please try again."
- Other → "Something went wrong. Please try again."

Error is set on `error` state field and displayed as a toast. Cleared automatically on next `sendMessage()` call (line 331: `error: null`).

### `useAppStore` (`src/stores/app-store.ts`)

Zustand store with `persist` middleware (cookie storage, key `aci-tutorial`).

**State:**
```typescript
mode: "live" | "tutorial"
tutorialStep: number | null
tutorialIndustry: TutorialIndustry | null
// TutorialIndustry = "defense-manufacturing" | "space-satellite" | "hardware-ai" | "ai-software"
```

**Persisted:** Only `tutorialIndustry` (to cookie, max-age=86400).

**Cookie format:** Zustand persist wraps as `{"state":{"tutorialIndustry":"..."},"version":0}`.

**Server-side reading (in tutorial pages):**
```typescript
const raw = cookieStore.get("aci-tutorial")?.value;
const _parsed = raw ? JSON.parse(decodeURIComponent(raw)) : null;
const industry = (_parsed?.state?.tutorialIndustry ?? _parsed?.tutorialIndustry ?? null) as string | null;
```

---

## Section 20: Tutorial / Demo System

### Overview

The tutorial system (`/tutorial/*`) is a production-identical experience for prospects. No "DEMO" watermarks. Four industry verticals with distinct seed data.

### Audience Selector (`/tutorial`)

**File:** `src/components/tutorial/audience-selector.tsx`

4-card industry grid. On selection: stores `tutorialIndustry` in Zustand (persisted to cookie) → navigates to `/tutorial/dashboard`.

| Industry ID | Display Name | Demo Org | Sample Roles |
|-------------|-------------|----------|-------------|
| defense-manufacturing | Defense & Aerospace Manufacturing | Atlas Defense Corp | Factory Technician, CNC Machinist, Manufacturing Engineer |
| space-satellite | Space & Satellite Systems | Orbital Dynamics | Systems Engineer, Propulsion Engineer, Test Engineer |
| hardware-ai | Hardware + AI / Robotics | Nexus Robotics | Robotics Engineer, Firmware Engineer, ML Engineer |
| ai-software | AI & Software | Vertex AI Labs | Senior AI Engineer, Software Engineer, ML Engineer, AI Research Scientist, Data Engineer |

### Industry Routing

All tutorial pages read the cookie and pass `industry` to `getDemoOrgId()`:

```typescript
// src/lib/data.ts
const DEMO_ORG_SLUGS: Record<string, string> = {
  "defense-manufacturing": "atlas-defense",
  "space-satellite":       "orbital-dynamics",
  "hardware-ai":           "nexus-robotics",
  "ai-software":           "vertex-ai-labs",
};

export async function getDemoOrgId(industry?: string | null): Promise<string | null> {
  const slug = industry ? DEMO_ORG_SLUGS[industry] : null;
  const org = await prisma.organization.findFirst({
    where: slug ? { slug, isDemo: true } : { isDemo: true },
  });
  return org?.id ?? null;
}
```

If `getDemoOrgId()` returns null (no matching org), tutorial pages redirect to `/tutorial` (audience selector).

### Read-Only Role Builder

**Files:**
- `src/app/tutorial/roles/new/page.tsx`
- `src/components/tutorial/role-builder-readonly.tsx`

Renders `InputClient` inside a container with an absolute overlay:
- Underlying form: `pointer-events: none; opacity: 0.5`
- Overlay message: "Role Builder is available in your live dashboard."
- Overlay: `pointer-events: all` (intercepted — doesn't pass through)

### Mini Assessment (Tutorial)

**Files:**
- `src/app/tutorial/assessment/page.tsx`
- `src/app/tutorial/assessment/layout.tsx` — Empty layout (no nav)
- `src/components/tutorial/tutorial-assessment-stage.tsx`
- `src/lib/tutorial/mini-assessment-script.ts`

**Architecture:** `TutorialRunner` drives `useChatAssessmentStore` directly via setters. No API calls. Uses `TutorialTTSEngine` (ElevenLabs → browser SpeechSynthesis fallback).

**8-step scripted script:**

| # | Step | Type | Content |
|---|------|------|---------|
| 1 | `intro` | Narration | Aria self-introduction, demo format explanation |
| 2 | `mic-check` | Voice/text prompt | "Tell me what brings you here today" |
| 3 | `act1-setup` | Reference card | Satellite payload thermal margin scenario |
| 4 | `act1-question` | Multiple choice (4 options) | First-move prioritization question |
| 5 | `act1-ack` | Narration | Varies by A/B/C/D answer |
| 6 | `act2-timed` | Timed multiple choice (45s) | Manufacturing throughput/yield calculation |
| 7 | `act2-numeric` | Numeric input | Pipeline flow branching problem |
| 8 | `act3-reflect` | Voice/text prompt | "Which question felt most uncertain, and why?" |
| 9 | `complete` | Completion card | CTA → `/tutorial/dashboard` |

**TutorialTTSEngine:**
- Tries `/public/audio/tutorial/{stepId}.mp3` first
- Falls back to `window.speechSynthesis`
- `onPlaybackStart(durationSec)` callback for word reveal sync

**Audio generation (one-time offline):**
`scripts/generate-tutorial-audio.ts` — ElevenLabs calls per step, writes MP3s to `public/audio/tutorial/`.

---

## Section 21: Email System

**File:** `src/lib/email.ts`

### Assessment Invitation Email
Sent by: RECRUITER_COORDINATOR and above
- Triggered manually from candidate detail or invite flow
- Template: candidate name, role, company, assessment link (using `linkToken`)
- Records `emailSentAt` on AssessmentInvitation

### Results Notification Email
Sent to: hiring manager assigned to candidate
- Triggered: scoring pipeline completion (after status determined)
- Content: status (Recommended/Review/Do Not Advance), composite summary
- Records `resultsEmailSentAt` on Candidate

### Team Invitation Email
Sent by: ADMIN
- Token-based invite URL → `/auth/accept-invite/[token]`
- Includes role assignment
- Records TeamInvitation.emailSentAt

---

## Section 22: Role Builder & JD Processing

### `POST /api/generate`
**File:** `src/app/api/generate/route.ts`

Accepts a job description text or O*NET codes. Streams a structured role analysis:
1. Parse JD text → extract: environment, key skills, tasks, consequence of error
2. Select O*NET codes
3. Determine `complexityLevel`
4. Suggest construct weights (RESEARCH_VALIDATED source)
5. Generate `hiringIntelligence` brief
6. Store in `Role.jdContext`, `Role.onetCodes`, `Role.hiringIntelligence`

**Uses Sonnet** for JD parsing and construct weight research.

---

## Section 23: Data Access Functions

**File:** `src/lib/data.ts`

### `getDashboardData(orgId?, opts?)`
- Returns candidates (with role, assessment, compositeScores, redFlags) + rolePipelines + stats
- `stats`: totalAssessed, strongFitRate (% RECOMMENDED), avgDuration, weeklyVolume
- RBAC: EC users see only assigned candidates

### `getCandidateData(id, orgId?, opts?)`
- Full candidate with primaryRole, notes, assessment, subtestResults, compositeScores, predictions, redFlags, aiInteractions, outcomes
- Includes `allRoles` with compositeWeights and cutlines

### `getRolesData(orgId?)`
- All roles with compositeWeights, cutlines, candidate pipelines

### `getCompareData(ids[], orgId?)`
- Multi-candidate: subtestResults, compositeScores, predictions, redFlags per candidate

### `getHeatmapData(orgId?)`
- Construct × candidate heatmap data

### `getRoleDetailData(slug, orgId)`
- Single role with full candidate list + construct scores

### `getDemoOrgId(industry?)`
- Demo org lookup by industry segment slug

---

## Section 24: Access Control & Onboarding

### Organization Creation
1. Admin creates org (name, slug, domain)
2. Admin invites first user with ADMIN role
3. Admin configures roles (JD upload or manual)
4. Admin sets cutlines
5. Recruiter invites candidates

### Authentication
- **NextAuth v5** with magic link email (passwordless)
- OAuth providers (Google) available
- Session: JWT with user role and orgId
- Server-side: `auth()` from `src/lib/auth.ts`

### Session Usage in Pages
```typescript
const session = await auth();
if (!session?.user?.orgId) redirect("/auth/signin");
const orgId = session.user.orgId;
const userRole = session.user.role;
```

---

## Section 25: Security & Compliance

### Prompt Injection Prevention
- `sanitizeForPrompt()` (`src/lib/assessment/role-context.ts`): strips control characters, XML structural tags (`<system>`, `<human>`, `<assistant>`), code fences, and enforces per-field length limits
- Candidate responses wrapped in `<candidate_response>` delimiters with escape handling
- Length limits: 500 chars per message in history, 4000 total
- `</candidate_response>` embedded tokens escaped

### Answer Leakage Prevention
- GET `/api/assess/[token]/chat` strips `correctAnswer` from `elementData`
- `correctAnswer` never sent to client after initial element serve
- `import "server-only"` guard on item bank — build error if imported from client component

### Rate Limiting
- Per-token rate limits on chat and complete endpoints via `src/lib/rate-limit.ts`
- Redis-backed (`@upstash/ratelimit`) when `UPSTASH_REDIS_REST_URL` configured — distributed enforcement across serverless isolates
- In-memory fallback when Redis unavailable (single-isolate enforcement)
- Prevents abuse of open assessment links

### Data Isolation
- All queries filter by `orgId` — no cross-tenant data access
- EC users further filtered by `CandidateAssignment`

### Token Security
- `linkToken` is UUID — not guessable
- Invitation expires (hard date: `expiresAt`)
- `status = EXPIRED` checked on every request

### Error Information Leakage Prevention
- Outer try/catch returns generic `"Internal server error"` to client
- Error `detail` field only included when `process.env.NODE_ENV === "development"`
- Stack traces logged server-side only, never sent to client
- Streaming failures return 502 with generic message, not the underlying AI error

### Optimistic Concurrency
- `AssessmentState.updatedAt` used as version check
- Prevents conflicting concurrent state updates

---

## Section 26: Test Infrastructure

### ASSESSMENT_TEST_MODE

Set `ASSESSMENT_TEST_MODE=true` in `.env.local`:
- Swaps `generationModel` → Haiku (from Sonnet)
- Sets `evaluationRunCount = 1` (from 3)
- No other behavioral changes

### Demo Seed Script

**File:** `prisma/seed-demo-only.ts`

Re-seeds all 4 demo orgs without touching production data. Runs standalone.

```bash
DATABASE_URL="postgresql://..." npx tsx prisma/seed-demo-only.ts
```

**Seeded orgs:**

| Slug | Display | Industry | Roles | Candidates |
|------|---------|----------|-------|-----------|
| atlas-defense | Atlas Defense Corp | defense-manufacturing | 5 | 6 |
| orbital-dynamics | Orbital Dynamics | space-satellite | 6 | 7 |
| nexus-robotics | Nexus Robotics | hardware-ai | 6 | 7 |
| vertex-ai-labs | Vertex AI Labs | ai-software | 9 | 10+ |

**Total:** 4 orgs, 26 roles, 73 candidates with full scored assessments.

### Create Test Invitation Script

**File:** `prisma/create-test-invitation.ts`

Wipes an existing assessment (cascade-safe) and creates a fresh invitation. Run with:

```bash
DATABASE_URL="postgresql://..." npx tsx prisma/create-test-invitation.ts
```

Output:
```
Candidate : Alex Johnson
Role      : Factory Technician

Test URL  : http://localhost:3000/assess/abc123-...
```

**Delete order (cascade-safe):**
1. `assessmentInvitation.deleteMany` where candidateId
2. Find existing assessment
3. `aIInteraction.deleteMany` where assessmentId
4. `redFlag.deleteMany` where assessmentId
5. `prediction.deleteMany` where assessmentId
6. `compositeScore.deleteMany` where assessmentId
7. `subtestResult.deleteMany` where assessmentId
8. `assessment.delete` where id
9. Create fresh `AssessmentInvitation`

### Prisma Script Requirements

Scripts using Prisma **must**:
- Reside in `prisma/` directory (for module resolution)
- Import from `../src/generated/prisma/client.js` (not `@prisma/client`)
- Import `pg` and `@prisma/adapter-pg` for the connection pool
- Import `dotenv/config` for env loading
- Pass `DATABASE_URL` explicitly if not in shell env

---

## Section 27: API Surface (Complete)

### Assessment Flow APIs

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/assess/[token]` | None | Welcome/gate page |
| POST | `/api/assess/[token]/start` | Token | Create assessment |
| GET | `/api/assess/[token]/chat` | Token | Load history |
| POST | `/api/assess/[token]/chat` | Token | Main chat |
| POST | `/api/assess/[token]/tts` | Token | ElevenLabs TTS proxy |
| POST | `/api/assess/[token]/complete` | Token | Finalize assessment |

### Dashboard APIs (Auth Required)

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| POST | `/api/generate` | Session | JD → role context (streaming) |
| POST | `/api/ingest` | Session | Trigger ContentLibrary generation |
| POST | `/api/score/[id]` | Session | Manual scoring re-run |

---

## Section 28: Implementation Statistics

| Metric | Value |
|--------|-------|
| Prisma models | 21 |
| Constructs measured | 12 |
| Assessment acts | 3 (+ Phase 0 warmup) |
| Act 1 scenarios | 4 |
| Beats per scenario | 6 |
| Act 2 constructs | 5 |
| Act 2 adaptive phases per construct | 4 |
| Act 3 confidence items | 3 |
| Act 3 parallel scenarios | 2 |
| Layer A weight | 55% |
| Layer B weight | 45% |
| AI evaluation runs (prod) | 3 |
| AI evaluation runs (test mode) | 1 |
| Scoring pipeline steps | 13 |
| Demo orgs | 4 |
| Demo roles | 26 |
| Demo candidates | 73 |
| Static item bank size | 60+ items |
| API routes | 9 (5 assessment + 3 dashboard + auth) |
| Tutorial industry verticals | 4 |

---

## Section 29: Roadmap

### Near-term (Q2 2026)

- ✅ Tutorial/Demo v2.0 (4 verticals, audience selector)
- ✅ ASSESSMENT_TEST_MODE for cost-effective dev testing
- ✅ Content Library (pre-generated assessment content)
- ✅ Architecture Audit Remediation (6-phase hardening: env validation, resilient HTTP, API wrappers, pipeline idempotency, Redis rate limiting, Sentry observability, security hardening, CI pipeline)
- ⏳ Tutorial mini assessment with pre-recorded audio
- ⏳ Outcome tracking dashboard (HR integration)
- ⏳ Role template library (20+ OOTB roles by vertical)

### Medium-term (Q3 2026)

- ⏳ Candidate portal (self-service result summary)
- ⏳ ATS integrations (Greenhouse, Lever, Workday)
- ⏳ Batch assessment management (cohort invites)
- ⏳ Longitudinal model refinement (OutcomeRecord → weight adjustment)
- ⏳ Mobile-native assessment experience

### Long-term

- ⏳ Generic aptitude assessment (no role context)
- ⏳ Video proctoring integration
- ⏳ Multi-language support (Spanish, Portuguese)
- ⏳ White-label deployment
- ⏳ In-house TTS (remove ElevenLabs dependency)

---

## Section 30: Success Metrics

### Assessment Quality
- Classification agreement rate (dual AI eval): target ≥ 85%
- Consistency rate (Act 1 vs Act 3 delta < 0.15): target ≥ 70%
- Candidate session completion rate: target ≥ 90%
- Average assessment duration: target 90–150 min

### Business
- Strong fit rate (% RECOMMENDED): tracked per org / role
- Ramp time accuracy: predicted vs actual (via OutcomeRecord)
- Supervisor rating correlation: r ≥ 0.6 target
- 90-day retention for RECOMMENDED candidates: target ≥ 85%

### Platform
- Chat API p95 latency: < 2s (content library path), < 8s (streaming path)
- Scoring pipeline p95: < 3 min
- TTS stream start latency: < 500ms
- Uptime: 99.9% SLA

---

*ACI PRD v1.14 — March 2026 — Confidential — Arklight*

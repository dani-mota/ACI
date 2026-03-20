# Security Assessment: ACI Assessment Platform

**Date:** 2026-03-19
**Assessor:** Security Threat Modeler (Claude Opus 4.6)
**Scope:** Full candidate assessment system -- token-based entry, conversational AI engine, scoring pipeline, TTS proxy, and all `/api/assess/[token]/*` endpoints.
**Previous Model:** 2026-03-13 (23 threats, 4 attack chains). This is a delta re-assessment incorporating code changes through commit `b67980a`.

---

## 1. Scope & Context

ACI is an AI-powered candidate assessment platform used in hiring workflows. Candidates receive a unique URL containing a `linkToken` (CUID), complete a three-act conversational assessment guided by an AI agent ("Aria"), and receive a score that influences hiring decisions.

**Data Classification:**
- **Candidate PII:** Name, email, organization affiliation (stored in Candidate model) -- MEDIUM sensitivity
- **Assessment transcripts:** Full conversation history, behavioral responses -- HIGH sensitivity (reveals cognitive abilities, behavioral patterns)
- **Scores and predictions:** Composite scores, construct-level breakdowns, red flags, ramp-time predictions, attrition risk -- HIGH sensitivity (employment decisions)
- **Item bank:** 96 psychometric items with correct answers -- CRITICAL sensitivity (assessment integrity depends on secrecy)
- **AI evaluation runs:** Raw LLM output with scoring rationale -- HIGH sensitivity (internal rubrics)

**Regulatory Context:**
- NYC Local Law 144 / Illinois AIPA / Colorado AI Act: Bias audit required for automated employment decision tools
- GDPR Art 22: Right to meaningful information about automated decision-making logic
- EU AI Act: High-risk classification (AI system used in employment/recruitment)
- EEOC: Adverse impact analysis required for algorithmic scoring
- ADA: Accommodation mechanism required for candidates with disabilities

---

## 2. Data Flow Summary

```
Candidate Browser
    |
    |-- GET /assess/[token]/v2 --> Next.js SSR (validates token, loads state)
    |-- POST /assess/[token]/start --> Creates Assessment record (NO RATE LIMIT)
    |-- POST /assess/[token]/chat --> Main assessment loop:
    |       |-- normalizeInput() --> classifyResponse() --> Anthropic API (Haiku)
    |       |-- getNextAction() (engine) --> dispatch() --> TurnBuilder --> Anthropic API (Haiku)
    |       |-- Persist messages to ConversationMessage table
    |       |-- Return Turn JSON to client
    |-- POST /assess/[token]/response --> Persist ItemResponse (structured answers)
    |-- POST /assess/[token]/tts --> ElevenLabs proxy (text -> audio stream)
    |-- GET  /assess/[token]/tts-config --> TTS availability/settings (leaks voiceId)
    |-- POST /assess/[token]/complete --> Mark complete, trigger scoring pipeline:
    |       |-- Layer A: Deterministic scoring (item-bank correctAnswer comparison)
    |       |-- Layer B: AI evaluation (Anthropic Sonnet, 3-run median)
    |       |-- Layer C: Ceiling characterization
    |       |-- Consistency validation, red flags, predictions
    |       |-- Atomic transaction to DB
    |-- POST /assess/[token]/survey --> Post-assessment feedback
    |
Dashboard (Supabase Auth)
    |-- Protected by middleware (Supabase session + org scope)
    |-- Reads scoring results, transcripts, predictions
```

---

## 3. Trust Boundaries

| ID | Boundary | Crossing | Enforcement | Adequacy |
|---|---|---|---|---|
| TB-1 | Internet -> Assess API | linkToken, candidate text, element responses | Token lookup + expiry check, rate limiting, input normalization (3000 char cap) | **WEAK** -- No session binding, no CORS, no CSRF, token in URL path |
| TB-2 | Internet -> Dashboard | Supabase session cookie | Supabase middleware protects `/dashboard`, `/candidates`, `/roles`, `/compare`, `/export`, `/invitations`, `/settings`, `/admin` | **ADEQUATE** -- Standard session auth with org scoping |
| TB-3 | API -> Anthropic Claude | System prompts + candidate text | XML escaping on `<candidate_response>` tags, history sanitization, explicit injection warnings in prompts | **MODERATE** -- Good defense-in-depth but relies on LLM compliance |
| TB-4 | API -> ElevenLabs | Server-side API key, text limited to 2000 chars | Key never exposed to client, text truncation | **ADEQUATE** |
| TB-5 | API -> PostgreSQL | Prisma ORM queries | Parameterized queries via Prisma | **GOOD** -- No raw SQL |
| TB-6 | Server -> Client (Turn JSON) | Assessment content, element data | `stripSensitiveFields()` removes correctAnswer + rubric data; `postBuildPipeline()` checks for leakage | **ADEQUATE** -- Defense-in-depth with whitelist stripping |
| TB-7 | Middleware boundary | `/api/assess/*` routes | **NOT protected by Supabase middleware** -- only linkToken validation per-route | **WEAK** -- Each route must self-enforce auth |

---

## 4. Threat Model (STRIDE)

### 4.1 Spoofing

| ID | Threat | STRIDE | Attack Vector | Severity | Likelihood | Current Mitigation | Status |
|---|---|---|---|---|---|---|---|
| T-01 | **Token theft via URL leakage** | Spoofing | linkToken in URL path leaks via browser history, HTTP Referer headers, shared screens, corporate proxy logs, browser extensions. Attacker replays token to impersonate candidate. | **HIGH** | **HIGH** | Token has expiry (`expiresAt`). No session binding, no IP/device lock. | **UNMITIGATED** |
| T-02 | **Token enumeration/brute-force** | Spoofing | CUID tokens are not cryptographically random (time-based prefix). Attacker guesses valid tokens by exploiting CUID structure. | **MEDIUM** | **LOW** | CUID has ~80 bits of entropy in random portion. Start route has no rate limit. | **PARTIAL** -- Entropy is adequate but start route lacks rate limiting |
| T-03 | **Concurrent session hijacking** | Spoofing | No mechanism prevents two browsers from using the same token simultaneously. Attacker and candidate can interact with the same assessment. | **HIGH** | **MEDIUM** | Optimistic concurrency on state updates (line 191-196 of chat/route.ts). No session exclusivity enforcement. | **UNMITIGATED** |
| T-04 | **Dev-mode role impersonation in production** | Spoofing | If `NODE_ENV` is not properly set in production, the `__dev_role` cookie in `auth.ts` (line 50-57) allows any authenticated user to escalate to any role including ADMIN. | **CRITICAL** | **LOW** (depends on deployment config) | Gated by `process.env.NODE_ENV === "development"`. Vercel sets this correctly by default. | **CONDITIONAL** -- Safe if Vercel, risky if self-hosted |

### 4.2 Tampering

| ID | Threat | STRIDE | Attack Vector | Severity | Likelihood | Current Mitigation | Status |
|---|---|---|---|---|---|---|---|
| T-05 | **Client-side response timing manipulation** | Tampering | Candidate modifies `responseTimeMs` sent in `elementResponse` to appear faster (better score). The `responseTimeMs` field is client-supplied and directly stored. | **MEDIUM** | **HIGH** | None. `responseTimeMs` is stored as-is (chat/route.ts line 265, response/route.ts line 69). Scoring pipeline uses it for Layer A weighting. | **UNMITIGATED** |
| T-06 | **Item response replay/overwrite** | Tampering | The `/response` endpoint uses `upsert` (line 57-79) keyed on `assessmentId_itemId`. A candidate can re-submit a different answer for the same item after seeing results of subsequent questions, effectively changing their answer retroactively. | **MEDIUM** | **MEDIUM** | Upsert is intentionally idempotent. No timestamp validation or answer-lock after first submission. | **UNMITIGATED** |
| T-07 | **Assessment state manipulation via crafted triggers** | Tampering | The chat route accepts `body.trigger` values like `phase_0_message`, `phase_0_complete` (lines 211-243). A candidate can send `phase_0_complete` to skip Phase 0 entirely or send arbitrary `phase_0_message` content. | **MEDIUM** | **MEDIUM** | Phase 0 messages are excluded from scoring (line 65 of pipeline.ts). Content is truncated to 5000 chars. | **PARTIAL** -- Scoring impact is nil but assessment flow can be manipulated |
| T-08 | **Element response field injection** | Tampering | `elementResponse.elementType`, `elementResponse.itemId`, and `elementResponse.construct` are truncated but not validated against known values (lines 122-126). A candidate could submit responses for items not yet served, or claim a different construct. | **MEDIUM** | **MEDIUM** | String truncation applied. ItemResponse upsert prevents duplicates per `assessmentId_itemId`. | **PARTIAL** |
| T-09 | **Sentinel message injection** | Tampering | Candidate sends literal `[BEGIN_ACT_2]` or `[NO_RESPONSE]` as chat text. `isSentinelMessage()` (input-schema.ts line 78-80) matches ANY `[ANYTHING]` pattern via regex `/^\[.+\]$/`. A candidate sending `[NO_RESPONSE]` forces WEAK classification; `[AUTO_ADVANCE]` forces ADEQUATE with beat advancement. | **HIGH** | **HIGH** | The regex at engine.ts line 119 (`/^\[.+\]$/.test(lastCandidateMessage.trim())`) catches this. But `normalizeInput()` does NOT strip bracket patterns from user text. If a user types exactly `[NO_RESPONSE]`, it matches `SENTINEL_MESSAGES` set (line 58) and is treated as sentinel. | **PARTIAL** -- Sentinel set matching catches known sentinels, but the regex catch-all is too broad |

### 4.3 Repudiation

| ID | Threat | STRIDE | Attack Vector | Severity | Likelihood | Current Mitigation | Status |
|---|---|---|---|---|---|---|---|
| T-10 | **No candidate identity verification** | Repudiation | A candidate can claim someone else took the assessment on their behalf (proxy test-taking). No biometric, photo ID, or proctoring mechanism exists. | **HIGH** | **HIGH** | None. linkToken is the sole identity proof. | **UNMITIGATED** -- Acceptable for current use case but must be documented as accepted risk |
| T-11 | **Insufficient audit trail for scoring** | Repudiation | Layer B AI evaluation runs are persisted with `rawOutput` (pipeline.ts line 505), but classification calls during Act 1 (classifyResponse) do not persist the raw AI output -- only the extracted classification and rubricScore. If a candidate disputes their score, the intermediate classification reasoning is lost. | **MEDIUM** | **LOW** | Classification results are logged but not persisted to DB. AIEvaluationRun records exist for Layer B only. | **PARTIAL** |

### 4.4 Information Disclosure

| ID | Threat | STRIDE | Attack Vector | Severity | Likelihood | Current Mitigation | Status |
|---|---|---|---|---|---|---|---|
| T-12 | **Item bank answers in source code** | Information Disclosure | All 96 items with `correctAnswer` fields are hardcoded in `item-bank.ts`. Any candidate who views the client bundle or server source can extract all correct answers. The file has `import "server-only"` (line 1), which prevents client-side import but does NOT prevent the values from leaking through API responses or build artifacts. | **CRITICAL** | **HIGH** | `import "server-only"` prevents direct client import. `stripSensitiveFields()` removes `correctAnswer` from Turn JSON. Legacy path (line 626) destructures it out. Chat route line 333 compares `elementResponse.value === item.correctAnswer` server-side only. | **PARTIAL** -- Server-side comparison is correct, but answers remain in source. A developer, contractor, or supply-chain attacker with repo access has all answers. |
| T-13 | **Assessment scoring rubrics in prompts** | Information Disclosure | Classification prompts (classification.ts lines 185-218) contain full rubric indicators with positiveCriteria and negativeCriteria, branch scripts, and few-shot examples showing exact STRONG/ADEQUATE/WEAK response patterns. A prompt injection that exfiltrates the system prompt reveals the entire scoring methodology. | **HIGH** | **MEDIUM** | Candidate text is wrapped in `<candidate_response>` tags with XML escaping. Explicit injection warnings in prompt text. Dual-eval classification. | **PARTIAL** -- Prompt injection is mitigated but not eliminated |
| T-14 | **Construct names and scoring signals leaked to client** | Information Disclosure | Turn JSON `signal` object includes `primaryConstructs` and `secondaryConstructs` arrays (dispatcher.ts line 227-228). These are sent to the client and reveal exactly which psychological constructs are being measured at each beat. | **MEDIUM** | **HIGH** | These are included in the Turn response sent to the browser. The client store and UI components consume them. | **UNMITIGATED** -- Constructs are visible in browser DevTools |
| T-15 | **TTS voice ID leaked via tts-config** | Information Disclosure | The `/tts-config` endpoint (line 66) returns the ElevenLabs `voiceId`. An attacker could use this to clone or identify the voice, or to make unauthorized TTS calls if they obtain the API key through other means. | **LOW** | **HIGH** | voiceId alone is not a credential. API key remains server-side. | **INFORMATIONAL** |
| T-16 | **Error messages leak internal state** | Information Disclosure | Sentry integration captures `stateSnapshot` (chat/route.ts line 156-164) containing `assessmentId`, `contentLibraryId`, act/scenario/beat positions. If Sentry DSN is exposed or error responses are verbose, this leaks assessment structure. | **LOW** | **LOW** | Error handling returns generic messages to client. Sentry capture is server-side only. | **ADEQUATE** |
| T-17 | **Cross-candidate data access via token** | Information Disclosure | Each token maps to exactly one candidateId. The assessment lookup uses `candidateId` from the invitation (chat/route.ts line 77), not the token directly. If a candidate has multiple invitations, `findFirst` (line 77) returns the most recent assessment. No risk of cross-candidate access. | **N/A** | **N/A** | Properly scoped by candidateId. | **MITIGATED** |

### 4.5 Denial of Service

| ID | Threat | STRIDE | Attack Vector | Severity | Likelihood | Current Mitigation | Status |
|---|---|---|---|---|---|---|---|
| T-18 | **LLM cost exhaustion** | DoS | Each chat turn triggers 1-2 Anthropic API calls (classification + generation). An attacker replaying requests at 30/min/token burns ~$0.01-0.02 per call. With multiple stolen tokens, cost can escalate. Layer B scoring is 3x parallel calls per construct (~15 calls per assessment completion). | **HIGH** | **MEDIUM** | Rate limiting: 30 chat/min, 5 complete/min per token. Circuit breaker on Haiku failures (3 consecutive, 2-min cooldown). Idempotency guard on Layer B (pipeline.ts line 190-244). | **PARTIAL** -- Rate limits exist but are per-token, not per-IP. An attacker with N tokens has N*30 req/min capacity. |
| T-19 | **Start route has no rate limit** | DoS | `POST /assess/[token]/start` (start/route.ts) has no rate limiting. An attacker can spam assessment creation. The `findUnique` + `$transaction` prevents duplicate assessments per candidate, but the DB queries themselves are unbounded. | **MEDIUM** | **MEDIUM** | Assessment creation is idempotent (returns existing if present). But each call hits DB twice. | **PARTIAL** |
| T-20 | **In-memory rate limiter bypass via cold starts** | DoS | The `checkRateLimit()` function used by chat, response, and TTS routes (rate-limit.ts line 131-136) is the synchronous in-memory variant. Even though Redis/Upstash is configured (lines 43-64), the synchronous `checkRateLimit` always uses in-memory (line 135). Only `checkRateLimitAsync` uses Redis (line 142). This means rate limits reset on every Vercel cold start and are per-isolate only. | **HIGH** | **HIGH** | `checkRateLimitAsync` exists but is NOT called by any route. All routes use `checkRateLimit` (synchronous, in-memory only). The Redis integration is dead code for the assessment flow. | **UNMITIGATED** |
| T-21 | **Scoring pipeline DoS** | DoS | The `/complete` endpoint triggers `runScoringPipeline` with `after()` (Vercel background execution). The pipeline makes ~15+ Anthropic API calls for Layer B evaluation. With 3 retries (exponential backoff), a single completion can burn up to 5 minutes of compute (`maxDuration = 300`). The TOCTOU race is mitigated by the transaction (complete/route.ts lines 54-81). | **MEDIUM** | **LOW** | Atomic transaction prevents double-completion. `after()` ensures pipeline doesn't block response. Rate limit of 5/min on complete endpoint. | **ADEQUATE** |
| T-22 | **ElevenLabs cost exhaustion via TTS proxy** | DoS | TTS endpoint rate limited at 60/min/token. Each call sends up to 2000 chars to ElevenLabs. At scale, this could exhaust ElevenLabs quota or budget. | **MEDIUM** | **MEDIUM** | Rate limiting present. Text capped at 2000 chars. | **PARTIAL** -- Rate limit is in-memory only (same T-20 issue) |

### 4.6 Elevation of Privilege

| ID | Threat | STRIDE | Attack Vector | Severity | Likelihood | Current Mitigation | Status |
|---|---|---|---|---|---|---|---|
| T-23 | **Prompt injection to alter assessment behavior** | EoP | Candidate crafts input that causes the AI to: (a) give hints about correct answers, (b) always classify responses as STRONG, (c) reveal scoring rubrics, (d) skip assessment sections. Attack surface is every candidate text input processed by `classifyResponse()` and `assembleOpenProbePrompt()`. | **HIGH** | **MEDIUM** | XML escaping of `<` and `>` in candidate text (prompt-assembly.ts lines 16-24). `</candidate_response>` closing tag escaped (classification.ts line 197). Explicit injection warnings in prompts (prompt-assembly.ts line 81). `sanitizeHistory()` strips XML tags from conversation history (classification.ts lines 302-308). Dual-eval classification reduces single-call manipulation. | **PARTIAL** -- Good layered defense but LLM-based defenses are probabilistic |
| T-24 | **Classification gaming via response structure** | EoP | Candidate studies the few-shot examples in classification prompts (which are in source code) and crafts responses that match STRONG patterns verbatim. The few-shot examples show exact response text that gets STRONG classification (rubricScore: 0.80-0.85). | **HIGH** | **MEDIUM** | Few-shot examples are server-side only (classification.ts). Dual-eval provides some robustness. But if source code leaks, candidates know exactly what to say. | **PARTIAL** -- Contingent on source code remaining private |
| T-25 | **Assessment completion without taking assessment** | EoP | Candidate calls `/complete` immediately after `/start` without answering any questions. The complete endpoint checks `assessment.completedAt` but does NOT validate minimum messages, minimum duration, or assessment state progress. | **MEDIUM** | **MEDIUM** | Scoring pipeline would detect insufficient data (pipeline.ts line 404: `insufficientCount > 2` triggers CRITICAL red flag). Status would be REVIEW_REQUIRED, not PASSED. | **PARTIAL** -- Pipeline catches it downstream but no upfront validation |
| T-26 | **Adaptive loop gaming** | EoP | In Act 2, the adaptive loop uses binary search (adaptive-loop.ts). A candidate who deliberately answers easy items wrong triggers early exit from calibration (line 116: `missedEasy`), potentially skipping harder items and receiving a lower but "safe" boundary. Conversely, strategic correct/incorrect patterns could manipulate the boundary estimate. | **LOW** | **LOW** | Pressure test phase (phase 3) validates the boundary. Consistency validation in scoring pipeline compares Act 1 vs Act 3. The adaptive algorithm is psychometrically sound against naive manipulation. | **ADEQUATE** |

---

## 5. Attack Chains

### Chain 1: Token Theft + Full Impersonation (T-01 + T-03)
**Severity: CRITICAL**
1. Attacker obtains linkToken from browser history, Referer header, shared screen, or corporate proxy log.
2. Opens assessment URL in own browser while candidate is mid-assessment.
3. No session binding means both sessions proceed.
4. Attacker submits crafted STRONG-pattern responses.
5. Assessment completes with attacker's responses scored.
**Current defense:** Token expiry only. No session exclusivity.

### Chain 2: Source Code Access + Item Bank Extraction + Classification Gaming (T-12 + T-24)
**Severity: CRITICAL**
1. Attacker (insider, supply-chain compromise, or repo leak) accesses `item-bank.ts`.
2. Extracts all 96 correct answers and all few-shot classification examples.
3. During Act 2, submits correct answers for all items.
4. During Act 1/Act 3, structures responses to match STRONG few-shot patterns.
5. Achieves artificially high scores across all constructs.
**Current defense:** `import "server-only"` prevents client bundle inclusion. No defense against source access.

### Chain 3: Rate Limit Bypass + Cost Exhaustion (T-20 + T-18)
**Severity: HIGH**
1. Attacker acquires multiple valid tokens (e.g., applies to multiple job postings, or enumerates tokens).
2. Observes that rate limits reset on Vercel cold starts (in-memory only).
3. Triggers cold starts by spreading requests across regions/time.
4. Sends sustained high-volume requests to `/chat` and `/tts` endpoints.
5. Each request burns Anthropic and ElevenLabs API credits.
**Current defense:** Redis rate limiter is configured but not wired to any assess route (dead code).

### Chain 4: Sentinel Injection + Assessment Flow Manipulation (T-09 + T-07)
**Severity: HIGH**
1. Candidate sends `[NO_RESPONSE]` as literal chat message text.
2. System treats it as auto-advance sentinel, applies WEAK classification, advances beat.
3. Candidate then sends `[AUTO_ADVANCE]` to skip beats with ADEQUATE classification.
4. By alternating real responses with sentinel injections, candidate controls which beats get scored and which are skipped.
5. Candidate triggers `phase_0_complete` to skip Phase 0 warmup.
**Current defense:** Sentinel set matching catches known sentinels but the `normalizeInput` function returns them as `isSentinel: true` (line 58-59), which should prevent classification. However, chat/route.ts line 301 (`if (lastUserMessage && !elementResponse && !isSentinel)`) correctly gates persistence. The risk is in the classification block (line 388) where `lastUserMessage === "[NO_RESPONSE]"` is checked -- if a user types this, `normalizeInput` marks it as sentinel, but `lastUserMessage` is set from `normalized.content` (line 251), so it WILL match the `=== "[NO_RESPONSE]"` check at line 388, triggering WEAK classification without actually being a timeout.

---

## 6. Risk Register Updates

| Risk ID | Description | Components | Severity | Likelihood | Mitigation Status | Owner | Review Date |
|---|---|---|---|---|---|---|---|
| R-01 | Item bank answers in source code | item-bank.ts, scoring/pipeline.ts | CRITICAL | HIGH | Unmitigated -- answers hardcoded in TypeScript | TBD | Immediate |
| R-02 | No session binding on assessment tokens | All /api/assess/* routes | HIGH | HIGH | Unmitigated | TBD | 2026-04-01 |
| R-03 | In-memory rate limiter ineffective on Vercel | rate-limit.ts, all assess routes | HIGH | HIGH | Redis configured but not wired | TBD | Immediate |
| R-04 | Sentinel message injection by candidates | input-schema.ts, chat/route.ts, engine.ts | HIGH | HIGH | Partial -- needs input filtering | TBD | 2026-04-01 |
| R-05 | No CORS configuration on assess APIs | All /api/assess/* routes | MEDIUM | HIGH | Unmitigated | TBD | 2026-04-01 |
| R-06 | Client-supplied responseTimeMs trusted for scoring | chat/route.ts, response/route.ts, pipeline.ts | MEDIUM | HIGH | Unmitigated | TBD | 2026-04-15 |
| R-07 | Construct names visible to candidates in Turn JSON | dispatcher.ts, client store | MEDIUM | HIGH | Unmitigated -- by design for UI | TBD | 2026-04-15 |
| R-08 | No accommodation mechanism for ADA compliance | Assessment flow | MEDIUM | MEDIUM | Unmitigated | TBD | 2026-05-01 |
| R-09 | Classification few-shot examples in source code | classification.ts | MEDIUM | MEDIUM | Server-side only, but source access negates | TBD | 2026-04-15 |
| R-10 | Start route has no rate limiting | start/route.ts | MEDIUM | MEDIUM | Unmitigated | TBD | 2026-04-01 |

---

## 7. Mitigation Priorities

### Must-Have (Block Deployment / Fix Immediately)

1. **Wire Redis rate limiter to all assess routes (R-03, T-20)**
   All six assess routes call `checkRateLimit()` (synchronous, in-memory). Change them to call `checkRateLimitAsync()` which actually uses the configured Upstash Redis backend. This is a ~6 line change per route but eliminates the single most exploitable DoS vector.
   - File: Each route file under `src/app/api/assess/[token]/*/route.ts`
   - Effort: 1-2 hours

2. **Fix sentinel message injection (R-04, T-09)**
   In `normalizeInput()`, strip or reject user input that exactly matches known sentinel patterns. Alternatively, prefix all sentinel values with an internal-only namespace (e.g., `__SYSTEM__NO_RESPONSE`) that cannot be typed by a candidate.
   - File: `src/lib/assessment/validation/input-schema.ts`
   - Effort: 1 hour

3. **Add rate limiting to start route (R-10, T-19)**
   Apply the same rate limiting pattern to `POST /assess/[token]/start`.
   - File: `src/app/(assess)/assess/[token]/start/route.ts`
   - Effort: 30 minutes

### Should-Have (Current Cycle)

4. **Add session binding to assessment tokens (R-02, T-01, T-03)**
   On first use of a linkToken, record a session fingerprint (IP + User-Agent hash, or a signed session cookie). Reject subsequent requests that don't match. This prevents token replay from different devices and concurrent usage.
   - Schema: Add `sessionFingerprint` column to `AssessmentInvitation` or `AssessmentState`
   - Files: All assess route handlers
   - Effort: 4-6 hours

5. **Move item bank to database or encrypted store (R-01, T-12)**
   The 96 items with correctAnswer should not be in source code. Options:
   - (a) Store items in DB with correctAnswer in a separate, encrypted column -- scoring pipeline reads server-side only.
   - (b) Store correctAnswer as a salted hash; scoring compares hashes.
   - (c) At minimum, move answers to an environment variable or secrets manager.
   - File: `src/lib/assessment/item-bank.ts`, `src/lib/assessment/scoring/pipeline.ts`
   - Effort: 8-16 hours

6. **Add CORS headers to assess API routes (R-05, T-05)**
   Configure response headers to restrict `/api/assess/*` endpoints to same-origin requests only. In Next.js, add CORS middleware or per-route headers.
   - File: New middleware or `next.config.ts`
   - Effort: 2 hours

7. **Strip construct names from client-facing Turn JSON (R-07, T-14)**
   Replace `primaryConstructs: ["FLUID_REASONING", "METACOGNITIVE_CALIBRATION"]` with opaque identifiers or remove entirely from client response. The UI should not need internal construct taxonomy.
   - File: `src/lib/assessment/dispatcher.ts`, `src/lib/assessment/turn-builders/*.ts`
   - Effort: 2-3 hours

8. **Server-side responseTimeMs validation (R-06, T-05)**
   Track server-side timestamps for when each item was served and when the response was received. Use server-side delta as the authoritative `responseTimeMs`, or at minimum validate that client-reported time is within a reasonable range of server-observed time.
   - Files: chat/route.ts, response/route.ts
   - Effort: 4 hours

### Nice-to-Have (Backlog)

9. **Persist Act 1 classification evidence (T-11)**
   Store raw classification AI output alongside the extracted result for audit trail completeness.
   - Effort: 4 hours

10. **Move linkToken from URL path to request header or POST body (T-01)**
    Eliminates Referer leakage and browser history exposure. Requires client-side architecture change (store token in sessionStorage, send as header).
    - Effort: 8-16 hours (significant client refactor)

11. **ADA accommodation mechanism (R-08)**
    Add configurable time extensions, alternative input modes, and screen reader optimization for candidates with disabilities.
    - Effort: 20+ hours

12. **Prompt injection canary/detection (T-23)**
    Add a hidden canary value in system prompts. If the AI output contains the canary, it indicates the candidate successfully extracted system prompt content. Log and flag for review.
    - Effort: 4 hours

---

## 8. Compliance Impact

| Regulation | Impact | Action Required |
|---|---|---|
| **NYC LL144 / IL AIPA** | Automated employment decision tool -- bias audit required before use | Commission independent bias audit of scoring pipeline; publish audit results |
| **EU AI Act** | High-risk AI system (employment context) -- requires conformity assessment, risk management system, human oversight | Document risk management system; ensure meaningful human review of all automated decisions |
| **GDPR Art 22** | Automated decision-making with legal effects -- candidate has right to explanation and human review | Implement right-to-explanation endpoint; ensure human-in-the-loop for status determination |
| **EEOC** | Adverse impact analysis required for algorithmic scoring | Collect and analyze scoring outcomes by protected class; validate no disparate impact |
| **ADA** | No accommodation mechanism exists | Implement accommodation workflow (time extensions, alternative input) |
| **Data retention** | No data retention policy documented or enforced | Define retention period for transcripts, scores, AI evaluation runs; implement automated purge |

---

## 9. Residual Risks & Accepted Risk Rationale

After all mitigations are implemented:

1. **LLM-based defenses are probabilistic (T-23):** Even with XML escaping, injection warnings, dual-eval, and sanitization, a sufficiently creative prompt injection could still alter AI behavior. This is an inherent limitation of LLM-based systems. **Accepted** because: (a) dual-eval reduces single-point manipulation, (b) scoring uses multiple evidence sources (Layer A deterministic + Layer B AI + consistency checks), (c) critical red flags trigger REVIEW_REQUIRED status for human review.

2. **Proxy test-taking (T-10):** Without proctoring, any candidate can have someone else take the assessment. **Accepted** because: (a) current customer segment does not require proctoring, (b) in-person interviews provide a secondary verification, (c) adding proctoring would significantly increase friction and reduce completion rates. **Review date: 2026-06-01** or when enterprise customers request it.

3. **Source code access negates item bank security:** Even after moving answers to DB/secrets, anyone with production DB access or server access can extract answers. **Accepted** because: (a) this is true of any assessment platform, (b) operational security and access controls are the appropriate defense, (c) item bank should be rotated periodically. **Review date: 2026-05-01.**

---

## 10. Key File Reference

| Purpose | Path |
|---|---|
| Token schema | `prisma/schema.prisma` line 463-488 |
| Chat endpoint (main attack surface) | `src/app/api/assess/[token]/chat/route.ts` |
| Start endpoint (no rate limit) | `src/app/(assess)/assess/[token]/start/route.ts` |
| TTS proxy | `src/app/api/assess/[token]/tts/route.ts` |
| Complete + scoring trigger | `src/app/api/assess/[token]/complete/route.ts` |
| Response endpoint | `src/app/api/assess/[token]/response/route.ts` |
| Rate limiter (Redis dead code) | `src/lib/rate-limit.ts` |
| Input validation | `src/lib/assessment/validation/input-schema.ts` |
| Output sanitization | `src/lib/assessment/sanitize.ts` |
| Prompt assembly (injection surface) | `src/lib/assessment/prompts/prompt-assembly.ts` |
| Classification (injection surface) | `src/lib/assessment/classification.ts` |
| Item bank (answers in source) | `src/lib/assessment/item-bank.ts` |
| Scoring pipeline | `src/lib/assessment/scoring/pipeline.ts` |
| Engine state machine | `src/lib/assessment/engine.ts` |
| Dispatcher + leakage check | `src/lib/assessment/dispatcher.ts` |
| Auth (dev-mode impersonation) | `src/lib/auth.ts` |
| Supabase middleware (assess routes NOT protected) | `src/lib/supabase/middleware.ts` |

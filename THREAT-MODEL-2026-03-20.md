# Security Assessment: ACI Assessment Platform

**Date:** 2026-03-20
**Assessor:** Security Threat Modeler (Claude Opus 4.6)
**Scope:** Full candidate assessment system -- all `/api/assess/[token]/*` endpoints, cron jobs, dashboard auth, scoring pipeline, AI integrations, session management.
**Previous Model:** 2026-03-19 (26 threats, 4 attack chains, 10 risks). This is a comprehensive re-assessment incorporating uncommitted working-tree changes through current HEAD + staged modifications (~1,544 lines added, 582 removed across 61 files).

---

## 1. Executive Summary

Since the 2026-03-19 assessment, significant security improvements have been deployed in the working tree. The three most impactful changes are:

1. **Redis rate limiting is now wired** -- All six assess routes now call `checkRateLimitAsync()` instead of the synchronous in-memory `checkRateLimit()`. This was previously the #1 critical unpatched issue.
2. **Session binding implemented** -- `assess-session.ts` binds assessment invitations to a browser session via HttpOnly/Secure/SameSite=Strict cookie. Applied to chat, complete, tts, and response routes.
3. **Sentinel injection partially fixed** -- `normalizeInput()` now has an `allowSentinels` parameter; candidate input defaults to `allowSentinels=false`, and bracket patterns are stripped via regex.

However, this assessment identifies **7 new findings** and confirms **12 remaining risks** from the previous model that are either unmitigated or only partially mitigated.

---

## 2. Asset Inventory

### 2.1 Data Assets

| Asset | Classification | Storage | At-Rest Encryption | Notes |
|---|---|---|---|---|
| Candidate PII (name, email) | MEDIUM | PostgreSQL `Candidate` table | Supabase-managed (AES-256 at storage layer) | No field-level encryption |
| Assessment transcripts | HIGH | PostgreSQL `ConversationMessage` table | Supabase-managed | Full conversation history including behavioral responses |
| Scores & predictions | HIGH | PostgreSQL `CompositeScore`, `SubtestResult`, `Prediction` tables | Supabase-managed | Employment-impacting decisions |
| Item bank (96 items + answers) | CRITICAL | Source code `item-bank.ts` | None -- plaintext in repo | Assessment integrity depends on secrecy |
| Classification rubrics & few-shot examples | HIGH | Source code `classification.ts` | None -- plaintext in repo | Reveals exact scoring methodology |
| AI evaluation runs (Layer B raw output) | HIGH | PostgreSQL `AIEvaluationRun` | Supabase-managed | Contains scoring rationale |
| API keys (Anthropic, ElevenLabs, Supabase, Resend) | CRITICAL | Vercel env vars | Vercel-managed | Not in repo |
| Recruiter session tokens | HIGH | Supabase Auth (JWT) | Supabase-managed | Standard session management |
| Assessment linkTokens | HIGH | PostgreSQL `AssessmentInvitation.linkToken` + URL path | Supabase-managed | CUID -- sole candidate auth |
| Session binding IDs | MEDIUM | PostgreSQL `AssessmentInvitation.sessionBindingId` + HttpOnly cookie | Supabase-managed | NEW -- UUID-based |
| Cron secret | HIGH | Vercel env var | Vercel-managed | Optional (z.string().optional()) -- if unset, crons are UNPROTECTED |

### 2.2 System Components

| Component | Technology | Internet-Facing | Auth Mechanism |
|---|---|---|---|
| Assessment API (6 routes) | Next.js API Routes on Vercel | Yes | linkToken + session cookie |
| Dashboard | Next.js SSR + Supabase Auth | Yes | Supabase JWT session |
| Cron jobs (3 routes) | Next.js API Routes on Vercel | Yes (Vercel cron) | CRON_SECRET Bearer token |
| AI Classification | Anthropic Claude Haiku 4.5 | N/A (server-to-server) | API key |
| AI Scoring (Layer B) | Anthropic Claude Sonnet 4.6 | N/A (server-to-server) | API key |
| TTS Proxy | ElevenLabs API | N/A (server-to-server) | API key |
| Database | Supabase PostgreSQL | Via Supabase proxy | Connection string |
| Rate Limiter | Upstash Redis | N/A (server-to-server) | REST token |
| Email | Resend API | N/A (server-to-server) | API key |
| Error Monitoring | Sentry | N/A (client SDK + server) | DSN |

---

## 3. Threat Actor Profiles

| Actor | Motivation | Capability | Relevant Threats |
|---|---|---|---|
| **Candidate (cheating)** | Inflate own assessment scores to get hired | Browser DevTools, proxy tools, source code reading if leaked | T-05 through T-09, T-12, T-14, T-23, T-24, T-26, NEW-01 through NEW-04 |
| **Proxy test-taker** | Take assessment on behalf of candidate | Same device or separate device with shared URL | T-01, T-03, T-10 |
| **Competitor / Industrial espionage** | Steal assessment methodology, item bank, scoring rubrics | Social engineering, insider access, supply chain | T-12, T-13, T-24 |
| **Automated attacker** | Cost exhaustion, service disruption, credential stuffing | Scripts, botnets, multiple tokens | T-18 through T-22 |
| **Insider threat** | Data exfiltration, score manipulation | Git repo access, Vercel admin, DB access | T-04, T-12, T-13 |
| **Disgruntled candidate** | Denial of service, score manipulation for others | Single valid token, browser tools | T-05, T-07, T-09, T-18 |
| **Defense industry adversary** | Compromise hiring pipeline for contractor roles | Nation-state capability, persistent access | All -- this is the tail risk given Anduril/Navy MIBP clients |

---

## 4. Trust Boundaries

| ID | Boundary | What Crosses It | Enforcement | Adequacy (Delta from 2026-03-19) |
|---|---|---|---|---|
| TB-1 | Internet -> Assess API | linkToken, candidate text, element responses, session cookie | Token lookup + expiry, Redis rate limiting, input normalization (3000 char), session binding cookie | **IMPROVED** (was WEAK, now MODERATE) -- Session binding added, Redis rate limiting wired. Still missing CORS. |
| TB-2 | Internet -> Dashboard | Supabase session cookie | Supabase middleware protects 8 route prefixes | **ADEQUATE** -- No change |
| TB-3 | API -> Anthropic Claude | System prompts + escaped candidate text | XML escaping, `<candidate_response>` containment, injection warnings, dual-eval, history sanitization | **MODERATE** -- No change |
| TB-4 | API -> ElevenLabs | Server-side API key + text (max 2000 chars) | Key never exposed; text validated against recent agent turns (PRO-24) | **GOOD** (was ADEQUATE) -- TTS text validation added |
| TB-5 | API -> PostgreSQL | Prisma ORM queries | Parameterized queries via Prisma, no raw SQL | **GOOD** -- No change |
| TB-6 | Server -> Client (Turn JSON) | Assessment content, element data | `stripSensitiveFields()` blocklist, `postBuildPipeline()` leakage detection | **ADEQUATE** -- No change |
| TB-7 | Middleware boundary | `/api/assess/*` routes NOT in Supabase middleware | Each route self-enforces token auth | **MODERATE** (was WEAK) -- Session binding now provides secondary auth factor |
| TB-8 | Internet -> Cron API | CRON_SECRET Bearer token | `Authorization` header comparison | **CONDITIONAL** -- CRON_SECRET is `z.string().optional()`. If unset, crons are unprotected. See NEW-05. |
| TB-9 | Assess API -> Session Cookie | assess-session cookie (HttpOnly, Secure, SameSite=Strict) | Cookie set on first chat request, validated on subsequent requests across all routes except survey, tts-config, and start | **NEW -- PARTIAL** -- Three routes lack session binding enforcement. See NEW-06. |

---

## 5. Threat Model (STRIDE)

### 5.1 Remediated Since 2026-03-19

| Previous ID | Threat | Status Change | Evidence |
|---|---|---|---|
| T-20 / R-03 | **Redis rate limiter dead code** | **MITIGATED** | All 6 assess routes now import and call `checkRateLimitAsync()` with appropriate `configKey`. `rate-limit.ts` lines 142-164 use Upstash Redis when configured. |
| T-01 / R-02 | **No session binding on tokens** | **PARTIALLY MITIGATED** | `assess-session.ts` implements HttpOnly/Secure/SameSite=Strict session cookie. Bound on first `/chat` request. Validated on chat, complete, tts, and response routes. BUT: survey, tts-config, and start routes lack enforcement. |
| T-09 / R-04 | **Sentinel injection** | **PARTIALLY MITIGATED** | `normalizeInput(raw, allowSentinels=false)` is default for candidate input. Bracket patterns stripped via regex `^\[([A-Z_]+)\]$` -> `$1`. BUT: the `isSentinelMessage()` function at line 89-91 still uses the broad regex `^\[.+\]$` and is exported -- any caller using it directly is vulnerable. Also, the strip regex only matches ALL-CAPS bracket patterns; `[no_response]` or `[No_Response]` bypass it. |
| T-19 / R-10 | **Start route no rate limit** | **UNMITIGATED** | Start route at `src/app/(assess)/assess/[token]/start/route.ts` still has NO rate limiting and NO session binding. |

### 5.2 Persisting Threats (Confirmed Still Present)

| ID | Threat | STRIDE | Severity | Likelihood | Current Status |
|---|---|---|---|---|---|
| T-01 | **Token theft via URL leakage** | Spoofing | HIGH | HIGH | **IMPROVED but not eliminated** -- Session binding prevents replay from different browser, but token still in URL path (Referer leakage, browser history, proxy logs). First-use race condition exists: if attacker uses token before legitimate candidate, attacker gets the session binding. |
| T-03 | **Concurrent session hijacking** | Spoofing | HIGH | LOW (was MEDIUM) | **IMPROVED** -- Session binding prevents concurrent usage from different devices. Optimistic concurrency prevents data corruption. Downgraded likelihood because session binding blocks the primary vector. |
| T-04 | **Dev-mode role impersonation** | Spoofing | CRITICAL | LOW | **UNCHANGED** -- Gated by `NODE_ENV === "development"`. Safe on Vercel. Risk if self-hosted. |
| T-05 | **Client-side responseTimeMs manipulation** | Tampering | MEDIUM | HIGH | **UNMITIGATED** -- `elementResponse.responseTimeMs` is client-supplied and stored as-is at chat/route.ts line 339 and response/route.ts line 82. Used in scoring pipeline (layer-a.ts `scoreItem`). No server-side validation. |
| T-06 | **Item response replay/overwrite** | Tampering | MEDIUM | MEDIUM | **UNMITIGATED** -- `/response` endpoint uses `upsert` (line 69-91). Candidate can resubmit different answers retroactively. No timestamp lock after first submission. |
| T-07 | **Assessment state manipulation via triggers** | Tampering | LOW (was MEDIUM) | MEDIUM | **IMPROVED** -- Phase 0 completion has idempotency guard (`phase0Complete` check). Role hardcoded to CANDIDATE (PRO-10). Downgraded because scoring excludes Phase 0. |
| T-08 | **Element response field injection** | Tampering | MEDIUM | MEDIUM | **PARTIAL** -- String truncation applied (value: 2000, elementType: 50, itemId: 100, construct: 50). `/response` route validates itemId format with regex `^[\w-]+$`. But itemId is not validated against the actual item bank -- candidate can submit responses for arbitrary item IDs. |
| T-10 | **No candidate identity verification (proxy testing)** | Repudiation | HIGH | HIGH | **IMPROVED** -- Session binding deters casual URL sharing. But no biometric/proctoring. Accepted risk for current use case. |
| T-12 | **Item bank answers in source code** | Info Disclosure | CRITICAL | HIGH | **UNMITIGATED** -- All 96 items with `correctAnswer` remain in `item-bank.ts`. `import "server-only"` prevents client bundle inclusion. No defense against repo access. |
| T-13 | **Scoring rubrics in prompts** | Info Disclosure | HIGH | MEDIUM | **UNMITIGATED** -- `classification.ts` contains full few-shot examples with STRONG/ADEQUATE/WEAK patterns and exact rubricScores. |
| T-14 | **Construct names leaked to client** | Info Disclosure | MEDIUM | HIGH | **UNMITIGATED** -- Turn JSON `signal.primaryConstructs` and `signal.secondaryConstructs` still sent to browser. Visible in DevTools. |
| T-23 | **Prompt injection to alter assessment** | EoP | HIGH | MEDIUM | **PARTIAL** -- XML escaping, containment tags, injection warnings, dual-eval all in place. Probabilistic defense. |
| T-24 | **Classification gaming via source access** | EoP | HIGH | MEDIUM | **UNMITIGATED** -- Few-shot examples in source code. If repo leaks, candidates know exact STRONG patterns. |

### 5.3 New Threats Identified (2026-03-20)

| ID | Threat | STRIDE | Attack Vector | Severity | Likelihood | Current Mitigation | Status |
|---|---|---|---|---|---|---|---|
| NEW-01 | **Session binding first-use race condition** | Spoofing | Attacker who obtains linkToken (via Referer, proxy log, etc.) can race the legitimate candidate to make the first `/chat` request. The first caller gets the session cookie bound; the legitimate candidate is then locked out with "Session mismatch" 401. This is a denial-of-service against the specific candidate AND allows the attacker to complete the assessment as the candidate. | **HIGH** | **LOW** (requires token theft + timing) | Session is bound on first `/chat` request. No notification to candidate that their session was hijacked. Invitation has no mechanism to reset session binding. | **UNMITIGATED** |
| NEW-02 | **Sentinel strip regex case sensitivity bypass** | Tampering | The bracket-pattern strip in `normalizeInput()` (line 70) uses regex `^\[([A-Z_]+)\]$` which only matches uppercase. A candidate sending `[no_response]` or `[No_Response]` bypasses the strip. While `SENTINEL_MESSAGES.has()` is case-sensitive and won't match these, the `isSentinelMessage()` function (line 89-91) uses `^\[.+\]$` which matches ANY bracket-enclosed text regardless of case. If any code path calls `isSentinelMessage()` on un-normalized input, the bypass works. | **MEDIUM** | **LOW** | The strip regex catches the uppercase sentinels. The `isSentinelMessage()` function's broad regex is the residual risk. Engine.ts would need to be checked for direct `isSentinelMessage()` calls on raw input. | **PARTIAL** |
| NEW-03 | **Survey route missing session binding and assessmentId authorization gap** | Tampering + Info Disclosure | The `/survey` route validates `linkToken` but does NOT enforce session binding (no `validateAssessSession` call). It also accepts a client-supplied `assessmentId` in the request body and validates it against the invitation's candidate. However, `assessmentInvitation.findFirst` (not `findUnique`) is used, which could return unexpected results if a candidate has multiple invitations. More critically, the `assessmentId` is used directly in `postAssessmentSurvey.create` -- if a candidate can guess another assessment's ID, they can submit arbitrary survey responses for that assessment. | **LOW** | **LOW** | The survey data is non-sensitive (difficulty/fairness/faceValidity ratings). But the pattern of trusting client-supplied IDs is concerning. The `findFirst` (line 23) vs `findUnique` inconsistency with other routes creates a subtle authorization difference. | **UNMITIGATED** |
| NEW-04 | **tts-config and start routes missing session binding** | Spoofing | `/tts-config` (GET) and `/start` (POST) do not call `validateAssessSession()`. An attacker with a stolen token can call these routes even after session binding is established on `/chat`. The `/start` route is idempotent (returns existing assessment ID), but the `/tts-config` route returns voice configuration including voiceId, model, voice settings, and -- critically -- the proxy endpoint URL template. | **LOW** | MEDIUM | `/start` is idempotent and returns only an assessment ID. `/tts-config` leaks voice settings but no credentials. Neither route modifies assessment state. | **LOW RISK** -- but inconsistent security boundary |
| NEW-05 | **CRON_SECRET optional -- cron routes unprotected if unset** | EoP | In `env.ts` (line 40), `CRON_SECRET` is `z.string().optional()`. If not configured in Vercel, all three cron routes (`recover-stuck-assessments`, `send-results`, `expire-invitations`) check `authHeader !== Bearer undefined`, which will fail for any request without auth -- but `Bearer undefined` IS a valid string match. An attacker sending `Authorization: Bearer undefined` would authenticate. | **HIGH** | **LOW** (requires CRON_SECRET to be unset in production) | The comparison `authHeader !== \`Bearer ${process.env.CRON_SECRET}\`` evaluates to `authHeader !== "Bearer undefined"` when CRON_SECRET is unset. Sending `Authorization: Bearer undefined` would pass the check. | **CONDITIONAL** -- depends on env config |
| NEW-06 | **v2/page.tsx fire-and-forget DB write without await** | Info Disclosure | At `v2/page.tsx` line 26-29, `prisma.assessmentInvitation.updateMany()` is called without `await` and with `.catch(() => {})`. This is a fire-and-forget pattern that could silently fail, leaving `linkOpenedAt` null. While not a direct security issue, it means audit trail data (when a candidate first opened the link) may be unreliable. More critically, the page renders the full `AssessmentStage` component with `token`, `candidateName`, and `roleName` passed as props -- these are rendered into the client HTML regardless of invitation status checks passing. | **LOW** | HIGH | Non-blocking write is intentional for UX. The status checks above (line 33-48) handle expired and completed redirects before rendering. | **INFORMATIONAL** |
| NEW-07 | **Webhook SSRF via SCORING_FAILURE_WEBHOOK_URL** | SSRF | In `complete/route.ts` (lines 144-155), `fetch(webhookUrl, ...)` is called with the value of `process.env.SCORING_FAILURE_WEBHOOK_URL`. This is a fire-and-forget fetch with no URL validation, no allowlist, and no response handling. If an attacker compromises this env var (via Vercel settings, CI/CD, or `.env` file), they can trigger SSRF to internal services, cloud metadata endpoints (169.254.169.254), or arbitrary external hosts. The fetch includes `assessmentId` and timestamp in the body. | **MEDIUM** | **LOW** (requires env var compromise) | URL is validated as `z.string().url()` in env.ts, but this only checks format, not destination. No allowlist. | **UNMITIGATED** -- defense-in-depth gap |

---

## 6. Attack Chains

### Chain 1: Token Theft + Session Race -> Full Impersonation (T-01 + NEW-01)
**Severity: HIGH**
1. Attacker obtains linkToken from Referer header, corporate proxy log, or shared screen.
2. Races the legitimate candidate to make the first `/chat` POST request.
3. Attacker's browser receives the `assess-session` HttpOnly cookie with the UUID session binding.
4. Legitimate candidate's subsequent requests fail with "Session mismatch" (401).
5. Attacker completes the assessment with crafted responses, potentially using item bank answers if source is accessible.
6. No mechanism exists to reset the session binding or alert the candidate/recruiter.
**Improvement from 2026-03-19:** Session binding blocks the "concurrent usage" vector but creates a new "first-use lockout" vector. Net security is improved but the failure mode is worse (candidate locked out vs. concurrent corruption).

### Chain 2: Source Code Access + Item Bank + Few-Shot Gaming (T-12 + T-13 + T-24)
**Severity: CRITICAL**
1. Attacker (insider, supply-chain compromise, GitHub leak) accesses repository.
2. Extracts 96 correct answers from `item-bank.ts` and all few-shot classification examples from `classification.ts`.
3. During Act 2, submits correct answers for all structured items.
4. During Act 1/Act 3, structures responses to match STRONG few-shot patterns verbatim.
5. Achieves artificially high scores across all constructs.
**Status: UNCHANGED** from 2026-03-19. This is the highest-impact attack chain.

### Chain 3: ResponseTimeMs Manipulation + Item Overwrite -> Score Inflation (T-05 + T-06)
**Severity: MEDIUM**
1. Candidate opens assessment normally.
2. For each structured item in Act 2, submits initial answer quickly (capturing "fast" response time).
3. After seeing subsequent items that provide context clues, calls `/response` endpoint again with the correct answer and a fast `responseTimeMs` (e.g., 5000ms).
4. The `upsert` overwrites the original response. The `responseTimeMs` is client-controlled.
5. Layer A scoring gives bonus weight for fast correct answers (scoring pipeline `scoreItem` function).
6. Final score is inflated both by correctness (overwritten answers) and timing (spoofed fast response).
**Status: UNCHANGED** from 2026-03-19. Both vectors remain unmitigated.

### Chain 4: CRON_SECRET Bypass + Scoring Pipeline Abuse (NEW-05)
**Severity: CONDITIONAL (HIGH if CRON_SECRET unset)**
1. If `CRON_SECRET` is not configured in Vercel, the env var is `undefined`.
2. Attacker sends `GET /api/cron/recover-stuck-assessments` with header `Authorization: Bearer undefined`.
3. The comparison `"Bearer undefined" !== "Bearer undefined"` is FALSE -- authentication passes.
4. Attacker can trigger scoring pipeline re-runs for stuck assessments (recover-stuck-assessments), trigger bulk email sends (send-results), or expire invitations (expire-invitations).
5. The `recover-stuck-assessments` route runs `runScoringPipeline()` which makes ~15+ Anthropic API calls per assessment -- potential cost exhaustion.
**Mitigation:** Verify CRON_SECRET is set in all environments. Change validation to `z.string().min(1)` instead of `.optional()`.

---

## 7. Risk Register

| Risk ID | Description | Severity | Likelihood | Components | Mitigation Status | Priority |
|---|---|---|---|---|---|---|
| R-01 | Item bank answers in source code | CRITICAL | HIGH | item-bank.ts, scoring/pipeline.ts | **UNMITIGATED** | Must-Have |
| R-02 | Session binding race condition on first use | HIGH | LOW | assess-session.ts, chat/route.ts | **UNMITIGATED** | Should-Have |
| R-03 | ~~Redis rate limiter dead code~~ | ~~CRITICAL~~ | ~~HIGH~~ | ~~rate-limit.ts~~ | **MITIGATED** (2026-03-20) | Closed |
| R-04 | Sentinel injection residual: `isSentinelMessage()` broad regex | MEDIUM | LOW | input-schema.ts line 89-91 | **PARTIAL** -- `normalizeInput` fixed but `isSentinelMessage()` still exported with broad regex | Should-Have |
| R-05 | No CORS configuration on assess APIs | MEDIUM | HIGH | All /api/assess/* routes, next.config.ts | **UNMITIGATED** | Should-Have |
| R-06 | Client-supplied responseTimeMs trusted for scoring | MEDIUM | HIGH | chat/route.ts, response/route.ts, pipeline.ts | **UNMITIGATED** | Should-Have |
| R-07 | Construct names visible to candidates in Turn JSON | MEDIUM | HIGH | dispatcher.ts, client store | **UNMITIGATED** | Nice-to-Have |
| R-08 | No ADA accommodation mechanism | MEDIUM | MEDIUM | Assessment flow | **UNMITIGATED** | Backlog |
| R-09 | Classification few-shot examples in source code | MEDIUM | MEDIUM | classification.ts | **UNMITIGATED** | Should-Have |
| R-10 | Start route has no rate limiting or session binding | MEDIUM | MEDIUM | start/route.ts | **UNMITIGATED** | Should-Have |
| R-11 | CRON_SECRET optional -- cron auth bypassable if unset | HIGH | LOW | env.ts, all cron routes | **CONDITIONAL** | Must-Have (verify) |
| R-12 | Item response upsert allows retroactive answer changes | MEDIUM | MEDIUM | response/route.ts, chat/route.ts | **UNMITIGATED** | Should-Have |
| R-13 | Survey route missing session binding | LOW | LOW | survey/route.ts | **UNMITIGATED** | Nice-to-Have |
| R-14 | Webhook URL SSRF (SCORING_FAILURE_WEBHOOK_URL) | MEDIUM | LOW | complete/route.ts line 144-155 | **UNMITIGATED** | Nice-to-Have |

---

## 8. Mitigation Priorities

### Must-Have (Block Deployment / Fix Immediately)

**1. Verify CRON_SECRET is set in all environments (R-11, NEW-05)**
Check Vercel project settings to confirm `CRON_SECRET` is configured with a cryptographically random value (min 32 characters). Then change `env.ts` line 40 from `z.string().optional()` to `z.string().min(32, "CRON_SECRET must be at least 32 characters")` (or at minimum `.min(1)`). If it must remain optional for local dev, add a runtime guard in each cron route: `if (!process.env.CRON_SECRET) return 503`.
- File: `src/lib/env.ts` line 40, all cron route handlers
- Effort: 30 minutes
- Risk reduction: Eliminates the `"Bearer undefined"` authentication bypass

**2. Move item bank answers out of source code (R-01, T-12)**
This is the highest-impact security improvement for assessment integrity. Options in order of preference:
- **(a) Database storage:** Move items to a `PsychometricItem` table with `correctAnswer` encrypted via Supabase Vault or application-level AES-256. Scoring pipeline reads server-side only. Rotate items periodically.
- **(b) Environment variable:** Store answers as a JSON blob in a Vercel env var. Less ideal (harder to manage 96 items) but removes from repo.
- **(c) Hashed answers:** Store `correctAnswer` as bcrypt/SHA-256 hash in source. Scoring compares `hash(response) === storedHash`. Prevents casual inspection but not brute-force on short answers.
- File: `src/lib/assessment/item-bank.ts`, `src/lib/assessment/scoring/pipeline.ts`, `src/lib/assessment/adaptive-loop.ts`
- Effort: 8-16 hours
- Risk reduction: Eliminates the most critical information disclosure risk

### Should-Have (Current Development Cycle)

**3. Add CORS headers to assess API routes (R-05)**
Add an explicit CORS configuration that restricts `/api/assess/*` endpoints to same-origin requests only. In Next.js App Router, create a middleware or use `headers()` in route responses:
```
Access-Control-Allow-Origin: https://your-domain.com
Access-Control-Allow-Methods: POST, GET
Access-Control-Allow-Credentials: true
```
Without CORS, any website can make credentialed requests to the assess API if the candidate is on the same browser.
- File: `src/proxy.ts` (middleware) or per-route headers
- Effort: 2 hours

**4. Add rate limiting and session binding to start route (R-10)**
The start route (`src/app/(assess)/assess/[token]/start/route.ts`) is the only assess endpoint with neither rate limiting nor session binding. Add `checkRateLimitAsync` and `validateAssessSession` following the pattern in the other routes.
- File: `src/app/(assess)/assess/[token]/start/route.ts`
- Effort: 1 hour

**5. Lock item responses after first submission (R-12, T-06)**
Change the `/response` endpoint's upsert to a conditional upsert: only update if `createdAt` is within a short window (e.g., 5 seconds) of the original creation, OR add an `isLocked` flag that is set after first submission. The chat route's inline upsert (line 350-373) should follow the same pattern.
- Files: `src/app/api/assess/[token]/response/route.ts`, `src/app/api/assess/[token]/chat/route.ts`
- Effort: 2-3 hours

**6. Server-side responseTimeMs validation (R-06, T-05)**
Record a server-side timestamp when each item is served to the candidate (in `AssessmentState` or `ConversationMessage` metadata). On response, compute `serverDeltaMs = now - itemServedAt`. Accept `responseTimeMs` only if it is within a plausible range of `serverDeltaMs` (e.g., `0.5x <= clientTime <= 2.0x * serverDelta`). If out of range, use `serverDeltaMs` as the authoritative value.
- Files: `src/app/api/assess/[token]/chat/route.ts`, `src/app/api/assess/[token]/response/route.ts`
- Effort: 4 hours

**7. Fix sentinel strip regex to be case-insensitive (R-04, NEW-02)**
Change `normalizeInput()` line 70 from `^\[([A-Z_]+)\]$` to `^\[([A-Za-z_]+)\]$/i`. Also consider deprecating or removing the standalone `isSentinelMessage()` export, since it uses the overly broad `^\[.+\]$` regex that any caller could misuse.
- File: `src/lib/assessment/validation/input-schema.ts`
- Effort: 30 minutes

**8. Move classification few-shot examples to database or config (R-09)**
The few-shot examples in `classification.ts` (lines 10-94) reveal exact STRONG/ADEQUATE/WEAK response patterns with rubricScores. Move these to a database table or encrypted config that is loaded at runtime. This reduces the blast radius of a source code leak.
- File: `src/lib/assessment/classification.ts`
- Effort: 4 hours

**9. Add session binding reset mechanism (R-02, NEW-01)**
Implement an admin/recruiter action to reset `sessionBindingId` on an invitation. This allows recovery when a legitimate candidate is locked out. Log session binding events (creation, validation failures, resets) to an audit trail.
- Files: `src/lib/session/assess-session.ts`, dashboard admin UI
- Effort: 4-6 hours

### Nice-to-Have (Backlog)

**10. Strip construct names from client-facing Turn JSON (R-07, T-14)**
Replace `primaryConstructs: ["FLUID_REASONING", "METACOGNITIVE_CALIBRATION"]` with opaque identifiers or remove entirely.
- Files: `src/lib/assessment/dispatcher.ts`, turn builders
- Effort: 2-3 hours

**11. Add session binding to survey and tts-config routes (R-13, NEW-04)**
For consistency, add `validateAssessSession` to the two remaining routes that lack it.
- Files: `src/app/api/assess/[token]/survey/route.ts`, `src/app/api/assess/[token]/tts-config/route.ts`
- Effort: 1 hour

**12. Add SCORING_FAILURE_WEBHOOK_URL allowlist (R-14, NEW-07)**
Validate that the webhook URL matches an allowlist of permitted domains (e.g., `*.slack.com`, `*.pagerduty.com`, your own domain).
- File: `src/app/api/assess/[token]/complete/route.ts`
- Effort: 1 hour

**13. Prompt injection canary/detection (T-23)**
Add a hidden canary value in system prompts. If AI output contains the canary, flag the session for review.
- Effort: 4 hours

**14. Move linkToken from URL path to request header (T-01)**
Eliminates Referer leakage, browser history exposure, and proxy log capture. Requires significant client architecture change.
- Effort: 16+ hours

**15. ADA accommodation mechanism (R-08)**
Time extensions, alternative input modes, screen reader optimization.
- Effort: 20+ hours

---

## 9. Compliance Impact

| Regulation | Current Status | Action Required | Deadline Risk |
|---|---|---|---|
| **NYC LL144 / IL AIPA** | No bias audit | Commission independent bias audit before selling to NYC/IL employers | **HIGH** -- legal exposure if used without audit |
| **EU AI Act** | No conformity assessment | Document risk management system, ensure human oversight of all automated decisions | Medium -- enforcement timeline is 2026 |
| **GDPR Art 22** | No right-to-explanation | Implement explanation endpoint for candidates | Medium -- required if processing EU candidates |
| **EEOC** | No adverse impact analysis | Collect scoring outcomes by protected class, validate no disparate impact | **HIGH** -- required for defense industry |
| **ADA** | No accommodation mechanism | Implement time extensions, alt input | **HIGH** -- defense industry customers likely require |
| **Data Retention** | No policy documented | Define retention periods, implement automated purge | Medium |
| **ITAR/CMMC** | Not assessed | If processing data about cleared positions, additional controls may apply | **UNKNOWN** -- needs assessment based on client contracts |

**New compliance observation:** Given the defense industry client base (Anduril, Navy MIBP), CMMC (Cybersecurity Maturity Model Certification) requirements may apply if any candidate data relates to controlled defense information. This would impose significantly stricter access controls, encryption, logging, and incident response requirements than currently implemented.

---

## 10. Residual Risks & Accepted Risk Rationale

After all Must-Have and Should-Have mitigations are implemented:

1. **LLM-based defenses are probabilistic (T-23):** Even with XML escaping, injection warnings, dual-eval, containment tags, and sanitization, a sufficiently creative prompt injection could alter AI behavior. **Accepted** because: (a) dual-eval reduces single-point manipulation, (b) scoring uses multiple evidence sources (Layer A deterministic + Layer B AI + consistency checks), (c) critical red flags trigger REVIEW_REQUIRED for human review. **Review: 2026-06-01.**

2. **Proxy test-taking (T-10):** Session binding deters casual URL sharing but does not prevent a candidate from having someone else use their device. **Accepted** because: (a) in-person interviews provide secondary verification, (b) proctoring would significantly reduce completion rates and candidate experience, (c) current customers have not required proctoring. **Review: 2026-06-01** or when enterprise customers request it.

3. **Source code access negates item bank security:** Even after moving answers to DB, anyone with production DB access can extract them. **Accepted** because: (a) operational security and access controls are the appropriate defense layer, (b) item bank should be rotated periodically (quarterly minimum for defense clients), (c) this is true of any assessment platform. **Review: 2026-05-01.**

4. **Token in URL path (T-01):** Moving token to headers is a significant refactor. Session binding provides secondary authentication. **Accepted** for current cycle. **Review: 2026-07-01.**

5. **No proctoring or identity verification:** Deliberate product decision. Session binding + behavioral consistency checks are the current proxy for identity assurance. **Review: 2026-06-01.**

---

## 11. Delta Summary (2026-03-19 -> 2026-03-20)

### Improvements Confirmed
- [x] Redis rate limiter wired to all assess routes (was #1 critical issue)
- [x] Session binding via HttpOnly/Secure/SameSite=Strict cookie on 4 of 6 assess routes
- [x] Sentinel injection guard via `allowSentinels` parameter
- [x] TTS text validation (PRO-24) prevents arbitrary text-to-speech abuse
- [x] Role hardcoded to CANDIDATE in Phase 0 message persistence (PRO-10)
- [x] Optimistic concurrency on all state mutations (PRO-7)
- [x] Idempotency key for message deduplication (PRO-31)
- [x] Completion guard against scoring-in-progress state (PRO-33)
- [x] Phase 0 completion idempotency guard (PRO-32)

### New Findings
- NEW-01: Session binding first-use race condition
- NEW-02: Sentinel strip regex case sensitivity bypass
- NEW-03: Survey route authorization gap (assessmentId from client)
- NEW-04: tts-config and start routes missing session binding
- NEW-05: CRON_SECRET optional -- `Bearer undefined` bypass
- NEW-06: v2/page.tsx fire-and-forget audit trail write
- NEW-07: Webhook SSRF via SCORING_FAILURE_WEBHOOK_URL

### Risk Score Movement
- **Overall platform risk:** Reduced from HIGH to MEDIUM-HIGH
- **Assessment integrity risk:** Remains HIGH (item bank in source, responseTimeMs manipulation, item overwrite)
- **DoS/cost risk:** Reduced from HIGH to MEDIUM (Redis rate limiting wired)
- **Authentication risk:** Reduced from HIGH to MEDIUM (session binding added, with caveats)

---

## 12. Key File Reference

| Purpose | Path | Security Relevance |
|---|---|---|
| Chat endpoint (main attack surface) | `src/app/api/assess/[token]/chat/route.ts` | Token auth, session binding, input normalization, classification, state mutation |
| Start endpoint (no rate limit, no session binding) | `src/app/(assess)/assess/[token]/start/route.ts` | Assessment creation, missing security controls |
| TTS proxy | `src/app/api/assess/[token]/tts/route.ts` | API key protection, text validation, rate limiting |
| Complete + scoring trigger | `src/app/api/assess/[token]/complete/route.ts` | Atomic completion, webhook SSRF risk |
| Response endpoint | `src/app/api/assess/[token]/response/route.ts` | Item upsert (overwrite risk), responseTimeMs trust |
| Survey endpoint | `src/app/api/assess/[token]/survey/route.ts` | Missing session binding, client-supplied assessmentId |
| TTS config | `src/app/api/assess/[token]/tts-config/route.ts` | Missing session binding, voice config disclosure |
| Session binding | `src/lib/session/assess-session.ts` | HttpOnly cookie, UUID generation, first-use race |
| Rate limiter | `src/lib/rate-limit.ts` | Redis + in-memory fallback, now properly wired |
| Input validation | `src/lib/assessment/validation/input-schema.ts` | Sentinel injection defense, broad regex residual |
| Output sanitization | `src/lib/assessment/sanitize.ts` | stripSensitiveFields blocklist, LLM artifact removal |
| Prompt assembly | `src/lib/assessment/prompts/prompt-assembly.ts` | XML escaping, injection warnings, rubric exposure |
| Classification | `src/lib/assessment/classification.ts` | Few-shot examples, dual-eval, rubric exposure |
| Item bank | `src/lib/assessment/item-bank.ts` | 96 items with correctAnswer in source |
| Scoring pipeline | `src/lib/assessment/scoring/pipeline.ts` | Layer A (deterministic), Layer B (AI), idempotency |
| Dispatcher | `src/lib/assessment/dispatcher.ts` | Turn JSON construction, construct leakage, circuit breaker |
| Engine | `src/lib/assessment/engine.ts` | State machine, action generation |
| Auth | `src/lib/auth.ts` | Dev-mode impersonation, Supabase session |
| Middleware | `src/proxy.ts` + `src/lib/supabase/middleware.ts` | Route protection, assess routes NOT covered |
| Env validation | `src/lib/env.ts` | CRON_SECRET optional, webhook URL validation |
| Cron: recover stuck | `src/app/api/cron/recover-stuck-assessments/route.ts` | CRON_SECRET auth, scoring pipeline trigger |
| Cron: send results | `src/app/api/cron/send-results/route.ts` | CRON_SECRET auth, bulk email send |
| Cron: expire invitations | `src/app/api/cron/expire-invitations/route.ts` | CRON_SECRET auth, status mutation |
| Prisma schema | `prisma/schema.prisma` line 463-482 | linkToken CUID, sessionBindingId |

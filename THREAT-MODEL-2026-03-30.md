# ACI Assessment Platform -- Comprehensive Threat Model

**Date:** 2026-03-30
**Assessor:** Security Threat Modeler (Claude Opus 4.6)
**Scope:** Full platform -- assessment engine, dashboard, API surface, AI integration, data flows
**Previous Model:** 2026-03-20

---

## 1. Scope & Context

ACI is an AI-powered candidate assessment platform built on Next.js 16 / App Router, deployed on Vercel. It conducts voice-based interviews through an AI persona ("Aria") backed by Anthropic Claude, with recruiter dashboards for reviewing results.

**Data Classification:**
- **HIGH**: Candidate PII (name, email, phone), assessment transcripts, psychological/behavioral profiles, scoring rubrics, AI evaluation rationale
- **HIGH**: API keys (Anthropic, ElevenLabs, Supabase service role, Resend)
- **MEDIUM**: Assessment scores, composite weights, cutline thresholds, role configurations
- **MEDIUM**: Recruiter/admin user credentials (delegated to Supabase Auth)
- **LOW**: Org metadata, role templates, feature flags

**Regulatory Context:** Candidate PII triggers GDPR/CCPA considerations. Defense industry clients (Anduril, Navy MIBP) may trigger CMMC/ITAR requirements -- needs formal assessment. Employment decisions based on AI scoring may implicate NYC Local Law 144 (bias audit for automated employment decision tools) and EU AI Act Article 6 (high-risk AI systems in employment).

---

## 2. Architecture & Data Flow Summary

```
Browser (Candidate)                 Browser (Recruiter/Admin)
      |                                      |
      | linkToken (CUID)                     | Supabase JWT
      v                                      v
  /api/assess/[token]/*              /api/{candidates,roles,team,...}/*
      |                                      |
      +----------+---------------------------+
                 |
           Next.js API Routes (Vercel Serverless)
                 |
     +-----------+-----------+
     |           |           |
  Prisma/PG   Anthropic   ElevenLabs
  (Supabase)   Claude API   TTS API
                             |
                    Upstash Redis
                    (rate limiting)
```

**Key Data Flows:**
1. Candidate receives email with `linkToken` URL -> accesses assessment
2. Assessment chat: candidate input -> sanitize/normalize -> build prompt -> Claude API -> stream response -> persist in DB
3. Classification: candidate response -> dual Claude Haiku calls -> consensus -> branch routing
4. Scoring: assessment complete -> Layer A (deterministic) + Layer B (AI evaluation) + Layer C (ceiling) -> composite -> cutline -> status
5. Dashboard: recruiter authenticates via Supabase -> queries org-scoped candidates -> RBAC field filtering
6. Cron: Vercel cron -> CRON_SECRET bearer auth -> expire invitations / recover stuck assessments / send results

---

## 3. Trust Boundaries

### TB-1: Internet <-> Candidate Assessment API (`/api/assess/[token]/*`)
- **Guard:** linkToken (CUID, ~25 chars) serves as the sole authentication credential
- **Session binding:** DISABLED (commented out across all assess routes, flagged "pre-pilot")
- **Rate limiting:** Redis-backed (Upstash) with in-memory fallback
- **CORS:** Not configured -- no Access-Control headers set
- **FINDING:** This is the most exposed boundary. linkToken is a knowledge-based credential with no session binding, meaning anyone with the URL can interact with the assessment.

### TB-2: Internet <-> Dashboard API (`/api/{candidates,roles,team,...}/*`)
- **Guard:** Supabase Auth JWT via `getSession()` -> Prisma user lookup -> org scoping -> RBAC field filtering
- **Middleware:** Supabase middleware protects dashboard pages but NOT API routes directly (API routes call `getSession()` inline)
- **FINDING:** Well-structured. Each route independently validates session and org scope.

### TB-3: Dashboard API <-> Cron Routes (`/api/cron/*`)
- **Guard:** `CRON_SECRET` bearer token, now with explicit null guard (`!secret` check)
- **FINDING:** Fixed from previous model. CRON_SECRET is now required (min 32 chars) in env.ts. However, HEALTH_SECRET remains optional.

### TB-4: Server <-> Anthropic Claude API
- **Guard:** API key in environment variable, never exposed to client
- **Data crossing:** Full conversation history, candidate responses, role context, classification rubrics
- **FINDING:** Candidate PII (name) is included in prompts. No data processing agreement visibility. Anthropic receives behavioral assessment data.

### TB-5: Server <-> ElevenLabs TTS API
- **Guard:** API key server-side, proxied through `/api/assess/[token]/tts`
- **Data crossing:** Assessment text (Aria's spoken responses)
- **FINDING:** Properly proxied. Voice ID removed from tts-config response. Text capped at 2000 chars.

### TB-6: Server <-> PostgreSQL (Supabase)
- **Guard:** Connection string with credentials, Prisma ORM (no raw SQL except health check `SELECT 1`)
- **FINDING:** Single `$queryRawUnsafe("SELECT 1")` in health check is safe (no user input). All other queries use Prisma parameterized queries.

### TB-7: Org A <-> Org B (multi-tenancy boundary)
- **Guard:** Every dashboard API route checks `session.user.orgId` against the target resource's orgId
- **FINDING:** Consistently enforced across all routes examined. The `filterCandidateForRole()` function provides defense-in-depth RBAC filtering.

---

## 4. Attack Surface Enumeration

### 4.1 Unauthenticated (Internet-Facing)

| Endpoint | Method | Auth | Rate Limited | Risk Level |
|---|---|---|---|---|
| `/assess/[token]` (page) | GET | None (public page) | No | Low |
| `/assess/[token]/start` | POST | linkToken only | **NO** | **HIGH** |
| `/api/assess/[token]/chat` | POST | linkToken only | Yes (30/min) | High |
| `/api/assess/[token]/response` | POST | linkToken only | Yes (60/min) | Medium |
| `/api/assess/[token]/complete` | POST | linkToken only | Yes (5/min) | Medium |
| `/api/assess/[token]/tts` | POST | linkToken only | Yes (60/min) | Medium |
| `/api/assess/[token]/tts-config` | GET | linkToken only | Yes (1/hr) | Low |
| `/api/assess/[token]/survey` | POST | linkToken only | Yes (5/min) | Low |
| `/api/admin/health` | GET | HEALTH_SECRET (optional!) | No | **Medium** |
| `/api/cron/expire-invitations` | GET | CRON_SECRET | No | Low |
| `/api/cron/send-results` | GET | CRON_SECRET | No | Low |
| `/api/cron/recover-stuck-assessments` | GET | CRON_SECRET | No | Medium |
| `/api/dev/impersonate` | POST | NODE_ENV=development | No | Low (if properly deployed) |
| `/auth/callback` | GET | Supabase OAuth | No | Low |
| `/api/onboarding` | POST | Supabase session | No | Low |
| `/login`, `/forgot-password` | GET | None (public pages) | No | Low |

### 4.2 Authenticated (Dashboard)

| Endpoint | Auth Level | Org-Scoped |
|---|---|---|
| `/api/candidates` | Any authenticated | Yes |
| `/api/candidates/[id]/*` | Various RBAC levels | Yes |
| `/api/roles/*` | Various RBAC levels | Yes |
| `/api/invitations/*` | Non-external-collaborator | Yes |
| `/api/team/*` | canManageTeam (TA_LEADER+) | Yes |
| `/api/admin/analytics` | TA_LEADER/ADMIN | Yes |
| `/api/export/data` | TA_LEADER/ADMIN | Yes |
| `/api/export/pdf/*` | Session required | Yes |
| `/api/email/results` | Session required | Yes |

---

## 5. Threat Model

### Legend
- **L** = Likelihood (1-5, where 5 = near certain)
- **I** = Impact (1-5, where 5 = catastrophic)
- **Risk** = L x I
- **Status**: OPEN / MITIGATED / ACCEPTED / NEW (since last model)

| ID | Threat | STRIDE | Attack Vector | Severity | L | I | Risk | Mitigation | Status |
|---|---|---|---|---|---|---|---|---|---|
| **T-001** | **linkToken brute-force/enumeration** | Spoofing | Attacker guesses or enumerates CUID linkTokens to access assessments | Medium | 2 | 4 | 8 | CUIDs have ~100 bits entropy; rate limiting on assess endpoints. No enumeration oracle (404 vs 401 both return same shape). | ACCEPTED |
| **T-002** | **linkToken sharing / proxy test-taking** | Spoofing | Candidate shares assessment URL; someone else takes the test | **Critical** | 4 | 5 | **20** | Session binding exists in code but is **DISABLED** across all assess routes. Any person with the URL can take the assessment for the candidate. | **OPEN** |
| **T-003** | **Assessment start route missing rate limit** | DoS | Attacker repeatedly hits `/assess/[token]/start` to create DB entries | Medium | 3 | 3 | 9 | Start route has no `checkRateLimitAsync` call. Idempotent on existing assessment but initial creation is unprotected. | **OPEN** |
| **T-004** | **No CORS on assessment API endpoints** | Info Disclosure | Malicious site makes cross-origin requests to assess APIs using a stolen linkToken | Medium | 3 | 3 | 9 | No Access-Control-Allow-Origin headers are set. Browser same-origin policy provides some protection, but POST requests with simple content types bypass preflight. | **OPEN** |
| **T-005** | **Item bank correct answers in source code** | Info Disclosure | Candidate views browser DevTools or JS bundles to find correct answers | **High** | 3 | 5 | **15** | `item-bank.ts` has `import "server-only"` which prevents client bundling. `correctAnswer` field is in item-bank.ts used server-side (line 403 of chat route: `elementResponse.value === item.correctAnswer`). Answers also loaded from `Act2ItemAnswer` DB table for scoring. The `server-only` import is the primary guard -- if it fails or is misconfigured, all 96 answers leak. `stripSensitiveFields()` provides defense-in-depth for Turn response data. | PARTIALLY MITIGATED |
| **T-006** | **Prompt injection via candidate responses** | Tampering | Candidate crafts responses that manipulate Aria's behavior, extract rubric criteria, or force STRONG classification | **High** | 4 | 4 | **16** | Multiple mitigations: `escapeXml()` wraps candidate text, `<candidate_response>` containment tags, `sanitizeHistory()` strips XML tags and caps length, `normalizeInput()` strips sentinel patterns. Classification uses dual-eval consensus. However, the classification prompt includes full rubric indicators, branch scripts, and few-shot examples -- a sophisticated attacker could craft responses that align with STRONG indicators. | PARTIALLY MITIGATED |
| **T-007** | **Classification few-shot examples in source** | Info Disclosure | Developer or insider leaks classification.ts which contains exact STRONG/ADEQUATE/WEAK rubric scores and example responses | Medium | 2 | 4 | 8 | Few-shot examples in `FEW_SHOT_EXAMPLES` constant provide a scoring playbook. Anyone with source access knows exactly what a "STRONG" response looks like and the numeric rubricScore thresholds. | ACCEPTED (mitigate if source becomes public) |
| **T-008** | **responseTimeMs client-supplied and trusted** | Tampering | Candidate manipulates `responseTimeMs` values sent in element responses and item responses | Medium | 3 | 3 | 9 | `responseTimeMs` is used in scoring via `scoreItem()` -> `avgResponseTimeMs` in aggregation. While not the primary score driver (difficulty-weighted accuracy is), manipulated timing could affect ceiling characterization and response-time-based red flags. | **OPEN** |
| **T-009** | **Item response retroactive modification (10s window)** | Tampering | Candidate submits initial response then corrects within 10-second upsert window | Low | 2 | 3 | 6 | PRO-76 fix introduced 10s lock window. Within that window, answers can still be changed. This is a design choice for network-retry resilience. | ACCEPTED |
| **T-010** | **HEALTH_SECRET is optional** | Info Disclosure | If HEALTH_SECRET is not set, `/api/admin/health` is accessible to anyone and reveals DB connectivity status, API key presence, and latency metrics | Medium | 3 | 3 | 9 | `env.ts` line 45: `HEALTH_SECRET: z.string().optional()`. If unset, the health check's auth block is skipped (line 13: `if (healthSecret) {`). Information leakage includes: DB status, latency, and which API keys are configured. | **OPEN** |
| **T-011** | **Dev impersonate route in production** | Elevation of Privilege | If NODE_ENV is not properly set, `/api/dev/impersonate` allows role switching | Low | 1 | 5 | 5 | Guarded by `process.env.NODE_ENV !== "development"` check. Vercel sets NODE_ENV=production. Low risk but verify deployment config. | ACCEPTED |
| **T-012** | **Dev role impersonation via cookie** | Elevation of Privilege | In development mode, `__dev_role` cookie allows any role without authentication | Low | 1 | 5 | 5 | Only active when `NODE_ENV === "development"`. Same risk profile as T-011. | ACCEPTED |
| **T-013** | **Anthropic API key compromise** | Info Disclosure | API key leaked via logs, error messages, or source code repository | Medium | 2 | 4 | 8 | Key is in env vars, never returned in responses. Sentry error reporting could potentially capture env context -- verify Sentry scrubbing config. | PARTIALLY MITIGATED |
| **T-014** | **ElevenLabs TTS abuse via valid token** | DoS / Financial | Attacker with a valid linkToken makes 60 TTS requests/minute with 2000-char text, consuming ElevenLabs credits | Medium | 3 | 3 | 9 | Rate limited to 60/min/token. Text capped at 2000 chars. But a single assessment could cost significant TTS credits if automated. | ACCEPTED |
| **T-015** | **Scoring pipeline resource exhaustion** | DoS | Attacker triggers scoring pipeline repeatedly via `/api/assess/[token]/complete` | Low | 2 | 3 | 6 | Rate limited to 5/min/token. Idempotent (checks `completedAt` with TOCTOU protection via transaction). Retry logic has exponential backoff with max 3 attempts. | MITIGATED |
| **T-016** | **Cross-org data access (IDOR)** | Info Disclosure | Authenticated user accesses another org's candidates/roles/data by manipulating IDs | Low | 1 | 5 | 5 | Consistently enforced org-scope checks across all examined routes. PRO-70 and PRO-72 fixed specific IDOR gaps. | MITIGATED |
| **T-017** | **CSV injection in batch import** | Tampering | Attacker uploads CSV with formula injection (`=CMD()`) that executes when recruiter exports data | Medium | 2 | 3 | 6 | CSV export in `/api/export/data/route.ts` quotes values containing commas/quotes/newlines but does NOT escape leading `=`, `+`, `-`, `@` characters which trigger formula execution in Excel/Sheets. | **OPEN** |
| **T-018** | **Email header injection** | Tampering | Attacker provides crafted email address in invitation to inject headers | Low | 2 | 3 | 6 | Email regex validation `^[^\s@]+@[^\s@]+\.[^\s@]+$` prevents basic injection but is permissive. Using Resend SDK which handles header escaping. | ACCEPTED |
| **T-019** | **Candidate PII in Anthropic API calls** | Info Disclosure / Compliance | Candidate names, responses, and behavioral assessments sent to Anthropic | **High** | 5 | 3 | **15** | By design -- AI assessment requires sending data. `candidateName` is included in prompt assembly (line 46 of prompt-assembly.ts). Need DPA with Anthropic. Under GDPR, Anthropic is a sub-processor. | **OPEN** (compliance action needed) |
| **T-020** | **Webhook SSRF via SCORING_FAILURE_WEBHOOK_URL** | Tampering | If env var is set to internal URL, server makes requests to internal services | Low | 1 | 4 | 4 | `isPrivateUrl()` function validates HTTPS, rejects private IP ranges, localhost, and link-local. Does NOT handle DNS rebinding or non-standard ports. | PARTIALLY MITIGATED |
| **T-021** | **Assessment gaming: AI manipulation via strategic responses** | Tampering | Candidate studies the beat structure (INITIAL_RESPONSE -> COMPLICATION -> SOCIAL_PRESSURE -> RESOLUTION -> META_REFLECTION) and crafts optimal responses at each stage | **High** | 3 | 4 | **12** | Beat structure is hardcoded and predictable. Classification rubric is server-side but the pattern is learnable across attempts. Dual-eval consensus mitigates single-shot manipulation but systematic gaming of the assessment framework is feasible. | **OPEN** |
| **T-022** | **Concurrent assessment sessions** | Tampering | With session binding disabled, multiple browsers can interact with the same assessment simultaneously | High | 3 | 4 | 12 | Optimistic concurrency (PRO-7) prevents state corruption, but two people could collaborate -- one answering questions while the other researches. | **OPEN** (same root cause as T-002) |
| **T-023** | **Assessment replay attack** | Spoofing | Candidate who receives a second invitation (re-assessment) has prior knowledge of scenarios | Medium | 3 | 3 | 9 | Content libraries provide variant selection (`selectRandomVariants`) for role-specific content. But the 4 scenario shells are hardcoded in SCENARIOS constant. Re-assessment exposes the same structural pattern. | ACCEPTED |
| **T-024** | **Unvalidated redirect in team invite accept URL** | Info Disclosure | `acceptUrl` constructed from env var + DB values. If `NEXT_PUBLIC_APP_URL` is manipulated or org slug contains path traversal | Low | 1 | 3 | 3 | `NEXT_PUBLIC_APP_URL` is a required env var validated at startup. Org slug comes from DB (set at org creation). Low risk. | ACCEPTED |
| **T-025** | **Batch invitation email bombing** | DoS | Authenticated non-external user can import up to 200 candidates at once, triggering 200 emails | Medium | 3 | 2 | 6 | Max 200 per batch. No per-user rate limit on batch imports (unlike team invites which have 20/hour). An authenticated user could repeatedly batch-import to spam email addresses. | **OPEN** |
| **T-026** | **Full data export exposes all candidate PII** | Info Disclosure | TA_LEADER or ADMIN exports `/api/export/data?type=full` which includes names, emails, full assessment details | Medium | 2 | 4 | 8 | Restricted to TA_LEADER/ADMIN. No audit logging of exports. No download rate limiting. A compromised admin account leads to full data exfiltration. | PARTIALLY MITIGATED |
| **T-027** | **Scoring pipeline AI cost amplification** | DoS / Financial | Cron route `recover-stuck-assessments` triggers scoring pipeline for up to 20 unscored assessments per run, each involving multiple Claude API calls | Low | 2 | 3 | 6 | Cron protected by CRON_SECRET. Pipeline runs are bounded. Cost per assessment is bounded by `evaluationRunCount` (3 in production). | ACCEPTED |
| **T-028** | **`$queryRawUnsafe` SQL injection surface** | Tampering | `prisma.$queryRawUnsafe("SELECT 1")` in health check | Low | 1 | 5 | 5 | Hardcoded query string with no user input. Safe, but the use of `$queryRawUnsafe` instead of `$queryRaw` is a code smell that could be copied unsafely elsewhere. | ACCEPTED |
| **T-029** | **linkToken in email/URL visible to intermediaries** | Info Disclosure | Email systems, browser history, HTTP referrer headers, and corporate proxies may log the linkToken URL | Medium | 3 | 4 | 12 | linkTokens are in URL path (not query string, which is better for referrer leakage). But email providers, corporate DLP systems, and browser history all store the full URL. Token has no IP binding or session binding to limit exposure. | **OPEN** |
| **T-030** | **Supabase anon key exposed client-side** | Info Disclosure | `NEXT_PUBLIC_SUPABASE_ANON_KEY` is in client bundles by design | Low | 5 | 1 | 5 | By design -- Supabase anon key is public. Row Level Security (RLS) policies should be the guard. Verify RLS is properly configured on all tables. | ACCEPTED (verify RLS) |
| **T-031** | **No request body size limits on assess routes** | DoS | Attacker sends extremely large JSON bodies to assessment routes | Medium | 3 | 2 | 6 | Individual fields are capped (text 2000-5000 chars, content 3000 chars via normalizeInput). But overall request body is unbounded at the route level. Vercel has a 4.5MB default limit which provides some protection. | ACCEPTED |
| **T-032** | **Sensitive data in console.error logging** | Info Disclosure | Multiple routes log errors with `console.error` which may include request bodies, candidate data, or stack traces in Vercel logs | Medium | 3 | 3 | 9 | Error logging includes candidate emails in cron routes (line 91 of send-results: `Failed for ${candidate.email}`). Sentry captures exceptions with extra context. Verify log scrubbing. | **OPEN** |
| **T-033** | **Missing Content-Security-Policy headers** | Multiple | No CSP headers observed; XSS vulnerabilities would have no browser-level mitigation | Medium | 2 | 3 | 6 | Next.js provides some built-in XSS protection through React's JSX escaping. But no CSP headers means no defense-in-depth against script injection. | **OPEN** |
| **T-034** | **Adaptive loop `correctAnswer` comparison in chat route** | Info Disclosure | Line 403 of chat/route.ts: `elementResponse.value === item.correctAnswer` -- the ITEM_BANK is imported server-side and contains answer data. If a timing side-channel existed or error messages differed based on correctness, answers could leak. | Low | 1 | 4 | 4 | No observable difference in response based on correctness (comparison result only affects adaptive loop state). `server-only` import prevents client bundling. | ACCEPTED |
| **T-035** | **Classification prompt leaks assessment methodology** | Info Disclosure | If Claude's response includes reasoning about rubric indicators or branch scripts, this is streamed to the candidate | Medium | 2 | 4 | 8 | Classification runs as a separate non-streamed call (not in the streaming response). The streaming `streamText` call to Claude uses a separate prompt. `sanitizeAriaOutput()` strips template labels and structural artifacts. | MITIGATED |

---

## 6. Attack Chains

### Chain 1: Assessment Fraud (T-002 + T-022 + T-029)
**Scenario:** Candidate shares linkToken URL (obtained from email or browser history) with a domain expert. Expert opens URL in separate browser. Both interact with the assessment -- candidate on camera, expert providing answers via separate device.
**Impact:** Complete invalidation of assessment results. Undetectable without session binding or behavioral biometrics.
**Probability:** HIGH -- this is the most common form of assessment cheating.
**Mitigation:** Re-enable session binding (code exists, just commented out). Add IP fingerprinting. Consider webcam proctoring integration.

### Chain 2: Assessment Gaming via Source Knowledge (T-005 + T-007 + T-021)
**Scenario:** Insider (or someone with source code access) studies `classification.ts` few-shot examples to learn exactly what STRONG responses look like, reviews the beat structure pattern (6 beats x 4 scenarios), and crafts responses that align with STRONG rubric indicators.
**Impact:** Candidate receives artificially high scores across all constructs.
**Probability:** MEDIUM -- requires source access, but code could leak via employee, contractor, or public repo misconfiguration.
**Mitigation:** Move few-shot examples and rubric weights to database (content library). Randomize beat ordering where possible. Add response authenticity signals (timing patterns, linguistic consistency).

### Chain 3: PII Exfiltration via Compromised Admin (T-026 + T-032 + T-019)
**Scenario:** Attacker compromises a TA_LEADER or ADMIN account (phishing, credential stuffing). Exports all candidate data via `/api/export/data?type=full`. Also has access to Vercel logs which may contain additional PII from console.error statements.
**Impact:** Full breach of all candidate PII including behavioral assessment profiles. GDPR Article 33 notification required within 72 hours.
**Probability:** MEDIUM -- admin accounts are high-value targets with no apparent MFA enforcement at the application layer (delegated to Supabase Auth configuration).

### Chain 4: Financial Abuse via TTS/AI Amplification (T-014 + T-003)
**Scenario:** Attacker obtains or brute-forces a valid linkToken. Scripts automated requests: starts assessment (unrate-limited), then sends 60 TTS requests/minute with 2000-char payloads, and 30 chat requests/minute (each triggering Claude API calls). Runs across multiple tokens.
**Impact:** Significant Anthropic and ElevenLabs API cost amplification. A single token can generate ~$5-15/hour in API costs; across hundreds of valid tokens, this scales.
**Probability:** LOW-MEDIUM -- requires valid tokens but invitation emails are broadly sent.

---

## 7. Mitigation Priorities

### Must-Have (Block Deployment / Immediate Fix)

1. **Re-enable session binding** (T-002, T-022, Chain 1)
   - The code exists in `src/lib/session/assess-session.ts` and is well-implemented
   - Uncomment imports and calls in all `/api/assess/[token]/*` routes
   - Add session binding to the start route as well
   - This is the single highest-impact fix -- without it, assessment integrity is fundamentally compromised

2. **Add rate limiting to start route** (T-003)
   - Add `checkRateLimitAsync` call to `/assess/[token]/start/route.ts`
   - Suggested limit: 5 requests per minute per token (same as assessmentComplete)

3. **Add CORS headers to assess API routes** (T-004)
   - Configure `Access-Control-Allow-Origin` to restrict to the application domain
   - Use Next.js middleware or route-level headers

### Should-Have (Current Cycle)

4. **Make HEALTH_SECRET required** (T-010)
   - Change `env.ts` line 45 from `z.string().optional()` to `z.string().min(16, "HEALTH_SECRET is required")`
   - Or remove the public information from the health endpoint when no secret is configured

5. **Add CSV formula injection protection** (T-017)
   - In `formatResponse()` in `/api/export/data/route.ts`, prefix values starting with `=`, `+`, `-`, `@`, `\t`, `\r` with a single quote or tab character

6. **Add audit logging for data exports** (T-026)
   - Log export events to ActivityLog table with user ID, export type, and timestamp
   - Consider rate limiting exports (e.g., 10 per hour per user)

7. **Scrub PII from error logs** (T-032)
   - Replace `candidate.email` in error messages with candidate ID
   - Configure Sentry data scrubbing rules for email patterns
   - Review all `console.error` calls for PII leakage

8. **Establish DPA with Anthropic** (T-019)
   - Review Anthropic's data processing terms
   - Document legal basis for sending candidate PII to Anthropic under GDPR
   - Consider anonymizing candidate names before sending to API

9. **Server-side responseTimeMs validation** (T-008)
   - Validate `responseTimeMs` falls within plausible bounds (e.g., > 500ms, < 300000ms)
   - Consider computing server-side timing as the authoritative source

### Nice-to-Have (Backlog)

10. **Content-Security-Policy headers** (T-033)
    - Add strict CSP via Next.js middleware or `next.config.js` headers
    - At minimum: `default-src 'self'; script-src 'self' 'unsafe-inline'` (adjust for Vercel analytics, Sentry, etc.)

11. **Rate limit batch invitations** (T-025)
    - Add per-user rate limit to batch import endpoint (e.g., 3 batch imports per hour)

12. **Move classification few-shot examples to DB** (T-007, Chain 2)
    - Store few-shot examples in ContentLibrary or a dedicated table
    - Allows per-role customization and reduces source code sensitivity

13. **DNS rebinding protection for webhook SSRF** (T-020)
    - Resolve webhook hostname and verify the resolved IP is not private before making the request
    - Or use an allowlist of permitted webhook domains

14. **linkToken rotation / one-time-use** (T-029)
    - Consider making linkTokens expire after first assessment start
    - Or rotate the token after the session is bound

---

## 8. Compliance Impact

### GDPR / CCPA
- **Candidate PII** (name, email, phone, behavioral profiles) is personal data under GDPR
- **Anthropic as sub-processor** requires a Data Processing Agreement (Article 28)
- **Right to deletion** -- no visible implementation of candidate data deletion endpoints. Need `DELETE /api/candidates/[id]` with cascading deletion of assessment data, messages, scores, and AI interactions
- **Data retention** -- no automatic data purging. Assessment data persists indefinitely
- **Automated decision-making** -- GDPR Article 22 may apply if assessment scores are used as the sole basis for employment decisions. Candidates have the right to human review.
- **Privacy notice** -- candidates should be informed that AI is evaluating their responses before the assessment begins

### Employment Law / AI Regulation
- **NYC Local Law 144** -- if ACI is used for candidates in NYC, an annual bias audit is required for automated employment decision tools
- **EU AI Act** -- AI systems used in employment/recruitment are classified as "high-risk" (Article 6, Annex III). Requires conformity assessment, technical documentation, human oversight, and transparency to subjects
- **EEOC Guidance** -- AI tools that cause disparate impact on protected groups may violate Title VII. Need adverse impact analysis across demographic groups.

### Defense Industry Clients
- **CMMC** -- if defense clients require it, candidate assessment data may need specific handling controls
- **ITAR** -- unlikely to apply to assessment data specifically, but verify no technical data flows through the platform
- **FedRAMP** -- Vercel is not FedRAMP authorized. If government clients require FedRAMP, infrastructure migration is needed.

---

## 9. Residual Risks & Accepted Risk Rationale

| Risk ID | Description | Residual Risk After Mitigation | Acceptance Rationale | Review Date |
|---|---|---|---|---|
| T-001 | linkToken brute force | LOW -- CUID entropy is ~100 bits | Computationally infeasible to enumerate. Monitor for anomalous access patterns. | 2026-06-30 |
| T-009 | 10s answer modification window | LOW -- by design for network resilience | Trade-off between retry resilience and answer finality. 10s is narrow enough. | 2026-06-30 |
| T-011/T-012 | Dev mode role impersonation | VERY LOW -- requires NODE_ENV=development | Vercel sets production mode. Add deployment verification test. | 2026-06-30 |
| T-014 | TTS cost amplification | MEDIUM -- rate limited but still costly | Monitor ElevenLabs spend. Add alerting at cost thresholds. Set ElevenLabs API spend caps. | 2026-04-30 |
| T-023 | Assessment replay knowledge | MEDIUM -- structural pattern is learnable | Content libraries provide content variation. Long-term: expand scenario pool. | 2026-09-30 |
| T-030 | Supabase anon key public | VERY LOW -- by design | Verify RLS policies are comprehensive. Anon key only grants authenticated user access via RLS. | 2026-06-30 |

---

## 10. Risk Register Summary (Sorted by Risk Score)

| Rank | ID | Risk Score | Severity | Status |
|---|---|---|---|---|
| 1 | T-002 | 20 | CRITICAL | OPEN -- session binding disabled |
| 2 | T-006 | 16 | HIGH | PARTIALLY MITIGATED |
| 3 | T-019 | 15 | HIGH | OPEN -- compliance action |
| 4 | T-005 | 15 | HIGH | PARTIALLY MITIGATED |
| 5 | T-021 | 12 | HIGH | OPEN |
| 6 | T-022 | 12 | HIGH | OPEN (same root cause as T-002) |
| 7 | T-029 | 12 | MEDIUM | OPEN |
| 8 | T-003 | 9 | MEDIUM | OPEN |
| 9 | T-004 | 9 | MEDIUM | OPEN |
| 10 | T-008 | 9 | MEDIUM | OPEN |
| 11 | T-010 | 9 | MEDIUM | OPEN |
| 12 | T-014 | 9 | MEDIUM | ACCEPTED |
| 13 | T-032 | 9 | MEDIUM | OPEN |
| 14 | T-001 | 8 | MEDIUM | ACCEPTED |
| 15 | T-007 | 8 | MEDIUM | ACCEPTED |
| 16 | T-013 | 8 | MEDIUM | PARTIALLY MITIGATED |
| 17 | T-026 | 8 | MEDIUM | PARTIALLY MITIGATED |
| 18 | T-035 | 8 | MEDIUM | MITIGATED |
| 19 | T-017 | 6 | MEDIUM | OPEN |
| 20 | T-025 | 6 | MEDIUM | OPEN |
| 21 | T-033 | 6 | MEDIUM | OPEN |
| 22 | T-009 | 6 | LOW | ACCEPTED |
| 23 | T-015 | 6 | LOW | MITIGATED |
| 24 | T-027 | 6 | LOW | ACCEPTED |
| 25 | T-031 | 6 | LOW | ACCEPTED |
| 26 | T-011 | 5 | LOW | ACCEPTED |
| 27 | T-012 | 5 | LOW | ACCEPTED |
| 28 | T-016 | 5 | LOW | MITIGATED |
| 29 | T-018 | 6 | LOW | ACCEPTED |
| 30 | T-028 | 5 | LOW | ACCEPTED |
| 31 | T-030 | 5 | LOW | ACCEPTED |
| 32 | T-020 | 4 | LOW | PARTIALLY MITIGATED |
| 33 | T-034 | 4 | LOW | ACCEPTED |
| 34 | T-024 | 3 | LOW | ACCEPTED |

---

## 11. Changes Since Last Model (2026-03-20)

### Improvements Confirmed
- **CRON_SECRET bypass (NEW-05 from 2026-03-20):** FIXED -- `env.ts` now requires CRON_SECRET with min 32 chars; cron routes have explicit `!secret` null guard
- **Correct answers moved to DB:** PARTIALLY FIXED -- scoring pipeline loads from `Act2ItemAnswer` table, but `item.correctAnswer` is still used in the chat route's adaptive loop (line 403)
- **Redis rate limiting:** CONFIRMED WIRED across all assess routes
- **SSRF protection:** `isPrivateUrl()` added to webhook URL validation
- **Org-scope guards:** PRO-70 (content library IDOR) and PRO-72 (cross-org results email) fixed
- **Sentinel injection:** PRO-8 fix prevents candidate-submitted bracket patterns from being recognized as control sentinels

### New / Escalated Findings
- **T-033 (CSP headers):** New finding -- no Content-Security-Policy
- **T-017 (CSV injection):** New finding -- formula injection in data exports
- **T-025 (batch email bombing):** New finding -- no rate limit on batch invitations
- **T-032 (PII in logs):** Escalated -- specific instances identified in cron routes

### Persisting Critical Issues
- **Session binding remains disabled** (T-002) -- this was flagged in the 2026-03-20 model and remains the #1 risk
- **No CORS configuration** (T-004) -- persists from previous model
- **Start route unprotected** (T-003) -- persists from previous model

---

## 12. Assessment Gaps

The following areas could not be fully assessed and require additional investigation:

1. **Supabase RLS policies** -- Row Level Security configuration was not visible from the application code. Verify that RLS policies on all tables properly restrict access.
2. **Vercel deployment configuration** -- Environment variable settings, edge config, and deployment protection settings could not be verified.
3. **Sentry data scrubbing** -- Configuration of Sentry's `beforeSend` hook and data scrubbing rules was not examined.
4. **Network segmentation** -- Vercel's network architecture and database connection security (TLS, connection pooling) were not verified.
5. **Anthropic data handling** -- Whether Anthropic retains or trains on ACI's API data requires contractual verification.
6. **Supabase Auth configuration** -- MFA enforcement, password policies, and OAuth provider settings are configured in the Supabase dashboard, not visible in code.
7. **CI/CD pipeline security** -- Build process, dependency scanning, and secret injection were not assessed.
8. **Supply chain** -- 40+ npm dependencies including `ai`, `@ai-sdk/anthropic`, `@react-pdf/renderer`. No `npm audit` or Dependabot configuration was examined.

---

*Next review: 2026-04-30 or upon major feature release, whichever comes first.*

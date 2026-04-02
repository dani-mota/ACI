# Multi-Tenancy Threat Model -- ACI Assessment Platform

**Date:** 2026-03-30
**Assessor:** Security Threat Modeler (Claude Opus 4.6)
**Scope:** Tenant isolation across shared Neon PostgreSQL, shared Vercel deployment, shared API keys (Anthropic, ElevenLabs)
**Prior Model:** THREAT-MODEL-2026-03-30.md (general platform threat model)

---

## 1. Scope & Context

ACI is a multi-tenant SaaS assessment platform where multiple organizations share:

- **One Neon PostgreSQL database** (single connection string, Prisma as table owner)
- **One Vercel deployment** (shared serverless functions, single domain)
- **One Anthropic API key** (all Claude calls for all orgs)
- **One ElevenLabs API key** (all TTS calls for all orgs)
- **One Redis instance** (Upstash -- rate limiting)
- **One Resend/SMTP credential** (email delivery)
- **One Sentry DSN** (error reporting)

The tenant boundary is enforced **exclusively at the application layer** via `session.user.orgId` scoping in Prisma queries. RLS policies exist but are **bypassed by the Prisma connection** (connects as `neondb_owner`, which PostgreSQL exempts from RLS).

### Data Classification

| Data Type | Classification | Regulatory Context |
|---|---|---|
| Candidate PII (name, email, phone) | Sensitive Personal | GDPR, CCPA, state biometric laws |
| Assessment responses (free text) | Confidential | May contain implicit health/disability data |
| AI evaluation scores & narratives | Confidential | EEOC disparate impact, NYC LL144, EU AI Act |
| Organization configuration (roles, cutlines, weights) | Confidential/Trade Secret | Competitive intelligence for hiring |
| Conversation transcripts sent to Anthropic | Sensitive Personal | DPA required, data residency |
| Recruiter notes on candidates | Sensitive Personal | GDPR right of access, potential defamation |

---

## 2. Architecture: Tenant Isolation Points

### Trust Boundaries

```
                    Internet
                       |
              [Vercel Edge / CDN]
                       |
         +-------------+-------------+
         |                           |
  [Dashboard Routes]          [Assess Routes]
  Auth: Supabase JWT          Auth: linkToken (CUID)
  Org scope: session.orgId    Org scope: NONE (implicit via token->invitation->candidate->org)
         |                           |
         +-----------+---------------+
                     |
            [Prisma ORM Layer]
            Connection: neondb_owner (BYPASSES RLS)
            Org filter: application-level WHERE clause
                     |
            [Neon PostgreSQL]
            RLS: ENABLED but BYPASSED by owner role
                     |
    +-------+--------+--------+--------+
    |       |        |        |        |
  Orgs   Cands   Assess   Roles    Notes
  (all co-located, no schema separation)
```

### Isolation Enforcement Points

| Layer | Mechanism | Enforced? | Gap? |
|---|---|---|---|
| Database schema | Shared schema, `orgId` FK on entities | Yes | No schema-level separation |
| PostgreSQL RLS | Policies on 22 tables | **BYPASSED** -- Prisma connects as owner | RLS is cosmetic for primary access path |
| Application queries (dashboard) | `where: { orgId: session.user.orgId }` | **Mostly** | See gaps below |
| Application queries (assess routes) | Token -> invitation -> candidate (implicit org) | Yes | No explicit orgId check |
| Application queries (cron jobs) | Global queries, no org filter | **Cross-org by design** | Intentional but risky |
| API key isolation | Shared keys, no per-org separation | **None** | Single blast radius |
| Rate limiting | Per-token (assess), no per-org (dashboard) | **Partial** | No org-level throttling |
| Audit logging | ActivityLog model exists, sparse usage | **Minimal** | Only 5 files write ActivityLog |

---

## 3. Threat Model: Multi-Tenancy Risk Matrix

### Scenario 1: Tenant Boundary Violations

| ID | Threat | STRIDE | Attack Vector | Likelihood (1-5) | Impact (1-5) | Risk Score | Current Mitigation | Gap |
|---|---|---|---|---|---|---|---|---|
| MT-001 | **Scoring pipeline has no org validation** -- `runScoringPipeline(assessmentId)` accepts any assessmentId with no org check. A manipulated cron recovery or webhook could score assessments from wrong org context. | Information Disclosure | Supply arbitrary assessmentId to scoring pipeline via stuck-assessment cron | 2 | 5 | **10** | Pipeline is only called from token-validated assess routes and CRON_SECRET-protected cron | If CRON_SECRET leaks, attacker can trigger scoring for any assessment. Pipeline fetches `assessment.candidate.primaryRole` without verifying org membership. |
| MT-002 | **`getDashboardData()` accepts optional orgId** -- the `orgId` parameter is optional. If any caller passes `undefined`, ALL orgs' data is returned. | Information Disclosure | Code path where orgId is undefined or null | 3 | 5 | **15** | All dashboard page callers pass `session.user.orgId` | `getDashboardData()` default is no filter: `const where: any = orgId ? { orgId } : {}`. A single missed orgId parameter leaks all tenants' data. Defense-in-depth is absent since RLS is bypassed. |
| MT-003 | **`getCandidateData()` IDOR via candidate ID** -- candidate is fetched by `id` first, org check happens after. The response timing differs between "wrong org" (returns null after fetch) vs "not found" (returns null immediately). | Information Disclosure | Enumerate candidate IDs (CUIDs are not sequential but are 25 chars, guessable if pattern known) | 2 | 4 | **8** | Explicit `if (orgId && candidate.orgId !== orgId) return null` check | Timing oracle: DB fetch + org check vs immediate null. CUIDs are pseudo-random but not cryptographically opaque. |
| MT-004 | **`getCompareData()` batch candidate fetch** -- fetches multiple candidates by IDs array. Org filter uses spread: `...(orgId ? { orgId } : {})`. If orgId is falsy, returns candidates from ALL orgs in a single response. | Information Disclosure | Pass candidate IDs from another org if orgId is not provided | 3 | 5 | **15** | Caller provides orgId from session | Same pattern as MT-002: optional orgId with no default-deny fallback. |
| MT-005 | **Cron `send-results` operates cross-org** -- iterates ALL candidates across ALL non-demo orgs with completed assessments. No org scoping. | Information Disclosure, Tampering | Cron job sends results emails. If email template includes org-specific branding from wrong org, candidate receives confusing/incorrect results. | 3 | 3 | **9** | `org: { isDemo: false }` filter excludes demos. Each candidate's own org.name is used in template. | No isolation concern for email content (uses candidate's own org). But a bug in the query or template could leak cross-org data. The paginated cursor-based query over ALL orgs is a single-failure-point. |
| MT-006 | **Cron `recover-stuck-assessments` operates cross-org** -- queries ALL assessments globally for stuck state. Runs scoring pipeline for each without any org guard. | Tampering | If two orgs' assessments are stuck simultaneously, scoring runs sequentially sharing the same Anthropic API budget and connection pool. A large batch from Org A could starve Org B's recovery. | 3 | 3 | **9** | Capped at 20 unscored assessments per run. | No per-org fairness in recovery ordering. First-found gets resources. |
| MT-007 | **ActivityLog has no org field** -- the `ActivityLog` model stores `entityType`, `entityId`, `action`, `actorId` with no `orgId`. A support agent querying ActivityLog cannot scope to a single org without joining through entity tables. | Information Disclosure | Support/admin querying logs sees all orgs' activity | 4 | 3 | **12** | No admin UI for ActivityLog currently. Only DB queries. | When admin tooling is built, this will be a cross-tenant data leak vector. Any dashboard for audit logs will require complex joins to isolate by org. |

### Scenario 2: Shared Infrastructure Risks

| ID | Threat | STRIDE | Attack Vector | Likelihood (1-5) | Impact (1-5) | Risk Score | Current Mitigation | Gap |
|---|---|---|---|---|---|---|---|---|
| MT-008 | **Anthropic API key shared across all orgs** -- one key, one rate limit, one billing account. | Denial of Service | Org A runs 200 concurrent assessments. Each chat turn calls Claude. Anthropic rate limit (RPM/TPM) exhausted. Org B's candidates get 429s or timeouts. | 4 | 4 | **16** | No per-org throttling on Anthropic calls. Rate limiting is per-token (per-assessment), not per-org. | **Critical gap.** A single org batch can saturate the shared Anthropic key. No circuit breaker, no per-org token budget, no fallback. |
| MT-009 | **ElevenLabs API shared** -- same pattern as Anthropic. | Denial of Service | Org A enables TTS for 500 concurrent candidates. ElevenLabs rate limit or character quota exhausted. Org B's TTS fails, falling back to browser synth. | 3 | 3 | **9** | Rate limit: 60 req/min per token. Text truncated to 2000 chars. | No per-org TTS budget. ElevenLabs character quotas are account-level. One org can consume another's allocation. |
| MT-010 | **Database connection pool exhaustion** -- Prisma pool is `max: 1` per serverless isolate. Neon has account-level connection limits. | Denial of Service | 1000 concurrent assessments from one org saturate Neon's connection limit. Dashboard queries from other orgs fail with connection timeout (5000ms). | 3 | 4 | **12** | Neon's connection pooler (PgBouncer). Prisma pool max=1 limits per-isolate connections. | No per-org connection quotas. Under load, all orgs compete for the same connection pool. A Neon plan's connection limit applies globally. |
| MT-011 | **Vercel serverless function cold starts under load** -- shared deployment means all orgs share the same function concurrency limits. | Denial of Service | Org A batch-invites 500 candidates who all start assessments simultaneously. Vercel function concurrency exhausted. Org B's dashboard returns 504. | 3 | 3 | **9** | Batch invitation capped at 200 rows. `maxDuration=60` on chat routes. | No per-org request priority. Vercel's concurrency is plan-level. |
| MT-012 | **Redis (Upstash) shared rate limit namespace** -- all rate limit keys share one Redis instance. If Redis goes down, fallback is in-memory (per-isolate, not distributed). | Denial of Service | Redis failure causes rate limiting to degrade to per-isolate memory. One org's traffic spike is no longer globally limited. | 2 | 3 | **6** | Graceful fallback to in-memory. | In-memory fallback provides weaker isolation since each isolate tracks independently. |

### Scenario 3: Noisy Neighbor

| ID | Threat | STRIDE | Attack Vector | Likelihood (1-5) | Impact (1-5) | Risk Score | Current Mitigation | Gap |
|---|---|---|---|---|---|---|---|---|
| MT-013 | **500-invitation batch triggers 500 concurrent email sends** -- batch endpoint processes rows sequentially but sends emails via `Promise.allSettled` (all at once). | Denial of Service | 200 emails fired simultaneously (batch cap). Resend API rate limit hit. Other org's invitation emails delayed or fail. | 3 | 3 | **9** | Batch capped at 200 rows. Promise.allSettled prevents total failure. | No email send rate limiting. Resend's API limits are account-wide. No per-org email budget. |
| MT-014 | **1000 concurrent assessments from one org** -- each assessment's chat turn hits Anthropic (streaming), scoring pipeline hits Anthropic (Layer B: 3 eval runs per construct per message). | Denial of Service | Org A onboards a large client cohort. 1000 candidates active simultaneously. Anthropic TPM exhausted. Other orgs' assessments freeze mid-conversation. | 4 | 5 | **20** | Per-token rate limit: 30 chat req/min. | **No per-org aggregate limit.** 1000 tokens * 30 req/min = 30,000 Anthropic calls/min possible from one org. This will exceed any Anthropic tier's RPM. |
| MT-015 | **Scoring pipeline failure cascade** -- one org's batch of assessments all complete simultaneously. Scoring runs in `after()` callbacks (Vercel background). Each scoring run calls Anthropic 3 times per construct per message (~36-108 API calls per assessment). | Denial of Service, Denial of Service | 100 assessments complete within the same 15-minute cron window. Recovery cron tries to score all 100. Each scoring run takes 30-60 seconds of Anthropic API time. | 3 | 4 | **12** | Cron processes max 20 unscored assessments per run. 3 retries with exponential backoff. | 20 * ~50 Anthropic calls = 1000 calls in a single cron invocation. Cron has maxDuration but no per-org fairness. |
| MT-016 | **Content library generation consumes shared AI budget** -- role creation with JD context triggers `generateContentLibrary()` via `after()`. Each generation is a large Anthropic call. | Denial of Service | Org A creates 50 custom roles in rapid succession. Each triggers content generation. Anthropic budget consumed. | 2 | 3 | **6** | Content generation is async (after()). | No queue, no concurrency limit on generation. 50 parallel generations possible. |

### Scenario 4: Data Isolation Under Failure

| ID | Threat | STRIDE | Attack Vector | Likelihood (1-5) | Impact (1-5) | Risk Score | Current Mitigation | Gap |
|---|---|---|---|---|---|---|---|---|
| MT-017 | **Transaction failure in batch import leaks partial state** -- batch invitation processes rows individually (not wrapped in single transaction). If midway failure occurs, some candidates are created, others not. | Tampering | Network partition during batch import. 100/200 candidates created. Admin retries. Upsert updates existing candidates' names and role assignments (including potentially wrong data on retry). | 2 | 3 | **6** | Individual try/catch per row. Upsert semantics. Skipped rows reported in response. | Upsert overwrites `firstName`, `lastName`, `primaryRoleId` on duplicate email. A retry with modified CSV could silently change existing candidate data. |
| MT-018 | **Scoring produces wrong-org role context** -- `runScoringPipeline` fetches `assessment.candidate.primaryRole` and calls `getRoleContext(role.id)`. If role.id has been reassigned or deleted, scoring uses stale/wrong context. | Tampering | Admin deletes custom role while scoring is in progress. Scoring pipeline fetches role that no longer exists. | 1 | 4 | **4** | Role deletion blocked if candidates exist (`_count.candidates > 0`). | Edge case: role deleted between assessment completion and scoring pipeline execution (race window during `after()` callback). |
| MT-019 | **Cron job processes mixed-org batch without isolation** -- `recover-stuck-assessments` queries globally and processes assessments sequentially. If one assessment's scoring fails (throws), it's caught individually. But if the DB connection drops mid-batch, all subsequent assessments (potentially from other orgs) fail. | Denial of Service | DB connection timeout during batch recovery. 5/20 assessments scored. Remaining 15 (from multiple orgs) marked as failed. | 2 | 3 | **6** | Individual try/catch per assessment. Sentry reporting per failure. | No isolation between orgs in the recovery queue. One org's DB-heavy assessment can delay another's recovery. |
| MT-020 | **Error logs contain cross-org PII** -- Sentry captures exceptions with `assessmentId` in extras. Stack traces may include candidate data from Prisma query results. | Information Disclosure | Support engineer investigating Org A's error sees Org B's candidate data in same Sentry project. | 3 | 4 | **12** | Sentry configured but no org-level project separation or PII scrubbing. | **All orgs' errors go to one Sentry project.** Sentry's data is not org-scoped. Any engineer with Sentry access sees all orgs' error context. |

### Scenario 5: Compliance

| ID | Threat | STRIDE | Attack Vector | Likelihood (1-5) | Impact (1-5) | Risk Score | Current Mitigation | Gap |
|---|---|---|---|---|---|---|---|---|
| MT-021 | **No data residency controls** -- all data stored in one Neon region. Org in EU has data in US region (or vice versa). | Information Disclosure | EU org's candidate PII stored in US-based Neon instance. GDPR data residency violation. | 4 | 4 | **16** | None. Single Neon instance. | **No per-org data residency.** If any EU org signs up, immediate GDPR exposure. No ability to specify region per org. |
| MT-022 | **No legal hold capability** -- no mechanism to freeze an org's data from deletion/modification during litigation. | Tampering | Org under litigation. EEOC audit requires preservation of all assessment data. Admin deletes candidates or modifies scores. | 3 | 4 | **12** | No legal hold feature. Cascade deletes enabled on most FK relations. | Assessment data cascades delete from Candidate. A single candidate deletion removes assessment, scores, AI interactions, messages. No soft-delete, no hold flags. |
| MT-023 | **No PII inventory per org** -- no mechanism to enumerate all PII held for a specific org (for GDPR Article 30 records of processing). | Information Disclosure | GDPR Subject Access Request (SAR) received. No tooling to enumerate all data for a specific candidate or org. | 4 | 3 | **12** | Manual DB queries possible. | No automated PII discovery. PII scattered across 8+ tables: Candidate, ConversationMessage (free text), AIInteraction, Note, AssessmentInvitation, OutcomeRecord, ActivityLog. |
| MT-024 | **No retention policy enforcement** -- no TTL on assessment data, conversation messages, or AI evaluation runs. | Information Disclosure | Assessment data from 3 years ago still in DB. Org's data retention policy requires 12-month deletion. Candidate exercises right to erasure. | 4 | 3 | **12** | None. All data retained indefinitely. | No automated purge. No per-org retention settings. No right-to-erasure workflow. |
| MT-025 | **Candidate PII sent to Anthropic without confirmed DPA** -- conversation messages containing candidate free-text responses (which may include health, disability, protected class information) are sent to Anthropic API. | Information Disclosure | Anthropic processes assessment conversations. No confirmed DPA. EU candidate's special category data processed by US AI provider. | 4 | 5 | **20** | Anthropic's general terms. | **No confirmed Data Processing Agreement with Anthropic for employment assessment use case.** This is a GDPR Article 28 violation for EU data subjects. |

### Scenario 6: API Key & Credential Isolation

| ID | Threat | STRIDE | Attack Vector | Likelihood (1-5) | Impact (1-5) | Risk Score | Current Mitigation | Gap |
|---|---|---|---|---|---|---|---|---|
| MT-026 | **Single Anthropic key -- blast radius is all orgs** -- key compromise or revocation affects every org simultaneously. | Denial of Service, Information Disclosure | Anthropic key leaked via Sentry, error log, or developer workstation. Attacker uses key for their own purposes (cost). Key revoked -- all orgs' assessments break. | 2 | 5 | **10** | env.ts validates key presence at startup. Not logged (health check only reports presence). | No per-org keys. No key rotation procedure documented. Single point of failure. |
| MT-027 | **No per-org rate limiting on AI API calls** -- rate limits are per-assessment-token, not per-org. | Denial of Service | Org A has 500 active assessments. Each making 30 chat requests/minute. Total: 15,000 Anthropic requests/minute from one org. | 4 | 4 | **16** | Per-token rate limits (30/min chat, 60/min response). | **No aggregate per-org limit.** The per-token limits don't prevent one org from consuming disproportionate shared resources. |
| MT-028 | **Key rotation requires redeployment** -- all API keys are environment variables. Rotation requires Vercel env var update + redeploy. | Denial of Service | Suspected key compromise. Time to rotate: update Vercel env + redeploy (~5 minutes). During rotation, in-flight requests fail. | 2 | 3 | **6** | Vercel env vars + instant redeploy capability. | No hot-reload of secrets. No dual-key support for zero-downtime rotation. |
| MT-029 | **Resend email key shared -- one org's abuse triggers account suspension** -- if Org A sends spam-like bulk emails, Resend may suspend the account. | Denial of Service | Org A batch-invites 200 candidates with malformed emails. Bounce rate spikes. Resend suspends account. All orgs' emails fail. | 2 | 4 | **8** | Batch capped at 200. Email regex validation. | No per-org email sending domain. No bounce rate monitoring per org. |

### Scenario 7: Audit Trail Isolation

| ID | Threat | STRIDE | Attack Vector | Likelihood (1-5) | Impact (1-5) | Risk Score | Current Mitigation | Gap |
|---|---|---|---|---|---|---|---|---|
| MT-030 | **ActivityLog has no orgId -- cross-org visibility** -- the ActivityLog model stores entity references but no direct org association. | Information Disclosure | Admin/support queries ActivityLog. Sees actions from all orgs unless manually joining through entity tables. | 4 | 3 | **12** | ActivityLog only written in 5 places (team routes, outcomes). No admin UI. | No orgId on ActivityLog. When admin tooling is built, all org activities will be visible to anyone with DB access. |
| MT-031 | **Sentry errors are cross-org** -- all exception captures go to one Sentry project with no org tagging. | Information Disclosure | Engineer debugging Org A's scoring failure sees Org B's assessment data in Sentry event context. | 4 | 3 | **12** | None. | No Sentry org-level filtering, no PII scrubbing rules configured. |
| MT-032 | **No per-org admin isolation** -- ADMIN and TA_LEADER roles within an org can only see their own org's data (via session.orgId), but a platform-level support tool would need cross-org access with proper isolation. | Information Disclosure | No super-admin role for platform operations. If a developer queries DB directly, they see all orgs. Future admin panel must scope per-org. | 3 | 3 | **9** | No platform admin panel exists yet. Direct DB access only. | No platform-admin RBAC. No org-scoped DB access credentials for operations. |
| MT-033 | **Conversation messages contain unstructured PII in audit context** -- ConversationMessage.content stores candidate free-text. This appears in assessment records, scoring contexts, and potentially in error logs. | Information Disclosure | Assessment audit for Org A requires reviewing conversation messages. Messages stored in shared DB with no org-level encryption. | 3 | 4 | **12** | Messages are only accessible through assessment -> candidate -> org chain. | No at-rest encryption per org. A DB compromise exposes all orgs' conversation transcripts simultaneously. |

---

## 4. Attack Chains

### Chain 1: Optional orgId -> Full Cross-Tenant Data Leak

**Path:** Developer error -> `getDashboardData(undefined)` -> all orgs' candidates returned
**Components:** `src/lib/data.ts` lines 9, 80, 139, 164, 195
**Severity:** Critical
**Current defense:** Every caller currently passes orgId from session. But ALL five data functions default to no filter when orgId is undefined.
**Required fix:** Make orgId a required parameter (remove optionality) or add `if (!orgId) throw new Error("orgId required")` as first line.

### Chain 2: Noisy Neighbor -> Service-Wide Outage

**Path:** Org A batch invites 200 -> 200 assessments start -> 200 * 30 = 6,000 chat RPM -> Anthropic 429 -> Org B assessments fail mid-conversation -> stuck in split-brain -> cron recovery runs 20 assessments -> 20 * 50 API calls = 1,000 more calls -> prolonged outage
**Severity:** High
**Current defense:** Per-token rate limits only.
**Required fix:** Per-org aggregate rate limit on Anthropic calls (e.g., max 100 concurrent assessments per org, max 3,000 Anthropic RPM per org).

### Chain 3: CRON_SECRET Leak -> Cross-Org Scoring Manipulation

**Path:** CRON_SECRET leaked via error log or developer -> attacker calls `/api/cron/recover-stuck-assessments` -> triggers scoring for ALL stuck assessments globally -> scoring consumes AI budget -> attacker also calls scoring webhook to extract assessment IDs
**Severity:** High
**Current defense:** CRON_SECRET min 32 chars, null guard.
**Required fix:** IP-restrict cron endpoints to Vercel's cron IP range. Add per-assessment idempotency on scoring initiation.

### Chain 4: Sentry -> Cross-Tenant PII Exposure

**Path:** Scoring pipeline fails for Org A assessment -> Sentry captures exception with `assessmentId` + stack trace including Prisma query results (candidate name, email, responses) -> Org B's engineer or support sees Sentry -> cross-org PII exposure
**Severity:** Medium-High
**Current defense:** Sentry configured but no data scrubbing.
**Required fix:** Configure Sentry `beforeSend` to scrub PII fields. Tag events with orgId for filtering. Consider per-org Sentry projects for enterprise clients.

---

## 5. Consolidated Risk Register

| Rank | ID | Threat | Score | Status | Priority |
|---|---|---|---|---|---|
| 1 | MT-014 | 1000 concurrent assessments exhaust shared Anthropic key | **20** | Unmitigated | **MUST-HAVE** |
| 2 | MT-025 | Candidate PII to Anthropic without DPA | **20** | Unmitigated | **MUST-HAVE** |
| 3 | MT-008 | Shared Anthropic key -- no per-org throttling | **16** | Unmitigated | **MUST-HAVE** |
| 4 | MT-021 | No data residency controls | **16** | Unmitigated | **MUST-HAVE (if EU orgs)** |
| 5 | MT-027 | No per-org rate limiting on AI calls | **16** | Unmitigated | **MUST-HAVE** |
| 6 | MT-002 | getDashboardData optional orgId | **15** | Fragile | **MUST-HAVE** |
| 7 | MT-004 | getCompareData optional orgId | **15** | Fragile | **MUST-HAVE** |
| 8 | MT-007 | ActivityLog has no orgId | **12** | Unmitigated | SHOULD-HAVE |
| 9 | MT-010 | DB connection pool exhaustion | **12** | Partial | SHOULD-HAVE |
| 10 | MT-020 | Cross-org PII in Sentry | **12** | Unmitigated | SHOULD-HAVE |
| 11 | MT-022 | No legal hold capability | **12** | Unmitigated | SHOULD-HAVE |
| 12 | MT-023 | No PII inventory per org | **12** | Unmitigated | SHOULD-HAVE |
| 13 | MT-024 | No retention policy enforcement | **12** | Unmitigated | SHOULD-HAVE |
| 14 | MT-015 | Scoring pipeline failure cascade | **12** | Partial | SHOULD-HAVE |
| 15 | MT-030 | ActivityLog cross-org visibility | **12** | Unmitigated | SHOULD-HAVE |
| 16 | MT-031 | Sentry errors cross-org | **12** | Unmitigated | SHOULD-HAVE |
| 17 | MT-033 | Conversation PII in shared DB | **12** | Unmitigated | NICE-TO-HAVE |
| 18 | MT-001 | Scoring pipeline no org validation | **10** | Partial | SHOULD-HAVE |
| 19 | MT-026 | Single Anthropic key blast radius | **10** | Unmitigated | SHOULD-HAVE |
| 20 | MT-005 | Cron send-results cross-org | **9** | Partial | NICE-TO-HAVE |
| 21 | MT-006 | Cron recovery cross-org fairness | **9** | Partial | NICE-TO-HAVE |
| 22 | MT-009 | Shared ElevenLabs API | **9** | Partial | NICE-TO-HAVE |
| 23 | MT-011 | Vercel function concurrency | **9** | Partial | NICE-TO-HAVE |
| 24 | MT-013 | Batch email flood | **9** | Partial | NICE-TO-HAVE |
| 25 | MT-032 | No platform admin RBAC | **9** | Unmitigated | NICE-TO-HAVE |
| 26 | MT-003 | Candidate ID enumeration timing | **8** | Partial | NICE-TO-HAVE |
| 27 | MT-029 | Shared Resend account suspension | **8** | Partial | NICE-TO-HAVE |
| 28 | MT-017 | Batch import partial state | **6** | Partial | NICE-TO-HAVE |
| 29 | MT-012 | Redis failover weakens rate limiting | **6** | Partial | NICE-TO-HAVE |
| 30 | MT-016 | Content generation AI budget | **6** | Partial | NICE-TO-HAVE |
| 31 | MT-028 | Key rotation requires redeployment | **6** | Partial | NICE-TO-HAVE |
| 32 | MT-019 | Cron mixed-org batch failure | **6** | Partial | NICE-TO-HAVE |
| 33 | MT-018 | Wrong-org role context during scoring | **4** | Partial | NICE-TO-HAVE |

---

## 6. Mitigation Priorities

### MUST-HAVE (Block Multi-Tenant GA)

#### M1: Make orgId required in data.ts functions
**Addresses:** MT-002, MT-004
**Implementation:** Change all function signatures in `src/lib/data.ts` from `orgId?: string` to `orgId: string`. Remove the conditional spread pattern. Add runtime assertion as defense-in-depth.
```typescript
// BEFORE (dangerous):
export async function getDashboardData(orgId?: string, ...) {
  const where: any = orgId ? { orgId } : {};

// AFTER (safe):
export async function getDashboardData(orgId: string, ...) {
  if (!orgId) throw new Error("orgId is required -- tenant isolation violation");
  const where = { orgId };
```
**Effort:** 1-2 hours. All callers already pass orgId.

#### M2: Per-org rate limiting on Anthropic API calls
**Addresses:** MT-008, MT-014, MT-027
**Implementation:** Add org-level rate limit middleware that tracks total Anthropic API calls per org per minute. When an org exceeds its allocation (e.g., 500 RPM), queue or reject new requests. Implement in `src/lib/rate-limit.ts` using the existing Upstash Redis with an `rl:org:{orgId}:anthropic` key prefix.
**Effort:** 1-2 days. Requires:
1. Look up orgId from assessment token in assess routes (one extra DB join: `invitation.candidate.orgId`)
2. Add `checkOrgRateLimit(orgId, "anthropic")` before every Anthropic call
3. Add per-org concurrency limit (max active assessments per org)

#### M3: Execute Anthropic DPA
**Addresses:** MT-025
**Implementation:** Contact Anthropic to execute a Data Processing Agreement (DPA) covering employment assessment use case. Ensure it covers: EU data subjects, special category data (implicit health/disability info in responses), data retention in Anthropic's systems, subprocessor list.
**Effort:** Legal process, 2-4 weeks.

#### M4: Data residency documentation (immediate) and architecture (planned)
**Addresses:** MT-021
**Implementation:**
- **Immediate:** Document current data residency (Neon region, Anthropic region, Vercel region). Add to Terms of Service. Block EU org signup until resolved.
- **Planned:** Evaluate Neon multi-region or per-org database. Evaluate Anthropic EU endpoint availability.
**Effort:** Documentation: 1 day. Architecture: multi-month initiative.

### SHOULD-HAVE (Current Development Cycle)

#### M5: Add orgId to ActivityLog
**Addresses:** MT-007, MT-030
**Implementation:** Add `orgId String` field to ActivityLog model. Backfill from entity joins. Index on orgId. Update all 5 write sites to include orgId.
**Effort:** 4 hours.

#### M6: Sentry PII scrubbing and org tagging
**Addresses:** MT-020, MT-031
**Implementation:**
1. Configure `Sentry.init({ beforeSend })` to scrub email, firstName, lastName, phone, content fields from event extras
2. Add `Sentry.setTag("orgId", session.user.orgId)` in auth middleware
3. Use Sentry's data scrubbing rules to redact PII patterns (email regex, phone regex)
**Effort:** 4-6 hours.

#### M7: Legal hold and soft-delete infrastructure
**Addresses:** MT-022
**Implementation:** Add `deletedAt DateTime?` and `legalHold Boolean @default(false)` to Candidate, Assessment, ConversationMessage. Add middleware/hook to block hard deletes when legalHold is true. Implement soft-delete pattern in data access layer.
**Effort:** 2-3 days.

#### M8: Org-scoped scoring pipeline validation
**Addresses:** MT-001
**Implementation:** At the top of `runScoringPipeline()`, after fetching the assessment, verify `assessment.candidate.orgId` matches the expected org (pass orgId as parameter from caller). For cron callers, log orgId but skip validation (cross-org operation is intentional there).
**Effort:** 2 hours.

#### M9: Retention policy per org
**Addresses:** MT-024
**Implementation:** Add `retentionDays Int?` to Organization model. Implement cron job that deletes assessment data older than org's retention period. Ensure cascade deletes respect legal holds (M7).
**Effort:** 1-2 days.

### NICE-TO-HAVE (Backlog)

#### M10: Per-org Anthropic API keys (enterprise tier)
**Addresses:** MT-026
Add optional `anthropicApiKey` (encrypted) to Organization model. Enterprise orgs bring their own key. Isolates billing and rate limits. Requires per-org secret management.

#### M11: Per-org email sending domains
**Addresses:** MT-029
Enterprise orgs configure their own Resend domain. Prevents one org's reputation from affecting others.

#### M12: Database-level tenant isolation
**Addresses:** MT-033
Evaluate: (a) FORCE ROW LEVEL SECURITY with non-owner Prisma connection, (b) per-org schema, (c) per-org database. Each has significant architectural implications. FORCE RLS on the Prisma connection would immediately enforce all existing policies but requires setting `app.current_org_id` session variable in every request, which Prisma's pg adapter does not natively support.

#### M13: PII inventory and SAR tooling
**Addresses:** MT-023
Build automated PII discovery that traces all data for a given candidate email across all tables. Implement right-to-erasure endpoint.

---

## 7. Compliance Impact Summary

| Regulation | Current Status | Multi-Tenancy Gap |
|---|---|---|
| **GDPR** | Partial | No DPA with Anthropic. No data residency. No automated SAR. No retention enforcement. No right-to-erasure. |
| **CCPA/CPRA** | Partial | No PII inventory. No deletion capability per consumer request. |
| **SOC 2** | Not certified | Multi-tenant data isolation relies solely on application logic. No defense-in-depth (RLS bypassed). Audit logs lack org scoping. |
| **NYC LL144** | Not assessed | Bias auditing required for AI employment tools. No per-org bias audit capability. |
| **EU AI Act** | Not assessed | High-risk AI system (employment domain). Transparency, oversight, and record-keeping requirements per org. |

---

## 8. Residual Risks After All Mitigations

Even with all MUST-HAVE and SHOULD-HAVE mitigations implemented:

1. **Shared database remains a single blast radius.** Application-layer org scoping is the primary enforcement. A Prisma ORM bug or a raw SQL query without org filter will leak cross-tenant data. **Accepted risk** -- schema separation is a multi-month architectural change. Review annually.

2. **RLS policies are defense-in-depth but not exercised.** Since Prisma connects as table owner, RLS never actually filters queries. The policies are untested in production. **Accepted risk** -- RLS provides protection only for future non-owner connections (analytics tools, PostgREST).

3. **Single Vercel deployment means correlated failures.** A bad deploy affects all orgs simultaneously. **Accepted risk** -- canary deployments and rollback capability mitigate this. Feature flags can gate risky changes per-org.

4. **Anthropic's data handling is opaque per-org.** Even with a DPA, Anthropic's internal data isolation between ACI's org's conversations is not controllable. **Accepted risk** -- contractual protection via DPA. Technical mitigation would require per-org API keys or self-hosted model.

---

## Appendix A: Files Reviewed

| File | Relevance |
|---|---|
| `prisma/schema.prisma` | Data model, FK relationships, org scoping |
| `src/lib/data.ts` | Shared data-fetching with optional orgId (MT-002, MT-004) |
| `src/lib/auth.ts` | Session resolution, orgId extraction |
| `src/lib/api-handler.ts` | Shared API wrapper with auth checks |
| `src/lib/prisma.ts` | Connection pool config (max:1, 5s timeout) |
| `src/lib/rate-limit.ts` | Per-token rate limiting, Redis + in-memory |
| `src/lib/env.ts` | Environment validation, shared API keys |
| `src/app/api/candidates/route.ts` | Org-scoped candidate queries |
| `src/app/api/invitations/route.ts` | Org-scoped invitation creation |
| `src/app/api/invitations/batch/route.ts` | Batch import with 200-row cap |
| `src/app/api/assess/[token]/chat/route.ts` | Assessment chat, no explicit orgId check |
| `src/app/api/assess/[token]/complete/route.ts` | Completion + scoring trigger |
| `src/app/api/assess/[token]/tts/route.ts` | Shared ElevenLabs proxy |
| `src/app/api/assess/[token]/response/route.ts` | Item response recording |
| `src/app/api/export/data/route.ts` | Org-scoped data export |
| `src/app/api/admin/analytics/route.ts` | Org-scoped analytics |
| `src/app/api/admin/health/route.ts` | Health check (HEALTH_SECRET optional) |
| `src/app/api/cron/expire-invitations/route.ts` | Cross-org cron |
| `src/app/api/cron/send-results/route.ts` | Cross-org cron |
| `src/app/api/cron/recover-stuck-assessments/route.ts` | Cross-org cron with scoring |
| `src/app/api/roles/route.ts` | Org-scoped role creation |
| `src/app/api/roles/[id]/route.ts` | Org-scoped role update/delete |
| `src/app/api/notes/[id]/route.ts` | Org-scoped note CRUD |
| `src/app/api/onboarding/route.ts` | Team invitation-based org assignment |
| `src/app/api/dev/impersonate/route.ts` | Dev-only role impersonation |
| `src/lib/assessment/scoring/pipeline.ts` | Scoring pipeline (no org validation) |
| `src/lib/supabase/middleware.ts` | Auth middleware (no org scoping) |
| `supabase/migrations/20260305200000_enable_rls_policies.sql` | RLS policies (bypassed by owner) |
| `vercel.json` | Cron schedule configuration |

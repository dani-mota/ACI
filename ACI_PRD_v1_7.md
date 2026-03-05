

**ACI**

Arklight Cognitive Index

**PRODUCT REQUIREMENTS DOCUMENT**

Final Specification

*Scalable Talent Assessment Intelligence*

*for Advanced Manufacturing & Defense*

Version 1.7  •  March 2026  •  Confidential

Supersedes: ACI PRD v1.6 (March 2026), v1.5 (March 2026), v1.4 (March 2026), v1.3 (March 2026), v1.2 (March 2026), v1.1 (February 2026), NAIB Engineering PRD v3.0, NAIB PRD v4, ACI Finalization Doc

Incorporates: User Persona Analysis (Tasha Aquino Vance, Kevin O’Shea)

| **v1.7 Change Log (March 2026)** |
| :---- |
| This revision introduces **Org-Scoped Access Request Routing**, **Team Management Security Hardening**, and **Multi-Tenant User Onboarding**. Key changes: (1) **Dual-Path Access Request Routing** — Two distinct onboarding flows: Flow A (new company inquiry via `/signup` → platform admin reviews at `/admin`) and Flow B (join existing org via `/join/[orgSlug]` → org TA_LEADERs review at `/settings/team`); (2) **Org-Scoped Access Requests** — AccessRequest model extended with `orgId`, `jobTitle`, `reason` fields; `email @unique` constraint removed and replaced with `@@index([email, orgId])` to support per-org requests; new `@@index([orgId, status])` for efficient team settings queries; (3) **TA_LEADER Approval Flow** — New PATCH `/api/team/access-requests/[id]` endpoint allowing TA_LEADER+ to approve/reject org-scoped requests with `canAssignRole()` enforcement, org isolation, mandatory Supabase user creation (no silent failures), and full `ActivityLog` audit trail; (4) **Organization Join Page** — New `/join/[orgSlug]` public page with server-side slug validation (prevents org enumeration), client form for name/email/job title/reason, hardcoded `RECRUITER_COORDINATOR` role for org-scoped requests; (5) **Pending Requests UI** — New `PendingRequests` component on `/settings/team` showing org-scoped pending requests with approve/reject dialogs, role assignment via `getAssignableRoles()`, and deactivated user detection warning; (6) **Team Management Security Hardening** — Peer-level modification guard (`ROLE_LEVEL` check prevents modifying users at or above your role level), last-TA_LEADER demotion guard (prevents org lock-out), hard Supabase ban/unban (no silent failures), `canAssignRole()` re-validation on invitation resend, rate limiting on invitation resend (5/hr) and team accept (10/min/IP), strong password policy (8+ chars, uppercase, lowercase, digit); (7) **Auth Hardening** — `getSession()` now checks `user.isActive` (blocks deactivated users even with valid Supabase sessions), `getAuthStatus()` fallback to email lookup for org-join requests without `supabaseId`, `/settings` added to middleware protected routes; (8) **Email Security** — `escapeHtml()` applied to all email templates receiving user input (access-approved, access-rejected, org-access-request-notification, team-invite, org-admin-welcome, invitation); new org access request notification template for TA_LEADERs with branded dark navy design; (9) **Rate Limiting Expansion** — IP-based rate limit (10/hr) on all access request submissions, email+orgId rate limit (5/24hr) on org-scoped requests, invitation resend rate limit (5/hr/user), team accept rate limit (10/min/IP); (10) **Input Validation** — Server-side field length limits (firstName/lastName: 100, companyName/jobTitle: 200, reason: 2000, rejectionReason: 1000), org-scoped requests restricted to RECRUITER_COORDINATOR role server-side, `supabaseId` removed from public POST body (prevents mass assignment); (11) **Admin Page Scoping** — Admin page and notifications now filter to `orgId: null` (platform-level requests only), preventing org-scoped requests from appearing in admin view; (12) **Signup Page Copy** — Updated to "Evaluate ACI for Your Organization" with guidance to ask team admin for invitation link if company already uses ACI; (13) **Audit Trail** — `ActivityLog` entries added to both platform admin and org-level approval/rejection flows. |

| **v1.6 Change Log (March 2026)** |
| :---- |
| This revision introduces the **Aria Assessment Experience** — a complete redesign of the candidate-facing assessment UI from a chat-based interface to an orb-centered, voice-first, single-screen stage experience. Key changes: (1) **Aria AI Evaluator** — The assessment agent is now a named presence ("Aria") with a warm British female voice powered by ElevenLabs TTS (Flash v2.5, ~75ms latency), replacing browser-native SpeechSynthesis; (2) **Orb-Centered Stage UI** — Replaces the scrolling chat interface with a single-screen layout: fluid canvas-rendered orb (idle/speaking/listening/processing states with displacement animation), word-by-word subtitles, inline interactive elements, living animated background with particle field and aurora nebulae; (3) **Phase 0 — "The Handshake"** — New ~60-second non-scored pre-assessment warmup where Aria introduces herself, explains the format, and validates the candidate's microphone. Resolves the cold-start problem where the agent never spoke first; (4) **Nudge System** — Proactive re-engagement when candidates go silent (15–30s thresholds by context), with automatic text input fallback; (5) **Welcome Page Redesign** — Readiness checklist (quiet environment, mic access, time), microphone pre-check, privacy disclosure, format preview; (6) **Email Template Update** — "Before You Begin" section in invitation email explaining voice-based assessment format; (7) **Voice Architecture** — ElevenLabs streaming TTS with sentence-level chunking, Web Audio API playback with AnalyserNode for real-time amplitude extraction driving orb animation, server-side TTS proxy route; (8) **Candidate Input** — Voice-first for Act 1 and Act 3, candidate's choice (voice or type) for Act 2 follow-up probes, browser Web Speech API for speech-to-text; (9) **Act Transitions** — Cinematic agent-narrated transitions with orb size morphing (200px ↔ 72px), synchronized to Aria's narration; (10) **Legal Defensibility Roadmap** — Documented measurement rigor per construct, identified gaps in behavioral construct validation, specified remediation plan (SJT items for behavioral constructs, adverse impact analysis, criterion validity study, human-AI agreement study). |

| **v1.5 Change Log (March 2026)** |
| :---- |
| This revision completes the **V1 Assessment Removal** — the V2 conversational assessment engine is now the sole assessment modality. The V1 6-block form-based assessment, its feature flag (`ASSESSMENT_V2`), the `AssessmentVersion` enum, and all V1-only code have been permanently removed. Key changes since v1.4: (1) **V1 code removal** — Deleted V1 components (assessment-shell, progress-bar, block-interstitial, completion-screen, 5 item-type components), V1 routes (/assess/[token]/block/, /api/assess/ai-probe), V1 libraries (items.ts, blocks.ts, pipeline.ts, item-scoring.ts, randomize.ts), and V1 Zustand store (assessment-store.ts); (2) **Feature flag elimination** — Removed `ASSESSMENT_V2_ENABLED` flag, `AssessmentVersion` enum (V1_BLOCKS/V2_CONVO), and `version` column from Assessment model; all assessments are now conversational; (3) **File consolidation** — Moved all V2 engine files from `src/lib/assessment/` up to `src/lib/assessment/` (config.ts, engine.ts, types.ts, classification.ts, adaptive-loop.ts, item-bank.ts, diagnostic-probe.ts, logger.ts, scenarios/, scoring/); (4) **Identifier cleanup** — Renamed `V2_AI_CONFIG` → `AI_CONFIG`, `V2_STRUCTURE` → `ASSESSMENT_STRUCTURE`, `ITEM_BANK_V2` → `ITEM_BANK`, `runScoringPipelineV2` → `runScoringPipeline`; (5) **Scoring pipeline simplification** — Single scoring pipeline with no version dispatch; completion route always calls `runScoringPipeline`; (6) **Email template update** — Removed V1/V2 conditional content; hardcoded conversational assessment copy (~60–90 min duration); (7) **Welcome page hardening** — Assessment status check no longer gated by invitation status; prevents silent redirect loops when multiple invitations exist for the same candidate; error handling with visible user feedback on start failure; (8) **Start route hardening** — Returns proper error when candidate already has a completed assessment; top-level try/catch with structured error responses and server-side logging; (9) **Schema migration** — Dropped `version` column from Assessment table and `AssessmentVersion` enum via `prisma db push`. |

| **v1.4 Change Log (March 2026)** |
| :---- |
| Introduced the **V2 Conversational Assessment Engine** — a three-act, AI-conducted adaptive conversational investigation (90–120 min). Key additions: Three-act assessment structure, three-layer scoring pipeline, chat-based UI with Vercel AI SDK, 86-item calibrated item bank, adaptive investigation algorithm, consistency validation, 12 red flag checks, security hardening (rate limiting, BOLA prevention, TOCTOU fix), observability (structured logging, AI cost tracking), 3 new database models (ConversationMessage, AssessmentState, AIEvaluationRun), accessibility improvements. |

| **v1.3 Change Log (March 2026)** |
| :---- |
| This revision introduces the **Domain-Adaptive Assessment Engine** and **Generic Aptitude Assessment** capabilities. Key additions since v1.2: (1) **Domain-adaptive AI probes** — AI follow-up questions now receive full role context (environment, technical skills, key tasks, consequence of error) extracted from JD data, producing role-relevant probing instead of generic questions; (2) **JD context persistence** — extracted JD data is now saved on the Role model (`jdContext Json?`) and threaded through the entire scoring pipeline; (3) **Contextualized narratives and predictions** — narrative insights and prediction descriptions reference the candidate’s actual role domain when available; (4) **Item bank neutralization** — 13 assessment items containing manufacturing-specific language (CNC, factory, gear trains, hydraulic press) rewritten to domain-neutral equivalents while preserving construct validity; (5) **Generic Aptitude Assessment** — new assessment path with equal-weight scoring across all 12 constructs and cross-role fit rankings for candidates not tied to a specific role; (6) **Security hardening** — 5 previously unauthenticated API routes secured with session/token auth and org-scoping, prompt injection prevention via input sanitization and size limits, CRON_SECRET authentication on scheduled endpoints, AbortController timeouts on all external API calls; (7) **Scoring pipeline activation** — critical bug fixed where `runScoringPipeline()` was exported but never called, leaving all assessments stuck in SCORING status; (8) **Data integrity** — compound unique constraint on Candidate (email + orgId), duplicate email send prevention via `resultsEmailSentAt` tracking; (9) **Assessment item math corrections** — fixed incorrect answers in items int-002 and int-004, clarified ambiguous wording in qr-002. |

| **v1.2 Change Log (March 2026)** |
| :---- |
| Full assessment delivery platform with 6-block adaptive assessment and 5 item types; Scoring pipeline with composite calculation, cutline evaluation, red flag detection, and prediction generation; AI-powered Role Builder with JD analysis, O\*NET matching, and research-backed weight generation; Access request workflow with admin approval and Supabase account provisioning; Email system via Resend with invitation, approval, and notification templates; Batch CSV invitation system; Post-assessment survey and outcome tracking; Sentry error monitoring; PDF exports (Scorecard, Interview Kit, One-Pager); Data export (CSV/JSON) for TA Leaders; Tutorial/demo mode with sample data. Tech stack updated to Next.js 16, React 19, Tailwind CSS 4. |

# **Table of Contents**

# **1\. Executive Summary**

ACI (Arklight Cognitive Index) is a full-stack talent assessment intelligence platform purpose-built for advanced manufacturing and defense companies scaling beyond artisanal hiring methods. It assesses candidates across 12 cognitive, technical, and behavioral constructs through an **AI-conducted conversational investigation** (~60–90 min) guided by **Aria**, a named AI evaluator with a warm British female voice. The assessment uses an orb-centered, voice-first stage interface — not a chat — with a three-act adaptive structure, ElevenLabs TTS voice synthesis, real-time speech-to-text candidate input, and a three-layer scoring pipeline. The assessment delivers decision-ready results through an intelligent dashboard, candidate profiling system, and deployment planning engine. The assessment pipeline is fully role-aware: AI probes, narrative insights, and predictions are contextualized by each role's domain using extracted job description data. A Generic Aptitude path enables cross-role candidate evaluation with equal-weight scoring and automatic fit rankings across all organizational roles.

The platform solves three compounding failures that advanced manufacturers face as they scale: the scalability collapse (craft-style evaluation methods that break at volume), the “soft yes / soft no” crisis (weeks of interviews that still produce indecisive outcomes), and the technical knowledge gap (recruiting teams who cannot evaluate domain expertise without SME bottlenecks).

## **1.1 Core Value Proposition**

ACI transforms hiring from credentials and self-reporting to objective measurement of job-validated performance patterns. Unlike abstract personality tests or generic cognitive assessments, ACI measures what actually predicts success in high-stakes manufacturing environments: technical aptitude, operational discipline, learning velocity, performance ceiling, and supervision load requirements.

## **1.2 Primary Customers**

| Customer | Context | Scale |
| :---- | :---- | :---- |
| Anduril Industries | Arsenal-1 facility (OH) — largest single job-creation project in Ohio history | 4,000 hires by 2035; senior roles first (7+ yr experience), then entry-level |
| Hadrian | Multi-facility scaling (Torrance, Hawthorne, Mesa AZ 270k sq ft) | 350 immediate Mesa factory roles; 20–50+ manufacturing hires/month |
| Expansion Targets | Saronic, defense contractors, precision manufacturers | Advanced manufacturing companies facing identical assessment scaling crises |

## **1.3 What Makes This Document Definitive**

This PRD supersedes and consolidates all prior specification documents: the NAIB Engineering PRD v3.0 (1,786-line buildable specification), the NAIB PRD v4 (business and product strategy), the ACI PRD Finalization document (gap analysis and new deliverables), and the User Personas v2 document (Tasha Aquino Vance and Kevin O’Shea analysis). Every gap identified in the finalization review has been addressed. Every persona-driven recommendation has been incorporated. The naming has been globally updated from NAIB to ACI.

| The Core Insight *The prior PRD builds a very good assessment dashboard. This document specifies a hiring intelligence platform that talent teams cannot live without. Every element answers three questions: “Should I interview this person?” “If yes, what should I ask them?” “If we hire them, how do we maximize their success?”* |
| :---- |

# **2\. Strategic Context & Product Vision**

## **2.1 The Assessment Crisis in Advanced Manufacturing**

Up to 2.1 million manufacturing jobs are projected to be unfilled by 2030 (Deloitte / Manufacturing Institute). The average age of CNC machinists in the United States is now in the mid-50s, and the pipeline of replacements is dangerously thin. Defense-sector hiring is further complicated by ITAR restrictions that limit the eligible labor pool to U.S. citizens and lawful permanent residents.

### **Failure 1: The Scalability Collapse**

Current state at Anduril: A small team conducts in-person, cohort-based evaluation with deep behavioral observation (“Do they return tools back to where they got them?”). This works at small scale but breaks completely when Arsenal-1 requires industrial hiring volumes. The assessment team cannot be cloned, and craft-style evaluation cannot survive real scale.

### **Failure 2: The “Soft Yes / Soft No” Crisis**

Current state at Hadrian: After a 38–40 day timeline and five interview stages (recruiter screen → hiring manager phone screen → 4–6 hour technical presentation → panel onsite → competency interviews), teams still reach indecisive outcomes. Kevin O’Shea’s assessment: “We just spent 2–3 weeks interviewing this person and we still don’t know.” Competency scoring on a 1–4 scale produces numerical averages that don’t translate to actionable hiring decisions.

### **Failure 3: The Technical Knowledge Gap**

Recruiting teams cannot properly evaluate technical competency in roles they’re hiring for (CAM programmers requiring HyperMill, Siemens NX, 5-axis machining experience). Subject matter expert availability becomes the critical path bottleneck for every assessment. SME time cannot scale across hundreds of candidate evaluations needed for 20–50 monthly hires per facility.

## **2.2 What ACI Measures That Others Don’t**

ACI does not measure abstract personality traits or generic cognitive ability in isolation. It measures job-validated performance patterns anchored to high performers inside specific industrial roles:

* Technical aptitude: mechanical reasoning, precision under constraint, spatial processing

* Operational discipline: instruction-following, process adherence, error sensitivity under pressure

* Learning velocity: how fast candidates convert instruction into execution

* Performance ceiling: future capability potential, not just current knowledge

* Supervision load: error recovery speed, self-correction capability, reliability under ambiguity

## **2.3 Primary Use Cases**

### **External Hiring**

Pre-screen candidates at scale before human interview investment, providing automated stack-ranking and role-specific cutlines. Only advance candidates who clear validated thresholds on technical aptitude and behavioral discipline. Reduces indecisive debriefs because there is a data-driven foundation before subjective interviews.

### **Internal Workforce Development**

Assess existing employees to identify high-potential talent for promotion, diagnose skill gaps for targeted training investment, and build data-driven succession pipelines. Employees with high Fluid Intelligence, high Calibration Accuracy, high Error Recovery, and high Behavioral Integrity are identified for leadership tracks.

### **Supervision Load Optimization**

New hires with low Error Recovery Velocity or low Calibration Accuracy scores receive structured onboarding with daily check-ins. High scorers receive autonomy-focused onboarding with weekly check-ins. This optimizes supervision allocation and accelerates time-to-productivity for high performers.

## **2.4 Revenue Model**

| Model | Price | Notes |
| :---- | :---- | :---- |
| Per-Assessment | $1,000 per candidate | Includes full 12-construct assessment, AI-adaptive probing, scoring, Intelligence Report, PDF deliverables, and 12-month validation analytics access |
| Volume Tiers | Negotiable at 100+ candidates/month | Tiered pricing based on assessment volume; volume does not reduce below $800/candidate |
| Enterprise | Fixed annual fee (unlimited) | For high-volume customers like Anduril/Hadrian with internal workforce needs; priced on expected volume |
| Setup Fees | Custom pricing | Custom cutline validation studies, ATS integration, assessment center buildout |

| Pricing Rationale *At $1,000 per candidate, ACI is priced as a premium intelligence product — not a commodity screening tool. The value proposition: a single bad hire in defense manufacturing costs $50,000–$150,000+ in wasted training, supervision, rework, and replacement recruiting. ACI’s per-candidate cost represents \<2% of that downside risk while delivering predictive validity, deployment planning, and interview intelligence that no other assessment provides. For context: Hadrian’s current process burns $5,000–10,000+ in SME time, panel interviews, and 4–6 hour candidate presentations per hire — and still produces “soft yes / soft no” outcomes.* |
| :---- |

# **3\. User Personas**

ACI is designed for two distinct user archetypes that span the full decision and usage spectrum. Building for both ensures the product sells at the executive level and retains at the practitioner level.

## **3.1 Persona 1: Tasha Aquino Vance — The Strategic Buyer**

| Attribute | Detail |
| :---- | :---- |
| Title | VP / Head of Global Talent Acquisition |
| Company | Anduril Industries |
| RBAC Role | TA\_LEADER (sees everything including IRT/theta, validity metrics, full audit trail) |
| Time in ACI | 30 min/week (pipeline review, leadership prep) |
| Primary Question | “Should we buy this?” |
| First Screen | Dashboard (pipeline cards, quick stats) |
| Most-Used Feature | Pipeline Overview \+ PDF Export |
| Adoption Blocker | “Is this legally defensible? What’s the adverse impact story?” |
| Key Insight | Targeting 7+ year experienced candidates first, then expanding to junior talent |

Tasha oversees the entire global TA function: executive recruiting, corporate staffing, high-volume manufacturing hiring, university programs, employer branding, and talent intelligence. She is actively mapping the assessment vendor landscape and has explicitly invited ACI into Anduril’s evaluation. Her candor, directness, and appetite for opinionated partners make her an unusually high-quality early customer.

| Discovery-Confirmed Insight *Tasha confirmed Anduril is in early stages of a 10-year workforce roadmap for Arsenal-1. ACI has the rare opportunity to be architecturally embedded in Anduril’s hiring infrastructure from day one. The window is open NOW.* |
| :---- |

### **Critical Features for Tasha**

| Feature | Priority | Why It Matters |
| :---- | :---- | :---- |
| Dashboard Pipeline Overview | CRITICAL | First thing she checks Monday morning. Pipeline bottleneck identification. |
| Role-Specific Composite Scores | CRITICAL | Proves ACI isn’t one-size-fits-all. Scientifically defensible role differentiation. |
| Predictive Indicators | CRITICAL | Ramp time \+ supervision load predictions for onboarding cost forecasting. |
| PDF Scorecard Export | HIGH | The storytelling artifact she sends to hiring managers and leadership. |
| Red Flag Detection | HIGH | Defense contracts have zero tolerance for integrity issues. |
| RBAC / Data Gating | HIGH | Controls who sees what. Manages the narrative for different audiences. |
| Adverse Impact Report | CRITICAL (Phase 2\) | Legal compliance proof point. Adoption blocker if missing. |

## **3.2 Persona 2: Kevin O’Shea — The Operational User**

| Attribute | Detail |
| :---- | :---- |
| Title | Recruiting Manager |
| Company | Hadrian |
| RBAC Role | RECRUITING\_MANAGER (composites, predictions, flags — no raw scores or question-level data) |
| Time in ACI | 2–3 hours/day (candidate reviews, hiring manager prep) |
| Primary Question | “Is this candidate a go?” |
| First Screen | Candidate Table (filtered, sorted) |
| Most-Used Feature | Candidate Profile \+ Role Switcher |
| Adoption Blocker | “Does this slow me down or speed me up?” |
| Key Insight | Hadrian trains from scratch — Learning Velocity is the single most important score |

Kevin is in a player-coach role managing a small recruiting team while personally running reqs for high-priority roles. Hadrian is expanding from its Hawthorne and Torrance factories to a massive 270,000 sq ft facility in Mesa, Arizona, immediately creating 350 jobs. He needs a tool that processes high volume without sacrificing quality. Every 100ms of dashboard lag erodes trust.

### **Critical Features for Kevin**

| Feature | Priority | Why It Matters |
| :---- | :---- | :---- |
| Candidate Table \+ Filters | CRITICAL | Used 20+ times/day. Filters must be instant. Search must be predictive. |
| Spider Chart \+ Intelligence Report | CRITICAL | Replaces subjective “I think she’d be good” with data for hiring managers. |
| Attention Items | CRITICAL | Manages by exception. Surfaces what’s stuck without scrolling 50 candidates. |
| Role Switcher | CRITICAL | Enables talent redirection: failed for CAM Programmer but strong CNC Machinist fit. |
| PDF Scorecard | HIGH | The artifact sent to hiring managers. Must be scannable in 30 seconds. |
| One-Click Send to HM | HIGH | Most common action. Fewer steps \= more usage. |
| Role Mismatch Redirect | HIGH | Turns a rejection into a redirect. Native to how Hadrian thinks about talent. |

# **4\. Technical Architecture**

Architecture decisions favor simplicity, convention over configuration, and managed services that minimize DevOps burden. The platform is designed to be built and maintained by a small team using modern tooling.

## **4.1 Tech Stack**

| Layer | Choice | Rationale | Status |
| :---- | :---- | :---- | :---- |
| Framework | Next.js 16.1.6 (App Router) | SSR \+ API routes in one codebase | ✅ Live |
| Runtime | React 19.2.3 | Latest React with concurrent features | ✅ Live |
| Language | TypeScript (strict mode) | Type safety across full stack | ✅ Live |
| Database | Supabase (PostgreSQL) | Built-in auth, realtime, row-level security | ✅ Live |
| Auth | Supabase Auth | Email/password with dual-path access-request approval (platform admin + org TA\_LEADER), team invitation with token-based accept, `isActive` enforcement, hard ban/unban on deactivation | ✅ Live |
| ORM | Prisma | Type-safe queries, migration management, generated client | ✅ Live |
| UI | Tailwind CSS 4 \+ shadcn/ui \+ Radix UI | Consistent design system, fast iteration | ✅ Live |
| Charts | Recharts | React-native, lightweight, excellent radar chart support | ✅ Live |
| AI Engine | Anthropic API (Claude) | AI-adaptive follow-ups, role analysis, JD parsing, V2 conversational assessment | ✅ Live |
| AI Streaming | Vercel AI SDK (`ai` + `@ai-sdk/anthropic`) | Streaming chat responses for V2 conversational assessment | ✅ Live |
| Voice (Input) | Web Speech API (browser-native) | Speech-to-text for candidate responses | ✅ Live |
| Voice (Output) | ElevenLabs TTS API (Flash v2.5) | AI evaluator voice synthesis — warm British female voice ("Aria"), ~75ms latency, streaming audio | 🔨 v1.6 |
| Deployment | Vercel | Native Next.js support, preview deploys | ✅ Live |
| PDF Export | @react-pdf/renderer | Server-side PDF generation (Scorecard, Interview Kit, One-Pager) | ✅ Live |
| State | Zustand | Lightweight stores with sessionStorage persistence | ✅ Live |
| Email | Resend \+ Nodemailer (SMTP fallback) | Transactional emails (invitations, approvals, results) | ✅ Live |
| Monitoring | Sentry | Real-time error tracking, edge/server/client instrumentation | ✅ Live |

Cost at launch: $0/month base. Supabase free tier (500MB DB, 50k auth users), Vercel free tier (100GB bandwidth), Anthropic API pay-per-use (\~$0.50–2.00 per V1 candidate assessment for AI follow-ups; \~$3–5 per V2 conversational assessment including triple-evaluation scoring), Resend free tier (100 emails/day), Sentry free tier (5k errors/month).

## **4.2 Project Structure**

The application follows Next.js App Router conventions with clear separation between authenticated dashboard routes, candidate-facing assessment routes, and API endpoints:

| Directory | Purpose | Status |
| :---- | :---- | :---- |
| prisma/ | Data model (schema.prisma, 22 models) \+ seed data | ✅ Live |
| src/app/(auth)/ | Login, signup (access request), forgot-password, update-password, pending approval, auth callback, join/\[orgSlug\] (org-scoped access request + team invite accept) | ✅ Live |
| src/app/(dashboard)/ | Protected routes: dashboard, candidates/\[id\], compare, roles (heatmap, detail, builder, new), export, invitations/batch, admin | ✅ Live |
| src/app/(assess)/ | Candidate-facing assessment: V1 (\[token\]/block/\[blockIndex\]) and V2 (\[token\]/v2 chat interface), \[token\]/survey, \[token\]/thank-you | ✅ Live |
| src/app/api/ | 27+ API route handlers: candidates, assessments (chat), invitations, roles, export, access-requests, team (user management, invitations, accept, access-requests), email, notifications, cron | ✅ Live |
| src/app/tutorial/ | Tutorial mode: demo dashboard, roles, candidates, compare (uses demo org data) | ✅ Live |
| src/app/demo/ | Demo landing with cinematic loading animation | ✅ Live |
| src/components/ | 140\+ components: assess (V1), assessment/chat (V2 chat UI), dashboard, profile, roles, role-builder, invitation, compare, tutorial, demo, nav, admin, auth, ui | ✅ Live |
| src/lib/ | 60+ library files: auth, rbac, scoring, predictions, constructs, assessment pipelines (V1 + V2), role-context, role-fit-rankings, narratives, role-builder, email, export, rate-limit, data helpers, O\*NET matching | ✅ Live |
| src/lib/assessment/ | V2 assessment engine: state machine, classification, adaptive loops, scenarios, item bank, diagnostic probes, 3-layer scoring pipeline, red flags, consistency validation, rubrics, logger | ✅ Live |
| src/stores/ | Zustand stores: assessment-store (V1), chat-assessment-store (V2), app-store (mode, tutorial state) | ✅ Live |
| src/generated/ | Auto-generated Prisma client types | ✅ Live |

## **4.3 Build Order (Phased Milestones)**

Each phase is independently deployable. All five phases have been substantially completed as of March 2026.

| Phase | Deliverable | Rationale | Status |
| :---- | :---- | :---- | :---- |
| Phase 1 | Dashboard \+ Candidate Profile \+ Demo | Most visible to buyers; validates the “output” story | ✅ **COMPLETE** |
| Phase 2 | Data Model \+ Scoring Engine \+ Role Builder | Backend foundation with real calculations \+ AI-powered role configuration | ✅ **COMPLETE** |
| Phase 3 | Assessment Delivery Platform V1 (6-block adaptive \+ AI follow-ups) \+ Invitation System | Candidate-facing test experience with token-based invitations | ✅ **COMPLETE** |
| Phase 4 | Integration Layer (PDF exports, CSV/JSON export, email notifications) | Connects to customer workflows | ✅ **MOSTLY COMPLETE** (ATS webhooks pending) |
| Phase 5 | V2 Conversational Assessment Engine (3-act adaptive conversation \+ 3-layer scoring) | Next-generation assessment modality — AI-conducted conversational investigation | ✅ **COMPLETE** |

| Implementation Note *Phases 1–3 and 5 are fully operational. Phase 4 is complete for PDF exports (Scorecard, Interview Kit, One-Pager), data export (CSV/JSON for items, constructs, and full profiles), and email notifications (invitations, access approvals, results). ATS webhook integration and bidirectional ATS sync remain as future work. V2 conversational assessment (Phase 5) is feature-flagged — enable with `ASSESSMENT_V2=true`. V1 block-based assessments continue to work unchanged regardless of the flag.* |
| :---- |

# **5\. Data Model**

The data model is implemented in Prisma ORM targeting Supabase PostgreSQL. All entities support multi-tenancy via Organization scoping and RBAC enforcement at the API layer.

## **5.1 Core Entities**

### **Organization & Users**

| Model | Key Fields | Notes | Status |
| :---- | :---- | :---- | :---- |
| Organization | id, name, slug, isDemo, createdAt | Multi-tenant root with demo org support for tutorial mode. `slug` is unique and used for org-scoped join URLs (`/join/[orgSlug]`). | ✅ Live |
| User | id, email, name, role (UserRole enum), orgId, isActive | RBAC enforced via role field. `isActive` checked by `getSession()` to block deactivated users even with valid Supabase sessions. | ✅ Live |
| AccessRequest | id, email, firstName, lastName, companyName, requestedRole, jobTitle?, reason?, orgId?, supabaseId?, status (PENDING/APPROVED/REJECTED), reviewedBy, reviewedAt, rejectionReason? | Dual-path access request workflow: `orgId: null` for platform requests (admin approval at `/admin`), `orgId` present for org-scoped requests (TA\_LEADER approval at `/settings/team`). Indexed on `[email, orgId]` and `[orgId, status]`. | ✅ Live |
| TeamInvitation | id, orgId, email, name?, role, invitedBy, token, status (PENDING/ACCEPTED/EXPIRED/REVOKED), expiresAt | Team member invitation with 7-day expiry, token-based accept flow at `/join/[orgSlug]/accept`. Rate-limited resend (5/hr/user). | ✅ Live |

UserRole enum values: RECRUITER\_COORDINATOR, RECRUITING\_MANAGER, HIRING\_MANAGER, TA\_LEADER, ADMIN.

### **Roles & Cutlines**

| Model | Key Fields | Notes | Status |
| :---- | :---- | :---- | :---- |
| Role | id, name, slug, description, orgId, isDefault, isGeneric, isCustom, source (JD\_UPLOAD/TEMPLATE\_CLONE/MANUAL\_ENTRY/SYSTEM\_DEFAULT), complexityLevel (LOW/MEDIUM/MEDIUM\_HIGH/HIGH), jdContext (Json?), hiringIntelligence (Json?) | Default roles \+ custom roles via AI-powered Role Builder. `jdContext` persists extracted JD data (environment, skills, tasks, error consequences) for domain-adaptive assessment. `isGeneric` marks the Generic Aptitude role for equal-weight scoring. | ✅ Live |
| Cutline | roleId, orgId, technicalAptitude, behavioralIntegrity, learningVelocity, overallMinimum | Minimum percentile thresholds per role per org | ✅ Live |
| CompositeWeight | roleId, constructId, weight (0.0–1.0), version, source (RESEARCH\_VALIDATED/EMPIRICALLY\_ADJUSTED/CLIENT\_CUSTOMIZED) | 12 weights per role with version tracking and source attribution | ✅ Live |
| RoleVersion | roleId, version, weights, cutlines, rationale, changedBy, changedAt | Historical snapshots for rollback and audit trail | ✅ Live |

### **Candidates & Assessments**

| Model | Key Fields | Notes | Status |
| :---- | :---- | :---- | :---- |
| Candidate | firstName, lastName, email, phone, orgId, primaryRoleId, status, resultsEmailSentAt | Status: INVITED, INCOMPLETE, SCORING, RECOMMENDED, REVIEW\_REQUIRED, DO\_NOT\_ADVANCE. Compound unique constraint on (email, orgId) prevents duplicate candidates per org. `resultsEmailSentAt` prevents duplicate result email sends. | ✅ Live |
| Assessment | candidateId, startedAt, completedAt, durationMinutes, version (V1\_BLOCKS \| V2\_CONVO) | One-to-one with Candidate; `version` field determines which assessment modality and scoring pipeline to use | ✅ Live |
| AssessmentInvitation | candidateId, roleId, invitedBy, invitedAt, expiresAt, status (PENDING/STARTED/COMPLETED/EXPIRED), linkToken | Token-based invitation with 7-day expiry and email delivery | ✅ Live |
| SubtestResult | assessmentId, construct, layer, rawScore, percentile, theta, standardError, responseTimeAvgMs, calibrationScore, narrativeInsight, layerARawScore?, layerBRawScore?, layerAWeight?, layerBWeight?, consistencyLevel?, consistencyDownweighted, ceilingType?, ceilingNarrative?, scoringVersion | One per construct per assessment (12 total). V2 assessments populate additional fields: layered raw scores, consistency data, ceiling characterization, and scoringVersion=2 | ✅ Live |
| CompositeScore | assessmentId, roleSlug, indexName, score, percentile, passed, distanceFromCutline | One per role per assessment (enables Role Switcher) | ✅ Live |
| ItemResponse | assessmentId, itemId, response, responseTimeMs, rawScore | Individual item-level response tracking with timing | ✅ Live |
| ItemCalibration | itemId, difficulty, discrimination, guessing | IRT calibration parameters per item | ✅ Live |

### **AI Interactions & Integrity**

| Model | Key Fields | Notes | Status |
| :---- | :---- | :---- | :---- |
| AIInteraction | assessmentId, construct, sequenceOrder, triggerItemId, triggerResponse, aiPrompt, candidateResponse, aiAnalysis, confidence | Full audit trail of AI-adaptive follow-up exchanges | ✅ Live |
| Prediction | assessmentId, rampTimeWeeks, rampTimeLabel, supervisionLevel, ceilingLevel, attritionRisk, supportingFactors | Score-driven predictions with supporting factor explanations | ✅ Live |
| RedFlag | assessmentId, flagType, severity (CRITICAL/WARNING/INFO), description, evidence, affectedConstructs | 7 automated integrity checks (see Section 8.4) | ✅ Live |
| Note | candidateId, userId, content, createdAt | User-authored notes with timestamps | ✅ Live |
| ActivityLog | entityType, entityId, action, changedBy, changedAt, details | Full audit trail for entity changes (TA\_LEADER+ access) | ✅ Live |
| PostAssessmentSurvey | assessmentId, difficulty, fairness, faceValidity, feedback | Candidate experience feedback after assessment completion | ✅ Live |

### **Outcome Tracking & Data Refinement (New)**

| Model | Key Fields | Notes | Status |
| :---- | :---- | :---- | :---- |
| OutcomeRecord | candidateId, trainingCompletion, rampTimeActual, retentionStatus, supervisorRating, qualityScore, safetyRecord, promotionStatus | Post-hire outcome data for predictive validation studies | ✅ Live |

### **V2 Conversational Assessment Models (New in v1.4)**

| Model | Key Fields | Notes | Status |
| :---- | :---- | :---- | :---- |
| ConversationMessage | id, assessmentId, role (AGENT/CANDIDATE/SYSTEM), content, act (ACT\_1/ACT\_2/ACT\_3), metadata (Json), elementType?, elementData (Json)?, candidateInput?, responseTimeMs?, sequenceOrder | Full audit trail of every exchange in a V2 conversational assessment. Interactive elements (MC, numeric input, timed challenges) are embedded as messages with elementType/elementData. Indexed on (assessmentId, act) and (assessmentId, sequenceOrder). | ✅ Live |
| AssessmentState | id, assessmentId (unique), currentAct, currentScenario, currentBeat, currentConstruct?, currentPhase?, branchPath (Json)?, act2Progress (Json)?, act3Progress (Json)?, isComplete, updatedAt | Tracks progress through the three-act structure. `branchPath` records Strong/Adequate/Weak classification per beat. `act2Progress` tracks per-construct adaptive loop state (phase, items served, boundary estimate). `updatedAt` used for optimistic concurrency control. | ✅ Live |
| AIEvaluationRun | id, assessmentId, messageId, construct, runIndex (0–2), indicatorScores (Json), aggregateScore (0.0–1.0), modelId, latencyMs, rawOutput | Audit trail for Layer B triple-evaluation scoring. Three runs per response, median selected as final score. Enables reliability analysis (ICC across runs) and cost attribution. Indexed on (assessmentId, construct) and (messageId). | ✅ Live |

**V2-Specific Enums:**

| Enum | Values | Purpose |
| :---- | :---- | :---- |
| AssessmentVersion | V1\_BLOCKS, V2\_CONVO | Determines assessment modality and scoring pipeline |
| AssessmentAct | ACT\_1, ACT\_2, ACT\_3 | Three-act structure progression |
| CeilingTypeEnum | HARD\_CEILING, SOFT\_CEILING\_TRAINABLE, SOFT\_CEILING\_CONTEXT\_DEPENDENT, STRESS\_INDUCED, INSUFFICIENT\_DATA | Layer C ceiling characterization classification |
| ConvoMessageRole | AGENT, CANDIDATE, SYSTEM | Message authorship in conversational assessment |
| InteractionElementType | TEXT\_RESPONSE, MULTIPLE\_CHOICE\_INLINE, NUMERIC\_INPUT, TIMED\_CHALLENGE, CONFIDENCE\_RATING, TRADEOFF\_SELECTION | Interactive element types embedded in chat messages |

## **5.2 Construct & Layer Enums**

ACI assesses 12 constructs organized into three layers. These enums are referenced throughout the scoring engine, dashboard, and candidate profiles.

| Layer | Constructs | Dashboard Color |
| :---- | :---- | :---- |
| Cognitive Core (5) | Fluid Reasoning, Executive Control, Cognitive Flexibility, Metacognitive Calibration, Learning Velocity | Blue (\#2563EB) |
| Technical Aptitude (5) | Systems Diagnostics, Pattern Recognition, Quantitative Reasoning, Spatial Visualization, Mechanical Reasoning | Green (\#059669) |
| Behavioral Integrity (2) | Procedural Reliability, Ethical Judgment | Amber/Orange (\#D97706) |

## **5.3 Assessment Invitation Model** ✅ IMPLEMENTED

The full invitation flow is operational:

* Recruiter clicks “Invite a Candidate” from the dashboard → enters candidate details and selects role → system creates Candidate record, Assessment, and AssessmentInvitation → generates unique token link → sends branded invitation email via Resend

* **Single invite:** Modal form with name, email, role selection → immediate email dispatch

* **Batch invite:** CSV upload with drag-drop or file picker → preview table with error highlighting → async batch processing with progress indicator

* AssessmentInvitation tracks: candidateId, roleId, invitedBy (userId), invitedAt, expiresAt (7-day default), status (PENDING / STARTED / COMPLETED / EXPIRED), linkToken

* Link token authenticates the candidate for the assessment session without requiring account creation

* Invitation email includes: candidate name, role, company branding, assessment link, expiration date

* Expired invitations display a dedicated expiration screen with instructions to contact the recruiter

# **6\. The 5 Roles — Composite Weights & Cutlines**

The construct weights and cutlines below are research-informed starting defaults derived from meta-analytic literature and occupational ability profiles. They represent the best available estimates prior to empirical validation with real ACI assessment data.

| Scientific Integrity Note *These weights are informed by Schmidt & Hunter (1998), Salgado & Moscoso (2019), Wilmot & Ones (2019), O\*NET ability data, ASVAB research, and EEOC Uniform Guidelines. However, no study in this literature prescribes exact weights for a 12-construct model against these specific manufacturing roles. The directional patterns are well-supported (e.g., GMA validity increases with job complexity; conscientiousness effects attenuate at higher complexity). The specific numerical values (e.g., 0.15 vs. 0.12 vs. 0.18) are interpretive judgments that will be empirically validated and recalibrated using real ACI-score-to-job-performance correlations from pilot deployments. These are hypotheses to be tested, not proven facts.* |
| :---- |

## **6.1 What the Research Supports (Directional Logic)**

* GMA validity increases with job complexity: ρ ≈ .50 for low-complexity roles scaling to ρ ≈ .68 for high-complexity roles (Schmidt & Hunter 1998). This justifies increasing cognitive construct weights from Factory Technician to Manufacturing Engineer.

* Conscientiousness has its strongest predictive effect (ρ̅ \= .33) in skilled/semiskilled occupations and attenuates as job complexity increases (Wilmot & Ones 2019). This justifies high Procedural Reliability weight for Factory Technician (0.20) decreasing to near-zero for CAM Programmer (0.00) and Manufacturing Engineer (0.03).

* O\*NET ability importance ratings for specific SOC codes (e.g., Machinists: Visualization importance \~53, Math Reasoning importance \~47; CNC Tool Programmers: Math Reasoning importance 63\) inform the relative ordering of technical constructs per role.

* Integrity meta-analysis (ρ \= .41, Ones et al. 1993/2012) supports elevated behavioral thresholds for roles where errors have catastrophic consequences (CMM Programmer in defense/aerospace).

* ASVAB methodology (IRT, CAT, SJT paradigms) informs the measurement approach, not the specific construct taxonomy. ACI’s 12 constructs are a novel model inspired by the same psychometric tradition.

## **6.2 What the Research Does NOT Support (Specific Numbers)**

No published study states “Spatial Visualization should be weighted 0.15 for CNC Machinists.” The cited research provides validity coefficients for broad construct categories and ability importance ratings on different scales. Translating these into a 12-construct weight vector that sums to 1.00 is an interpretive act informed by the research, not a mathematical derivation from it. The difference between a weight of 0.12 and 0.15 is a judgment call, not an empirical finding.

Similarly, the cutline thresholds (“≥40th percentile” for Factory Technician Technical Aptitude) assume a norming distribution that does not yet exist. ACI requires approximately 10,000 assessments for stable percentile norms. Until that norming database is populated, cutlines are calibrated estimates that will be adjusted based on observed pass rates, predictive validity correlations, and adverse impact analysis.

## **6.3 Empirical Validation Protocol**

The following protocol will be executed during and after the Anduril and Hadrian pilot deployments to move from research-informed estimates to empirically validated weights:

### **Phase A: Pre-Pilot Simulation (Before Any Real Assessments)**

* Generate 1,000+ synthetic candidate profiles with realistic score distributions across all 12 constructs

* Run synthetic profiles through the scoring engine to verify: composites differentiate roles correctly, cutline logic produces sensible pass rates (target: 30–50% Strong Fit, 15–25% Conditional, remainder Not a Direct Fit), red flag rules trigger at appropriate frequency (5–15%), status determination produces a reasonable distribution across all four statuses

* Stress-test edge cases: candidates with extreme profiles (all high, all low, spiky specialists, flat generalists), candidates exactly at cutline boundaries, candidates with missing construct data

* Document results and adjust weights/cutlines if simulation reveals degenerate distributions

### **Phase B: Pilot Criterion Collection (Months 1–6)**

* Assess N=200–500 candidates at Anduril and Hadrian using current weight defaults

* Collect criterion data at 90 days post-hire: supervisor performance ratings (structured rubric), time-to-productivity milestones, error rates and rework frequency, actual supervision load (manager-reported hours), retention/attrition status

* Collect concurrent validity data: assess current high performers and average performers retrospectively to validate that ACI scores differentiate

### **Phase C: Weight Recalibration (Month 6–12)**

* Compute criterion-related validity coefficients: correlation of each construct score with each criterion variable, per role

* Run multiple regression analysis: which constructs actually predict 90-day performance for each role? Do the empirical predictors match the research-informed weights?

* Recalibrate weights using empirical regression coefficients, shrinkage-corrected to prevent overfitting to small samples

* Recalibrate cutlines based on observed score distributions and desired selection ratios

* Target: achieve composite-to-performance correlation r \> 0.60 for each role

* Document all changes with rationale; publish internal validation report

### **Phase D: Ongoing Validation (Continuous)**

* Quarterly validity analysis as assessment volume grows

* Annual norming database refresh with updated percentile distributions

* Longitudinal tracking: 6-month, 12-month, 24-month performance correlations

* Cross-organization generalizability studies as new customers onboard

* Adverse impact monitoring with 4/5ths rule reporting per demographic group

## **6.4 Master Weight Table (Research-Informed Defaults)**

All 12 constructs are weighted for every role (sum \= 1.00). Top 3 per role are highlighted. These values will be recalibrated per the Empirical Validation Protocol above.

| Construct | Factory Tech | CNC Mach. | CAM Prog. | CMM Prog. | Mfg Engr. |
| :---- | ----- | ----- | ----- | ----- | ----- |
| **Fluid Reasoning** | **0.10** | 0.08 | **0.15** | **0.10** | **0.18** |
| **Executive Control** | **0.10** | **0.10** | 0.08 | **0.10** | 0.05 |
| **Cognitive Flexibility** | **0.05** | **0.08** | **0.05** | **0.05** | **0.08** |
| **Metacognitive Calibration** | **0.08** | 0.05 | 0.05 | **0.08** | **0.08** |
| **Learning Velocity** | **0.22** | **0.08** | 0.07 | 0.05 | **0.12** |
| **Systems Diagnostics** | 0.03 | **0.05** | **0.10** | **0.05** | **0.18** |
| **Pattern Recognition** | **0.07** | **0.12** | 0.05 | **0.15** | 0.05 |
| **Quantitative Reasoning** | 0.05 | **0.15** | **0.18** | **0.20** | 0.08 |
| **Spatial Visualization** | 0.02 | **0.15** | **0.20** | **0.05** | **0.05** |
| **Mechanical Reasoning** | **0.03** | **0.12** | **0.05** | 0.02 | **0.03** |
| **Procedural Reliability** | **0.20** | 0.02 | 0.00 | **0.12** | **0.03** |
| **Ethical Judgment** | **0.05** | 0.02 | 0.02 | **0.03** | **0.07** |

## **6.5 Master Cutline Table (Pre-Norming Estimates)**

| Role | Technical Aptitude (L2 Avg) | Behavioral Integrity (L3 Avg) | Learning Velocity |
| :---- | :---- | :---- | :---- |
| Factory Technician | ≥ 40th percentile | ≥ 60th percentile | ≥ 60th percentile |
| CNC Machinist | ≥ 60th percentile | ≥ 55th percentile | ≥ 50th percentile |
| CAM Programmer | ≥ 75th percentile | ≥ 50th percentile | ≥ 55th percentile |
| CMM Programmer | ≥ 70th percentile | ≥ 75th percentile | ≥ 45th percentile |
| Manufacturing Engineer | ≥ 65th percentile | ≥ 70th percentile | ≥ 65th percentile |

## **6.6 Role Profile Research Rationale**

| Role Flexibility ✅ *Per Tasha’s discovery feedback, these five roles are starting templates, not hardcoded constraints. The AI-Powered Role Builder (Section 19) is now live, allowing customers to create custom roles via JD upload, template cloning, or manual entry. The system generates research-backed construct weights and cutlines with O\*NET occupation matching. Custom roles support version control and research rationale documentation. The validation protocol applies equally to custom role configurations. Additionally, a Generic Aptitude role (Section 23) enables role-agnostic assessment with automatic cross-role fit rankings, supporting talent redirection workflows.* |
| :---- |

### **Factory Technician**

Job Complexity: Low-to-Medium. GMA validity: ρ ≈ .50–.55. Top constructs: Learning Velocity (0.22), Procedural Reliability (0.20), Executive Control (0.10), Fluid Reasoning (0.10). Low technical cutline (40th) reflects entry-level; success comes from non-traditional backgrounds where coachability exceeds prior knowledge. High behavioral cutline (60th) reflects Wilmot & Ones finding that conscientiousness has its strongest effect (ρ̅ \= .33) in skilled/semiskilled occupations.

### **CNC Machinist**

Job Complexity: Medium. GMA validity: ρ ≈ .55–.62. Top constructs: Spatial Visualization (0.15), Quantitative Reasoning (0.15), Mechanical Reasoning (0.12), Pattern Recognition (0.12). O\*NET shows Machinists require above-average Visualization (importance \~53) and Math Reasoning (importance 47). Procedural Reliability drops to 0.02 because CNC Machinists exercise professional judgment.

### **CAM Programmer**

Job Complexity: Medium-to-High. GMA validity: ρ ≈ .62–.68. Top constructs: Spatial Visualization (0.20), Quantitative Reasoning (0.18), Fluid Reasoning (0.15). Highest technical cutline (75th) reflects scarce talent market and high cognitive demands. Lowest behavioral cutline (50th) — baseline integrity sufficient. Procedural Reliability \= 0.00; this is a creative problem-solving role where rigid rule-following impairs performance.

### **CMM Programmer**

Job Complexity: Medium-to-High. GMA validity: ρ ≈ .60–.65. Top constructs: Quantitative Reasoning (0.20), Pattern Recognition (0.15), Procedural Reliability (0.12). Only role where Behavioral Integrity cutline (75th) exceeds Technical Aptitude cutline (70th) — a measurement error passing a bad part in defense/aerospace is catastrophic. Integrity meta-analysis (ρ \= .41) supports elevated behavioral threshold.

### **Manufacturing Engineer**

Job Complexity: High. GMA validity: ρ ≈ .65–.68. Top constructs: Fluid Reasoning (0.18), Systems Diagnostics (0.18), Learning Velocity (0.12). Highest-complexity role; GMA validity peaks here. Engineers design procedures, not follow them (Procedural Reliability \= 0.03). Elevated Ethical Judgment (0.07) reflects mentoring requirements and cross-organizational communication. Highest Learning Velocity cutline (65th) because continuous learning is the essential differentiator.

# **7\. Role-Based Access Control (RBAC)**

RBAC is enforced at both the API layer (response payload filtering) and the UI layer (component conditional rendering). Every API route filters data based on user.role. Every UI component checks role before rendering gated sections.

## **7.1 Data Visibility Matrix**

| Data | Recruiter | Recruit. Mgr | Hiring Mgr | TA Leader | Admin |
| :---- | ----- | ----- | ----- | ----- | ----- |
| Status & pass/fail | ✓ | ✓ | ✓ | ✓ | ✓ |
| Contact info | ✓ | ✓ | ✓ | ✓ | ✓ |
| Overall fit score | ✓ | ✓ | ✓ | ✓ | ✓ |
| Composite index scores | ✓ | ✓ | ✓ | ✓ | ✓ |
| Interview focus areas | ✓ | ✓ | ✓ | ✓ | ✓ |
| Development recommendations | ✓ | ✓ | ✓ | ✓ | ✓ |
| Predictive insights (ramp, supervision, etc.) | — | ✓ | ✓ | ✓ | ✓ |
| Red flags detail | — | ✓ | ✓ | ✓ | ✓ |
| Full construct breakdowns | — | — | ✓ | ✓ | ✓ |
| Question-level detail | — | — | ✓ | ✓ | ✓ |
| AI follow-up transcripts | — | — | ✓ | ✓ | ✓ |
| Peer comparison (detailed) | — | — | ✓ | ✓ | ✓ |
| Raw IRT / theta parameters | — | — | — | ✓ | ✓ |
| Validity metrics | — | — | — | ✓ | ✓ |
| Full audit trail | — | — | — | ✓ | ✓ |

## **7.2 Hiring Manager View (New)**

The prior PRD defined the Hiring Manager RBAC role but never specified the actual experience. This is the critical gap now closed. The hiring manager is the validator — the person who receives a shareable link from Kevin, opens it on a phone between shifts, and needs to make a go/no-go decision in under 2 minutes.

### **Shareable Link Flow**

* One-click link generation from the recruiter view that opens a read-only, RBAC-filtered candidate profile

* No login required — authenticated via token with 72-hour expiry

* Mobile-first layout: three-column desktop collapses to single scrollable page on phone

* Manager Quick-Start Card (5 bullet points) expanded by default at top; everything else collapsed

### **Approval Actions**

* Simple thumbs-up / thumbs-down / request-more-info buttons at the bottom of the view

* Response triggers a notification to the recruiter with the HM’s decision and any notes

* Time-to-read target: scannable in 90 seconds

# **8\. Scoring Engine** ✅ IMPLEMENTED

The scoring engine supports two pipelines: V1 (single-pass item scoring, Section 8.1–8.5) and V2 (three-layer scoring, Section 8.6). Both produce identical output shapes consumed by downstream systems.

## **8.1 Composite Index Calculation**

The scoring engine is fully operational. V1 assessments use `runScoringPipeline()` (src/lib/scoring.ts, src/lib/assessment/pipeline.ts); V2 assessments use `runScoringPipelineV2()` (src/lib/assessment/scoring/pipeline.ts). The correct pipeline is dispatched automatically on assessment completion (POST /api/assess/\[token\]/complete) based on `assessment.version`. Both pipelines produce the same output shapes. The V1 pipeline runs the full sequence: item scoring → construct aggregation → composite calculation → cutline evaluation → red flag detection → prediction generation → narrative generation (with role context) → status determination. The V2 pipeline uses the three-layer approach (see Section 8.6) then feeds into the same composite/cutline/prediction/status functions. For generic roles, both pipelines additionally compute cross-role fit rankings against all non-generic roles in the organization (see Section 23.3).

Composite \= Σ(percentile\_i × weight\_i) / Σ(weight\_i) for all 12 constructs. Weights are loaded from the CompositeWeight table for the target role. Missing construct data reduces total weight (graceful degradation, not failure). This is a standard weighted average — the same basic approach used in the CAT-ASVAB’s composite formation, GRE score aggregation, and virtually every multi-construct assessment battery.

| Scoring Engine Reliability Dependency *The composite calculation itself is mathematically sound. However, the engine’s real-world reliability depends entirely on the quality of the percentile scores feeding into it. If individual subtests have poor internal consistency (Cronbach’s α \< .70), no amount of weighting sophistication compensates. The PRD targets α \> .80 per subtest, but this is a design target that will only be verified once items are authored, administered, and psychometrically analyzed during pilot deployment.* |
| :---- |

## **8.2 Cutline Evaluation**

A candidate passes a role’s cutline only if ALL three thresholds are met simultaneously. This is a conjunctive model — more conservative and legally defensible than a single composite score. It explicitly prevents a candidate from compensating for poor behavioral integrity with exceptional technical aptitude, which is the correct design choice for defense manufacturing where process violations can be catastrophic.

* Technical Aptitude average (Layer 2 constructs) ≥ role threshold

* Behavioral Integrity average (Layer 3 constructs) ≥ role threshold

* Learning Velocity percentile ≥ role threshold

Distance from cutline \= minimum gap across all three dimensions. Negative distance indicates below-cutline performance. Candidates within 5 points of cutline are flagged as REVIEW\_REQUIRED rather than DO\_NOT\_ADVANCE. The 5-point buffer zone is a judgment call designed to keep borderline candidates in human review rather than auto-rejecting them.

## **8.3 Status Determination Logic**

| Condition | Result Status |
| :---- | :---- |
| Any CRITICAL red flag | DO\_NOT\_ADVANCE |
| Below cutline by \>5 points | DO\_NOT\_ADVANCE |
| Below cutline by ≤5 points | REVIEW\_REQUIRED |
| Passes all cutlines \+ WARNING flags | REVIEW\_REQUIRED |
| Passes all cutlines \+ no flags | RECOMMENDED |

## **8.4 Red Flag Detection**

### **V1 Red Flags (7 checks)**

Seven automated post-scoring integrity checks run after every V1 assessment completion. ✅ IMPLEMENTED in src/lib/assessment/pipeline.ts:

| Flag | Condition | Severity |
| :---- | :---- | :---- |
| Extreme low scores | Any construct percentile \<10th | CRITICAL |
| Behavioral concerns | Behavioral Integrity constructs \<25th percentile | WARNING |
| Speed-accuracy mismatch | Fast responses (top 10% speed) \+ low accuracy (bottom 10%) | WARNING |
| Incomplete assessment | \>2 constructs with zero item responses | CRITICAL |
| Random responding pattern | Response time \<2s on \>30% of items | CRITICAL |
| AI interaction refusal | Minimal engagement (\<10 words) on \>50% of AI follow-ups | WARNING |
| Overconfidence pattern | Calibration bias \>30% overconfident on \>3 constructs | WARNING |

### **V2 Red Flags (12 checks — New in v1.4)** ✅ IMPLEMENTED

V2 assessments run all 7 original checks (adapted for conversational context) plus 5 new checks specific to the conversational format. Implemented in src/lib/assessment/scoring/red-flags.ts:

| Flag | Condition | Severity |
| :---- | :---- | :---- |
| Scenario disengagement | Average \<20 words on Act 1 conversational responses | WARNING |
| Consistency failure | 3+ constructs with LOW consistency (Act 1 vs Act 3 delta ≥ 0.15) | WARNING |
| Copy-paste detection | Identical phrasing across multiple open-ended responses | WARNING |
| Escalation avoidance | ≥75% of SJT/confrontation responses contain avoidance language (30+ patterns matched) | WARNING |
| High-variance AI evaluation | 3+ construct scores with SD \> 0.3 across triple-evaluation runs | WARNING |

## **8.5 Prediction Generation** ✅ IMPLEMENTED

Score-driven predictions are generated automatically by the scoring pipeline (src/lib/predictions.ts). Four prediction models are operational:

### **Ramp Time Prediction**

Generates 4–16 week estimates based on construct score profiles with supporting factor explanations:

| Learning Velocity | Tech Aptitude Avg | Prediction |
| :---- | :---- | :---- |
| ≥80th | ≥75th | 4–6 weeks (accelerated) |
| ≥60th | ≥60th | 6–10 weeks (standard) |
| ≥40th | Any | 10–13 weeks (extended) |
| \<40th | Any | 13–16 weeks (significant investment) |

### **Supervision Load Prediction**

Based on the average of Executive Control and Procedural Reliability percentiles: ≥75th \= LOW supervision, ≥50th \= MEDIUM, \<50th \= HIGH.

### **Performance Ceiling Prediction**

Based on Fluid Reasoning, Systems Diagnostics, and Learning Velocity: HIGH (career trajectory with advancement potential), MEDIUM (solid contributor), LOW (may plateau early).

### **Attrition Risk Prediction**

Based on Behavioral Integrity and Learning Velocity patterns: LOW (strong retention indicators), MEDIUM (some concern areas), HIGH (elevated risk of early departure).

## **8.6 V2 Three-Layer Scoring Pipeline** ✅ IMPLEMENTED (New in v1.4)

V2 conversational assessments use a fundamentally different scoring approach. Instead of a single pass through item-level scoring, V2 uses three scoring layers that are aggregated per construct, then fed into the **same** composite calculation, cutline evaluation, and status determination logic used by V1. This means all downstream systems (dashboard, profiles, exports, predictions) work unchanged.

Implemented in src/lib/assessment/scoring/pipeline.ts (13-step orchestrator).

### **Layer A — Deterministic Scoring** (src/lib/assessment/scoring/layer-a.ts)

Scores all structured items from Act 2 adaptive loops and Act 3 confidence-tagged items:
* Binary accuracy (correct=1, incorrect=0) scaled by difficulty: `score × (1 + (difficulty − 0.5) × 0.3)`
* Harder items contribute more to the final score
* Aggregate per construct: mean of scaled scores, normalized to 0–1

### **Layer B — AI-Evaluated Rubric Scoring** (src/lib/assessment/scoring/layer-b.ts)

Scores all conversational responses against construct-specific behavioral rubrics (src/lib/assessment/scoring/rubrics.ts — 12 rubrics, 3–5 behavioral indicators each):
* Each indicator scored present(1) / absent(0) by Claude Haiku
* **Triple-evaluation for reliability:** 3 parallel calls with temperature variation (0.3, 0.4, 0.5), lower-median selected as final score
* **Variance tracking:** If SD > 0.3 across the 3 runs, score is flagged and downweighted by 0.5×
* **Concurrency-limited fan-out:** Maximum 6 parallel AI calls per construct evaluation via custom pLimit
* **Token/cost tracking:** Input/output tokens tracked per evaluation, estimated cost logged
* All 3 runs persisted in AIEvaluationRun model for audit and reliability analysis
* Falls back to heuristic scoring if AI unavailable (marked with `isFallback: true`)

### **Layer C — Ceiling Characterization** (src/lib/assessment/scoring/layer-c.ts)

Does NOT produce a numeric score — produces qualitative classification from Act 2 diagnostic probes:

| Ceiling Type | Meaning | Training Implication | Supervision Implication |
| :---- | :---- | :---- | :---- |
| HARD\_CEILING | Fundamental ability limitation | LOW — training unlikely to close gap | Structured support needed |
| SOFT\_CEILING\_TRAINABLE | Gap closable with practice | HIGH — targeted training recommended | Standard with development plan |
| SOFT\_CEILING\_CONTEXT\_DEPENDENT | Performance varies by task context | MEDIUM — monitor across contexts | May excel in some but not others |
| STRESS\_INDUCED | Fatigue/pressure degraded performance | MEDIUM — reduce time pressure | Calm working conditions preferred |
| INSUFFICIENT\_DATA | Not enough probe data to classify | LOW — cannot determine | Standard supervision appropriate |

Feeds narrative reports, predictions, and development recommendations. Falls back to INSUFFICIENT\_DATA on classification failure.

### **Construct Aggregation** (src/lib/assessment/scoring/aggregation.ts)

```
Construct Score = (w_A × Layer_A_score) + (w_B × Layer_B_score)
```

| Scenario | w\_A | w\_B |
| :---- | :---- | :---- |
| Both layers present | 0.55 | 0.45 |
| Layer A only (e.g., Spatial Visualization) | 1.0 | — |
| Layer B only (e.g., Ethical Judgment) | — | 1.0 |

### **Consistency Validation** (src/lib/assessment/scoring/consistency.ts)

Compares construct signals from Act 1 scenarios with Act 3 parallel scenario re-presentations:
* Delta \< 0.15 → HIGH consistency (score stands)
* Delta ≥ 0.15 → LOW consistency (flag, downweight lower-confidence source by 0.75×)
* Lower-confidence source determined dynamically by data point count (Act 1 typically has more data)

### **Pipeline Integration**

After Layer A, B, C scoring and consistency validation produce per-construct scores, the pipeline calls the **same** existing functions:
* `calculateComposite()` from src/lib/scoring.ts (weighted average per role)
* `evaluateCutline()` from src/lib/scoring.ts (conjunctive threshold check)
* `determineStatus()` from src/lib/scoring.ts (RECOMMENDED / REVIEW\_REQUIRED / DO\_NOT\_ADVANCE)
* Prediction generation from src/lib/predictions.ts (enhanced with ceiling characterization data)

This ensures V1 and V2 assessments produce identical output shapes consumed by dashboard, profiles, PDFs, and comparison views.

### **Pipeline Reliability**

* **Retry with exponential backoff:** 3 attempts (1s, 2s, 4s delays) on pipeline failure
* **Error state on exhaustion:** If all retries fail, candidate status is set to ERROR for dashboard visibility
* **TOCTOU protection:** Assessment completion uses transactional re-check to prevent concurrent double-completion
* **Structured logging:** Pipeline start/completion logged with duration, cost, construct count, red flag count

## **8.7 Scoring Engine Simulation & Validation Spec**

Before any real assessment data flows through the scoring engine, the following simulation must be executed to stress-test the math and verify sensible outputs.

### **Simulation Parameters**

* Generate N=1,000 synthetic candidate profiles with scores drawn from realistic distributions (normal, μ=50, σ=15 for each construct percentile, bounded 1–100)

* For each synthetic candidate, calculate composite scores for all 5 roles

* For each synthetic candidate, evaluate cutline pass/fail for all 5 roles

* For each synthetic candidate, apply status determination logic

* Inject deliberate edge cases: 50 profiles with all scores \>90th, 50 with all scores \<20th, 50 with extreme spikes (one construct \>95th \+ rest \<30th), 50 with all scores clustered at 50th ±3 points

### **Validation Criteria (All Must Pass)**

| Check | Expected Outcome | Failure Action |
| :---- | :---- | :---- |
| Role differentiation | Same candidate produces different composite scores for different roles (composites should NOT be identical across roles) | Weight table has insufficient differentiation; increase variance between role weight vectors |
| Pass rate distribution | 30–50% RECOMMENDED, 15–25% REVIEW\_REQUIRED, remainder DO\_NOT\_ADVANCE per role | Cutlines are too strict or too lenient; adjust thresholds |
| Red flag frequency | 5–15% of candidates flagged WARNING; 2–5% flagged CRITICAL | Thresholds need recalibration if too many or too few flags fire |
| Status distribution | All four statuses represented; no status \<5% or \>60% of population | Status logic has a degenerate branch; review determination rules |
| Cutline boundary behavior | Candidates within ±5 points of cutline consistently receive REVIEW\_REQUIRED, not hard pass/fail | Buffer zone logic has edge case errors |
| Missing data graceful degradation | Candidates with 1–2 missing constructs still receive valid composites; candidates with \>2 missing receive INCOMPLETE | Weight normalization or missing-data handling needs fix |
| Composite monotonicity | Higher percentile inputs always produce higher composite outputs (no inversions) | Weight application or normalization has a mathematical error |
| Role mismatch detection | Candidates who fail primary role but pass alternative role are correctly identified and surfaced | Cross-role evaluation logic needs verification |

### **Simulation Deliverable**

The simulation produces a Scoring Engine Validation Report documenting: the distribution of composites per role (histogram), pass rates per role, status breakdown, red flag frequency, edge case behavior, and any adjustments made. This report must be completed and reviewed before real candidate data enters the system.

# **9\. Assessment Delivery Platform** ✅ IMPLEMENTED

The assessment delivery platform uses a single modality: the **AI-conducted conversational investigation** guided by **Aria**, a named AI evaluator (src/app/(assess)/assess/\[token\]/v2/, src/lib/assessment/, src/components/assessment/). Orb-centered stage interface with ElevenLabs TTS voice output, Web Speech API voice input, inline interactive elements, and 3-layer scoring. ~60–90 minutes. See Section 26 for full specification.

The assessment produces SubtestResult, CompositeScore, Prediction, and RedFlag records consumed by the dashboard, profiles, PDFs, and comparison views.

> **Historical note:** V1 (6-block form-based assessment) was removed in v1.5. The V1 feature flag (`ASSESSMENT_V2`), version enum (`AssessmentVersion`), and all V1-only files were deleted. Historical V1 assessment data (SubtestResult, CompositeScore) remains in the database but the V1 assessment UI and scoring pipeline no longer exist in the codebase. The sections below describe the original V1 design for reference only.

## **9.1 Assessment Structure (As Built)**

The assessment is organized into 6 blocks (src/lib/assessment/blocks.ts), each containing 4–6 items from the item bank (src/lib/assessment/items.ts, 100\+ items):

| Block | Focus | Items |
| :---- | :---- | :---- |
| Block 0 | Reasoning & Executive Control | 4–6 items covering Fluid Reasoning, Executive Control |
| Block 1 | Technical Aptitude | 4–6 items covering Systems Diagnostics, Quantitative Reasoning, Spatial Visualization, Mechanical Reasoning |
| Block 2 | Learning & Systems Thinking | 4–6 items covering Learning Velocity, Cognitive Flexibility, Pattern Recognition |
| Block 3 | Procedural Reliability & Ethics | 4–6 items covering Procedural Reliability, Ethical Judgment (SJT scenarios) |
| Block 4 | Time Pressure & Decision-Making | 4–6 timed items covering Executive Control, Metacognitive Calibration |
| Block 5 | Final Constructs & Confidence Checks | 4–6 items with embedded calibration measures |

### **Item Types (5 Implemented)**

| Type | Description | Scoring |
| :---- | :---- | :---- |
| MULTIPLE\_CHOICE | 4-option questions with correct answer | Binary accuracy (0 or 1) |
| LIKERT | 5-point scale responses | Scaled 0–1 based on response value |
| OPEN\_RESPONSE | Free-text answers | AI-scored or manual evaluation |
| AI\_PROBE | Follow-up questions triggered by prior responses | AI analysis with confidence score |
| TIMED\_SEQUENCE | Speed \+ accuracy under time pressure | Accuracy weighted by response time |

## **9.1.1 Original Measurement Paradigms (Design Reference)**

The five measurement paradigms from the original specification remain the theoretical foundation. The current 6-block structure implements these paradigms:

| Paradigm | Constructs | Implementation Status |
| :---- | :---- | :---- |
| 1: Adaptive Difficulty | 7 constructs (Cognitive Core \+ Technical Aptitude) | ✅ V1: Pre-ordered item banks with difficulty metadata. V2: Binary-search adaptive loops with 86-item calibrated bank (see Section 26.4). Full IRT-based CAT pending. |
| 2: Accuracy \+ Response Time | Executive Control, Cognitive Flexibility, Pattern Recognition | ✅ Millisecond timing captured on all items via ItemResponse model |
| 3: Confidence Calibration | Embedded across all constructs | ✅ Calibration bias calculated in construct scoring |
| 4: Situational Judgment Tests | Procedural Reliability, Ethical Judgment | ✅ SJT scenarios in Block 3 |
| 5: Behavioral Consistency | Embedded in Paradigm 4 | ✅ Parallel scenario pairs with consistency checks |

## **9.2 Integrated Adaptive Ceiling Detection & AI Probing System**

This is ACI’s core measurement innovation and primary technical differentiator. The system integrates Computerized Adaptive Testing (CAT) with AI-generated targeted probes into a unified adaptive loop that finds each candidate’s performance ceiling and then characterizes the nature of that limitation.

| The Core Principle *When a candidate is doing well, increase the difficulty in real time until you find a crack. Then put questions in specifically designed to verify and characterize that crack. The result is not just a score — it’s a precise map of what the candidate can do, where they break down, and whether that breakdown is trainable or fundamental.* |
| :---- |

### **Stage 1: Adaptive Difficulty Escalation (CAT Engine)**

The CAT engine uses Item Response Theory (IRT) to dynamically adjust difficulty in real time:

* Start with a moderate-difficulty item (difficulty parameter b \= 0.0 on the IRT scale)

* Candidate answers correctly → system re-estimates ability (θ) upward → serves a harder item

* Candidate continues answering correctly → system escalates to increasingly difficult items

* Candidate fails → system now knows the ceiling is between the last pass and the current fail

* Next item is selected at exactly the estimated ability level to maximize measurement information

* This zigzag continues until standard error drops below 0.30 (high confidence in ability estimate) or the fixed item count is reached

V1 Implementation: pre-ordered item banks (easy → hard) with difficulty metadata tagged per item. The system progresses through the bank and records the last-passed and first-failed difficulty levels. This approximates full CAT without requiring a real-time IRT estimation engine.

V2 Implementation (✅ LIVE): Binary-search adaptive loops with 86-item calibrated bank (see Section 26.4). Four-phase algorithm per construct: calibration → boundary mapping → pressure test → diagnostic probe. The boundary mapping phase uses binary search from both sides to pinpoint the difficulty level where accuracy drops below 50%. Pressure testing verifies the boundary from a different sub-type. Diagnostic probes characterize the nature of the ceiling (HARD\_CEILING, SOFT\_CEILING\_TRAINABLE, etc.).

Future: Full IRT-based CAT with real-time θ estimation, item selection from calibrated item pools, and adaptive stopping rules. Based on CAT-ASVAB methodology (in operational use since 1992, 40+ million administrations, withstood 30+ years of legal scrutiny).

### **Stage 2: AI-Targeted Ceiling Probing**

When the CAT engine detects a performance ceiling (the difficulty level where accuracy drops below 50%), the system triggers a specialized AI probing sequence. This is NOT a generic follow-up — it is a targeted investigation of the specific failure point.

The AI probing prompt receives:

* The construct being measured and its definition

* The candidate’s full response pattern (which items passed, which failed, at what difficulty levels)

* The estimated ceiling point (the difficulty level where performance broke down)

* Response timing data (did they slow down near the ceiling? speed up and guess?)

The AI then generates 1–2 targeted probe questions designed to answer a specific diagnostic question:

| Diagnostic Question | What the Probe Tests | Implication for Candidate |
| :---- | :---- | :---- |
| Hard ceiling vs. soft ceiling? | Can the candidate solve the problem with more time, a different representation, or a worked example? Or is it fundamentally beyond their current ability? | Hard ceiling \= training unlikely to close gap. Soft ceiling \= structured practice will improve performance. |
| Domain-specific vs. general? | Does the failure generalize across contexts (e.g., all complex spatial tasks) or is it isolated to a specific type (e.g., only multi-axis rotation)? | General \= broader ability limitation. Specific \= targeted training can address the gap. |
| Stress-induced vs. competence-limited? | Did the candidate fail because the item was too hard, or because accumulated cognitive fatigue degraded performance on items they could normally handle? | Stress-induced \= may perform better in real-world paced environments. Competence-limited \= score accurately reflects capability. |
| Self-aware vs. blind spot? | Does the candidate recognize they struggled? (Cross-referenced with embedded confidence calibration data) | Self-aware \+ ceiling \= coachable. Overconfident \+ ceiling \= supervision risk. |

### **Stage 3: Ceiling Characterization & Narrative Generation**

After the AI probing sequence, Claude analyzes the candidate’s probe responses and generates a structured ceiling characterization that feeds directly into the Intelligence Report and Development Recommendations:

* Ceiling type classification: HARD\_CEILING, SOFT\_CEILING\_TRAINABLE, SOFT\_CEILING\_CONTEXT\_DEPENDENT, STRESS\_INDUCED, or INSUFFICIENT\_DATA

* Narrative insight: e.g., “Strong spatial reasoning up to moderate complexity; struggles with multi-axis mental rotation when more than 3 transformations are required; responds well to visual scaffolding, suggesting this is trainable with structured practice over 4–6 weeks”

* Training recommendation: specific, actionable guidance tied to the ceiling characterization

* Supervision implication: whether this ceiling affects day-1 supervision load or only matters for advanced tasks

### **Stage 4: Optional Ability Re-Estimation**

In V2 (full IRT implementation), the AI probe responses can feed back into the CAT engine to refine the ability estimate. If a candidate’s probe responses reveal competence that fixed items missed (e.g., they can explain the correct spatial reasoning approach but made an execution error under time pressure), the system can adjust θ upward within bounds. Conversely, if probes confirm the weakness is fundamental, θ remains unchanged. This bidirectional integration between CAT and AI probing is unique to ACI.

### **Integrated Loop Architecture**

The full adaptive loop for each construct:

* 1\. Fixed items begin at moderate difficulty (CAT engine manages progression)

* 2\. CAT escalates difficulty as candidate succeeds

* 3\. When ceiling is detected (θ estimate stabilizes OR difficulty exceeds candidate ability by \>1 SD), system triggers AI probe

* 4\. AI generates 1–2 targeted probes based on the specific ceiling characteristics

* 5\. Candidate responds to probes (open-ended text, no time limit but tracked)

* 6\. AI analyzes probe responses: classifies ceiling type, generates narrative insight

* 7\. (V2 only) CAT engine optionally re-estimates θ based on probe evidence

* 8\. System moves to next construct or generates additional probes if diagnostic question remains unresolved (max 3 probes per construct)

* 9\. All interactions logged to AIInteraction model for audit trail and future validation research

## **9.3 AI Prompt Architecture**

Two specialized prompt templates drive the ceiling-probing system. As of v1.3, both prompts are **domain-adaptive** — they receive full role context (environment, technical skills, key tasks, consequence of error) when available, producing role-relevant probing and analysis (see Section 22.3):

### **Ceiling Probe Generation Prompt**

Receives: construct definition, candidate response pattern, accuracy rate, timing data, estimated ceiling difficulty level, **role context** (role name, domain, technical skills, key tasks). Generates: one follow-up question that specifically probes the nature of the ceiling (hard vs. soft, domain-specific vs. general) **with language relevant to the candidate’s target role domain**. Returns structured JSON with question text, probe target, and expected strong vs. weak response criteria. Falls back to domain-neutral probing when role context is unavailable or the role is generic.

### **Probe Analysis Prompt**

Receives: construct definition, the probe question asked, the candidate’s open-ended response, response time, **role context**. Returns structured JSON with: ceiling type classification, evidence strength (0.0–1.0), narrative fragment for the Intelligence Report, training recommendation, and whether an additional probe is needed. Role context enables the AI to evaluate responses against domain-specific expectations.

### **Security & Reliability**

* All role context fields are sanitized before inclusion in prompts (control chars stripped, length limits enforced; see Section 24.2)
* All Anthropic API calls use AbortController with 15-second timeout (see Section 24.4)
* Token-based authentication validates the candidate’s linkToken before processing any probe request (see Section 24.1)

## **9.4 Assessment UI (As Built)** ✅ IMPLEMENTED

The assessment UI is implemented across multiple components (src/components/assess/):

* **AssessmentShell** — Main container managing assessment state via Zustand store with sessionStorage persistence and network resilience (failed response queue with exponential backoff retry: 0s, 1s, 3s)

* **ProgressBar** — Block and item progress indicator showing completion percentage

* **BlockInterstitial** — Break screen between blocks with encouragement and next-block preview

* **Item-type components** — Dedicated renderers for each of the 5 item types: MultipleChoice, LikertScale, OpenResponse, AiProbe, TimedSequence

* **WelcomeScreen** — Token validation, invitation status check, expiration handling

* **CompletionScreen** — Assessment finalization trigger (calls scoring pipeline)

* **ExpiredScreen** — Dedicated screen for expired invitation tokens

* **ThankYouScreen** — Post-completion confirmation

* **SurveyForm** — Post-assessment feedback (difficulty, fairness, face validity)

* No back button (prevents gaming) ✅

* Forward-only progression through blocks and items ✅

* Response timing captured on every item interaction ✅

* Responsive design for desktop, tablet, and mobile ✅

## **9.5 Item Bank** ✅ IMPLEMENTED

The active item bank (src/lib/assessment/item-bank.ts) contains 86 calibrated items across 5 constructs used by the conversational assessment engine. See Section 26.4 for full specification.

> **Historical note (V1):** The V1 item bank (src/lib/assessment/items.ts, 100+ domain-neutral items) was deleted in v1.5.

## **9.6 V1 Assessment Scoring Pipeline** 🗑️ REMOVED (v1.5)

The V1 scoring pipeline (src/lib/assessment/pipeline.ts) was deleted in v1.5. The sole scoring pipeline is now the three-layer pipeline described in Section 8.6.

1. Fetch assessment \+ all item responses from database
2. Load role context via `getRoleContext(roleId)` for domain-adaptive processing (see Section 22.2)
3. Score individual items (src/lib/assessment/item-scoring.ts) — raw accuracy 0–1
4. Aggregate into construct scores (src/lib/assessment/construct-scoring.ts) — percentile-normalized
5. Calculate narrative insights per construct with role context (see Section 22.4)
6. Compute calibration bias (confidence vs. accuracy gap)
7. Calculate composite score (weighted constructs per role via src/lib/scoring.ts)
8. Evaluate cutline pass/fail
9. Generate red flags (7 automated checks)
10. Create predictions with role context (ramp time, supervision, ceiling, attrition via src/lib/predictions.ts; see Section 22.5)
11. For generic roles: compute cross-role fit rankings against all org roles (see Section 23.3)
12. Determine final candidate status (RECOMMENDED, REVIEW\_REQUIRED, DO\_NOT\_ADVANCE)

## **9.7 Delivery Infrastructure**

* Currently deployed as a web-based remote assessment platform (not limited to physical assessment centers)

* Candidates access via secure token links from invitation emails

* No account creation required for candidates — token-based authentication

* Physical assessment center deployment remains a future option for proctored environments

* Initial locations planned: Los Angeles, Phoenix, Ohio (expand based on customer concentration)

# **10\. Frontend Application Specification** ✅ IMPLEMENTED

The frontend is organized around protected dashboard routes, candidate-facing assessment routes, auth routes, and tutorial/demo routes. Navigation is via a sticky top bar (TopNav component) with: Dashboard • Roles • Compare • Export • \[Tutorial\] • \[User Menu\] • \[Notification Bell\]. All routes are RBAC-enforced via middleware and server-side auth checks.

## **10.1 Design System**

### **Colors**

| Token | Hex | Usage |
| :---- | :---- | :---- |
| \--aci-navy | \#0F1729 | Primary backgrounds, headers |
| \--aci-blue | \#2563EB | Actions, links, Cognitive Core layer |
| \--aci-green | \#059669 | Success, Strong Fit, Technical Aptitude layer |
| \--aci-amber | \#D97706 | Warning, Conditional Fit, Behavioral Integrity layer |
| \--aci-red-muted | \#9B1C1C | Not a Direct Fit (muted, not aggressive) |
| \--aci-red | \#DC2626 | Critical flags only |
| \--aci-gold | \#C9A84C | Accents, premium feel |
| \--aci-slate | \#64748B | Secondary text, borders |
| \--aci-surface | \#F8FAFC | Card backgrounds |

### **Typography**

* Display font: DM Sans (system-ui fallback)

* Body font: Inter (system-ui fallback)

* Monospace: JetBrains Mono

### **Status Badges**

| Status | Label | Styling |
| :---- | :---- | :---- |
| RECOMMENDED | ✓ STRONG FIT — Advance to Interview | Green bg, white text |
| REVIEW\_REQUIRED | ⚠ CONDITIONAL FIT — Review Recommended | Amber bg, white text |
| DO\_NOT\_ADVANCE | ○ NOT A DIRECT FIT — Consider Alternative Roles | Muted red-gray bg, white text |
| INCOMPLETE | ○ IN PROGRESS | Gray bg, gray text |

| Empowering Language Design Decision *The choice to use “Strong Fit / Conditional / Not a Direct Fit” instead of “Pass / Fail / Reject” is one of the most important UX decisions in the product. Both Anduril and Hadrian work in environments where candidate experience matters. Punitive language leaks through screenshots, forwarded emails, and candidate complaints.* |
| :---- |

### **Key UI Patterns**

* No candidate photos — initials badges only (bias reduction). 48px circle on dashboard, 64px on profile.

* Score bars: horizontal gradient (red → amber → green) with percentile marker

* Cards: white bg, border-slate-200, rounded-lg, p-4

* Collapsible sections: 200ms ease transition, chevron rotation

* Tooltips: dark bg, text-xs, 200ms delay

### **Auth Pages — “Scientific Pax Americana” Design**

The auth pages set the tone for the entire product. Deep navy (\#0F1729) background with subtle animated grid pattern suggesting circuitry or blueprint drafting. Centered card with frosted glass effect. The feel: a high-clearance defense research facility — clean, precise, authoritative, with warmth. The professionalism of a DARPA briefing room meets the optimism of American manufacturing renaissance.

IMPORTANT: The signup page should say “Request Access” not “Create one.” Open self-signup undermines the premium enterprise positioning.

## **10.2 Dashboard (Landing Page)** ✅ IMPLEMENTED

Route: /dashboard. This is the first thing users see after login. It combines pipeline health overview with the full candidate list. Includes an EmptyState component for new organizations that guides onboarding (create roles, invite candidates). The "Invite a Candidate" button is prominently featured on the empty state.

### **Section A: Pipeline Overview**

Five horizontal Role Pipeline Cards (one per role), scrollable on mobile. Each card shows: role name, total assessed, pass rate progress bar, count of Strong Fit / Conditional / Not a Direct Fit.

### **Section B: Attention Items**

A critical feature for Kevin’s daily workflow — surfaces what needs action without scrolling through all candidates:

* Candidates awaiting decision \>48 hours (urgency)

* Candidates with REVIEW\_REQUIRED status needing human judgment

* Recently completed assessments not yet reviewed

### **Section C: Quick Stats Bar**

Total Assessed, Strong Fit Rate (%), Avg Time to Decision, Assessments This Week. Labels should be precise: “Avg Time to Decision” not “Avg Duration.”

### **Section D: Candidate Table**

The core operational interface. Kevin uses this 20+ times per day. Performance requirements: filters must be instant, search must be predictive, status changes should be inline (click-to-change, not requiring page navigation).

| Column | Content |
| :---- | :---- |
| Candidate Name | Initials badge \+ name \+ email (no photos) |
| Role Applied For | Dropdown filter by role type |
| Assessment Date | Full date \+ relative time (e.g., “3 days ago”) |
| Overall Fit Score | XX/100 with visual bar and percentile |
| Role-Specific Index | Score \+ Pass/Fail badge \+ distance from cutline |
| Red Flags | Icon \+ count, expandable to show details |
| Actions | Email, Schedule, Export, Send to HM, Archive |

Advanced filtering: quick filters for status, date ranges (7/30/90 days), score thresholds (above 80/70/60), role types, red flag presence. CSV export button in the table header must actually download with all specified columns.

## **10.3 Roles Heatmap View** ✅ IMPLEMENTED

Route: /roles. A role-specific heatmap (HeatmapClient component) showing all assessed candidates on a grid of 12 constructs. Role selector dropdown at the top triggers full recalculation. Additional sub-routes: /roles/\[slug\] for role detail (cutlines, constructs, candidate roster), /roles/new for creating new roles (TA\_LEADER+), and /roles/builder for the AI-powered Role Builder (TA\_LEADER+).

### **Heatmap Design**

| Percentile Range | Color | Label |
| :---- | :---- | :---- |
| ≥ 90th | Deep green (\#065F46) | Exceptional |
| 75–89th | Medium green (\#059669) | Strong |
| 50–74th | Light blue-gray (\#94A3B8) | Average |
| 25–49th | Light amber (\#F59E0B) | Below Average |
| \< 25th | Muted red (\#DC2626) | Concern |

Cell content: percentile number centered in colored cell. Columns grouped visually by layer with colored top borders (Blue for Cognitive, Green for Technical, Orange for Behavioral). Weighted column highlighting: for the selected role, columns with higher weights appear slightly wider or have a gold left-border. Cutline overlay: thin dashed line between the last passing candidate and the first failing candidate.

## **10.4 Candidate Profile** ✅ IMPLEMENTED

Route: /candidates/\[id\]. Implemented as ProfileClient component with progressive disclosure layout optimized for hiring decisions. Level 1 (3 seconds) shows pass/fail via DecisionSummary; Level 2 (30 seconds) shows why via LayerResults and PredictionsGrid; Level 3 (3+ minutes) provides detailed construct breakdowns, IntelligenceReport, InterviewGuide, and SpiderChart. All sections RBAC-gated. Includes RecordOutcomeForm for post-hire outcome tracking and NotesPanel for team collaboration.

### **Left Column (Sticky)**

* Candidate basics: initials badge, name, email, phone, role, assessment date, candidate ID

* Decision summary: large status indicator, overall fit score with percentile, role-specific index with pass/fail vs. cutline, red flags summary, quick predictions

* Quick actions: Email, Schedule, Export PDF, Send to HM, Add Note, Archive

### **Center Column (Scrollable)**

Six sections in order:

* Section 1: Executive Summary — one-sentence narrative, top 3 strengths, development areas, key insight paragraph

* Section 2: Interactive Spider Chart — 12-point radar with layer colors (blue/green/orange), reference rings at 50th/75th/100th, hover tooltips, click-to-drill, toggle to bar chart, downloadable as PNG

* Section 3: Candidate Intelligence Report — 6 sub-panels (Work Style, Leadership Dynamics, Practical Assessment, Team Dynamics, Self-Awareness, Onboarding Playbook)

* Section 4: Layer-by-Layer Construct Results — three-level collapsible accordion (Layer → Construct → Question detail). RBAC-gated: Hiring Manager+ sees full detail.

* Section 5: Predictive Performance Indicators — 2×2 grid: Ramp Time, Supervision Load, Performance Ceiling, Attrition Risk

* Section 6: Notes & Activity — user-authored notes \+ auto-generated activity log (TA Leader only)

### **Right Column (Sticky Sidebar)**

* Role Fit \+ Dynamic Role Switcher: dropdown for all 5 roles. On change: recalculate composite, update pass/fail, update cutline distance, update onboarding template, update interview focus. No page reload — all client-side.

* Role Switcher Visual Diff (New): 300ms transition animation with green pulse on constructs that gained relative importance (weight increased) and amber pulse on constructs that lost importance. Status badge animates if fit status changes between roles.

* Peer Comparison: benchmark group, distribution (Top 10% / This Candidate / Average / Bottom 10%), ranking

* Interview Focus Areas: validated strengths (don’t re-test), explore in interview (2–3 areas with specific questions), cultural & team fit reminder

* Development Recommendations: onboarding intensity, ramp time estimate, strengths to leverage, development priorities, ideal first assignments, 30-60-90 day checklist

### **Intelligence Report Tone Guide (New)**

All Intelligence Report text must pass the “would a shop floor lead understand this in one read?” test. The tone should sound like a trusted colleague briefing you on a new team member, not a psychologist’s case file. Replace construct names with plain-English equivalents in candidate-facing text while preserving technical labels in RBAC-gated layers.

## **10.5 Candidate Comparison View** ✅ IMPLEMENTED

Route: /compare?ids=cuid1,cuid2,cuid3. Implemented as CompareClient component. Supports 2–3 candidates side-by-side with: identity cards, overlaid spider chart, layer-by-layer score comparison, predictions comparison, red flags comparison, and interview guide highlights. Role switcher at top recalculates all scores. Also accessible from /tutorial/compare for demo mode.

## **10.6 Interactive Demo & Tutorial** ✅ IMPLEMENTED

Two demo experiences are built:

**Route: /demo** — Landing page with CinematicLoading animation and MiniAssessment (short demo assessment sampling key item types).

**Route: /tutorial/\*** — Full tutorial mode using a demo organization's seeded data. Includes:
* /tutorial/dashboard — Demo dashboard with sample pipeline data
* /tutorial/roles — Demo role heatmap
* /tutorial/candidates/\[id\] — Demo candidate profiles with full data
* /tutorial/compare — Demo comparison view

Tutorial mode is managed by the AppStore (Zustand) with enterTutorial/exitTutorial/setTutorialStep actions. Includes TooltipOverlay for contextual help and TutorialComplete modal for end-of-tutorial flow. getDemoOrgId() helper fetches demo organization data from the database.

# **11\. New Deliverables for Talent Teams**

These features go beyond the core assessment dashboard to transform ACI from a scoring tool into an indispensable hiring intelligence system. Each is grounded in specific persona needs identified through discovery.

## **11.1 Hiring Manager One-Pager (PDF)** ✅ IMPLEMENTED

A single-page PDF (PDFOnePager component, route: GET /api/export/pdf/\[candidateId\]/one-pager) designed specifically for the hiring manager audience. Answers three questions: Should I interview this person? What should I ask about? What should I expect in their first 30 days?

### **Layout (As Built)**

* Top strip: Candidate name, role, status badge, overall fit score, assessment date

* Score summary with layer averages (Cognitive, Technical, Behavioral)

* Predictions row (Ramp Time, Supervision Load, Ceiling, Attrition Risk)

* Interview Focus Questions generated from the candidate’s development areas

* Compact single-page format optimized for quick scanning

## **11.2 Weekly Pipeline Digest (Email)** ⏳ PENDING

An automated weekly email sent every Monday at 7 AM to configured users (TA Leaders and Recruiting Managers). No login required to read it — key metrics are in the email body with a single “Open Dashboard” CTA.

* Pipeline summary: total assessed this week, cumulative, by role

* Pass rate trend: this week vs. last 4-week average with directional arrow

* Action needed: candidates awaiting decision \>48 hours, Conditional Fit needing review

* Top 3 candidates this week: name, role, fit score, one-line headline

* Quiet wins: candidates redirected from one role to another via Role Switcher

Build priority: Phase 2\. Effort: \~1 week. **Note:** Email infrastructure (Resend) is already in place; this feature requires building the digest content generation and scheduling via /api/cron.

## **11.3 Role Mismatch Redirect Engine** ✅ IMPLEMENTED

When a candidate is assessed, the system calculates fit across all roles and surfaces mismatch analysis. Implemented via the RoleMismatch component in the candidate profile:

* In the candidate profile: RoleMismatch component shows construct-level misalignment analysis against the primary role

* Role Switcher (RoleSwitcher component) allows viewing composite scores and pass/fail status across all roles

* CompositeScore records are generated for all roles during scoring, enabling instant role comparison

## **11.4 Interview Prep Kit** ✅ IMPLEMENTED

A structured interview guide auto-generated from the candidate’s assessment data. Available both as a section within the candidate profile (InterviewGuide component) and as a downloadable PDF (PDFInterviewKit component, route: GET /api/export/pdf/\[candidateId\]/interview-kit). Contains: recommended questions for each development area, what to listen for in responses, areas that are already validated (don’t re-test), and suggested interview format and time allocation.

## **11.5 Notification System** 🔶 MOSTLY IMPLEMENTED

* In-app notification bell (NotificationBell component) with badge count. GET /api/notifications returns up to 20 live notifications from DB state (completed assessments, awaiting decisions, started assessments, critical red flags, pending platform access requests). Org-scoped for non-ADMIN users; ADMIN sees platform-level pending requests (`orgId: null`) ✅

* Email notifications for: assessment invitations, access request approvals/rejections, access request admin notifications, org-scoped access request TA\_LEADER notifications, team member invitations, org admin welcome, assessment results ✅

* Cron endpoint for scheduled result notifications (GET /api/cron/send-results) with CRON\_SECRET authentication, 7-day delay after assessment completion, duplicate send prevention, and batch processing (20 per run) ✅

* **Pending:** Configurable email frequency (real-time, daily digest, weekly summary), saved search matching, 48-hour decision reminders

## **11.6 Training Readiness Report** ⏳ PENDING

Extends ACI’s value beyond the TA team to training and operations teams. For each candidate or cohort, generates a training needs analysis based on construct scores, recommended training program structure, expected time-to-competency benchmarks, and supervisor guidance for the first 90 days. This creates new internal champions beyond TA.

Build priority: Phase 3\. Effort: \~2 weeks. **Note:** Foundation data is available — predictions (ramp time, supervision load) and development recommendations in the IntelligenceReport provide partial coverage of this use case.

## **11.7 Adverse Impact Report** ⏳ PENDING

A basic adverse impact report showing pass rates by demographic group with 4/5ths rule calculation. This addresses Tasha’s primary adoption blocker (“Is this legally defensible?”). Assessment does not collect demographic data; adverse impact analysis uses customer-provided demographic data linked by candidate ID.

Build priority: Phase 2 (moved up from “out of scope” per persona analysis). Effort: \~1 week.

## **11.8 Cohort Analytics Dashboard** ⏳ PENDING

Provides the ROI narrative for budget expansion. Pipeline health metrics, funnel conversion rates by assessment scores, validation reports, and quality-of-hire correlation tracking. Includes exportable slides for Tasha’s leadership presentations.

Build priority: Phase 4\. Effort: \~3–4 weeks. **Note:** OutcomeRecord model is already in place for collecting post-hire data. The data export system (CSV/JSON) provides raw data for manual analysis in the interim.

# **12\. API Specification** ✅ IMPLEMENTED (23+ Route Handlers)

All endpoints require authentication (except access-request submission and assessment token routes). Payloads are filtered by RBAC role. Implemented in src/app/api/.

### **Assessment APIs** ✅

| Method | Path | Description | Status |
| :---- | :---- | :---- | :---- |
| POST | /api/assess/\[token\]/response | Submit individual item response (with timing). Rate limited: 60 req/min. | ✅ Live |
| POST | /api/assess/\[token\]/complete | Finalize assessment \+ trigger scoring pipeline (V1 or V2 based on version). Rate limited: 5 req/min. TOCTOU-protected. Retry with exponential backoff. | ✅ Live |
| POST | /api/assess/\[token\]/survey | Submit post-assessment experience survey | ✅ Live |
| POST | /api/assess/ai-probe | Generate AI follow-up probe question. BOLA-protected. Rate limited: 20 req/min. | ✅ Live |
| POST | /api/assess/\[token\]/chat | **V2:** Streaming chat endpoint. Validates token, loads/creates AssessmentState, runs classification + state machine, streams AI response via Vercel AI SDK. Rate limited: 30 req/min. Returns stream (agent message) or JSON (interactive element / transition / complete). | ✅ Live |

### **Candidate Management** ✅

| Method | Path | Description | Status |
| :---- | :---- | :---- | :---- |
| GET | /api/candidates | List (paginated, filterable by role, status, search, sort) | ✅ Live |
| POST | /api/candidates/\[id\]/notes | Add note to candidate | ✅ Live |
| POST | /api/candidates/\[id\]/outcomes | Record post-hire outcome data | ✅ Live |
| GET | /api/candidates/batch-status | Bulk status check for multiple candidates | ✅ Live |

### **Invitation Management** ✅

| Method | Path | Description | Status |
| :---- | :---- | :---- | :---- |
| POST | /api/invitations | Create single invitation \+ send email | ✅ Live |
| GET | /api/invitations | List invitations (filtered by org) | ✅ Live |
| POST | /api/invitations/batch | Batch CSV invite processing | ✅ Live |
| GET/POST | /api/invitations/\[id\] | Individual invitation management | ✅ Live |

### **Role Builder & Management** ✅

| Method | Path | Description | Status |
| :---- | :---- | :---- | :---- |
| POST | /api/roles/analyze | AI-powered role analysis (from JD or form input) | ✅ Live |
| POST | /api/roles | Create custom role with weights/cutlines | ✅ Live |
| GET/PUT | /api/roles/\[id\] | Retrieve/update role details | ✅ Live |
| POST | /api/roles/\[id\]/rationale | Generate/update research rationale | ✅ Live |
| GET | /api/roles/\[id\]/rationale/pdf | Export rationale as PDF | ✅ Live |

### **Export & PDF** ✅

| Method | Path | Description | Status |
| :---- | :---- | :---- | :---- |
| GET | /api/export/data?type=items\|constructs\|full&format=csv\|json | Data export (TA\_LEADER+) | ✅ Live |
| GET | /api/export/pdf/\[candidateId\] | Scorecard PDF | ✅ Live |
| GET | /api/export/pdf/\[candidateId\]/interview-kit | Interview guide PDF | ✅ Live |
| GET | /api/export/pdf/\[candidateId\]/one-pager | HM summary one-pager PDF | ✅ Live |

### **Access Control & Team Management** ✅

| Method | Path | Description | Status |
| :---- | :---- | :---- | :---- |
| POST | /api/access-requests | Submit access request (public, no auth required). Dual-path: without `orgId` creates platform request (admin reviews), with `orgId` creates org-scoped request (TA\_LEADER reviews). IP rate-limited (10/hr), email+orgId rate-limited (5/24hr). Input length validation. Org-scoped requests restricted to RECRUITER\_COORDINATOR role. | ✅ Live |
| GET | /api/access-requests | List platform-level pending requests (ADMIN only, filtered to `orgId: null`) | ✅ Live |
| PATCH | /api/access-requests/\[id\] | Approve/reject platform request (ADMIN only, creates Supabase account + Prisma User on approval, ActivityLog audit trail) | ✅ Live |
| PATCH | /api/team/access-requests/\[id\] | Approve/reject org-scoped request (TA\_LEADER+, org-isolated, `canAssignRole()` enforced, mandatory Supabase user creation, ActivityLog audit trail, rejectionReason capped at 1000 chars) | ✅ Live |
| PATCH | /api/team/\[userId\] | Modify team member role/status (TA\_LEADER+, peer-level guard, last-TA\_LEADER protection, hard Supabase ban/unban) | ✅ Live |
| POST | /api/team/invite | Create team invitation (TA\_LEADER+, `canAssignRole()` enforced, sends branded email with 7-day expiry) | ✅ Live |
| POST/DELETE | /api/team/invite/\[invitationId\] | Resend (rate-limited 5/hr, re-validates `canAssignRole()`) or revoke invitation (TA\_LEADER+) | ✅ Live |
| POST | /api/team/accept | Accept team invitation (public, rate-limited 10/min/IP, strong password policy, token validation, Supabase user creation, transactional) | ✅ Live |

### **Email & Notifications** ✅

| Method | Path | Description | Status |
| :---- | :---- | :---- | :---- |
| GET | /api/cron/send-results | Scheduled result notification emails (CRON\_SECRET auth, 7-day delay, duplicate prevention) | ✅ Live |
| POST | /api/email/results | Send result email to specific candidate | ✅ Live |
| GET | /api/notifications | Live notifications based on DB state, org-scoped. ADMIN sees platform-level pending access requests (orgId: null). Returns up to 20 notifications. | ✅ Live |

### **Pending API Endpoints**

| Method | Path | Description | Status |
| :---- | :---- | :---- | :---- |
| POST | /api/webhooks/assessment-complete | Outbound webhook to ATS | ⏳ Pending |

## **12.1 ATS Integration** ⏳ PENDING

* RESTful API for candidate data sync, assessment scheduling, results delivery

* Initial integrations: Greenhouse, Lever, custom ATS systems (Anduril and Hadrian may have bespoke systems)

* Bidirectional data flow: candidate moves from ATS to ACI for assessment, results flow back as structured data \+ PDF scorecard

* Webhooks: real-time notifications when assessment completed, when cutlines passed/failed

**Note:** The core API surface for candidate management, assessment delivery, and export is already operational. ATS integration requires building the webhook delivery system and partner-specific authentication flows.

## **12.2 Export Formats** ✅ IMPLEMENTED

* **PDF Scorecard** (PDFScorecard component): Multi-page branded document with layer scores, construct breakdowns, predictions, red flags, and notes ✅

* **PDF Interview Kit** (PDFInterviewKit component): Structured interview guide with behavioral talking points ✅

* **HM One-Pager** (PDFOnePager component): 1-page purpose-built PDF for hiring manager audience ✅

* **CSV/JSON Data Export** (ExportPanel component, /api/export/data): Three export types — items (item-level responses), constructs (construct-level scores), full (complete profiles with all scoring and predictions). TA\_LEADER+ access only. ✅

# **13\. Security, Compliance & Legal**

## **13.1 Data Protection** 🔶 MOSTLY IMPLEMENTED

* Encryption at rest (Supabase PostgreSQL) and in transit (HTTPS via Vercel) ✅

* Role-based access controls enforced at API layer (response payload filtering) and UI layer (component conditional rendering via src/lib/rbac.ts) ✅

* Field-level access gating per user role (5 tiers: RECRUITER\_COORDINATOR → ADMIN) ✅

* Multi-tenant organization scoping on all data queries (all 5 previously unauthenticated routes secured in v1.3; see Section 24.1) ✅

* Sentry error monitoring with real-time alerting (edge, server, and client instrumentation) ✅

* Activity logging via ActivityLog model for audit trail ✅

* Prompt injection prevention via input sanitization and field-level size limits on AI prompt inputs (see Section 24.2) ✅

* Cron endpoint secured with CRON\_SECRET Bearer token authentication (see Section 24.3) ✅

* External API calls protected with AbortController timeouts to prevent resource exhaustion (see Section 24.4) ✅

* Compound unique constraint on Candidate (email \+ orgId) prevents duplicate records ✅

* Duplicate email send prevention via resultsEmailSentAt tracking ✅

* In-memory sliding-window rate limiting on all assessment endpoints (src/lib/rate-limit.ts): chat 30/min, complete 5/min, response 60/min, ai-probe 20/min (v1.4) ✅

* Rate limiting on team management endpoints: invitation resend 5/hr/user, team accept 10/min/IP, access requests 10/hr/IP + 5/24hr per email+org (v1.7) ✅

* Peer-level modification guard: users cannot modify team members at or above their ROLE\_LEVEL (v1.7) ✅

* Last-TA\_LEADER demotion guard: prevents demoting the sole active TA\_LEADER in an org (v1.7) ✅

* Hard Supabase ban/unban on user deactivation/reactivation: ban failure blocks the operation (no silent failures) (v1.7) ✅

* `isActive` check in `getSession()`: deactivated users blocked even with valid Supabase sessions (v1.7) ✅

* HTML escaping (`escapeHtml()`) on all email templates receiving user input: prevents stored XSS via email (v1.7) ✅

* Input length validation on all public-facing form submissions: firstName/lastName 100 chars, companyName/jobTitle 200, reason 2000, rejectionReason 1000 (v1.7) ✅

* Mass assignment prevention: `supabaseId` removed from public access request POST body (v1.7) ✅

* Mandatory Supabase user creation on org-scoped approval: returns 500 if both invite and magiclink generation fail (no ghost accounts) (v1.7) ✅

* Org isolation on team access request approval: `accessRequest.orgId !== session.user.orgId` check prevents cross-org abuse (v1.7) ✅

* `canAssignRole()` enforced server-side on all role assignment paths: approval, invitation creation, invitation resend (v1.7) ✅

* Org-scoped access requests restricted to RECRUITER\_COORDINATOR role server-side (prevents role claim manipulation) (v1.7) ✅

* Strong password policy on team invitation accept: minimum 8 characters with uppercase, lowercase, and digit (v1.7) ✅

* ActivityLog audit trail on all approval/rejection flows (both platform admin and org-level) (v1.7) ✅

* BOLA prevention on AI probe endpoint — assessmentId and interactionId ownership verification against invitation's candidate (v1.4) ✅

* Optimistic concurrency control on AssessmentState updates using `updatedAt` as version field (v1.4) ✅

* TOCTOU protection on assessment completion — re-check inside database transaction prevents concurrent double-completion (v1.4) ✅

* Two-turn prompt injection prevention — conversation history sanitized (XML tags stripped, per-line truncation, total length cap) before inclusion in AI prompts (v1.4) ✅

* Element response validation — shape validation and field-level size limits on interactive element responses (v1.4) ✅

* Scoring pipeline retry — 3 attempts with exponential backoff (1s, 2s, 4s), candidate status set to ERROR on exhaustion (v1.4) ✅

* Concurrency-limited fan-out — max 6 parallel AI evaluation calls per construct via custom pLimit, prevents API rate limit exhaustion (v1.4) ✅

* **Pending:** SOC 2 Type II audit, GDPR/CCPA candidate consent workflows, data retention policy configuration

## **13.2 Assessment Integrity** ✅ IMPLEMENTED

* Token-based assessment authentication (no candidate account required) ✅

* AI probe endpoint now validates linkToken before processing requests (v1.3) ✅

* 7 automated response pattern integrity checks for V1 (see Section 8.4) ✅

* 12 automated integrity checks for V2 — original 7 adapted + 5 new conversational-specific (see Section 8.4) ✅

* Response timing analysis (speed-accuracy mismatch, random responding detection) ✅

* V2 triple-evaluation scoring with variance flagging detects AI evaluation instability ✅

* V2 consistency validation (Act 1 vs Act 3) detects coaching or gaming within a session ✅

* Full audit trail of all AI interactions and item responses logged in database ✅

* Invitation expiration (7-day default) with dedicated expiration screen ✅

* Domain-neutral item bank eliminates manufacturing familiarity bias (v1.3; see Section 22.6) ✅

* **Pending:** Physical proctored environment integration, photo ID verification

## **13.3 Legal Defensibility**

ACI is designed to comply with EEOC Uniform Guidelines on Employee Selection Procedures:

* Content Validity: each subtest designed in partnership with SMEs; job analysis reports linking subtests to critical job tasks

* Criterion-Related Validity: ongoing correlation studies (target: r \> 0.60 for predictive validity with 90-day performance ratings)

* Construct Validity: internal consistency (Cronbach’s α \> 0.80 per subtest), confirmatory factor analysis

* No demographic data collected: assessment focuses purely on job-relevant capabilities without collecting race, gender, age, or protected class status

* Job-relatedness documentation: clear linking of each subtest to specific job requirements and critical tasks

* ADA compliance: extended time, screen readers, alternative input methods for candidates with disabilities

## **13.4 Fair Assessment Design**

Assessment measures essential job functions, not peripheral capabilities. Content validated by diverse SME panels. Adverse impact analysis (Phase 2\) provides pass-rate reporting by demographic group with 4/5ths rule calculation using customer-provided demographic data.

# **14\. Success Metrics**

## **14.1 Product Adoption**

| Metric | Target | Timeframe |
| :---- | :---- | :---- |
| Assessment volume | 500+ candidates/month | Month 6 |
| Hiring pipeline integration | 95%+ external hires assessed before interview | Month 6 |
| Internal assessment adoption | 80%+ existing workforce assessed | Year 1 |
| Multi-location deployment | 3+ active assessment centers | Month 12 |
| Dashboard daily active users | 80% of recruiting team | Month 3 |

## **14.2 Hiring Efficiency**

| Metric | Target | Baseline |
| :---- | :---- | :---- |
| Time-to-hire reduction | 40% reduction | 38–40 day average (Hadrian) |
| Interview-to-offer ratio | \<3:1 | Currently 5:1+ |
| SME time savings | 60%+ reduction in HM evaluation hours | Current: SMEs evaluate every candidate |
| “Soft Yes/Soft No” elimination | \<10% indecisive outcomes | Currently 40%+ |
| Avg time to decision per candidate | \<3 minutes in dashboard | Currently requires extended debriefs |

## **14.3 Predictive Validity**

| Metric | Target |
| :---- | :---- |
| 90-day attrition (NAIB-screened hires) | \<8% |
| Time-to-productivity correlation (Learning Velocity vs. actual ramp) | r \> 0.65 |
| Performance rating alignment (Technical Aptitude Index vs. 6-month ratings) | r \> 0.60 |
| Supervision load prediction accuracy | 75%+ alignment with manager-reported actual |

## **14.4 Customer Success**

| Metric | Target |
| :---- | :---- |
| TA leader confidence (“ACI helps hire the right people at scale”) | 8+ on 10-point scale |
| Hiring manager satisfaction (“ACI reduces evaluation time”) | 85%+ agree |
| New manager enablement (“ACI gives me objective criteria”) | 90%+ agree (\<3 yr experience managers) |
| Customer renewal rate | 95%+ at 12 months |

## **14.5 Platform Performance**

| Metric | Target |
| :---- | :---- |
| Dashboard load time | \<1 sec for 100 candidates; \<2 sec for 500; \<5 sec for 2000+ |
| Profile load time | \<500ms summary view; \<1 sec full expanded |
| Search performance | \<300ms for any query |
| PDF generation | \<2 seconds for 5-page scorecard |

# **15\. Prioritized Build Recommendations**

## **15.1 The “Demo Day” Stack** ✅ ALL COMPLETE

All Demo Day features are live and operational:

| \# | Feature | Status | Notes |
| :---- | :---- | :---- | :---- |
| 1 | Dashboard with pipeline cards, candidate table, attention items, quick stats | ✅ Complete | EmptyState onboarding guide for new orgs also built |
| 2 | Candidate Profile with Intelligence Report | ✅ Complete | All 6 panels render: Work Style, Leadership, Practical Assessment, Team Dynamics, Self-Awareness, Onboarding Playbook |
| 3 | Spider Chart with Role Switcher | ✅ Complete | Interactive 12-point radar with layer colors and role switching |
| 4 | HM One-Pager PDF export | ✅ Complete | Available via /api/export/pdf/\[candidateId\]/one-pager |
| 5 | Role Mismatch Redirect | ✅ Complete | RoleMismatch component shows construct-level misalignment analysis |
| 6 | Interactive Demo \+ Tutorial | ✅ Complete | Full tutorial mode with demo org data at /tutorial/\* and /demo landing |

| Demo Narrative Reorder *Per Tasha’s discovery feedback: lead with Manufacturing Engineer and senior CNC Machinist profiles, not Factory Technician. Anduril is targeting 7+ year experienced candidates first. The entry-level story comes later.* |
| :---- |

## **15.2 The “Close the Deal” Stack** 🔶 MOSTLY COMPLETE

| \# | Feature | Phase | Status | Notes |
| :---- | :---- | :---- | :---- | :---- |
| 7 | Assessment Invitation Flow (single \+ batch CSV) | Phase 3 | ✅ Complete | Full flow: create candidate → generate token → send branded email → token-based assessment access |
| 8 | Weekly Pipeline Digest Email | Phase 2 | ⏳ Pending | Email infrastructure (Resend) ready; needs content generation \+ scheduling |
| 9 | Interview Prep Kit (profile section \+ PDF) | Phase 1 | ✅ Complete | InterviewGuide component \+ PDFInterviewKit \+ /api/export/pdf/\[id\]/interview-kit |
| 10 | Adverse Impact Report | Phase 2 | ⏳ Pending | Requires customer-provided demographic data integration |

## **15.3 The “Expansion” Stack** 🔶 PARTIALLY COMPLETE

| \# | Feature | Phase | Status | Notes |
| :---- | :---- | :---- | :---- | :---- |
| 11 | Training Readiness Report | Phase 3 | ⏳ Pending | Prediction data and development recommendations provide partial coverage |
| 12 | Cohort Analytics Dashboard | Phase 4 | ⏳ Pending | OutcomeRecord model ready for data collection; data export available for manual analysis |
| 13 | ATS Webhook \+ API | Phase 4 | ⏳ Pending | Core API surface operational; needs webhook delivery and ATS auth flows |
| 14 | Quality of Hire Correlation | Phase 4 | 🔶 Foundation Built | OutcomeRecord model tracks: training completion, ramp time, retention, supervisor rating, quality, safety, promotion |
| 15 | Custom Role Builder (AI-Powered) | Phase 2 | ✅ **Complete** | Three modes: JD upload (AI analysis), template clone, manual entry. O\*NET matching, research rationale, hiring intelligence brief. Full version control. JD context now persisted for domain-adaptive assessment (v1.3). |
| 16a | Domain-Adaptive Assessment Engine | Phase 2 | ✅ **Complete** | AI probes, narratives, and predictions contextualized by role domain. 13 items neutralized. See Section 22. |
| 16b | Generic Aptitude Assessment | Phase 2 | ✅ **Complete** | Equal-weight scoring path with cross-role fit rankings. See Section 23. |
| 17 | V2 Conversational Assessment Engine | Phase 5 | ✅ **Complete** | Three-act AI-conducted adaptive conversation, 3-layer scoring, chat UI with voice mode, 86-item bank, 12 red flag checks. See Section 26. |
| 18 | Spanish Language Support (instructions) | Phase 3 | ⏳ Pending | |

# **16\. Roadmap**

## **V1.0 — Initial Release (March 2026)** ✅ SHIPPED

* 12-construct assessment with 6-block adaptive structure, 5 item types, and AI-generated follow-up probes
* Dashboard with pipeline cards, candidate table, attention items, quick stats, and empty-state onboarding
* Candidate profile with Intelligence Report, spider chart, layer results, predictions, interview guide, notes, and outcome tracking
* Scoring engine with composite calculation, cutline evaluation, 7 red flag checks, and 4 prediction models
* AI-powered Role Builder with JD analysis, O\*NET matching, research rationale, and version control
* PDF exports: Scorecard, Interview Kit, HM One-Pager
* Data export: CSV/JSON for items, constructs, and full profiles (TA\_LEADER+)
* Assessment invitation system: single invite \+ batch CSV import with branded email delivery
* Access request workflow with admin approval and Supabase account provisioning
* 5-tier RBAC with field-level access control
* Interactive tutorial/demo mode with demo organization data
* Email system via Resend: invitations, access approvals/rejections, admin notifications, result notifications
* Post-assessment candidate survey
* Outcome tracking for post-hire validation (OutcomeRecord model)
* Sentry error monitoring (edge, server, client instrumentation)
* Role heatmap with candidate-construct matrix visualization
* Candidate comparison (2–3 side-by-side)
* Role mismatch analysis and role switching across all roles

## **V1.3 — Previous Release (March 2026)** ✅ SHIPPED

* **Domain-Adaptive Assessment Engine** — AI probes, narratives, and predictions are now role-contextualized using persisted JD data (see Section 22)
* **Generic Aptitude Assessment** — Equal-weight assessment path with cross-role fit rankings (see Section 23)
* **Item Bank Neutralization** — 13 manufacturing-specific items rewritten to domain-neutral equivalents (see Section 22.6)
* **Security Hardening** — 5 unauthenticated routes secured, prompt injection prevention, cron auth, API timeouts (see Section 24)
* **Scoring Pipeline Activation** — Critical bug fixed where scoring was never triggered on assessment completion (see Section 24.5)
* **Data Integrity** — Compound unique constraints, duplicate email prevention, assessment item math corrections (see Sections 22.7, 24)

## **V1.4 — Previous Release (March 2026)** ✅ SHIPPED

* **V2 Conversational Assessment Engine** — Three-act AI-conducted adaptive conversational investigation (90–120 min) as an alternative to the V1 6-block form-based assessment (see Section 26)
* **Three-Layer Scoring Pipeline** — Layer A (deterministic), Layer B (AI rubric with triple-evaluation), Layer C (ceiling characterization) (see Section 8.6)
* **Chat-Based Assessment UI** — Full-screen streaming chat interface with Vercel AI SDK, inline interactive elements, voice mode, session persistence (see Section 26.6)
* **86-Item Item Bank** — Calibrated items across 5 constructs with difficulty parameters (see Section 26.4)
* **Adaptive Investigation Algorithm** — Binary-search boundary mapping, pressure testing, diagnostic probing for ceiling characterization per construct (see Section 26.4)
* **12 Red Flag Checks** — 7 original + 5 conversational-specific (scenario disengagement, consistency failure, copy-paste detection, escalation avoidance, high-variance AI evaluation) (see Section 8.4)
* **Security Hardening** — Rate limiting on all assessment endpoints, BOLA prevention, optimistic concurrency, TOCTOU protection, prompt injection sanitization, pipeline retry with error state (see Section 13.1)
* **Observability** — Structured JSON logging, AI token/cost tracking per assessment, concurrency-limited fan-out
* **3 New Database Models** — ConversationMessage, AssessmentState, AIEvaluationRun (see Section 5.1)

## **V1.5 — Current Release (March 2026)** ✅ SHIPPED

* **V1 Assessment Removal** — Deleted V1 6-block form-based assessment entirely: components, routes, libraries, item bank, scoring pipeline, Zustand store, and AI probe API endpoint
* **Feature Flag & Version Enum Removal** — Removed `ASSESSMENT_V2_ENABLED` flag, `AssessmentVersion` enum (V1_BLOCKS/V2_CONVO), and `version` column from Assessment model; single assessment modality, no dispatch logic
* **Engine File Consolidation** — Moved all engine files from `src/lib/assessment/` to `src/lib/assessment/`; renamed V2-prefixed identifiers to clean names (AI_CONFIG, ASSESSMENT_STRUCTURE, ITEM_BANK, runScoringPipeline)
* **Email Template Simplification** — Removed V1/V2 conditional content; hardcoded conversational assessment copy
* **Welcome Page Hardening** — Assessment status check no longer gated by invitation status; prevents silent redirect loops for candidates with multiple invitations; visible error feedback on start failure
* **Start Route Hardening** — Returns structured error when candidate has completed assessment; top-level try/catch with server-side logging
* **Schema Migration** — Dropped `version` column and `AssessmentVersion` enum from production database

## **V1.6 — Previous Release (March 2026)** ✅ SHIPPED

* **Aria Assessment Experience** — Complete redesign of candidate-facing assessment: orb-centered, voice-first, single-screen stage interface replacing the chat-based UI
* **ElevenLabs TTS Voice** — Warm British female voice ("Aria") via ElevenLabs Flash v2.5 (~75ms latency), replacing browser-native SpeechSynthesis
* **Phase 0 — "The Handshake"** — Non-scored pre-assessment warmup with mic check
* **Nudge System** — Proactive re-engagement for silent candidates (15–30s thresholds)
* **Welcome Page Redesign** — Readiness checklist, mic pre-check, privacy disclosure
* See Section 26 for full specification

## **V1.7 — Current Release (March 2026)** ✅ SHIPPED

* **Org-Scoped Access Request Routing** — Dual-path onboarding: platform requests (admin review) and org-scoped requests (TA\_LEADER review via `/join/[orgSlug]`)
* **Team Management Security Hardening** — Peer-level modification guards, last-TA\_LEADER demotion protection, hard Supabase ban/unban, `canAssignRole()` enforcement on all role assignment paths
* **Auth Hardening** — `isActive` check in `getSession()`, `getAuthStatus()` email fallback for org-join requests, `/settings` middleware protection
* **Email Security** — `escapeHtml()` applied to all email templates with user input, new org access request notification template
* **Rate Limiting Expansion** — IP-based rate limiting on access requests (10/hr), invitation resend (5/hr), team accept (10/min/IP)
* **Input Validation & Mass Assignment Prevention** — Server-side field length limits, `supabaseId` removed from public POST body, org-scoped requests restricted to RECRUITER\_COORDINATOR
* **Mandatory Supabase User Creation** — Org-level approvals fail with 500 if Supabase auth creation fails (no ghost accounts)
* **Audit Trail** — `ActivityLog` entries on both platform and org-level approval/rejection flows
* **Admin Scoping** — Admin page and notifications filtered to `orgId: null` (platform requests only)
* **Signup Page Copy Update** — "Evaluate ACI for Your Organization" with guidance for existing org members
* See Sections 18, 24 for full specification

## **V1.8 — Next Priorities**

* Weekly Pipeline Digest Email (email infrastructure ready, needs content generation \+ cron scheduling)
* Adverse Impact Report (requires customer-provided demographic data integration)
* Shareable Hiring Manager link (no-login, token-authenticated, 72-hour expiry, mobile-first)
* HM Approval Actions (thumbs-up/thumbs-down/request-more-info from shareable link)
* Enhanced notification system (configurable frequency, saved search matching, 48-hour decision reminders)
* Scoring engine simulation \+ validation report (N=1,000 synthetic profiles)
* Psychometric validation functions (convergent validity, ICC, Cronbach's alpha, cross-scenario consistency)

## **V2.0 Scope**

* ATS integration (Greenhouse, Lever) with bidirectional webhooks
* Cohort analytics and quality-of-hire correlation dashboard
* Training Readiness Report (extends predictions to operations/training teams)
* Norming database with 10,000+ assessments for stable percentile rankings
* Physical assessment center deployment (Los Angeles, Ohio, Phoenix)
* Full IRT-based CAT with real-time θ estimation for V2 adaptive loops (replacing pre-calibrated difficulty parameters)

## **V3.0 Scope (Year 2\)**

* AI-generated Intelligence Reports (replacing template-driven content with Claude-generated narratives)

* Spanish language support for assessment instructions

* Mobile-native recruiter app (card-based dashboard, swipe actions, push notifications)

* Longitudinal validation studies: multi-year correlation of ACI scores with career progression, retention, and promotion rates

* Enterprise SSO and advanced admin controls

* Geographic expansion to 5+ assessment center locations

# **17\. Appendix: Mock Data & Demo Organization**

The platform includes a demo organization (Organization with isDemo=true) used for the tutorial/demo mode. Seeded candidates represent realistic assessment diversity:

| Profile Type | Count | Characteristics |
| :---- | :---- | :---- |
| Strong Fit (Clear Pass) | 8 | ≥75th percentile composite, no red flags. Status: RECOMMENDED |
| Conditional (Near Cutline) | 5 | Within 5 points of cutline, minor flags. Status: REVIEW\_REQUIRED |
| Not a Direct Fit | 4 | Below cutline. Status: DO\_NOT\_ADVANCE |
| Red Flag Present | 2 | Passes composite but has CRITICAL integrity flag. Status: DO\_NOT\_ADVANCE |
| In Progress | 3 | Assessment started but incomplete. Status: INCOMPLETE |
| Role Mismatch | 3 | Failed primary role but strong fit for alternative. Status: REVIEW\_REQUIRED |

Distributed across roles: \~5 per role. Each seeded candidate includes full SubtestResult for all 12 constructs, CompositeScore for all 5 roles (enables Role Switcher demo), Prediction record, RedFlag records where applicable, AIInteraction records (2–3 per construct with realistic mock Q\&A), Note records (1–2 per candidate from mock users), and realistic names, emails, and phone numbers.

# **18\. Access Request & User Onboarding Workflow** ✅ IMPLEMENTED (v1.2, expanded v1.7)

This feature addresses the enterprise access control requirement: "The signup page should say 'Request Access' not 'Create one.' Open self-signup undermines the premium enterprise positioning." As of v1.7, the system supports two distinct onboarding flows with org-scoped routing.

## **18.1 Flow A — New Company Inquiry (Platform-Level)**

1. Visitor navigates to /signup → sees "Evaluate ACI for Your Organization" form with guidance: "If your company already uses ACI, ask your team administrator for an invitation link."
2. Submits: first name, last name, email, company, role (RECRUITER\_COORDINATOR, RECRUITING\_MANAGER, HIRING\_MANAGER, TA\_LEADER)
3. System creates AccessRequest record with `orgId: null` (status: PENDING)
4. IP-based rate limit: 10 requests/hour. Input length validation enforced.
5. Admin notification email sent to ADMIN\_NOTIFICATION\_EMAIL (dani@arklight.us) via Resend
6. Visitor sees confirmation message

**Admin Approval (platform):**
1. Admin navigates to /admin (ADMIN role only) — sees only requests with `orgId: null`
2. Admin selects existing organization or creates new one
3. **Approve:** System creates Supabase Auth account via `generateLink` (invite or magiclink fallback) → creates User + Organization (if new) in Prisma transaction → sends setup email with 24-hour password-reset link → ActivityLog entry → AccessRequest status → APPROVED
4. **Reject:** Stores rejection reason (capped at 1000 chars) → sends rejection email with escaped reason → ActivityLog entry → AccessRequest status → REJECTED
5. Rejected users can resubmit with updated information

## **18.2 Flow B — Join Existing Organization (Org-Scoped)**

1. Visitor receives org-specific join URL (e.g., `/join/acme-industries`) from their team administrator
2. Server component validates org slug via database lookup; invalid slugs show generic "Invalid Link" error (prevents org enumeration)
3. Visitor submits: first name, last name, email, job title, reason (optional)
4. System creates AccessRequest record with `orgId` set, `requestedRole: RECRUITER_COORDINATOR` (hardcoded server-side)
5. Rate limits: IP-based 10/hr + email+orgId 5/24hr. Input length validation enforced.
6. Checks for existing active user in org (409 if exists), existing pending request (409 if exists), previously rejected request (allows resubmission by updating existing record)
7. Notification email sent to all active TA\_LEADERs in the organization via branded template

**TA\_LEADER Approval (org-scoped):**
1. TA\_LEADER navigates to /settings/team → sees "Access Requests" section with pending org-scoped requests
2. Table shows: name, email, job title, reason, date, approve/reject actions
3. Deactivated user detection: if a deactivated account with the same email exists in the org, a warning icon appears suggesting reactivation instead
4. **Approve dialog:** Role assignment dropdown populated by `getAssignableRoles()` based on approver's role. `canAssignRole()` enforced server-side — TA\_LEADERs can assign RC, RM, HM, TA\_LEADER (not ADMIN).
5. **Approve action:** Mandatory Supabase auth user creation via `generateLink` (invite, then magiclink fallback) — returns 500 if both fail (no ghost accounts). Prisma transaction creates User + marks request APPROVED. Sends approval email with setup link. ActivityLog entry.
6. **Reject action:** Optional reason (capped at 1000 chars, escaped in email). Sends rejection email. ActivityLog entry.
7. Org isolation: `accessRequest.orgId !== session.user.orgId` returns 404 (prevents cross-org abuse).

## **18.3 Flow C — Team Invitation (Direct)**

1. TA\_LEADER+ creates invitation from /settings/team → enters name, email, selects role
2. `canAssignRole()` validated; invitation created with 7-day expiry token
3. Branded email sent with accept link: `/join/[orgSlug]/accept?token=...`
4. Recipient clicks link → server validates token, expiry, and orgSlug match → shows accept form
5. Recipient enters name, creates password (strong policy: 8+ chars, uppercase, lowercase, digit)
6. System creates Supabase auth user with password → Prisma User in transaction → auto-signs in → redirects to /dashboard
7. Rate limited: accept endpoint 10/min/IP, resend 5/hr/user with `canAssignRole()` re-validation

## **18.4 Auth Flow**

* Four-tier auth status: unauthenticated → pending approval → rejected → approved
* `getAuthStatus()` checks supabaseId first, then falls back to email lookup (handles org-join requests without supabaseId)
* `getSession()` checks `user.isActive` — deactivated users blocked even with valid Supabase sessions
* Supabase Auth handles session management (email/password)
* Middleware (src/lib/supabase/middleware.ts) protects dashboard routes (/dashboard, /candidates, /roles, /compare, /export, /invitations, /settings), redirects unauthenticated to /login
* /update-password route for password setup after account creation
* /auth/callback for Supabase OAuth callback handling
* /forgot-password for self-service password reset

## **18.5 Team Management Security**

| Guard | Description | File |
| :---- | :---- | :---- |
| Peer-level modification | Users cannot modify team members at or above their ROLE\_LEVEL | src/app/api/team/\[userId\]/route.ts |
| Last-TA\_LEADER protection | Prevents demoting or deactivating the sole active TA\_LEADER in an org | src/app/api/team/\[userId\]/route.ts |
| Hard Supabase ban/unban | Deactivation/reactivation calls must succeed before Prisma update (no silent failures) | src/app/api/team/\[userId\]/route.ts |
| canAssignRole enforcement | All role assignment paths (approval, invitation, resend) validate the assigner has sufficient permissions | src/lib/rbac.ts |
| Org isolation | Org-scoped access request approval checks `accessRequest.orgId === session.user.orgId` | src/app/api/team/access-requests/\[id\]/route.ts |
| Mass assignment prevention | `supabaseId` not accepted from public POST body on access requests | src/app/api/access-requests/route.ts |
| Ghost account prevention | Org-level approval returns 500 if Supabase user creation fails (no null-supabaseId users) | src/app/api/team/access-requests/\[id\]/route.ts |

# **19\. AI-Powered Role Builder** ✅ IMPLEMENTED (New in v1.2)

Originally scoped as "Custom Role Builder" in Phase 2 (effort: ~2 weeks). The implemented version significantly exceeds the original specification with AI-powered analysis capabilities.

## **19.1 Three Creation Modes**

| Mode | Input | AI Processing |
| :---- | :---- | :---- |
| JD\_UPLOAD | Paste or upload job description text | AI extracts: title, level, technical skills, behavioral requirements, environment details, supervision model, error consequences, learning needs |
| TEMPLATE\_CLONE | Select existing role as starting template | Copies weights/cutlines for customization; inherits research rationale |
| MANUAL\_ENTRY | Form-based definition: title, responsibilities, environment, requirements | AI generates weights/cutlines from structured input |

## **19.2 AI Pipeline Output (src/lib/role-builder/pipeline.ts)**

* **Extracted Job Description:** Structured representation of role requirements
* **O\*NET Matching:** Auto-matches Bureau of Labor Statistics occupation codes (src/lib/onet/matcher.ts)
* **Generated Weights:** All 12 constructs, 0–100 scale, sums to 100, with research-backed derivation (src/lib/onet/weights.ts)
* **Cutlines:** Technical Aptitude, Behavioral Integrity, Learning Velocity percentile thresholds
* **Research Rationale:** Evidence-based explanation for every weight and cutline decision
* **Hiring Intelligence Brief:** Estimated pass rate, bottleneck construct, sourcing recommendations, comparison to system defaults
* **Complexity Level:** AUTO-classified as LOW, MEDIUM, MEDIUM\_HIGH, or HIGH

## **19.3 Version Control**

* RoleVersion model stores historical snapshots of weights, cutlines, and rationale
* Change tracking: who changed, when, and why
* API: POST /api/roles/\[id\]/rationale to regenerate rationale, GET /api/roles/\[id\]/rationale/pdf to export as PDF

## **19.4 Role Builder UI**

* InputClient — JD upload textarea, form entry, or template clone selector
* ReviewClient / ReviewShell — Weight/cutline review workflow before saving
* WeightVisualizer — Bar chart showing all 12 construct weights
* CutlineControls — Threshold adjustment sliders
* HiringIntelligenceBrief — AI-generated insights card
* ResearchRationale — Evidence documentation panel
* RoleSummaryCard — Key metadata display

# **20\. Email System** ✅ IMPLEMENTED (New in v1.2)

## **20.1 Infrastructure**

* **Primary:** Resend API (src/lib/email/resend.ts)
* **Fallback:** Nodemailer SMTP
* **Templates:** HTML-formatted with ACI branding (src/lib/email/templates/)

## **20.2 Email Templates**

All templates with user-controlled input apply `escapeHtml()` to prevent stored XSS in email clients (v1.7).

| Template | Trigger | Content | escapeHtml |
| :---- | :---- | :---- | :---- |
| Assessment Invitation | POST /api/invitations | Candidate name, role, company, assessment link, 7-day expiration, **"Before You Begin" section** (voice conversation format, quiet environment, microphone required, 60–90 min, Chrome/Edge/Safari recommended, headphones recommended, typing fallback available) | ✅ |
| Access Approved | Admin or TA\_LEADER approves access request | Welcome message \+ setup link (24-hour expiry) \+ login fallback link | ✅ |
| Access Rejected | Admin or TA\_LEADER rejects access request | Escaped rejection reason \+ resubmission guidance | ✅ |
| Access Request Notification (Platform) | New platform-level access request submitted | Admin notification with requester details \+ link to /admin | — |
| Org Access Request Notification | New org-scoped access request submitted | TA\_LEADER notification with requester name, email, job title, reason \+ link to /settings/team. Dark navy branded design matching ACI theme. | ✅ |
| Team Invitation | TA\_LEADER+ creates team invitation | Invitee name, role, org name, accept link (7-day expiry), role-specific description | ✅ |
| Org Admin Welcome | New organization created via platform admin approval | Welcome email to org admin with pre-configured roles and getting-started guidance | ✅ |
| Assessment Results | POST /api/email/results or /api/cron/send-results | Results summary \+ link to view full results | — |

# **21\. Monitoring & Error Tracking** ✅ IMPLEMENTED (New in v1.2)

* **Sentry** integration across three layers:
  * Client-side: instrumentation-client.ts
  * Server-side: sentry.server.config.ts \+ instrumentation.ts
  * Edge: sentry.edge.config.ts
* Global error boundary: src/app/global-error.tsx
* Real-time error tracking, alerting, and performance monitoring
* Source maps uploaded for readable stack traces in production

# **22\. Domain-Adaptive Assessment Engine** ✅ IMPLEMENTED (New in v1.3)

The entire assessment pipeline is now role-aware. Previously, AI probes generated follow-up questions with zero role context, narratives were canned templates, predictions used generic formulas, and 13 of 24 items contained manufacturing-specific language. The extracted JD data (environment, technical skills, key tasks, error consequences) was discarded after the Role Builder flow. This system makes every stage of assessment delivery and scoring role-contextualized.

## **22.1 JD Context Persistence**

When a role is created via the Role Builder, the full extracted JD data is now persisted as a `jdContext` JSON field on the Role model. This includes: environment (setting, physical demands, shift work), technical skills, key tasks, consequence of error (safety-critical, quality-critical, cost impact), supervision model, and learning requirements. Size-validated at 10KB maximum to prevent abuse.

**Files:** `prisma/schema.prisma` (jdContext field), `src/app/api/roles/route.ts` (save on creation), `src/components/role-builder/review-client.tsx` (pass extracted data to API).

## **22.2 Role Context Provider**

A central `getRoleContext(roleId)` function (src/lib/assessment/role-context.ts) loads structured role domain context from persisted JD data. Returns a `RoleContext` interface containing: roleName, domain, technicalSkills, keyTasks, consequenceOfError, environment, and isGeneric flag. Falls back to a domain-neutral default when jdContext is null or the role is generic.

All fields are sanitized before use in AI prompts: control characters stripped, length limits enforced (200 chars per field, 10 items per array), preventing prompt injection through stored JD data.

## **22.3 Domain-Adaptive AI Probes**

AI follow-up probe generation and analysis (src/app/api/assess/ai-probe/route.ts) now receive full role context:

* **Generation prompt** includes: role name, domain environment, key tasks, technical skills, and the construct being measured. This produces follow-up questions that are relevant to the candidate's actual role domain (e.g., "How would you handle a toolpath collision in a 5-axis setup?" for a CAM Programmer instead of generic "Walk me through your approach").

* **Analysis prompt** includes: role context for more accurate evidence evaluation against domain-specific expectations.

* **Backward compatible:** When roleContext is null or isGeneric is true, prompts remain domain-neutral (identical to v1.2 behavior).

* **Timeout protection:** All Anthropic API calls use AbortController with 15-second timeout to prevent hanging assessment sessions.

## **22.4 Contextualized Narratives**

Narrative insights per construct (src/lib/assessment/narratives.ts) now accept optional role context. When a non-generic role context is available, narratives append a role-contextualized sentence referencing key tasks and environment. Example: base template "Demonstrates strong fluid reasoning…" + contextual addition "…which is critical for CAM Programmer roles involving complex toolpath optimization."

## **22.5 Contextualized Predictions**

Prediction descriptions (src/lib/predictions.ts) are enriched with role-specific context when available:
* Ramp time: "…in the ${environment} environment"
* Supervision: "…given ${roleName} responsibilities"
* Performance ceiling: "…relative to ${roleName} growth trajectory"
* Attrition risk: "…in ${domain} roles"

Numerical calculations remain unchanged — only human-readable descriptions are enriched.

## **22.6 Item Bank Neutralization**

13 of 24 assessment items contained manufacturing-specific language that created unfair domain familiarity bias. All have been rewritten to domain-neutral equivalents while preserving identical construct validity and cognitive load:

| Item ID | Original Domain | Neutralized Domain | Construct |
| :---- | :---- | :---- | :---- |
| fr-002 | Factory units output | Business/logistics scenario | Fluid Reasoning |
| qr-001 | Part tolerance measurement | Data accuracy/precision | Quantitative Reasoning |
| qr-002 | CNC mill RPM calculation | Server processing throughput | Quantitative Reasoning |
| mr-001 | Gear train ratios | Proportional business metrics | Mechanical Reasoning |
| sd-001 | Production line stations | Workflow/process sequence | Systems Diagnostics |
| sd-002 | Hydraulic press cycles | System utilization pattern | Systems Diagnostics |
| pr-002 | Shift defect data | Project/team performance data | Pattern Recognition |
| cf-001 | Manufacturing process change | Business process change | Cognitive Flexibility |
| lv-001 | CNC control system | New software/system onboarding | Learning Velocity |
| prr-002 | Batch parts inspection | Batch data validation | Procedural Reliability |
| ej-001 | Quality report sign-off | Report/deliverable sign-off | Ethical Judgment |
| int-002 | Machine A vs B | Vendor A vs B business decision | Integration |
| int-004 | Three machines producing widgets | Three teams/systems producing output | Integration |

**Constraint:** Each rewrite tests the same construct with equivalent cognitive load. Mathematical/logical structure is identical; only the domain wrapper changed.

## **22.7 Assessment Item Math Corrections**

Two items had incorrect correct answers that would cause correctly-reasoning candidates to score 0:

* **int-002:** Vendor comparison math was wrong. Corrected: Vendor A total = $150K, Vendor B total = $165K. Answer changed to "Vendor A saves $15,000 over Vendor B."
* **int-004:** Bayesian probability calculation was wrong. Corrected: P(Y|escalated) = 0.0175/0.0345 ≈ 50.7%. Answer changed to "50.7%."
* **qr-002:** Ambiguous wording ("server handles 3,500 requests per second across 4 threads") could be interpreted as total or per-thread. Clarified to "4 processing threads, each independently handling 3,500 requests per second."

## **22.8 Role Context Threading**

The roleId is threaded through the entire assessment session:

1. `assessment-store.ts` — roleId added to Zustand state
2. `assessment-shell.tsx` — accepts roleId prop, passes to store
3. `block/[blockIndex]/page.tsx` — includes role in invitation query, passes to shell
4. `ai-probe.tsx` — reads roleId from store, includes in API call body
5. `ai-probe/route.ts` — loads role context, injects into prompts
6. `pipeline.ts` — loads role context for narratives and predictions

# **23\. Generic Aptitude Assessment** ✅ IMPLEMENTED (New in v1.3)

A new assessment path for candidates not tied to a specific role. Measures general cognitive and behavioral aptitude across all 12 constructs with equal weighting, then computes cross-role fit rankings showing how the candidate's profile maps to every role in the organization.

## **23.1 Generic Aptitude Role**

A system-level "Generic Aptitude" role is created per organization with:
* **Equal weights:** ~8.33 per construct (100/12), ensuring no construct is favored
* **Moderate cutlines:** 25th percentile across Technical Aptitude, Behavioral Integrity, Learning Velocity, and overall minimum
* **isGeneric flag:** Triggers domain-neutral behavior throughout the assessment pipeline (no role-specific AI probes, narratives, or predictions)

## **23.2 Invitation Flow**

* In the invite sheet, the Generic Aptitude role appears first in the role selector
* When selected, a disclaimer card displays: "This assessment measures general cognitive and behavioral aptitude without role-specific context. Results can be compared across roles."
* Batch CSV import defaults to the generic role when `role_slug` is empty

## **23.3 Cross-Role Fit Rankings**

When a candidate is assessed with the generic role, the scoring pipeline (src/lib/assessment/pipeline.ts) computes composite scores for every non-generic role in the organization using that role's weights and cutlines. Results are persisted as CompositeScore records (one per role) and displayed in the candidate profile as a ranked list showing:
* Role name and composite score
* Pass/fail status against each role's cutlines
* Distance from cutline
* Fit indicator (Strong Fit, Conditional, Not a Direct Fit)

This enables talent redirection: a candidate assessed generically can be immediately identified as a strong fit for specific roles they weren't originally considered for.

## **23.4 Implementation**

| File | Purpose |
| :---- | :---- |
| `src/lib/assessment/role-fit-rankings.ts` | Cross-role composite scoring engine |
| `src/lib/assessment/pipeline.ts` | Wires rankings into scoring pipeline for generic roles |
| `src/components/profile/role-fit-rankings.tsx` | Rankings display component |
| `src/components/profile/profile-client.tsx` | Renders rankings section for generic assessments |
| `src/components/invitation/invite-candidate-sheet.tsx` | Generic role option in invite flow |
| `src/app/api/invitations/batch/route.ts` | Defaults to generic role when slug empty |
| `prisma/seed.ts` | Seeds generic role with equal weights and cutlines |

# **24\. Security Hardening** ✅ IMPLEMENTED (New in v1.3)

## **24.1 API Authentication Gaps Closed**

Five API routes were identified as having no authentication or authorization checks. All have been secured:

| Route | Fix |
| :---- | :---- |
| GET /api/candidates | Added session auth + org-scoped queries + sortBy field allowlist + pageSize cap (100) |
| PATCH /api/candidates/batch-status | Added session auth + org-scoped updateMany |
| POST /api/candidates/\[id\]/notes | Added session auth + candidate org verification + authorId derived from session (not client) |
| PATCH/DELETE /api/notes/\[id\] | Added session auth + note org verification via candidate relationship |
| POST /api/assess/ai-probe | Added token-based auth via linkToken validation (candidate-facing route) |

## **24.2 Prompt Injection Prevention**

JD context data flows from user input → database → AI prompts. To prevent stored prompt injection:
* `sanitizeForPrompt()` strips control characters and enforces per-field length limits (200 chars)
* `sanitizeStringArray()` caps array items (10 max) and sanitizes each element
* `jdContext` payload validated at 10KB maximum on the roles API
* All fields are sanitized on read from database before inclusion in any AI prompt

## **24.3 Cron Endpoint Security**

The `/api/cron/send-results` endpoint now requires `Authorization: Bearer ${CRON_SECRET}` header authentication. The `CRON_SECRET` environment variable is set on Vercel. The endpoint also filters by `resultsEmailSentAt: null` to prevent duplicate email sends and updates this field after successful delivery.

## **24.4 External API Timeouts**

All outbound calls to the Anthropic API use AbortController with explicit timeouts:
* AI probe generation/analysis: 15-second timeout
* Role Builder pipeline (callClaude): 30-second timeout

This prevents assessment sessions from hanging indefinitely if the AI provider is slow or unresponsive.

## **24.5 Scoring Pipeline Activation**

**Critical bug fixed:** `runScoringPipeline()` was fully implemented and exported from `src/lib/assessment/pipeline.ts` but was never imported or called from the assessment completion endpoint (`POST /api/assess/[token]/complete`). This meant every completed assessment would remain stuck in SCORING status indefinitely with no scores, predictions, red flags, or status determination. The pipeline is now called as a fire-and-forget after the completion transaction, with error logging on failure.

# **25\. Implementation Statistics (As of March 2026)**

| Metric | Count |
| :---- | :---- |
| API Route Handlers | 27+ (ai-probe removed in v1.5; team management + org access requests added in v1.7) |
| Page Routes | 33+ (V1 block routes removed in v1.5; /join/\[orgSlug\], /settings/team added in v1.7) |
| Database Models (Prisma) | 23 (19 original + 3 V2 models + TeamInvitation) |
| Assessment Constructs | 12 |
| Assessment Modalities | 1 (3-act conversational with Aria voice agent; chat UI replaced by orb stage in v1.6) |
| Interactive Element Types | 6 (Text Response, Multiple Choice Inline, Numeric Input, Timed Challenge, Confidence Rating, Tradeoff Selection) |
| Item Bank | 86 items across 5 constructs (calibrated with difficulty parameters) |
| Scenario Shells | 4 (6 beats each = 24 scenario encounters) |
| Construct Rubrics | 12 (3–5 behavioral indicators each) |
| User Roles (RBAC) | 5 |
| Red Flag Checks | 12 (7 original + 5 conversational-specific) |
| Scoring Layers | 3 (Layer A: deterministic, Layer B: AI rubric, Layer C: ceiling characterization) |
| Ceiling Types | 5 (Hard, Soft Trainable, Soft Context-Dependent, Stress-Induced, Insufficient Data) |
| Prediction Models | 4 |
| PDF Export Types | 3 |
| Email Templates | 8 (invitation, access-approved, access-rejected, access-request-notification, org-access-request-notification, team-invite, org-admin-welcome, results) |
| Zustand Stores | 2 (assessment-store with orb/TTS/nudge state, app-store) |
| Library Files | 55+ (engine files consolidated in src/lib/assessment/) |
| UI Components | 30+ (orb, stage, interactive, voice, background components in src/components/assessment/) |
| Total Source Components | 130+ (V1 components removed in v1.5) |
| npm Dependencies (prod) | 37 (ai, @ai-sdk/anthropic) |
| npm Dependencies (dev) | 8 |
| Authenticated API Routes | 22+/22+ (all routes authenticated) |
| Rate-Limited Endpoints | 7 (chat: 30/min, complete: 5/min, response: 60/min, access-requests: 10/hr/IP + 5/24hr per email+org, team-accept: 10/min/IP, invite-resend: 5/hr/user, TTS: 60/min) |
| Domain-Neutral Items | 86/86 |


# **26\. Aria Assessment Experience** (Redesigned in v1.6, sole modality)

The assessment is conducted by **Aria**, a named AI evaluator with a warm British female voice. Aria guides the candidate through a three-act adaptive investigation lasting 60–90 minutes via an orb-centered, voice-first stage interface. The candidate interacts by speaking (primary) or typing (fallback). There is no chat interface, no scrolling message history, no chat bubbles. The orb IS the interface — a fluid, animated presence that speaks, listens, and breathes.

The 12-construct model, composite scoring, cutlines, status determination, dashboard, profiles, exports, RBAC, and all downstream systems remain unchanged. Only the candidate-facing experience layer has changed.

| The Experience Principle *The candidate should forget they are being assessed and feel like they are having a conversation with a thoughtful, warm evaluator who is genuinely curious about how they think. If the candidate is anxious, confused, or disengaged, the data is garbage. The experience IS the measurement instrument.* |
| :---- |

## **26.1 Aria — The AI Evaluator**

### **Identity**
- **Name:** Aria (spoken during Phase 0 introduction, not displayed as a UI label)
- **Voice:** British female, warm, caring, human. Calm and composed — not clinical, not overly enthusiastic. The candidate should feel like they're speaking with an intelligent person who puts them at ease.
- **Voice Engine:** ElevenLabs TTS API, Flash v2.5 model (`eleven_flash_v2_5`), ~75ms latency
- **Voice ID:** Stored in `ELEVENLABS_VOICE_ID` environment variable (auditioned and selected from ElevenLabs library — British female, warm/professional/narration-style)
- **Visual Presence:** Canvas-rendered fluid sphere (the "orb") — NOT a CSS circle. Organic displacement animation with multiple layers, specular highlight, ambient glow. States: idle (gentle breathing), speaking (dynamic displacement + energy wisps, synced to audio amplitude), listening (green shift, responsive breathing), processing (muted, subtle)

### **Behavioral Guidelines**
- Aria always speaks first. The candidate never has to "go first."
- Aria never repeats a question verbatim when nudging — she addresses the silence supportively.
- Aria never says "correct" or "incorrect" during Act 1 scenarios. She adapts difficulty through branching, not explicit feedback.
- Aria acknowledges difficulty without being patronizing: "Those timed ones can be intense" not "That was a hard one, don't worry."
- Aria's tone shifts subtly across acts: curious and engaged in Act 1, focused and encouraging in Act 2, warm and reflective in Act 3.
- Between scenarios in Act 1, Aria provides brief conversational transitions, not UI break screens: "That was a rich situation. Let's move into something different."

## **26.2 Assessment Timeline**

| Phase | Duration | Interactions | Constructs | Scored? |
|-------|----------|-------------|------------|---------|
| Phase 0 — The Handshake | ~60 sec | 3 Aria segments + 1 candidate mic check | None | No |
| Act 1 — Scenario Gauntlet | ~40–50 min | 4 scenarios × 6 beats = 24 conversational exchanges | Systems Diagnostics, Fluid Reasoning, Cognitive Flexibility, Learning Velocity, Executive Control, Ethical Judgment, Procedural Reliability, Metacognitive Calibration | Yes (Layer B) |
| Act 2 — Precision Gauntlet | ~30–40 min | 35–55 structured items + 15–30 voice probes + 5–15 diagnostic probes | Quantitative Reasoning, Spatial Visualization, Mechanical Reasoning, Pattern Recognition, Fluid Reasoning | Yes (Layer A + B + C) |
| Act 3 — Calibration | ~10–15 min | 2–3 confidence items + 1–2 parallel scenarios + 1 reflective self-assessment | Cross-cutting validation + Metacognitive Calibration | Yes (Layer A + B) |
| **Total** | **~60–90 min** | **~100–130 interactions** | **All 12 constructs** | |

### **State Machine**

```
PHASE_0 → Introduction → Format Orientation → Mic Check → Mic Validation
  ↓
ACT_1 → Scenario 0 → Beats 0–5 → Scenario 1 → ... → Scenario 3 → Beat 5
  ↓
ACT_2 → QUANT_REASONING → 4 phases → SPATIAL_VIZ → ... → FLUID_REASONING
  ↓
ACT_3 → Confidence Items → Parallel Scenarios → Self-Assessment
  ↓
COMPLETE
```

## **26.3 Pre-Assessment: Email & Welcome Page**

### **Assessment Invitation Email**

Must include a "Before You Begin" section after the assessment link:
- This assessment is conducted as a **voice conversation** with an AI evaluator named Aria
- Find a quiet space with a working microphone
- Allow 60–90 minutes of uninterrupted time
- Use Chrome, Edge, or Safari on desktop/laptop
- Headphones recommended
- Typing fallback available

### **Welcome Page** (src/components/assess/welcome-screen.tsx)

Redesigned with dark navy aesthetic matching the assessment interface. Content:
- Role name + company name
- "What to Expect" — conversation with Aria, ~60–90 minutes
- Readiness checklist: quiet environment (✓), microphone access (✓ with [Test Mic] button), time available (✓), headphones (recommended)
- **Microphone pre-check:** Requests browser permission, captures 2 seconds of audio, shows level indicator, confirms working or shows troubleshooting. Does NOT block assessment if mic check fails.
- Privacy disclosure: "Your responses — spoken and typed — will be recorded, transcribed, and evaluated. Audio is processed in real-time and not stored after transcription. Results are shared only with the hiring team at [Company Name]."
- [Begin Assessment →] button

## **26.4 Phase 0 — The Handshake**

**Duration:** ~60 seconds. **Scored:** No. Messages stored with `act: PHASE_0`, excluded from all scoring pipelines.

**Purpose:** Agent initiates contact (candidate never goes first), format orientation, microphone validation, psychological safety.

### **Screen State During Phase 0**
- Orb: full size (200px), center screen, enters in speaking state immediately
- Progress bar: **hidden** (appears only when Act 1 begins)
- Act label: **hidden**
- Subtitles: visible below orb
- Mic button: hidden until Segment 3

### **Sequence**

**Segment 1 — Introduction (~8 sec):** "Hello, and welcome. My name is Aria, and I'll be guiding you through your assessment today. It's good to have you here."

**Segment 2 — Format Orientation (~15 sec):** "This will take about 60 to 90 minutes. I'll walk you through some scenarios and problems — and you'll respond by speaking. I'll also give you some questions you can answer by tapping on screen. There are no trick questions, and there's no single right answer to most of what we'll discuss."

**Segment 3 — Mic Check (~8 sec + candidate response):** "Before we begin, let's make sure I can hear you clearly. Tap the microphone button and tell me — what role are you here for today?" → Mic button appears. Candidate speaks. Orb enters listening state.

**Segment 4 — Confirmation (~4 sec):** "Perfect, I can hear you. Let's get started." → Progress bar fades in. Act label appears. Transition to Act 1.

### **Mic Check Failure Handling**
- No audio after 10s → Aria offers text fallback
- Candidate types → Aria acknowledges, assessment continues voice-out/text-in
- No interaction after 30s → Aria gently nudges, shows both mic and text input

### **Phase 0 Rules**
- NOT skippable. Every candidate goes through it.
- On session resume: if Phase 0 complete, skip to last position; if not, restart Phase 0.

### **Database Changes**
- Add `PHASE_0` to act enum
- Add `phase0Complete Boolean @default(false)` to AssessmentState
- Scoring pipeline queries: `WHERE act != 'PHASE_0'`

## **26.5 Act 1 — The Scenario Gauntlet**

**Duration:** ~40–50 min. **Input mode:** Voice only (text fallback via nudge system).

Four domain-neutral scenarios, each with 6 beats. Aria presents a scenario, the candidate responds by speaking, the response is classified as STRONG / ADEQUATE / WEAK via triple-evaluation, and the next beat branches accordingly. Strong performers face escalated challenges; weak performers receive scaffolding.

### **Screen State**
- Orb: full size (200px), center screen
- Progress bar: visible, Act 1 segment filling
- Act label: "THE SCENARIO GAUNTLET" (JetBrains Mono, 9px, --aci-gold at 60% opacity)
- Subtitles: Aria's words below orb, word-by-word reveal
- Mic button: visible at bottom when candidate's turn
- Interactive elements: **none** (Act 1 is entirely conversational)
- No chat bubbles. No message history. Only the current exchange exists on screen.

### **Scenario Library** (unchanged from v1.5)

| Scenario | Name | Primary Constructs |
| :---- | :---- | :---- |
| 1 | Escalating System Failure | Systems Diagnostics, Fluid Reasoning, Cognitive Flexibility, Learning Velocity |
| 2 | Integrity Pressure Cooker | Ethical Judgment, Procedural Reliability, Executive Control |
| 3 | Learning Gauntlet | Learning Velocity, Cognitive Flexibility, Pattern Recognition |
| 4 | Prioritization Crisis | Executive Control, Systems Diagnostics, Metacognitive Calibration, Ethical Judgment |

### **Beat Structure** (6 beats per scenario, unchanged from v1.5)

| Beat | Type | Purpose | What Aria Does |
| :---- | :---- | :---- | :---- |
| 0 | INITIAL\_SITUATION | Sets the scene; observes initial approach | Narrates scenario, poses open question. Orb: speaking → idle. Mic activates. |
| 1 | INITIAL\_RESPONSE | First decision point; measures primary construct | Branches based on Beat 0 classification: STRONG → escalates, ADEQUATE → maintains, WEAK → scaffolds |
| 2 | COMPLICATION | Introduces complexity; tests adaptability | Adds unexpected new information. "While you're investigating, a second alert fires..." |
| 3 | SOCIAL\_PRESSURE | Adds interpersonal dynamics; tests integrity and judgment | Introduces a person who pressures the candidate. "A senior colleague walks over and says..." |
| 4 | CONSEQUENCE\_REVEAL | Shows impact of decisions; tests reflective capacity | Reveals outcome of candidate's choices. "It turns out your approach [was effective / didn't work]..." |
| 5 | REFLECTIVE\_SYNTHESIS | Candidate reflects on approach; measures metacognition | Direct reflection: "Looking back at this whole situation, what did you learn about how you approach unfamiliar problems?" |

### **Between Scenarios**
Aria provides a brief conversational breath: "That was a rich situation. Let's move into something different." No UI change. No break screen. The candidate shouldn't feel block boundaries.

### **Response Classification** (unchanged from v1.5)
Each response classified by Claude Haiku with triple-evaluation. 3 parallel calls, median selected. Falls back to ADEQUATE if AI unavailable.

### **Domain Adaptation** (unchanged from v1.5)
When role JD context is available, Claude Sonnet adapts scenario surface content to the candidate's domain while preserving structural properties.

### **Act 1 Data Captured**
- 24 conversational transcripts (full text from speech-to-text)
- 24 STRONG/ADEQUATE/WEAK classifications (triple-evaluated)
- 24 response times (ms from mic activation to speech start + total duration)
- 24 word counts (red flag input: avg < 20 words = scenario disengagement)
- 4 branch paths (array of classifications per scenario)

## **26.6 Act 1 → Act 2 Transition**

Cinematic and agent-narrated. The space morphs as Aria speaks (~15–20 seconds):

1. Aria: "You handled those scenarios well. Now we're going to shift gears."
2. Orb begins compressing (200px → 72px, 2s cinematic ease)
3. Aria: "I'm going to present you with a series of problems — some timed, some not."
4. Act label fades out, then "THE PRECISION GAUNTLET" fades in
5. Aria: "Take your time where you can."
6. First interactive element fades in center-screen

## **26.7 Act 2 — The Precision Gauntlet**

**Duration:** ~30–40 min. **Input mode:** Tap for structured items. Voice or text (candidate's choice) for follow-up probes.

Five constructs measured through adaptive investigation loops, each following a 4-phase algorithm. The candidate experiences a rhythm: items (tap) → voice probe → items (tap) → conversation about their ceiling → "let's move on" → repeat.

### **Screen State**
- Orb: compact (72px), top of stage. Expands to ~100–120px during voice probes. Returns to 72px for next items.
- Progress bar: visible, Act 2 segment filling
- Act label: "THE PRECISION GAUNTLET"
- Subtitles: Aria's words below compact orb
- Interactive elements: center of screen (choice cards, numeric input, timed challenges)
- Mic button: appears during follow-up probes
- Input mode toggle: "Voice / Type" pills appear after first follow-up probe

### **Per-Construct Adaptive Loop** (4 phases, repeated for each of 5 constructs)

**Phase 1: Calibration** (2–3 items, ~2–3 min)
- Serve 1 easy (difficulty 0.0–0.3), 1 medium (0.4–0.6), 1 hard (0.7–1.0) item
- Compute rough ability placement
- Aria introduces briefly: "Here's your first problem" (first construct) or "Okay, next section" (subsequent)
- After 3rd item: 1 voice probe — "How are you finding these so far?" (metacognitive check, stored but not ability-scored)

**Phase 2: Boundary Mapping** (3–5 items, ~4–6 min)
- Binary search from both sides of detected boundary
- Items flow continuously. Aria may say brief connectors: "Okay, next one."
- Narrows until boundary is pinpointed within ±0.1 on difficulty scale
- **Ceiling defined as:** the difficulty level where candidate accuracy drops below 50%
- After boundary identified: 1 voice probe — "That last one was tougher. Walk me through how you approached it." (Scored via Layer B — reveals reasoning at boundary)
- Orb expands slightly during voice probe (~100px), returns to 72px for next items

**Phase 3: Pressure Test** (2–3 items, ~2–3 min)
- Items at boundary difficulty but from a DIFFERENT sub-type within the same construct
- May include 1 timed challenge (30-second countdown, color transitions blue → amber → red)
- **Confirms ceiling is real** (not artifact of item-specific knowledge)
- If pressure test contradicts boundary (candidate passes items they "shouldn't"): 1 additional item to resolve
- Outcome: CONFIRMED / CONTRADICTED / INCONCLUSIVE
- If timed challenge used: optional voice probe — "How did the time pressure affect your approach?"

**Phase 4: Diagnostic Probe** (1–3 conversational exchanges, ~3–5 min)
- **Triggered only after ceiling is confirmed** by Phases 2–3
- Orb expands to ~120px. Interactive elements disappear. Conversational mode.
- AI generates targeted probes based on the specific ceiling detected. NOT generic.

**Diagnostic probe selection logic** — which probe Aria asks depends on the data:

| Signal in Data | Probe Aria Asks First | What It Tests |
|---|---|---|
| Response timing spiked near ceiling (candidate slowed dramatically) | Stress probe: "Do you think the time pressure changed how you performed, or would you have gotten those same ones wrong with unlimited time?" | Stress-induced vs. competence-limited |
| Failed items across multiple sub-types | Generalization probe: "You did well on the data problems but hit a wall on the abstract equations. Does that track with your experience?" | Domain-specific vs. general limitation |
| Failed only in one sub-type, passed others at same difficulty | Scaffold probe: "Let me show you that problem a different way. [Re-presents with scaffold.] Does thinking about it this way change your answer?" | Hard ceiling vs. soft/trainable ceiling |
| No clear signal | Default: hard vs. soft ceiling probe | Can the candidate solve it with more time or a different representation? |

**Stopping rules** (whichever triggers first):

| Rule | Condition | Action |
|---|---|---|
| Confident classification | Evidence strength ≥ 0.7 after any probe | Stop probing, classify ceiling |
| Maximum probes reached | 3 conversational exchanges for this construct | Stop probing, classify with available data (INSUFFICIENT_DATA if still ambiguous) |
| Candidate disengagement | Response < 15 words to probe questions | Stop probing, classify with available data, feeds into disengagement red flag |

**Ceiling type classification output:**

| Ceiling Type | Meaning | Training Implication | Supervision Implication |
|---|---|---|---|
| HARD\_CEILING | Fundamental ability limitation | LOW — training unlikely to close gap | Structured support needed |
| SOFT\_CEILING\_TRAINABLE | Gap closable with practice | HIGH — targeted training recommended | Standard with development plan |
| SOFT\_CEILING\_CONTEXT\_DEPENDENT | Performance varies by task context | MEDIUM — monitor across contexts | May excel in some but not others |
| STRESS\_INDUCED | Fatigue/pressure degraded performance | MEDIUM — reduce time pressure | Calm working conditions preferred |
| INSUFFICIENT\_DATA | Not enough probe data to classify | LOW — cannot determine | Standard supervision appropriate |

**After Phase 4:** Aria transitions — "Good. Let's move to something different." Orb returns to 72px. Next construct begins.

### **V2 Item Bank** (unchanged from v1.5 — src/lib/assessment/item-bank.ts, 86 items)

| Construct | Easy | Medium | Hard | Total |
| :---- | :---- | :---- | :---- | :---- |
| Quantitative Reasoning | 5 | 8 | 7 | 20 |
| Spatial Visualization | 4 | 7 | 7 | 18 |
| Mechanical Reasoning | 4 | 6 | 5 | 15 |
| Pattern Recognition | 4 | 7 | 7 | 18 |
| Fluid Reasoning | 4 | 6 | 5 | 15 |

### **Interactive Element Types**

| Component | Element Types | Delivery |
| :---- | :---- | :---- |
| ChoiceCards | MULTIPLE\_CHOICE\_INLINE, TRADEOFF\_SELECTION | Vertical stack of tappable cards with A/B/C/D letter badges. Selected card highlights; non-selected fade to 30% opacity. |
| NumericInput | NUMERIC\_INPUT | Centered text input field. Enter to submit. |
| ConfidenceRating | CONFIDENCE\_RATING | 3-option horizontal selector (Very Confident / Somewhat / Not Sure) |
| TimedChallenge | TIMED\_CHALLENGE | Timer bar above choice cards. 30-second countdown. Color transitions blue → amber (< 50%) → red (< 20%). |

### **Act 2 Data Captured**
- 35–55 structured item responses (answer + correct/incorrect + response time + difficulty)
- 15–30 voice probe transcripts (Layer B input)
- 5 ceiling characterizations (one per construct — Layer C)
- 5–15 diagnostic probe exchange transcripts (Layer C input)
- 3–5 timed challenge responses (response time vs. timer + accuracy)
- 5 boundary estimates (difficulty parameter 0.0–1.0 per construct)
- 5 pressure test outcomes (CONFIRMED / CONTRADICTED / INCONCLUSIVE)

## **26.8 Act 2 → Act 3 Transition**

1. Aria: "We're in the final stretch now. I'd like to revisit a couple of things and get your own read on how you did today."
2. Orb expands (72px → 200px, 2s cinematic ease)
3. Interactive elements clear
4. Act label: "CALIBRATION"

## **26.9 Act 3 — Calibration & Consistency Audit**

**Duration:** ~10–15 min. **Input mode:** Voice for scenarios and reflection. Tap for confidence ratings.

### **Screen State**
- Orb: full size (200px) — Act 1 aesthetic returns
- Progress bar: visible, Act 3 segment filling
- Act label: "CALIBRATION"
- Mic button: visible for conversational segments

### **Component 1: Confidence-Tagged Items** (2–3 items, ~5 min)

Aria: "I'm going to give you a couple more problems. Before I tell you if you got it right, I want you to tell me how confident you are in your answer."

Select moderately difficult items (NOT repeating Act 2 items). After candidate answers, confidence rating appears (Very Confident / Somewhat / Not Sure). Aria does NOT reveal whether the answer was correct. Accuracy + confidence = Metacognitive Calibration score.

### **Component 2: Parallel Scenario Re-Presentation** (1–2 brief scenarios, ~5 min)

Brief scenarios structurally identical to Act 1 but with different surface content. Only 1–2 beats (not the full 6-beat structure). Compare construct signals with Act 1 for consistency validation:
- Delta < 0.15 → HIGH consistency (score stands)
- Delta ≥ 0.15 → LOW consistency (flag, downweight lower-confidence source by 0.75×)

### **Component 3: Reflective Self-Assessment** (~3–4 min)

Aria: "Across everything we've done today — the scenarios, the problem-solving, the timed sections — which parts felt easiest to you? And which parts felt hardest?"

May follow up: "Were there moments where you felt uncertain but went with your first instinct?"

Compare self-assessment against actual performance profile for Metacognitive Calibration scoring.

### **Act 3 Data Captured**
- 2–3 confidence-tagged items (answer + confidence + accuracy)
- 1–2 parallel scenario transcripts + classifications
- 2–4 consistency deltas
- 1 reflective self-assessment transcript
- 1 self-assessment accuracy analysis (AI-evaluated alignment between self-report and actual scores)

## **26.10 Assessment Completion**

Aria: "That's everything. Thank you for your time and your thoughtful responses today. Your results will be reviewed by the hiring team, and you'll hear from them soon."

Orb settles to idle. Subtitles fade. After 2 seconds, smooth transition to post-assessment survey (existing survey-form.tsx). Then thank-you screen.

Behind the scenes: `AssessmentState.isComplete = true` → scoring pipeline fires (Layer A + B + C + consistency + red flags + composites + cutlines + status + predictions). Results available on dashboard within ~2 minutes.

## **26.11 Nudge System**

When the candidate doesn't respond after Aria finishes speaking, Aria gently re-engages. Nudges prevent candidates from getting stuck, confused, or frozen.

### **Nudge Timing**

| Context | First Nudge | Second Nudge (+ text fallback) | Final (advance) |
|---|---|---|---|
| Phase 0 mic check | 15s | 30s | 45s |
| Act 1 scenario responses | 20s | 40s | 60s |
| Act 2 follow-up probes | 15s | 30s | 45s |
| Act 3 reflective questions | 25s | 50s | 75s |
| Interactive elements (MC, confidence) | No nudge — element is visible and tappable | | |

### **Nudge Behavior**
- First nudge: supportive, doesn't repeat question. "Take your time — there's no rush."
- Second nudge: offers text alternative. "If you'd prefer to type your response, that's completely fine too." Text input appears.
- Final fallback: advances assessment. "No worries — let's move on." Current item scored as no-response (feeds into disengagement red flag).
- **Nudges are AI-generated, not hardcoded.** System prompt instructs the agent to generate contextually appropriate, varied nudges.

### **Nudge Telemetry**
Track per assessment: nudge count by act, nudge-to-response time, text fallback activations.

## **26.12 Voice Engine**

### **Agent Output: ElevenLabs TTS**

| Parameter | Value |
|---|---|
| Provider | ElevenLabs |
| Model | Flash v2.5 (`eleven_flash_v2_5`) |
| Latency | ~75ms |
| Voice | British female, warm, caring (voice ID in `ELEVENLABS_VOICE_ID` env var) |
| Output format | mp3\_44100\_128 |
| Voice settings | stability: 0.6, similarity\_boost: 0.8, style: 0.3, use\_speaker\_boost: true |
| Cost per assessment | ~$0.50–$1.00 (~35,000 characters of agent speech) |

**Architecture:** Agent text streams via Vercel AI SDK → buffered into sentence-level chunks → sent to ElevenLabs streaming endpoint → audio played via Web Audio API → AnalyserNode extracts real-time amplitude → amplitude drives orb displacement (orb surface ripples proportionally to Aria's voice).

**Server-side proxy:** `src/app/api/assess/[token]/tts/route.ts` — validates assessment token, proxies to ElevenLabs, rate-limited (60 req/min), logs character count for cost tracking.

**Fallback:** If ElevenLabs unavailable → browser SpeechSynthesis. Subtitles still work. Assessment never blocks on TTS failure.

### **Candidate Input: Web Speech API**
- Browser-native `SpeechRecognition` API (en-US) for speech-to-text
- Push-to-talk via mic button with visual indicator
- Gracefully disables if browser doesn't support speech APIs → text input fallback
- Voice vs. text response tracking for telemetry

### **Environment Variables**
```
ELEVENLABS_API_KEY=        # API key from ElevenLabs dashboard
ELEVENLABS_VOICE_ID=       # Selected British female voice ID
```

## **26.13 Stage Interface**

### **Living Background** (canvas)
Full-viewport animated canvas behind everything. 3–4 aurora nebulae in deep navy/blue drifting slowly. ~80 particles with pulsing opacity and connecting lines (neural network aesthetic). Subtle gold accent aurora. Mesmerizing if you stare, invisible if you're focused on the assessment.

### **The Orb** (canvas)
Canvas-rendered fluid sphere with sinusoidal displacement on polar coordinates. Multiple concentric layers with different displacement frequencies. Core gradient with specular highlight. Outer glow. Size transitions: 200px (Phase 0, Act 1, Act 3, Act 2 diagnostic probes) → 72px (Act 2 structured items) → ~100–120px (Act 2 voice probes). Transitions: 2s cubic-bezier(0.25, 0.1, 0.25, 1) via ResizeObserver.

### **Subtitles**
Word-by-word reveal (~55ms per word). DM Sans, 17px, weight 300, center-aligned. Color: #b8c4d6. Previous subtitle clears (500ms fade) before new text begins.

### **Candidate Transcript**
Brief fade-in/out confirmation when candidate speaks. DM Sans, 13px, italic. Fades in 400ms, holds ~2s at 50% opacity, fades out 1s. Wrapped in quotes.

### **Progress Bar**
Three segments with dots. JetBrains Mono labels (9px, uppercase). --aci-blue fill with glow. Hidden during Phase 0.

### **Interactive Elements**
Choice cards, numeric input, timed challenges, confidence rating. Enter with opacity + translateY animation (700ms). Exit with reverse. After selection on choice cards: non-selected fade to 30%, then all cards fade out and orb expands for voice follow-up.

### **Mic Button**
52px circle, push-to-talk. Active state: --aci-green-bright border, ripple animation. Visible only when it's the candidate's turn.

## **26.14 Design System Alignment**

| Token | Hex | Assessment Usage |
|---|---|---|
| --aci-navy | #0F1729 | Background foundation |
| --aci-navy-deep | #080e1a | Deepest background layer |
| --aci-blue | #2563EB | Orb core, progress fills, interactive highlights |
| --aci-green | #059669 | Orb listening state |
| --aci-green-bright | #22d68a | Active mic indicator |
| --aci-amber | #D97706 | Timer warning state |
| --aci-gold | #C9A84C | Act labels |
| --aci-red | #DC2626 | Timer danger state |

Typography: DM Sans (body/subtitles), JetBrains Mono (labels/progress/timer). No Inter in the assessment experience.

## **26.15 AI Model Configuration** (unchanged from v1.5)

| Purpose | Model | Timeout | Rationale |
| :---- | :---- | :---- | :---- |
| Real-time interactions (classification, follow-ups, probes) | Claude Haiku 4.5 (`claude-haiku-4-5-20251001`) | 15s | Low latency for conversational flow |
| Content generation (scenario adaptation, item generation) | Claude Sonnet 4.6 (`claude-sonnet-4-6-20250514`) | 30s | Higher quality for content creation |
| Layer B evaluation (rubric scoring) | Claude Haiku 4.5 | 15s | Triple-evaluation × many constructs = cost-sensitive |

**Cost Target:** <$5 per candidate for Anthropic API calls + ~$0.50–$1.00 for ElevenLabs TTS = **<$6 total AI cost per assessment**.

## **26.16 Measurement Rigor by Construct**

### **Rigorously Measured (5 constructs) — Quantitative + Qualitative + Ceiling**

Quantitative Reasoning, Spatial Visualization, Mechanical Reasoning, Pattern Recognition, Fluid Reasoning. These have: 86-item calibrated bank with difficulty parameters, 4-phase adaptive algorithm, Layer A deterministic scoring, Layer B conversational probe scoring, Layer C ceiling characterization, and Act 3 consistency validation. Full audit trail of items served, answers given, difficulty parameters, and scoring formulas.

### **Conversationally Measured (7 constructs) — Qualitative Only**

Systems Diagnostics, Cognitive Flexibility, Learning Velocity, Executive Control, Ethical Judgment, Procedural Reliability, Metacognitive Calibration. These rely on Layer B (AI rubric evaluation of conversational transcripts from Act 1 + Act 3). Triple-evaluation for reliability. 12 rubrics with 3–5 behavioral indicators each.

**Why no structured items for behavioral constructs:** Multiple choice items for integrity and judgment constructs have near-zero discriminative power because candidates can identify the socially desirable answer. Conversational measurement through branching scenarios produces richer, harder-to-fake behavioral signal. The measurement is more rigorous for these constructs, not less — but the scoring mechanism depends on AI interpretation rather than deterministic math.

### **Validation Roadmap (Required for Legal Defensibility)**

| Study | What It Proves | Priority | Dependency |
|---|---|---|---|
| Criterion validity study | Assessment scores predict job performance (ramp time, supervisor ratings, retention, process compliance) | CRITICAL | Requires 100+ candidates with outcome data |
| Human-AI agreement study | Trained I/O psychologists and AI rubric system produce same scores (target: ICC > 0.70) | HIGH | Requires 50 scored transcripts + 2–3 raters |
| Adverse impact analysis | Assessment does not produce disparate impact on protected classes (four-fifths rule, Fisher's exact test) | CRITICAL | Requires demographic data from customers |
| SJT item development for behavioral constructs | Adds Layer A deterministic scores for Ethical Judgment, Procedural Reliability, Executive Control | HIGH | Requires I/O psychology item development |

## **26.17 Implementation Files**

### **New UI Files** (v1.6)

| Directory | Files | Purpose |
| :---- | :---- | :---- |
| src/components/assessment/orb/ | assessment-orb.tsx, orb-renderer.ts, use-orb-animation.ts | Canvas-rendered fluid orb |
| src/components/assessment/stage/ | assessment-stage.tsx, subtitle-display.tsx, candidate-transcript.tsx, progress-bar.tsx, act-label.tsx | Single-screen stage layout |
| src/components/assessment/interactive/ | choice-cards.tsx, timed-challenge.tsx, confidence-rating.tsx, numeric-input.tsx, input-mode-toggle.tsx | Interactive elements |
| src/components/assessment/voice/ | mic-button.tsx, voice-controller.ts, tts-engine.ts, audio-player.ts, use-audio-amplitude.ts | Voice I/O + ElevenLabs TTS |
| src/components/assessment/background/ | living-background.tsx | Animated canvas background |
| src/components/assess/ | welcome-screen.tsx (redesigned), readiness-check.tsx, completion-screen.tsx, phase-0-controller.ts | Pre/post assessment + Phase 0 |

### **New Engine Files** (v1.6)

| File | Purpose |
| :---- | :---- |
| src/lib/assessment/phase-0.ts | Phase 0 script content, segment definitions, mic check logic |
| src/lib/assessment/nudge-system.ts | Nudge timing thresholds, timer management, telemetry |

### **Modified Engine Files** (v1.6)

| File | Change |
| :---- | :---- |
| src/lib/assessment/engine.ts | Add PHASE\_0 state to state machine |
| src/lib/assessment/types.ts | Add PHASE\_0 to act enum |
| src/lib/assessment/config.ts | Add Phase 0 + nudge configuration |
| src/lib/assessment/scoring/pipeline.ts | Exclude PHASE\_0 messages from scoring |

### **New API Route** (v1.6)

| Route | File | Purpose |
| :---- | :---- | :---- |
| /api/assess/\[token\]/tts | src/app/api/assess/\[token\]/tts/route.ts | ElevenLabs TTS proxy (token auth, rate-limited, cost tracking) |

### **Removed in v1.6**

Chat-based UI components (assessment-chat.tsx, chat-message.tsx), replaced by orb/stage components. Voice-controls.tsx replaced by voice/ directory. The streaming chat API endpoint (`/api/assess/[token]/chat/route.ts`) remains unchanged — only the UI that consumes it has changed.

### **Existing Route Files** (unchanged)

| Route | File | Purpose |
| :---- | :---- | :---- |
| /assess/\[token\] | src/app/(assess)/assess/\[token\]/page.tsx | Welcome/expired/in-progress page |
| /assess/\[token\]/start | src/app/(assess)/assess/\[token\]/start/route.ts | POST: create assessment + update statuses |
| /assess/\[token\]/v2 | src/app/(assess)/assess/\[token\]/v2/page.tsx | Assessment page entry point |
| /api/assess/\[token\]/chat | src/app/api/assess/\[token\]/chat/route.ts | Streaming chat API endpoint |
| /api/assess/\[token\]/complete | src/app/api/assess/\[token\]/complete/route.ts | Assessment completion + scoring pipeline |

*End of Document*

ACI • Arklight Cognitive Index • Product Requirements Document v1.6 • March 2026

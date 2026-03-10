
# ACI — Arklight Cognitive Index

## Product Requirements Document

**Version 1.11 • March 2026 • Confidential**

Supersedes: All prior versions (v1.10 through v1.1, NAIB Engineering PRD v3.0, NAIB PRD v4, ACI Finalization Doc)

---

## How to Use This Document

This PRD is the **single source of truth** for the ACI platform. It is structured for two audiences:

1. **Engineers and AI coding assistants (Claude Code)** — Use the Architecture Reference (Sections 4–8) and Implementation Reference (Section 26) for file paths, data models, API contracts, and implementation details. Every code-relevant section includes file paths relative to project root.

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
<summary><strong>v1.11 Change Log (March 2026)</strong></summary>

This revision introduces **TTS/Subtitle Synchronization**, **Orb Glide Transition**, and **Phase 0 Break Screen Refinement**.

**TTS/Subtitle Synchronization:**
1. **`onPlaybackStart` callback** — `TTSEngine.speak()` now accepts an optional `onPlaybackStart(totalDurationSec: number)` callback that fires when audio playback begins (after all chunks are fetched and decoded), reporting the total audio duration in seconds. `speakFallback()` estimates duration as `wordCount * 0.4`.
2. **Audio-duration-based word reveal** — Word reveal now starts when audio playback begins, not during fetch. `msPerWord` is calculated as `(durationSec * 1000) / totalWords`, pacing text reveal to match actual TTS audio length. Fixes prior bug where `(totalWords * 500) / totalWords` always evaluated to 500ms (clamped to 350ms), causing text and voice to desync.
3. **Applied across all TTS functions** — `playSegmentTTS`, `playSubtitleWithTTS`, and `playSentenceSequence` all use the same `startReveal(durationSec)` callback pattern with interval-based word reveal synchronized to audio duration.

**Orb Glide Transition:**
1. **`orbGliding` state** — New boolean state in `assessment-stage.tsx` animates the orb from center position (50%, 38%) to right-panel position (71%, 35%) over 1000ms with `cubic-bezier(0.25, 0.1, 0.25, 1)` easing during the break screen → Act 1 transition.
2. **CSS transition on `top`/`left`** — Orb container uses `transition: "top 1000ms ..., left 1000ms ..."` for smooth position animation without layout thrash.
3. **Break screen hidden during glide** — `Phase0BreakScreen` is conditionally rendered only when `isBreak && !orbGliding`, preventing visual overlap during the transition animation.

**Phase 0 Break Screen Refinement:**
1. **Simplified visual** — Break screen now displays a number countdown below the orb (no SVG ring timer). Countdown text fades from white to muted as time progresses.

</details>

<details>
<summary><strong>v1.10 Change Log (March 2026)</strong></summary>

This revision introduces **Orb Visual Refinements**, **Universal Sentence-by-Sentence Subtitles**, **Progressive Reference Card Reveal**, and **Structural Marker Stripping**.

**Orb Visual Refinements:**
1. **Orb size reduction** — `ORB_SIZES.FULL` reduced from 200px to 160px (mobile: 140px). `VOICE_PROBE` size added at 110px (mobile: 90px). All orb size constants centralized in `src/lib/assessment/transitions.ts`.
2. **CANVAS_PADDING tightened** — Reduced from 2.4 to 1.6 in `assessment-orb.tsx`. Prevents oversized canvas from overlapping subtitle area.
3. **Square artifact elimination** — CSS mask changed from `radial-gradient(circle at center, black 55%, black 75%, transparent 95%)` to `radial-gradient(circle closest-side at center, black 60%, transparent 90%)`. The `closest-side` keyword maps 100% to the canvas edge (not corner), ensuring full transparency 10% inside the boundary. No visible rectangular edge.
4. **Subtitle z-index separation** — Orb container at `zIndex: 1`, subtitle area at `zIndex: 2` to prevent canvas pixel overlap.

**Universal Sentence-by-Sentence Subtitles:**
1. **All acts now use sentence sequencing** — Previously only Act 1 used `playSentenceSequence()`. Acts 2/3 dumped the full AI response as one block into `subtitleText`. Now all acts split content via `splitSentences()` and populate `sentenceList`, triggering per-sentence TTS with crossfade.
2. **`splitSentences()` and `cleanText()` exported** — Both functions from `parse-scenario-response.ts` are now exported for reuse in the store's non-Act-1 `displayMessage` path.
3. **Non-Act-1 content cleaning** — Acts 2/3 content is now cleaned via `cleanText()` before sentence splitting, stripping markdown and structural markers.

**Progressive Reference Card Reveal:**
1. **`referenceRevealCount` store state** — New state field tracks how many card sections to show. `0` = nothing yet, increments per sentence in `playSentenceSequence()`, `-1` = show all.
2. **`RevealBlock` wrapper** — New animated wrapper component in `scenario-reference-card.tsx` with opacity/maxHeight/transform transitions (600ms) for progressive section reveal.
3. **Reveal mapping** — `revealCount 1` → role badge + context, `revealCount 2` → first section, `revealCount N+1` → Nth section, `revealCount sections+2` → question callout.
4. **Beat-aware initialization** — Beat 0 with explicit `---REFERENCE---` starts at `revealCount: 0` (progressive). Follow-up beats and history start at `-1` (show all).
5. **Reference card persistence** — Card no longer clears when candidate responds. Persists across all beats within a scenario. Only clears on new scenario (new explicit `---REFERENCE---`) or Act 1→2 transition.
6. **`referenceIsExplicit` flag** — Added to `ParsedScenarioResponse` interface. `true` only when parsed from `---REFERENCE---` JSON delimiter. Prevents fallback-generated references from overwriting existing cards.
7. **AI prompt engineering** — System prompt instructs Claude to output compressed shorthand items (under 60 characters) in reference card data, not full sentences. Example: "45 RPM · 8 min cycle · 65°C".

**Structural Marker Stripping:**
1. **`cleanText()` enhanced** — Now strips bracket tags (`[spoken text]`, `[SPOKEN]`, `[REFERENCE]`, `[REFERENCE_UPDATE]`, `[pause]`, `[silence]`, `[beat]`) and delimiter lines (`---REFERENCE---`, `---REFERENCE_UPDATE---`) from displayed subtitle text. Prevents AI response format markers from leaking into candidate-visible subtitles.

</details>

<details>
<summary><strong>v1.9 Change Log (March 2026)</strong></summary>

This revision introduces **Phase 0 → Act 1 Transition Hardening**, **Sentence-by-Sentence Act 1 Subtitles**, and **PRD Restructuring**.

**Phase 0 Transition Hardening:**
1. **Fire-and-Forget Fix** — `handlePhase0Response` in `assessment-stage.tsx` was calling `handlePhase0Complete` without `await`, causing unhandled promise rejections that silently killed the transition chain. Now fully awaited with try/catch error recovery.
2. **sendMessage Blocking Guard** — `sendMessage()` in `chat-assessment-store.ts` now throws `Error("SEND_BLOCKED_LOADING")` when blocked by `isLoading` instead of silently returning. Enables callers to catch and retry.
3. **Retry Logic** — `handlePhase0Complete` retries `sendMessage("[BEGIN_ASSESSMENT]")` once after 2 seconds on failure. On second failure, shows recovery UI ("Whenever you're ready, tap the microphone or type to begin.").
4. **Safety Net Effect** — New `useEffect` detects stalled transition: if 10 seconds pass after Phase 0 completes with no Act 1 content, automatically retries `sendMessage("[BEGIN_ASSESSMENT]")`.
5. **Phase 0 → Act 1 No-Op Guard** — Act transition effect now has explicit `PHASE_0 → ACT_1` case that defers to `handlePhase0Complete` instead of running redundant transition logic.
6. **Page-Refresh Recovery** — Recovery path adds `.catch()` with recovery UI for `sendMessage` failures and best-effort `phase_0_complete` trigger.
7. **Phase 0 Break Screen** — New `Phase0BreakScreen` component (`src/components/assessment/stage/phase0-break-screen.tsx`) displays a 20-second countdown with "Continue" button between Phase 0 and Act 1. Orchestrator phase `TRANSITION_0_1` governs visibility.
8. **Dev Tools** — New development-only role impersonation API (`/api/dev/impersonate`) and `RoleSwitcher` component for testing RBAC behavior across roles.
9. **Test Infrastructure Script** — New `scripts/test-setup.ts` creates test users, candidates, and assessment links for QA.

**Act 1 Sentence-by-Sentence Subtitles:**
1. **`parseScenarioResponse()` utility** — New parser (`src/lib/assessment/parse-scenario-response.ts`) splits AI Act 1 responses into individual sentences and extracts structured reference data. Supports explicit `---REFERENCE---` JSON delimiter and fallback auto-detection of scenario sections.
2. **Sentence-by-sentence playback** — Act 1 AI responses are no longer shown as a single block. Each sentence is displayed individually via `playSentenceSequence()` with per-sentence TTS, word-by-word reveal, crossfade transitions (300ms fade-out → swap → fade-in), and 400ms inter-sentence pauses.
3. **Scenario Reference Card** — New `ScenarioReferenceCard` component (`src/components/assessment/stage/scenario-reference-card.tsx`) renders a persistent structured card below subtitles during Act 1. Shows extracted context, labeled sections with bullet items, and question callout. Amber highlighting (`rgba(251, 191, 36, ...)`) for "problem" sections. Fade-in/out transitions.
4. **`processAct1Message` extraction** — Act 1 message processing extracted into a reusable `useCallback` shared by the message-pipeline `useEffect` and the `handleBeginAct1` safety net.
5. **Message pipeline safety net** — After `await sendMessage("[BEGIN_ASSESSMENT]")` resolves, `handleBeginAct1` yields 50ms for React's useEffect to fire, then checks if the message was processed. If not (due to React 18 concurrent batching edge cases), processes directly via `processAct1Message`. Coordinated via `lastProcessedMsgId` ref to prevent double-processing.
6. **`cleanText()` regex fix** — Fixed BEAT header regex from `[A-Z_\s]*` to `[A-Z_]*\s*`. The `\s` inside the character class was greedily consuming spaces in content text, corrupting subtitle output.
7. **History resume parsing** — Init resume path and message pipeline now apply `parseScenarioResponse()` for Act 1 history messages, producing clean formatted text and reference cards on page refresh instead of raw markdown.
8. **`stripMarkdown()` enhancement** — Added `# header` stripping (`/^#+\s+.*$/gm`) as safety net in `subtitle-display.tsx` to catch any leaked markdown headers.
9. **New store fields** — `sentenceList: string[]`, `currentSentenceIndex: number`, `referenceCard: ScenarioReference | null` added to `chat-assessment-store.ts`.

**PRD Restructuring:**
- Removed stale V1 assessment references (version field, AssessmentVersion enum, V1 pipeline dispatch)
- Removed deleted access-request API routes from API specification
- Added new API routes (onboarding, candidate assignments, dev tools)
- Fixed store inventory (2 stores: chat-assessment-store, app-store)
- Fixed notification types (ACCESS_REQUEST_PENDING removed)
- Consolidated change logs into collapsible sections
- Added file path references throughout for engineer navigation
- Reorganized sections by dependency order

</summary>
</details>

<details>
<summary><strong>v1.8 Change Log (March 2026)</strong></summary>

Introduced **Domain-Locked Invite-Only Access Model**. AccessRequest model removed. OAuth support (Google/Microsoft). EXTERNAL_COLLABORATOR role. CandidateAssignment filtering. Server-side field-level filtering. 6 API routes hardened with EC guards. Three-tier auth status. CandidateAssignment RLS policy.

</details>

<details>
<summary><strong>v1.7 Change Log (March 2026)</strong></summary>

Org-Scoped Access Request Routing (superseded by invite-only model in v1.8). Team Management Security Hardening. Auth hardening (`isActive` check). Email security (`escapeHtml()`). Rate limiting expansion.

</details>

<details>
<summary><strong>v1.6 Change Log (March 2026)</strong></summary>

Aria Assessment Experience — orb-centered, voice-first stage UI. ElevenLabs TTS. Phase 0 "The Handshake". Nudge system. Welcome page redesign.

</details>

<details>
<summary><strong>v1.5 Change Log (March 2026)</strong></summary>

V1 Assessment Removal. Feature flag elimination. Engine file consolidation. Schema migration (dropped `version` column and `AssessmentVersion` enum).

</details>

<details>
<summary><strong>v1.4 Change Log (March 2026)</strong></summary>

V2 Conversational Assessment Engine. Three-layer scoring pipeline. 86-item calibrated bank. 12 red flag checks. Security hardening (rate limiting, BOLA, TOCTOU). 3 new database models.

</details>

<details>
<summary><strong>v1.3 Change Log (March 2026)</strong></summary>

Domain-Adaptive Assessment Engine. Generic Aptitude Assessment. Item bank neutralization. Security hardening. Scoring pipeline activation bug fix.

</details>

<details>
<summary><strong>v1.2 Change Log (March 2026)</strong></summary>

Full assessment delivery platform. Scoring pipeline. AI-powered Role Builder. Email system. Batch CSV invitations. PDF exports. Data export. Tutorial/demo mode. Sentry monitoring.

</details>

---

# 1. Executive Summary

ACI (Arklight Cognitive Index) is a full-stack talent assessment intelligence platform purpose-built for advanced manufacturing and defense companies scaling beyond artisanal hiring methods. It assesses candidates across 12 cognitive, technical, and behavioral constructs through an **AI-conducted conversational investigation** (~60–90 min) guided by **Aria**, a named AI evaluator with a warm British female voice.

The assessment uses an orb-centered, voice-first stage interface — not a chat — with a three-act adaptive structure, ElevenLabs TTS voice synthesis, real-time speech-to-text candidate input, and a three-layer scoring pipeline. Results are delivered through an intelligent dashboard, candidate profiling system, and deployment planning engine.

The pipeline is fully role-aware: AI probes, narrative insights, and predictions are contextualized by each role's domain using extracted job description data. A Generic Aptitude path enables cross-role candidate evaluation with equal-weight scoring and automatic fit rankings across all organizational roles.

## 1.1 Core Value Proposition

ACI transforms hiring from credentials and self-reporting to objective measurement of job-validated performance patterns. Unlike abstract personality tests or generic cognitive assessments, ACI measures what actually predicts success in high-stakes manufacturing environments: technical aptitude, operational discipline, learning velocity, performance ceiling, and supervision load requirements.

## 1.2 Primary Customers

| Customer | Context | Scale |
| :---- | :---- | :---- |
| Anduril Industries | Arsenal-1 facility (OH) — largest single job-creation project in Ohio history | 4,000 hires by 2035; senior roles first (7+ yr experience), then entry-level |
| Hadrian | Multi-facility scaling (Torrance, Hawthorne, Mesa AZ 270k sq ft) | 350 immediate Mesa factory roles; 20–50+ manufacturing hires/month |
| Expansion Targets | Saronic, defense contractors, precision manufacturers | Advanced manufacturing companies facing identical assessment scaling crises |

## 1.3 The Assessment Crisis

Three compounding failures that advanced manufacturers face at scale:

1. **Scalability Collapse** — Craft-style evaluation methods (e.g., Anduril's cohort-based behavioral observation) break at industrial hiring volumes.
2. **"Soft Yes / Soft No" Crisis** — After 38–40 day timelines and 5 interview stages, teams still reach indecisive outcomes (Hadrian's current state).
3. **Technical Knowledge Gap** — Recruiting teams cannot evaluate domain expertise without SME bottlenecks that don't scale.

## 1.4 Revenue Model

| Model | Price | Notes |
| :---- | :---- | :---- |
| Per-Assessment | $1,000 per candidate | Full 12-construct assessment, scoring, reports, PDFs, 12-month validation access |
| Volume Tiers | Negotiable at 100+/month | Minimum $800/candidate |
| Enterprise | Fixed annual fee (unlimited) | For high-volume customers (Anduril/Hadrian) |
| Setup Fees | Custom pricing | Custom cutline validation studies, ATS integration |

---

# 2. User Personas

## 2.1 Tasha Aquino Vance — The Strategic Buyer

| Attribute | Detail |
| :---- | :---- |
| Title | VP / Head of Global Talent Acquisition |
| Company | Anduril Industries |
| RBAC Role | TA_LEADER |
| Time in ACI | 30 min/week |
| Primary Question | "Should we buy this?" |
| Adoption Blocker | "Is this legally defensible? What's the adverse impact story?" |

**Critical Features:** Dashboard Pipeline Overview, Role-Specific Composite Scores, Predictive Indicators, PDF Scorecard Export, Red Flag Detection, RBAC / Data Gating, Adverse Impact Report (Phase 2).

## 2.2 Kevin O'Shea — The Operational User

| Attribute | Detail |
| :---- | :---- |
| Title | Recruiting Manager |
| Company | Hadrian |
| RBAC Role | RECRUITING_MANAGER |
| Time in ACI | 2–3 hours/day |
| Primary Question | "Is this candidate a go?" |
| Adoption Blocker | "Does this slow me down or speed me up?" |
| Key Insight | Hadrian trains from scratch — Learning Velocity is the single most important score |

**Critical Features:** Candidate Table + Filters, Spider Chart + Intelligence Report, Attention Items, Role Switcher, PDF Scorecard, One-Click Send to HM.

---

# 3. What ACI Measures

12 constructs organized into three layers:

| Layer | Constructs | Dashboard Color |
| :---- | :---- | :---- |
| Cognitive Core (5) | Fluid Reasoning, Executive Control, Cognitive Flexibility, Metacognitive Calibration, Learning Velocity | Blue (#2563EB) |
| Technical Aptitude (5) | Systems Diagnostics, Pattern Recognition, Quantitative Reasoning, Spatial Visualization, Mechanical Reasoning | Green (#059669) |
| Behavioral Integrity (2) | Procedural Reliability, Ethical Judgment | Amber (#D97706) |

---

# 4. Technical Architecture

## 4.1 Tech Stack

| Layer | Choice | Status |
| :---- | :---- | :---- |
| Framework | Next.js 16.1.6 (App Router) — SSR + API routes in one codebase | ✅ |
| Runtime | React 19.2.3 | ✅ |
| Language | TypeScript (strict mode) | ✅ |
| Database | Supabase (PostgreSQL) with Row-Level Security | ✅ |
| Auth | Supabase Auth — invite-only with OAuth (Google, Microsoft) + email/password. Domain-based role detection. `isActive` enforcement. Three-tier: unauthenticated → needs_onboarding → authenticated | ✅ |
| ORM | Prisma with `@prisma/adapter-pg` | ✅ |
| UI | Tailwind CSS 4 + shadcn/ui + Radix UI | ✅ |
| Charts | Recharts | ✅ |
| AI Engine | Anthropic API (Claude) via Vercel AI SDK (`ai` + `@ai-sdk/anthropic`) | ✅ |
| AI Models | Claude Haiku 4.5 (`claude-haiku-4-5-20251001`) for real-time, Claude Sonnet 4.6 (`claude-sonnet-4-6-20250514`) for generation — configured in `src/lib/assessment/config.ts` | ✅ |
| Voice (Input) | Web Speech API (browser-native STT) | ✅ |
| Voice (Output) | ElevenLabs TTS API (Flash v2.5, `eleven_flash_v2_5`, ~75ms latency) | ✅ |
| State | Zustand — 2 stores: `chat-assessment-store.ts`, `app-store.ts` | ✅ |
| Email | Resend + Nodemailer (SMTP fallback) | ✅ |
| PDF | @react-pdf/renderer — 3 types: Scorecard, Interview Kit, One-Pager | ✅ |
| Monitoring | Sentry (edge + server + client instrumentation) | ✅ |
| Deployment | Vercel | ✅ |

**AI Cost:** ~$3–5 per assessment (Anthropic API) + ~$0.50–$1.00 (ElevenLabs TTS) = **<$6 total per assessment**.

## 4.2 Project Structure

```
prisma/                         # Schema (21 models) + seed data
scripts/
  provision-org.ts              # CLI: create org + first admin user
  test-setup.ts                 # CLI: create test users, candidates, assessment links
src/
  app/
    (auth)/                     # Login (OAuth + email/password), onboarding, forgot-password, update-password
    (dashboard)/                # Protected: dashboard, candidates/[id], compare, roles, export, invitations, admin, settings
    (assess)/                   # Candidate-facing: assess/[token] (welcome), assess/[token]/v2 (assessment stage)
    api/
      assess/[token]/           # chat, complete, response, survey, start, tts
      candidates/               # CRUD, batch-status, [id]/notes, [id]/assignments, [id]/outcomes
      invitations/              # single, batch, [id] management
      roles/                    # CRUD, analyze, [id]/rationale
      export/                   # data (CSV/JSON), pdf/[candidateId]
      team/                     # [userId] management, invite, accept
      onboarding/               # OAuth user linking with TeamInvitation
      notifications/            # Live notifications from DB state
      email/                    # Result email dispatch
      cron/                     # Scheduled result notifications
      dev/                      # Development-only: impersonate (role switching for testing)
      health/                   # Health check
    tutorial/                   # Demo mode with demo org data
    demo/                       # Demo landing + cinematic loading
  components/
    assessment/                 # Orb, stage, interactive elements, voice, background (30+ components)
    dashboard/                  # Pipeline cards, candidate table, attention items
    profile/                    # Candidate profile, intelligence report, spider chart
    roles/                      # Heatmap, role detail, role builder
    auth/                       # Login form, onboarding form
    nav/                        # TopNav, notification bell
    settings/                   # Team management
    admin/                      # Organizations table
    dev/                        # Development-only: role-switcher component
    ui/                         # shadcn/ui primitives
  lib/
    assessment/                 # Engine, state machine, config, classification, adaptive loops, scenarios, item bank, phase-0, transitions, nudge-system, parse-scenario-response
    assessment/scoring/         # 3-layer pipeline, Layer A/B/C, rubrics, red flags, consistency, aggregation
    email/templates/            # 4 templates: invitation, results, team-invite, org-admin-welcome
    auth.ts                     # getSession(), getAuthStatus(), requireAuth()
    rbac.ts                     # ROLE_LEVEL, ACCESS_MAP, filterCandidateForRole(), canManageTeam(), canAssignRole()
    data.ts                     # getDashboardData(), getCandidateData() with RBAC + EC filtering
    scoring.ts                  # calculateComposite(), evaluateCutline(), determineStatus()
    predictions.ts              # Ramp time, supervision, ceiling, attrition predictions
    rate-limit.ts               # In-memory sliding-window rate limiting
    prisma.ts                   # Prisma client singleton
  stores/
    chat-assessment-store.ts    # Assessment state: messages, orchestratorPhase, orbMode, TTS, voice, sentenceList, referenceCard
    app-store.ts                # App-level: mode, tutorial state
  generated/                    # Auto-generated Prisma client types
```

## 4.3 Build Phases

| Phase | Deliverable | Status |
| :---- | :---- | :---- |
| Phase 1 | Dashboard + Candidate Profile + Demo | ✅ Complete |
| Phase 2 | Data Model + Scoring Engine + Role Builder | ✅ Complete |
| Phase 3 | Assessment Delivery + Invitation System | ✅ Complete |
| Phase 4 | Integration Layer (PDFs, exports, email) | 🔶 Mostly Complete (ATS webhooks pending) |
| Phase 5 | Conversational Assessment Engine (Aria) | ✅ Complete |

---

# 5. Data Model

Implemented in Prisma ORM targeting Supabase PostgreSQL. All entities support multi-tenancy via Organization scoping and RBAC enforcement at the API layer.

**Schema file:** `prisma/schema.prisma`

## 5.1 Core Entities

### Organization & Users

| Model | Key Fields | Notes |
| :---- | :---- | :---- |
| Organization | id, name, slug (unique), domain?, isDemo, createdAt | `domain` field enables automatic internal/external role detection during onboarding |
| User | id, email, name, role (UserRole), orgId, supabaseId, isActive | `isActive` checked by `getSession()` to block deactivated users |
| TeamInvitation | id, orgId, email, name?, role, invitedBy, token, status, expiresAt | **Sole mechanism for user account creation.** 7-day expiry. Domain-based role override: non-matching domain → EXTERNAL_COLLABORATOR |
| CandidateAssignment | id, candidateId, userId, assignedAt | Scopes EC candidate visibility. `@@unique([candidateId, userId])`. RLS enforces org isolation |

**UserRole enum:** `EXTERNAL_COLLABORATOR` (0) | `RECRUITER_COORDINATOR` (1) | `RECRUITING_MANAGER` (2) | `HIRING_MANAGER` (2) | `TA_LEADER` (3) | `ADMIN` (4)

### Roles & Cutlines

| Model | Key Fields | Notes |
| :---- | :---- | :---- |
| Role | id, name, slug, description, orgId, isGeneric, isCustom, sourceType, complexityLevel, jdContext (Json?), hiringIntelligence (Json?) | `jdContext` persists extracted JD data for domain-adaptive assessment. `isGeneric` marks the Generic Aptitude role |
| Cutline | roleId, orgId, technicalAptitude, behavioralIntegrity, learningVelocity, overallMinimum | Minimum percentile thresholds per role per org |
| CompositeWeight | roleId, constructId, weight (0.0–1.0), version, source | 12 weights per role with version tracking |
| RoleVersion | roleId, version, weights, cutlines, rationale, changedBy, changedAt | Historical snapshots for rollback |

### Candidates & Assessments

| Model | Key Fields | Notes |
| :---- | :---- | :---- |
| Candidate | firstName, lastName, email, phone, orgId, primaryRoleId, status, resultsEmailSentAt | `@@unique([email, orgId])`. Status: INVITED, INCOMPLETE, SCORING, RECOMMENDED, REVIEW_REQUIRED, DO_NOT_ADVANCE |
| Assessment | candidateId, startedAt, completedAt, durationMinutes | One-to-one with Candidate. **No version field** — single modality (conversational) |
| AssessmentInvitation | candidateId, roleId, invitedBy, expiresAt, status, linkToken | Token-based invitation with 7-day expiry |
| SubtestResult | assessmentId, construct, layer, rawScore, percentile, theta, standardError, layerARawScore?, layerBRawScore?, consistencyLevel?, ceilingType?, scoringVersion | One per construct per assessment (12 total) |
| CompositeScore | assessmentId, roleSlug, indexName, score, percentile, passed, distanceFromCutline | One per role (enables Role Switcher) |
| ItemResponse | assessmentId, itemId, response, responseTimeMs, rawScore | Individual item-level response tracking |

### Conversational Assessment Models

| Model | Key Fields | Notes |
| :---- | :---- | :---- |
| ConversationMessage | id, assessmentId, role (AGENT/CANDIDATE/SYSTEM), content, act, metadata, elementType?, elementData?, candidateInput?, responseTimeMs?, sequenceOrder | Full audit trail. Indexed on (assessmentId, act) and (assessmentId, sequenceOrder) |
| AssessmentState | id, assessmentId (unique), currentAct (default "ACT_1"), currentScenario, currentBeat, currentConstruct?, currentPhase?, branchPath?, act2Progress?, act3Progress?, phase0Complete (default false), isComplete | Tracks progress through 3-act structure. `phase0Complete` tracks Phase 0 handshake completion |
| AIEvaluationRun | id, assessmentId, messageId, construct, runIndex (0–2), indicatorScores, aggregateScore, modelId, latencyMs, rawOutput | Layer B triple-evaluation audit trail. 3 runs per response, median selected |

### AI Interactions & Integrity

| Model | Key Fields | Notes |
| :---- | :---- | :---- |
| AIInteraction | assessmentId, construct, triggerItemId, aiPrompt, candidateResponse, aiAnalysis, confidence | AI-adaptive follow-up audit trail |
| Prediction | assessmentId, rampTimeWeeks, rampTimeLabel, supervisionLevel, ceilingLevel, attritionRisk, supportingFactors | Score-driven predictions |
| RedFlag | assessmentId, flagType, severity (CRITICAL/WARNING/INFO), description, evidence, affectedConstructs | 12 automated integrity checks |
| Note | candidateId, userId, content, createdAt | User-authored notes |
| ActivityLog | entityType, entityId, action, changedBy, changedAt, details | Full audit trail |
| PostAssessmentSurvey | assessmentId, difficulty, fairness, faceValidity, feedback | Candidate experience feedback |
| OutcomeRecord | candidateId, trainingCompletion, rampTimeActual, retentionStatus, supervisorRating | Post-hire outcome data for validation |

### Enums

| Enum | Values |
| :---- | :---- |
| AssessmentAct | ACT_1, ACT_2, ACT_3 |
| CeilingTypeEnum | HARD_CEILING, SOFT_CEILING_TRAINABLE, SOFT_CEILING_CONTEXT_DEPENDENT, STRESS_INDUCED, INSUFFICIENT_DATA |
| ConvoMessageRole | AGENT, CANDIDATE, SYSTEM |
| InteractionElementType | TEXT_RESPONSE, MULTIPLE_CHOICE_INLINE, NUMERIC_INPUT, TIMED_CHALLENGE, CONFIDENCE_RATING, TRADEOFF_SELECTION |

---

# 6. Composite Weights & Cutlines

## 6.1 Scientific Foundation

Weights are research-informed starting defaults derived from meta-analytic literature (Schmidt & Hunter 1998, Salgado & Moscoso 2019, Wilmot & Ones 2019, O*NET ability data). **The specific numerical values are interpretive judgments that will be empirically validated** using real ACI-score-to-job-performance correlations from pilot deployments.

Key directional principles:
- GMA validity increases with job complexity (ρ ≈ .50 low → ρ ≈ .68 high)
- Conscientiousness strongest in skilled/semiskilled roles (ρ̅ = .33), attenuates with complexity
- Integrity meta-analysis (ρ = .41) supports elevated behavioral thresholds for defense roles

## 6.2 Master Weight Table

All 12 constructs weighted per role (sum = 1.00):

| Construct | Factory Tech | CNC Mach. | CAM Prog. | CMM Prog. | Mfg Engr. |
| :---- | ----- | ----- | ----- | ----- | ----- |
| Fluid Reasoning | 0.10 | 0.08 | 0.15 | 0.10 | 0.18 |
| Executive Control | 0.10 | 0.10 | 0.08 | 0.10 | 0.05 |
| Cognitive Flexibility | 0.05 | 0.08 | 0.05 | 0.05 | 0.08 |
| Metacognitive Calibration | 0.08 | 0.05 | 0.05 | 0.08 | 0.08 |
| Learning Velocity | 0.22 | 0.08 | 0.07 | 0.05 | 0.12 |
| Systems Diagnostics | 0.03 | 0.05 | 0.10 | 0.05 | 0.18 |
| Pattern Recognition | 0.07 | 0.12 | 0.05 | 0.15 | 0.05 |
| Quantitative Reasoning | 0.05 | 0.15 | 0.18 | 0.20 | 0.08 |
| Spatial Visualization | 0.02 | 0.15 | 0.20 | 0.05 | 0.05 |
| Mechanical Reasoning | 0.03 | 0.12 | 0.05 | 0.02 | 0.03 |
| Procedural Reliability | 0.20 | 0.02 | 0.00 | 0.12 | 0.03 |
| Ethical Judgment | 0.05 | 0.02 | 0.02 | 0.03 | 0.07 |

## 6.3 Master Cutline Table

| Role | Technical Aptitude (L2 Avg) | Behavioral Integrity (L3 Avg) | Learning Velocity |
| :---- | :---- | :---- | :---- |
| Factory Technician | ≥ 40th percentile | ≥ 60th percentile | ≥ 60th percentile |
| CNC Machinist | ≥ 60th percentile | ≥ 55th percentile | ≥ 50th percentile |
| CAM Programmer | ≥ 75th percentile | ≥ 50th percentile | ≥ 55th percentile |
| CMM Programmer | ≥ 70th percentile | ≥ 75th percentile | ≥ 45th percentile |
| Manufacturing Engineer | ≥ 65th percentile | ≥ 70th percentile | ≥ 65th percentile |

## 6.4 Empirical Validation Protocol

**Phase A (Pre-Pilot):** 1,000+ synthetic profiles → verify role differentiation, pass rates (30–50% target), red flag frequency (5–15%).

**Phase B (Months 1–6):** N=200–500 candidates at Anduril/Hadrian → collect 90-day criterion data (supervisor ratings, time-to-productivity, error rates, retention).

**Phase C (Months 6–12):** Compute validity coefficients → recalibrate weights via shrinkage-corrected regression. Target: composite-to-performance r > 0.60.

**Phase D (Continuous):** Quarterly validity analysis, annual norming refresh, adverse impact monitoring (4/5ths rule).

---

# 7. Role-Based Access Control (RBAC) ✅

RBAC is enforced at three layers:
1. **Server-side field filtering** — `filterCandidateForRole()` in `src/lib/rbac.ts` strips restricted data from API responses
2. **API route guards** — 403 for unauthorized roles
3. **UI conditional rendering** — defense-in-depth only

## 7.1 Data Visibility Matrix

| Data | EC | RC | RM | HM | TA | Admin |
| :---- | ----- | ----- | ----- | ----- | ----- | ----- |
| Status & pass/fail | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Contact info | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Overall fit score | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Composite index scores | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Interview focus areas | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Development recommendations | — | ✓ | ✓ | ✓ | ✓ | ✓ |
| Predictive insights | — | — | ✓ | ✓ | ✓ | ✓ |
| Red flags detail | — | — | ✓ | ✓ | ✓ | ✓ |
| Full construct breakdowns | — | — | — | ✓ | ✓ | ✓ |
| Question-level detail | — | — | — | ✓ | ✓ | ✓ |
| AI follow-up transcripts | — | — | — | ✓ | ✓ | ✓ |
| Raw IRT / theta parameters | — | — | — | — | ✓ | ✓ |
| Validity metrics | — | — | — | — | ✓ | ✓ |
| Full audit trail | — | — | — | — | ✓ | ✓ |
| Notes (create/edit/delete) | — | ✓ | ✓ | ✓ | ✓ | ✓ |
| PDF export | — | — | ✓ | ✓ | ✓ | ✓ |
| Bulk actions | — | ✓ | ✓ | — | ✓ | ✓ |
| Candidate visibility | Assigned only | All in org | All in org | All in org | All in org | All in org |
| Navigation | Dashboard only | Full | Full | Full | Full | Full |

## 7.2 Role Hierarchy

| Role | Level | Can manage team | Can assign roles |
| :---- | ----- | ----- | ----- |
| EXTERNAL_COLLABORATOR | 0 | No | — |
| RECRUITER_COORDINATOR | 1 | No | — |
| RECRUITING_MANAGER | 2 | No | — |
| HIRING_MANAGER | 2 | No | — |
| TA_LEADER | 3 | Yes | RC, RM, HM, TA_LEADER |
| ADMIN | 4 | Yes | RC, RM, HM, TA_LEADER |

EC cannot be manually assigned — determined by domain matching during onboarding. ADMIN only assigned via CLI provisioning.

## 7.3 External Collaborator Restrictions

Enforced server-side:
- **Candidate scoping**: Only assigned candidates via `CandidateAssignment`. Queries filter by `assignments: { some: { userId } }`.
- **API access**: 6 routes return 403 (batch-status, notes, invitations, invitation management).
- **Navigation**: Dashboard only. Other pages redirect to Dashboard.
- **Data fields**: No access to redFlags, predictions, subtestResults, aiInteractions, notes, developmentPlan, intelligenceReport.

## 7.4 Implementation Files

| File | Purpose |
| :---- | :---- |
| `src/lib/rbac.ts` | ROLE_LEVEL, ACCESS_MAP, filterCandidateForRole(), canManageTeam(), canAssignRole(), getAssignableRoles() |
| `src/lib/data.ts` | getDashboardData(), getCandidateData() — applies EC candidate filtering |
| `src/lib/auth.ts` | getSession() with isActive check, getAuthStatus(), requireAuth() |
| `src/app/api/candidates/route.ts` | EC candidate assignment filtering on GET |

---

# 8. Scoring Engine ✅

Single scoring pipeline: three-layer scoring → construct aggregation → composite calculation → cutline evaluation → red flag detection → prediction generation → status determination.

**Pipeline file:** `src/lib/assessment/scoring/pipeline.ts` (13-step orchestrator)

## 8.1 Three-Layer Scoring

### Layer A — Deterministic Scoring (`src/lib/assessment/scoring/layer-a.ts`)
- Scores structured items from Act 2 adaptive loops + Act 3 confidence items
- Binary accuracy scaled by difficulty: `score × (1 + (difficulty − 0.5) × 0.3)`
- Aggregate per construct: mean of scaled scores, normalized to 0–1

### Layer B — AI-Evaluated Rubric Scoring (`src/lib/assessment/scoring/layer-b.ts`)
- Scores conversational responses against construct-specific rubrics (`src/lib/assessment/scoring/rubrics.ts` — 12 rubrics, 3–5 indicators each)
- **Triple-evaluation:** 3 parallel calls with temperature variation (0.3, 0.4, 0.5), lower-median selected
- **Variance tracking:** SD > 0.3 → flagged and downweighted by 0.5×
- **Concurrency-limited:** Max 6 parallel AI calls via custom pLimit
- All 3 runs persisted in AIEvaluationRun model
- Fallback to heuristic scoring if AI unavailable

### Layer C — Ceiling Characterization (`src/lib/assessment/scoring/layer-c.ts`)
- **Qualitative classification** (not numeric score) from Act 2 diagnostic probes
- Types: HARD_CEILING, SOFT_CEILING_TRAINABLE, SOFT_CEILING_CONTEXT_DEPENDENT, STRESS_INDUCED, INSUFFICIENT_DATA
- Feeds narrative reports, predictions, and development recommendations

### Construct Aggregation (`src/lib/assessment/scoring/aggregation.ts`)
```
Construct Score = (w_A × Layer_A_score) + (w_B × Layer_B_score)
Default weights: w_A = 0.55, w_B = 0.45 (both present) | 1.0 for single layer
```

### Consistency Validation (`src/lib/assessment/scoring/consistency.ts`)
- Compares Act 1 vs Act 3 construct signals
- Delta < 0.15 → HIGH consistency | Delta ≥ 0.15 → LOW consistency (downweight 0.75×)

## 8.2 Composite & Cutline Evaluation

**File:** `src/lib/scoring.ts`

- **Composite:** Σ(percentile_i × weight_i) / Σ(weight_i) for all 12 constructs
- **Cutline:** Conjunctive model — ALL three thresholds must be met: Technical Aptitude avg ≥ threshold, Behavioral Integrity avg ≥ threshold, Learning Velocity ≥ threshold
- **Buffer zone:** Candidates within 5 points of cutline → REVIEW_REQUIRED (not auto-rejected)

## 8.3 Status Determination

| Condition | Status |
| :---- | :---- |
| Any CRITICAL red flag | DO_NOT_ADVANCE |
| Below cutline by >5 points | DO_NOT_ADVANCE |
| Below cutline by ≤5 points | REVIEW_REQUIRED |
| Passes all cutlines + WARNING flags | REVIEW_REQUIRED |
| Passes all cutlines + no flags | RECOMMENDED |

## 8.4 Red Flag Detection

12 automated checks (`src/lib/assessment/scoring/red-flags.ts`):

| Flag | Condition | Severity |
| :---- | :---- | :---- |
| Extreme low scores | Any construct percentile <10th | CRITICAL |
| Behavioral concerns | Behavioral Integrity constructs <25th | WARNING |
| Speed-accuracy mismatch | Fast responses (top 10%) + low accuracy (bottom 10%) | WARNING |
| Incomplete assessment | >2 constructs with zero responses | CRITICAL |
| Random responding | Response time <2s on >30% of items | CRITICAL |
| AI interaction refusal | <10 words on >50% of AI follow-ups | WARNING |
| Overconfidence pattern | Calibration bias >30% on >3 constructs | WARNING |
| Scenario disengagement | Average <20 words on Act 1 responses | WARNING |
| Consistency failure | 3+ constructs with LOW consistency | WARNING |
| Copy-paste detection | Identical phrasing across multiple responses | WARNING |
| Escalation avoidance | ≥75% SJT responses contain avoidance language | WARNING |
| High-variance AI evaluation | 3+ constructs with SD > 0.3 across triple-evaluation | WARNING |

## 8.5 Predictions (`src/lib/predictions.ts`)

| Model | Basis | Output |
| :---- | :---- | :---- |
| Ramp Time | Learning Velocity + Tech Aptitude | 4–16 weeks estimate |
| Supervision Load | Executive Control + Procedural Reliability | LOW / MEDIUM / HIGH |
| Performance Ceiling | Fluid Reasoning + Systems Diagnostics + Learning Velocity | HIGH / MEDIUM / LOW |
| Attrition Risk | Behavioral Integrity + Learning Velocity | LOW / MEDIUM / HIGH |

All predictions enriched with role-specific context when available.

## 8.6 Pipeline Reliability

- **Retry:** 3 attempts with exponential backoff (1s, 2s, 4s)
- **Error state:** Candidate status set to ERROR on exhaustion
- **TOCTOU protection:** Transactional re-check prevents concurrent double-completion
- **Structured logging:** Duration, cost, construct count, red flag count

---

# 9. Aria Assessment Experience ✅

The assessment is conducted by **Aria**, a named AI evaluator with a warm British female voice. Orb-centered, voice-first, single-screen stage interface. No chat bubbles. No scrolling. The orb IS the interface.

## 9.1 Aria Identity

- **Voice:** British female, warm, caring, human. ElevenLabs Flash v2.5, voice ID in `ELEVENLABS_VOICE_ID` env var
- **Visual:** Canvas-rendered fluid sphere (160px desktop, 140px mobile) with neural particle system. CANVAS_PADDING 1.6, `closest-side` radial mask for seamless edge blending. States: idle (gentle breathing), speaking (dynamic displacement synced to audio amplitude + ripples), listening (green shift), processing (muted)
- **Behavioral rules:** Always speaks first. Never repeats questions on nudge. Never says "correct"/"incorrect" in Act 1. Tone shifts across acts: curious (Act 1) → focused (Act 2) → warm/reflective (Act 3). Act 1 narration is delivered sentence-by-sentence with crossfade transitions and per-sentence TTS.

## 9.2 Assessment Timeline

| Phase | Duration | Constructs | Scored? |
|-------|----------|------------|---------|
| Phase 0 — The Handshake | ~60 sec | None | No |
| Act 1 — Scenario Gauntlet | ~40–50 min | 8 constructs (Systems Diag, Fluid Reas, Cog Flex, Learn Vel, Exec Ctrl, Ethical Judg, Proc Rel, Metacog Cal) | Yes (Layer B) |
| Act 2 — Precision Gauntlet | ~30–40 min | 5 constructs (Quant Reas, Spatial Viz, Mech Reas, Pattern Rec, Fluid Reas) | Yes (A + B + C) |
| Act 3 — Calibration | ~10–15 min | Cross-cutting validation + Metacog Cal | Yes (A + B) |
| **Total** | **~60–90 min** | **All 12 constructs** | |

### Orchestrator State Machine

**Type:** `OrchestratorPhase` (`src/lib/assessment/transitions.ts`)

```
PHASE_0 → TRANSITION_0_1 → ACT_1 → TRANSITION_1_2 → ACT_2 → TRANSITION_2_3 → ACT_3 → COMPLETING
```

`TRANSITION_0_1` governs the Phase 0 Break Screen (20-second countdown). All other transitions play scripted TTS segments.

**Zustand store:** `src/stores/chat-assessment-store.ts` — tracks `orchestratorPhase`, `currentAct`, `messages`, `orbMode`, `orbSize`, `subtitleText`, `isTTSPlaying`, `inputMode`, `candidateTranscript`, `sentenceList`, `currentSentenceIndex`, `referenceCard`, etc.

## 9.3 Phase 0 — The Handshake

**Duration:** ~60 sec. **Scored:** No. **File:** `src/lib/assessment/phase-0.ts`

### Segments

| # | Name | Text | Duration |
|---|------|------|----------|
| 1 | Introduction | "Hello, and welcome. My name is Aria, and I'll be guiding you through your assessment today. It's good to have you here." | ~8s |
| 2 | Format Orientation | "This will take about 60 to 90 minutes. I'll walk you through some scenarios and problems — and you'll respond by speaking. I'll also give you some questions you can answer by tapping on screen. There are no trick questions, and there's no single right answer to most of what we'll discuss." | ~15s |
| 3 | Mic Check | "Before we begin, let's make sure I can hear you clearly. Tap the microphone button and tell me — what role are you here for today?" | ~8s + response |
| 4 | Confirmation | "Perfect, I can hear you. Let's get started." | ~4s |

### Mic Check Failure Handling
- No audio after 15s → Aria offers text fallback ("If you'd like, you can also type your response instead")
- No interaction after 30s → "No worries — let's continue with typing" (auto-switches to text input)

### Phase 0 → Act 1 Transition ✅ (Hardened in v1.9)

**Files:** `src/components/assessment/stage/assessment-stage.tsx`, `src/components/assessment/stage/phase0-break-screen.tsx`

The transition flows through two stages:

**Stage 1 — Break Screen (`TRANSITION_0_1`):**
After Phase 0 completes, `handlePhase0Complete` fires a `phase_0_complete` trigger to the server (fire-and-forget), sets orchestrator phase to `TRANSITION_0_1`, and clears messages via `loadHistory([], ...)`. The `Phase0BreakScreen` component renders a 20-second SVG ring countdown with a "Continue" button. Timer auto-fires `onContinue` at expiry; `calledRef` prevents double-invocation.

**Stage 2 — Act 1 Initiation (`handleBeginAct1`):**
When the candidate clicks Continue (or timer expires), `handleBeginAct1` sets orchestrator phase to `ACT_1`, then `await`s `sendMessage("[BEGIN_ASSESSMENT]")`. Three layers of error protection:

1. **Retry logic:** If `sendMessage` fails, waits 2 seconds and retries once. On second failure, shows recovery UI ("Whenever you're ready, tap the microphone or type to begin.").

2. **Safety net (React 18 batching):** After `await sendMessage()` resolves, yields 50ms for the message-pipeline `useEffect` to fire. Then checks if the message was processed (via `lastProcessedMsgId` ref). If not, calls `processAct1Message()` directly. This catches edge cases where React 18's concurrent scheduler delays the useEffect re-run after the streaming completion state update.

3. **Init recovery path:** If the page loads with Phase 0 messages already present, the init effect skips to Act 1 by calling `loadHistory([])` then `sendMessage("[BEGIN_ASSESSMENT]")` with the same safety net.

**`sendMessage` guard:** When blocked by `isLoading`, throws `Error("SEND_BLOCKED_LOADING")` so callers can catch and retry (changed from silent `return` in v1.9).

### Phase 0 Rules
- NOT skippable. Every candidate goes through it.
- On session resume: if Phase 0 complete (checked via server state), skip to last assessment position.

## 9.4 Act 1 — Scenario Gauntlet

**Duration:** ~40–50 min. **Input:** Voice only (text fallback via nudge).

Four domain-neutral scenarios × 6 beats = 24 conversational exchanges. Response classified as STRONG/ADEQUATE/WEAK via triple-evaluation. Strong → escalated challenges; Weak → scaffolding.

### Scenarios

| # | Name | Primary Constructs |
|---|------|-------------------|
| 1 | Escalating System Failure | Systems Diagnostics, Fluid Reasoning, Cognitive Flexibility, Learning Velocity |
| 2 | Integrity Pressure Cooker | Ethical Judgment, Procedural Reliability, Executive Control |
| 3 | Learning Gauntlet | Learning Velocity, Cognitive Flexibility, Pattern Recognition |
| 4 | Prioritization Crisis | Executive Control, Systems Diagnostics, Metacognitive Calibration, Ethical Judgment |

### Beat Structure (6 per scenario)

| Beat | Type | Purpose |
|------|------|---------|
| 0 | INITIAL_SITUATION | Sets scene, open question |
| 1 | INITIAL_RESPONSE | First decision point, branches by Beat 0 classification |
| 2 | COMPLICATION | Adds unexpected complexity |
| 3 | SOCIAL_PRESSURE | Interpersonal dynamics, integrity test |
| 4 | CONSEQUENCE_REVEAL | Shows impact of decisions |
| 5 | REFLECTIVE_SYNTHESIS | Candidate reflects on approach |

### Sentence-by-Sentence Subtitle Delivery ✅

**Files:** `src/lib/assessment/parse-scenario-response.ts`, `src/components/assessment/stage/assessment-stage.tsx`, `src/stores/chat-assessment-store.ts`

All AI responses across all acts are displayed sentence-by-sentence, never as a full text block. Act 1 uses `parseScenarioResponse()` for parsing + reference extraction. Acts 2/3 use `cleanText()` + `splitSentences()` directly in the store's `displayMessage`.

1. **Strips markdown/headers/structural markers** — Removes `# BEAT N: LABEL` headers, `**bold**`, `*italic*`, bracket tags (`[spoken text]`, `[SPOKEN]`, `[pause]`, etc.), and delimiter lines (`---REFERENCE---`, `---REFERENCE_UPDATE---`) via `cleanText()`.
2. **Splits into sentences** — Uses regex `(?<=[.!?])\s+` to produce an array of individual sentences.
3. **Extracts reference data** (Act 1 only) — Detects structured scenario information (context, labeled sections, question callout) via either an explicit `---REFERENCE---` JSON delimiter or fallback auto-detection of section patterns.

**Playback** (`playSentenceSequence()` in `assessment-stage.tsx`):
- Each sentence is displayed individually via `SubtitleDisplay` with crossfade transitions (300ms fade-out → text swap → fade-in).
- Per-sentence TTS via ElevenLabs with `Promise.race` safety timeout (`max(30s, wordCount * 800ms)`).
- Word-by-word reveal within each sentence, paced to actual TTS audio duration via `onPlaybackStart(totalDurationSec)` callback. `msPerWord = (durationSec * 1000) / totalWords`. Reveal starts when audio playback begins, not during fetch.
- 400ms pause between sentences for natural pacing.
- `sentenceSequenceRef` allows interruption when candidate starts speaking.
- Progressive reference card reveal: each sentence increments `referenceRevealCount`, unveiling the next card section.

### Scenario Reference Card ✅

**File:** `src/components/assessment/stage/scenario-reference-card.tsx`

A persistent structured card appears below subtitles during Act 1, showing extracted scenario facts:

- **Role badge** — Inline badge with role title (11px, blue tint).
- **Context line** — Brief scenario context (12px, muted, 10 words max).
- **Labeled sections** — Compressed shorthand bullet items grouped by label (e.g., "Normal Process", "The Problem"). Items kept under 60 characters. Problem sections use amber highlighting (`rgba(251, 191, 36, ...)`).
- **New Information** — Accumulated across follow-up beats with blue accent highlighting. Always visible once revealed.
- **Question callout** — The scenario's open question, separated by a subtle divider. Revealed last.
- **Transitions** — `RevealBlock` wrapper with 600ms opacity/maxHeight/transform transitions for progressive reveal. 500ms fade-out when cleared.

**Progressive reveal** (`referenceRevealCount` state):
- Beat 0 (new scenario): card starts hidden (`revealCount: 0`). Each sentence in `playSentenceSequence` increments the count, revealing role → context → section 1 → section 2 → ... → question.
- Follow-up beats: card shows all existing content immediately (`revealCount: -1`). New information accumulates.
- History/resume: shows all (`revealCount: -1`).

**Persistence:** Card persists across all beats within a scenario. Never cleared when candidate responds. Only cleared on new scenario (new explicit `---REFERENCE---` from Beat 0) or Act 1→2 transition. Fallback-generated references do not overwrite an existing card (controlled via `referenceIsExplicit` flag).

### Screen State
- Orb: full size (160px desktop / 140px mobile), glides from center (50%, 38%) to right panel (71%, 35%) during break → Act 1 transition (1000ms cubic-bezier ease)
- Progress bar: visible, Act 1 segment filling
- Act label: "THE SCENARIO GAUNTLET" (JetBrains Mono, 9px, --aci-gold at 60%)
- Subtitles: sentence-by-sentence reveal with crossfade below orb
- Reference card: persistent structured facts below subtitles (Act 1 only)
- No chat bubbles. No message history.

## 9.5 Act 1 → Act 2 Transition

**File:** `src/lib/assessment/transitions.ts` (`buildTransition1to2()`)

Cinematic agent-narrated (~15–20s):
1. Aria: "You handled those scenarios well. Now we're going to shift gears."
2. Orb compresses (160px → 72px, 2s cinematic ease)
3. Aria: "I'm going to present you with a series of problems — some timed, some not."
4. Act label crossfade: "THE SCENARIO GAUNTLET" → "THE PRECISION GAUNTLET"
5. Aria: "Take your time where you can."
6. First interactive element fades in

## 9.6 Act 2 — Precision Gauntlet

**Duration:** ~30–40 min. **Input:** Tap for structured items, voice or text (candidate's choice) for probes.

5 constructs × 4-phase adaptive loop per construct.

### Per-Construct Adaptive Loop

**Phase 1: Calibration** (2–3 items) — Easy, medium, hard items for rough placement.

**Phase 2: Boundary Mapping** (3–5 items) — Binary search to pinpoint difficulty where accuracy drops below 50%.

**Phase 3: Pressure Test** (2–3 items) — Different sub-type at boundary difficulty. May include timed challenge. Outcome: CONFIRMED / CONTRADICTED / INCONCLUSIVE.

**Phase 4: Diagnostic Probe** (1–3 conversational exchanges) — Triggered only after ceiling confirmed. AI generates targeted probes:

| Signal | Probe Type |
|--------|-----------|
| Response timing spiked near ceiling | Stress vs. competence |
| Failed across multiple sub-types | Domain-specific vs. general |
| Failed only one sub-type | Hard vs. soft/trainable ceiling |
| No clear signal | Default hard vs. soft |

**Stopping rules:** Evidence strength ≥ 0.7, or max 3 probes, or candidate disengagement (<15 words).

### Item Bank (`src/lib/assessment/item-bank.ts` — 86 items)

| Construct | Easy | Medium | Hard | Total |
| :---- | :---- | :---- | :---- | :---- |
| Quantitative Reasoning | 5 | 8 | 7 | 20 |
| Spatial Visualization | 4 | 7 | 7 | 18 |
| Mechanical Reasoning | 4 | 6 | 5 | 15 |
| Pattern Recognition | 4 | 7 | 7 | 18 |
| Fluid Reasoning | 4 | 6 | 5 | 15 |

### Interactive Element Types

| Component | Types | Delivery |
| :---- | :---- | :---- |
| ChoiceCards | MULTIPLE_CHOICE_INLINE, TRADEOFF_SELECTION | Vertical tappable cards with A/B/C/D badges |
| NumericInput | NUMERIC_INPUT | Centered text input, Enter to submit |
| ConfidenceRating | CONFIDENCE_RATING | 3-option horizontal selector |
| TimedChallenge | TIMED_CHALLENGE | 30s countdown, color: blue → amber → red |

### Screen State
- Orb: compact (72px), top of stage. Expands to 110px (90px mobile) during voice probes.
- Interactive elements: center screen
- Input mode toggle: "Voice / Type" pills after first probe

## 9.7 Act 2 → Act 3 Transition

**File:** `src/lib/assessment/transitions.ts` (`buildTransition2to3()`)

1. Aria: "We're in the final stretch now."
2. Orb expands (72px → 160px, 2s cinematic ease)
3. Interactive elements clear
4. Act label: "CALIBRATION"

## 9.8 Act 3 — Calibration & Consistency Audit

**Duration:** ~10–15 min. **Input:** Voice for scenarios/reflection, tap for confidence ratings.

Three components:
1. **Confidence-Tagged Items** (2–3 items) — Answer + confidence rating. Aria doesn't reveal correctness.
2. **Parallel Scenario Re-Presentation** (1–2 scenarios) — Structurally identical to Act 1, different surface. Consistency validation.
3. **Reflective Self-Assessment** — "Which parts felt easiest? Which felt hardest?" Compare self-assessment to actual performance.

## 9.9 Assessment Completion

Aria: "That's everything. Thank you for your time and your thoughtful responses today."
→ Orb settles to idle → 2s pause → post-assessment survey → thank-you screen.

Behind the scenes: `isComplete = true` → scoring pipeline fires → results on dashboard in ~2 minutes.

## 9.10 Nudge System (`src/lib/assessment/nudge-system.ts`)

When candidates don't respond after Aria finishes speaking:

| Context | First Nudge | Second Nudge (+ text fallback) | Final (advance) |
|---------|-------------|-------------------------------|-----------------|
| Phase 0 mic check | 15s | 30s | 45s |
| Act 1 scenarios | 20s | 40s | 60s |
| Act 2 probes | 15s | 30s | 45s |
| Act 3 reflective | 25s | 50s | 75s |
| Interactive elements | No nudge (element visible and tappable) | | |

- First: supportive, doesn't repeat question
- Second: offers text alternative, shows text input
- Final: advances assessment, scored as no-response (feeds disengagement red flag)
- Nudges use pre-configured contextual messages, not AI-generated

## 9.11 Voice Engine

### Agent Output: ElevenLabs TTS (`src/components/assessment/voice/tts-engine.ts`)

| Parameter | Value |
|-----------|-------|
| Model | Flash v2.5 (`eleven_flash_v2_5`) |
| Latency | ~75ms |
| Output format | mp3_44100_128 |
| Voice settings | stability: 0.6, similarity_boost: 0.8, style: 0.3, use_speaker_boost: true |
| Architecture | Text → sentence chunking → ElevenLabs streaming → Web Audio API (AudioContext → GainNode → AnalyserNode) → real-time amplitude → orb displacement. `onPlaybackStart(totalDurationSec)` callback reports audio duration for synchronized word reveal. |
| Server proxy | `src/app/api/assess/[token]/tts/route.ts` (token auth, rate-limited 60/min) |
| Fallback | Browser SpeechSynthesis if ElevenLabs unavailable |
| Cost | ~$0.50–$1.00 per assessment (~35,000 chars) |

### Candidate Input: Web Speech API (`src/components/assessment/voice/mic-button.tsx`)

- Browser-native `SpeechRecognition` (en-US), continuous mode
- Push-to-talk via mic button with visual indicator
- 2s silence auto-stop after final results
- `onTranscript` fires once in `onend` handler (accumulated final transcript)
- Falls back to text input if browser doesn't support speech APIs

### Environment Variables
```
ELEVENLABS_API_KEY=        # API key from ElevenLabs dashboard
ELEVENLABS_VOICE_ID=       # Selected British female voice ID
```

## 9.12 Stage Interface Components

| Component | File | Purpose |
|-----------|------|---------|
| AssessmentStage | `src/components/assessment/stage/assessment-stage.tsx` | Top-level orchestrator: Phase 0, transitions, TTS, nudges, sentence sequencing, all UI state |
| AssessmentOrb | `src/components/assessment/orb/assessment-orb.tsx` | Canvas-rendered fluid sphere with OrbRenderer. CANVAS_PADDING 1.6, `closest-side` radial mask for seamless edge blending. |
| OrbRenderer | `src/components/assessment/orb/orb-renderer.ts` | 2D canvas rendering: neural particles, fluid currents, aura, ripples. R = RES * 0.44. |
| SubtitleDisplay | `src/components/assessment/stage/subtitle-display.tsx` | Per-sentence word-by-word reveal with crossfade transitions (300ms); `stripMarkdown()` safety net |
| ScenarioReferenceCard | `src/components/assessment/stage/scenario-reference-card.tsx` | Persistent structured card (Act 1): progressive reveal via `RevealBlock`, role badge, sections, new info, question. Amber highlights for problem sections. |
| Phase0BreakScreen | `src/components/assessment/stage/phase0-break-screen.tsx` | 20-second number countdown below orb between Phase 0 and Act 1 with Continue button |
| ProgressBar | `src/components/assessment/stage/progress-bar.tsx` | Three-segment with dots, hidden during Phase 0 |
| ActLabel | `src/components/assessment/stage/act-label.tsx` | JetBrains Mono, 9px, uppercase, --aci-gold |
| MicButton | `src/components/assessment/voice/mic-button.tsx` | 52px circle, push-to-talk, green active state |
| TTSEngine | `src/components/assessment/voice/tts-engine.ts` | ElevenLabs streaming + Web Audio + fallback. `speak()` accepts `onPlaybackStart(totalDurationSec)` callback for subtitle sync. |
| LivingBackground | `src/components/assessment/background/living-background.tsx` | Animated canvas: aurora nebulae + particle field |
| ChoiceCards | `src/components/assessment/interactive/choice-cards.tsx` | Vertical tappable answer cards |
| TimedChallenge | `src/components/assessment/interactive/timed-challenge.tsx` | 30s countdown with color transitions |

---

# 10. Access Control & Onboarding ✅

## 10.1 Invite-Only Access Model (v1.8)

Nobody can self-register. Two rules:
1. **Domain email + invitation = internal user** with invited role
2. **Non-domain email + invitation = External Collaborator** (automatic override)

## 10.2 Organization Provisioning

**Script:** `scripts/provision-org.ts`

```bash
npx tsx scripts/provision-org.ts \
  --name "Acme Industries" \
  --domain "acme.com" \
  --admin-email "admin@acme.com" \
  --admin-name "Jane Doe"
```

Creates: Organization (with `domain`), first user (TA_LEADER role), cloned role templates with weights and cutlines. Sends setup email via Resend.

## 10.3 Team Invitation Flow

1. TA_LEADER+ creates invitation from `/settings/team`
2. `canAssignRole()` validated server-side; 7-day expiry token
3. Branded email sent (includes OAuth mention)
4. Recipient authenticates via Google OAuth, Microsoft OAuth, or email/password at `/login`
5. No Prisma User → auth status = `needs_onboarding` → redirect to `/onboarding`
6. Onboarding validates pending TeamInvitation for user's email
7. Domain detection: matching domain → invited role; non-matching → EXTERNAL_COLLABORATOR
8. Prisma User created + TeamInvitation marked ACCEPTED in single transaction
9. Redirect to `/dashboard`

## 10.4 Auth Flow

| Component | Detail |
|-----------|--------|
| Three-tier status | unauthenticated → needs_onboarding → authenticated |
| Session check | `getSession()` checks `user.isActive` — blocks deactivated users |
| OAuth providers | Google (`"google"`), Microsoft (`"azure"`) |
| Callback | `/auth/callback` with open-redirect prevention (`next` must start with `/`, not `//`) |
| Middleware | Protects dashboard routes, redirects unauthenticated to `/login` |
| `/signup` | Redirects to `/login` (self-registration removed) |

**Implementation files:** `src/lib/auth.ts`, `src/lib/supabase/middleware.ts`, `src/app/auth/callback/route.ts`, `src/app/api/onboarding/route.ts`

## 10.5 Team Management Security

| Guard | Description |
| :---- | :---- |
| Peer-level modification | Cannot modify users at or above your ROLE_LEVEL |
| Last-TA_LEADER protection | Prevents demoting/deactivating the sole active TA_LEADER |
| Hard Supabase ban/unban | Deactivation must succeed before Prisma update (no silent failures) |
| canAssignRole | All role assignment paths validate assigner permissions |
| EC auto-assignment | Determined by domain matching, not manually assignable |
| CLI user linking | CLI-provisioned users (null supabaseId) require valid pending TeamInvitation |
| Open redirect prevention | Auth callback validates `next` parameter |
| EC API guards | 6 routes return 403 for EC role |

---

# 11. API Specification ✅

All endpoints require authentication except assessment token routes. Payloads filtered by RBAC role.

## 11.1 Assessment APIs

| Method | Path | Description |
| :---- | :---- | :---- |
| POST | /api/assess/[token]/chat | Streaming chat: validates token, loads AssessmentState, runs classification + state machine, streams AI response. Rate: 30/min. Also handles `phase_0_complete` and `phase_0_message` triggers. |
| POST | /api/assess/[token]/complete | Finalize + trigger scoring pipeline. Rate: 5/min. TOCTOU-protected. Retry with backoff. |
| POST | /api/assess/[token]/response | Submit item response with timing. Rate: 60/min. |
| POST | /api/assess/[token]/survey | Post-assessment experience survey. |
| POST | /api/assess/[token]/tts | ElevenLabs TTS proxy. Token auth, rate: 60/min, cost tracking. |

## 11.2 Candidate Management

| Method | Path | Description |
| :---- | :---- | :---- |
| GET | /api/candidates | List (paginated, filterable). EC filtered by assignment. |
| POST | /api/candidates/[id]/notes | Add note. 403 for EC. |
| POST | /api/candidates/[id]/outcomes | Record post-hire outcome data. |
| GET | /api/candidates/batch-status | Bulk status check. 403 for EC. |
| GET/POST/DELETE | /api/candidates/[id]/assignments | Manage EC candidate assignments. TA_LEADER+ only. |

## 11.3 Invitation Management

| Method | Path | Description |
| :---- | :---- | :---- |
| POST | /api/invitations | Create single invitation + send email. 403 for EC. |
| GET | /api/invitations | List invitations (org-filtered). |
| POST | /api/invitations/batch | Batch CSV invite. 403 for EC. |
| GET/PATCH | /api/invitations/[id] | Individual invitation management. 403 for EC. |

## 11.4 Role Builder & Management

| Method | Path | Description |
| :---- | :---- | :---- |
| POST | /api/roles/analyze | AI-powered role analysis (from JD or form input). |
| POST | /api/roles | Create custom role with weights/cutlines. |
| GET/PUT | /api/roles/[id] | Retrieve/update role details. |
| POST | /api/roles/[id]/rationale | Generate/update research rationale. |
| GET | /api/roles/[id]/rationale/pdf | Export rationale as PDF. |

## 11.5 Team Management

| Method | Path | Description |
| :---- | :---- | :---- |
| PATCH | /api/team/[userId] | Modify role/status. TA_LEADER+. Peer-level guard + last-TA_LEADER protection. |
| POST | /api/team/invite | Create invitation. TA_LEADER+. canAssignRole() enforced. |
| POST/DELETE | /api/team/invite/[invitationId] | Resend (rate: 5/hr) or revoke. |
| POST | /api/team/accept | Accept invitation. Rate: 10/min/IP. Strong password policy. |
| POST | /api/onboarding | OAuth user linking with TeamInvitation. |

## 11.6 Export & PDF

| Method | Path | Description |
| :---- | :---- | :---- |
| GET | /api/export/data?type=items\|constructs\|full&format=csv\|json | Data export (TA_LEADER+). |
| GET | /api/export/pdf/[candidateId] | Scorecard PDF. |
| GET | /api/export/pdf/[candidateId]/interview-kit | Interview guide PDF. |
| GET | /api/export/pdf/[candidateId]/one-pager | HM summary one-pager PDF. |

## 11.7 Notifications & Email

| Method | Path | Description |
| :---- | :---- | :---- |
| GET | /api/notifications | Live notifications from DB state. Org-scoped. Types: completed assessments, awaiting decisions, started assessments, critical red flags. |
| POST | /api/email/results | Send result email to candidate. |
| GET | /api/cron/send-results | Scheduled results (CRON_SECRET auth, 7-day delay, duplicate prevention). |

## 11.8 Development Tools

| Method | Path | Description |
| :---- | :---- | :---- |
| POST | /api/dev/impersonate | Role impersonation for testing. Development only (NODE_ENV=development). Sets `__dev_role` cookie. |

---

# 12. Frontend Application ✅

## 12.1 Design System

**Colors:**
| Token | Hex | Usage |
| :---- | :---- | :---- |
| --aci-navy | #0F1729 | Primary backgrounds |
| --aci-blue | #2563EB | Actions, Cognitive Core layer |
| --aci-green | #059669 | Success, Strong Fit, Technical Aptitude layer |
| --aci-amber | #D97706 | Warning, Conditional Fit, Behavioral Integrity layer |
| --aci-red-muted | #9B1C1C | Not a Direct Fit |
| --aci-red | #DC2626 | Critical flags only |
| --aci-gold | #C9A84C | Accents, assessment act labels |
| --aci-slate | #64748B | Secondary text, borders |

**Typography:** DM Sans (body), Inter (system-ui fallback), JetBrains Mono (code/labels).

**Status Badges:**
| Status | Label | Styling |
| :---- | :---- | :---- |
| RECOMMENDED | ✓ STRONG FIT — Advance to Interview | Green bg |
| REVIEW_REQUIRED | ⚠ CONDITIONAL FIT — Review Recommended | Amber bg |
| DO_NOT_ADVANCE | ○ NOT A DIRECT FIT — Consider Alternative Roles | Muted red-gray bg |
| INCOMPLETE | ○ IN PROGRESS | Gray bg |

## 12.2 Key Routes

| Route | Purpose |
| :---- | :---- |
| /dashboard | Pipeline cards, attention items, quick stats, candidate table |
| /candidates/[id] | Candidate profile: decision summary, spider chart, intelligence report, layer results, predictions, interview guide, notes |
| /roles | Role heatmap with 12-construct candidate matrix |
| /roles/[slug] | Role detail: cutlines, constructs, candidate roster |
| /roles/builder | AI-powered Role Builder (TA_LEADER+) |
| /compare | 2–3 candidates side-by-side |
| /invitations/batch | CSV batch import |
| /settings/team | Team management (TA_LEADER+) |
| /admin | Organizations table (ADMIN) |
| /tutorial/* | Demo mode with demo org data |
| /demo | Demo landing + mini assessment |

---

# 13. Security & Compliance

## 13.1 Data Protection ✅

- Encryption at rest (Supabase PostgreSQL) and in transit (HTTPS via Vercel)
- Server-side field-level RBAC filtering via `filterCandidateForRole()`
- Multi-tenant org scoping on all queries
- Sentry error monitoring (edge + server + client)
- Activity logging via ActivityLog model
- Prompt injection prevention: `sanitizeForPrompt()` strips control chars, enforces length limits
- In-memory sliding-window rate limiting on all assessment + team endpoints
- Peer-level modification guard + last-TA_LEADER demotion guard
- Hard Supabase ban/unban (no silent failures)
- `isActive` enforcement in `getSession()`
- HTML escaping (`escapeHtml()`) on all email templates with user input
- Input length validation on public form submissions
- Mass assignment prevention (supabaseId removed from public POST body)
- BOLA prevention on AI probe endpoint
- TOCTOU protection on assessment completion
- Two-turn prompt injection prevention (XML tags stripped from conversation history)
- Scoring pipeline retry with exponential backoff
- Concurrency-limited fan-out (max 6 parallel AI calls via pLimit)
- Auth callback open-redirect prevention

**Pending:** SOC 2 Type II audit, GDPR/CCPA consent workflows, data retention policy, Redis-backed rate limiting (Upstash)

## 13.2 Assessment Integrity ✅

- Token-based assessment auth (no candidate account required)
- 12 automated integrity checks (see Section 8.4)
- Response timing analysis
- Triple-evaluation scoring with variance flagging
- Consistency validation (Act 1 vs Act 3)
- Full audit trail of all AI interactions + item responses
- 7-day invitation expiry
- Domain-neutral item bank (no familiarity bias)

**Pending:** Physical proctored environment, photo ID verification

## 13.3 Legal Defensibility

- Content validity: each subtest linked to critical job tasks
- Criterion-related validity: target r > 0.60 with 90-day performance
- Construct validity: target α > 0.80 per subtest
- No demographic data collected by assessment
- ADA compliance: extended time, screen readers, alternative input
- Adverse impact analysis (Phase 2) with 4/5ths rule using customer-provided demographic data

---

# 14. Success Metrics

## 14.1 Product Adoption

| Metric | Target | Timeframe |
| :---- | :---- | :---- |
| Assessment volume | 500+/month | Month 6 |
| Pipeline integration | 95%+ external hires assessed before interview | Month 6 |
| Dashboard DAU | 80% of recruiting team | Month 3 |

## 14.2 Hiring Efficiency

| Metric | Target | Baseline |
| :---- | :---- | :---- |
| Time-to-hire reduction | 40% | 38–40 days (Hadrian) |
| Interview-to-offer ratio | <3:1 | Currently 5:1+ |
| SME time savings | 60%+ | SMEs evaluate every candidate |
| "Soft Yes/Soft No" elimination | <10% indecisive | Currently 40%+ |

## 14.3 Predictive Validity

| Metric | Target |
| :---- | :---- |
| 90-day attrition (ACI-screened) | <8% |
| Learning Velocity vs actual ramp | r > 0.65 |
| Technical Aptitude vs 6-month ratings | r > 0.60 |
| Supervision load prediction accuracy | 75%+ |

## 14.4 Platform Performance

| Metric | Target |
| :---- | :---- |
| Dashboard load (100 candidates) | <1 sec |
| Profile load (summary) | <500ms |
| Search | <300ms |
| PDF generation | <2 sec |

---

# 15. Roadmap

## Shipped Releases

| Version | Key Feature | Date |
|---------|------------|------|
| v1.0 | Full assessment platform + dashboard + scoring | March 2026 |
| v1.2 | Role Builder + email system + PDF exports + batch CSV | March 2026 |
| v1.3 | Domain-adaptive engine + generic aptitude + security hardening | March 2026 |
| v1.4 | V2 conversational assessment + 3-layer scoring + 86-item bank | March 2026 |
| v1.5 | V1 removal + single modality + schema cleanup | March 2026 |
| v1.6 | Aria experience + orb UI + ElevenLabs TTS + Phase 0 + nudges | March 2026 |
| v1.7 | Org-scoped access routing + team security hardening | March 2026 |
| v1.8 | Invite-only access model + OAuth + EC role + field-level RBAC | March 2026 |
| v1.9 | Phase 0 transition hardening + PRD restructuring + dev tools | March 2026 |
| v1.10 | Orb refinements + universal sentence subtitles + progressive reference reveal | March 2026 |
| v1.11 | TTS/subtitle sync + orb glide transition + break screen refinement | March 2026 |

## Next Priorities (v2.0)

- Weekly Pipeline Digest Email (infrastructure ready, needs content + scheduling)
- Adverse Impact Report (requires customer demographic data)
- Shareable HM link (no-login, token-auth, 72-hour expiry, mobile-first)
- HM Approval Actions (thumbs-up/down/more-info from shareable link)
- Enhanced notifications (configurable frequency, 48-hour reminders)
- Scoring engine simulation report (N=1,000 synthetic profiles)
- Redis-backed rate limiting (Upstash — replace in-memory for Vercel serverless)

## v3.0 Scope

- ATS integration (Greenhouse, Lever) with bidirectional webhooks
- Cohort analytics + quality-of-hire dashboard
- Training Readiness Report
- Norming database (10,000+ assessments)
- Physical assessment center deployment
- Full IRT-based CAT with real-time θ estimation
- AI-generated Intelligence Reports (Claude-generated narratives)
- Spanish language support
- Mobile-native recruiter app
- Enterprise SSO

---

# 16. Domain-Adaptive Assessment Engine ✅

The entire pipeline is role-aware. Extracted JD data (environment, skills, tasks, error consequences) is persisted as `jdContext` on the Role model and threaded through probes, narratives, and predictions.

**Key files:**
| File | Purpose |
| :---- | :---- |
| `src/lib/assessment/role-context.ts` | `getRoleContext(roleId)` — loads structured role context from jdContext |
| AI probe routes | Receive role context for domain-relevant probe generation |
| `src/lib/assessment/narratives.ts` | Narratives append role-contextualized sentences |
| `src/lib/predictions.ts` | Prediction descriptions enriched with role context |

Falls back to domain-neutral when jdContext is null or role is generic.

---

# 17. Generic Aptitude Assessment ✅

Assessment path for candidates not tied to a specific role.

- **Equal weights:** ~8.33 per construct (100/12)
- **Moderate cutlines:** 25th percentile across all dimensions
- **isGeneric flag:** Triggers domain-neutral behavior throughout
- **Cross-role fit rankings:** Scoring pipeline computes composites for every non-generic role in the org. Persisted as CompositeScore records. Displayed as ranked fit list in candidate profile.

**Key files:** `src/lib/assessment/role-fit-rankings.ts`, `src/components/profile/role-fit-rankings.tsx`

---

# 18. Email System ✅

## Templates (`src/lib/email/templates/`)

| Template | Trigger | Content |
| :---- | :---- | :---- |
| `invitation.ts` | POST /api/invitations | Candidate name, role, company, link, expiry. "Before You Begin" section (voice format, quiet environment, mic required, 60–90 min, headphones recommended). |
| `team-invite.ts` | POST /api/team/invite | Invitee name, role, org, accept CTA, OAuth mention. Role-specific description including EC. |
| `org-admin-welcome.ts` | provision-org.ts CLI | Welcome with pre-configured roles, OAuth mention, getting-started. |
| `results.ts` | /api/email/results or /api/cron/send-results | Results summary + view link. |

All templates with user input apply `escapeHtml()`.

---

# 19. Test Infrastructure

## Test Setup Script (`scripts/test-setup.ts`)

```bash
npx tsx scripts/test-setup.ts           # Create test data
npx tsx scripts/test-setup.ts --reset   # Clean up all test data
```

Creates in the Arklight org:
- **5 test users** (one per role: Recruiter, Rec Manager, Hiring Manager, TA Leader, External Collaborator)
- **2 pending team invitations** (for onboarding flow testing)
- **3 test candidates** (Pending/INVITED, InProgress/INCOMPLETE, Completed/RECOMMENDED) with assessment links

**Password:** `ACI-test-2024!` (configurable via `TEST_USER_PASSWORD` env var)

## Development Tools

| Tool | File | Purpose |
|------|------|---------|
| Role impersonation API | `src/app/api/dev/impersonate/route.ts` | Switch role via `__dev_role` cookie. NODE_ENV=development only. |
| Role switcher UI | `src/components/dev/role-switcher.tsx` | Dropdown to switch between all roles for RBAC testing. |

---

# 20. Implementation Statistics

| Metric | Count |
| :---- | :---- |
| API Route Handlers | 25+ |
| Page Routes | 28+ |
| Database Models (Prisma) | 21 |
| Assessment Constructs | 12 |
| Assessment Modalities | 1 (conversational with Aria) |
| Interactive Element Types | 6 |
| Item Bank | 86 items across 5 constructs |
| Scenario Shells | 4 (6 beats each = 24 encounters) |
| Construct Rubrics | 12 (3–5 indicators each) |
| User Roles (RBAC) | 6 |
| Red Flag Checks | 12 |
| Scoring Layers | 3 |
| Ceiling Types | 5 |
| Prediction Models | 4 |
| PDF Export Types | 3 |
| Email Templates | 4 |
| Zustand Stores | 2 (chat-assessment-store, app-store) |
| Rate-Limited Endpoints | 7 |

---

*End of Document*

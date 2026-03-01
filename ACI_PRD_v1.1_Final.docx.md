

**ACI**

Arklight Cognitive Index

**PRODUCT REQUIREMENTS DOCUMENT**

Final Specification

*Scalable Talent Assessment Intelligence*

*for Advanced Manufacturing & Defense*

Version 1.1  •  February 2026  •  Confidential

Supersedes: NAIB Engineering PRD v3.0, NAIB PRD v4, ACI Finalization Doc

Incorporates: User Persona Analysis (Tasha Aquino Vance, Kevin O’Shea)

# **Table of Contents**

# **1\. Executive Summary**

ACI (Arklight Cognitive Index) is a full-stack talent assessment intelligence platform purpose-built for advanced manufacturing and defense companies scaling beyond artisanal hiring methods. It assesses candidates across 12 cognitive, technical, and behavioral constructs using a hybrid of standardized items and AI-adaptive follow-ups, then delivers decision-ready results through an intelligent dashboard, candidate profiling system, and deployment planning engine.

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

| Layer | Choice | Rationale |
| :---- | :---- | :---- |
| Framework | Next.js 14+ (App Router) | SSR \+ API routes in one codebase |
| Language | TypeScript | Type safety across full stack |
| Database | Supabase (PostgreSQL) | Free tier; built-in auth, realtime, row-level security |
| Auth | Supabase Auth | Email/password \+ magic link; RBAC via custom claims |
| ORM | Prisma | Type-safe queries, migration management |
| UI | Tailwind CSS \+ shadcn/ui | Consistent design system, fast iteration |
| Charts | Recharts | React-native, lightweight, excellent radar chart support |
| AI Engine | Anthropic API (Claude) | AI-adaptive follow-up question generation \+ response analysis |
| Deployment | Vercel | Free tier, native Next.js support, preview deploys |
| PDF Export | @react-pdf/renderer | Server-side PDF generation for candidate scorecards |
| State | Zustand or React Context | Lightweight; no Redux overhead |

Cost at launch: $0/month. Supabase free tier (500MB DB, 50k auth users), Vercel free tier (100GB bandwidth), Anthropic API pay-per-use (\~$0.50–2.00 per candidate assessment for AI follow-ups).

## **4.2 Project Structure**

The application follows Next.js App Router conventions with clear separation between authenticated dashboard routes, candidate-facing assessment routes, and API endpoints:

| Directory | Purpose |
| :---- | :---- |
| prisma/ | Data model (schema.prisma) \+ mock data seeder (seed.ts) |
| src/app/(auth)/ | Login, request access, forgot-password |
| src/app/(dashboard)/candidates/ | Dashboard list view \+ individual candidate profiles |
| src/app/(dashboard)/analytics/ | Pipeline analytics (Phase 2+) |
| src/app/(dashboard)/settings/ | Org settings, cutlines, roles |
| src/app/assess/\[sessionId\]/ | Candidate-facing assessment sessions (Phase 3\) |
| src/app/api/ | API routes: candidates, assessments, scoring, AI, export |
| src/components/ | UI primitives (shadcn), dashboard, profile, charts, assessment components |
| src/lib/ | Supabase config, scoring engine, cutline logic, AI prompts, mock data, types |

## **4.3 Build Order (Phased Milestones)**

Each phase is independently deployable. Phase 1 ships with seeded mock data; later phases replace mock data with the real pipeline.

| Phase | Deliverable | Rationale |
| :---- | :---- | :---- |
| Phase 1 | Dashboard \+ Candidate Profile (seeded with mock data) | Most visible to buyers; validates the “output” story |
| Phase 2 | Data Model \+ Scoring Engine | Backend foundation that replaces mock data with real calculations |
| Phase 3 | Assessment Delivery Platform (hybrid: fixed items \+ AI follow-ups) | Candidate-facing test experience |
| Phase 4 | Integration Layer (PDF export, webhooks, CSV export, ATS) | Connects to customer workflows |

# **5\. Data Model**

The data model is implemented in Prisma ORM targeting Supabase PostgreSQL. All entities support multi-tenancy via Organization scoping and RBAC enforcement at the API layer.

## **5.1 Core Entities**

### **Organization & Users**

| Model | Key Fields | Notes |
| :---- | :---- | :---- |
| Organization | id, name, createdAt | Multi-tenant root: “Anduril”, “Hadrian” |
| User | id, email, name, role (UserRole enum), orgId | RBAC enforced via role field |

UserRole enum values: RECRUITER\_COORDINATOR, RECRUITING\_MANAGER, HIRING\_MANAGER, TA\_LEADER, ADMIN.

### **Roles & Cutlines**

| Model | Key Fields | Notes |
| :---- | :---- | :---- |
| Role | id, name, slug, description, orgId | Five default roles; org-specific customization supported |
| Cutline | roleId, orgId, technicalAptitude, behavioralIntegrity, learningVelocity, overallMinimum | Minimum percentile thresholds per role per org |
| CompositeWeight | roleId, constructId, weight (0.0–1.0) | 12 weights per role, sum to 1.0; research-validated defaults |

### **Candidates & Assessments**

| Model | Key Fields | Notes |
| :---- | :---- | :---- |
| Candidate | firstName, lastName, email, phone, orgId, primaryRoleId, status | Status: INCOMPLETE, SCORING, RECOMMENDED, REVIEW\_REQUIRED, DO\_NOT\_ADVANCE |
| Assessment | candidateId, startedAt, completedAt, durationMinutes | One-to-one with Candidate; contains all test session data |
| AssessmentInvitation | candidateId, roleId, invitedBy, invitedAt, expiresAt, status, linkToken | NEW: Invitation flow for candidate onboarding to assessment |
| SubtestResult | assessmentId, construct, layer, rawScore, percentile, theta, standardError, responseTimeAvgMs, calibrationScore, narrativeInsight | One per construct per assessment (12 total) |
| CompositeScore | assessmentId, roleSlug, indexName, score, percentile, passed, distanceFromCutline | One per role per assessment (5 total; enables Role Switcher) |

### **AI Interactions & Integrity**

| Model | Key Fields | Notes |
| :---- | :---- | :---- |
| AIInteraction | assessmentId, construct, sequenceOrder, triggerItemId, triggerResponse, aiPrompt, candidateResponse, aiAnalysis, scoreAdjustment | Full audit trail of AI-adaptive follow-up exchanges |
| Prediction | assessmentId, rampTimeMonths, rampTimeLabel, supervisionLevel, ceilingLevel, attritionRisk | Template-driven predictions (Phase 1); AI-generated (Phase 3+) |
| RedFlag | assessmentId, flagType, severity (CRITICAL/WARNING), description, evidence | Automated integrity checks (see Red Flag Detection rules) |
| Note | candidateId, userId, content, createdAt | User-authored notes with edit/delete own only |

## **5.2 Construct & Layer Enums**

ACI assesses 12 constructs organized into three layers. These enums are referenced throughout the scoring engine, dashboard, and candidate profiles.

| Layer | Constructs | Dashboard Color |
| :---- | :---- | :---- |
| Cognitive Core (5) | Fluid Reasoning, Executive Control, Cognitive Flexibility, Metacognitive Calibration, Learning Velocity | Blue (\#2563EB) |
| Technical Aptitude (5) | Systems Diagnostics, Pattern Recognition, Quantitative Reasoning, Spatial Visualization, Mechanical Reasoning | Green (\#059669) |
| Behavioral Integrity (2) | Procedural Reliability, Ethical Judgment | Amber/Orange (\#D97706) |

## **5.3 Assessment Invitation Model (New)**

The prior PRD covered the Assessment (candidate-side) and Dashboard (recruiter-side) but never specified how a candidate gets invited to take the assessment. This gap is now closed:

* Recruiter clicks “Invite to Assess” from the candidate table → selects role → system generates a unique link

* Candidate receives branded ACI assessment invitation email with a secure, time-limited link

* AssessmentInvitation tracks: candidateId, roleId, invitedBy (userId), invitedAt, expiresAt, status (PENDING / STARTED / COMPLETED / EXPIRED), linkToken

* Link token authenticates the candidate for the assessment session without requiring account creation

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

| Role Flexibility *Per Tasha’s discovery feedback, these five roles are starting templates, not hardcoded constraints. A Custom Role Builder (Phase 2\) will allow customers to adjust construct weights for evolving role definitions as companies transition from R\&D to high-rate production. The validation protocol applies equally to custom role configurations.* |
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

# **8\. Scoring Engine (Phase 2\)**

## **8.1 Composite Index Calculation**

The scoring engine calculates a weighted composite index for each candidate against each of the 5 roles. The endpoint (POST /api/scoring/calculate) takes the candidate’s SubtestResult array plus a target role slug, and returns the composite score, percentile, pass/fail determination, status, and distance from cutline.

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

Automated post-scoring integrity checks run after every assessment completion:

| Flag | Condition | Severity |
| :---- | :---- | :---- |
| Behavioral consistency failure | \>2 SD between parallel SJT scenarios | CRITICAL |
| Extreme overconfidence | Calibration bias \>30% overconfident | WARNING |
| Speed-accuracy mismatch | Bottom 10% accuracy \+ top 10% speed | WARNING |
| Incomplete assessment | \>2 constructs with no data | CRITICAL |
| Random responding pattern | Response time \<2s on \>30% of items | CRITICAL |
| AI interaction refusal | \<10 word responses on \>50% of AI follow-ups | WARNING |

## **8.5 Prediction Generation**

Phase 1 uses template-driven predictions keyed to score profiles. Phase 3+ will use AI-generated predictions from the combination of scores and full AI interaction transcripts.

### **Ramp Time Prediction**

| Learning Velocity | Tech Aptitude Avg | Prediction |
| :---- | :---- | :---- |
| ≥80th | ≥75th | 1–2 months (accelerated) |
| ≥60th | ≥60th | 3–4 months (standard) |
| ≥40th | Any | 4–5 months (extended) |
| \<40th | Any | 5–6+ months (significant investment) |

### **Supervision Load Prediction**

Based on the average of Cognitive Flexibility (error recovery proxy), Metacognitive Calibration, and Executive Control percentiles: ≥75th \= LOW supervision, ≥50th \= MEDIUM, \<50th \= HIGH.

## **8.6 Scoring Engine Simulation & Validation Spec**

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

# **9\. Assessment Delivery Platform (Phase 3\)**

The assessment uses five measurement paradigms combined into a single proctored session. Total estimated duration: 90–120 minutes. The platform is optimized for in-person, proctored testing at dedicated assessment centers with standardized equipment.

## **9.1 Measurement Paradigms**

| Paradigm | Constructs | Mechanics |
| :---- | :---- | :---- |
| 1: Adaptive Difficulty | 7 constructs (all Cognitive Core \+ Technical Aptitude except Pattern Recognition) | Item banks ordered easy → hard. MVP: pre-ordered. V2: full CAT with IRT. |
| 2: Accuracy \+ Response Time | Executive Control, Cognitive Flexibility, Pattern Recognition | Capture correctness AND millisecond timing. 4 quadrants: Optimal, Competent-but-inefficient, Impulsive, Insufficient. |
| 3: Confidence Calibration | Embedded across all constructs | After every 3–5 items: “How confident are you?” (50–100% scale). Brier score \= mean((confidence − accuracy)²). |
| 4: Situational Judgment Tests | Procedural Reliability, Ethical Judgment | Realistic manufacturing scenarios → “Select MOST and LEAST effective action.” Scored against SME consensus. |
| 5: Behavioral Consistency | Embedded in Paradigm 4 | Structurally parallel scenarios at different assessment points. Consistency coefficient computed across pairs. |

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

MVP Implementation: pre-ordered item banks (easy → hard) with difficulty metadata tagged per item. The system progresses through the bank and records the last-passed and first-failed difficulty levels. This approximates full CAT without requiring a real-time IRT estimation engine.

V2 Implementation: full IRT-based CAT with real-time θ estimation, item selection from calibrated item pools, and adaptive stopping rules. Based on CAT-ASVAB methodology (in operational use since 1992, 40+ million administrations, withstood 30+ years of legal scrutiny).

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

Two specialized prompt templates drive the ceiling-probing system:

### **Ceiling Probe Generation Prompt**

Receives: construct definition, candidate response pattern, accuracy rate, timing data, estimated ceiling difficulty level. Generates: one follow-up question that specifically probes the nature of the ceiling (hard vs. soft, domain-specific vs. general). Returns structured JSON with question text, probe target, and expected strong vs. weak response criteria.

### **Probe Analysis Prompt**

Receives: construct definition, the probe question asked, the candidate’s open-ended response, response time. Returns structured JSON with: ceiling type classification, evidence strength (0.0–1.0), narrative fragment for the Intelligence Report, training recommendation, and whether an additional probe is needed.

## **9.4 Assessment UI Requirements**

* Full-screen mode, no browser chrome

* Progress bar: blocks completed \+ estimated time remaining

* Per-question timer visible on timed items; auto-advance on time expiry

* No back button (prevents gaming)

* AI probe text area with character counter \+ Submit button

* Loading state while AI generates next question (“Analyzing your response…”)

* Visual transition between fixed items and AI probes (subtle but distinct so candidate understands the format shift)

* Responsive but optimized for desktop/tablet (in-person proctored environment)

## **9.5 Item Bank (MVP Minimum)**

* Cognitive Core constructs: 6–8 fixed items each, tagged with difficulty parameters (easy/medium/hard at minimum; IRT calibrated values for V2)

* Technical Aptitude constructs: 6–8 fixed items each with difficulty tags

* Behavioral Integrity: 6–8 SJT scenarios each (with 2–3 parallel pairs for consistency checks)

* Total: \~80–100 fixed items \+ \~20–30 AI-generated probes per candidate dynamically

## **9.6 Delivery Infrastructure**

* Physical assessment centers with controlled access, proctored environment, standardized equipment

* Capacity: minimum 20 simultaneous test-takers per session

* Equipment: standardized workstations with touch screens for simulation tasks

* Initial locations: Los Angeles, Phoenix, Ohio (expand based on customer concentration)

* Scheduling: flexible session times (weekday evenings, weekends) for employed candidates

# **10\. Frontend Application Specification**

The frontend is organized around five primary views plus an interactive demo. Navigation is via a sticky top bar: Dashboard • Roles • Compare • \[Demo\] • \[User\].

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

## **10.2 Dashboard (Landing Page)**

Route: /dashboard. This is the first thing users see after login. It combines pipeline health overview with the full candidate list.

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

## **10.3 Roles Heatmap View**

Route: /roles. A role-specific heatmap showing all assessed candidates on a grid of 12 constructs. Role selector dropdown at the top triggers full recalculation.

### **Heatmap Design**

| Percentile Range | Color | Label |
| :---- | :---- | :---- |
| ≥ 90th | Deep green (\#065F46) | Exceptional |
| 75–89th | Medium green (\#059669) | Strong |
| 50–74th | Light blue-gray (\#94A3B8) | Average |
| 25–49th | Light amber (\#F59E0B) | Below Average |
| \< 25th | Muted red (\#DC2626) | Concern |

Cell content: percentile number centered in colored cell. Columns grouped visually by layer with colored top borders (Blue for Cognitive, Green for Technical, Orange for Behavioral). Weighted column highlighting: for the selected role, columns with higher weights appear slightly wider or have a gold left-border. Cutline overlay: thin dashed line between the last passing candidate and the first failing candidate.

## **10.4 Candidate Profile**

Route: /candidates/\[id\]. Three-column layout optimized for hiring decisions. Progressive disclosure: Level 1 (3 seconds) shows pass/fail; Level 2 (30 seconds) shows why and predictive insights; Level 3 (3+ minutes) provides detailed construct breakdowns and question-level data.

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

## **10.5 Candidate Comparison View**

Route: /compare?ids=cuid1,cuid2,cuid3. Supports 2–3 candidates side-by-side with overlaid spider chart (semi-transparent fills, different colors per candidate), construct-by-construct table with winner highlighting (gold background on highest score), predictions comparison row, and one-sentence key insight per candidate. Role switcher at top recalculates all scores.

## **10.6 Interactive Demo**

Route: /demo. A self-contained 2–3 minute experience accessible from the top nav \[Demo\] button even without assessment data. Four stages: (1) Mini Assessment (4 questions sampling spatial, pattern recognition, SJT, and AI follow-up), (2) Cinematic Loading (particle animation with progress stages), (3) Synthetic Results (pre-seeded candidate profile with all features populated), (4) Self-Guided Exploration with callout tooltips.

# **11\. New Deliverables for Talent Teams**

These features go beyond the core assessment dashboard to transform ACI from a scoring tool into an indispensable hiring intelligence system. Each is grounded in specific persona needs identified through discovery.

## **11.1 Hiring Manager One-Pager (PDF)**

A single-page PDF designed specifically for the hiring manager audience. Not the full 5-page scorecard — a purpose-built, 60-second artifact that answers three questions: Should I interview this person? What should I ask about? What should I expect in their first 30 days?

### **Layout**

* Top strip: Candidate name, role, status badge, overall fit score, assessment date

* Left panel: Spider chart (compact, 200px) with role benchmark ring and three color-coded construct groups

* Center panel: Manager Quick-Start Card (5 bullet points, each one sentence)

* Right panel: Predictions row (Ramp Time, Supervision Load, Ceiling, Attrition Risk as icon \+ one word)

* Bottom strip: Two Interview Focus Questions generated from the candidate’s weakest constructs

Build priority: Phase 1\. Effort: \~1 week. This is the “one more thing” moment in the demo.

## **11.2 Weekly Pipeline Digest (Email)**

An automated weekly email sent every Monday at 7 AM to configured users (TA Leaders and Recruiting Managers). No login required to read it — key metrics are in the email body with a single “Open Dashboard” CTA.

* Pipeline summary: total assessed this week, cumulative, by role

* Pass rate trend: this week vs. last 4-week average with directional arrow

* Action needed: candidates awaiting decision \>48 hours, Conditional Fit needing review

* Top 3 candidates this week: name, role, fit score, one-line headline

* Quiet wins: candidates redirected from one role to another via Role Switcher

Build priority: Phase 2\. Effort: \~1 week.

## **11.3 Role Mismatch Redirect Engine**

When a candidate is marked “Not a Direct Fit” for their primary role, the system automatically calculates fit across all other active roles and surfaces recommendations. This turns a rejection into a redirect.

* In the decline flow: modal appears with alternative role fits that pass cutlines

* In the candidate profile: sidebar section shows all 5 role scores with pass/fail badges

* In the weekly digest: “Quiet wins” section highlights successful redirects

Build priority: Phase 1\. Effort: \~3 days.

## **11.4 Interview Prep Kit**

A structured interview guide auto-generated from the candidate’s assessment data. Delivered as a section within the candidate profile and as a downloadable PDF. Contains: recommended questions for each development area, what to listen for in responses, areas that are already validated (don’t re-test), and suggested interview format and time allocation.

Build priority: Phase 1\. Effort: \~1 week.

## **11.5 Notification System (New)**

* In-app notification bell (Phase 1\) with badge count

* Email notification system (Phase 2\) with configurable frequency: real-time, daily digest, or weekly summary

* Kevin’s alerts: “3 new assessments completed,” “Jordan Brooks has been waiting 48+ hours for a decision,” “New candidate matches your saved search”

* Tasha’s alerts: “Weekly pipeline digest: 12 assessed, 8 strong fit, pass rate up 4%,” “Monthly quality report ready for download”

## **11.6 Training Readiness Report**

Extends ACI’s value beyond the TA team to training and operations teams. For each candidate or cohort, generates a training needs analysis based on construct scores, recommended training program structure, expected time-to-competency benchmarks, and supervisor guidance for the first 90 days. This creates new internal champions beyond TA.

Build priority: Phase 3\. Effort: \~2 weeks.

## **11.7 Adverse Impact Report**

A basic adverse impact report showing pass rates by demographic group with 4/5ths rule calculation. This addresses Tasha’s primary adoption blocker (“Is this legally defensible?”). Assessment does not collect demographic data; adverse impact analysis uses customer-provided demographic data linked by candidate ID.

Build priority: Phase 2 (moved up from “out of scope” per persona analysis). Effort: \~1 week.

## **11.8 Cohort Analytics Dashboard**

Provides the ROI narrative for budget expansion. Pipeline health metrics, funnel conversion rates by assessment scores, validation reports, and quality-of-hire correlation tracking. Includes exportable slides for Tasha’s leadership presentations.

Build priority: Phase 4\. Effort: \~3–4 weeks.

# **12\. API Specification (Phase 4\)**

All endpoints require authentication. Payloads are filtered by RBAC role.

| Method | Path | Description |
| :---- | :---- | :---- |
| GET | /api/candidates | List (paginated, filterable by role, status, score range, date) |
| GET | /api/candidates/\[id\] | Full profile (RBAC-filtered payload) |
| PATCH | /api/candidates/\[id\]/status | Update candidate status |
| GET | /api/candidates/\[id\]/scores | All scores across all roles |
| GET | /api/candidates/\[id\]/scores/\[roleSlug\] | Composite for specific role |
| POST | /api/assessments | Create new assessment session |
| POST | /api/assessments/\[id\]/responses | Submit item response |
| POST | /api/assessments/\[id\]/ai-followup | Get AI follow-up question |
| POST | /api/assessments/\[id\]/ai-response | Submit response to AI follow-up |
| POST | /api/assessments/\[id\]/complete | Finalize \+ trigger scoring |
| POST | /api/invitations | Create assessment invitation (generates link \+ email) |
| GET | /api/export/pdf/\[candidateId\] | Generate 5-page PDF scorecard |
| GET | /api/export/pdf/\[candidateId\]/one-pager | Generate HM one-pager PDF |
| GET | /api/export/csv | Bulk export (filtered) |
| POST | /api/webhooks/assessment-complete | Outbound webhook to ATS |
| GET | /api/notifications | List notifications for current user |

## **12.1 ATS Integration**

* RESTful API for candidate data sync, assessment scheduling, results delivery

* Initial integrations: Greenhouse, Lever, custom ATS systems (Anduril and Hadrian may have bespoke systems)

* Bidirectional data flow: candidate moves from ATS to ACI for assessment, results flow back as structured data \+ PDF scorecard

* Webhooks: real-time notifications when assessment completed, when cutlines passed/failed

## **12.2 Export Formats**

* PDF Scorecard: 5-page branded document (Executive Summary, Composite Indices, Layer Results, Predictive Insights, Recommendations)

* HM One-Pager: 1-page purpose-built PDF for hiring manager audience

* CSV: bulk export for pipeline analysis with all specified columns

* JSON via API: structured data for programmatic integration

# **13\. Security, Compliance & Legal**

## **13.1 Data Protection**

* SOC 2 Type II compliance, encryption at rest and in transit

* Role-based access controls enforced at API and UI layers

* GDPR/CCPA compliance: candidate consent workflows, right to access/delete data, data retention policies aligned with customer requirements

## **13.2 Assessment Integrity**

* Proctored testing environment with controlled access

* Photo ID verification at check-in

* Response pattern analysis to detect cheating (random responding, speed-accuracy mismatch)

* Full audit trail of all interactions logged in database

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

## **15.1 The “Demo Day” Stack**

For the Anduril and Hadrian demos, the following features must be live and polished:

| \# | Feature | Status | Action |
| :---- | :---- | :---- | :---- |
| 1 | Dashboard with pipeline cards, candidate table, attention items | Built | Polish: ensure \<1s load, verify all 25 mock candidates render |
| 2 | Candidate Profile with Intelligence Report | Built | Polish: verify all 6 panels render with meaningful content |
| 3 | Spider Chart with Role Switcher \+ visual diff animation | Partial | Add: green/amber pulse animation on role switch |
| 4 | HM One-Pager PDF export | New | Build as the “one more thing” demo moment |
| 5 | Role Mismatch Redirect | New | Demo: “Raj failed CMM but ACI found he’s Strong Fit for Factory Tech” |
| 6 | Interactive Demo | Built | Ensure cinematic loading \+ 4-question assessment works end-to-end |

| Demo Narrative Reorder *Per Tasha’s discovery feedback: lead with Manufacturing Engineer and senior CNC Machinist profiles, not Factory Technician. Anduril is targeting 7+ year experienced candidates first. The entry-level story comes later.* |
| :---- |

## **15.2 The “Close the Deal” Stack**

After a successful demo, these features close the pilot contract:

| \# | Feature | Phase | Effort |
| :---- | :---- | :---- | :---- |
| 7 | Assessment Invitation Flow | Phase 3 | 2 weeks |
| 8 | Weekly Pipeline Digest Email | Phase 2 | 1 week |
| 9 | Interview Prep Kit | Phase 1 | 1 week |
| 10 | Adverse Impact Report | Phase 2 | 1 week |

## **15.3 The “Expansion” Stack**

These features drive expansion from pilot to full deployment:

| \# | Feature | Phase | Effort |
| :---- | :---- | :---- | :---- |
| 11 | Training Readiness Report | Phase 3 | 2 weeks |
| 12 | Cohort Analytics Dashboard | Phase 4 | 3–4 weeks |
| 13 | ATS Webhook \+ API | Phase 4 | 2 weeks |
| 14 | Quality of Hire Correlation | Phase 4 | Ongoing |
| 15 | Custom Role Builder | Phase 2 | 2 weeks |
| 16 | Spanish Language Support (instructions) | Phase 3 | 1 week |

# **16\. Roadmap**

## **V1.0 Scope (Months 1–6)**

* Core assessment: 12 constructs fully developed, validated, and normed across 5 role profiles

* Dashboard \+ candidate profile system with full RBAC enforcement

* Scoring engine with composite calculation, cutline evaluation, and red flag detection

* PDF export: 5-page scorecard \+ 1-page HM one-pager

* Assessment delivery platform with hybrid fixed \+ AI-adaptive items

* Interactive demo for sales enablement

* Two initial assessment center locations (Los Angeles, Ohio)

## **V2.0 Scope (Months 7–12)**

* Full CAT (Computerized Adaptive Testing) with IRT models replacing pre-ordered item banks

* Adverse impact analysis and compliance reporting

* Custom Role Builder for customer-specific construct weighting

* ATS integration (Greenhouse, Lever) with bidirectional webhooks

* Cohort analytics and quality-of-hire correlation tracking

* Third assessment center location (Phoenix)

* Norming database with 10,000+ assessments for stable percentile rankings

## **V3.0 Scope (Year 2\)**

* AI-generated Intelligence Reports (replacing template-driven content)

* Spanish language support for assessment instructions

* Mobile-native recruiter app (card-based dashboard, swipe actions, push notifications)

* Longitudinal validation studies: multi-year correlation of ACI scores with career progression, retention, and promotion rates

* Enterprise SSO and advanced admin controls

* Geographic expansion to 5+ assessment center locations

# **17\. Appendix: Mock Data Seeding**

Phase 1 ships with 25 seeded candidates representing realistic assessment diversity:

| Profile Type | Count | Characteristics |
| :---- | :---- | :---- |
| Strong Fit (Clear Pass) | 8 | ≥75th percentile composite, no red flags. Status: RECOMMENDED |
| Conditional (Near Cutline) | 5 | Within 5 points of cutline, minor flags. Status: REVIEW\_REQUIRED |
| Not a Direct Fit | 4 | Below cutline. Status: DO\_NOT\_ADVANCE |
| Red Flag Present | 2 | Passes composite but has CRITICAL integrity flag. Status: DO\_NOT\_ADVANCE |
| In Progress | 3 | Assessment started but incomplete. Status: INCOMPLETE |
| Role Mismatch | 3 | Failed primary role but strong fit for alternative. Status: REVIEW\_REQUIRED |

Distributed across roles: \~5 per role. Each seeded candidate includes full SubtestResult for all 12 constructs, CompositeScore for all 5 roles (enables Role Switcher demo), Prediction record, RedFlag records where applicable, AIInteraction records (2–3 per construct with realistic mock Q\&A), Note records (1–2 per candidate from mock users), and realistic names, emails, and phone numbers.

*End of Document*

ACI • Arklight Cognitive Index • Product Requirements Document v1.1 • February 2026
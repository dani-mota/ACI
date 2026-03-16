# Audit 4: Signal Collection & Scoring Pipeline

**Purpose:** Document how candidate signals are captured, stored, and consumed by the scoring pipeline. What data comes from each act, how it's structured in the database, and what the scoring pipeline reads.

**Methodology:** Every file in the scoring pipeline was read end-to-end. All data flows traced from capture (chat route) through storage (Prisma) to consumption (pipeline steps). Line numbers reference verified code.

---

## Part 1: What Gets Stored

### ConversationMessage (every exchange)

**Schema:** [schema.prisma](prisma/schema.prisma) — `ConversationMessage` model

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| role | Enum | AGENT or CANDIDATE | `"CANDIDATE"` |
| content | String | Full text of the message | `"I'd start by checking the thermal sensor logs..."` |
| act | Enum | Which act | `"ACT_1"` |
| sequenceOrder | Int | Monotonic counter per assessment | `14` |
| elementType | String? | If interactive element response | `"MULTIPLE_CHOICE_INLINE"` |
| candidateInput | String? | Raw input value for elements | `"B"` |
| responseTimeMs | Int? | How long candidate took (ms) | `12400` |
| metadata | Json? | JSON blob (structure varies by path) | See below |

#### Metadata by Code Path

**Act 1 CANDIDATE messages** — [chat/route.ts:279-283](src/app/api/assess/[token]/chat/route.ts#L279):
```json
{
  "scenarioIndex": 1,
  "beatIndex": 3,
  "construct": "QUANTITATIVE_REASONING"  // only if state.currentConstruct is set
}
```

**Act 1 AGENT messages (streaming path, onFinish)** — [chat/route.ts:758-762](src/app/api/assess/[token]/chat/route.ts#L758):
```json
{
  "scenarioIndex": 1,
  "beatIndex": 3,
  "beatType": "SOCIAL_PRESSURE",
  "primaryConstructs": ["EXECUTIVE_CONTROL", "ETHICAL_JUDGMENT"],
  "secondaryConstructs": ["COGNITIVE_FLEXIBILITY"]
}
```
Inherits from `action.metadata` (set by `getNextAction()` in [engine.ts:148-151](src/lib/assessment/engine.ts#L148)).

**Act 1 AGENT messages (pre-generated content path)** — [chat/route.ts:653-657](src/app/api/assess/[token]/chat/route.ts#L653):
```json
{
  "scenarioIndex": 1,
  "beatIndex": 3,
  "beatType": "SOCIAL_PRESSURE",
  "primaryConstructs": ["EXECUTIVE_CONTROL", "ETHICAL_JUDGMENT"],
  "preGenerated": true,
  "classification": "ADEQUATE"
}
```

**Act 2 CANDIDATE element responses** — [chat/route.ts:235-238](src/app/api/assess/[token]/chat/route.ts#L235):
```json
{
  "itemId": "qr-003",
  "construct": "QUANTITATIVE_REASONING"
}
```

**Phase 0 messages** — [chat/route.ts:192-200](src/app/api/assess/[token]/chat/route.ts#L192):
No metadata. Only `role`, `content`, `act: "PHASE_0"`, `sequenceOrder`.

#### When Persisted

| Event | When | Code Path |
|-------|------|-----------|
| Candidate text message | Immediately on receipt, before engine processes | [chat/route.ts:272](src/app/api/assess/[token]/chat/route.ts#L272) |
| Candidate element response | Immediately on receipt, before engine processes | [chat/route.ts:230](src/app/api/assess/[token]/chat/route.ts#L230) |
| Agent message (content library) | After `lookupBeatContent` + acknowledgment compose, before JSON response | [chat/route.ts:646](src/app/api/assess/[token]/chat/route.ts#L646) |
| Agent message (streaming) | In `onFinish` callback after stream completes | [chat/route.ts:745](src/app/api/assess/[token]/chat/route.ts#L745) |
| Phase 0 messages | Via `phase_0_message` trigger | [chat/route.ts:192](src/app/api/assess/[token]/chat/route.ts#L192) |
| Transition messages | When engine returns TRANSITION action | [chat/route.ts:417](src/app/api/assess/[token]/chat/route.ts#L417) |
| Completion message | When engine returns COMPLETE action | [chat/route.ts:418](src/app/api/assess/[token]/chat/route.ts#L418) |

---

### ItemResponse (Act 2/3 structured answers)

**Schema:** [schema.prisma](prisma/schema.prisma) — `ItemResponse` model
**Created at:** [chat/route.ts:244-264](src/app/api/assess/[token]/chat/route.ts#L244)

| Field | Type | Description |
|-------|------|-------------|
| assessmentId | String | Links to assessment |
| itemId | String | Links to ITEM_BANK item (e.g., `"qr-003"`) |
| itemType | String | `MULTIPLE_CHOICE`, `NUMERIC_INPUT`, `TIMED_CHALLENGE` |
| response | String | The candidate's answer |
| responseTimeMs | Int? | Milliseconds to respond |
| act | Enum | `ACT_2` or `ACT_3` |
| confidence | Float? | Self-reported confidence (Act 3) |

**Upsert pattern** (prevents duplicates on retry):
```typescript
await prisma.itemResponse.upsert({
  where: { assessmentId_itemId: { assessmentId, itemId } },
  create: { assessmentId, itemId, itemType, response, responseTimeMs, act },
  update: { response, responseTimeMs, act },
});
```

The scoring pipeline compares `response` against `item.correctAnswer` from [item-bank.ts](src/lib/assessment/item-bank.ts).

---

### AssessmentState (current position + accumulated signals)

**Schema:** [schema.prisma](prisma/schema.prisma) — `AssessmentState` model

| Field | Type | Pipeline Reads? | Description |
|-------|------|----------------|-------------|
| currentAct | Enum | No | Runtime only — `ACT_1`, `ACT_2`, `ACT_3` |
| currentScenario | Int | No | Runtime only — 0-3 |
| currentBeat | Int | No | Runtime only — 0-5 |
| branchPath | Json | No | Classification trail: `["ADEQUATE","STRONG","ADEQUATE"]` |
| currentConstruct | String? | No | Current Act 2 construct being tested |
| currentPhase | Int? | No | Current adaptive phase index |
| **act2Progress** | **Json** | **Yes** | Full adaptive loop state per construct |
| act3Progress | Json | No | `{ confidenceItemsComplete, parallelScenariosComplete }` |
| contentLibraryId | String? | No | Which ContentLibrary version this assessment used |
| variantSelections | Json? | No | Which variant was randomly selected per scenario |
| realtimeTokensIn | Int | No | Accumulated real-time model token usage (input) |
| realtimeTokensOut | Int | No | Accumulated real-time model token usage (output) |
| phase0Complete | Boolean | No | Whether Phase 0 warmup completed |
| isComplete | Boolean | No | Whether assessment is finished |
| act1CompletedAt | DateTime? | No | Timestamp when Act 1 finished |
| act2CompletedAt | DateTime? | No | Timestamp when Act 2 finished |
| act3CompletedAt | DateTime? | No | Timestamp when Act 3 finished |

**Key insight:** The pipeline reads `act2Progress` for Layer C ceiling characterization and `computeAdaptiveScore`. Everything else comes from `ConversationMessage` and `ItemResponse`.

---

## Part 2: What Signals Come From Each Act

### Act 1: Scenario Gauntlet (conversational)

4 scenarios × 6 beats. Configuration: [config.ts:43-47](src/lib/assessment/config.ts#L43).

| Beat | Type | Signal Source | Constructs Measured | What's Measured |
|------|------|---------------|---------------------|-----------------|
| 0 | INITIAL_SITUATION | None (Aria sets scene) | N/A | N/A |
| 1 | INITIAL_RESPONSE | Candidate open response | SYSTEMS_DIAGNOSTICS, FLUID_REASONING | First approach, causal reasoning |
| 2 | COMPLICATION | Response to complication | COGNITIVE_FLEXIBILITY | Ability to revise plan |
| 3 | SOCIAL_PRESSURE | Response under pressure | EXECUTIVE_CONTROL, ETHICAL_JUDGMENT | Resistance to shortcuts |
| 4 | CONSEQUENCE_REVEAL | Response to consequence | FLUID_REASONING, METACOGNITIVE_CALIBRATION | Learning from outcomes |
| 5 | REFLECTIVE_SYNTHESIS | Reflective synthesis | METACOGNITIVE_CALIBRATION, LEARNING_VELOCITY | Meta-cognition |

**Signal capture chain:**
1. Candidate speaks → ConversationMessage (CANDIDATE, with `scenarioIndex`, `beatIndex`)
2. Classification runs → [classification.ts](src/lib/assessment/classification.ts) → returns `ClassificationResult`
3. Classification stored in `branchPath` on AssessmentState (array accumulation)
4. `constructSignals` in classification result contain per-construct signal strength + evidence — **NOT persisted to DB** (available only in-memory during chat route execution)

**Scored by:** Layer B (AI-evaluated). For each candidate message tagged with constructs via preceding AGENT message metadata: 3 independent Claude Haiku evaluation runs per construct per message. Median score used. High-variance (SD > 0.3) runs downweighted to 0.5×.

### Act 2: Precision Gauntlet (structured items)

5 constructs × 4 adaptive phases. Configuration: [config.ts:49-55](src/lib/assessment/config.ts#L49).

| Phase | Items | Signal | What's Measured |
|-------|-------|--------|-----------------|
| CALIBRATION | 2-3 items (easy/medium/hard) | correct/incorrect + responseTime | Rough ability placement |
| BOUNDARY_MAPPING | 3-5 items (binary search) | correct/incorrect at varied difficulty | Where accuracy drops |
| PRESSURE_TEST | 2-3 items (different subType) | correct/incorrect near boundary | Boundary confirmation |
| DIAGNOSTIC_PROBE | Open response (conversational) | Free text | Ceiling characterization |

**Constructs tested:** QUANTITATIVE_REASONING, SPATIAL_VISUALIZATION, MECHANICAL_REASONING, PATTERN_RECOGNITION, FLUID_REASONING

**Signal capture chain:**
1. Item presented → ConversationMessage (AGENT, with elementData)
2. Candidate responds → ItemResponse upsert + ConversationMessage (CANDIDATE, with `itemId`, `construct`)
3. `recordResult()` in [adaptive-loop.ts:61](src/lib/assessment/adaptive-loop.ts#L61) → updates `act2Progress` JSON in AssessmentState
4. Phase transitions determined by item count, confidence, and contradiction detection

**Scored by:**
- **Layer A** (deterministic): `correct = response === correctAnswer`. Difficulty-weighted: `rawScore = correct ? 1 × (1 + (difficulty - 0.5) × 0.3) : 0`. Score range per item: [0.85, 1.15] for correct, 0 for incorrect. No time penalty in current code.
- **Layer C** (qualitative): Ceiling characterization from DIAGNOSTIC_PROBE phase. Not a numeric score — produces `HARD_CEILING | SOFT_CEILING_TRAINABLE | SOFT_CEILING_CONTEXT_DEPENDENT | STRESS_INDUCED | INSUFFICIENT_DATA`.

### Act 3: Calibration & Consistency

| Phase | Signal | What's Measured |
|-------|--------|-----------------|
| Confidence items (3) | Answer + confidence rating | Calibration accuracy: \|confidence - accuracy\| |
| Parallel scenarios (2) | Open responses (same structure as Act 1) | Act 1 vs Act 3 consistency per construct |
| Self-assessment | Open response | Metacognitive calibration |

**Signal capture:** Confidence items → ItemResponse with `confidence` field. Parallel scenarios → ConversationMessage (scored same as Act 1 via Layer B). Self-assessment → ConversationMessage.

**Scored by:** Consistency validation. Per construct: `delta = |act1LayerBScore - act3LayerBScore|`. Delta < 0.15 → HIGH consistency (score stands). Delta >= 0.15 → LOW consistency → 0.75× downweight applied to final construct score. Threshold: [config.ts:61](src/lib/assessment/config.ts#L61).

---

## Part 3: Scoring Pipeline — Step by Step

**Triggered by:** `POST /api/assess/[token]/complete` → `after(() => runPipelineWithRetry(assessmentId))` — [complete/route.ts:89](src/app/api/assess/[token]/complete/route.ts#L89)

**File:** [pipeline.ts](src/lib/assessment/scoring/pipeline.ts) — 572 lines, 13 steps.

**Retry:** 3 attempts with exponential backoff (1s, 2s, 4s). On exhaustion: candidate status → `ERROR`, webhook notification fired.

### Step 1: Data Fetch
**Lines:** [46-65](src/lib/assessment/scoring/pipeline.ts#L46)

| What | Source |
|------|--------|
| Assessment + messages | `prisma.assessment.findUnique` with includes |
| AssessmentState | Included via relation |
| Candidate + primaryRole | Included via relation |
| ItemResponses | Included via relation |
| Role context | `getRoleContext(role.id)` |
| Act 2 progress | `state.act2Progress` JSON |

Phase 0 messages filtered out at line 65: `assessment.messages.filter(m => m.act !== "PHASE_0")`.

### Step 2: Layer A — Deterministic Scoring
**Lines:** [67-89](src/lib/assessment/scoring/pipeline.ts#L67)
**File:** [layer-a.ts](src/lib/assessment/scoring/layer-a.ts)

**Input:** ItemResponse records (Act 2 + Act 3 only, line 73 filters out Act 1/Phase 0)

**Formula per item** — [layer-a.ts:25-27](src/lib/assessment/scoring/layer-a.ts#L25):
```
rawScore = correct ? 1 × (1 + (difficulty - 0.5) × 0.3) : 0
```

| Difficulty | Weight if Correct | Weight if Incorrect |
|------------|-------------------|---------------------|
| 0.00 | 0.85 | 0 |
| 0.25 | 0.925 | 0 |
| 0.50 | 1.00 | 0 |
| 0.75 | 1.075 | 0 |
| 1.00 | 1.15 | 0 |

**Aggregation per construct** — [layer-a.ts:43-74](src/lib/assessment/scoring/layer-a.ts#L43):
```
score = sum(rawScores) / sum(maxPossibleScores)
```
Where `maxPossibleScore` per item = `1 + (difficulty - 0.5) × 0.3`. Normalized to 0-1.

**Note:** `responseTimeMs` is recorded but NOT factored into the score. No time penalty exists in the current codebase.

**Output:** `Map<construct, { score: number, itemCount: number, avgResponseTimeMs: number }>`

### Step 3: Layer B — AI Evaluation
**Lines:** [91-242](src/lib/assessment/scoring/pipeline.ts#L91)
**File:** [layer-b.ts](src/lib/assessment/scoring/layer-b.ts)

**Construct-message mapping** — [pipeline.ts:101-118](src/lib/assessment/scoring/pipeline.ts#L101):
For each CANDIDATE message, look backward to find the preceding AGENT message with `primaryConstructs`/`secondaryConstructs` in metadata. This mapping determines which constructs each response is scored against.

**Idempotency guard** — [pipeline.ts:139-196](src/lib/assessment/scoring/pipeline.ts#L139):
Before making API calls, checks `AIEvaluationRun` count for this construct. If `count >= relevantMessages × evaluationRunCount`, reconstructs `LayerBScore` from stored DB records. Prevents duplicate API calls on retry — cost explosion protection.

**Triple evaluation** — [layer-b.ts:54-58](src/lib/assessment/scoring/layer-b.ts#L54):
- 3 parallel API calls to Claude Haiku (`claude-haiku-4-5-20251001`)
- Each call evaluates a rubric with behavioral indicators (present/absent)
- `Promise.allSettled` — partial failures tolerated

**Score aggregation** — [layer-b.ts:70-82](src/lib/assessment/scoring/layer-b.ts#L70):
```
scores.sort(ascending)
medianIndex = floor((length - 1) / 2)  // lower-median for even counts
medianScore = scores[medianIndex]
stdDev = sqrt(sum((score - mean)^2) / N)
highVariance = stdDev > 0.3
downweighted = highVariance  // 0.5× weight in aggregation
```

**Per-construct aggregation** — [pipeline.ts:228-242](src/lib/assessment/scoring/pipeline.ts#L228):
```
For each LayerBScore for this construct:
  weight = downweighted ? 0.5 : 1.0
  weightedSum += medianScore × weight
  weightSum += weight
layerBAggregate = weightedSum / weightSum
```

**Model:** `claude-haiku-4-5-20251001` — [config.ts:13](src/lib/assessment/config.ts#L13)
**Run count:** 3 in production, 1 in test mode — [config.ts:23](src/lib/assessment/config.ts#L23)

### Step 4: Layer C — Ceiling Characterization
**Lines:** [244-245](src/lib/assessment/scoring/pipeline.ts#L244)
**File:** [layer-c.ts](src/lib/assessment/scoring/layer-c.ts)

**Input:** `act2Progress` — adaptive loop states for constructs that reached DIAGNOSTIC_PROBE phase with probe exchanges.

**Output per construct:**
| CeilingType | Meaning | Training Priority | Caps Performance? |
|-------------|---------|-------------------|-------------------|
| HARD_CEILING | Fundamental limit | LOW (training won't help) | Yes |
| SOFT_CEILING_TRAINABLE | Addressable gap | HIGH | No |
| SOFT_CEILING_CONTEXT_DEPENDENT | Varies by context | MEDIUM | No |
| STRESS_INDUCED | Degrades under pressure | MEDIUM | No |
| INSUFFICIENT_DATA | Not enough evidence | LOW | No |

Uses `classifyCeiling()` from [diagnostic-probe.ts](src/lib/assessment/diagnostic-probe.ts) — AI-based classification.

**Fallback:** If classification fails, defaults to `INSUFFICIENT_DATA` with appropriate narrative — [layer-c.ts:42-53](src/lib/assessment/scoring/layer-c.ts#L42).

### Step 5: Consistency Validation
**Lines:** [247-274](src/lib/assessment/scoring/pipeline.ts#L247)
**File:** [consistency.ts](src/lib/assessment/scoring/consistency.ts)

**Input:** Layer B scores partitioned by Act 1 vs Act 3. Per construct: mean of Act 1 Layer B scores vs mean of Act 3 Layer B scores.

**Logic** — [consistency.ts:26-49](src/lib/assessment/scoring/consistency.ts#L26):
```
delta = |act1Score - act3Score|
agreement = delta < 0.15 ? "HIGH" : "LOW"
lowerConfidenceSource = (act3Count < act1Count) ? "ACT_3" : "ACT_1"
downweightFactor = agreement === "HIGH" ? 1.0 : 0.75
```

**Output:** `ConsistencyResult[]` — one per construct with data in both acts.

**Missing data handling:** If no Act 3 data exists, `consistencySignals` is empty → `consistencyResults` is empty → no consistency downweight applied. Handled gracefully.

### Step 6: Construct Aggregation
**Lines:** [276-305](src/lib/assessment/scoring/pipeline.ts#L276)
**File:** [aggregation.ts](src/lib/assessment/scoring/aggregation.ts)

**Weight determination** — [aggregation.ts:70-82](src/lib/assessment/scoring/aggregation.ts#L70):

| Data Available | Layer A Weight | Layer B Weight |
|---------------|---------------|---------------|
| Both layers | 0.55 | 0.45 |
| Layer A only | 1.0 | 0 |
| Layer B only | 0 | 1.0 |
| Neither | 0 | 0 (percentile → 1) |

**Formula** — [aggregation.ts:86-91](src/lib/assessment/scoring/aggregation.ts#L86):
```
combinedRawScore = (0.55 × layerA) + (0.45 × layerB)
if consistencyLevel === "LOW":
  combinedRawScore *= 0.75
percentile = rawScoreToPercentile(construct, combinedRawScore)
```

**Conversation-only constructs** (no Act 2 items): `SYSTEMS_DIAGNOSTICS`, `PROCEDURAL_RELIABILITY`, `ETHICAL_JUDGMENT`, `EXECUTIVE_CONTROL`, `COGNITIVE_FLEXIBILITY`, `METACOGNITIVE_CALIBRATION`, `LEARNING_VELOCITY`. These always get Layer B weight = 1.0.

**Adaptive score integration** — [pipeline.ts:286-290](src/lib/assessment/scoring/pipeline.ts#L286):
If a construct has adaptive loop state (from Act 2) but no formal ItemResponse records, `computeAdaptiveScore()` is used as the effective Layer A score. This uses the same difficulty-weighted formula as Layer A.

**Construct layers** — [construct-scoring.ts:19-32](src/lib/assessment/construct-scoring.ts#L19):

| Layer | Constructs |
|-------|-----------|
| COGNITIVE_CORE | FLUID_REASONING, EXECUTIVE_CONTROL, COGNITIVE_FLEXIBILITY, METACOGNITIVE_CALIBRATION, LEARNING_VELOCITY |
| TECHNICAL_APTITUDE | SYSTEMS_DIAGNOSTICS, PATTERN_RECOGNITION, QUANTITATIVE_REASONING, SPATIAL_VISUALIZATION, MECHANICAL_REASONING |
| BEHAVIORAL_INTEGRITY | PROCEDURAL_RELIABILITY, ETHICAL_JUDGMENT |

### Step 7: Composite Scores
**Lines:** [316-326](src/lib/assessment/scoring/pipeline.ts#L316)
**File:** [scoring.ts](src/lib/scoring.ts)

**Input:** SubtestResult percentiles + CompositeWeight records for the candidate's primary role.

**CompositeWeight model** — [schema.prisma](prisma/schema.prisma):
```
roleId + constructId + weight + version + source + effectiveFrom + effectiveTo
```
Active weights have `effectiveTo = null`.

**Formula** — [scoring.ts:22-38](src/lib/scoring.ts#L22):
```
For each weight:
  find matching subtestResult by construct
  weightedSum += percentile × weight
  totalWeight += weight
composite = round(weightedSum / totalWeight)
```

### Step 8: Cutline Evaluation
**Lines:** [328-335](src/lib/assessment/scoring/pipeline.ts#L328)
**File:** [scoring.ts:50-70](src/lib/scoring.ts#L50)

**Cutline model:** Per role+org: thresholds for `technicalAptitude`, `behavioralIntegrity`, `learningVelocity`.

**Logic:**
```
techAvg = average percentile of TECHNICAL_APTITUDE layer constructs
behAvg  = average percentile of BEHAVIORAL_INTEGRITY layer constructs
lv      = LEARNING_VELOCITY percentile

passed = techAvg >= cutline.technicalAptitude
       AND behAvg >= cutline.behavioralIntegrity
       AND lv >= cutline.learningVelocity

distance = min(techAvg - cutline.tech, behAvg - cutline.beh, lv - cutline.lv)
```

### Step 9: Red Flag Detection
**Lines:** [337-343](src/lib/assessment/scoring/pipeline.ts#L337)
**File:** [red-flags.ts](src/lib/assessment/scoring/red-flags.ts) — 301 lines

12 checks (7 original + 5 V2):

| # | Check | Severity | Trigger Condition |
|---|-------|----------|-------------------|
| 1 | Extremely Low Scores | CRITICAL | Any construct < 10th percentile |
| 2 | Behavioral Concern | WARNING | BEHAVIORAL_INTEGRITY construct < 25th percentile |
| 3 | Speed-Accuracy Mismatch | WARNING | Percentile < 30 AND responseTime 1-3000ms |
| 4 | Incomplete Assessment | CRITICAL | >2 constructs with 0 data |
| 5 | Random Responding | CRITICAL | >30% of responses in < 2 seconds |
| 6 | Minimal Engagement | WARNING | >50% of Act 1 responses < 10 words |
| 7 | Overconfidence Pattern | WARNING | Layer B > Layer A by >30% on >3 constructs |
| 8 | Scenario Disengagement | WARNING | Average Act 1 response < 20 words |
| 9 | Consistency Failure | WARNING | >=3 constructs with LOW consistency |
| 10 | Copy-Paste Detection | WARNING | >=2 pairs of responses with >85% Jaccard bigram similarity |
| 11 | Escalation Avoidance | WARNING | >75% of SOCIAL_PRESSURE responses match avoidance language patterns |
| 12 | High Variance Evaluation | WARNING | >=3 responses with scoring variance >0.3 |

**Escalation Avoidance pattern** — [red-flags.ts:243](src/lib/assessment/scoring/red-flags.ts#L243):
Uses preceding AGENT message metadata to identify `beatType === "SOCIAL_PRESSURE"`, then checks candidate's response against avoidance regex pattern (agree, go along, defer, back down, comply, etc.).

### Step 10: Predictions
**Lines:** [345-351](src/lib/assessment/scoring/pipeline.ts#L345)
**File:** [predictions.ts](src/lib/predictions.ts)

| Prediction | Output | Key Formula |
|------------|--------|-------------|
| Ramp Time | 2-16 weeks, label (Fast/Standard/Extended/Long) | `16 - (LV_percentile/100)×12 + adjustments` |
| Supervision | MINIMAL/STANDARD/ELEVATED/HIGH | Composite of MC×0.3 + PRL×0.25 + EJ×0.25 + EC×0.2 |
| Ceiling | SENIOR_SPECIALIST / TEAM_LEAD / STANDARD / LIMITED | Composite of FR×0.35 + LV×0.25 + SD×0.2 + MC×0.2 |
| Attrition Risk | LOW/MODERATE/ELEVATED/HIGH | Base 50 + adjustments from PRL, EJ, EC, CF |

Ceiling characterizations (Layer C) modify predictions: `HARD_CEILING` on key constructs downgrades SENIOR/TEAM → STANDARD. `STRESS_INDUCED` bumps MINIMAL supervision → STANDARD.

### Step 11: Status Determination
**Lines:** [353-354](src/lib/assessment/scoring/pipeline.ts#L353)
**File:** [scoring.ts:72-84](src/lib/scoring.ts#L72)

**Decision tree:**
```
CRITICAL red flag?
  YES → DO_NOT_ADVANCE

Cutline passed?
  NO + distance < -5  → DO_NOT_ADVANCE
  NO + distance >= -5 → REVIEW_REQUIRED
  YES + WARNING flags → REVIEW_REQUIRED
  YES + no flags      → RECOMMENDED
```

### Step 12: Cross-Role Rankings
**Lines:** [356-363](src/lib/assessment/scoring/pipeline.ts#L356)

If the candidate's primary role is generic (`role.isGeneric = true`), compute composite scores against ALL non-generic roles in the org. This produces a ranked list showing which specific roles the candidate fits best.

### Step 13: Atomic Transaction
**Lines:** [369-557](src/lib/assessment/scoring/pipeline.ts#L369)

ALL database writes occur in a single `prisma.$transaction()`:

| Write | Method | Idempotent? |
|-------|--------|-------------|
| SubtestResult (1 per construct) | Upsert via `assessmentId_construct` | Yes |
| AIEvaluationRun (3 per message per construct) | Upsert via `assessmentId_messageId_construct_runIndex` | Yes |
| CompositeScore (primary role) | Upsert via `assessmentId_roleSlug` | Yes |
| CompositeScore (cross-role, if generic) | Upsert via `assessmentId_roleSlug` | Yes |
| RedFlag | DeleteMany + Create (atomic replace) | Yes |
| Prediction | Upsert via `assessmentId` | Yes |
| Candidate.status | Update | Yes |
| Assessment cost tracking | Update `scoringCostUsd`, `scoringTokensIn/Out` | Yes |

**Atomicity guarantee:** Either ALL scoring data commits or NONE does. No partial scoring states.

---

## Part 4: Adaptive Loop Detail (Act 2)

### AdaptiveLoopState Structure

Per construct, stored in `AssessmentState.act2Progress` as JSON:

```typescript
{
  construct: "QUANTITATIVE_REASONING",
  phase: "PRESSURE_TEST",
  calibrationResults: [
    { itemId: "qr-001", difficulty: 0.25, correct: true, responseTimeMs: 8200, candidateResponse: "B" },
    { itemId: "qr-004", difficulty: 0.50, correct: true, responseTimeMs: 14300, candidateResponse: "C" },
    { itemId: "qr-007", difficulty: 0.75, correct: false, responseTimeMs: 22100, candidateResponse: "A" }
  ],
  boundaryResults: [
    { itemId: "qr-003", difficulty: 0.62, correct: true, responseTimeMs: 18400, candidateResponse: "D" },
    { itemId: "qr-009", difficulty: 0.68, correct: false, responseTimeMs: 25600, candidateResponse: "B" }
  ],
  pressureResults: [
    { itemId: "qr-012", difficulty: 0.65, correct: false, responseTimeMs: 19800, candidateResponse: "A" }
  ],
  probeExchanges: [],
  boundary: {
    construct: "QUANTITATIVE_REASONING",
    estimatedBoundary: 0.65,
    confirmedFloor: 0.62,
    confirmedCeiling: 0.68,
    confidence: 0.78,
    itemResults: [...]
  },
  itemsServed: ["qr-001", "qr-004", "qr-007", "qr-003", "qr-009", "qr-012"]
}
```

### Phase Transitions

**File:** [adaptive-loop.ts:61-144](src/lib/assessment/adaptive-loop.ts#L61)

| From → To | Trigger |
|-----------|---------|
| CALIBRATION → BOUNDARY_MAPPING | 3 items served, OR 2 items + early exit (easy item missed) |
| BOUNDARY_MAPPING → PRESSURE_TEST | `confidence >= 0.7` OR `boundaryResults.length >= 5` |
| PRESSURE_TEST → DIAGNOSTIC_PROBE | Boundary confirmed (correctRate <= 30%) or enough items (>= 3) |
| PRESSURE_TEST → BOUNDARY_MAPPING | Contradiction detected (correctRate >= 70% — boundary was set too low) |

### Item Selection Logic

**CALIBRATION:** Fixed difficulty bands — item 1: [0.15, 0.35], item 2: [0.4, 0.6], item 3: [0.65, 0.85].

**BOUNDARY_MAPPING** (binary search):
```
targetDifficulty = (maxCorrectDifficulty + minIncorrectDifficulty) / 2
margin = 0.1
// Pick item from bank closest to target, within margin, not already served
```

**PRESSURE_TEST:** Items within ±0.15 of `boundary.estimatedBoundary`, preferring different `subType` to test from a different angle.

### computeBoundary

**File:** [adaptive-loop.ts:259-292](src/lib/assessment/adaptive-loop.ts#L259)

```
confirmedFloor = max(difficulty of correct answers)
confirmedCeiling = min(difficulty of incorrect answers)
estimatedBoundary = (confirmedFloor + confirmedCeiling) / 2

dataConfidence = min(resultCount / 6, 1.0)  // Saturates at 6 items
gapWidth = confirmedCeiling - confirmedFloor
gapConfidence = gapWidth < 0.3 ? 1.0 : gapWidth < 0.5 ? 0.6 : 0.3
confidence = dataConfidence × gapConfidence
```

### computeAdaptiveScore

**File:** [adaptive-loop.ts:336-356](src/lib/assessment/adaptive-loop.ts#L336)

Same formula as Layer A — difficulty-weighted accuracy across all phases:
```
For each result in [calibration + boundary + pressure]:
  weight = 1 + (difficulty - 0.5) × 0.3
  weightedSum += (correct ? 1 : 0) × weight
  weightSum += weight
score = weightedSum / weightSum
```

Used in the pipeline when `ItemResponse` records aren't available but adaptive loop state is.

---

## Part 5: Token & Cost Tracking

### Two Separate Tracking Paths

| Metric | Scope | Where Accumulated | Where Written |
|--------|-------|-------------------|---------------|
| `realtimeTokensIn/Out` | Real-time chat interactions | AssessmentState, incremented per classification at [chat/route.ts:382-383](src/app/api/assess/[token]/chat/route.ts#L382) | Stays on AssessmentState |
| `scoringTokensIn/Out` | Scoring pipeline (Layer B) | Global accumulators in layer-b.ts, reset per pipeline run | Assessment table, written atomically at [pipeline.ts:549-554](src/lib/assessment/scoring/pipeline.ts#L549) |
| `scoringCostUsd` | Scoring pipeline cost | Computed from Layer B token usage | Assessment table |

**Cost formula** — [pipeline.ts:365](src/lib/assessment/scoring/pipeline.ts#L365):
```
costUsd = (inputTokens × 0.80 + outputTokens × 4.00) / 1,000,000
```
Based on Claude Haiku pricing: $0.80/M input, $4.00/M output.

---

## Part 6: Data Integrity Findings

### Finding 1: Construct-Message Affinity Depends on AGENT Metadata

**Severity:** High — affects scoring accuracy

The entire Layer B scoring system depends on AGENT message metadata containing `primaryConstructs` and `secondaryConstructs`. The pipeline walks backward from each CANDIDATE message to find the preceding AGENT message and reads its constructs — [pipeline.ts:101-118](src/lib/assessment/scoring/pipeline.ts#L101).

**Risk:** If an AGENT message is persisted without construct metadata (e.g., a code path that doesn't inherit `action.metadata`), the following CANDIDATE message becomes "untagged" — invisible to Layer B scoring. The response is collected but never evaluated.

**Verification:** All current AGENT message code paths inherit `action.metadata` which includes `primaryConstructs`. However, metadata is untyped (`Json?` in schema, `as Record<string, unknown>` in code) — no compile-time guarantee that these fields exist.

### Finding 2: Classification constructSignals Not Persisted

**Severity:** Low — no current consumer

Classification at [classification.ts](src/lib/assessment/classification.ts) returns `constructSignals: Record<string, { signalStrength, evidence }>` — per-response construct signal strengths with quoted evidence. These are available in-memory during the chat route but are never written to the database. Only the top-level `classification` ("STRONG"/"ADEQUATE"/"NEEDS_DEVELOPMENT") is stored (in `branchPath`).

**Impact:** No downstream consumer currently needs these. But for future analytics (e.g., "which specific signals did this candidate exhibit in beat 3?"), this data is lost.

### Finding 3: Stale Message History Affects Layer B Context

Cross-reference with **Audit 3, Bug 2**: The candidate's current message is not pushed onto `assessment.messages` after persistence. When Layer B later uses `assessment.messages.slice(-4)` for conversation context, the context is missing the latest message. This means the AI evaluator sees a slightly stale conversation when scoring.

### Finding 4: No Schema Enforcement on Metadata

ConversationMessage.metadata is `Json?` — a schemaless JSON blob. The metadata structure differs between:
- Act 1 candidate messages: `{ scenarioIndex, beatIndex, construct? }`
- Act 1 agent messages (streaming): `{ scenarioIndex, beatIndex, beatType, primaryConstructs, secondaryConstructs }`
- Act 1 agent messages (pre-gen): Same + `{ preGenerated, classification }`
- Act 2 candidate element responses: `{ itemId, construct }`
- Phase 0 messages: No metadata

There's no TypeScript interface enforcing these shapes. A runtime change that drops `primaryConstructs` from one code path would silently break Layer B scoring for that path's messages.

### Finding 5: Pipeline Handles Missing Data Gracefully

All "missing data" scenarios are handled:

| Scenario | Behavior |
|----------|----------|
| No Act 3 data | Consistency validation skipped, no downweight |
| No ItemResponses | Layer A empty → constructs fall back to Layer B only |
| No conversational evidence for a construct | Layer B empty for that construct → falls back to Layer A only or percentile = 1 |
| No Act 2 diagnostic probes | Layer C empty → ceiling = null → predictions use defaults |
| No cutline defined for role | `passed = true, distance = 0` — no cutline enforcement |
| No CompositeWeights for role | `composite = 0` — degenerate but non-crashing |

### Finding 6: Idempotency Is Solid

The pipeline's idempotency design is robust:
1. **Layer B guard:** Checks `AIEvaluationRun` count before making API calls. On retry, reuses existing evaluations — zero duplicate API calls, zero extra cost.
2. **All DB writes use upserts** with unique constraints — safe to replay.
3. **RedFlags:** Atomic delete + recreate — idempotent.
4. **Transaction boundary:** All writes in single `$transaction` — all-or-nothing.

### Finding 7: computeAdaptiveScore Duplicates Layer A Formula

`computeAdaptiveScore()` in [adaptive-loop.ts:336-356](src/lib/assessment/adaptive-loop.ts#L336) implements the same difficulty-weighted formula as `scoreItem()` in [layer-a.ts:24-27](src/lib/assessment/scoring/layer-a.ts#L24). This is used as a fallback when formal `ItemResponse` records aren't available. The duplication is intentional but could drift if one formula changes without the other.

---

## Part 7: Complete Data Flow Diagram

```
                    ┌─────────────────────────────────────────────────┐
                    │              ASSESSMENT EXECUTION                │
                    │                                                  │
  Act 1             │  Candidate speaks → ConversationMessage          │
  (Scenarios)       │  Classification → branchPath (AssessmentState)   │
                    │  constructSignals → ❌ NOT PERSISTED             │
                    │                                                  │
  Act 2             │  Candidate answers → ItemResponse (upsert)       │
  (Structured)      │  recordResult → act2Progress (AssessmentState)   │
                    │  Phase transitions → currentPhase                │
                    │                                                  │
  Act 3             │  Confidence items → ItemResponse + confidence    │
  (Calibration)     │  Parallel scenarios → ConversationMessage        │
                    │  Self-assessment → ConversationMessage            │
                    └─────────────────────┬───────────────────────────┘
                                          │
                        POST /complete    │
                                          ▼
                    ┌─────────────────────────────────────────────────┐
                    │              SCORING PIPELINE                    │
                    │                                                  │
                    │  ┌──── Layer A ────┐  ┌──── Layer B ────┐       │
                    │  │ ItemResponse    │  │ ConversationMsg  │       │
                    │  │ × ITEM_BANK     │  │ × AI rubric eval │       │
                    │  │ = 0/1 × weight  │  │ = 3 runs median  │       │
                    │  └───────┬─────────┘  └───────┬──────────┘       │
                    │          │                     │                  │
                    │          ▼                     ▼                  │
                    │  ┌─────────────────────────────────────┐         │
                    │  │ Aggregation: 0.55×A + 0.45×B        │         │
                    │  │ × 0.75 if LOW consistency           │         │
                    │  │ → rawScore → percentile             │         │
                    │  └──────────────────┬──────────────────┘         │
                    │                     │                            │
                    │     ┌───────────────┼───────────────┐            │
                    │     ▼               ▼               ▼            │
                    │  Composites    Cutlines        Red Flags          │
                    │  (weights×%)  (tech/beh/lv)   (12 checks)       │
                    │     │               │               │            │
                    │     └───────────────┼───────────────┘            │
                    │                     ▼                            │
                    │             Status Determination                 │
                    │   RECOMMENDED / REVIEW_REQUIRED / DO_NOT_ADVANCE │
                    │                     │                            │
                    │          ┌──────────┼──────────┐                 │
                    │          ▼          ▼          ▼                 │
                    │     Predictions  Rankings  Cost Tracking         │
                    │                                                  │
                    │     ═══════════════════════════════════          │
                    │     ALL WRITES IN SINGLE $transaction            │
                    └─────────────────────────────────────────────────┘
```

---

## Summary

| Aspect | Status |
|--------|--------|
| Signal capture (Act 1 conversational) | Working — metadata populated, classification stored |
| Signal capture (Act 2 structured) | Working — ItemResponse upserts, adaptive loop state |
| Signal capture (Act 3 calibration) | Working — confidence items, parallel scenarios |
| Layer A scoring | Correct — difficulty-weighted, no time penalty |
| Layer B scoring | Correct — triple eval, median, variance downweight |
| Layer A/B combination | Correct — 55/45 split, consistency downweight |
| Composite scores | Correct — role-weighted percentiles |
| Cutline evaluation | Correct — 3-layer threshold check |
| Red flag detection | Comprehensive — 12 checks including V2 additions |
| Predictions | Correct — 4 prediction types with ceiling integration |
| Status determination | Correct — decision tree with flag + cutline logic |
| Idempotency | Strong — API call guard + upserts + transaction |
| Atomicity | Strong — single $transaction for all writes |
| Missing data handling | Graceful — all scenarios produce valid (if degenerate) results |
| **Metadata consistency** | **Risk** — untyped JSON, no compile-time guarantees on construct tags |
| **constructSignals persistence** | **Gap** — per-response signal data lost after chat route execution |

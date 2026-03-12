# ACI Sprint 1 — Corrected Execution Prompts

**Goal:** Get the assessment from "can't get past Act 1" to "a candidate can complete the entire assessment end-to-end and produce a scored profile."

**Date:** 2026-03-12
**Status:** Validated against codebase, all assumptions verified.

---

## Execution Order & Dependencies

```
Prompt 0  (responded fix)        ← PREREQUISITE for Prompts 3 & 7
Prompt 1  (History Cap)          ← Independent
Prompt 2  (Nudge Resume)         ← Independent
Prompt 3  (Nudge Elements)       ← Depends on Prompt 0
Prompt 4  (Beat 0 Guard)         ← Independent
Prompt 5  (Diagnostic Logging)   ← Independent (do early for debugging)
Prompt 6  (Probe Termination)    ← Independent
Prompt 7  (Element Retry)        ← Depends on Prompt 0
Prompt 8  (Confidence Items)     ← Independent
Prompt 9  (Reveal Count)         ← Independent
Prompt 10 (Ref Update Drops)     ← Independent
Prompt 11 (Parallel Scenarios)   ← Independent
Prompt 12 (Self-Assessment)      ← Independent
Prompt 13 (Aria Persona)         ← Independent
Prompt 14 (Acknowledgment)       ← Independent
```

**Recommended execution order:** 0 → 5 → 1 → 13 → 14 → 4 → 9 → 10 → 2 → 3 → 6 → 7 → 8 → 11 → 12

---

## Prompt 0: Fix `responded` Field (NEW — Prerequisite)

**Problem discovered during validation:** `activeElement.responded` is initialized as `false` everywhere and **never set to `true`**. This breaks the element UI tracking, nudge guards (Prompt 3), and retry logic (Prompt 7).

**File:** `src/stores/chat-assessment-store.ts`

### Fix A: Add `isLoading` guard at top of `sendElementResponse()`

At line 453, the function starts:
```typescript
sendElementResponse: async (response) => {
    const { token, messages } = get();
    if (!token) return;
```

Change to:
```typescript
sendElementResponse: async (response) => {
    const { token, messages } = get();
    if (!token) return;
    if (get().isLoading) {
      console.warn("[sendElementResponse] Blocked by isLoading guard");
      return;
    }
```

### Fix B: Set `responded = true` on successful element submission

After line 477 (`if (!res.ok) throw new Error(...)`) and before processing the response content types, add:
```typescript
// Mark element as responded before processing server response
set((s) => ({
  activeElement: s.activeElement ? { ...s.activeElement, responded: true } : null,
}));
```

### Fix C: Restore element on total failure

In the catch block (currently just sets `isLoading: false, error: errorMessage`), also restore the element:
```typescript
catch (err) {
  const errorMessage = err instanceof Error ? err.message : "Something went wrong";
  set((s) => ({
    isLoading: false,
    error: errorMessage,
    orbMode: "idle",
    activeElement: s.activeElement ? { ...s.activeElement, responded: false } : null,
  }));
}
```

**Why this must be Prompt 0:** Without `responded` being set to `true`, the nudge guard in Prompt 3 (`if (el && el.responded) return`) will never trigger, and Prompt 7's retry logic has no baseline to work from.

---

## Prompt 1: History Cap

**File:** `src/app/api/assess/[token]/chat/route.ts`
**Line:** 674

### Change

```typescript
// BEFORE
return history.slice(-20);

// AFTER
return history.slice(-40);
```

**That's it.** No other changes needed.

The `.slice(-10)` at line 308 is for classification context only (last 10 messages, each truncated to 300 chars). It serves a different purpose and should stay at 10.

**Token budget:** 40 messages ≈ 11,400 tokens. Well within Haiku's 200K context window. Zero overflow risk.

---

## Prompt 2: Nudge Resume After Transitions

**File:** `src/components/assessment/stage/assessment-stage.tsx`

### Current behavior
- `playTransitionScript()` calls `nudgeRef.current.pause()` at line 328
- `onTransitionComplete` sets `orchestratorPhase` and `transitioning = false`
- Nudge only resumes when next TTS playback finishes (via `startNudgeForCurrentAct()`)
- **Gap:** Between transition end and first response TTS completion, candidate silence is unmonitored

### Fix: Start nudge in `onTransitionComplete` callbacks

In `handleTransition1to2` (line 502-506), change:
```typescript
// BEFORE
onTransitionComplete: () => {
  const st = getStore();
  st.setOrchestratorPhase("ACT_2");
  st.setTransitioning(false);
},

// AFTER
onTransitionComplete: () => {
  const st = getStore();
  st.setOrchestratorPhase("ACT_2");
  st.setTransitioning(false);
  nudgeRef.current.start("act_2", {
    onNudge: (level) => {
      const s = getStore();
      if (s.isLoading || s.isTTSPlaying) return;
      if (transitionInProgress.current) return;
      if (level === "first") {
        playSegmentTTS(NUDGE_FIRST["act_2"]);
      } else if (level === "second") {
        s.setInputMode("text");
        playSegmentTTS(NUDGE_SECOND["act_2"]);
      } else {
        playSegmentTTS(NUDGE_FINAL["act_2"]).then(() => {
          getStore().setOrbMode("processing");
          getStore().sendMessage("[NO_RESPONSE]");
        });
      }
    },
  });
},
```

In `handleTransition2to3` (line 530-534), apply the same pattern but with `"act_3"` context.

**Why this is safe:** `start()` internally calls `stop()` first. When the next response arrives and TTS completes, `startNudgeForCurrentAct()` will call `start()` again, which auto-stops the transition nudge. No duplication.

**Note:** This duplicates the nudge callback logic from `startNudgeForCurrentAct()`. To keep DRY, consider extracting the `onNudge` callback into a shared helper, but that's optional for Sprint 1.

---

## Prompt 3: Nudge Coverage for Interactive Elements

**Depends on:** Prompt 0 (needs `responded` to be set correctly)

**File:** `src/components/assessment/stage/assessment-stage.tsx`

### Part A: Fix the guard in `startNudgeForCurrentAct()`

Line 356:
```typescript
// BEFORE
if (getStore().activeElement) return;

// AFTER
const el = getStore().activeElement;
if (el && el.responded) return;
```

This allows nudges to fire when an interactive element is displayed but not yet answered.

### Part B: Add nudge management in the `activeElement` useEffect

Lines 759-765:
```typescript
// BEFORE
useEffect(() => {
  if (activeElement && !activeElement.responded) {
    const timer = setTimeout(() => setShowElements(true), 300);
    return () => clearTimeout(timer);
  } else {
    setShowElements(false);
  }
}, [activeElement]);

// AFTER
useEffect(() => {
  if (activeElement && !activeElement.responded) {
    const timer = setTimeout(() => setShowElements(true), 300);
    // Start nudge for unanswered element
    startNudgeForCurrentAct();
    return () => clearTimeout(timer);
  } else {
    setShowElements(false);
    // Stop nudge when element is answered or cleared
    if (!activeElement) {
      nudgeRef.current.stop();
    }
  }
}, [activeElement, startNudgeForCurrentAct]);
```

**Why `start()` not `reset()`:** `start()` internally calls `stop()`, so it's safe to call when a nudge is already running. No need for `reset()` first.

**Why stop on `!activeElement`:** When the element is cleared (after response processing), we stop the element nudge. The next response's TTS completion will restart the conversational nudge.

---

## Prompt 4: Beat 0 Empty Content Guard

**Files:** `src/stores/chat-assessment-store.ts` and `src/app/api/assess/[token]/chat/route.ts`

### Part A: Guard in `displayMessage()` for empty cleaned text

In `chat-assessment-store.ts`, after line 245 (`const cleaned = cleanText(content);`):

```typescript
const cleaned = cleanText(content);
// Guard: if cleanText strips everything, fall back to original content
if (!cleaned.trim()) {
  console.warn("[displayMessage] cleanText returned empty, using raw content");
  // Use the raw content as-is rather than showing nothing
  const fallbackSentences = splitSentences(content);
  set((s) => ({
    subtitleText: fallbackSentences[0] || content,
    subtitleRevealedWords: isHistory ? content.split(/\s+/).length : 0,
    sentenceList: isHistory ? [] : fallbackSentences,
    currentSentenceIndex: 0,
    orbMode: isHistory ? "idle" : "speaking",
    displayEvent: s.displayEvent + 1,
    displayIsHistory: isHistory,
  }));
  return;
}
const sentences = splitSentences(cleaned);
```

### Part B: Serve Beat 0 from content library

In `chat/route.ts`, before the `usePreGenerated` condition (line 438), add a special case for Beat 0 sentinel:

```typescript
// Special case: Beat 0 initial presentation from content library
// [BEGIN_ASSESSMENT] is a sentinel so usePreGenerated won't activate,
// but Beat 0 is unbranched and doesn't need classification.
if (
  FEATURE_FLAGS.CONTENT_LIBRARY_ENABLED
  && state.contentLibraryId
  && state.currentAct === "ACT_1"
  && isSentinel
  && state.currentBeat === 0
  && action.type === "AGENT_MESSAGE"
) {
  try {
    const library = await loadContentLibrary(state.contentLibraryId!);
    const variantSelections = (state.variantSelections as Record<string, number>) ?? {};
    const scenarioIndex = (action.metadata as Record<string, unknown>)?.scenarioIndex as number ?? state.currentScenario;

    // lookupBeatContent ignores classification for Beat 0
    const content = lookupBeatContent(library, scenarioIndex, 0, "ADEQUATE", variantSelections);

    if (content.spokenText) {
      const seq = await nextSequenceOrder();
      await prisma.conversationMessage.create({
        data: {
          assessmentId: assessment.id,
          role: "AGENT",
          content: content.spokenText,
          act: action.act,
          sequenceOrder: seq,
          metadata: {
            ...((action.metadata as Record<string, unknown>) ?? {}),
            preGenerated: true,
            beat0: true,
          } as any,
        },
      });

      if (action.metadata) {
        const stateUpdate = computeStateUpdate(state, action);
        if (Object.keys(stateUpdate).length > 0) {
          await prisma.assessmentState.update({
            where: { assessmentId: assessment.id },
            data: stateUpdate as any,
          });
        }
      }

      return new Response(
        JSON.stringify({
          type: "agent_message",
          message: content.spokenText,
          referenceCard: content.referenceCard || null,
        }),
        { headers: { "Content-Type": "application/json" } },
      );
    }
  } catch (err) {
    console.error("[V2] Beat 0 content library failed, falling back to streaming:", err);
  }
}
```

**No double-delivery risk:** The early `return` ensures only one path executes. If this fails, it falls through to streaming.

---

## Prompt 5: Diagnostic Logging

**File:** `src/app/api/assess/[token]/chat/route.ts`

Add logging at these 4 points. Note: there are **5** `computeStateUpdate()` call sites; log all of them.

### Log 1: After classification (after line 318)
```typescript
console.log(`[DIAG] Classification: act=${state.currentAct} beat=${state.currentBeat} result=${classification.classification} confidence=${classification.confidence}`);
```

### Log 2: After getNextAction (after line 336)
```typescript
console.log(`[DIAG] Action: type=${action.type} act=${(action as any).act} metadata=${JSON.stringify((action as any).metadata ?? {})}`);
```

### Log 3: After each `computeStateUpdate()` call

At **all 5 sites** (lines 321, 381, 417, 493, 554), add after the `computeStateUpdate` call:
```typescript
console.log(`[DIAG] StateUpdate (line XXX): ${JSON.stringify(stateUpdate)}`);
```
Replace `XXX` with the actual line number for traceability.

### Log 4: State snapshot (after line 330, where state is re-fetched)
```typescript
console.log(`[DIAG] State snapshot: act=${state.currentAct} beat=${state.currentBeat} scenario=${state.currentScenario} construct=${state.currentConstruct} phase=${state.currentPhase}`);
```

**Important:** State is re-fetched at lines 293 and 328. Always log the **re-fetched** version since that's what drives subsequent decisions.

---

## Prompt 6: Diagnostic Probe Termination

**File:** `src/lib/assessment/engine.ts`

### Change in `getAct2Action()` — DIAGNOSTIC_PROBE branch (line 312-326)

```typescript
// BEFORE
if (phaseLabel === "DIAGNOSTIC_PROBE") {
  return {
    type: "AGENT_MESSAGE",
    systemPrompt: buildAct2DiagnosticPrompt(constructId, act2Progress[constructId]),
    userContext: lastCandidateMessage
      ? `The candidate responded to a diagnostic probe: "${lastCandidateMessage}". Analyze their response and either ask one more targeted follow-up or conclude the diagnostic for this construct.`
      : `Generate a diagnostic probe question for ${formatConstructName(constructId)}. The probe should investigate the nature of their performance ceiling.`,
    act: "ACT_2",
    metadata: {
      construct: constructId,
      phase,
      phaseLabel: "DIAGNOSTIC_PROBE",
    },
  } satisfies AgentMessageAction;
}

// AFTER
if (phaseLabel === "DIAGNOSTIC_PROBE") {
  const loopState = act2Progress[constructId] as AdaptiveLoopState | undefined;
  // Count real exchanges only — filter out the { role: "complete" } marker
  const realProbeCount = (loopState?.probeExchanges ?? [])
    .filter((p) => !("role" in p && (p as any).role === "complete"))
    .length;

  // Cap at 3 probe exchanges — wrap up and advance construct
  if (realProbeCount >= 3) {
    return {
      type: "AGENT_MESSAGE",
      systemPrompt: buildAct2DiagnosticPrompt(constructId, loopState),
      userContext: `Briefly summarize what you've learned about the candidate's ${formatConstructName(constructId)} abilities from the diagnostic probes. Keep it to 1-2 sentences as a natural transition.`,
      act: "ACT_2",
      metadata: {
        construct: constructId,
        phase,
        phaseLabel: "DIAGNOSTIC_PROBE",
        constructComplete: true,
      },
    } satisfies AgentMessageAction;
  }

  return {
    type: "AGENT_MESSAGE",
    systemPrompt: buildAct2DiagnosticPrompt(constructId, loopState),
    userContext: lastCandidateMessage
      ? `The candidate responded to a diagnostic probe: "${lastCandidateMessage}". Analyze their response and either ask one more targeted follow-up or conclude the diagnostic for this construct.`
      : `Generate a diagnostic probe question for ${formatConstructName(constructId)}. The probe should investigate the nature of their performance ceiling.`,
    act: "ACT_2",
    metadata: {
      construct: constructId,
      phase,
      phaseLabel: "DIAGNOSTIC_PROBE",
    },
  } satisfies AgentMessageAction;
}
```

**Key detail:** The `{ role: "complete" }` marker hack at line 596 is filtered out of the count. The `constructComplete: true` metadata triggers the existing construct-advancement logic at line 588.

**Timing note:** `probeExchanges` are recorded AFTER `getNextAction()` runs (on the next turn). So `>= 3` fires after 3 responses have been recorded — meaning the candidate gets exactly 3 probe exchanges before wrap-up.

---

## Prompt 7: Element Retry on Network Failure

**Depends on:** Prompt 0 (needs `responded` tracking and `isLoading` guard)

**File:** `src/stores/chat-assessment-store.ts`

### Wrap fetch in retry loop

Replace the fetch call inside `sendElementResponse()` (lines 467-477) with a retry wrapper:

```typescript
try {
  let res: Response | null = null;
  let lastError: Error | null = null;
  const MAX_RETRIES = 3;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      res = await fetch(`/api/assess/${token}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...messages, userMsg].map((m) => ({ role: m.role, content: m.content })),
          elementResponse: response,
        }),
      });

      if (!res.ok) {
        throw new Error(`Element response failed: ${res.status}`);
      }
      break; // Success — exit retry loop
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.warn(`[sendElementResponse] Attempt ${attempt}/${MAX_RETRIES} failed:`, lastError.message);
      if (attempt < MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, 1000 * attempt)); // Backoff: 1s, 2s
      }
    }
  }

  if (!res || !res.ok) {
    throw lastError ?? new Error("Element response failed after retries");
  }

  // Mark element as responded on success
  set((s) => ({
    activeElement: s.activeElement ? { ...s.activeElement, responded: true } : null,
  }));

  // ... rest of response processing (contentType check, JSON/stream handling) ...
```

The catch block (from Prompt 0 Fix C) handles total failure by restoring the element with `responded: false`.

**No `isLoading` conflict:** The `isLoading` guard from Prompt 0 Fix A prevents duplicate calls from the UI. Within the retry loop, `isLoading` remains `true` so retries aren't blocked (they're internal to the same function call).

---

## Prompt 8: Act 3 Confidence Item State Machine

**File:** `src/lib/assessment/engine.ts`

### Step 1: Add `confidenceItemPending` to the act3Progress type assertion

At lines 422-430 in `getAct3Action()`:
```typescript
// BEFORE
const act3Progress = (state.act3Progress as {
  confidenceItemsComplete: number;
  parallelScenariosComplete: number;
  selfAssessmentComplete: boolean;
} | null) ?? {
  confidenceItemsComplete: 0,
  parallelScenariosComplete: 0,
  selfAssessmentComplete: false,
};

// AFTER
const act3Progress = (state.act3Progress as {
  confidenceItemsComplete: number;
  confidenceItemPending: boolean;
  parallelScenariosComplete: number;
  selfAssessmentComplete: boolean;
} | null) ?? {
  confidenceItemsComplete: 0,
  confidenceItemPending: false,
  parallelScenariosComplete: 0,
  selfAssessmentComplete: false,
};
```

Apply the **same change** to the type assertion in `computeStateUpdate()` at lines 632-640.

### Step 2: Replace the confidence item logic in `getAct3Action()` (lines 432-458)

```typescript
// Phase 1: Confidence-tagged items
if (act3Progress.confidenceItemsComplete < ASSESSMENT_STRUCTURE.act3ConfidenceItems) {
  // After MCQ: serve confidence rating
  if (act3Progress.confidenceItemPending) {
    return {
      type: "INTERACTIVE_ELEMENT",
      elementType: "CONFIDENCE_RATING",
      elementData: {
        prompt: "How confident are you in that answer?",
        options: ["Very confident", "Somewhat confident", "Not sure"],
      },
      act: "ACT_3",
      metadata: { confidenceRating: true },
    } satisfies InteractiveElementAction;
  }

  // Serve next MCQ from item bank
  const targetConstructs = SCENARIOS[state.currentScenario]?.primaryConstructs ?? [];
  const construct = targetConstructs[act3Progress.confidenceItemsComplete % targetConstructs.length];
  const items = getItemsForConstruct(construct as string);
  const item = items[act3Progress.confidenceItemsComplete % items.length];

  if (item) {
    return {
      type: "INTERACTIVE_ELEMENT",
      elementType: item.elementType as InteractionElementType,
      elementData: {
        prompt: item.prompt,
        options: item.options,
        correctAnswer: item.correctAnswer,
        construct: construct,
        itemId: item.id ?? `act3-confidence-${act3Progress.confidenceItemsComplete}`,
      },
      act: "ACT_3",
      metadata: { confidenceItem: true },
    } satisfies InteractiveElementAction;
  }

  // Fallback if no items available
  return {
    type: "INTERACTIVE_ELEMENT",
    elementType: "MULTIPLE_CHOICE_INLINE",
    elementData: {
      prompt: `[Confidence-tagged item ${act3Progress.confidenceItemsComplete + 1}]`,
      itemId: `act3-confidence-${act3Progress.confidenceItemsComplete}`,
    },
    act: "ACT_3",
    metadata: { confidenceItem: true },
  } satisfies InteractiveElementAction;
}
```

### Step 3: Update `computeStateUpdate()` for ACT_3 (lines 646-654)

```typescript
// BEFORE — only handles CONFIDENCE_RATING
if (action.type === "INTERACTIVE_ELEMENT" && (action as InteractiveElementAction).elementType === "CONFIDENCE_RATING") {
  return {
    act3Progress: {
      ...act3Progress,
      confidenceItemsComplete: act3Progress.confidenceItemsComplete + 1,
    } as unknown as AssessmentState["act3Progress"],
  };
}

// AFTER — handles both MCQ dispatch and CONFIDENCE_RATING dispatch
if (action.type === "INTERACTIVE_ELEMENT") {
  const elementAction = action as InteractiveElementAction;

  // MCQ dispatched → mark pending
  if (elementAction.metadata?.confidenceItem) {
    return {
      act3Progress: {
        ...act3Progress,
        confidenceItemPending: true,
      } as unknown as AssessmentState["act3Progress"],
    };
  }

  // CONFIDENCE_RATING dispatched → clear pending, increment counter
  if (elementAction.elementType === "CONFIDENCE_RATING") {
    return {
      act3Progress: {
        ...act3Progress,
        confidenceItemPending: false,
        confidenceItemsComplete: act3Progress.confidenceItemsComplete + 1,
      } as unknown as AssessmentState["act3Progress"],
    };
  }
}
```

**State machine flow:**
1. MCQ dispatched → `computeStateUpdate` runs (line 381) → `confidenceItemPending = true`
2. Candidate answers MCQ → next API call → engine sees `confidenceItemPending = true` → serves CONFIDENCE_RATING
3. CONFIDENCE_RATING dispatched → `computeStateUpdate` runs → `confidenceItemPending = false`, `confidenceItemsComplete++`
4. Candidate answers rating → next API call → counter check → serves next MCQ (or advances to Phase 2)

---

## Prompt 9: referenceRevealCount Override

**File:** `src/stores/chat-assessment-store.ts`

### Fix `computeRevealCount()` (lines 212-216)

```typescript
// BEFORE
const computeRevealCount = (prev: ScenarioReference | null): number => {
  if (isHistory) return -1;
  if (parsed.referenceIsExplicit && !prev) return 0;
  return -1;
};

// AFTER
const computeRevealCount = (prev: ScenarioReference | null, currentRevealCount: number): number => {
  if (isHistory) return -1;
  if (parsed.referenceIsExplicit && !prev) return 0; // New scenario Beat 0
  // Preserve existing reveal count of 0 (progressive reveal still in progress)
  if (currentRevealCount === 0) return 0;
  return -1;
};
```

### Update the call site (line 238)

```typescript
// BEFORE
referenceRevealCount: computeRevealCount(s.referenceCard),

// AFTER
referenceRevealCount: computeRevealCount(s.referenceCard, s.referenceRevealCount),
```

This uses the Zustand `set((s) => ...)` state parameter `s`, which is the correct way to access current state inside the setter.

---

## Prompt 10: Silent Reference Update Drops

**File:** `src/stores/chat-assessment-store.ts`

### Fix the referenceUpdate guard in `sendMessage()` (lines 387-397)

```typescript
// BEFORE
if (data.referenceUpdate && get().referenceCard) {
  const card = get().referenceCard!;
  set({
    referenceCard: {
      ...card,
      newInformation: [...card.newInformation, ...(data.referenceUpdate.newInformation || [])],
      question: data.referenceUpdate.question || card.question,
    },
    referenceRevealCount: -1,
  });
}

// AFTER
if (data.referenceUpdate) {
  const card = get().referenceCard;
  if (card) {
    // Merge into existing card
    set({
      referenceCard: {
        ...card,
        newInformation: [...card.newInformation, ...(data.referenceUpdate.newInformation || [])],
        question: data.referenceUpdate.question || card.question,
      },
      referenceRevealCount: -1,
    });
  } else {
    // No card exists yet — create a minimal one from update data
    set({
      referenceCard: {
        context: "Situation Update",
        sections: [],
        newInformation: data.referenceUpdate.newInformation || [],
        question: data.referenceUpdate.question || "",
      },
      referenceRevealCount: -1,
    });
  }
}
```

**Type safety:** `ScenarioReference` requires `context` (string) and `sections` (array). Using `"Situation Update"` as context ensures the card renders meaningfully. `role` and `question` are optional.

---

## Prompt 11: Parallel Scenario Templates

**File:** `src/lib/assessment/engine.ts`

### Replace the parallel scenario prompt (lines 460-477)

```typescript
// BEFORE
if (act3Progress.parallelScenariosComplete < ASSESSMENT_STRUCTURE.act3ParallelScenarios) {
  return {
    type: "AGENT_MESSAGE",
    systemPrompt: `You are presenting a brief scenario structurally identical to one from the earlier scenario section, but with completely different surface details. This tests consistency.

RULES:
- Keep the scenario brief (1-2 paragraphs)
- Present the same type of dilemma with different characters and setting
- Ask the candidate how they would handle the situation
- Do not reference the earlier scenario`,
    userContext: `Generate parallel scenario ${act3Progress.parallelScenariosComplete + 1}. This should be structurally similar to Act 1 Scenario ${act3Progress.parallelScenariosComplete + 1} but with entirely different surface content.`,
    act: "ACT_3",
    metadata: {
      parallelScenarioIndex: act3Progress.parallelScenariosComplete,
    },
  } satisfies AgentMessageAction;
}

// AFTER
if (act3Progress.parallelScenariosComplete < ASSESSMENT_STRUCTURE.act3ParallelScenarios) {
  const sourceScenarioIndex = act3Progress.parallelScenariosComplete % SCENARIOS.length;
  const sourceScenario = SCENARIOS[sourceScenarioIndex];

  return {
    type: "AGENT_MESSAGE",
    systemPrompt: `You are presenting a brief parallel scenario to test behavioral consistency. The candidate previously worked through a scenario with this structure:

SOURCE SCENARIO: "${sourceScenario.name}"
DESCRIPTION: ${sourceScenario.description}
PRIMARY CONSTRUCTS TESTED: ${sourceScenario.primaryConstructs.join(", ")}

Your task: Create a NEW scenario that tests the SAME constructs and presents the SAME structural dilemma, but with COMPLETELY DIFFERENT surface details (different industry, characters, setting, specifics).

RULES:
- Keep the scenario to 1-2 paragraphs
- Match the structural tension of the source (same type of competing pressures)
- Use entirely different domain/characters/setting
- End by asking the candidate how they would handle the situation
- Do NOT reference or remind them of the earlier scenario
- Do NOT say this is a "parallel" or "consistency" test`,
    userContext: `Present parallel scenario ${act3Progress.parallelScenariosComplete + 1} of ${ASSESSMENT_STRUCTURE.act3ParallelScenarios}. This parallels the Act 1 scenario "${sourceScenario.name}" but must feel like a fresh, independent situation.`,
    act: "ACT_3",
    metadata: {
      parallelScenarioIndex: act3Progress.parallelScenariosComplete,
      sourceScenarioIndex,
    },
  } satisfies AgentMessageAction;
}
```

**Data available:** Each scenario in `SCENARIOS` has `name`, `description`, `primaryConstructs`, `beats`, and `domainNeutralContent`. All accessed via direct import.

**Counter timing:** `parallelScenariosComplete` increments in `computeStateUpdate()` after the streaming response completes (onFinish callback at line 554). This is correct — the counter advances after the candidate responds.

---

## Prompt 12: 3-Turn Self-Assessment

**File:** `src/lib/assessment/engine.ts`

### Step 1: Add `selfAssessmentTurn` to act3Progress type assertions

In both `getAct3Action()` (line 422) and `computeStateUpdate()` (line 632), add `selfAssessmentTurn: number` to the type and `selfAssessmentTurn: 0` to the default.

### Step 2: Define the 3 questions

Add above `getAct3Action()`:
```typescript
const SELF_ASSESSMENT_QUESTIONS = [
  {
    prompt: "Across everything we've done today, which parts felt easiest for you? Which felt hardest?",
    context: "This is the first of three brief reflection questions. Ask warmly and conversationally.",
  },
  {
    prompt: "Were there moments where you felt uncertain but went with your first instinct? What was that like?",
    context: "This is the second reflection question. Build on what they shared in the previous answer. Be warm and curious.",
  },
  {
    prompt: "If you could go back and approach one of today's challenges differently, which would it be and what would you change?",
    context: "This is the final reflection question. Acknowledge what they've shared so far. This is the last question of the entire assessment — end on a warm, encouraging note.",
  },
];
```

### Step 3: Replace self-assessment logic (lines 479-488)

```typescript
// BEFORE
if (!act3Progress.selfAssessmentComplete) {
  return {
    type: "AGENT_MESSAGE",
    systemPrompt: `You are conducting the final reflective self-assessment. Ask the candidate to reflect on the entire assessment experience.`,
    userContext: `Ask: "Across everything we have done today, which parts felt easiest for you? Which felt hardest? Were there moments where you felt uncertain but went with your first instinct?" This is a warm, open-ended closing question.`,
    act: "ACT_3",
    metadata: { selfAssessment: true },
  } satisfies AgentMessageAction;
}

// AFTER
if (!act3Progress.selfAssessmentComplete) {
  const turn = act3Progress.selfAssessmentTurn ?? 0;
  const question = SELF_ASSESSMENT_QUESTIONS[turn] ?? SELF_ASSESSMENT_QUESTIONS[0];
  const isFinal = turn >= SELF_ASSESSMENT_QUESTIONS.length - 1;

  return {
    type: "AGENT_MESSAGE",
    systemPrompt: `You are conducting the final reflective self-assessment. ${question.context}`,
    userContext: `Ask: "${question.prompt}"`,
    act: "ACT_3",
    metadata: {
      selfAssessment: true,
      selfAssessmentTurn: turn,
      selfAssessmentFinal: isFinal,
    },
  } satisfies AgentMessageAction;
}
```

### Step 4: Update `computeStateUpdate()` for self-assessment (lines 666-673)

```typescript
// BEFORE
if (metadata?.selfAssessment) {
  return {
    act3Progress: {
      ...act3Progress,
      selfAssessmentComplete: true,
    } as unknown as AssessmentState["act3Progress"],
  };
}

// AFTER
if (metadata?.selfAssessment) {
  const nextTurn = ((act3Progress.selfAssessmentTurn ?? 0) + 1);
  const isComplete = metadata.selfAssessmentFinal === true;
  return {
    act3Progress: {
      ...act3Progress,
      selfAssessmentTurn: nextTurn,
      selfAssessmentComplete: isComplete,
    } as unknown as AssessmentState["act3Progress"],
  };
}
```

**No migration needed:** `act3Progress` is a JSON field — adding `selfAssessmentTurn` just works.

**Timing:** `computeStateUpdate` for AGENT_MESSAGE runs in `onFinish` (line 554), after streaming completes. So `selfAssessmentTurn` increments after the agent delivers the question and the candidate presumably responds on the next call.

---

## Prompt 13: Aria Persona Block

**File:** `src/lib/assessment/engine.ts`

### Define the persona block

Add at top of file (after imports):
```typescript
const ARIA_PERSONA = `You are Aria, an AI assessment facilitator. Your personality:
- Warm but professional. Like a skilled interviewer who genuinely cares about understanding the candidate.
- Conversational, not robotic. Use natural speech patterns. Contractions are fine.
- Encouraging without being patronizing. Never say "great answer" or evaluate quality.
- Adaptive — if the candidate seems nervous, be warmer. If they're confident, match their energy.
- Concise — keep responses focused. Don't ramble or over-explain.
- You refer to yourself as "I" and the candidate as "you."

`;
```

### Prepend to ALL 6 system prompt locations

1. **`buildGreetingPrompt()`** (line 711): Prepend `ARIA_PERSONA` to the return string
2. **`buildAct1SystemPrompt()`** (line ~183): Prepend `ARIA_PERSONA` to the return string
3. **`buildAct2SystemPrompt()`** (line 389): Prepend `ARIA_PERSONA` to the return string
4. **`buildAct2DiagnosticPrompt()`** (line 401): Prepend `ARIA_PERSONA` to the return string
5. **Inline Act 3 parallel scenario prompt** (line 464): Prepend `ARIA_PERSONA` to systemPrompt string
6. **Inline Act 3 self-assessment prompt** (line 483): Prepend `ARIA_PERSONA` to systemPrompt string

Example for `buildGreetingPrompt()`:
```typescript
export function buildGreetingPrompt(candidateName: string, companyName: string): string {
  return ARIA_PERSONA + `You are beginning a conversational assessment. Greet the candidate warmly and explain the format.
...`;
}
```

**Not applied to:** `generateAcknowledgment()` — that function uses a user-role message (not a system prompt) and is a utility call, not Aria speaking.

---

## Prompt 14: Acknowledgment Prompt

**File:** `src/lib/assessment/generate-acknowledgment.ts`

### Step 1: Update function signature (line 15)

```typescript
// BEFORE
export async function generateAcknowledgment(
  candidateInput: string,
  beatType: string,
  constructs: string[],
): Promise<string> {

// AFTER
export async function generateAcknowledgment(
  candidateInput: string,
  beatType: string,
  constructs: string[],
  scenarioName?: string,
  lastAriaMessage?: string,
): Promise<string> {
```

### Step 2: Replace the prompt (lines 42-47)

```typescript
// BEFORE
content: `Generate ONE sentence (max 20 words) acknowledging this candidate's response in a conversational assessment. Reference something specific they said. Do NOT evaluate correctness or quality. Do NOT say "great" or "good answer". Just show you heard them.

Beat type: ${beatType}
Candidate said: "${candidateInput.slice(0, 500)}"

Reply with ONLY the acknowledgment sentence, nothing else.`

// AFTER
content: `Generate ONE sentence (max 20 words) that naturally bridges from the candidate's response to the next part of the assessment. This sentence should:
- Reference something specific the candidate said
- Feel like a natural conversational transition
- NOT evaluate correctness or quality
- NOT say "great", "good answer", "excellent", or similar praise
- NOT ask a question

Context:
Scenario: ${scenarioName ?? "workplace scenario"}
Beat type: ${beatType}
${lastAriaMessage ? `Last thing Aria said: "${lastAriaMessage.slice(0, 300)}"` : ""}
Candidate said: "${candidateInput.slice(0, 500)}"

Examples of good acknowledgments:
- "That perspective on the stakeholder dynamics is worth exploring further."
- "I can see how the timeline pressure shaped your thinking there."
- "The way you weighed those trade-offs tells me a lot."

Reply with ONLY the acknowledgment sentence, nothing else.`
```

### Step 3: Update the call site in chat/route.ts (lines 458-464)

```typescript
// BEFORE
const beat = SCENARIOS[scenarioIndex]?.beats[beatIndex];
const acknowledgment = await generateAcknowledgment(
  lastUserMessage,
  beat?.type ?? "INITIAL_RESPONSE",
  (beat?.primaryConstructs as string[]) ?? [],
);

// AFTER
const beat = SCENARIOS[scenarioIndex]?.beats[beatIndex];
const scenario = SCENARIOS[scenarioIndex];
const lastAriaMsg = assessment.messages
  .filter((m) => m.role === "AGENT")
  .pop()?.content;
const acknowledgment = await generateAcknowledgment(
  lastUserMessage,
  beat?.type ?? "INITIAL_RESPONSE",
  (beat?.primaryConstructs as string[]) ?? [],
  scenario?.name,
  lastAriaMsg,
);
```

Both `scenario.name` and the last agent message are available at this point in the handler.

---

## Key Files Modified (Summary)

| File | Prompts |
|------|---------|
| `src/stores/chat-assessment-store.ts` | 0, 4A, 7, 9, 10 |
| `src/app/api/assess/[token]/chat/route.ts` | 1, 4B, 5, 14 |
| `src/lib/assessment/engine.ts` | 6, 8, 11, 12, 13 |
| `src/components/assessment/stage/assessment-stage.tsx` | 2, 3 |
| `src/lib/assessment/generate-acknowledgment.ts` | 14 |

---

## Post-Sprint Verification Checklist

After all 15 prompts (0-14) are applied:

- [ ] Start a new assessment — Beat 0 renders with content (not empty)
- [ ] Complete all Act 1 beats — transitions work, nudge fires between responses
- [ ] Transition 1→2 fires nudge in Act 2
- [ ] Act 2 calibration items render and can be answered
- [ ] Diagnostic probes cap at 3 exchanges per construct
- [ ] Transition 2→3 fires nudge in Act 3
- [ ] Act 3 confidence items alternate MCQ → rating correctly
- [ ] Parallel scenarios reference source scenario structure
- [ ] Self-assessment asks 3 sequential questions
- [ ] Assessment completes end-to-end with scored profile
- [ ] Reference card updates don't drop silently
- [ ] Aria maintains consistent persona voice throughout
- [ ] Console logs show diagnostic trace for debugging
- [ ] Element retry works on simulated network failure (throttle in DevTools)

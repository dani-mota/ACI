# Question Format UI & Design System Reference

**Purpose:** Complete visual and interaction specification for every question format in the ACI assessment. Covers design tokens, component anatomy, layout systems, state machines, accessibility, and UX audit findings.

**Methodology:** Every specification below was extracted from source code with file:line references. UX/UI audit was conducted against all components.

---

## Part 1: Design System Foundation

### 1.1 Design Tokens (`.stage-root`)

Defined in [globals.css](src/app/globals.css):

| Token | Value | Usage |
|-------|-------|-------|
| `--s-bg` | `#080e1a` | Primary background (deep navy) |
| `--s-bg2` | `#0f1729` | Secondary background |
| `--s-bg3` | `#131c2e` | Tertiary background |
| `--s-blue` | `#2563EB` | Primary accent (interactive elements) |
| `--s-blue-g` | `#4a8af5` | Glowing blue (hover/active) |
| `--s-green` | `#059669` | Success / confidence accent |
| `--s-green-b` | `#22d68a` | Bright green |
| `--s-amber` | `#D97706` | Warning state |
| `--s-gold` | `#C9A84C` | Timer warning |
| `--s-red` | `#DC2626` | Error / critical timer |
| `--s-t1` | `#c9d6e8` | Text primary |
| `--s-t2` | `#7b8fa8` | Text secondary |
| `--s-t3` | `#3d5068` | Text tertiary / muted |
| `--s-t4` | `#b8c4d6` | Text auxiliary |
| `--s-border` | `rgba(37,99,235,0.12)` | Glass border |
| `--s-glass` | `rgba(9,15,30,0.88)` | Glass morphism fill |
| `--s-glass-border` | `rgba(37,99,235,0.18)` | Highlighted glass border |
| `--s-glass-light` | `rgba(255,255,255,0.025)` | Light glass fill |

### 1.2 Typography

| Family | Variable | Usage |
|--------|----------|-------|
| Inter | `--font-sans` | Body text, prompts, options |
| DM Sans | `--font-display` | Headings, act labels |
| JetBrains Mono | `--font-mono` | Numbers, timers, ASCII diagrams, numeric input |

### 1.3 Border Radius

All radii collapse to a tight, precise feel:

| Token | Value |
|-------|-------|
| sm | 2px |
| md | 4px |
| lg | 6px |
| xl–4xl | 8px |

### 1.4 Shared Animations

Defined in [globals.css](src/app/globals.css):

| Keyframe | Effect | Used By |
|----------|--------|---------|
| `cardIn` | `translateY(7px)→0`, `opacity 0→1` | All interactive cards |
| `wordReveal` | `opacity 0→1`, `blur(2px)→0` | Subtitle word-by-word |
| `dotPulse` | `opacity 0.3↔1`, `scale(0.85↔1)` | Timer critical state |
| `blockBreathe` | Border color + opacity pulse | Reference card sections |

### 1.5 Shared Transition Classes

| Class | Properties |
|-------|-----------|
| `.stage-animate` | `transition: opacity 300ms ease, transform 300ms ease` |

### 1.6 Glass Morphism Pattern

Every interactive card uses the same glass formula:

```
background: rgba(9, 15, 30, 0.88)     /* --s-glass */
backdrop-filter: blur(16px)
border: 1px solid rgba(37, 99, 235, 0.18) /* --s-glass-border */
border-radius: 8px
```

---

## Part 2: The 9 Question Formats

### Format 1: Conversational / Open Voice

**When:** Phase 0 intro, Act 1 (streaming beats), Act 2 diagnostic probes, Act 3 reflective questions
**Layout:** [CenteredLayout](src/components/assessment/layouts/centered-layout.tsx)
**Interactive Element:** None — voice/text input only

```
┌──────────────────────────────────┐
│           [Act Label]            │
│                                  │
│              ◉ Orb               │  ← top: 38%, centered
│                                  │
│     Subtitle text appears here   │  ← orbTop + 140px
│     word by word with reveal     │
│                                  │
│                                  │
│  ┌────────────────────────────┐  │
│  │  Text input / Mic button   │  │  ← pinned to bottom
│  └────────────────────────────┘  │
└──────────────────────────────────┘
```

**Orb behavior:** Positioned at `(left: 50%, top: 38%)`, transitions with `1000ms cubic-bezier(0.25, 0.1, 0.25, 1)`. Driven by `audioAmplitude` during TTS playback.

**Content area:** Masked with `linear-gradient(to bottom, black 80%, transparent)` fade at bottom edge. Scrollable overflow.

---

### Format 2: Reference Card Build (Act 1, Beat 0)

**When:** First beat of Act 1 — scenario introduction with progressive reference card reveal
**Layout:** [ReferenceSplitLayout](src/components/assessment/layouts/reference-split-layout.tsx)
**Interactive Element:** None — reference card builds passively

**Desktop (≥768px):**
```
┌───────────────────┬─────────────────────┐
│                   │                     │
│   Reference Card  │   AriaSidebar       │
│   (scrollable)    │   (orb + subtitle   │
│                   │    + input)         │
│   ┌─────────────┐ │                     │
│   │ Role        │ │                     │
│   │ Context     │ │                     │
│   │ Section 1   │ │                     │
│   │  • item     │ │                     │
│   │  • item     │ │                     │
│   │ Section 2   │ │                     │
│   │  • item ★   │ │  ← highlighted     │
│   └─────────────┘ │                     │
│                   │                     │
└───────────────────┴─────────────────────┘
         flex: 1           flex: 1
```

**Mobile (<768px):**
```
┌──────────────────────────────────┐
│                                  │
│        AriaSidebar (full)        │
│        (orb + subtitle)          │
│                                  │
│                                  │
├──────────────────────────────────┤
│  ▬▬▬  drag handle               │  ← 32×3px bar
│  ┌────────────────────────────┐  │
│  │  Collapsible Reference     │  │  ← max 60vh / 400px
│  │  Card (bottom sheet)       │  │
│  └────────────────────────────┘  │
│  [Toggle ▲/▼]                    │
└──────────────────────────────────┘
```

**Reference card data shape:**
```typescript
{
  role: string;          // "Operations Manager"
  context: string;       // max 10 words
  sections: [{
    label: string;       // section heading
    items: string[];     // bullet points
    highlight?: boolean; // pulsing border animation
  }];
  question: string;      // current question text
}
```

**Progressive reveal:** `referenceRevealCount` controls how many sections are visible. New sections animate in with `blockBreathe` border animation on highlighted items.

---

### Format 3: Reference Card Update (Act 1, Beats 1–5)

**When:** Subsequent Act 1 beats — existing reference card updates with new information
**Layout:** [ReferenceSplitLayout](src/components/assessment/layouts/reference-split-layout.tsx)
**Interactive Element:** None

Same layout as Format 2. Difference is behavioral:
- Reference card already exists from Beat 0
- New sections/items append with highlight animation
- `referenceRevealCount` increments to show new data
- `referenceUpdate` data merges into existing card

---

### Format 4: Multiple Choice

**When:** Act 2 — `MULTIPLE_CHOICE_INLINE` or `TRADEOFF_SELECTION` items
**Layout:** [InteractiveSplitLayout](src/components/assessment/layouts/interactive-split-layout.tsx)
**Component:** [StageChoiceCards](src/components/assessment/interactive/stage-choice-cards.tsx)

**Desktop layout:**
```
┌────────────────────────┬───────────────────┐
│                        │                   │
│  ┌──────────────────┐  │   AriaSidebar     │
│  │ ● Question text  │  │   (orb + narr.)   │
│  │                  │  │                   │
│  │ ┌──────────────┐ │  │                   │
│  │ │ Ⓐ Option 1   │ │  │                   │
│  │ └──────────────┘ │  │                   │
│  │ ┌──────────────┐ │  │                   │
│  │ │ Ⓑ Option 2   │ │  │                   │
│  │ └──────────────┘ │  │                   │
│  │ ┌──────────────┐ │  │                   │
│  │ │ Ⓒ Option 3   │ │  │                   │
│  │ └──────────────┘ │  │                   │
│  │ ┌──────────────┐ │  │                   │
│  │ │ Ⓓ Option 4   │ │  │                   │
│  │ └──────────────┘ │  │                   │
│  └──────────────────┘  │                   │
│        60%             │       40%         │
└────────────────────────┴───────────────────┘
```

**Card anatomy:**

```
┌─ 3px blue accent bar ─────────────────────────────┐
│                                                     │
│  Question prompt text (--s-t2, 14px)               │
│                                                     │
│  ┌────────────────────────────────────────────┐    │
│  │ ┌───┐                                      │    │
│  │ │ A │  Option text (--s-t1, 15px)          │    │  ← glass bg
│  │ └───┘  27×27px circle, monospace            │    │
│  └────────────────────────────────────────────┘    │
│  3px gap                                            │
│  ┌────────────────────────────────────────────┐    │
│  │ ┌───┐                                      │    │
│  │ │ B │  Option text                         │    │
│  │ └───┘                                       │    │
│  └────────────────────────────────────────────┘    │
│                                                     │
└─────────────────────────────────────────────────────┘
```

**States:**

| State | Background | Border | Opacity |
|-------|-----------|--------|---------|
| Default | transparent | `rgba(255,255,255,0.06)` | 1.0 |
| Hover | — | — | 1.0 + `translateX(3px)` |
| Focus-visible | — | — | + 2px blue outline |
| Selected | `rgba(37,99,235,0.12)` | `rgba(37,99,235,0.5)` | 1.0 |
| Other (when one selected) | — | — | 0.3 |
| Disabled | — | — | 0.4, no pointer events |

**Keyboard shortcuts:**
- `A`/`B`/`C`/`D` — instant selection by letter
- Arrow keys — navigate with wrapping
- Enter/Space — confirm focused option
- Roving tabindex (only focused item tabbable)

**Animation:** Entry via `cardIn 0.4s cubic-bezier(0.16, 1, 0.3, 1)` with stagger per option.

---

### Format 5: Timed Challenge

**When:** Act 2 — `TIMED_CHALLENGE` items
**Layout:** [InteractiveSplitLayout](src/components/assessment/layouts/interactive-split-layout.tsx)
**Component:** [StageTimedChallenge](src/components/assessment/interactive/stage-timed-challenge.tsx)

```
┌────────────────────────┬───────────────────┐
│                        │                   │
│  ┌──────────────────┐  │   AriaSidebar     │
│  │   ⏱ 01:24        │  │                   │
│  │  ████████░░░░░░░  │  │                   │
│  └──────────────────┘  │                   │
│                        │                   │
│  ┌──────────────────┐  │                   │
│  │ ● Question text  │  │                   │
│  │                  │  │                   │
│  │  Ⓐ Option 1     │  │                   │
│  │  Ⓑ Option 2     │  │                   │
│  │  Ⓒ Option 3     │  │                   │
│  │  Ⓓ Option 4     │  │                   │
│  └──────────────────┘  │                   │
│        60%             │       40%         │
└────────────────────────┴───────────────────┘
```

**Timer display:**

| Time Remaining | Color | Effect |
|----------------|-------|--------|
| > 50% | `--s-gold` (#C9A84C) | Steady |
| 20–50% | `--s-amber` (#D97706) | Steady |
| < 20% | `--s-red` (#DC2626) | Steady |
| ≤ 10 seconds | `--s-red` | `dotPulse` animation |

**Timer specs:**
- Font: JetBrains Mono, 24–32px, `tabular-nums`
- Format: `MM:SS`
- Updates at 4Hz (250ms intervals via `Date.now()`)
- Pauses on tab hidden (visibility change API)
- Progress bar: 4px height, gradient fill + glow shadow (`0 0 10px ${color}44`)

**On timeout:** Calls `onTimeout()` — records `[TIMEOUT]` response.

**Choice cards:** Rendered via embedded `StageChoiceCards` component — same anatomy as Format 4.

---

### Format 6: Numeric Input

**When:** Act 2 — `NUMERIC_INPUT` items
**Layout:** [InteractiveSplitLayout](src/components/assessment/layouts/interactive-split-layout.tsx)
**Component:** [StageNumericInput](src/components/assessment/interactive/stage-numeric-input.tsx)

```
┌────────────────────────┬───────────────────┐
│                        │                   │
│  ┌──────────────────┐  │   AriaSidebar     │
│  │ ● Question text  │  │                   │
│  │                  │  │                   │
│  │  ┌──────────┐    │  │                   │
│  │  │  42.5    │ kg │  │                   │
│  │  └──────────┘    │  │                   │
│  │                  │  │                   │
│  │  [ Submit → ]    │  │                   │
│  └──────────────────┘  │                   │
│        60%             │       40%         │
└────────────────────────┴───────────────────┘
```

**Input field specs:**
- Width: 180px, center-aligned
- Font: JetBrains Mono, 26px, `tabular-nums`
- `inputMode="decimal"` (mobile number keyboard)
- Optional unit suffix displayed after input

**States:**

| State | Border Color | Notes |
|-------|-------------|-------|
| Default | `rgba(255,255,255,0.08)` | Ready for input |
| Focus | `var(--s-blue)` | Blue border |
| Error | `var(--s-red)` (#DC2626) | Invalid number + error message |
| Submitted | `var(--s-green)` (#059669) | Green border, disabled |

**Submit button:**
- Enabled: `rgba(37,99,235,0.12)` background, visible arrow icon
- Disabled: transparent, grayed out
- Trigger: Enter key or click

**Validation:** Real-time — must parse as valid number. Error message appears with `role="alert"` and `cardIn 0.3s` animation.

**Optional ASCII diagram:** When `elementData.asciiDiagram` exists, rendered above the question in:
```
font: var(--font-mono), clamp(10px, 1.2vw, 13px)
color: var(--s-t2)
background: rgba(255,255,255,0.02)
border: 1px solid rgba(255,255,255,0.05)
border-radius: 8px
padding: 12px 16px
white-space: pre
```

---

### Format 7: Confidence Rating

**When:** Act 3 — after answering a calibration item
**Layout:** [ConfidenceLayout](src/components/assessment/layouts/confidence-layout.tsx)
**Component:** [StageConfidenceRating](src/components/assessment/interactive/stage-confidence-rating.tsx)

```
┌──────────────────────────────────┐
│           [Act Label]            │
│                                  │
│              ◉ Orb               │
│                                  │
│     "How confident are you       │
│      in your answer?"            │
│                                  │
│  ┌────────────────────────────┐  │
│  │ ┌────┐ ┌────┐ ┌────┐     │  │
│  │ │ ✓  │ │ ~  │ │ ?  │     │  │
│  │ │Very│ │Some│ │Not │     │  │
│  │ │Conf│ │Conf│ │Sure│     │  │
│  │ └────┘ └────┘ └────┘     │  │
│  └────────────────────────────┘  │
│                                  │
│  ┌────────────────────────────┐  │
│  │  Text input / Mic button   │  │
│  └────────────────────────────┘  │
└──────────────────────────────────┘
```

**Three options (hardcoded):**

| Option | Value | Icon | Color | Subtext |
|--------|-------|------|-------|---------|
| Very Confident | `VERY_CONFIDENT` | ✓ checkmark | `--s-green` (#059669) | "I'm sure of my answer" |
| Somewhat Confident | `SOMEWHAT_CONFIDENT` | ~ wavy line | `--s-gold` (#C9A84C) | "Reasonably certain" |
| Not Sure | `NOT_SURE` | ? circle | `--s-t2` (#7b8fa8) | "I was guessing" |

**Card specs:**
- Green accent bar (3px solid `--s-green`) instead of blue
- Icons: Custom SVGs, 24×24px
- Buttons: min-height 72px, min-width 80px, flex layout
- Selected: background `rgba(color, 0.08)`, border `rgba(color, 0.4)`
- Unselected after selection: opacity 0.25

**Keyboard:** Arrow keys navigate, Enter/Space to select.

---

### Format 8: Act Transition

**When:** Between acts (TRANSITION_0_1, TRANSITION_1_2, TRANSITION_2_3)
**Layout:** [CenteredLayout](src/components/assessment/layouts/centered-layout.tsx)
**Interactive Element:** None

Orb resizes, act label crossfades, narration plays via `TransitionLine[]` with `onStart`/`onComplete` callbacks. No candidate interaction.

---

### Format 9: Completion

**When:** Assessment finished (`isComplete = true` or `phase = COMPLETING`)
**Layout:** [CenteredLayout](src/components/assessment/layouts/centered-layout.tsx)
**Interactive Element:** None

Completion screen with thank-you message. No further interaction.

---

## Part 3: Format Resolution Logic

Source: [format-resolver.ts](src/lib/assessment/format-resolver.ts)

The format resolver maps assessment state → layout + component:

| Priority | Condition | Format |
|----------|-----------|--------|
| 1 | `isComplete` or phase `COMPLETING` | 9 (Completion) |
| 2 | Phase starts with `TRANSITION_` | 8 (Transition) |
| 3 | Act 2 + `activeElement.elementType === TIMED_CHALLENGE` | 5 (Timed) |
| 4 | Act 2 + `elementType === MULTIPLE_CHOICE_INLINE \| TRADEOFF_SELECTION` | 4 (MC) |
| 5 | Act 2 + `elementType === NUMERIC_INPUT` | 6 (Numeric) |
| 6 | Act 3 + `elementType === CONFIDENCE_RATING` | 7 (Confidence) |
| 7 | Act 1 + `referenceRevealCount === 0` | 2 (Card Build) |
| 8 | Act 1 + beats 1–5 | 3 (Card Update) |
| 9 | Fallback | 1 (Conversational) |

---

## Part 4: Interaction Element Type Map

### From Prisma Schema to Component

| `InteractionElementType` | Component | Layout | Act |
|--------------------------|-----------|--------|-----|
| `TEXT_RESPONSE` | (not rendered — voice/text input) | CenteredLayout | Any |
| `MULTIPLE_CHOICE_INLINE` | StageChoiceCards | InteractiveSplitLayout | 2 |
| `NUMERIC_INPUT` | StageNumericInput | InteractiveSplitLayout | 2 |
| `TIMED_CHALLENGE` | StageTimedChallenge | InteractiveSplitLayout | 2 |
| `CONFIDENCE_RATING` | StageConfidenceRating | ConfidenceLayout | 3 |
| `TRADEOFF_SELECTION` | StageChoiceCards | InteractiveSplitLayout | 2 |

### Item Bank Distribution (86 items)

| Construct | Count | Element Types Used |
|-----------|-------|--------------------|
| QUANTITATIVE_REASONING | 20 | NUMERIC_INPUT |
| SPATIAL_VISUALIZATION | 18 | NUMERIC_INPUT, MULTIPLE_CHOICE_INLINE |
| MECHANICAL_REASONING | 15 | NUMERIC_INPUT, MULTIPLE_CHOICE_INLINE |
| PATTERN_RECOGNITION | 18 | NUMERIC_INPUT, MULTIPLE_CHOICE_INLINE |
| FLUID_REASONING | 15 | NUMERIC_INPUT, MULTIPLE_CHOICE_INLINE |

---

## Part 5: Shared Interaction Patterns

### Keyboard Navigation Model

All choice-based components (StageChoiceCards, StageConfidenceRating) implement:

| Key | Action |
|-----|--------|
| `A`/`B`/`C`/`D` | Direct selection by letter (choice cards only) |
| `ArrowUp` / `ArrowLeft` | Previous option (wraps to last) |
| `ArrowDown` / `ArrowRight` | Next option (wraps to first) |
| `Enter` / `Space` | Confirm focused option |
| `Tab` | Roving tabindex — only focused item tabbable |

Numeric input uses standard text input behavior + `Enter` to submit.

### State Machine (per interactive element)

```
[Idle] → user interacts → [Focused]
  → selects option → [Selected] → sends response → [Responded/Disabled]
  → error occurs → [Error] → retry → [Idle]
  → timeout (timed only) → [Timed Out/Disabled]
```

### Visual Feedback Timing

| Feedback | Duration | Easing |
|----------|----------|--------|
| Card entry | 400ms | `cubic-bezier(0.16, 1, 0.3, 1)` |
| Hover translate | 300ms | ease |
| Selection color/border | 300ms | ease |
| Error message appear | 300ms | ease |
| Timer color change | 500ms | ease |
| Layout show/hide | 700ms | `cubic-bezier(0.25, 0.1, 0.25, 1)` |
| Orb position | 1000ms | `cubic-bezier(0.25, 0.1, 0.25, 1)` |
| Focus outline | instant | — |

### Error Recovery Pattern

[InteractiveRenderer](src/components/assessment/interactive/interactive-renderer.tsx) shows a retry banner on network error:

```
┌─ amber background ──────────────────────┐
│  ⟲  Connection error. Tap to retry.     │
└──────────────────────────────────────────┘
```

- Background: `color-mix(in srgb, --s-amber 10%, transparent)`
- Border: `color-mix(in srgb, --s-amber 25%, transparent)`
- Clicking dismisses error and re-enables the element

---

## Part 6: UX/UI Audit Findings

### Critical Issues

| ID | Issue | Location | Impact |
|----|-------|----------|--------|
| C1 | `useRadiogroupKeys` hook exists but is never imported — keyboard logic is duplicated inline in both StageChoiceCards and StageConfidenceRating | [use-radiogroup-keys.ts](src/components/assessment/interactive/use-radiogroup-keys.ts) | Maintenance risk — identical logic in 2 places will drift |
| C2 | Letter-key listeners (`A`/`B`/`C`/`D`) attached to `window` — will intercept keystrokes if text input is somehow focused while choice cards are visible | [stage-choice-cards.tsx:58](src/components/assessment/interactive/stage-choice-cards.tsx#L58) | Could cause unintended selection during edge-case input overlap |
| C3 | Timer `aria-live="polite"` updates at 4Hz (every 250ms) — screen readers will be overwhelmed with announcements | [stage-timed-challenge.tsx:116](src/components/assessment/interactive/stage-timed-challenge.tsx#L116) | Accessibility: unusable for screen reader users during timed challenges |
| C4 | Error retry banner appears but once a selection is made, `responded` is set — the component prevents re-selection even after error dismissal | [interactive-renderer.tsx:33](src/components/assessment/interactive/interactive-renderer.tsx#L33) | Broken error recovery: user sees retry prompt but can't actually retry |

### High Priority

| ID | Issue | Location | Impact |
|----|-------|----------|--------|
| H1 | InteractiveSplitLayout has no mobile/responsive handling — 60/40 split renders at fixed percentages on all screen sizes | [interactive-split-layout.tsx:22](src/components/assessment/layouts/interactive-split-layout.tsx#L22) | All Act 2 questions unusable on mobile |
| H2 | StageChoiceCards uses inline styles exclusively — no CSS custom properties for spacing/sizing, making batch visual adjustments impossible | [stage-choice-cards.tsx](src/components/assessment/interactive/stage-choice-cards.tsx) | Design consistency requires editing each style object individually |
| H3 | No `aria-label` on text input in assessment stage | [assessment-stage.tsx](src/components/assessment/stage/assessment-stage.tsx) | Accessibility gap for primary input method |
| H4 | Confidence rating accent bar is green (`--s-green`) while all other formats use blue (`--s-blue`) — intentional but undocumented | [stage-confidence-rating.tsx:43](src/components/assessment/interactive/stage-confidence-rating.tsx#L43) | Could be perceived as inconsistency without documented rationale |

### Medium Priority

| ID | Issue | Location | Impact |
|----|-------|----------|--------|
| M1 | StageNumericInput error message lacks `aria-describedby` linking to the input field | [stage-numeric-input.tsx](src/components/assessment/interactive/stage-numeric-input.tsx) | Screen readers won't associate error with field |
| M2 | ASCII diagram section has no `aria-label` or role — decorative vs informational ambiguity | [interactive-renderer.tsx](src/components/assessment/interactive/interactive-renderer.tsx) | Screen readers may skip informational diagrams |
| M3 | Mobile bottom sheet drag handle has no accessibility labeling | [reference-split-layout.tsx](src/components/assessment/layouts/reference-split-layout.tsx) | Touch-only affordance with no keyboard/SR equivalent |
| M4 | Timer doesn't announce milestones (e.g., "30 seconds remaining") — only streams continuous time updates | [stage-timed-challenge.tsx](src/components/assessment/interactive/stage-timed-challenge.tsx) | Missed opportunity for meaningful SR announcements |

### Positive Findings

| Area | Assessment |
|------|-----------|
| Glass morphism consistency | All 4 interactive components use identical glass formula |
| Design token adoption | Colors, text styles use CSS custom properties throughout |
| Keyboard model | Arrow keys + Enter/Space + letter shortcuts are thorough |
| Entry animations | Consistent `cardIn` with appropriate cubic-bezier easing |
| Timer implementation | Wall-clock based (not interval drift), visibility API pause |
| Reduced motion | `@media (prefers-reduced-motion)` collapses all animations to 0.01ms |
| Roving tabindex | Properly implemented focus management across all choice components |
| Progressive disclosure | Reference card reveal + highlight animation is well-executed |

---

## Part 7: Component File Reference

### Interactive Elements

| Component | File | Lines |
|-----------|------|-------|
| InteractiveRenderer | [interactive-renderer.tsx](src/components/assessment/interactive/interactive-renderer.tsx) | ~80 |
| StageChoiceCards | [stage-choice-cards.tsx](src/components/assessment/interactive/stage-choice-cards.tsx) | ~200 |
| StageNumericInput | [stage-numeric-input.tsx](src/components/assessment/interactive/stage-numeric-input.tsx) | ~170 |
| StageTimedChallenge | [stage-timed-challenge.tsx](src/components/assessment/interactive/stage-timed-challenge.tsx) | ~180 |
| StageConfidenceRating | [stage-confidence-rating.tsx](src/components/assessment/interactive/stage-confidence-rating.tsx) | ~200 |
| useRadiogroupKeys | [use-radiogroup-keys.ts](src/components/assessment/interactive/use-radiogroup-keys.ts) | ~50 |

### Layouts

| Layout | File | Used By Formats |
|--------|------|-----------------|
| CenteredLayout | [centered-layout.tsx](src/components/assessment/layouts/centered-layout.tsx) | 1, 8, 9 |
| InteractiveSplitLayout | [interactive-split-layout.tsx](src/components/assessment/layouts/interactive-split-layout.tsx) | 4, 5, 6 |
| ConfidenceLayout | [confidence-layout.tsx](src/components/assessment/layouts/confidence-layout.tsx) | 7 |
| ReferenceSplitLayout | [reference-split-layout.tsx](src/components/assessment/layouts/reference-split-layout.tsx) | 2, 3 |

### Orchestration

| File | Purpose |
|------|---------|
| [assessment-stage.tsx](src/components/assessment/stage/assessment-stage.tsx) | Master stage orchestrator |
| [format-resolver.ts](src/lib/assessment/format-resolver.ts) | State → format mapping |
| [globals.css](src/app/globals.css) | Design tokens, keyframes, shared classes |

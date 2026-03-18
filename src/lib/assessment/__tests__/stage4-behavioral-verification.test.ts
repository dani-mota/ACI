/**
 * Stage 4 Behavioral Verification — Voice Pipeline
 *
 * Verifies TurnPlayer voice mode, fallback chain, AudioContext recovery,
 * sequence cancellation, nudge-without-VAD, and deferred items impact.
 *
 * NOTE: Cannot import TurnPlayer or TTSEngine directly (React component + browser APIs).
 * Tests verify behavior through code inspection, architectural analysis, and constant checks.
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const PROJECT_ROOT = path.resolve(__dirname, "../../../..");

function readFile(relativePath: string): string {
  return fs.readFileSync(path.join(PROJECT_ROOT, relativePath), "utf-8");
}

// ════════════════════════════════════════════════
// GROUP 1: TurnPlayer Voice Mode — Architectural Verification
// ════════════════════════════════════════════════

describe("Group 1: TurnPlayer Voice Mode", () => {
  const turnPlayerSource = readFile("src/components/assessment/stage/turn-player.tsx");

  it("1.1: Voice delivery activated when ttsEngine provided and textOnly=false", () => {
    // Line 101-106: routing logic
    expect(turnPlayerSource).toContain("if (textOnly || !ttsEngine || !token)");
    expect(turnPlayerSource).toContain("playTextDelivery(sentences)");
    expect(turnPlayerSource).toContain("playVoiceDelivery(sentences)");
  });

  it("1.2: Sentence-by-sentence playback in order", () => {
    // Line 208: for loop iterating sentences
    expect(turnPlayerSource).toContain("for (let i = 0; i < sentences.length; i++)");
    // Line 236: ttsEngine.speak called with sentence text
    expect(turnPlayerSource).toContain("await ttsEngine.speak(sentence, token");
    // preSplit=true to avoid double-splitting
    expect(turnPlayerSource).toContain("}, true); // preSplit=true");
  });

  it("1.3: Word reveal synced to audio duration via onPlaybackStart", () => {
    // Line 240: msPerWord calculation from totalDurationSec
    expect(turnPlayerSource).toContain("const msPerWord = Math.max(60, (totalDurationSec * 1000) / words.length)");
    // Line 243: interval drives word reveal
    expect(turnPlayerSource).toContain("wordTimerRef.current = setInterval");
    expect(turnPlayerSource).toContain("setSubtitleRevealedWords(revealedRef.current)");
  });

  it("1.4: N+1 prefetch during current sentence playback", () => {
    // Line 228-230: prefetch happens before speak() await
    expect(turnPlayerSource).toContain("ttsEngine.prefetch(sentences[i + 1], token)");
    // .catch(() => {}) means it's fire-and-forget (non-blocking)
    expect(turnPlayerSource).toContain('.prefetch(sentences[i + 1], token).catch(() => {})');
  });

  it("1.5: MIN_SENTENCE_MS_VOICE constant defined", () => {
    expect(turnPlayerSource).toContain("const MIN_SENTENCE_MS_VOICE = 2500");
  });

  it("1.5-FIXED: MIN_SENTENCE_MS_VOICE waits full remaining, then adds inter-sentence pause", () => {
    // After fix: remaining time is awaited in full, THEN INTER_SENTENCE_PAUSE_MS is added separately
    // A 500ms sentence waits 2000ms (to reach 2500ms) + 150ms pause = 2650ms total
    expect(turnPlayerSource).not.toContain("Math.min(remaining, INTER_SENTENCE_PAUSE_MS)");
    expect(turnPlayerSource).toContain("if (remaining > 0)");
    expect(turnPlayerSource).toContain("await new Promise((r) => setTimeout(r, remaining))");
    expect(turnPlayerSource).toContain("await new Promise((r) => setTimeout(r, INTER_SENTENCE_PAUSE_MS))");
  });

  it("1.6: Inter-sentence pause exists", () => {
    expect(turnPlayerSource).toContain("const INTER_SENTENCE_PAUSE_MS = 150");
    // Line 268-270: pause between sentences
    expect(turnPlayerSource).toContain('await new Promise((r) => setTimeout(r, INTER_SENTENCE_PAUSE_MS))');
  });

  it("1.7: Progressive reference card reveal per sentence", () => {
    // Line 222-225: reference card reveal in voice mode
    expect(turnPlayerSource).toContain("store.getState().setReferenceRevealCount(i + 1)");
  });

  it("1.8: Delivery complete triggers correct sequence", () => {
    // Lines 276-282: completion sequence
    expect(turnPlayerSource).toContain("setSubtitleRevealedWords(9999)");
    expect(turnPlayerSource).toContain("setReferenceRevealCount(-1)");
    expect(turnPlayerSource).toContain('setOrbMode("idle")');
    expect(turnPlayerSource).toContain("setAudioAmplitude(0)");
    expect(turnPlayerSource).toContain("setTTSPlaying(false)");
    expect(turnPlayerSource).toContain("onDeliveryComplete()");
  });
});

// ════════════════════════════════════════════════
// GROUP 2: Fallback Chain
// ════════════════════════════════════════════════

describe("Group 2: Fallback Chain", () => {
  const turnPlayerSource = readFile("src/components/assessment/stage/turn-player.tsx");

  it("2.1: Per-sentence failure catches error and reveals words as text", () => {
    // Catch block reveals all words (text fallback)
    expect(turnPlayerSource).toContain("catch (err)");
    expect(turnPlayerSource).toContain("Sentence ${i} FAILED");
    expect(turnPlayerSource).toContain("store.getState().setSubtitleRevealedWords(words.length)");
  });

  it("2.2: Next sentence still tries audio after previous fails", () => {
    // The for loop continues to the next iteration after catch — speak() is called again
    // No flag like "disableAudioForRemainder" is set
    expect(turnPlayerSource).not.toContain("disableAudio");
    expect(turnPlayerSource).not.toContain("skipAudio");
    // The loop structure: for → try/catch → next iteration → try again
  });

  it("2.3: No ttsEngine → pure text mode", () => {
    // Line 102: textOnly=true OR !ttsEngine OR !token → playTextDelivery
    expect(turnPlayerSource).toContain("if (textOnly || !ttsEngine || !token)");
  });

  it("2.4: playVoiceDelivery falls back to playTextDelivery when engine null", () => {
    // Line 196-199: explicit null check at start of playVoiceDelivery
    expect(turnPlayerSource).toContain("if (!ttsEngine || !token)");
    expect(turnPlayerSource).toContain("playTextDelivery(sentences)");
    expect(turnPlayerSource).toContain("return;");
  });
});

// ════════════════════════════════════════════════
// GROUP 3: AudioContext Recovery (P-8)
// ════════════════════════════════════════════════

describe("Group 3: AudioContext Recovery (P-8)", () => {
  const ttsSource = readFile("src/components/assessment/voice/tts-engine.ts");

  it("3.1: Recovery attempted on every speak() call when fallbackActive", () => {
    // Lines 105-114: recovery block
    expect(ttsSource).toContain("// P-8: Try to recover from fallback on each speak() call");
    expect(ttsSource).toContain("if (this.fallbackActive && this.audioContext)");
    expect(ttsSource).toContain("await this.audioContext.resume()");
    expect(ttsSource).toContain('if (this.audioContext.state === "running")');
    expect(ttsSource).toContain("this.fallbackActive = false");
  });

  it("3.2: FINDING — Recovery NOT in user gesture context (Safari issue)", () => {
    // The recovery happens inside speak(), which is called from TurnPlayer's
    // playVoiceDelivery(), which runs in a useEffect/useCallback chain — NOT
    // inside a click/tap handler. On Safari, audioContext.resume() outside a
    // user gesture handler will silently fail.
    //
    // The existing resumeContext() in assessment-stage.tsx IS called from a
    // gesture handler (audio auto-unlock on mount + handleBeginAct1).
    // But P-8 recovery after tab backgrounding relies on speak()'s resume(),
    // which is NOT in a gesture handler.
    //
    // MISSING: "Tap to resume audio" overlay for Safari recovery.
    // Impact: Safari users who background the tab stay on SpeechSynthesis.
    // Chrome handles this correctly (resume() works outside gesture handlers).

    const stageSource = readFile("src/components/assessment/stage/assessment-stage.tsx");
    // Confirm resumeContext is called on mount (gesture context)
    expect(stageSource).toContain("ttsRef.current?.resumeContext()");
    // But no "tap to resume" overlay exists
    expect(stageSource).not.toContain("tap to resume");
    expect(stageSource).not.toContain("resumeAudio");
  });

  it("3.3: FallbackActive flag reset when context recovers", () => {
    const ttsSource = readFile("src/components/assessment/voice/tts-engine.ts");
    // After successful resume: fallbackActive = false
    expect(ttsSource).toContain("this.fallbackActive = false");
    expect(ttsSource).toContain('[TTS] AudioContext recovered from fallback');
  });
});

// ════════════════════════════════════════════════
// GROUP 4: Sequence Cancellation
// ════════════════════════════════════════════════

describe("Group 4: Sequence Cancellation", () => {
  const turnPlayerSource = readFile("src/components/assessment/stage/turn-player.tsx");

  it("4.1: sequenceId incremented on new Turn", () => {
    expect(turnPlayerSource).toContain("sequenceIdRef.current++");
  });

  it("4.2: Every loop iteration checks sequenceId for cancellation", () => {
    // Line 210: check at start of each sentence
    expect(turnPlayerSource).toContain("if (cancelledRef.current || sequenceIdRef.current !== mySequenceId) return");
  });

  it("4.3: ttsEngine.stop() called at start of new delivery", () => {
    // Line 205: stop existing playback
    expect(turnPlayerSource).toContain("ttsEngine.stop()");
  });

  it("4.4: Completion check prevents stale delivery from firing callbacks", () => {
    // Line 274: final check before setting completion state
    expect(turnPlayerSource).toContain("if (cancelledRef.current || sequenceIdRef.current !== mySequenceId) return");
    // This is AFTER the for loop, before onDeliveryComplete
  });

  it("4.5: cancelledRef set on unmount", () => {
    // Line 124: cleanup
    expect(turnPlayerSource).toContain("cancelledRef.current = true");
  });
});

// ════════════════════════════════════════════════
// GROUP 5: Nudge System Without VAD
// ════════════════════════════════════════════════

describe("Group 5: Nudge System Without VAD", () => {
  const stageSource = readFile("src/components/assessment/stage/assessment-stage.tsx");

  it("5.1: Nudge started after delivery complete", () => {
    // onDeliveryComplete callback starts nudge
    expect(stageSource).toContain("startNudgeForCurrentAct()");
    // This is in the TurnPlayer's onDeliveryComplete prop
  });

  it("5.2: handleVoiceTranscript stops nudge", () => {
    // Line 913: nudge stopped when transcript arrives
    expect(stageSource).toContain("nudgeRef.current.stop()");
  });

  it("5.3: FINDING — handleListeningChange does NOT stop nudge", () => {
    // handleListeningChange (mic toggle) stops TTS but NOT the nudge timer
    const listeningHandler = stageSource.match(/handleListeningChange[\s\S]*?}, \[\]/)?.[0] || "";
    expect(listeningHandler).toContain("ttsRef.current?.stop()");
    expect(listeningHandler).not.toContain("nudgeRef");
    // CONSEQUENCE: If candidate taps mic at second 14 and starts speaking,
    // the nudge at second 15 will still fire. Aria says "Take your time"
    // WHILE the candidate is actively speaking into the mic.
    // This only resolves when the final transcript fires handleVoiceTranscript.
    // Impact: Medium — cosmetically annoying but not assessment-breaking.
  });

  it("5.4: Nudge guards against interrupting TTS", () => {
    // Nudge callback checks isTTSPlaying before firing
    expect(stageSource).toContain("if (s.isLoading || s.isTTSPlaying) {");
  });

  it("5.5: Auto-advance sends [NO_RESPONSE] sentinel", () => {
    expect(stageSource).toContain('sendMessage("[NO_RESPONSE]")');
  });
});

// ════════════════════════════════════════════════
// GROUP 6: TTS Config Endpoint
// ════════════════════════════════════════════════

describe("Group 6: TTS Config Endpoint", () => {
  it("6.1: Route file exists with correct exports", () => {
    const routePath = path.join(PROJECT_ROOT, "src/app/api/assess/[token]/tts-config/route.ts");
    expect(fs.existsSync(routePath)).toBe(true);

    const source = readFile("src/app/api/assess/[token]/tts-config/route.ts");
    expect(source).toContain("export async function GET");
    expect(source).toContain("checkRateLimit");
    expect(source).toContain("linkToken");
  });

  it("6.2: No full API key in response", () => {
    const source = readFile("src/app/api/assess/[token]/tts-config/route.ts");
    // Should return voiceId and settings but NOT apiKey
    expect(source).toContain("voiceId");
    expect(source).toContain("voiceSettings");
    expect(source).not.toContain("apiKey:");
    expect(source).not.toContain('"apiKey"');
  });

  it("6.3: Rate limited at 1 per 60 minutes", () => {
    const source = readFile("src/app/api/assess/[token]/tts-config/route.ts");
    expect(source).toContain("maxRequests: 1");
    expect(source).toContain("windowMs: 60 * 60 * 1000");
  });
});

// ════════════════════════════════════════════════
// GROUP 7: Deferred Items Impact
// ════════════════════════════════════════════════

describe("Group 7: Deferred Items Impact Assessment", () => {
  it("7.1: N+1 prefetch overlaps with current playback (WebSocket not needed)", () => {
    const turnPlayerSource = readFile("src/components/assessment/stage/turn-player.tsx");
    // Prefetch is fire-and-forget BEFORE await speak()
    // This means: prefetch starts → speak() awaits → by the time speak resolves,
    // prefetch is likely cached → next speak() hits cache → fast
    expect(turnPlayerSource).toContain("ttsEngine.prefetch(sentences[i + 1], token).catch(() => {})");

    // Confirm TTSEngine has a cache
    const ttsSource = readFile("src/components/assessment/voice/tts-engine.ts");
    expect(ttsSource).toContain("audioCache");
    expect(ttsSource).toContain("this.audioCache.get(text)");
  });

  it("7.2: MicButton still works — sends through unified Turn path", () => {
    const stageSource = readFile("src/components/assessment/stage/assessment-stage.tsx");
    // handleVoiceTranscript calls sendMessage which handles Turn responses
    expect(stageSource).toContain("s.sendMessage(text)");
    // MicButton imported and rendered
    expect(stageSource).toContain("MicButton");
    expect(stageSource).toContain("onVoiceTranscript");
  });

  it("7.3: Word reveal at ~400ms/word is acceptable for pilot", () => {
    // For 20 words, 8 seconds audio: msPerWord = 8000/20 = 400ms
    // 400ms per word = 150 WPM reading pace — matches natural speech
    // This is acceptable. Real issue: all words reveal at same rate regardless
    // of syllable length. Short words (a, it, the) feel slow, long words fast.
    // This is a cosmetic issue, not a blocker.
    const turnPlayerSource = readFile("src/components/assessment/stage/turn-player.tsx");
    expect(turnPlayerSource).toContain("Math.max(60, (totalDurationSec * 1000) / words.length)");
    // Minimum 60ms per word prevents absurdly fast reveal
  });

  it("7.4: Phase 0 unchanged — excluded from TurnPlayer", () => {
    const stageSource = readFile("src/components/assessment/stage/assessment-stage.tsx");
    expect(stageSource).toContain('orchestratorPhase !== "PHASE_0"');
    // Phase 0 still uses legacy playSegmentTTS → TTS engine directly
  });
});

// ════════════════════════════════════════════════
// GROUP 8: Regression
// ════════════════════════════════════════════════

describe("Group 8: Regression", () => {
  it("8.1: Stage 1 types exist as files", () => {
    expect(fs.existsSync(path.join(PROJECT_ROOT, "src/lib/types/index.ts"))).toBe(true);
    expect(fs.existsSync(path.join(PROJECT_ROOT, "src/lib/types/turn.ts"))).toBe(true);
    expect(fs.existsSync(path.join(PROJECT_ROOT, "src/lib/types/formats.ts"))).toBe(true);
    expect(fs.existsSync(path.join(PROJECT_ROOT, "src/lib/types/constructs.ts"))).toBe(true);
  });

  it("8.2: Stage 1 validation files exist", () => {
    expect(fs.existsSync(path.join(PROJECT_ROOT, "src/lib/assessment/validation/turn-schema.ts"))).toBe(true);
    expect(fs.existsSync(path.join(PROJECT_ROOT, "src/lib/assessment/validation/metadata-schema.ts"))).toBe(true);
    expect(fs.existsSync(path.join(PROJECT_ROOT, "src/lib/assessment/validation/input-schema.ts"))).toBe(true);
  });

  it("8.3: Stage 1 sanitization files exist", () => {
    expect(fs.existsSync(path.join(PROJECT_ROOT, "src/lib/assessment/sanitize.ts"))).toBe(true);
    expect(fs.existsSync(path.join(PROJECT_ROOT, "src/lib/assessment/filters/leakage.ts"))).toBe(true);
  });

  it("8.4: All 126 prior tests covered by separate suites", () => {
    // The 126 tests in Stages 1-2 are in their own test files and run separately.
    // This test just confirms the files exist.
    const testFiles = [
      "src/lib/types/__tests__/turn-schema.test.ts",
      "src/lib/assessment/__tests__/sanitize.test.ts",
      "src/lib/assessment/__tests__/leakage-filter.test.ts",
      "src/lib/assessment/__tests__/input-validation.test.ts",
      "src/lib/assessment/__tests__/stage1-behavioral-verification.test.ts",
      "src/lib/assessment/__tests__/stage2-behavioral-verification.test.ts",
    ];
    for (const f of testFiles) {
      expect(fs.existsSync(path.join(PROJECT_ROOT, f))).toBe(true);
    }
  });
});

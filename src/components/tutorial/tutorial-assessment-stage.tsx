"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { LivingBackground } from "@/components/assessment/background/living-background";
import { AssessmentOrb } from "@/components/assessment/orb/assessment-orb";
import { SubtitleDisplay } from "@/components/assessment/stage/subtitle-display";
import { ScenarioReferenceCard } from "@/components/assessment/stage/scenario-reference-card";
import { StageChoiceCards } from "@/components/assessment/interactive/stage-choice-cards";
import { StageTimedChallenge } from "@/components/assessment/interactive/stage-timed-challenge";
import { StageNumericInput } from "@/components/assessment/interactive/stage-numeric-input";
import { TutorialTTSEngine } from "@/lib/tutorial/tutorial-tts-engine";
import {
  TutorialRunner,
  type AssessmentStep,
  type ChoiceStep,
  type TimedChoiceStep,
  type NumericStep,
  type TextInputStep,
  type NarrationStep,
} from "@/lib/tutorial/mini-assessment-scripts";
import type { ScenarioReference } from "@/lib/assessment/parse-scenario-response";

// ─── Local state ──────────────────────────────────────────────────────────────

type OrbMode = "idle" | "speaking" | "listening" | "processing";

interface StageState {
  orbMode: OrbMode;
  orbAmplitude: number;
  subtitleText: string;
  subtitleRevealedWords: number;
  referenceCard: ScenarioReference | null;
  referenceRevealCount: number;
  act: string;
  activeStep: AssessmentStep | null;
  // When waiting for user interaction
  waitingFor: "none" | "text-input" | "choice" | "timed-choice" | "numeric";
  choiceOptions: string[];
  choicePrompt: string;
  numericPrompt: string;
  timedTimeLimit: number;
  // Ack state
  showingAck: boolean;
  // Completion
  isComplete: boolean;
  textInputValue: string;
}

const INITIAL_STATE: StageState = {
  orbMode: "idle",
  orbAmplitude: 0,
  subtitleText: "",
  subtitleRevealedWords: 0,
  referenceCard: null,
  referenceRevealCount: -1,
  act: "PHASE_0",
  activeStep: null,
  waitingFor: "none",
  choiceOptions: [],
  choicePrompt: "",
  numericPrompt: "",
  timedTimeLimit: 45,
  showingAck: false,
  isComplete: false,
  textInputValue: "",
};

// ─── Component ────────────────────────────────────────────────────────────────

interface TutorialAssessmentStageProps {
  segment: string | null;
}

export function TutorialAssessmentStage({ segment }: TutorialAssessmentStageProps) {
  const router = useRouter();
  const [state, setState] = useState<StageState>(INITIAL_STATE);
  const stateRef = useRef<StageState>(INITIAL_STATE);
  const runnerRef = useRef<TutorialRunner | null>(null);
  const ttsRef = useRef<TutorialTTSEngine | null>(null);
  const amplitudeAnimRef = useRef<number | null>(null);
  const mounted = useRef(true);

  const updateState = useCallback((updates: Partial<StageState>) => {
    if (!mounted.current) return;
    setState((prev) => {
      const next = { ...prev, ...updates };
      stateRef.current = next;
      return next;
    });
  }, []);

  // Animate orb amplitude while speaking
  const startAmplitudeAnimation = useCallback(() => {
    const animate = () => {
      if (!mounted.current) return;
      const amp = 0.25 + 0.2 * Math.sin(Date.now() / 250) + 0.15 * Math.sin(Date.now() / 180);
      updateState({ orbAmplitude: amp });
      amplitudeAnimRef.current = requestAnimationFrame(animate);
    };
    if (amplitudeAnimRef.current) cancelAnimationFrame(amplitudeAnimRef.current);
    amplitudeAnimRef.current = requestAnimationFrame(animate);
  }, [updateState]);

  const stopAmplitudeAnimation = useCallback(() => {
    if (amplitudeAnimRef.current) {
      cancelAnimationFrame(amplitudeAnimRef.current);
      amplitudeAnimRef.current = null;
    }
    updateState({ orbAmplitude: 0 });
  }, [updateState]);

  // Speak text and return a promise that resolves when done
  const speak = useCallback(async (stepId: string, text: string): Promise<void> => {
    if (!ttsRef.current) return;
    const tts = ttsRef.current;

    updateState({ orbMode: "speaking", subtitleText: text, subtitleRevealedWords: 0 });

    await tts.speakStep(stepId, text, (durationSec) => {
      // Reveal words over duration
      const words = text.split(/\s+/).length;
      const revealIntervalMs = (durationSec * 1000) / Math.max(1, words);
      let revealed = 0;
      const revealTimer = setInterval(() => {
        revealed++;
        if (!mounted.current) { clearInterval(revealTimer); return; }
        updateState({ subtitleRevealedWords: revealed });
        if (revealed >= words) clearInterval(revealTimer);
      }, revealIntervalMs);
      startAmplitudeAnimation();
    });

    stopAmplitudeAnimation();
    if (mounted.current) {
      updateState({ orbMode: "idle", subtitleText: "", subtitleRevealedWords: 0 });
    }
  }, [updateState, startAmplitudeAnimation, stopAmplitudeAnimation]);

  // Handle each step
  const handleStep = useCallback(async (step: AssessmentStep) => {
    if (!mounted.current) return;

    updateState({
      activeStep: step,
      act: step.act,
      waitingFor: "none",
      showingAck: false,
    });

    switch (step.type) {
      case "narration": {
        const s = step as NarrationStep;
        if (s.referenceCard) {
          updateState({ referenceCard: s.referenceCard, referenceRevealCount: -1 });
        }
        await speak(step.id, s.text);
        // Auto-advance after narration completes
        if (mounted.current) runnerRef.current?.advance("__auto__");
        break;
      }

      case "text-input": {
        const s = step as TextInputStep;
        await speak(step.id, s.text);
        if (mounted.current) {
          updateState({
            waitingFor: "text-input",
            orbMode: "listening",
            orbAmplitude: 0,
          });
        }
        break;
      }

      case "choice": {
        const s = step as ChoiceStep;
        await speak(step.id, s.text);
        if (mounted.current) {
          updateState({
            waitingFor: "choice",
            choiceOptions: s.options,
            choicePrompt: s.prompt,
            orbMode: "idle",
          });
        }
        break;
      }

      case "timed-choice": {
        const s = step as TimedChoiceStep;
        await speak(step.id, s.text);
        if (mounted.current) {
          updateState({
            waitingFor: "timed-choice",
            choiceOptions: s.options,
            choicePrompt: s.prompt,
            timedTimeLimit: s.timeLimit,
            orbMode: "idle",
          });
        }
        break;
      }

      case "numeric": {
        const s = step as NumericStep;
        await speak(step.id, s.text);
        if (mounted.current) {
          updateState({
            waitingFor: "numeric",
            numericPrompt: s.prompt,
            orbMode: "idle",
          });
        }
        break;
      }

      case "complete": {
        await speak(step.id, step.text);
        if (mounted.current) {
          updateState({ isComplete: true, orbMode: "idle", waitingFor: "none" });
        }
        break;
      }
    }
  }, [speak, updateState]);

  // Initialize on mount
  useEffect(() => {
    mounted.current = true;

    const tts = new TutorialTTSEngine(segment ?? "defense-manufacturing");
    ttsRef.current = tts;

    const runner = new TutorialRunner(
      segment,
      (step) => { handleStep(step); },
      () => { updateState({ isComplete: true }); }
    );
    runnerRef.current = runner;

    runner.start();

    return () => {
      mounted.current = false;
      tts.stop();
      if (amplitudeAnimRef.current) cancelAnimationFrame(amplitudeAnimRef.current);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // User response handlers
  const handleTextInputSubmit = useCallback(() => {
    const val = stateRef.current.textInputValue.trim();
    if (!val) return;
    updateState({ waitingFor: "none", textInputValue: "", orbMode: "processing" });
    // Brief processing pause then advance
    setTimeout(() => {
      if (!mounted.current) return;
      updateState({ orbMode: "idle" });
      runnerRef.current?.advance(val);
    }, 600);
  }, [updateState]);

  const handleChoiceSelect = useCallback(async (value: string) => {
    const step = stateRef.current.activeStep as ChoiceStep | null;
    if (!step) return;
    updateState({ waitingFor: "none", showingAck: true });

    // Pick ack text based on first letter of selected option
    const firstLetter = value.trim()[0]?.toUpperCase() ?? "";
    const ackText = step.ackByOption?.[firstLetter] ?? "Noted.";

    await speak(`${step.id}-ack`, ackText);
    if (mounted.current) runnerRef.current?.advance(value);
  }, [speak, updateState]);

  const handleTimedChoiceSelect = useCallback(async (value: string) => {
    const step = stateRef.current.activeStep as TimedChoiceStep | null;
    if (!step) return;
    updateState({ waitingFor: "none", showingAck: true });
    await speak(`${step.id}-ack`, step.ackText);
    if (mounted.current) runnerRef.current?.advance(value);
  }, [speak, updateState]);

  const handleTimedTimeout = useCallback(async () => {
    const step = stateRef.current.activeStep as TimedChoiceStep | null;
    if (!step) return;
    updateState({ waitingFor: "none", showingAck: true });
    await speak(`${step.id}-timeout`, "Time's up. Let's keep moving.");
    if (mounted.current) runnerRef.current?.advance("TIMEOUT");
  }, [speak, updateState]);

  const handleNumericSubmit = useCallback(async (value: string) => {
    const step = stateRef.current.activeStep as NumericStep | null;
    if (!step) return;
    updateState({ waitingFor: "none", showingAck: true });
    await speak(`${step.id}-ack`, step.ackText);
    if (mounted.current) runnerRef.current?.advance(value);
  }, [speak, updateState]);

  const runner = runnerRef.current;
  const progress = runner ? runner.getProgress() : 0;
  const actLabel = { PHASE_0: "Introduction", ACT_1: "Act I — Scenario", ACT_2: "Act II — Quantitative", ACT_3: "Act III — Reflection" }[state.act] ?? "";

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        overflow: "hidden",
        background: "rgb(3, 5, 12)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {/* Living background */}
      <LivingBackground />

      {/* Progress bar */}
      {!state.isComplete && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: "2px",
            background: "rgba(255,255,255,0.06)",
            zIndex: 10,
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${progress * 100}%`,
              background: "rgba(201, 168, 76, 0.7)",
              transition: "width 600ms ease",
            }}
          />
        </div>
      )}

      {/* Act label */}
      {!state.isComplete && actLabel && (
        <div
          style={{
            position: "absolute",
            top: "16px",
            left: "50%",
            transform: "translateX(-50%)",
            fontFamily: "var(--font-mono)",
            fontSize: "9px",
            fontWeight: 500,
            color: "rgba(184, 196, 214, 0.3)",
            letterSpacing: "2px",
            textTransform: "uppercase",
            zIndex: 10,
          }}
        >
          {actLabel}
        </div>
      )}

      {/* Main layout */}
      <div
        style={{
          position: "relative",
          zIndex: 5,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          width: "100%",
          maxWidth: "700px",
          padding: "0 24px",
          gap: "32px",
        }}
      >
        {/* Reference card — shows during ACT_1 */}
        {state.referenceCard && !state.isComplete && (
          <div style={{ width: "100%" }}>
            <ScenarioReferenceCard
              reference={state.referenceCard}
              revealCount={state.referenceRevealCount}
            />
          </div>
        )}

        {/* Orb */}
        {!state.isComplete && (
          <AssessmentOrb
            mode={state.orbMode}
            amplitude={state.orbAmplitude}
            targetSize={140}
          />
        )}

        {/* Subtitle */}
        {!state.isComplete && (
          <SubtitleDisplay
            text={state.subtitleText}
            revealedWords={state.subtitleRevealedWords}
            isRevealing={state.orbMode === "speaking"}
          />
        )}

        {/* Interactive elements */}
        {!state.isComplete && state.waitingFor === "text-input" && (
          <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: "10px" }}>
            <textarea
              rows={3}
              value={state.textInputValue}
              onChange={(e) => updateState({ textInputValue: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleTextInputSubmit();
                }
              }}
              placeholder="Type your response…"
              style={{
                width: "100%",
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: "10px",
                padding: "12px 16px",
                color: "rgba(184,196,214,0.9)",
                fontFamily: "var(--font-display)",
                fontSize: "14px",
                lineHeight: 1.6,
                resize: "none",
                outline: "none",
              }}
              autoFocus
            />
            <button
              onClick={handleTextInputSubmit}
              disabled={!state.textInputValue.trim()}
              style={{
                alignSelf: "flex-end",
                padding: "8px 24px",
                background: state.textInputValue.trim() ? "rgba(201,168,76,0.15)" : "rgba(255,255,255,0.04)",
                border: `1px solid ${state.textInputValue.trim() ? "rgba(201,168,76,0.4)" : "rgba(255,255,255,0.06)"}`,
                borderRadius: "8px",
                color: state.textInputValue.trim() ? "rgba(201,168,76,0.9)" : "rgba(184,196,214,0.3)",
                fontFamily: "var(--font-mono)",
                fontSize: "11px",
                fontWeight: 500,
                letterSpacing: "1px",
                cursor: state.textInputValue.trim() ? "pointer" : "not-allowed",
                transition: "all 200ms ease",
              }}
            >
              CONTINUE →
            </button>
          </div>
        )}

        {!state.isComplete && state.waitingFor === "choice" && !state.showingAck && (
          <StageChoiceCards
            prompt={state.choicePrompt}
            options={state.choiceOptions}
            onSelect={handleChoiceSelect}
          />
        )}

        {!state.isComplete && state.waitingFor === "timed-choice" && !state.showingAck && (
          <StageTimedChallenge
            prompt={state.choicePrompt}
            options={state.choiceOptions}
            timeLimit={state.timedTimeLimit}
            onSelect={handleTimedChoiceSelect}
            onTimeout={handleTimedTimeout}
          />
        )}

        {!state.isComplete && state.waitingFor === "numeric" && !state.showingAck && (
          <StageNumericInput
            prompt={state.numericPrompt}
            onSubmit={handleNumericSubmit}
          />
        )}
      </div>

      {/* Completion card */}
      {state.isComplete && (
        <div
          style={{
            position: "relative",
            zIndex: 10,
            textAlign: "center",
            maxWidth: "540px",
            padding: "0 24px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "24px",
          }}
        >
          {/* Orb — small idle state */}
          <AssessmentOrb mode="idle" amplitude={0} targetSize={72} />

          <div>
            <p
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "18px",
                fontWeight: 600,
                color: "rgba(184,196,214,0.9)",
                marginBottom: "12px",
                lineHeight: 1.4,
              }}
            >
              Assessment Complete
            </p>
            <p
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "14px",
                fontWeight: 300,
                color: "rgba(184,196,214,0.5)",
                lineHeight: 1.6,
              }}
            >
              Explore the dashboard to see how ACI surfaces this kind of cognitive profile for every candidate you evaluate.
            </p>
          </div>

          <button
            onClick={() => router.push("/tutorial/dashboard")}
            style={{
              padding: "12px 32px",
              background: "rgba(201,168,76,0.12)",
              border: "1px solid rgba(201,168,76,0.4)",
              borderRadius: "10px",
              color: "rgba(201,168,76,0.9)",
              fontFamily: "var(--font-mono)",
              fontSize: "12px",
              fontWeight: 500,
              letterSpacing: "1px",
              cursor: "pointer",
              transition: "all 200ms ease",
            }}
            onMouseEnter={(e) => {
              (e.target as HTMLButtonElement).style.background = "rgba(201,168,76,0.2)";
              (e.target as HTMLButtonElement).style.borderColor = "rgba(201,168,76,0.6)";
            }}
            onMouseLeave={(e) => {
              (e.target as HTMLButtonElement).style.background = "rgba(201,168,76,0.12)";
              (e.target as HTMLButtonElement).style.borderColor = "rgba(201,168,76,0.4)";
            }}
          >
            EXPLORE DEMO DASHBOARD →
          </button>
        </div>
      )}
    </div>
  );
}

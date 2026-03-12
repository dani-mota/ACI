import { useCallback, useRef } from "react";
import { useChatAssessmentStore } from "@/stores/chat-assessment-store";
import { PHASE_0_SEGMENTS } from "@/lib/assessment/phase-0";

const getStore = () => useChatAssessmentStore.getState();

interface UsePhase0Options {
  token: string;
  playSegmentTTS: (text: string) => Promise<void>;
  getOrbSize: (key: "FULL" | "COMPACT" | "VOICE_PROBE") => number;
  setPhase0MicCheck: (v: boolean) => void;
}

export function usePhase0({ token, playSegmentTTS, getOrbSize, setPhase0MicCheck }: UsePhase0Options) {
  const phase0Ref = useRef<"idle" | "playing" | "mic_check" | "completing" | "done">("idle");
  const micNudgeTimers = useRef<{ t15?: ReturnType<typeof setTimeout>; t30?: ReturnType<typeof setTimeout> }>({});

  const persistPhase0Msg = useCallback(
    async (content: string, role: "AGENT" | "CANDIDATE") => {
      await fetch(`/api/assess/${token}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trigger: "phase_0_message", content, role }),
      });
    },
    [token],
  );

  const clearMicNudgeTimers = useCallback(() => {
    if (micNudgeTimers.current.t15) clearTimeout(micNudgeTimers.current.t15);
    if (micNudgeTimers.current.t30) clearTimeout(micNudgeTimers.current.t30);
    micNudgeTimers.current = {};
  }, []);

  const handlePhase0Complete = useCallback(async () => {
    phase0Ref.current = "done";

    // Fire-and-forget: tell server Phase 0 is done
    fetch(`/api/assess/${token}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ trigger: "phase_0_complete" }),
    }).catch(() => {
      console.warn("[Phase0] phase_0_complete trigger failed");
    });

    // Show break screen
    const s = getStore();
    s.setOrchestratorPhase("TRANSITION_0_1");
    s.loadHistory([], { currentAct: "ACT_1", isComplete: false });
    s.setOrbMode("idle");
    s.setOrbTargetSize(getOrbSize("FULL"));
    s.setSubtitleText("");
  }, [token, getOrbSize]);

  const handlePhase0Response = useCallback(
    async (text: string) => {
      if (phase0Ref.current !== "mic_check") return;
      phase0Ref.current = "completing";
      setPhase0MicCheck(false);
      clearMicNudgeTimers();

      try {
        persistPhase0Msg(text, "CANDIDATE").catch(() => {});

        const confirmation = PHASE_0_SEGMENTS[3];
        await playSegmentTTS(confirmation.text);
        persistPhase0Msg(confirmation.text, "AGENT").catch(() => {});

        await handlePhase0Complete();
      } catch (err) {
        console.error("[Phase0] Transition chain failed:", err);
        if ((phase0Ref.current as string) !== "done") {
          try { await handlePhase0Complete(); } catch { /* give up */ }
        }
      }
    },
    [clearMicNudgeTimers, persistPhase0Msg, playSegmentTTS, handlePhase0Complete, setPhase0MicCheck],
  );

  return {
    persistPhase0Msg,
    clearMicNudgeTimers,
    handlePhase0Complete,
    handlePhase0Response,
    phase0Ref,
    micNudgeTimers,
  };
}

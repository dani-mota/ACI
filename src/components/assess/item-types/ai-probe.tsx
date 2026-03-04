"use client";

import { useState } from "react";
import { Loader2, Brain } from "lucide-react";
import { useAssessmentStore } from "@/stores/assessment-store";

interface AiProbeProps {
  prompt: string;
  token: string;
  construct: string;
  previousResponse: string;
  onSubmit: (response: string) => void;
}

export function AiProbe({ prompt, token, construct, previousResponse, onSubmit }: AiProbeProps) {
  const roleId = useAssessmentStore((s) => s.roleId);
  const assessmentId = useAssessmentStore((s) => s.assessmentId);
  const [text, setText] = useState("");
  const [aiQuestion, setAiQuestion] = useState<string | null>(null);
  const [interactionId, setInteractionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [phase, setPhase] = useState<"initial" | "follow-up">("initial");

  const handleInitialSubmit = async () => {
    setLoading(true);

    try {
      const res = await fetch("/api/assess/ai-probe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          construct,
          prompt,
          previousResponse,
          candidateResponse: text,
          roleId,
          assessmentId,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setAiQuestion(data.followUp);
        if (data.interactionId) setInteractionId(data.interactionId);
        setPhase("follow-up");
        setText("");
      } else {
        // If AI probe fails, just submit the initial response
        onSubmit(text);
      }
    } catch {
      onSubmit(text);
    }

    setLoading(false);
  };

  const handleFollowUpSubmit = async () => {
    // Submit the follow-up response to the AI probe API for analysis
    if (interactionId) {
      try {
        await fetch("/api/assess/ai-probe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            construct,
            interactionId,
            candidateResponse: text,
            token,
          }),
        });
      } catch {
        // Non-fatal — continue even if analysis fails
      }
    }
    onSubmit(`${previousResponse}\n---\nAI Follow-up: ${aiQuestion}\nResponse: ${text}`);
  };

  return (
    <div className="space-y-6">
      {phase === "initial" && (
        <>
          <div className="flex items-center gap-2 text-[10px] text-aci-blue uppercase tracking-wider font-medium">
            <Brain className="w-3.5 h-3.5" />
            AI-Adaptive Question
          </div>
          <p className="text-sm text-foreground leading-relaxed">{prompt}</p>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="w-full h-32 p-4 border border-border bg-card text-xs text-foreground resize-none focus:outline-none focus:border-aci-gold/50"
            placeholder="Type your response..."
          />
          <button
            onClick={handleInitialSubmit}
            disabled={text.length < 30 || loading}
            className="w-full bg-aci-gold text-aci-navy font-bold text-xs py-3 uppercase tracking-wider disabled:opacity-50 hover:bg-aci-gold/90 transition-colors"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Generating follow-up...
              </span>
            ) : (
              "Submit Response"
            )}
          </button>
        </>
      )}

      {phase === "follow-up" && aiQuestion && (
        <>
          <div className="flex items-center gap-2 text-[10px] text-aci-blue uppercase tracking-wider font-medium">
            <Brain className="w-3.5 h-3.5" />
            Follow-up Question
          </div>
          <div className="bg-aci-blue/5 border border-aci-blue/20 p-4">
            <p className="text-sm text-foreground leading-relaxed">{aiQuestion}</p>
          </div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="w-full h-32 p-4 border border-border bg-card text-xs text-foreground resize-none focus:outline-none focus:border-aci-gold/50"
            placeholder="Type your response to the follow-up..."
          />
          <button
            onClick={handleFollowUpSubmit}
            disabled={text.length < 20}
            className="w-full bg-aci-gold text-aci-navy font-bold text-xs py-3 uppercase tracking-wider disabled:opacity-50 hover:bg-aci-gold/90 transition-colors"
          >
            Submit & Continue
          </button>
        </>
      )}
    </div>
  );
}

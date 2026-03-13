"use client";

import type { InteractiveElement } from "@/stores/chat-assessment-store";
import { StageChoiceCards } from "./stage-choice-cards";
import { StageTimedChallenge } from "./stage-timed-challenge";
import { StageConfidenceRating } from "./stage-confidence-rating";
import { StageNumericInput } from "./stage-numeric-input";

interface InteractiveRendererProps {
  activeElement: InteractiveElement | null;
  error: string | null;
  isLoading: boolean;
  onElementResponse: (value: string) => void;
  onTimeout: () => void;
}

export function InteractiveRenderer({
  activeElement,
  error,
  isLoading,
  onElementResponse,
  onTimeout,
}: InteractiveRendererProps) {
  if (!activeElement || activeElement.responded) return null;

  const { elementType, elementData } = activeElement;
  const prompt = (elementData.prompt as string) ?? "";
  const options = (elementData.options as string[]) ?? [];
  const timeLimit = (elementData.timeLimit as number) ?? 60;
  const asciiDiagram = (elementData.asciiDiagram as string) ?? null;

  // Retry banner — visible after network failure resets the element
  const retryBanner = error && !activeElement.responded ? (
    <div className="w-full flex justify-center mb-3 stage-animate">
      <div
        className="px-4 py-2 rounded-lg flex items-center gap-2"
        style={{
          background: "color-mix(in srgb, var(--s-amber, #D97706) 10%, transparent)",
          border: "1px solid color-mix(in srgb, var(--s-amber, #D97706) 25%, transparent)",
          color: "color-mix(in srgb, var(--s-amber, #D97706) 90%, white)",
          fontFamily: "var(--font-display)",
          fontSize: "12px",
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M1 4v6h6" /><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
        </svg>
        Connection issue — please select your answer again
      </div>
    </div>
  ) : null;

  let element: React.ReactNode = null;
  switch (elementType) {
    case "MULTIPLE_CHOICE_INLINE":
    case "TRADEOFF_SELECTION":
      element = (
        <StageChoiceCards
          prompt={prompt}
          options={options}
          onSelect={onElementResponse}
          disabled={isLoading}
        />
      );
      break;
    case "NUMERIC_INPUT":
      element = (
        <StageNumericInput
          prompt={prompt}
          onSubmit={onElementResponse}
          disabled={isLoading}
        />
      );
      break;
    case "CONFIDENCE_RATING":
      element = (
        <StageConfidenceRating
          prompt={prompt}
          onSelect={onElementResponse}
          disabled={isLoading}
        />
      );
      break;
    case "TIMED_CHALLENGE":
      element = (
        <StageTimedChallenge
          prompt={prompt}
          options={options}
          timeLimit={timeLimit}
          onSelect={onElementResponse}
          onTimeout={onTimeout}
          disabled={isLoading}
        />
      );
      break;
    default:
      return null;
  }

  return (
    <>
      {retryBanner}
      {asciiDiagram && (
        <pre
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "clamp(10px, 2.5vw, 13px)",
            lineHeight: 1.4,
            color: "var(--s-t2, #8fadc4)",
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(255,255,255,0.05)",
            borderRadius: "8px",
            padding: "12px 16px",
            marginBottom: "12px",
            whiteSpace: "pre",
            overflowX: "auto",
            maxWidth: "100%",
          }}
        >
          {asciiDiagram}
        </pre>
      )}
      {element}
    </>
  );
}

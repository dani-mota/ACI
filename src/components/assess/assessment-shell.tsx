"use client";

import { useEffect, useState } from "react";
import { useAssessmentStore } from "@/stores/assessment-store";
import { ProgressBar } from "./progress-bar";
import { BlockInterstitial } from "./block-interstitial";
import { CompletionScreen } from "./completion-screen";
import { MultipleChoice } from "./item-types/multiple-choice";
import { LikertScale } from "./item-types/likert-scale";
import { OpenResponse } from "./item-types/open-response";
import { TimedSequence } from "./item-types/timed-sequence";
import { AiProbe } from "./item-types/ai-probe";
import { ASSESSMENT_BLOCKS } from "@/lib/assessment/blocks";
import type { AssessmentItem } from "@/lib/assessment/items";

interface AssessmentShellProps {
  token: string;
  assessmentId: string;
  blockIndex: number;
  items: AssessmentItem[];
  roleId?: string;
}

export function AssessmentShell({ token, assessmentId, blockIndex, items, roleId }: AssessmentShellProps) {
  const initBlock = useAssessmentStore((state) => state.initBlock);
  const store = useAssessmentStore();
  const [state, setState] = useState<"item" | "interstitial" | "complete">("item");

  useEffect(() => {
    initBlock(token, assessmentId, blockIndex, items, roleId);
  }, [token, assessmentId, blockIndex, items, roleId, initBlock]);

  const currentItem = store.items[store.itemIndex];
  const { current, total } = store.getProgress();

  const handleSubmit = (response: string) => {
    if (!currentItem) return;

    store.submitResponse(currentItem.id, response);

    const hasMore = store.advanceItem();
    if (!hasMore) {
      // Block complete — check if there's a next block
      const nextBlockIndex = blockIndex + 1;
      if (nextBlockIndex < ASSESSMENT_BLOCKS.length) {
        setState("interstitial");
      } else {
        setState("complete");
      }
    }
  };

  if (state === "interstitial") {
    return <BlockInterstitial token={token} nextBlockIndex={blockIndex + 1} />;
  }

  if (state === "complete") {
    return <CompletionScreen token={token} />;
  }

  if (!currentItem) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <ProgressBar
        blockIndex={blockIndex}
        currentItem={current}
        totalItems={total}
        timeRemaining={currentItem.timeLimit}
      />

      <div className="max-w-2xl mx-auto px-6 py-8">
        {currentItem.itemType === "MULTIPLE_CHOICE" && currentItem.options && (
          <MultipleChoice
            key={currentItem.id}
            prompt={currentItem.prompt}
            options={currentItem.options}
            onSubmit={handleSubmit}
          />
        )}

        {currentItem.itemType === "LIKERT" && currentItem.options && (
          <LikertScale
            key={currentItem.id}
            prompt={currentItem.prompt}
            options={currentItem.options}
            onSubmit={handleSubmit}
          />
        )}

        {currentItem.itemType === "OPEN_RESPONSE" && (
          <OpenResponse
            key={currentItem.id}
            prompt={currentItem.prompt}
            onSubmit={handleSubmit}
          />
        )}

        {currentItem.itemType === "TIMED_SEQUENCE" && currentItem.options && currentItem.timeLimit && (
          <TimedSequence
            key={currentItem.id}
            prompt={currentItem.prompt}
            options={currentItem.options}
            timeLimit={currentItem.timeLimit}
            onSubmit={handleSubmit}
          />
        )}

        {currentItem.itemType === "AI_PROBE" && (
          <AiProbe
            key={currentItem.id}
            prompt={currentItem.prompt}
            token={token}
            construct={currentItem.construct}
            previousResponse=""
            onSubmit={handleSubmit}
          />
        )}
      </div>
    </div>
  );
}

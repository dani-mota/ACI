"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useChatAssessmentStore } from "@/stores/chat-assessment-store";
import { ChatMessage } from "./chat-message";
import { InteractiveElement } from "./interactive-elements";
import { VoiceControls, speakText } from "./voice-controls";
import { cn } from "@/lib/utils";

interface AssessmentChatProps {
  token: string;
  assessmentId: string;
  candidateName: string;
  companyName: string;
}

const ACT_LABELS: Record<string, string> = {
  ACT_1: "Scenario Investigation",
  ACT_2: "Focused Assessment",
  ACT_3: "Calibration",
};

export function AssessmentChat({ token, assessmentId, candidateName, companyName }: AssessmentChatProps) {
  const store = useChatAssessmentStore();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [inputValue, setInputValue] = useState("");
  const [initialized, setInitialized] = useState(false);

  // Initialize and load history
  useEffect(() => {
    if (initialized) return;

    store.init(token, assessmentId);

    // Load existing messages from server
    fetch(`/api/assess/${token}/chat`)
      .then((res) => res.json())
      .then((data) => {
        if (data.messages?.length > 0) {
          store.loadHistory(data.messages, {
            currentAct: data.state?.currentAct ?? "ACT_1",
            isComplete: data.state?.isComplete ?? false,
          });
        }
      })
      .catch(() => {
        // Loading failed — Phase 0 or stage controller handles greeting
      });

    setInitialized(true);
  }, [token, assessmentId, initialized, store]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [store.messages, store.activeElement]);

  // Speak agent messages when voice is enabled
  useEffect(() => {
    if (!store.voice.enabled) return;

    const lastMessage = store.messages[store.messages.length - 1];
    if (lastMessage?.role === "assistant" && !lastMessage.isStreaming && lastMessage.content) {
      speakText(lastMessage.content);
    }
  }, [store.messages, store.voice.enabled]);

  const handleSend = useCallback(() => {
    const text = inputValue.trim();
    if (!text || store.isLoading) return;
    setInputValue("");
    store.sendMessage(text);
  }, [inputValue, store]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleVoiceTranscript = useCallback(
    (text: string) => {
      if (store.activeElement) {
        // If there's an active element, use voice input as element response
        store.sendElementResponse({
          elementType: store.activeElement.elementType,
          value: text,
        });
      } else {
        store.sendMessage(text);
      }
    },
    [store],
  );

  const handleElementResponse = useCallback(
    (value: string) => {
      if (!store.activeElement) return;
      const elementData = store.activeElement.elementData;
      store.sendElementResponse({
        elementType: store.activeElement.elementType,
        value,
        itemId: elementData.itemId as string | undefined,
        construct: elementData.construct as string | undefined,
      });
    },
    [store],
  );

  return (
    <div className="flex h-[100dvh] flex-col bg-white">
      {/* Header — compact on mobile */}
      <header className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 py-2 sm:px-6 sm:py-3">
        <div>
          <h1 className="text-sm font-semibold text-slate-900">ACI Assessment</h1>
          <p className="text-xs text-slate-500">{companyName}</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
            {ACT_LABELS[store.currentAct] ?? store.currentAct}
          </div>
          <VoiceControls onTranscript={handleVoiceTranscript} />
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto" role="log" aria-live="polite" aria-label="Assessment conversation">
        <div className="mx-auto max-w-3xl py-6">
          {store.messages.map((message) => (
            <ChatMessage key={message.id} message={message} />
          ))}

          {/* Active interactive element */}
          {store.activeElement && !store.activeElement.responded && (
            <div className="mx-4 my-3 rounded-2xl border border-slate-200 bg-white shadow-sm">
              <InteractiveElement
                elementType={store.activeElement.elementType}
                elementData={store.activeElement.elementData}
                onRespond={handleElementResponse}
                disabled={store.isLoading}
              />
            </div>
          )}

          {/* Error message */}
          {store.error && (
            <div className="mx-4 my-3 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
              Something went wrong. Please try again.
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input area */}
      {!store.isComplete && (
        <div className="border-t border-slate-200 bg-white px-4 py-3">
          <div className="mx-auto flex max-w-3xl items-end gap-3">
            <textarea
              ref={textareaRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              aria-label="Type your response"
              placeholder={
                store.activeElement
                  ? "Use the options above to respond..."
                  : "Type your response..."
              }
              disabled={store.isLoading || store.isComplete || !!store.activeElement}
              rows={1}
              className={cn(
                "flex-1 resize-none rounded-xl border-2 border-slate-200 px-4 py-3 text-sm",
                "focus:border-blue-500 focus:outline-none",
                "disabled:bg-slate-50 disabled:text-slate-400",
                "max-h-32 min-h-[44px]",
              )}
              style={{
                height: "auto",
                minHeight: "44px",
              }}
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement;
                target.style.height = "auto";
                target.style.height = `${Math.min(target.scrollHeight, 128)}px`;
              }}
            />
            <button
              onClick={handleSend}
              aria-label="Send message"
              disabled={!inputValue.trim() || store.isLoading || store.isComplete || !!store.activeElement}
              className={cn(
                "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl",
                "bg-slate-800 text-white transition-colors",
                "hover:bg-slate-700 disabled:bg-slate-300 disabled:text-slate-500",
              )}
            >
              <SendIcon className="h-5 w-5" />
            </button>
          </div>
          <p className="mx-auto mt-2 max-w-3xl text-center text-xs text-slate-400">
            Press Enter to send, Shift+Enter for a new line
          </p>
        </div>
      )}

      {/* Assessment complete banner */}
      {store.isComplete && (
        <div className="border-t border-slate-200 bg-slate-50 px-4 py-6 text-center">
          <p className="text-sm font-medium text-slate-700">Assessment Complete</p>
          <p className="mt-1 text-xs text-slate-500">Thank you for your time. Your responses have been recorded.</p>
        </div>
      )}
    </div>
  );
}

function SendIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  );
}

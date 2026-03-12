"use client";

import { useState, useRef } from "react";
import { AssessmentOrb } from "../orb/assessment-orb";
import { MicButton } from "../voice/mic-button";
import { SubtitleDisplay } from "./subtitle-display";
import { CandidateTranscript } from "./candidate-transcript";
import { InputModeToggle } from "./input-mode-toggle";
import type { OrbMode } from "@/stores/chat-assessment-store";

type InputMode = "voice" | "text";

interface AriaSidebarProps {
  // Orb state
  orbMode: OrbMode;
  audioAmplitude: number;
  orbTargetSize?: number;
  // Display
  subtitleText: string;
  subtitleRevealedWords: number;
  isTTSPlaying: boolean;
  candidateTranscript: string;
  showTranscript: boolean;
  // Bubble text (contextual hint from Aria)
  bubbleText?: string;
  // Input
  showInput: boolean;
  inputMode: InputMode;
  showInputToggle: boolean;
  isLoading: boolean;
  // Callbacks
  onVoiceTranscript: (text: string) => void;
  onListeningChange: (listening: boolean) => void;
  onTextSend: (text: string) => void;
  onInputModeToggle: (mode: InputMode) => void;
  // Refs
  micButtonRef?: React.RefObject<HTMLButtonElement | null>;
}

export function AriaSidebar({
  orbMode,
  audioAmplitude,
  orbTargetSize = 88,
  subtitleText,
  subtitleRevealedWords,
  isTTSPlaying,
  candidateTranscript,
  showTranscript,
  bubbleText,
  showInput,
  inputMode,
  showInputToggle,
  isLoading,
  onVoiceTranscript,
  onListeningChange,
  onTextSend,
  onInputModeToggle,
  micButtonRef,
}: AriaSidebarProps) {
  const [textInput, setTextInput] = useState("");
  const internalMicRef = useRef<HTMLButtonElement>(null);
  const micRef = micButtonRef ?? internalMicRef;

  const handleTextSubmit = () => {
    const text = textInput.trim();
    if (!text) return;
    setTextInput("");
    onTextSend(text);
  };

  return (
    <aside
      aria-label="Aria AI assistant"
      className="flex flex-col items-center h-full"
      style={{
        minWidth: "214px",
        maxWidth: "280px",
        background: "color-mix(in srgb, var(--s-bg2, #0f1729) 40%, transparent)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        borderLeft: "1px solid var(--s-border, rgba(37,99,235,0.12))",
        padding: "24px 16px 16px",
      }}
    >
      {/* Small orb */}
      <div className="flex flex-col items-center gap-1 mb-4">
        <AssessmentOrb
          mode={orbMode}
          amplitude={audioAmplitude}
          targetSize={orbTargetSize}
        />
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "9px",
            letterSpacing: "2px",
            textTransform: "uppercase",
            color: "var(--s-t3, #3d5068)",
            marginTop: "4px",
          }}
        >
          Aria
        </span>
      </div>

      {/* Speech bubble — contextual hint OR subtitle */}
      <div
        className="w-full mb-4"
        style={{
          background: "color-mix(in srgb, var(--s-bg, #080e1a) 60%, transparent)",
          border: "1px solid var(--s-border, rgba(37,99,235,0.12))",
          borderRadius: "10px",
          padding: "10px 12px",
          minHeight: "48px",
        }}
      >
        {bubbleText ? (
          <p
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "11px",
              fontWeight: 300,
              fontStyle: "italic",
              lineHeight: 1.6,
              color: "var(--s-t2, #7b8fa8)",
              margin: 0,
            }}
          >
            {bubbleText}
          </p>
        ) : (
          <SubtitleDisplay
            text={subtitleText}
            revealedWords={subtitleRevealedWords}
            isRevealing={isTTSPlaying}
          />
        )}
      </div>

      {/* Candidate transcript echo */}
      <CandidateTranscript text={candidateTranscript} visible={showTranscript} />

      {/* Spacer */}
      <div className="flex-1" />

      {/* Input area — pinned to bottom */}
      {showInput && (
        <div className="flex flex-col items-center gap-2 w-full mt-4">
          {showInputToggle && (
            <InputModeToggle
              mode={inputMode}
              onToggle={onInputModeToggle}
            />
          )}

          {inputMode === "voice" ? (
            <MicButton
              ref={micRef}
              onTranscript={onVoiceTranscript}
              onListeningChange={onListeningChange}
              disabled={isLoading || isTTSPlaying}
            />
          ) : (
            <div className="flex gap-2 w-full">
              <textarea
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleTextSubmit();
                  }
                }}
                aria-label="Type your response"
                placeholder="Type your response..."
                disabled={isLoading}
                rows={1}
                className="flex-1 resize-none px-3 py-2 text-xs outline-none"
                style={{
                  borderRadius: "8px",
                  border: "1px solid rgba(255,255,255,0.07)",
                  background: "rgba(255,255,255,0.03)",
                  color: "rgba(255,255,255,0.85)",
                  fontFamily: "var(--font-display)",
                  maxHeight: "64px",
                  minHeight: "36px",
                }}
                onInput={(e) => {
                  const target = e.target as HTMLTextAreaElement;
                  target.style.height = "auto";
                  target.style.height = `${Math.min(target.scrollHeight, 64)}px`;
                }}
              />
              <button
                onClick={handleTextSubmit}
                disabled={isLoading || !textInput.trim()}
                aria-label="Send message"
                style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "8px",
                  border: "1px solid rgba(255,255,255,0.07)",
                  background: textInput.trim()
                    ? "rgba(37,99,235,0.12)"
                    : "rgba(255,255,255,0.03)",
                  color: textInput.trim()
                    ? "var(--s-blue-g, #4a8af5)"
                    : "rgba(255,255,255,0.2)",
                  cursor: textInput.trim() ? "pointer" : "default",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: "all 200ms ease",
                  flexShrink: 0,
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              </button>
            </div>
          )}
        </div>
      )}
    </aside>
  );
}

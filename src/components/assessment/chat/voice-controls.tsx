"use client";

import { useEffect, useRef, useCallback } from "react";
import { useChatAssessmentStore } from "@/stores/chat-assessment-store";
import { cn } from "@/lib/utils";

interface VoiceControlsProps {
  onTranscript: (text: string) => void;
}

export function VoiceControls({ onTranscript }: VoiceControlsProps) {
  const { voice, toggleVoice, setVoiceListening, setVoiceSpeaking } = useChatAssessmentStore();
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const synthesisRef = useRef<SpeechSynthesisUtterance | null>(null);

  const isSupported = typeof window !== "undefined" && ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);

  // Initialize speech recognition
  useEffect(() => {
    if (!isSupported || !voice.enabled) return;

    const SpeechRecognitionAPI = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognitionAPI();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-US";

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const transcript = event.results[0]?.[0]?.transcript;
      if (transcript) {
        onTranscript(transcript);
      }
      setVoiceListening(false);
    };

    recognition.onerror = () => {
      setVoiceListening(false);
    };

    recognition.onend = () => {
      setVoiceListening(false);
    };

    recognitionRef.current = recognition;

    return () => {
      recognition.abort();
      recognitionRef.current = null;
    };
  }, [voice.enabled, isSupported, onTranscript, setVoiceListening]);

  const startListening = useCallback(() => {
    if (recognitionRef.current && !voice.listening) {
      try {
        recognitionRef.current.start();
        setVoiceListening(true);
      } catch {
        // Already started or not available
      }
    }
  }, [voice.listening, setVoiceListening]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current && voice.listening) {
      recognitionRef.current.stop();
      setVoiceListening(false);
    }
  }, [voice.listening, setVoiceListening]);

  if (!isSupported) {
    return null;
  }

  return (
    <div className="flex items-center gap-2">
      {/* Voice mode toggle */}
      <button
        onClick={toggleVoice}
        className={cn(
          "flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all",
          voice.enabled
            ? "border-blue-500 bg-blue-50 text-blue-600"
            : "border-slate-200 bg-white text-slate-400 hover:border-slate-300",
        )}
        title={voice.enabled ? "Disable voice mode" : "Enable voice mode"}
      >
        <MicIcon className="h-5 w-5" />
      </button>

      {/* Push-to-talk button (only when voice is enabled) */}
      {voice.enabled && (
        <button
          onMouseDown={startListening}
          onMouseUp={stopListening}
          onMouseLeave={stopListening}
          onTouchStart={startListening}
          onTouchEnd={stopListening}
          className={cn(
            "flex h-10 items-center gap-2 rounded-full border-2 px-4 text-sm font-medium transition-all",
            voice.listening
              ? "border-red-500 bg-red-50 text-red-600"
              : "border-slate-200 bg-white text-slate-600 hover:border-slate-300",
          )}
        >
          {voice.listening ? (
            <>
              <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
              Listening...
            </>
          ) : (
            "Hold to speak"
          )}
        </button>
      )}
    </div>
  );
}

/**
 * Speak text aloud using the Web Speech API.
 * Call this when an agent message arrives and voice mode is enabled.
 */
export function speakText(text: string, onEnd?: () => void): void {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

  // Cancel any ongoing speech
  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 1.0;
  utterance.pitch = 1.0;
  utterance.volume = 1.0;

  if (onEnd) {
    utterance.onend = onEnd;
  }

  window.speechSynthesis.speak(utterance);
}

// Simple mic icon
function MicIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  );
}

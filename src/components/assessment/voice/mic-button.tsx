"use client";

import { useEffect, useRef, useCallback, useState } from "react";

interface MicButtonProps {
  onTranscript: (text: string) => void;
  onListeningChange: (listening: boolean) => void;
  disabled?: boolean;
}

export function MicButton({ onTranscript, onListeningChange, disabled }: MicButtonProps) {
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(true);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  useEffect(() => {
    const hasSpeech =
      typeof window !== "undefined" &&
      ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);
    setSupported(hasSpeech);
  }, []);

  // Initialize speech recognition
  useEffect(() => {
    if (!supported) return;

    const SpeechRecognitionAPI =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognitionAPI();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-US";

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const transcript = event.results[0]?.[0]?.transcript;
      if (transcript) {
        onTranscript(transcript);
      }
      setListening(false);
      onListeningChange(false);
    };

    recognition.onerror = () => {
      setListening(false);
      onListeningChange(false);
    };

    recognition.onend = () => {
      setListening(false);
      onListeningChange(false);
    };

    recognitionRef.current = recognition;

    return () => {
      recognition.abort();
      recognitionRef.current = null;
    };
  }, [supported, onTranscript, onListeningChange]);

  const toggleListening = useCallback(() => {
    if (disabled || !recognitionRef.current) return;

    if (listening) {
      recognitionRef.current.stop();
      setListening(false);
      onListeningChange(false);
    } else {
      try {
        recognitionRef.current.start();
        setListening(true);
        onListeningChange(true);
      } catch {
        // Already started
      }
    }
  }, [listening, disabled, onListeningChange]);

  if (!supported) return null;

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        onClick={toggleListening}
        disabled={disabled}
        aria-label={listening ? "Microphone active, listening" : "Activate microphone"}
        className="relative stage-animate"
        style={{
          width: "52px",
          height: "52px",
          borderRadius: "50%",
          border: listening
            ? "1px solid #22d68a"
            : "1px solid rgba(255, 255, 255, 0.1)",
          background: listening
            ? "rgba(5, 150, 105, 0.08)"
            : "rgba(255, 255, 255, 0.03)",
          cursor: disabled ? "default" : "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transition: "all 300ms ease",
          boxShadow: listening
            ? "0 0 20px rgba(34, 214, 138, 0.2)"
            : "none",
        }}
      >
        {/* Ripple ring when listening */}
        {listening && (
          <span
            className="absolute inset-0 rounded-full"
            style={{
              border: "1px solid rgba(34, 214, 138, 0.3)",
              animation: "micRipple 1.5s ease-out infinite",
            }}
          />
        )}

        {/* Mic icon */}
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke={listening ? "#22d68a" : "rgba(255, 255, 255, 0.5)"}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ transition: "stroke 300ms ease" }}
        >
          <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
          <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
          <line x1="12" y1="19" x2="12" y2="23" />
          <line x1="8" y1="23" x2="16" y2="23" />
        </svg>
      </button>

      {/* Hint text */}
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "9px",
          letterSpacing: "1.2px",
          textTransform: "uppercase",
          color: listening
            ? "#22d68a"
            : "rgba(255, 255, 255, 0.25)",
          transition: "color 300ms ease",
        }}
      >
        {listening ? "Listening..." : "Tap to speak"}
      </span>

      {/* Keyframe for ripple */}
      <style jsx>{`
        @keyframes micRipple {
          0% {
            transform: scale(1);
            opacity: 0.6;
          }
          100% {
            transform: scale(1.6);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}

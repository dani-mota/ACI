"use client";

import { useEffect, useRef, useCallback, useState, forwardRef } from "react";

interface MicButtonProps {
  onTranscript: (text: string) => void;
  onListeningChange: (listening: boolean) => void;
  disabled?: boolean;
}

export const MicButton = forwardRef<HTMLButtonElement, MicButtonProps>(
  function MicButton({ onTranscript, onListeningChange, disabled }, ref) {
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(true);
  const [interim, setInterim] = useState("");
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const silenceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const transcriptRef = useRef("");

  // Stable callback refs
  const onTranscriptRef = useRef(onTranscript);
  onTranscriptRef.current = onTranscript;
  const onListeningChangeRef = useRef(onListeningChange);
  onListeningChangeRef.current = onListeningChange;

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
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event: any) => {
      let fullTranscript = "";
      let interimText = "";

      for (let i = 0; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          fullTranscript += event.results[i][0].transcript;
        } else {
          interimText += event.results[i][0].transcript;
        }
      }

      transcriptRef.current = fullTranscript;
      setInterim(interimText);

      // Reset silence timer — auto-stop after 2s of silence following final results
      if (silenceTimer.current) clearTimeout(silenceTimer.current);
      if (fullTranscript) {
        silenceTimer.current = setTimeout(() => {
          recognition.stop();
        }, 2000);
      }
    };

    recognition.onspeechend = () => {
      // Speech stopped — give a brief window for any final results
      if (silenceTimer.current) clearTimeout(silenceTimer.current);
      silenceTimer.current = setTimeout(() => {
        recognition.stop();
      }, 1500);
    };

    recognition.onerror = (event: any) => {
      if (event.error === "aborted") return;
      setListening(false);
      setInterim("");
      onListeningChangeRef.current(false);
    };

    recognition.onend = () => {
      if (silenceTimer.current) clearTimeout(silenceTimer.current);
      setListening(false);
      setInterim("");
      onListeningChangeRef.current(false);

      // Submit accumulated transcript
      const text = transcriptRef.current.trim();
      if (text) {
        onTranscriptRef.current(text);
        transcriptRef.current = "";
      }
    };

    recognitionRef.current = recognition;

    return () => {
      if (silenceTimer.current) clearTimeout(silenceTimer.current);
      recognition.abort();
      recognitionRef.current = null;
    };
  }, [supported]);

  const toggleListening = useCallback(() => {
    if (disabled || !recognitionRef.current) return;

    if (listening) {
      recognitionRef.current.stop();
    } else {
      try {
        transcriptRef.current = "";
        setInterim("");
        recognitionRef.current.start();
        setListening(true);
        onListeningChangeRef.current(true);
      } catch {
        // Already started
      }
    }
  }, [listening, disabled]);

  if (!supported) {
    return (
      <div className="flex flex-col items-center gap-2">
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "9px",
            letterSpacing: "1.2px",
            textTransform: "uppercase",
            color: "rgba(255, 255, 255, 0.25)",
            textAlign: "center",
          }}
        >
          Voice input unavailable in this browser
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        ref={ref}
        onClick={toggleListening}
        disabled={disabled}
        aria-label={listening ? "Microphone active, listening" : "Activate microphone"}
        className="relative stage-animate"
        style={{
          width: "52px",
          height: "52px",
          borderRadius: "50%",
          border: listening
            ? "1px solid var(--s-green-b, #22d68a)"
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
          stroke={listening ? "var(--s-green-b, #22d68a)" : "rgba(255, 255, 255, 0.5)"}
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

      {/* Status text */}
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "9px",
          letterSpacing: "1.2px",
          textTransform: "uppercase",
          color: listening
            ? "var(--s-green-b, #22d68a)"
            : "rgba(255, 255, 255, 0.25)",
          transition: "color 300ms ease",
          maxWidth: "200px",
          textAlign: "center",
          minHeight: "14px",
        }}
      >
        {listening
          ? interim
            ? interim.slice(0, 40) + (interim.length > 40 ? "..." : "")
            : "Listening..."
          : "Tap to speak"}
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
});

"use client";

import { useEffect, useRef, useCallback, useState, forwardRef } from "react";

interface MicButtonProps {
  onTranscript: (text: string) => void;
  onListeningChange: (listening: boolean) => void;
  disabled?: boolean;
  /** Why the button is disabled — drives label text so candidates understand the state. */
  reason?: "speaking" | "loading";
}

export const MicButton = forwardRef<HTMLButtonElement, MicButtonProps>(
  function MicButton({ onTranscript, onListeningChange, disabled, reason }, ref) {
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(true);
  const [interim, setInterim] = useState("");
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const transcriptRef = useRef("");
  // Fix: PRO-39 — track unmount to prevent submitting partial transcript
  const unmountedRef = useRef(false);

  // Toggle mode: distinguish user-initiated stop from browser-initiated stop
  const userRequestedStop = useRef(false);
  // Auto-restart circuit breaker: prevent infinite restart loops
  const restartCountRef = useRef(0);
  const restartWindowRef = useRef(0);
  const restartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastErrorRef = useRef<string | null>(null);
  const MAX_RESTARTS = 3;
  const RESTART_WINDOW_MS = 5000;
  const RESTART_DELAY_MS = 150;

  // Stable callback refs
  const onTranscriptRef = useRef(onTranscript);
  const onListeningChangeRef = useRef(onListeningChange);
  useEffect(() => { onTranscriptRef.current = onTranscript; }, [onTranscript]);
  useEffect(() => { onListeningChangeRef.current = onListeningChange; }, [onListeningChange]);

  useEffect(() => {
    const hasSpeech =
      typeof window !== "undefined" &&
      ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);
    requestAnimationFrame(() => setSupported(hasSpeech));
  }, []);

  // Initialize speech recognition
  useEffect(() => {
    if (!supported) return;
    unmountedRef.current = false; // Fix: reset on re-mount (React StrictMode)

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

      // Reset restart counter on successful speech — recognition is working
      restartCountRef.current = 0;
      lastErrorRef.current = null;
    };

    recognition.onspeechend = () => {
      // Toggle mode — do not auto-stop on speech end.
      // The user controls when the mic turns off by clicking again.
    };

    recognition.onerror = (event: any) => {
      console.warn("[MIC] SpeechRecognition error:", event.error);
      if (event.error === "aborted") return;
      // Store the error type so onend can distinguish no-speech from real failures
      lastErrorRef.current = event.error;
      // "no-speech" is expected in toggle mode — user may click mic before speaking
      if (event.error === "no-speech") return;
      // Real errors (not-allowed, network, audio-capture, service-not-allowed) — kill the mic
      setListening(false);
      setInterim("");
      onListeningChangeRef.current(false);
    };

    recognition.onend = () => {
      // If the user explicitly clicked off, submit transcript and stop
      if (userRequestedStop.current) {
        if (restartTimerRef.current) { clearTimeout(restartTimerRef.current); restartTimerRef.current = null; }
        setListening(false);
        setInterim("");
        onListeningChangeRef.current(false);

        if (unmountedRef.current) {
          transcriptRef.current = "";
          return;
        }

        const text = transcriptRef.current.trim();
        if (text) {
          onTranscriptRef.current(text);
          transcriptRef.current = "";
        }
        return;
      }

      // Determine if this was a no-speech cycle (expected) or a real failure
      const wasNoSpeech = lastErrorRef.current === "no-speech";
      lastErrorRef.current = null;

      // Only count real failures against the circuit breaker — not no-speech
      if (!wasNoSpeech) {
        const now = Date.now();
        if (now - restartWindowRef.current > RESTART_WINDOW_MS) {
          restartCountRef.current = 0;
          restartWindowRef.current = now;
        }
        restartCountRef.current++;

        if (restartCountRef.current > MAX_RESTARTS) {
          // Circuit breaker tripped — too many real failures, give up
          console.warn("[MIC] Auto-restart circuit breaker tripped, stopping mic");
          try { recognition.abort(); } catch { /* already stopped */ }
          setListening(false);
          setInterim("");
          onListeningChangeRef.current(false);

          if (!unmountedRef.current) {
            const text = transcriptRef.current.trim();
            if (text) {
              onTranscriptRef.current(text);
              transcriptRef.current = "";
            }
          }
          return;
        }
      }

      // Auto-restart with delay — keep green on, keep transcript
      const label = wasNoSpeech
        ? "[MIC] Restarting after no-speech (expected in toggle mode)"
        : "[MIC] Browser ended recognition unexpectedly, restarting...";
      console.info(label);

      restartTimerRef.current = setTimeout(() => {
        restartTimerRef.current = null;
        if (userRequestedStop.current || unmountedRef.current) return;
        try {
          recognition.start();
        } catch (err) {
          // start() failed — force-abort to reset state, then give up
          console.warn("[MIC] Auto-restart failed, aborting to reset:", err);
          try { recognition.abort(); } catch { /* already stopped */ }
          setListening(false);
          setInterim("");
          onListeningChangeRef.current(false);
        }
      }, RESTART_DELAY_MS);
    };

    recognitionRef.current = recognition;

    return () => {
      // Fix: PRO-39 — mark unmounted before aborting so onend doesn't submit partial
      unmountedRef.current = true;
      userRequestedStop.current = true; // Prevent auto-restart during cleanup
      if (restartTimerRef.current) { clearTimeout(restartTimerRef.current); restartTimerRef.current = null; }
      transcriptRef.current = "";
      recognition.abort();
      recognitionRef.current = null;
    };
  }, [supported]);

  const toggleListening = useCallback(() => {
    if (disabled || !recognitionRef.current) return;

    if (listening) {
      // User explicitly clicked off — cancel any pending restart and set flag
      if (restartTimerRef.current) { clearTimeout(restartTimerRef.current); restartTimerRef.current = null; }
      userRequestedStop.current = true;
      recognitionRef.current.stop();
    } else {
      // Force-abort any zombie recognition state before starting fresh
      try { recognitionRef.current.abort(); } catch { /* already stopped */ }

      try {
        userRequestedStop.current = false;
        lastErrorRef.current = null;
        restartCountRef.current = 0;
        restartWindowRef.current = Date.now();
        transcriptRef.current = "";
        setInterim("");
        recognitionRef.current.start();
        setListening(true);
        onListeningChangeRef.current(true);
      } catch (err) {
        // start() failed — force-abort to ensure clean state for next click
        console.warn("[MIC] start() failed, aborting to reset state:", err);
        try { recognitionRef.current.abort(); } catch { /* already stopped */ }
      }
    }
  }, [listening, disabled]);

  if (!supported) {
    return (
      <div className="flex flex-col items-center gap-2">
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "11px", // Fix: PRO-53
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
          opacity: disabled ? 0.35 : 1,
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
          fontSize: "11px", // Fix: PRO-53
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
          : disabled && reason === "speaking"
            ? "Aria is speaking..."
            : disabled && reason === "loading"
              ? "Please wait..."
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

"use client";

import { useState, useRef, useEffect } from "react";
import { Loader2, Mic, CheckCircle2, XCircle, Volume2 } from "lucide-react";

interface WelcomeScreenProps {
  token: string;
  candidateName: string;
  roleName: string;
  companyName: string;
}

export function WelcomeScreen({ token, candidateName, roleName, companyName }: WelcomeScreenProps) {
  const [consent, setConsent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Readiness checklist
  const [checklist, setChecklist] = useState({
    quiet: false,
    mic: false,
    time: false,
    headphones: false,
  });

  // Mic test state
  const [micStatus, setMicStatus] = useState<"idle" | "testing" | "success" | "failed">("idle");
  const [micLevel, setMicLevel] = useState(0);
  const micStreamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);

  // Cleanup mic test on unmount
  useEffect(() => {
    return () => {
      if (micStreamRef.current) {
        micStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const testMic = async () => {
    setMicStatus("testing");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;

      const ctx = new AudioContext();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const poll = () => {
        analyser.getByteFrequencyData(dataArray);
        const avg = dataArray.reduce((sum, v) => sum + v, 0) / dataArray.length;
        const normalized = Math.min(1, avg / 80);
        setMicLevel(normalized);
        rafRef.current = requestAnimationFrame(poll);
      };
      poll();

      // After 2.5s, mark as success (permission granted)
      setTimeout(() => {
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        stream.getTracks().forEach((t) => t.stop());
        ctx.close();
        setMicStatus("success");
        setChecklist((c) => ({ ...c, mic: true }));
        setMicLevel(0);
      }, 2500);
    } catch {
      setMicStatus("failed");
      setMicLevel(0);
    }
  };

  const handleStart = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/assess/${token}/start`, { method: "POST" });
      if (res.ok) {
        window.location.href = `/assess/${token}/v2`;
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Failed to start assessment. Please try again.");
        setLoading(false);
      }
    } catch {
      setError("Connection error. Please check your internet and try again.");
      setLoading(false);
    }
  };

  const allChecked = checklist.quiet && checklist.mic && checklist.time;

  return (
    <div className="flex items-center justify-center px-4 py-12" style={{ minHeight: "calc(100dvh - 48px)" }}>
      <div className="w-full max-w-lg bg-card border border-border rounded-lg shadow-sm">
        {/* Header */}
        <div className="p-8 pb-0 text-center">
          <p
            className="text-[10px] uppercase tracking-[2.5px] mb-4 text-muted-foreground"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            Assessment Invitation
          </p>
          <h1
            className="text-xl font-semibold mb-2 text-foreground"
            style={{ fontFamily: "var(--font-dm-sans)" }}
          >
            Welcome, {candidateName}
          </h1>
          <p
            className="text-sm leading-relaxed text-muted-foreground"
            style={{ fontFamily: "var(--font-dm-sans)" }}
          >
            {companyName} has invited you to complete an assessment for the{" "}
            <span className="font-medium text-foreground">{roleName}</span> role.
          </p>
        </div>

        <div className="p-8 space-y-6">
          {/* What to expect */}
          <div>
            <SectionLabel>What to Expect</SectionLabel>
            <p
              className="text-[13px] leading-relaxed text-muted-foreground"
              style={{ fontFamily: "var(--font-dm-sans)" }}
            >
              You&apos;ll have a conversation with <strong className="text-foreground">Aria</strong>, an AI
              evaluator who will guide you through scenarios and questions. The assessment takes approximately 60–90 minutes.
              There are no trick questions — respond naturally and thoughtfully.
            </p>
          </div>

          {/* Readiness checklist */}
          <div>
            <SectionLabel>Readiness Checklist</SectionLabel>
            <div className="space-y-3">
              <CheckItem
                label="Quiet environment"
                checked={checklist.quiet}
                onChange={(v) => setChecklist((c) => ({ ...c, quiet: v }))}
                icon={<Volume2 className="w-3.5 h-3.5" />}
              />

              <div className="flex items-center justify-between">
                <CheckItem
                  label="Microphone access"
                  checked={checklist.mic}
                  onChange={(v) => setChecklist((c) => ({ ...c, mic: v }))}
                  icon={<Mic className="w-3.5 h-3.5" />}
                />
                {micStatus === "idle" && (
                  <button
                    onClick={testMic}
                    className="text-[11px] px-3 py-1 rounded-md transition-colors bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-border"
                    style={{ fontFamily: "var(--font-mono)" }}
                  >
                    Test Mic
                  </button>
                )}
                {micStatus === "testing" && (
                  <div className="flex items-center gap-2">
                    <div
                      className="h-2 rounded-full transition-all bg-aci-green"
                      style={{
                        width: `${Math.max(16, micLevel * 60)}px`,
                        opacity: micLevel > 0.05 ? 1 : 0.3,
                        transition: "width 100ms ease",
                      }}
                    />
                    <span className="text-[10px] text-muted-foreground">Listening...</span>
                  </div>
                )}
                {micStatus === "success" && (
                  <span className="flex items-center gap-1 text-[11px] text-aci-green" style={{ fontFamily: "var(--font-mono)" }}>
                    <CheckCircle2 className="w-3 h-3" /> OK
                  </span>
                )}
                {micStatus === "failed" && (
                  <span className="flex items-center gap-1 text-[11px] text-destructive" style={{ fontFamily: "var(--font-mono)" }}>
                    <XCircle className="w-3 h-3" /> No access
                  </span>
                )}
              </div>

              <CheckItem
                label="60–90 minutes available"
                checked={checklist.time}
                onChange={(v) => setChecklist((c) => ({ ...c, time: v }))}
              />

              <CheckItem
                label="Headphones (recommended)"
                checked={checklist.headphones}
                onChange={(v) => setChecklist((c) => ({ ...c, headphones: v }))}
                optional
              />
            </div>
          </div>

          {/* Privacy disclosure */}
          <div className="p-4 rounded-lg bg-muted/50 border border-border">
            <SectionLabel>Privacy</SectionLabel>
            <p
              className="text-[11px] leading-relaxed text-muted-foreground"
              style={{ fontFamily: "var(--font-dm-sans)" }}
            >
              Your responses — spoken and typed — will be recorded, transcribed, and evaluated.
              Audio is processed in real-time and not stored after transcription. Results are shared
              only with the hiring team at {companyName}.
            </p>
          </div>

          {/* Consent */}
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              className="mt-0.5"
              style={{ accentColor: "#0F1729" }}
            />
            <span
              className="text-[11px] leading-relaxed text-muted-foreground"
              style={{ fontFamily: "var(--font-dm-sans)" }}
            >
              I consent to AI-adaptive questioning and agree to complete the assessment honestly
              without external assistance.
            </span>
          </label>

          {/* CTA */}
          <button
            disabled={!consent || !allChecked || loading}
            onClick={handleStart}
            style={{ fontFamily: "var(--font-dm-sans)" }}
            className={`w-full h-12 rounded-lg text-sm font-semibold uppercase tracking-wider transition-all ${
              consent && allChecked && !loading
                ? "bg-aci-navy text-white hover:bg-aci-navy/90 cursor-pointer"
                : "bg-muted text-muted-foreground cursor-not-allowed"
            }`}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Starting...
              </span>
            ) : (
              "Begin Assessment"
            )}
          </button>

          {error && (
            <p className="text-xs text-center text-destructive">
              {error}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ──

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2
      className="text-[9px] font-medium uppercase tracking-[2px] mb-3 text-muted-foreground"
      style={{ fontFamily: "var(--font-mono)" }}
    >
      {children}
    </h2>
  );
}

function CheckItem({
  label,
  checked,
  onChange,
  optional,
  icon,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  optional?: boolean;
  icon?: React.ReactNode;
}) {
  return (
    <label className="flex items-center gap-3 cursor-pointer">
      <div
        className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 transition-all border ${
          checked
            ? "bg-aci-green/10 border-aci-green/30"
            : "bg-muted border-border"
        }`}
        onClick={(e) => {
          e.preventDefault();
          onChange(!checked);
        }}
      >
        {checked && (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} className="text-aci-green">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
      </div>
      <span
        className={`text-[13px] flex items-center gap-1.5 ${
          checked ? "text-foreground" : "text-muted-foreground"
        }`}
        style={{ fontFamily: "var(--font-dm-sans)" }}
      >
        {icon}
        {label}
        {optional && (
          <span className="ml-1 text-[10px] text-muted-foreground/50">
            (optional)
          </span>
        )}
      </span>
    </label>
  );
}

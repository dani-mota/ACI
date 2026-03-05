"use client";

import { useState } from "react";
import { Clock, Brain, Shield, Mic, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

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

  return (
    <div className="max-w-2xl mx-auto mt-12 px-6">
      <div className="bg-card border border-border">
        {/* Header */}
        <div className="bg-aci-navy p-8 text-center">
          <h1
            className="text-2xl font-bold text-white mb-2"
            style={{ fontFamily: "var(--font-dm-sans)" }}
          >
            Welcome, {candidateName}
          </h1>
          <p className="text-sm text-white/60">
            {companyName} has invited you to complete an assessment for the{" "}
            <span className="text-aci-gold font-medium">{roleName}</span> position.
          </p>
        </div>

        {/* Body */}
        <div className="p-8 space-y-6">
          {/* What to expect */}
          <div>
            <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-4">
              What to Expect
            </h2>
            <div className="grid gap-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-aci-blue/10 flex items-center justify-center flex-shrink-0">
                  <Clock className="w-4 h-4 text-aci-blue" />
                </div>
                <div>
                  <p className="text-xs font-medium text-foreground">Approximately 60–90 minutes</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    An interactive conversation with an AI assessment agent
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-aci-gold/10 flex items-center justify-center flex-shrink-0">
                  <Brain className="w-4 h-4 text-aci-gold" />
                </div>
                <div>
                  <p className="text-xs font-medium text-foreground">Scenario-Based & Adaptive</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    Discussions, problem-solving exercises, and adaptive follow-up probes
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-aci-green/10 flex items-center justify-center flex-shrink-0">
                  <Mic className="w-4 h-4 text-aci-green" />
                </div>
                <div>
                  <p className="text-xs font-medium text-foreground">Voice Mode Available</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    Speak your responses if preferred — type or talk, your choice
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-accent flex items-center justify-center flex-shrink-0">
                  <Shield className="w-4 h-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-xs font-medium text-foreground">No Preparation Needed</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    This assessment measures natural aptitude. Answer honestly and thoughtfully.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Guidelines */}
          <div className="bg-accent/50 border border-border p-4">
            <h3 className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-2">
              Important Guidelines
            </h3>
            <ul className="text-[11px] text-muted-foreground space-y-1.5">
              <li>- Find a quiet environment with stable internet</li>
              <li>- The conversation adapts to your responses in real time</li>
              <li>- Some sections include timed challenges — a timer will be visible</li>
              <li>- If disconnected, you can return using your invitation link</li>
            </ul>
          </div>

          {/* Consent */}
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              className="mt-0.5 border-border"
            />
            <span className="text-[11px] text-muted-foreground leading-relaxed">
              I understand that my responses will be recorded and analyzed. I consent to the use of
              AI-adaptive questioning and agree to complete the assessment honestly without external assistance.
            </span>
          </label>

          {/* CTA */}
          <Button
            variant="gold"
            className="w-full h-12 text-sm font-bold uppercase tracking-wider"
            disabled={!consent || loading}
            onClick={handleStart}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Starting Assessment...
              </>
            ) : (
              "Begin Assessment"
            )}
          </Button>

          {error && (
            <p className="text-xs text-red-500 text-center">{error}</p>
          )}
        </div>
      </div>
    </div>
  );
}

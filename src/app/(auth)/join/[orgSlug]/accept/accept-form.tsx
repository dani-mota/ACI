"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { AppUserRole } from "@/lib/rbac";

interface AcceptInviteFormProps {
  token: string;
  orgName: string;
  orgSlug: string;
  role: AppUserRole;
  roleLabel: string;
  prefillName: string;
  email: string;
}

export function AcceptInviteForm({
  token,
  orgName,
  orgSlug,
  role,
  roleLabel,
  prefillName,
  email,
}: AcceptInviteFormProps) {
  const router = useRouter();
  const [name, setName] = useState(prefillName);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const passwordStrength = getPasswordStrength(password);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError("Name is required.");
      return;
    }
    if (password.length < 8 || !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/\d/.test(password)) {
      setError("Password must be at least 8 characters with uppercase, lowercase, and a number.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      // Create the account via our API
      const res = await fetch("/api/team/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, name: name.trim(), password }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to create account.");
        setLoading(false);
        return;
      }

      // Sign in via Supabase client
      const supabase = createSupabaseBrowserClient();
      if (supabase) {
        await supabase.auth.signInWithPassword({ email, password });
      }

      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="bg-card border border-border shadow-lg p-8 relative z-10">
        <div className="text-center mb-6">
          <h1
            className="text-2xl font-bold tracking-tight text-foreground"
            style={{ fontFamily: "var(--font-dm-sans)" }}
          >
            ACI
          </h1>
          <p className="text-[10px] tracking-[0.3em] text-muted-foreground mt-1 uppercase font-mono">
            Arklight Cognitive Index
          </p>
        </div>

        <h2 className="text-lg font-semibold text-foreground mb-1">
          Join {orgName}
        </h2>
        <p className="text-sm text-muted-foreground mb-6">
          You&apos;ve been invited as a <strong className="text-foreground">{roleLabel}</strong>
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 bg-destructive/10 border border-destructive/20 text-xs text-destructive">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              Email
            </label>
            <Input type="email" value={email} disabled className="opacity-60" />
          </div>

          <div>
            <label
              htmlFor="name"
              className="block text-xs font-medium text-foreground mb-1.5 uppercase tracking-wider"
            >
              Name
            </label>
            <Input
              id="name"
              type="text"
              placeholder="Your full name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-xs font-medium text-foreground mb-1.5 uppercase tracking-wider"
            >
              Password
            </label>
            <Input
              id="password"
              type="password"
              placeholder="Minimum 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
            />
            {password.length > 0 && (
              <div className="mt-2 flex gap-1">
                {[1, 2, 3, 4].map((level) => (
                  <div
                    key={level}
                    className={`h-1 flex-1 rounded-full transition-colors ${
                      passwordStrength >= level
                        ? level <= 1
                          ? "bg-red-500"
                          : level <= 2
                            ? "bg-amber-500"
                            : level <= 3
                              ? "bg-blue-500"
                              : "bg-green-500"
                        : "bg-muted"
                    }`}
                  />
                ))}
              </div>
            )}
          </div>

          <div>
            <label
              htmlFor="confirm-password"
              className="block text-xs font-medium text-foreground mb-1.5 uppercase tracking-wider"
            >
              Confirm Password
            </label>
            <Input
              id="confirm-password"
              type="password"
              placeholder="Repeat your password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </div>

          <Button type="submit" variant="gold" className="w-full h-10 text-sm" disabled={loading}>
            {loading ? "Setting up..." : `Join ${orgName}`}
          </Button>
        </form>
      </div>
      <div className="text-center mt-4 text-xs text-white/60 relative z-10">
        Already have an account?{" "}
        <a href="/login" className="text-aci-gold hover:text-aci-gold/80 font-medium">
          Log in
        </a>
      </div>
    </div>
  );
}

function getPasswordStrength(password: string): number {
  if (password.length === 0) return 0;
  let score = 0;
  if (password.length >= 8) score++;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  return score;
}

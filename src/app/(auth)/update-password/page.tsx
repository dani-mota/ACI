"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AuthCard } from "@/components/auth/auth-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function UpdatePasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  // The Supabase browser client automatically picks up the session
  // from the URL hash (#access_token=...) set by the invite/reset link.
  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) return;

    // Listen for the session to be established from the URL hash
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      // Session is now active — nothing to do here, just let the form proceed
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setError("Authentication is not configured. Contact your administrator.");
      setLoading(false);
      return;
    }

    const { error: updateError } = await supabase.auth.updateUser({ password });

    if (updateError) {
      setError(updateError.message);
      setLoading(false);
      return;
    }

    // Sign out immediately — they'll log in fresh with their new credentials
    await supabase.auth.signOut();
    setDone(true);
    setLoading(false);
  };

  if (done) {
    return (
      <AuthCard
        title="Password set"
        subtitle="You can now sign in to ACI"
        footer={null}
      >
        <div className="text-center py-4">
          <div className="w-14 h-14 bg-aci-green/10 border border-aci-green/20 flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-aci-green" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="text-sm font-medium text-foreground mb-2">You&apos;re all set</p>
          <p className="text-xs text-muted-foreground mb-6">
            Your password has been created. Sign in with your email and this password.
          </p>
          <Button
            variant="gold"
            className="w-full h-10 text-sm"
            onClick={() => router.push("/login")}
          >
            Sign In
          </Button>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Create your password"
      subtitle="Set a password to access your ACI account"
      footer={
        <Link href="/login" className="text-aci-gold hover:text-aci-gold/80 font-medium">
          Back to sign in
        </Link>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-aci-red/10 border border-aci-red/20 text-xs text-aci-red">
            {error}
          </div>
        )}
        <div>
          <label htmlFor="password" className="block text-xs font-medium text-foreground mb-1.5 uppercase tracking-wider">
            Password
          </label>
          <Input
            id="password"
            type="password"
            placeholder="At least 8 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <div>
          <label htmlFor="confirm" className="block text-xs font-medium text-foreground mb-1.5 uppercase tracking-wider">
            Confirm password
          </label>
          <Input
            id="confirm"
            type="password"
            placeholder="Repeat your password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
          />
        </div>
        <Button type="submit" variant="gold" className="w-full h-10 text-sm" disabled={loading}>
          {loading ? "Setting password..." : "Set Password"}
        </Button>
      </form>
    </AuthCard>
  );
}

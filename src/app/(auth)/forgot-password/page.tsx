"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { AuthCard } from "@/components/auth/auth-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

function ForgotPasswordForm() {
  const searchParams = useSearchParams();
  const linkExpired = searchParams.get("error") === "link_expired";

  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const email = (e.currentTarget.elements.namedItem("email") as HTMLInputElement).value;

    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setError("Authentication is not configured. Please contact your administrator.");
      setLoading(false);
      return;
    }

    const { error: authError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/update-password`,
    });

    setLoading(false);

    if (authError) {
      setError(authError.message);
      return;
    }

    setSent(true);
  };

  return (
    <AuthCard
      title={sent ? "Check your email" : "Reset your password"}
      subtitle={sent ? "We sent a password reset link to your email" : "Enter your email and we'll send you a reset link"}
      footer={
        <Link href="/login" className="text-aci-gold hover:text-aci-gold/80 font-medium">
          Back to sign in
        </Link>
      }
    >
      {sent ? (
        <div className="text-center py-4">
          <div className="w-14 h-14 bg-aci-green/10 border border-aci-green/20 flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-aci-green" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="text-xs text-muted-foreground">
            Didn&apos;t receive the email? Check your spam folder or{" "}
            <button onClick={() => setSent(false)} className="text-aci-blue hover:underline">try again</button>.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {linkExpired && !error && (
            <div className="p-3 bg-aci-amber/10 border border-aci-amber/20 text-xs text-aci-amber">
              Your setup link has expired. Enter your email to receive a new one.
            </div>
          )}
          {error && (
            <div className="p-3 bg-aci-red/10 border border-aci-red/20 text-xs text-aci-red">
              {error}
            </div>
          )}
          <div>
            <label htmlFor="email" className="block text-xs font-medium text-foreground mb-1.5 uppercase tracking-wider">Email</label>
            <Input id="email" type="email" placeholder="you@company.com" />
          </div>
          <Button type="submit" variant="gold" className="w-full h-10 text-sm" disabled={loading}>
            {loading ? "Sending..." : "Send Reset Link"}
          </Button>
        </form>
      )}
    </AuthCard>
  );
}

export default function ForgotPasswordPage() {
  return (
    <Suspense>
      <ForgotPasswordForm />
    </Suspense>
  );
}

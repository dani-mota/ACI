"use client";

import { useState } from "react";
import Link from "next/link";
import { AuthCard } from "@/components/auth/auth-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function SignupPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const formData = new FormData(e.currentTarget);
      const email = ((formData.get("email") as string) ?? "").trim();
      const firstName = ((formData.get("firstName") as string) ?? "").trim();
      const lastName = ((formData.get("lastName") as string) ?? "").trim();
      const company = ((formData.get("company") as string) ?? "").trim();
      const role = formData.get("role") as string;

      if (!firstName || !lastName || !company || !role || !email) {
        setError("Please fill in all fields.");
        setLoading(false);
        return;
      }

      const res = await fetch("/api/access-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, firstName, lastName, companyName: company, requestedRole: role }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 409 && data.error?.includes("already has an account")) {
          setError(data.error);
        } else {
          setError(data.error ?? "Something went wrong. Please try again.");
        }
        setLoading(false);
        return;
      }

      setSuccess(true);
    } catch {
      setError("Something went wrong. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthCard
      title="Request Access"
      subtitle="Submit a request to join your organization's ACI platform"
      footer={
        <span>
          Already have an account?{" "}
          <Link href="/login" className="text-aci-gold hover:text-aci-gold/80 font-medium">
            Sign in
          </Link>
        </span>
      }
    >
      {success ? (
        <div className="text-center py-4">
          <div className="w-14 h-14 bg-aci-green/10 border border-aci-green/20 flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-aci-green" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="text-sm font-medium text-foreground mb-2">Request submitted</p>
          <p className="text-xs text-muted-foreground">
            An Arklight administrator will review your request and reach out to set up your account.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 bg-aci-red/10 border border-aci-red/20 text-xs text-aci-red">
              {error}{" "}
              {error.includes("already has an account") && (
                <Link href="/login" className="underline font-medium">Sign in</Link>
              )}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="firstName" className="block text-xs font-medium text-foreground mb-1.5 uppercase tracking-wider">First name</label>
              <Input id="firstName" name="firstName" placeholder="Alex" />
            </div>
            <div>
              <label htmlFor="lastName" className="block text-xs font-medium text-foreground mb-1.5 uppercase tracking-wider">Last name</label>
              <Input id="lastName" name="lastName" placeholder="Chen" />
            </div>
          </div>
          <div>
            <label htmlFor="company" className="block text-xs font-medium text-foreground mb-1.5 uppercase tracking-wider">Organization</label>
            <Input id="company" name="company" placeholder="Your company name" />
          </div>
          <div>
            <label htmlFor="role" className="block text-xs font-medium text-foreground mb-1.5 uppercase tracking-wider">Role</label>
            <select
              id="role"
              name="role"
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              defaultValue=""
            >
              <option value="" disabled>Select your role</option>
              <option value="RECRUITER_COORDINATOR">Recruiter</option>
              <option value="RECRUITING_MANAGER">Recruiting Manager</option>
              <option value="HIRING_MANAGER">Hiring Manager</option>
              <option value="TA_LEADER">TA Leader</option>
            </select>
          </div>
          <div>
            <label htmlFor="email" className="block text-xs font-medium text-foreground mb-1.5 uppercase tracking-wider">Work email</label>
            <Input id="email" name="email" type="email" placeholder="you@company.com" />
          </div>
          <Button type="submit" variant="gold" className="w-full h-10 text-sm" disabled={loading}>
            {loading ? "Submitting..." : "Request Access"}
          </Button>
        </form>
      )}
    </AuthCard>
  );
}

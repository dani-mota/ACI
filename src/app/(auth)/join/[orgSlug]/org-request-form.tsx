"use client";

import { useState } from "react";
import Link from "next/link";
import { AuthCard } from "@/components/auth/auth-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface OrgRequestFormProps {
  orgId: string;
  orgName: string;
}

export function OrgRequestForm({ orgId, orgName }: OrgRequestFormProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const formData = new FormData(e.currentTarget);
    const firstName = ((formData.get("firstName") as string) ?? "").trim();
    const lastName = ((formData.get("lastName") as string) ?? "").trim();
    const email = ((formData.get("email") as string) ?? "").trim();
    const jobTitle = ((formData.get("jobTitle") as string) ?? "").trim();
    const reason = ((formData.get("reason") as string) ?? "").trim();

    if (!firstName || !lastName || !email || !jobTitle) {
      setError("Please fill in all required fields.");
      setSubmitting(false);
      return;
    }

    try {
      const res = await fetch("/api/access-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          firstName,
          lastName,
          companyName: orgName,
          requestedRole: "RECRUITER_COORDINATOR",
          jobTitle,
          reason: reason || undefined,
          orgId,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
        setSubmitting(false);
        return;
      }

      setSuccess(true);
    } catch {
      setError("Something went wrong. Please check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthCard
      title={`Request Access to ${orgName}`}
      subtitle="Submit a request to join your team on ACI"
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
            Your access request has been sent to the {orgName} team. You&apos;ll receive an email when your request is reviewed.
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
              <Input id="firstName" name="firstName" placeholder="Alex" required />
            </div>
            <div>
              <label htmlFor="lastName" className="block text-xs font-medium text-foreground mb-1.5 uppercase tracking-wider">Last name</label>
              <Input id="lastName" name="lastName" placeholder="Chen" required />
            </div>
          </div>
          <div>
            <label htmlFor="email" className="block text-xs font-medium text-foreground mb-1.5 uppercase tracking-wider">Work email</label>
            <Input id="email" name="email" type="email" placeholder="you@company.com" required />
          </div>
          <div>
            <label htmlFor="jobTitle" className="block text-xs font-medium text-foreground mb-1.5 uppercase tracking-wider">Job Title</label>
            <Input id="jobTitle" name="jobTitle" placeholder="Your job title" required />
          </div>
          <div>
            <label htmlFor="reason" className="block text-xs font-medium text-foreground mb-1.5 uppercase tracking-wider">
              Reason <span className="text-muted-foreground font-normal normal-case">(optional)</span>
            </label>
            <textarea
              id="reason"
              name="reason"
              className="w-full bg-background border border-border rounded-md p-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-aci-gold resize-none"
              rows={3}
              placeholder="What role will you have? How will you use ACI?"
            />
          </div>
          <Button type="submit" variant="gold" className="w-full h-10 text-sm" disabled={submitting}>
            {submitting ? "Submitting..." : "Request Access"}
          </Button>
        </form>
      )}
    </AuthCard>
  );
}

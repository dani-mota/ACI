"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AuthCard } from "@/components/auth/auth-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function OnboardingForm() {
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [roleTitle, setRoleTitle] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!firstName.trim() || !lastName.trim()) {
      setError("Please enter your first and last name.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          roleTitle: roleTitle.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Something went wrong. Please try again.");
        setLoading(false);
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
      setLoading(false);
    }
  };

  return (
    <AuthCard
      title="Complete your profile"
      subtitle="Just a few details to get you started"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-aci-red/10 border border-aci-red/20 text-xs text-aci-red">
            {error}
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label
              htmlFor="firstName"
              className="block text-xs font-medium text-foreground mb-1.5 uppercase tracking-wider"
            >
              First Name
            </label>
            <Input
              id="firstName"
              type="text"
              placeholder="Jane"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              required
              maxLength={100}
            />
          </div>
          <div>
            <label
              htmlFor="lastName"
              className="block text-xs font-medium text-foreground mb-1.5 uppercase tracking-wider"
            >
              Last Name
            </label>
            <Input
              id="lastName"
              type="text"
              placeholder="Doe"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              required
              maxLength={100}
            />
          </div>
        </div>
        <div>
          <label
            htmlFor="roleTitle"
            className="block text-xs font-medium text-foreground mb-1.5 uppercase tracking-wider"
          >
            Job Title <span className="text-muted-foreground font-normal">(optional)</span>
          </label>
          <Input
            id="roleTitle"
            type="text"
            placeholder="e.g., Recruiting Manager"
            value={roleTitle}
            onChange={(e) => setRoleTitle(e.target.value)}
            maxLength={200}
          />
        </div>
        <Button
          type="submit"
          variant="gold"
          className="w-full h-10 text-sm"
          disabled={loading}
        >
          {loading ? "Setting up..." : "Get Started"}
        </Button>
      </form>
    </AuthCard>
  );
}

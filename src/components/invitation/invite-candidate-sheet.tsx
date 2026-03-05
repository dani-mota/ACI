"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronRight,
  ChevronLeft,
  Send,
  Loader2,
  Compass,
  AlertTriangle,
  Target,
  Clock,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AssessmentPathSelector } from "./assessment-path-selector";
import type { InviteRole } from "./role-selection-card";

type AssessmentPath = "generic" | "role-specific";

interface InviteCandidateSheetProps {
  open: boolean;
  onClose: () => void;
  roles: InviteRole[];
  canCreateRole: boolean;
}

export function InviteCandidateSheet({
  open,
  onClose,
  roles,
  canCreateRole,
}: InviteCandidateSheetProps) {
  const router = useRouter();

  // Flow state
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedPath, setSelectedPath] = useState<AssessmentPath | null>(null);
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [roleSearchQuery, setRoleSearchQuery] = useState("");

  // Form state
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [existingCandidateWarning, setExistingCandidateWarning] = useState(false);

  // Derived values
  const genericRole = roles.find((r) => r.isGeneric);
  const nonGenericRoles = roles.filter((r) => !r.isGeneric);
  const effectiveRoleId =
    selectedPath === "generic" ? genericRole?.id ?? null : selectedRoleId;
  const selectedRole = roles.find((r) => r.id === effectiveRoleId);

  const canProceedStep1 =
    selectedPath === "generic" ||
    (selectedPath === "role-specific" && selectedRoleId !== null);
  const canSubmit =
    firstName.trim() !== "" &&
    lastName.trim() !== "" &&
    email.trim() !== "";

  const resetForm = useCallback(() => {
    setStep(1);
    setSelectedPath(null);
    setSelectedRoleId(null);
    setRoleSearchQuery("");
    setFirstName("");
    setLastName("");
    setEmail("");
    setPhone("");
    setError(null);
    setLoading(false);
    setExistingCandidateWarning(false);
  }, []);

  const handleOpenChange = useCallback(
    (isOpen: boolean) => {
      if (!isOpen) {
        resetForm();
        onClose();
      }
    },
    [resetForm, onClose]
  );

  const handleSelectPath = (path: AssessmentPath) => {
    setSelectedPath(path);
    if (path === "generic") {
      setSelectedRoleId(null);
      setRoleSearchQuery("");
    }
  };

  const checkExistingCandidate = useCallback(async () => {
    const trimmed = email.trim();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setExistingCandidateWarning(false);
      return;
    }
    try {
      const res = await fetch(`/api/candidates?email=${encodeURIComponent(trimmed)}`);
      if (res.ok) {
        const data = await res.json();
        setExistingCandidateWarning(data.exists === true);
      }
    } catch {
      // Silently fail — this is a non-blocking check
    }
  }, [email]);

  const handleSubmit = async () => {
    if (!effectiveRoleId) return;
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim(),
          phone: phone.trim() || undefined,
          roleId: effectiveRoleId,
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        let message = "Failed to send invitation";
        try {
          const data = JSON.parse(text);
          message = data.error || message;
        } catch { /* non-JSON response */ }
        throw new Error(message);
      }

      handleOpenChange(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent
        side="right"
        showCloseButton
        className="w-full max-w-lg flex flex-col gap-0 p-0 sm:max-w-lg"
      >
        {/* Header */}
        <SheetHeader className="px-6 py-4 border-b border-border gap-0">
          <SheetTitle
            className="text-sm font-bold text-foreground uppercase tracking-wider"
            style={{ fontFamily: "var(--font-dm-sans)" }}
          >
            Invite Candidate
          </SheetTitle>
          <SheetDescription className="text-[10px] text-muted-foreground mt-0.5 uppercase tracking-wider">
            Step {step} of 2
          </SheetDescription>
        </SheetHeader>

        {/* Step indicators */}
        <div className="flex gap-1 px-6 py-3 border-b border-border" aria-hidden="true">
          {[1, 2].map((s) => (
            <div
              key={s}
              className={`h-1 flex-1 transition-colors ${
                s <= step ? "bg-aci-gold" : "bg-muted"
              }`}
            />
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          {step === 1 && (
            <AssessmentPathSelector
              selectedPath={selectedPath}
              onSelectPath={handleSelectPath}
              roles={nonGenericRoles}
              selectedRoleId={selectedRoleId}
              onSelectRole={setSelectedRoleId}
              roleSearchQuery={roleSearchQuery}
              onRoleSearchQueryChange={setRoleSearchQuery}
              canCreateRole={canCreateRole}
              hasGenericRole={!!genericRole}
            />
          )}

          {step === 2 && (
            <div className="space-y-6">
              {/* Candidate form */}
              <div className="space-y-4">
                <h3 className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
                  Candidate Information
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label
                      htmlFor="invite-first-name"
                      className="block text-[10px] font-medium text-muted-foreground mb-1 uppercase tracking-wider"
                    >
                      First Name
                    </label>
                    <Input
                      id="invite-first-name"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="John"
                      aria-required="true"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="invite-last-name"
                      className="block text-[10px] font-medium text-muted-foreground mb-1 uppercase tracking-wider"
                    >
                      Last Name
                    </label>
                    <Input
                      id="invite-last-name"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder="Doe"
                      aria-required="true"
                    />
                  </div>
                </div>
                <div>
                  <label
                    htmlFor="invite-email"
                    className="block text-[10px] font-medium text-muted-foreground mb-1 uppercase tracking-wider"
                  >
                    Email
                  </label>
                  <Input
                    id="invite-email"
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setExistingCandidateWarning(false);
                    }}
                    onBlur={checkExistingCandidate}
                    placeholder="john.doe@example.com"
                    aria-required="true"
                  />
                  {existingCandidateWarning && (
                    <div className="flex items-start gap-2 mt-1.5 p-2 bg-amber-50 border border-amber-200 dark:bg-amber-950/30 dark:border-amber-800">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" aria-hidden="true" />
                      <p className="text-[10px] text-amber-700 dark:text-amber-400 leading-relaxed">
                        This candidate has previously been assessed or invited. A new assessment link will be sent.
                      </p>
                    </div>
                  )}
                </div>
                <div>
                  <label
                    htmlFor="invite-phone"
                    className="block text-[10px] font-medium text-muted-foreground mb-1 uppercase tracking-wider"
                  >
                    Phone (Optional)
                  </label>
                  <Input
                    id="invite-phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+1 (555) 000-0100"
                  />
                </div>
              </div>

              {/* Live confirmation summary */}
              <div className="bg-accent/50 border border-border p-4 space-y-3">
                <h3 className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
                  Invitation Summary
                </h3>

                {/* Assessment type */}
                <div className="flex items-center gap-2">
                  {selectedPath === "generic" ? (
                    <div className="w-6 h-6 rounded bg-aci-blue/10 flex items-center justify-center">
                      <Compass className="w-3.5 h-3.5 text-aci-blue" />
                    </div>
                  ) : (
                    <div className="w-6 h-6 rounded bg-aci-green/10 flex items-center justify-center">
                      <Target className="w-3.5 h-3.5 text-aci-green" />
                    </div>
                  )}
                  <div>
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                      Assessment Type
                    </span>
                    <p className="text-xs font-medium text-foreground">
                      {selectedPath === "generic"
                        ? "General Aptitude Screen"
                        : "Role-Specific Assessment"}
                    </p>
                  </div>
                </div>

                {/* Role */}
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                    Role
                  </span>
                  <p className="text-xs font-medium text-foreground">
                    {selectedRole?.name ?? "—"}
                  </p>
                </div>

                {/* Candidate */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                      Candidate
                    </span>
                    <p className="text-xs font-medium text-foreground">
                      {firstName.trim() || lastName.trim()
                        ? `${firstName.trim()} ${lastName.trim()}`.trim()
                        : "—"}
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                      Email
                    </span>
                    <p className="text-xs font-medium text-foreground">
                      {email.trim() || "—"}
                    </p>
                  </div>
                </div>

                {/* Experience description */}
                <div className="border-t border-border pt-3">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                    Candidate Experience
                  </span>
                  <p className="text-[10px] text-muted-foreground mt-0.5 leading-relaxed">
                    {selectedPath === "generic"
                      ? "Recommended for early-career talent, internal assessments, and horizontal promotions. Equal weighting across all 12 constructs with cross-role fit rankings."
                      : "Domain-adaptive assessment with weighted constructs tailored to role requirements. AI follow-up probes target role-relevant areas."}
                  </p>
                </div>

                {/* Link expiry */}
                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                  <Clock className="w-3 h-3" aria-hidden="true" />
                  Assessment link expires in 7 days
                </div>
              </div>

              {/* Error */}
              {error && (
                <div
                  role="alert"
                  className="p-3 bg-aci-red/10 border border-aci-red/20 text-xs text-aci-red"
                >
                  {error}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <SheetFooter className="flex-row items-center justify-between px-6 py-4 border-t border-border mt-0">
          {step > 1 ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setStep(1)}
              disabled={loading}
            >
              <ChevronLeft className="w-3.5 h-3.5 mr-1" />
              Back
            </Button>
          ) : (
            <div />
          )}

          {step === 1 ? (
            <Button
              variant="gold"
              size="sm"
              onClick={() => setStep(2)}
              disabled={!canProceedStep1}
            >
              Next
              <ChevronRight className="w-3.5 h-3.5 ml-1" />
            </Button>
          ) : (
            <Button
              variant="gold"
              size="sm"
              onClick={handleSubmit}
              disabled={loading || !canSubmit}
            >
              {loading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5 mr-1" />
                  Send Invitation
                </>
              )}
            </Button>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

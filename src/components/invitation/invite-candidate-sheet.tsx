"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X, ChevronRight, ChevronLeft, Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RoleSelectionCard } from "./role-selection-card";

interface Role {
  id: string;
  name: string;
  slug: string;
  isGeneric?: boolean;
  compositeWeights: { constructId: string; weight: number }[];
}

interface InviteCandidateSheetProps {
  open: boolean;
  onClose: () => void;
  roles: Role[];
}

export function InviteCandidateSheet({ open, onClose, roles }: InviteCandidateSheetProps) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);

  const selectedRole = roles.find((r) => r.id === selectedRoleId);

  const resetForm = () => {
    setStep(1);
    setFirstName("");
    setLastName("");
    setEmail("");
    setPhone("");
    setSelectedRoleId(null);
    setError(null);
    setLoading(false);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const canProceedStep1 = firstName.trim() && lastName.trim() && email.trim();
  const canProceedStep2 = !!selectedRoleId;

  const handleSubmit = async () => {
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
          roleId: selectedRoleId,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to send invitation");
      }

      handleClose();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 z-50" onClick={handleClose} />

      {/* Sheet */}
      <div className="fixed right-0 top-0 bottom-0 w-full max-w-lg bg-card border-l border-border z-50 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div>
            <h2 className="text-sm font-bold text-foreground uppercase tracking-wider" style={{ fontFamily: "var(--font-dm-sans)" }}>
              Invite Candidate
            </h2>
            <p className="text-[10px] text-muted-foreground mt-0.5 uppercase tracking-wider">
              Step {step} of 3
            </p>
          </div>
          <button onClick={handleClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Step indicators */}
        <div className="flex gap-1 px-6 py-3 border-b border-border">
          {[1, 2, 3].map((s) => (
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
            <div className="space-y-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Candidate Information</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-medium text-muted-foreground mb-1 uppercase tracking-wider">First Name</label>
                  <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="John" />
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-muted-foreground mb-1 uppercase tracking-wider">Last Name</label>
                  <Input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Doe" />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-medium text-muted-foreground mb-1 uppercase tracking-wider">Email</label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="john.doe@example.com" />
              </div>
              <div>
                <label className="block text-[10px] font-medium text-muted-foreground mb-1 uppercase tracking-wider">Phone (Optional)</label>
                <Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1-555-0100" />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Select Role</p>
              <div className="space-y-3">
                {/* Show generic aptitude role first, then org roles */}
                {[...roles].sort((a, b) => (a.isGeneric ? -1 : b.isGeneric ? 1 : 0)).map((role) => (
                  <RoleSelectionCard
                    key={role.id}
                    role={role}
                    selected={selectedRoleId === role.id}
                    onSelect={() => setSelectedRoleId(role.id)}
                  />
                ))}
              </div>

              {/* Generic assessment disclaimer */}
              {selectedRole?.isGeneric && (
                <div className="bg-aci-blue/5 border border-aci-blue/20 p-3 text-[10px] text-muted-foreground leading-relaxed">
                  This assessment measures general cognitive and behavioral aptitude without role-specific context.
                  AI follow-up questions will remain domain-neutral. Results can be compared across all roles
                  via the Role Fit Rankings on the candidate profile.
                </div>
              )}
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Confirm & Send</p>

              <div className="bg-accent/50 border border-border p-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Name</span>
                    <p className="text-xs font-medium text-foreground">{firstName} {lastName}</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Email</span>
                    <p className="text-xs font-medium text-foreground">{email}</p>
                  </div>
                </div>
                {phone && (
                  <div>
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Phone</span>
                    <p className="text-xs font-medium text-foreground">{phone}</p>
                  </div>
                )}
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Role</span>
                  <p className="text-xs font-medium text-foreground">{selectedRole?.name}</p>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Link Expiry</span>
                  <p className="text-xs font-medium text-foreground">7 days from now</p>
                </div>
              </div>

              {error && (
                <div className="p-3 bg-aci-red/10 border border-aci-red/20 text-xs text-aci-red">
                  {error}
                </div>
              )}

              <p className="text-[10px] text-muted-foreground">
                An invitation email will be sent with a unique assessment link. The candidate will have 7 days to complete the assessment.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-border">
          {step > 1 ? (
            <Button variant="outline" size="sm" onClick={() => setStep(step - 1)} disabled={loading}>
              <ChevronLeft className="w-3.5 h-3.5 mr-1" />
              Back
            </Button>
          ) : (
            <div />
          )}

          {step < 3 ? (
            <Button
              variant="gold"
              size="sm"
              onClick={() => setStep(step + 1)}
              disabled={step === 1 ? !canProceedStep1 : !canProceedStep2}
            >
              Next
              <ChevronRight className="w-3.5 h-3.5 ml-1" />
            </Button>
          ) : (
            <Button variant="gold" size="sm" onClick={handleSubmit} disabled={loading}>
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
        </div>
      </div>
    </>
  );
}

"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { TaxonomyCombobox } from "./taxonomy-combobox";

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
}

interface MatchedByEmail {
  id: string;
  name: string;
  email: string;
}

interface TeamApiResponse {
  members: TeamMember[];
  matchedByEmail: MatchedByEmail | null;
}

interface ConvertToEmployeeModalProps {
  assessmentId: string;
  candidateName: string;
  candidateEmail: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConverted?: () => void;
  suggestions: { departments: string[]; roleFamilies: string[] };
}

export function ConvertToEmployeeModal({
  assessmentId,
  candidateName,
  candidateEmail,
  open,
  onOpenChange,
  onConverted,
  suggestions,
}: ConvertToEmployeeModalProps) {
  const router = useRouter();
  const [department, setDepartment] = useState("");
  const [roleFamily, setRoleFamily] = useState("");
  const [managerId, setManagerId] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // PRO-133 PR#2: team-list + User-match status. Single fetch when the
  // modal opens; serves both the manager combobox and the User-match
  // indicator. `/api/team` is the existing endpoint, extended in PR#2 to
  // accept `?matchEmail=` and return the matched User (if any).
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [matchedByEmail, setMatchedByEmail] = useState<MatchedByEmail | null>(null);
  const [teamLoaded, setTeamLoaded] = useState(false);

  useEffect(() => {
    if (!open || teamLoaded) return;
    fetch(`/api/team?matchEmail=${encodeURIComponent(candidateEmail)}`)
      .then((res) => (res.ok ? (res.json() as Promise<TeamApiResponse>) : Promise.reject(res)))
      .then((data) => {
        setMembers(data.members.filter((m) => m.isActive));
        setMatchedByEmail(data.matchedByEmail);
        setTeamLoaded(true);
      })
      .catch(() => {
        // Soft-fail: team list unavailable doesn't block conversion. The
        // user-match indicator just won't render, and managerId stays empty.
        setTeamLoaded(true);
      });
  }, [open, candidateEmail, teamLoaded]);

  const trimmedDept = department.trim();
  const trimmedFamily = roleFamily.trim();
  const canSubmit = trimmedDept.length > 0 && trimmedFamily.length > 0 && !submitting;

  function reset() {
    setDepartment("");
    setRoleFamily("");
    setManagerId("");
    setError(null);
    setSubmitting(false);
    setTeamLoaded(false);
  }

  async function handleConvert() {
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/assessments/${assessmentId}/convert`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          department: trimmedDept,
          roleFamily: trimmedFamily,
          // managerId is silently dropped server-side if no User linkage
          // happens (no User to set it on). Sending it anyway is harmless.
          ...(managerId ? { managerId } : {}),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? "Conversion failed");
        setSubmitting(false);
        return;
      }
      onConverted?.();
      onOpenChange(false);
      reset();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Conversion failed");
      setSubmitting(false);
    }
  }

  function handleCancel() {
    onOpenChange(false);
    reset();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(o) : handleCancel())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Convert this assessment to Employee Mode?</DialogTitle>
          <DialogDescription>
            {candidateName}&apos;s assessment data will be preserved. Evaluative
            outputs (red flags, hiring predictions) will be archived from the
            candidate view.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="space-y-1">
            <label htmlFor="department" className="text-xs font-medium text-foreground">
              Department <span className="text-aci-red">*</span>
            </label>
            <TaxonomyCombobox
              id="department"
              value={department}
              onChange={setDepartment}
              options={suggestions.departments}
              placeholder="e.g. Manufacturing"
              emptyLabel="No departments yet — type to create one"
              disabled={submitting}
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="roleFamily" className="text-xs font-medium text-foreground">
              Role Family <span className="text-aci-red">*</span>
            </label>
            <TaxonomyCombobox
              id="roleFamily"
              value={roleFamily}
              onChange={setRoleFamily}
              options={suggestions.roleFamilies}
              placeholder="e.g. Skilled Trades"
              emptyLabel="No role families yet — type to create one"
              disabled={submitting}
            />
          </div>

          {/* PRO-133 PR#2: optional manager selector. Only meaningful if
              a User account exists for this employee (lazy email-match).
              Server silently drops managerId if no User linkage happens. */}
          <div className="space-y-1">
            <label htmlFor="managerId" className="text-xs font-medium text-foreground">
              Manager <span className="text-muted-foreground">(optional)</span>
            </label>
            <select
              id="managerId"
              value={managerId}
              onChange={(e) => setManagerId(e.target.value)}
              disabled={submitting || !teamLoaded || !matchedByEmail}
              className="w-full h-8 px-2 text-xs bg-background border border-border rounded-sm disabled:opacity-50"
            >
              <option value="">— No manager assigned —</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.email})
                </option>
              ))}
            </select>
          </div>

          {/* PRO-133 PR#2: User-match indicator. Surfaces lazy email-match
              outcome BEFORE submission so the converter knows whether
              self-view linkage will happen. Prevents silent-failure UX. */}
          {teamLoaded && (
            <div className="text-[11px] rounded-sm border px-2 py-1.5">
              {matchedByEmail ? (
                <p className="text-aci-green">
                  ✓ Email matched — will link to User account:{" "}
                  <strong>{matchedByEmail.name}</strong>
                </p>
              ) : (
                <p className="text-aci-amber">
                  ⚠ No matching User account in this org. Self-view will be
                  unavailable for this employee until{" "}
                  <a
                    href="https://linear.app/project-arklight/issue/PRO-182"
                    target="_blank"
                    rel="noopener"
                    className="underline"
                  >
                    PRO-182
                  </a>{" "}
                  (auto-create-User on convert) ships. Manager assignment is
                  also disabled until the User account exists.
                </p>
              )}
            </div>
          )}

          {error && (
            <p className="text-xs text-aci-red" role="alert">
              {error}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel} disabled={submitting}>
            Keep as Candidate Record
          </Button>
          <Button onClick={handleConvert} disabled={!canSubmit}>
            {submitting ? "Converting…" : "Convert to Employee"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

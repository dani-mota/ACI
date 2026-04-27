"use client";

import { useState } from "react";
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
import { Input } from "@/components/ui/input";

interface ConvertToEmployeeModalProps {
  assessmentId: string;
  candidateName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConverted?: () => void;
}

export function ConvertToEmployeeModal({
  assessmentId,
  candidateName,
  open,
  onOpenChange,
  onConverted,
}: ConvertToEmployeeModalProps) {
  const router = useRouter();
  const [department, setDepartment] = useState("");
  const [roleFamily, setRoleFamily] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmedDept = department.trim();
  const trimmedFamily = roleFamily.trim();
  const canSubmit = trimmedDept.length > 0 && trimmedFamily.length > 0 && !submitting;

  function reset() {
    setDepartment("");
    setRoleFamily("");
    setError(null);
    setSubmitting(false);
  }

  async function handleConvert() {
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/assessments/${assessmentId}/convert`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ department: trimmedDept, roleFamily: trimmedFamily }),
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
            <Input
              id="department"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              placeholder="e.g. Manufacturing"
              disabled={submitting}
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="roleFamily" className="text-xs font-medium text-foreground">
              Role Family <span className="text-aci-red">*</span>
            </label>
            <Input
              id="roleFamily"
              value={roleFamily}
              onChange={(e) => setRoleFamily(e.target.value)}
              placeholder="e.g. Skilled Trades"
              disabled={submitting}
            />
          </div>
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

"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ManagerSelect } from "@/components/team/manager-select";

interface Member {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
}

interface EditManagerModalProps {
  open: boolean;
  onClose: () => void;
  target: { id: string; name: string; currentManagerId: string | null } | null;
  members: Member[];
  onSaved: () => void;
}

// PRO-184: per-user manager-edit modal. Opens from the team-management
// row dropdown ("Edit manager"). Single managerId mutation via
// PATCH /api/team/[userId]. Optimistic UI handled by the caller's
// refetch after onSaved fires.
export function EditManagerModal({ open, onClose, target, members, onSaved }: EditManagerModalProps) {
  const [value, setValue] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset value to target's current manager when the modal opens for
  // a new target. Empty string means "no manager assigned."
  useEffect(() => {
    if (open && target) {
      setValue(target.currentManagerId ?? "");
      setError(null);
    }
  }, [open, target]);

  const handleSave = async () => {
    if (!target) return;
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/team/${target.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        // Three-state: empty string → explicit null (unassign), non-empty → set.
        // Never send `undefined` — that would mean "don't change."
        body: JSON.stringify({ managerId: value === "" ? null : value }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? "Failed to update manager");
        setSubmitting(false);
        return;
      }
      onSaved();
      onClose();
      setSubmitting(false);
    } catch {
      setError("Network error");
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? null : onClose())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit manager</DialogTitle>
          <DialogDescription>
            {target ? `Change ${target.name}'s manager. Reassignment is logged.` : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <ManagerSelect
            value={value}
            onChange={setValue}
            members={members.filter((m) => m.id !== target?.id)}
            disabled={submitting}
          />
          {error && (
            <p className="text-xs text-aci-red" role="alert">
              {error}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={submitting}>
            {submitting ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

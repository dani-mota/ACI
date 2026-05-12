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

interface BulkReassignModalProps {
  open: boolean;
  onClose: () => void;
  selectedUsers: Member[];
  members: Member[];
  onSaved: () => void;
}

// PRO-184: bulk manager-reassignment modal. Renders a read-only list
// of the selected users + one ManagerSelect for the target manager.
// Fires PATCH /api/team/managers/bulk with all N assignments at once;
// backend wraps the writes in a single transaction so partial-write
// surprises don't happen. Caller refetches the table after onSaved
// fires and clears the multi-selection.
export function BulkReassignModal({ open, onClose, selectedUsers, members, onSaved }: BulkReassignModalProps) {
  const [value, setValue] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setValue("");
      setError(null);
    }
  }, [open]);

  const handleSave = async () => {
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/team/managers/bulk`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assignments: selectedUsers.map((u) => ({
            userId: u.id,
            managerId: value === "" ? null : value,
          })),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? "Bulk reassignment failed");
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

  // Exclude the selected users themselves from the manager picker —
  // a user cannot be reassigned to be their own manager.
  const selectedIds = new Set(selectedUsers.map((u) => u.id));
  const eligibleManagers = members.filter((m) => !selectedIds.has(m.id));

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? null : onClose())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reassign {selectedUsers.length} reports</DialogTitle>
          <DialogDescription>
            Assign the selected users to a new manager. The operation is atomic — if
            any user fails validation, none are reassigned.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">
              Selected ({selectedUsers.length})
            </p>
            {/* Bounded height so a 50+ user reorg doesn't overflow the modal. */}
            <ul className="max-h-32 overflow-y-auto border border-border rounded-sm p-2 text-xs space-y-0.5">
              {selectedUsers.map((u) => (
                <li key={u.id} className="text-foreground">
                  {u.name} <span className="text-muted-foreground">({u.email})</span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">
              New manager
            </p>
            <ManagerSelect
              value={value}
              onChange={setValue}
              members={eligibleManagers}
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
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={submitting}>
            {submitting ? "Saving…" : `Reassign ${selectedUsers.length}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

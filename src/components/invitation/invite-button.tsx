"use client";

import { useState } from "react";
import { UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InviteCandidateSheet } from "./invite-candidate-sheet";
import type { InviteRole } from "./role-selection-card";

interface InviteButtonProps {
  roles: InviteRole[];
  canCreateRole: boolean;
}

export function InviteButton({ roles, canCreateRole }: InviteButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="blue" size="sm" onClick={() => setOpen(true)} className="gap-1.5">
        <UserPlus className="w-3.5 h-3.5" />
        Assess Candidate
      </Button>
      <InviteCandidateSheet
        open={open}
        onClose={() => setOpen(false)}
        roles={roles}
        canCreateRole={canCreateRole}
      />
    </>
  );
}

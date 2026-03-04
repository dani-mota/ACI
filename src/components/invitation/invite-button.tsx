"use client";

import { useState } from "react";
import { UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InviteCandidateSheet } from "./invite-candidate-sheet";

interface Role {
  id: string;
  name: string;
  slug: string;
  isGeneric?: boolean;
  compositeWeights: { constructId: string; weight: number }[];
}

interface InviteButtonProps {
  roles: Role[];
}

export function InviteButton({ roles }: InviteButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="gold" size="sm" onClick={() => setOpen(true)} className="gap-1.5">
        <UserPlus className="w-3.5 h-3.5" />
        Assess Candidate
      </Button>
      <InviteCandidateSheet
        open={open}
        onClose={() => setOpen(false)}
        roles={roles}
      />
    </>
  );
}

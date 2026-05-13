"use client";

import { InitialsBadge } from "@/components/ui/initials-badge";
import { TruncateWithHover } from "@/components/ui/truncate-with-hover";
import { Mail, Phone, Calendar } from "lucide-react";
import { formatRelativeDate } from "@/lib/format";

interface IdentityCardProps {
  candidate: any;
}

export function IdentityCard({ candidate }: IdentityCardProps) {
  return (
    <div className="bg-card border border-border p-4">
      <div className="flex flex-col items-center text-center">
        <InitialsBadge firstName={candidate.firstName} lastName={candidate.lastName} size="lg" />
        <h2 className="mt-2 text-sm font-semibold text-foreground">
          {candidate.firstName} {candidate.lastName}
        </h2>
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-mono">{candidate.primaryRole.name}</p>
      </div>

      <div className="mt-3 pt-3 border-t border-border space-y-2">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Mail className="w-3.5 h-3.5 shrink-0" />
          <TruncateWithHover
            text={candidate.email}
            className="font-mono text-[11px]"
            contentClassName="font-mono"
          />
        </div>
        {candidate.phone && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Phone className="w-3.5 h-3.5" />
            <span className="font-mono text-[11px]">{candidate.phone}</span>
          </div>
        )}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Calendar className="w-3.5 h-3.5" />
          <span className="text-[11px]">Assessed {formatRelativeDate(new Date(candidate.createdAt))}</span>
        </div>
      </div>
    </div>
  );
}

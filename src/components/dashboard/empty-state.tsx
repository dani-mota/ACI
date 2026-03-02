"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { UserPlus, Sparkles } from "lucide-react";
import { InviteButton } from "@/components/invitation/invite-button";

interface Role {
  id: string;
  name: string;
  slug: string;
  compositeWeights: { constructId: string; weight: number }[];
}

interface EmptyStateProps {
  roles: Role[];
}

export function EmptyState({ roles }: EmptyStateProps) {
  return (
    <div className="bg-card border border-dashed border-border p-12 text-center">
      <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-aci-gold/10 flex items-center justify-center">
        <UserPlus className="w-6 h-6 text-aci-gold" />
      </div>
      <h2
        className="text-lg font-bold text-foreground mb-2"
        style={{ fontFamily: "var(--font-dm-sans)" }}
      >
        Welcome to ACI
      </h2>
      <p className="text-xs text-muted-foreground max-w-md mx-auto mb-6">
        Your assessment dashboard is ready. Start by inviting your first candidate
        or explore the tutorial demo to see ACI in action with sample data.
      </p>
      <div className="flex items-center justify-center gap-3">
        <InviteButton roles={roles} />
        <Link href="/tutorial/dashboard">
          <Button variant="outline" className="gap-2">
            <Sparkles className="w-4 h-4" />
            Explore Tutorial Demo
          </Button>
        </Link>
      </div>
    </div>
  );
}

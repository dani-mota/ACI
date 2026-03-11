"use client";

import Link from "next/link";
import { Plus } from "lucide-react";

export function NewRoleButton() {
  return (
    <Link
      href="/tutorial/roles/new"
      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-border rounded-lg bg-card hover:bg-accent hover:text-foreground text-muted-foreground transition-colors"
    >
      <Plus className="w-3.5 h-3.5" />
      New Role
    </Link>
  );
}

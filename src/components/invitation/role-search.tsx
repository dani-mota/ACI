"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { Search, ArrowRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { RoleSelectionCard, type InviteRole } from "./role-selection-card";

interface RoleSearchProps {
  roles: InviteRole[];
  selectedRoleId: string | null;
  onSelectRole: (roleId: string) => void;
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  canCreateRole: boolean;
}

export function RoleSearch({
  roles,
  selectedRoleId,
  onSelectRole,
  searchQuery,
  onSearchQueryChange,
  canCreateRole,
}: RoleSearchProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Auto-focus search input when mounted
    const timer = setTimeout(() => inputRef.current?.focus(), 100);
    return () => clearTimeout(timer);
  }, []);

  const filteredRoles = roles.filter((role) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      role.name.toLowerCase().includes(q) ||
      (role.description?.toLowerCase().includes(q) ?? false)
    );
  });

  return (
    <div className="space-y-3 mt-3">
      {/* Search input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
        <Input
          ref={inputRef}
          value={searchQuery}
          onChange={(e) => onSearchQueryChange(e.target.value)}
          placeholder="Search roles..."
          aria-label="Search roles"
          type="search"
          className="pl-9 h-8 text-xs"
        />
      </div>

      {/* Role list */}
      <div className="space-y-2 max-h-[240px] overflow-y-auto" role="radiogroup" aria-label="Available roles">
        {filteredRoles.length === 0 ? (
          <div className="text-center py-6" role="status">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
              No roles match &ldquo;{searchQuery}&rdquo;
            </p>
            {canCreateRole && (
              <Link
                href="/roles/new"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] text-aci-gold hover:underline mt-2 inline-block font-medium"
              >
                Create a new role in Role Builder
                <span className="sr-only"> (opens in new tab)</span>
              </Link>
            )}
          </div>
        ) : (
          filteredRoles.map((role) => (
            <RoleSelectionCard
              key={role.id}
              role={role}
              selected={selectedRoleId === role.id}
              onSelect={() => onSelectRole(role.id)}
            />
          ))
        )}
      </div>

      {/* Bottom CTA — only for authorized users when there are results */}
      {canCreateRole && filteredRoles.length > 0 && (
        <Link
          href="/roles/new"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-[10px] text-aci-gold hover:underline font-medium"
        >
          Don&apos;t see the right role? Create one
          <span className="sr-only"> (opens in new tab)</span>
          <ArrowRight className="w-3 h-3" aria-hidden="true" />
        </Link>
      )}
    </div>
  );
}

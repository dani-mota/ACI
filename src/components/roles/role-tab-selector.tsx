"use client";

import Link from "next/link";
import { Grid3X3, Plus } from "lucide-react";
import { useBasePath } from "@/components/base-path-provider";

interface RoleTabSelectorProps {
  roles: { slug: string; name: string }[];
  currentSlug: string;
  canCreateRole?: boolean;
}

export function RoleTabSelector({ roles, currentSlug, canCreateRole }: RoleTabSelectorProps) {
  const basePath = useBasePath();
  return (
    <div className="bg-card border border-border">
      <div className="flex items-center justify-between">
        <div className="flex overflow-x-auto">
          {roles.map((role) => {
            const isActive = role.slug === currentSlug;
            return (
              <Link
                key={role.slug}
                href={`${basePath}/roles/${role.slug}`}
                className={`px-4 py-3 text-[11px] font-medium uppercase tracking-wider transition-colors border-b-2 whitespace-nowrap ${
                  isActive
                    ? "text-aci-gold border-aci-gold bg-aci-gold/5"
                    : "text-muted-foreground border-transparent hover:text-foreground hover:bg-accent/50"
                }`}
              >
                {role.name}
              </Link>
            );
          })}
        </div>
        <div className="flex items-center shrink-0">
          {canCreateRole && (
            <Link
              href={`${basePath}/roles/new`}
              className="flex items-center gap-1 px-3 py-3 text-[10px] font-medium uppercase tracking-wider text-aci-gold hover:bg-aci-gold/5 transition-colors border-r border-border"
            >
              <Plus className="w-3 h-3" />
              New Role
            </Link>
          )}
          <Link
            href={`${basePath}/roles`}
            className="flex items-center gap-1.5 px-4 py-3 text-[10px] font-medium uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
          >
            <Grid3X3 className="w-3.5 h-3.5" />
            Matrix View
          </Link>
        </div>
      </div>
    </div>
  );
}

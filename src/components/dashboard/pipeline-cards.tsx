"use client";

import Link from "next/link";
import { Users, TrendingUp } from "lucide-react";
import { useBasePath } from "@/components/base-path-provider";

interface RolePipeline {
  slug: string;
  name: string;
  total: number;
  recommended: number;
  review: number;
  doNotAdvance: number;
  isCustom?: boolean;
}

interface PipelineCardsProps {
  roles: RolePipeline[];
}

export function PipelineCards({ roles }: PipelineCardsProps) {
  const basePath = useBasePath();
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-3">
      {roles.map((role) => {
        const strongFitPct = role.total > 0 ? Math.round((role.recommended / role.total) * 100) : 0;

        return (
          <Link
            key={role.slug}
            href={`${basePath}/roles/${role.slug}`}
            className="bg-card border border-border p-4 hover:border-aci-gold/30 transition-all group"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-1.5 min-w-0">
                <h3 className="text-xs font-medium text-foreground truncate uppercase tracking-wider group-hover:text-aci-gold transition-colors">
                  {role.name}
                </h3>
                {role.isCustom && (
                  <span className="text-[8px] font-bold uppercase tracking-wider px-1 py-0.5 rounded-sm bg-aci-gold/15 text-aci-gold shrink-0">
                    Custom
                  </span>
                )}
              </div>
              <Users className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            </div>

            <div className="text-2xl font-bold text-foreground font-mono mb-2">{role.total}</div>

            <div className="mb-2">
              <div className="flex items-center justify-between text-[10px] mb-1">
                <span className="text-muted-foreground uppercase tracking-wider">Strong Fit</span>
                <span className="font-mono font-medium text-aci-green flex items-center gap-1">
                  <TrendingUp className="w-3 h-3" />
                  {strongFitPct}%
                </span>
              </div>
              <div className="h-1 bg-muted overflow-hidden">
                <div
                  className="h-full bg-aci-green transition-all duration-500"
                  style={{ width: `${strongFitPct}%` }}
                />
              </div>
            </div>

            <div className="flex gap-3 text-[10px] text-muted-foreground font-mono">
              <span>{role.recommended} pass</span>
              <span>{role.review} review</span>
              <span>{role.doNotAdvance} decline</span>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

"use client";

import { BarChart3, CheckCircle2, XCircle } from "lucide-react";

interface CompositeScore {
  roleSlug: string;
  score: number;
  percentile: number;
  passed: boolean;
  distanceFromCutline: number;
}

interface Role {
  slug: string;
  name: string;
  isGeneric?: boolean;
}

interface RoleFitRankingsProps {
  compositeScores: CompositeScore[];
  roles: Role[];
}

export function RoleFitRankings({ compositeScores, roles }: RoleFitRankingsProps) {
  // Build rankings from composite scores, excluding the generic role
  const rankings = compositeScores
    .map((cs) => {
      const role = roles.find((r) => r.slug === cs.roleSlug);
      if (!role || role.isGeneric) return null;
      return { ...cs, roleName: role.name };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null)
    .sort((a, b) => b.percentile - a.percentile);

  if (rankings.length === 0) return null;

  const maxScore = Math.max(...rankings.map((r) => r.percentile), 1);

  return (
    <div className="bg-card border border-border p-4">
      <div className="flex items-center gap-2 mb-3">
        <BarChart3 className="w-4 h-4 text-aci-gold" />
        <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider">
          Role Fit Rankings
        </h3>
      </div>

      <p className="text-[10px] text-muted-foreground mb-3 leading-relaxed">
        This candidate was assessed with Generic Aptitude. Below shows how their scores
        map across all configured roles in your organization.
      </p>

      <div className="space-y-2">
        {rankings.map((r, i) => (
          <div key={r.roleSlug} className="flex items-center gap-3">
            <span className="text-[10px] font-mono text-muted-foreground w-4 text-right">
              {i + 1}.
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-[11px] font-medium text-foreground truncate">
                  {r.roleName}
                </span>
                <div className="flex items-center gap-1.5">
                  {r.passed ? (
                    <CheckCircle2 className="w-3 h-3 text-aci-green" />
                  ) : (
                    <XCircle className="w-3 h-3 text-aci-red/60" />
                  )}
                  <span className="text-[11px] font-mono font-semibold text-foreground">
                    {r.percentile}th
                  </span>
                </div>
              </div>
              <div className="h-1.5 bg-muted rounded-sm overflow-hidden">
                <div
                  className={`h-full rounded-sm transition-all ${
                    r.passed ? "bg-aci-green" : "bg-aci-amber"
                  }`}
                  style={{ width: `${(r.percentile / maxScore) * 100}%` }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

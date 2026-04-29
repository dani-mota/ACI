/**
 * PRO-135: Role Demand Profiles list page.
 *
 * Single-page server component. Two queries total:
 *   1. List of profiles for the org
 *   2. ONE grouped employee-count query — `SELECT LOWER(roleFamily), COUNT(*)
 *      FROM Assessment WHERE orgId = ? AND assessmentMode = EMPLOYEE GROUP BY
 *      LOWER(roleFamily)`. Per-row counts are then a hash lookup. Avoids N
 *      per-profile COUNT queries that would degrade in production with
 *      meaningful row counts.
 *
 * Multi-match note: if multiple profiles share a `roleFamily`, every row's
 * card shows the full employee count for that family — but only the most
 * recently updated one drives the actual radar overlay (per resolver). The
 * list overstates impact on superseded profiles. UX trade-off acknowledged
 * in the PR description; follow-up if product cares.
 */

import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { canView } from "@/lib/rbac";
import prisma from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { countScoredConstructs, type AuthoringScores } from "@/lib/assessment/role-demand-resolution";

interface ProfileRow {
  id: string;
  name: string;
  roleFamily: string;
  scoredCount: number;
  employeeCount: number;
  updatedAt: string;
}

function formatDate(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default async function RoleProfilesPage() {
  const session = await requireAuth();
  if (!canView(session.user.role, "roleProfiles")) {
    redirect("/dashboard");
  }

  const orgId = session.user.orgId;

  // PRO-135: TWO queries (not N+1). The grouped employee count is a single
  // aggregate over Assessment, joined to Candidate for the orgId scope.
  // LOWER() matches the resolver's case-insensitive resolution rule (data.ts).
  const [profiles, counts] = await Promise.all([
    prisma.roleDemandProfile.findMany({
      where: { orgId, isTemplate: false },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        name: true,
        roleFamily: true,
        constructScores: true,
        updatedAt: true,
      },
    }),
    prisma.$queryRaw<Array<{ family: string; count: bigint }>>`
      SELECT LOWER(a."roleFamily") AS family, COUNT(*)::bigint AS count
      FROM "Assessment" a
      JOIN "Candidate" c ON c."id" = a."candidateId"
      WHERE c."orgId" = ${orgId}
        AND a."assessmentMode" = 'EMPLOYEE'
        AND a."roleFamily" IS NOT NULL
      GROUP BY LOWER(a."roleFamily")
    `,
  ]);

  const countByLowerFamily = new Map(
    counts.map((r) => [r.family, Number(r.count)]),
  );

  const rows: ProfileRow[] = profiles.map((p) => ({
    id: p.id,
    name: p.name,
    roleFamily: p.roleFamily,
    scoredCount: countScoredConstructs(p.constructScores as AuthoringScores),
    employeeCount: countByLowerFamily.get(p.roleFamily.toLowerCase()) ?? 0,
    updatedAt: p.updatedAt.toISOString(),
  }));

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      <header className="flex items-end justify-between gap-3">
        <div>
          <h1
            className="text-xl font-bold text-foreground"
            style={{ fontFamily: "var(--font-dm-sans)" }}
          >
            Role Demand Profiles
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Cognitive demand profiles for each role family. Drives the role-fit overlay on Employee Dossier radars.
          </p>
        </div>
        <Link href="/role-profiles/new">
          <Button>
            <Plus className="w-3.5 h-3.5 mr-1.5" /> New Profile
          </Button>
        </Link>
      </header>

      {rows.length === 0 ? (
        <div className="bg-card border border-border p-10 text-center">
          <p className="text-sm text-foreground">No role demand profiles yet.</p>
          <p className="text-xs text-muted-foreground mt-1">
            Start from a template or author from scratch — every employee whose role family matches a profile will see the demand overlay on their Construct Map.
          </p>
        </div>
      ) : (
        <div className="bg-card border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/30">
              <tr className="text-[10px] uppercase tracking-wider text-muted-foreground">
                <th className="text-left font-medium px-4 py-2.5">Profile Name</th>
                <th className="text-left font-medium px-4 py-2.5">Role Family</th>
                <th className="text-left font-medium px-4 py-2.5">Last Updated</th>
                <th className="text-right font-medium px-4 py-2.5">Employees on Profile</th>
                <th className="text-right font-medium px-4 py-2.5">Completion</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const incomplete = r.scoredCount < 12;
                return (
                  <tr
                    key={r.id}
                    className="border-t border-border hover:bg-accent/30 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/role-profiles/${r.id}/edit`}
                        className="font-medium text-foreground hover:text-aci-gold"
                      >
                        {r.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{r.roleFamily}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatDate(new Date(r.updatedAt))}
                    </td>
                    <td className="px-4 py-3 text-right font-mono">{r.employeeCount}</td>
                    <td className="px-4 py-3 text-right">
                      <span
                        className={`text-[10px] font-mono uppercase tracking-wider ${
                          incomplete ? "text-aci-amber" : "text-muted-foreground"
                        }`}
                      >
                        {r.scoredCount} of 12 scored
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

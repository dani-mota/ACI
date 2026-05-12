"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface DirectReport {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
}

interface MyTeamSectionProps {
  userId: string;
}

// PRO-184: read-only direct-reports view. Sources from
// GET /api/team/[userId]/reports. The endpoint enforces single-hop
// semantic and self-scoping for non-team-management roles, so passing
// `userId === session.user.id` returns just this person's direct
// reports — even if they're a PEOPLE_MANAGER without /settings/team
// access.
export function MyTeamSection({ userId }: MyTeamSectionProps) {
  const [reports, setReports] = useState<DirectReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/team/${userId}/reports`)
      .then(async (res) => {
        if (!res.ok) {
          throw new Error("Failed to load direct reports");
        }
        return res.json() as Promise<{ reports: DirectReport[] }>;
      })
      .then((data) => {
        if (!cancelled) {
          setReports(data.reports);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load");
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  if (loading) {
    return (
      <div className="border border-border rounded-none p-8 text-center text-muted-foreground text-sm">
        Loading direct reports…
      </div>
    );
  }

  if (error) {
    return (
      <div className="border border-border rounded-none p-8 text-center text-aci-red text-sm">
        {error}
      </div>
    );
  }

  if (reports.length === 0) {
    return (
      <div className="border border-border rounded-none p-8 text-center text-muted-foreground text-sm">
        No direct reports assigned to you yet. Reach out to your administrator if you
        expect to see direct reports here.
      </div>
    );
  }

  return (
    <div className="border border-border rounded-none overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {reports.map((r) => (
            <TableRow key={r.id} className={!r.isActive ? "opacity-50" : ""}>
              <TableCell className="font-medium">{r.name}</TableCell>
              <TableCell className="text-muted-foreground">{r.email}</TableCell>
              <TableCell className="text-muted-foreground text-xs">{r.role}</TableCell>
              <TableCell>
                {r.isActive ? (
                  <Badge variant="recommended" className="text-[10px]">
                    Active
                  </Badge>
                ) : (
                  <Badge variant="doNotAdvance" className="text-[10px]">
                    Deactivated
                  </Badge>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

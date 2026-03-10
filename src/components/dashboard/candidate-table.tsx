"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, ChevronUp, ChevronDown, AlertTriangle, Download } from "lucide-react";
import { useBasePath } from "@/components/base-path-provider";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/status-badge";
import { ScoreBar } from "@/components/ui/score-bar";
import { InitialsBadge } from "@/components/ui/initials-badge";
import { formatRelativeDate } from "@/lib/format";
import { downloadCSV } from "@/lib/export";

interface CandidateRow {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  status: string;
  createdAt: string;
  primaryRole: { name: string; slug: string };
  assessment?: {
    durationMinutes?: number;
    compositeScores: { roleSlug: string; percentile: number; passed: boolean }[];
    redFlags: { severity: string }[];
  };
}

interface CandidateTableProps {
  candidates: CandidateRow[];
}

type SortField = "name" | "status" | "role" | "score" | "date";

const STATUS_LABELS: Record<string, string> = {
  RECOMMENDED: "Strong Fit",
  REVIEW_REQUIRED: "Conditional Fit",
  DO_NOT_ADVANCE: "Not a Direct Fit",
  INCOMPLETE: "In Progress",
  SCORING: "Scoring",
};

export function CandidateTable({ candidates }: CandidateTableProps) {
  const router = useRouter();
  const basePath = useBasePath();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchStatus, setBatchStatus] = useState("");
  const [batchLoading, setBatchLoading] = useState(false);

  const roles = useMemo(() => {
    const r = new Set(candidates.map((c) => c.primaryRole.slug));
    return Array.from(r).map((slug) => ({
      slug,
      name: candidates.find((c) => c.primaryRole.slug === slug)!.primaryRole.name,
    }));
  }, [candidates]);

  const getComposite = (c: CandidateRow) => {
    const score = c.assessment?.compositeScores?.find(
      (cs) => cs.roleSlug === c.primaryRole.slug
    );
    return score?.percentile ?? 0;
  };

  const filtered = useMemo(() => {
    let result = [...candidates];

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (c) =>
          c.firstName.toLowerCase().includes(q) ||
          c.lastName.toLowerCase().includes(q) ||
          c.email.toLowerCase().includes(q)
      );
    }

    if (statusFilter) {
      result = result.filter((c) => c.status === statusFilter);
    }

    if (roleFilter) {
      result = result.filter((c) => c.primaryRole.slug === roleFilter);
    }

    result.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "name":
          cmp = `${a.lastName}${a.firstName}`.localeCompare(`${b.lastName}${b.firstName}`);
          break;
        case "status":
          cmp = a.status.localeCompare(b.status);
          break;
        case "role":
          cmp = a.primaryRole.name.localeCompare(b.primaryRole.name);
          break;
        case "score":
          cmp = getComposite(a) - getComposite(b);
          break;
        case "date":
          cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

    return result;
  }, [candidates, search, statusFilter, roleFilter, sortField, sortDir]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortDir === "asc" ? (
      <ChevronUp className="w-3 h-3" />
    ) : (
      <ChevronDown className="w-3 h-3" />
    );
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((c) => c.id)));
    }
  };

  const handleExportCSV = (rows: CandidateRow[]) => {
    const headers = ["Name", "Email", "Role", "Composite", "Status", "Flags", "Date"];
    const csvRows = rows.map((c) => [
      `${c.firstName} ${c.lastName}`,
      c.email,
      c.primaryRole.name,
      String(getComposite(c)),
      STATUS_LABELS[c.status] ?? c.status,
      String(c.assessment?.redFlags?.length ?? 0),
      new Date(c.createdAt).toLocaleDateString(),
    ]);
    downloadCSV("aci-candidates.csv", headers, csvRows);
  };

  const handleBatchStatus = async () => {
    if (!batchStatus || selectedIds.size === 0) return;
    setBatchLoading(true);
    try {
      const res = await fetch("/api/candidates/batch-status", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ candidateIds: Array.from(selectedIds), status: batchStatus }),
      });
      if (res.ok) {
        setSelectedIds(new Set());
        setBatchStatus("");
        router.refresh();
      }
    } finally {
      setBatchLoading(false);
    }
  };

  return (
    <div className="bg-card border border-border" data-tutorial="candidate-table">
      {/* Toolbar */}
      <div className="p-3 border-b border-border flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            placeholder="Search candidates..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-8 text-xs"
          />
        </div>
        <div className="flex gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-8 border border-border pl-2.5 pr-7 text-xs text-foreground bg-card rounded-lg"
          >
            <option value="">All Statuses</option>
            <option value="RECOMMENDED">Strong Fit</option>
            <option value="REVIEW_REQUIRED">Conditional Fit</option>
            <option value="DO_NOT_ADVANCE">Not a Direct Fit</option>
          </select>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="h-8 border border-border pl-2.5 pr-7 text-xs text-foreground bg-card rounded-lg"
          >
            <option value="">All Roles</option>
            {roles.map((r) => (
              <option key={r.slug} value={r.slug}>{r.name}</option>
            ))}
          </select>
          <button
            onClick={() => handleExportCSV(filtered)}
            className="flex items-center gap-1 h-8 px-2.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground border border-border rounded-lg hover:bg-accent transition-colors"
          >
            <Download className="w-3 h-3" />
            CSV
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th className="py-2.5 px-3 w-8">
                <input
                  type="checkbox"
                  checked={filtered.length > 0 && selectedIds.size === filtered.length}
                  onChange={toggleSelectAll}
                  className="border-border w-3 h-3"
                />
              </th>
              <th className="text-left py-2.5 px-4 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                <button onClick={() => handleSort("name")} className="flex items-center gap-1 hover:text-foreground">
                  Candidate <SortIcon field="name" />
                </button>
              </th>
              <th className="text-left py-2.5 px-4 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                <button onClick={() => handleSort("role")} className="flex items-center gap-1 hover:text-foreground">
                  Role <SortIcon field="role" />
                </button>
              </th>
              <th className="text-left py-2.5 px-4 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                <button onClick={() => handleSort("score")} className="flex items-center gap-1 hover:text-foreground">
                  Composite <SortIcon field="score" />
                </button>
              </th>
              <th className="text-left py-2.5 px-4 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                <button onClick={() => handleSort("status")} className="flex items-center gap-1 hover:text-foreground">
                  Status <SortIcon field="status" />
                </button>
              </th>
              <th className="text-left py-2.5 px-4 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                Flags
              </th>
              <th className="text-left py-2.5 px-4 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                <button onClick={() => handleSort("date")} className="flex items-center gap-1 hover:text-foreground">
                  Assessed <SortIcon field="date" />
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((candidate) => {
              const composite = getComposite(candidate);
              const flagCount = candidate.assessment?.redFlags?.length ?? 0;
              const hasCritical = candidate.assessment?.redFlags?.some(f => f.severity === "CRITICAL");
              const isSelected = selectedIds.has(candidate.id);

              return (
                <tr
                  key={candidate.id}
                  className={`border-b border-border/50 hover:bg-accent/50 transition-colors ${isSelected ? "bg-aci-gold/5" : ""}`}
                >
                  <td className="py-2.5 px-3">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelect(candidate.id)}
                      className="border-border w-3 h-3"
                    />
                  </td>
                  <td className="py-2.5 px-4">
                    <Link href={`${basePath}/candidates/${candidate.id}`} className="flex items-center gap-3 group">
                      <InitialsBadge firstName={candidate.firstName} lastName={candidate.lastName} size="sm" />
                      <div>
                        <p className="text-xs font-medium text-foreground group-hover:text-aci-gold transition-colors">
                          {candidate.firstName} {candidate.lastName}
                        </p>
                        <p className="text-[10px] text-muted-foreground font-mono">{candidate.email}</p>
                      </div>
                    </Link>
                  </td>
                  <td className="py-2.5 px-4">
                    <span className="text-xs text-muted-foreground">{candidate.primaryRole.name}</span>
                  </td>
                  <td className="py-2.5 px-4 w-36">
                    <ScoreBar percentile={composite} />
                  </td>
                  <td className="py-2.5 px-4">
                    <StatusBadge status={candidate.status} size="sm" />
                  </td>
                  <td className="py-2.5 px-4">
                    {flagCount > 0 && (
                      <span className={`flex items-center gap-1 text-[10px] font-mono font-medium ${hasCritical ? "text-aci-red" : "text-aci-amber"}`}>
                        <AlertTriangle className="w-3 h-3" />
                        {flagCount}
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 px-4">
                    <span className="text-[10px] text-muted-foreground font-mono">
                      {formatRelativeDate(new Date(candidate.createdAt))}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {filtered.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <p className="text-xs">No candidates found matching your filters.</p>
          </div>
        )}
      </div>

      {/* Footer / Bulk Actions */}
      <div className="p-3 border-t border-border flex items-center justify-between text-[10px] text-muted-foreground font-mono uppercase tracking-wider">
        <span>Showing {filtered.length} of {candidates.length} candidates</span>

        {selectedIds.size > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-foreground font-semibold">{selectedIds.size} selected</span>
            <button
              onClick={() => {
                const selectedCandidates = candidates.filter((c) => selectedIds.has(c.id));
                handleExportCSV(selectedCandidates);
              }}
              className="flex items-center gap-1 px-2.5 py-1 text-muted-foreground border border-border hover:bg-accent transition-colors"
            >
              <Download className="w-3 h-3" />
              Export
            </button>
            <select
              value={batchStatus}
              onChange={(e) => setBatchStatus(e.target.value)}
              className="h-6 border border-border px-2 text-[10px] bg-card text-foreground"
            >
              <option value="">Change Status...</option>
              <option value="RECOMMENDED">Strong Fit</option>
              <option value="REVIEW_REQUIRED">Conditional Fit</option>
              <option value="DO_NOT_ADVANCE">Not a Direct Fit</option>
            </select>
            {batchStatus && (
              <button
                onClick={handleBatchStatus}
                disabled={batchLoading}
                className="px-2.5 py-1 bg-aci-gold text-aci-navy font-semibold hover:bg-aci-gold/90 transition-colors disabled:opacity-50"
              >
                {batchLoading ? "..." : "Apply"}
              </button>
            )}
            <button
              onClick={() => setSelectedIds(new Set())}
              className="px-2 py-1 text-muted-foreground hover:text-foreground transition-colors"
            >
              Clear
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

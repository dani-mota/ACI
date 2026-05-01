"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Search, ChevronUp, ChevronDown } from "lucide-react";
import { useBasePath } from "@/components/base-path-provider";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/status-badge";
import { InitialsBadge } from "@/components/ui/initials-badge";
import { MultiSelect } from "@/components/ui/multi-select";
import { formatRelativeDate } from "@/lib/format";

export interface EmployeeRow {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  primaryRole: { name: string; slug: string };
  assessment?: {
    id: string;
    completedAt: string | null;
    convertedAt: string | null;
    department: string | null;
    roleFamily: string | null;
    employeeStatus: "ACTIVE" | "REASSESSMENT_DUE" | "IN_TRANSITION" | null;
  };
}

interface PeopleTableProps {
  employees: EmployeeRow[];
}

type SortField = "name" | "assessmentDate" | "status";

// Custom Status sort order: most-needs-attention first.
const STATUS_RANK: Record<string, number> = {
  REASSESSMENT_DUE: 0,
  IN_TRANSITION: 1,
  ACTIVE: 2,
};

function SortIcon({
  field,
  sortField,
  sortDir,
}: {
  field: SortField;
  sortField: SortField;
  sortDir: "asc" | "desc";
}) {
  if (sortField !== field) return null;
  return sortDir === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />;
}

export function PeopleTable({ employees }: PeopleTableProps) {
  const basePath = useBasePath();
  const [search, setSearch] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState<string[]>([]);
  const [roleFamilyFilter, setRoleFamilyFilter] = useState<string[]>([]);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sortField, setSortField] = useState<SortField>("assessmentDate");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  // Build filter option lists from data
  const departmentOptions = useMemo(() => {
    const set = new Set<string>();
    for (const e of employees) {
      const d = e.assessment?.department;
      if (d) set.add(d);
    }
    return Array.from(set)
      .sort()
      .map((d) => ({ value: d, label: d }));
  }, [employees]);

  const roleFamilyOptions = useMemo(() => {
    const set = new Set<string>();
    for (const e of employees) {
      const r = e.assessment?.roleFamily;
      if (r) set.add(r);
    }
    return Array.from(set)
      .sort()
      .map((r) => ({ value: r, label: r }));
  }, [employees]);

  const filtered = useMemo(() => {
    let result = [...employees];

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (e) =>
          e.firstName.toLowerCase().includes(q) ||
          e.lastName.toLowerCase().includes(q) ||
          e.email.toLowerCase().includes(q),
      );
    }

    if (departmentFilter.length > 0) {
      result = result.filter(
        (e) => e.assessment?.department && departmentFilter.includes(e.assessment.department),
      );
    }

    if (roleFamilyFilter.length > 0) {
      result = result.filter(
        (e) => e.assessment?.roleFamily && roleFamilyFilter.includes(e.assessment.roleFamily),
      );
    }

    if (dateFrom) {
      const from = new Date(dateFrom).getTime();
      result = result.filter((e) => {
        const t = e.assessment?.completedAt ? new Date(e.assessment.completedAt).getTime() : 0;
        return t >= from;
      });
    }

    if (dateTo) {
      const to = new Date(dateTo).getTime();
      result = result.filter((e) => {
        const t = e.assessment?.completedAt ? new Date(e.assessment.completedAt).getTime() : 0;
        return t <= to;
      });
    }

    result.sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      if (sortField === "name") {
        const aName = `${a.lastName} ${a.firstName}`.toLowerCase();
        const bName = `${b.lastName} ${b.firstName}`.toLowerCase();
        return aName.localeCompare(bName) * dir;
      }
      if (sortField === "assessmentDate") {
        const aT = a.assessment?.completedAt ? new Date(a.assessment.completedAt).getTime() : 0;
        const bT = b.assessment?.completedAt ? new Date(b.assessment.completedAt).getTime() : 0;
        return (aT - bT) * dir;
      }
      // Status: explicit rank order, not alphabetical
      const aRank = STATUS_RANK[a.assessment?.employeeStatus ?? "ACTIVE"] ?? 99;
      const bRank = STATUS_RANK[b.assessment?.employeeStatus ?? "ACTIVE"] ?? 99;
      return (aRank - bRank) * dir;
    });

    return result;
  }, [employees, search, departmentFilter, roleFamilyFilter, dateFrom, dateTo, sortField, sortDir]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir(field === "name" ? "asc" : "desc");
    }
  };

  const totalEmployees = employees.length;

  // Empty state: no employees in org at all
  if (totalEmployees === 0) {
    return (
      <div className="bg-card border border-dashed border-border p-12 text-center">
        <h2 className="text-base font-semibold text-foreground mb-2" style={{ fontFamily: "var(--font-dm-sans)" }}>
          No employees yet.
        </h2>
        <p className="text-xs text-muted-foreground">
          Convert a hired candidate to get started.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Filter toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            placeholder="Search employees..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-8 text-xs"
          />
        </div>

        <MultiSelect
          options={departmentOptions}
          selected={departmentFilter}
          onChange={setDepartmentFilter}
          placeholder="Department"
        />

        <MultiSelect
          options={roleFamilyOptions}
          selected={roleFamilyFilter}
          onChange={setRoleFamilyFilter}
          placeholder="Role family"
        />

        <Input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          className="h-8 text-xs w-[150px]"
          aria-label="Assessment date from"
        />
        <Input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          className="h-8 text-xs w-[150px]"
          aria-label="Assessment date to"
        />
      </div>

      {/* Table */}
      <div className="border border-border bg-card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              <th className="text-left py-2 px-4 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                <button onClick={() => handleSort("name")} className="flex items-center gap-1 hover:text-foreground transition-colors">
                  Name <SortIcon field="name" sortField={sortField} sortDir={sortDir} />
                </button>
              </th>
              <th className="text-left py-2 px-4 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Current Role
              </th>
              <th className="text-left py-2 px-4 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Department
              </th>
              <th className="text-left py-2 px-4 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                <button onClick={() => handleSort("assessmentDate")} className="flex items-center gap-1 hover:text-foreground transition-colors">
                  Assessment Date <SortIcon field="assessmentDate" sortField={sortField} sortDir={sortDir} />
                </button>
              </th>
              <th className="text-left py-2 px-4 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Under-Leverage
              </th>
              <th className="text-left py-2 px-4 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Role Fit
              </th>
              <th className="text-left py-2 px-4 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                <button onClick={() => handleSort("status")} className="flex items-center gap-1 hover:text-foreground transition-colors">
                  Status <SortIcon field="status" sortField={sortField} sortDir={sortDir} />
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((employee) => (
              <tr key={employee.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                <td className="py-2.5 px-4">
                  {/* TODO(PRO-130): /employees/[id] dossier route — currently 404s */}
                  <Link href={`${basePath}/employees/${employee.id}`} className="flex items-center gap-3 group">
                    <InitialsBadge firstName={employee.firstName} lastName={employee.lastName} size="sm" />
                    <div>
                      <p className="text-xs font-medium text-foreground group-hover:text-aci-gold transition-colors">
                        {employee.firstName} {employee.lastName}
                      </p>
                      <p className="text-[10px] text-muted-foreground font-mono">{employee.email}</p>
                    </div>
                  </Link>
                </td>
                <td className="py-2.5 px-4 text-xs text-foreground">{employee.primaryRole.name}</td>
                <td className="py-2.5 px-4 text-xs text-foreground">{employee.assessment?.department ?? "—"}</td>
                <td className="py-2.5 px-4 text-xs text-muted-foreground">
                  {employee.assessment?.completedAt
                    ? formatRelativeDate(new Date(employee.assessment.completedAt))
                    : "—"}
                </td>
                <td className="py-2.5 px-4 text-xs text-muted-foreground">—</td>
                <td className="py-2.5 px-4 text-xs text-muted-foreground">—</td>
                <td className="py-2.5 px-4">
                  <StatusBadge status={employee.assessment?.employeeStatus ?? "ACTIVE"} size="sm" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filtered.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <p className="text-xs">No employees match these filters.</p>
          </div>
        )}
      </div>
    </div>
  );
}

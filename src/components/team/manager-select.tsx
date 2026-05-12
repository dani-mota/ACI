"use client";

// PRO-184: shared manager picker, extracted from the convert-to-employee
// modal's previously-inlined <select>. Single canonical place where the
// "active members, exclude EXTERNAL_COLLABORATOR" filter lives. Both the
// convert flow (initial managerId assignment at conversion time) and the
// /settings/team UI (post-conversion reassignment) consume this same
// component, so the filter logic doesn't drift between surfaces.
//
// Presentational only — no fetching, no internal state beyond what
// React derives from props. Caller passes a pre-fetched members array
// from /api/team (or /api/team?matchEmail=...) and a controlled
// value/onChange pair.

interface ManagerSelectMember {
  id: string;
  name: string;
  email: string;
  // `role` is a string for filter purposes only (we exclude
  // EXTERNAL_COLLABORATOR by string equality). Callers may pass either
  // the AppUserRole enum value or a plain string — both work.
  role: string;
  isActive: boolean;
}

interface ManagerSelectProps {
  value: string;
  onChange: (managerId: string) => void;
  members: ManagerSelectMember[];
  disabled?: boolean;
  placeholder?: string;
  id?: string;
}

export function ManagerSelect({
  value,
  onChange,
  members,
  disabled,
  placeholder = "— No manager assigned —",
  id,
}: ManagerSelectProps) {
  // Filter: active members only, exclude EXTERNAL_COLLABORATOR (the role
  // exists to scope third-party graders out of internal team hierarchy).
  const eligible = members.filter(
    (m) => m.isActive && m.role !== "EXTERNAL_COLLABORATOR"
  );

  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className="w-full h-8 px-2 text-xs bg-background border border-border rounded-sm disabled:opacity-50"
    >
      <option value="">{placeholder}</option>
      {eligible.map((m) => (
        <option key={m.id} value={m.id}>
          {m.name} ({m.email})
        </option>
      ))}
    </select>
  );
}

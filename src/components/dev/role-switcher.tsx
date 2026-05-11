"use client";

import { useState } from "react";
import type { AppUserRole, AppEmployeeUserRole } from "@/lib/rbac";

const CANDIDATE_ROLES: AppUserRole[] = [
  "EXTERNAL_COLLABORATOR",
  "RECRUITER_COORDINATOR",
  "RECRUITING_MANAGER",
  "HIRING_MANAGER",
  "TA_LEADER",
  "ADMIN",
];

const EMPLOYEE_ROLES: AppEmployeeUserRole[] = [
  "EMPLOYEE",
  "PEOPLE_MANAGER",
  "HR_TALENT_LEADER",
  "EXECUTIVE",
];

const CANDIDATE_LABELS: Record<AppUserRole, string> = {
  EXTERNAL_COLLABORATOR: "EC",
  RECRUITER_COORDINATOR: "RC",
  RECRUITING_MANAGER: "RM",
  HIRING_MANAGER: "HM",
  TA_LEADER: "TAL",
  ADMIN: "Admin",
};

const EMPLOYEE_LABELS: Record<AppEmployeeUserRole, string> = {
  EMPLOYEE: "EMP",
  PEOPLE_MANAGER: "PM",
  HR_TALENT_LEADER: "HR_TL",
  EXECUTIVE: "EXEC",
};

interface DevRoleSwitcherProps {
  actualRole: AppUserRole;
  actualEmployeeRole: AppEmployeeUserRole | null;
}

export function DevRoleSwitcher({ actualRole, actualEmployeeRole }: DevRoleSwitcherProps) {
  const [open, setOpen] = useState(false);
  const [currentCandidate, setCurrentCandidate] = useState<AppUserRole | null>(null);
  const [currentEmployee, setCurrentEmployee] = useState<AppEmployeeUserRole | null>(null);

  const displayCandidate = currentCandidate ?? actualRole;
  const displayEmployee = currentEmployee ?? actualEmployeeRole;
  const isImpersonating = currentCandidate !== null || currentEmployee !== null;

  async function impersonate(slot: "candidate" | "employee", role: string | "reset") {
    await fetch("/api/dev/impersonate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slot, role }),
    });
    if (slot === "candidate") {
      setCurrentCandidate(role === "reset" ? null : (role as AppUserRole));
    } else {
      setCurrentEmployee(role === "reset" ? null : (role as AppEmployeeUserRole));
    }
    window.location.reload();
  }

  async function resetAll() {
    await fetch("/api/dev/impersonate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slot: "reset-all", role: "reset" }),
    });
    setCurrentCandidate(null);
    setCurrentEmployee(null);
    window.location.reload();
  }

  return (
    <div className="fixed bottom-4 right-4 z-[9999]">
      {open && (
        <div className="mb-2 bg-zinc-900 border border-yellow-500/40 rounded-lg p-2 shadow-xl max-h-[80vh] overflow-y-auto w-56">
          <div className="text-[10px] font-mono uppercase text-zinc-500 px-3 py-1">Candidate Mode</div>
          {CANDIDATE_ROLES.map((role) => (
            <button
              key={role}
              onClick={() => impersonate("candidate", role)}
              className={`block w-full text-left px-3 py-1.5 rounded text-xs font-mono transition-colors ${
                displayCandidate === role
                  ? "bg-yellow-500/20 text-yellow-300"
                  : "text-zinc-400 hover:text-white hover:bg-zinc-800"
              }`}
            >
              {CANDIDATE_LABELS[role]} — {role}
            </button>
          ))}

          <div className="text-[10px] font-mono uppercase text-zinc-500 px-3 py-1 mt-2 border-t border-zinc-700 pt-2">
            Employee Mode (PRO-133)
          </div>
          <button
            onClick={() => impersonate("employee", "reset")}
            className={`block w-full text-left px-3 py-1.5 rounded text-xs font-mono transition-colors ${
              displayEmployee === null
                ? "bg-yellow-500/20 text-yellow-300"
                : "text-zinc-500 hover:text-white hover:bg-zinc-800"
            }`}
          >
            (none)
          </button>
          {EMPLOYEE_ROLES.map((role) => (
            <button
              key={role}
              onClick={() => impersonate("employee", role)}
              className={`block w-full text-left px-3 py-1.5 rounded text-xs font-mono transition-colors ${
                displayEmployee === role
                  ? "bg-yellow-500/20 text-yellow-300"
                  : "text-zinc-400 hover:text-white hover:bg-zinc-800"
              }`}
            >
              {EMPLOYEE_LABELS[role]} — {role}
            </button>
          ))}

          {isImpersonating && (
            <button
              onClick={resetAll}
              className="block w-full text-left px-3 py-1.5 rounded text-xs font-mono text-red-400 hover:text-red-300 hover:bg-zinc-800 mt-2 border-t border-zinc-700 pt-2"
            >
              Reset both to actual
            </button>
          )}
        </div>
      )}
      <button
        onClick={() => setOpen(!open)}
        className={`px-3 py-1.5 rounded-full text-xs font-mono font-bold shadow-lg transition-colors ${
          isImpersonating
            ? "bg-yellow-500 text-black hover:bg-yellow-400"
            : "bg-zinc-800 text-yellow-400 border border-yellow-500/40 hover:bg-zinc-700"
        }`}
      >
        DEV: {CANDIDATE_LABELS[displayCandidate]}
        {displayEmployee && ` + ${EMPLOYEE_LABELS[displayEmployee]}`}
      </button>
    </div>
  );
}

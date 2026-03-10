"use client";

import { useState } from "react";
import type { AppUserRole } from "@/lib/rbac";

const ROLES: AppUserRole[] = [
  "EXTERNAL_COLLABORATOR",
  "RECRUITER_COORDINATOR",
  "RECRUITING_MANAGER",
  "HIRING_MANAGER",
  "TA_LEADER",
  "ADMIN",
];

const SHORT_LABELS: Record<AppUserRole, string> = {
  EXTERNAL_COLLABORATOR: "EC",
  RECRUITER_COORDINATOR: "RC",
  RECRUITING_MANAGER: "RM",
  HIRING_MANAGER: "HM",
  TA_LEADER: "TAL",
  ADMIN: "Admin",
};

export function DevRoleSwitcher({ actualRole }: { actualRole: AppUserRole }) {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState<AppUserRole | null>(null);

  const displayRole = current ?? actualRole;

  async function switchRole(role: AppUserRole | "reset") {
    await fetch("/api/dev/impersonate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
    if (role === "reset") {
      setCurrent(null);
    } else {
      setCurrent(role);
    }
    window.location.reload();
  }

  return (
    <div className="fixed bottom-4 right-4 z-[9999]">
      {open && (
        <div className="mb-2 bg-zinc-900 border border-yellow-500/40 rounded-lg p-2 shadow-xl">
          {ROLES.map((role) => (
            <button
              key={role}
              onClick={() => switchRole(role)}
              className={`block w-full text-left px-3 py-1.5 rounded text-xs font-mono transition-colors ${
                displayRole === role
                  ? "bg-yellow-500/20 text-yellow-300"
                  : "text-zinc-400 hover:text-white hover:bg-zinc-800"
              }`}
            >
              {SHORT_LABELS[role]} — {role}
            </button>
          ))}
          {current && (
            <button
              onClick={() => switchRole("reset")}
              className="block w-full text-left px-3 py-1.5 rounded text-xs font-mono text-red-400 hover:text-red-300 hover:bg-zinc-800 mt-1 border-t border-zinc-700 pt-1.5"
            >
              Reset to actual role
            </button>
          )}
        </div>
      )}
      <button
        onClick={() => setOpen(!open)}
        className={`px-3 py-1.5 rounded-full text-xs font-mono font-bold shadow-lg transition-colors ${
          current
            ? "bg-yellow-500 text-black hover:bg-yellow-400"
            : "bg-zinc-800 text-yellow-400 border border-yellow-500/40 hover:bg-zinc-700"
        }`}
      >
        DEV: {SHORT_LABELS[displayRole]}
      </button>
    </div>
  );
}

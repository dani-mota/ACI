import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import prisma from "@/lib/prisma";
import type { AppUserRole, AppEmployeeUserRole } from "@/lib/rbac";

export interface AppSession {
  user: {
    id: string;
    supabaseId: string;
    email: string;
    name: string;
    role: AppUserRole;
    /**
     * PRO-133: optional Employee Mode role assigned alongside Candidate Mode `role`.
     * Additive — a user may hold both. Populated by `getSession()` from
     * `User.employeeRole`. Null when the user has no Employee Mode role.
     */
    employeeRole: AppEmployeeUserRole | null;
    /**
     * PRO-189: the User.managerId FK exposed on the session so any
     * "who's my manager" surface (profile page, etc.) doesn't need an
     * extra Prisma lookup. Single-hop only — no recursive team tree.
     */
    managerId: string | null;
    orgId: string;
  };
}

/**
 * Get the current session. Returns null if not authenticated.
 * Use in server components and API routes.
 */
export async function getSession(): Promise<AppSession | null> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;

  const {
    data: { user: supabaseUser },
  } = await supabase.auth.getUser();

  if (!supabaseUser) return null;

  // Look up the Prisma user by supabaseId
  const user = await prisma.user.findUnique({
    where: { supabaseId: supabaseUser.id },
  });

  if (!user || !user.isActive) return null;

  const session: AppSession = {
    user: {
      id: user.id,
      supabaseId: supabaseUser.id,
      email: user.email,
      name: user.name,
      role: user.role as AppUserRole,
      employeeRole: (user.employeeRole as AppEmployeeUserRole | null) ?? null,
      managerId: user.managerId,
      orgId: user.orgId,
    },
  };

  // Dev-mode role impersonation via cookies.
  // PRO-133: __dev_role accepts BOTH Candidate Mode (AppUserRole) and
  // Employee Mode (AppEmployeeUserRole) values. Setting an Employee Mode
  // value populates session.user.employeeRole instead of role.
  // For cross-mode testing (TA_LEADER + HR_TALENT_LEADER simultaneously),
  // also set __dev_employee_role to specify the Employee Mode slot
  // independently — that overrides whatever __dev_role set.
  if (process.env.NODE_ENV === "development") {
    const { cookies } = await import("next/headers");
    const cookieStore = await cookies();
    const rbac = await import("@/lib/rbac");
    const candidateRoleKeys = Object.keys(rbac.MODE_ACCESS);
    const employeeRoleKeys = Object.keys(rbac.EMPLOYEE_MODE_ACCESS);

    const devRole = cookieStore.get("__dev_role")?.value;
    if (devRole) {
      if (candidateRoleKeys.includes(devRole)) {
        session.user.role = devRole as AppUserRole;
      } else if (employeeRoleKeys.includes(devRole)) {
        session.user.employeeRole = devRole as AppEmployeeUserRole;
      }
    }

    const devEmployeeRole = cookieStore.get("__dev_employee_role")?.value;
    if (devEmployeeRole && employeeRoleKeys.includes(devEmployeeRole)) {
      session.user.employeeRole = devEmployeeRole as AppEmployeeUserRole;
    }
  }

  return session;
}

/**
 * Require authentication. Redirects to /login if not authenticated.
 * Use in server components for protected pages.
 */
export async function requireAuth(): Promise<AppSession> {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }
  return session;
}

export type AuthStatus = "unauthenticated" | "needs_onboarding" | "authenticated";

/**
 * Check the full auth status of the current user.
 * - unauthenticated: no Supabase session, OR Prisma user exists but is deactivated
 * - needs_onboarding: Supabase session exists but no Prisma User record yet
 * - authenticated: Supabase session + active Prisma User
 *
 * PRO-172: deactivated users are treated as unauthenticated rather than as
 * onboarding candidates — routing them to /onboarding contradicts the
 * administrator's deactivation intent.
 */
export async function getAuthStatus(): Promise<{ status: AuthStatus }> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { status: "unauthenticated" };

  const {
    data: { user: supabaseUser },
  } = await supabase.auth.getUser();

  if (!supabaseUser) return { status: "unauthenticated" };

  const user = await prisma.user.findUnique({
    where: { supabaseId: supabaseUser.id },
  });

  if (user && user.isActive) return { status: "authenticated" };
  if (user && !user.isActive) return { status: "unauthenticated" };

  return { status: "needs_onboarding" };
}

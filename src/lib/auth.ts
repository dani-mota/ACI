import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import prisma from "@/lib/prisma";
import type { AppUserRole } from "@/lib/rbac";

export interface AppSession {
  user: {
    id: string;
    supabaseId: string;
    email: string;
    name: string;
    role: AppUserRole;
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
      orgId: user.orgId,
    },
  };

  // Dev-mode role impersonation via cookie
  if (process.env.NODE_ENV === "development") {
    const { cookies } = await import("next/headers");
    const cookieStore = await cookies();
    const devRole = cookieStore.get("__dev_role")?.value;
    if (devRole && Object.keys(await import("@/lib/rbac").then((m) => m.ROLE_LEVEL)).includes(devRole)) {
      session.user.role = devRole as AppUserRole;
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
 * - unauthenticated: no Supabase session
 * - needs_onboarding: Supabase session exists but no Prisma User record
 * - authenticated: Supabase session + active Prisma User
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

  return { status: "needs_onboarding" };
}

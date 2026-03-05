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

  return {
    user: {
      id: user.id,
      supabaseId: supabaseUser.id,
      email: user.email,
      name: user.name,
      role: user.role as AppUserRole,
      orgId: user.orgId,
    },
  };
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

export type AuthStatus = "unauthenticated" | "pending" | "rejected" | "approved";

/**
 * Check the full auth status of the current user.
 * Distinguishes between unauthenticated, pending approval, rejected, and approved.
 */
export async function getAuthStatus(): Promise<{ status: AuthStatus }> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { status: "unauthenticated" };

  const {
    data: { user: supabaseUser },
  } = await supabase.auth.getUser();

  if (!supabaseUser) return { status: "unauthenticated" };

  // Check if they have a Prisma User (means they're approved)
  const user = await prisma.user.findUnique({
    where: { supabaseId: supabaseUser.id },
  });
  if (user) return { status: "approved" };

  // Check their access request (by supabaseId first, then by email for org-join requests)
  const request = await prisma.accessRequest.findFirst({
    where: { supabaseId: supabaseUser.id },
    orderBy: { createdAt: "desc" },
  });

  if (request) {
    if (request.status === "REJECTED") return { status: "rejected" };
    return { status: "pending" };
  }

  // Fallback: check by email (org-join requests may not have supabaseId)
  if (supabaseUser.email) {
    const emailRequest = await prisma.accessRequest.findFirst({
      where: { email: supabaseUser.email },
      orderBy: { createdAt: "desc" },
    });
    if (emailRequest?.status === "REJECTED") return { status: "rejected" };
  }

  return { status: "pending" };
}

import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import prisma from "@/lib/prisma";

/**
 * GET /auth/callback
 *
 * Handles the Supabase PKCE code exchange after OAuth sign-in, invite links,
 * or magic links. Supabase redirects here with ?code=xxx. We exchange it for
 * a session, set the session cookies, then route the user:
 *
 * - If they have a Prisma User → go to `next` param (default: /dashboard)
 * - If they don't (new user from invitation) → go to /onboarding
 * - If exchange fails → /forgot-password with error
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const rawNext = searchParams.get("next") ?? "/dashboard";
  // Prevent open redirect: only allow relative paths, reject protocol-relative URLs
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/dashboard";

  if (code) {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          },
        },
      }
    );

    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Check if this user already has a Prisma User record
      const {
        data: { user: supabaseUser },
      } = await supabase.auth.getUser();

      if (supabaseUser) {
        const existingUser = await prisma.user.findUnique({
          where: { supabaseId: supabaseUser.id },
        });

        if (existingUser) {
          // Existing user — go to requested destination
          return NextResponse.redirect(`${origin}${next}`);
        }

        // New user (e.g. first login after invitation) — go to onboarding
        return NextResponse.redirect(`${origin}/onboarding`);
      }

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // If no code or exchange failed, send user to forgot-password so they
  // can generate a fresh link themselves.
  return NextResponse.redirect(`${origin}/forgot-password?error=link_expired`);
}

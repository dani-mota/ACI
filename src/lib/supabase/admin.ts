import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Server-only Supabase client with admin privileges.
// Uses the service_role key — NEVER import this in client components or expose to the browser.
// Lazy-initialized so builds don't fail when SUPABASE_SERVICE_ROLE_KEY is not in .env locally.

let _admin: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (!_admin) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      throw new Error(
        "NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not configured"
      );
    }
    _admin = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return _admin;
}

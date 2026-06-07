import { createClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client. BYPASSES Row Level Security — use ONLY in
 * server-side cron routes and seed scripts, never in code reachable by the
 * browser.
 */
export function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

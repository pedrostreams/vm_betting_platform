import type { SupabaseClient } from "@supabase/supabase-js";

/** A user is an admin if they're in app_admins OR their email is in ADMIN_EMAILS. */
export async function isAdmin(sb: SupabaseClient): Promise<boolean> {
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return false;

  const allow = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (user.email && allow.includes(user.email.toLowerCase())) return true;

  const { data } = await sb.from("app_admins").select("user_id").eq("user_id", user.id).maybeSingle();
  return !!data;
}

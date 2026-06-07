import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * OAuth / magic-link callback. Exchanges the code for a session, then sends the
 * user to onboarding if their profile is incomplete, otherwise to `next`.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("display_name, agreed_terms_at")
          .eq("id", user.id)
          .single();

        const incomplete = !profile?.display_name || !profile?.agreed_terms_at;
        const dest = incomplete ? "/onboarding" : next;
        return NextResponse.redirect(`${origin}${dest}`);
      }
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}

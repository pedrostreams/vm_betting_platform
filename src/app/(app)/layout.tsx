import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin";
import { AppShell } from "@/components/app-shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, agreed_terms_at")
    .eq("id", user.id)
    .single();

  if (!profile?.display_name || !profile?.agreed_terms_at) redirect("/onboarding");

  const admin = await isAdmin(supabase);

  return (
    <AppShell displayName={profile.display_name} isAdmin={admin}>
      {children}
    </AppShell>
  );
}

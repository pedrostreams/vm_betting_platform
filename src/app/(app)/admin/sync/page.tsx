import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin";
import { AdminSync } from "@/components/admin-sync";

// Jobs run synchronously in the action; allow up to a minute like the cron route.
export const maxDuration = 60;

export default async function AdminSyncPage() {
  const supabase = await createClient();
  if (!(await isAdmin(supabase))) redirect("/");

  return <AdminSync />;
}

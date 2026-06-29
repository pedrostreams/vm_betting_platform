import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { adminClient } from "@/lib/supabase/admin";
import { isAdmin } from "@/lib/admin";
import { getSummaryStatus } from "@/lib/summary";
import { AdminSync } from "@/components/admin-sync";
import { AdminEmail } from "@/components/admin-email";

// Jobs run synchronously in the action; allow up to a minute like the cron route.
export const maxDuration = 60;

export default async function AdminSyncPage() {
  const supabase = await createClient();
  if (!(await isAdmin(supabase))) redirect("/");

  // Service role: summary_sends has no client read policy by design.
  const { lastSend, sentToday } = await getSummaryStatus(adminClient());

  return (
    <div className="space-y-8">
      <AdminSync />
      <AdminEmail lastSend={lastSend} sentToday={sentToday} />
    </div>
  );
}

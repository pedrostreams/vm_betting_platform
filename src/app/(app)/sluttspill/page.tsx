import { createClient } from "@/lib/supabase/server";
import { loadMatches, loadUserPicks } from "@/lib/queries";
import { KnockoutEditor } from "@/components/knockout-editor";

export default async function SluttspillPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [allMatches, picks] = await Promise.all([
    loadMatches(supabase),
    loadUserPicks(supabase, user!.id),
  ]);
  const matches = allMatches.filter((m) => m.stage !== "GROUP_STAGE");

  return <KnockoutEditor matches={matches} initialPicks={picks} userId={user!.id} />;
}

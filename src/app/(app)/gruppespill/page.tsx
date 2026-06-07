import { createClient } from "@/lib/supabase/server";
import { loadMatches, loadUserPicks } from "@/lib/queries";
import { GroupStageEditor } from "@/components/group-stage-editor";

export default async function GruppespillPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [matches, picks] = await Promise.all([
    loadMatches(supabase, { stage: "GROUP_STAGE" }),
    loadUserPicks(supabase, user!.id),
  ]);

  return <GroupStageEditor matches={matches} initialPicks={picks} userId={user!.id} />;
}

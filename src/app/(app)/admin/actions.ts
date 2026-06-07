"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { adminClient } from "@/lib/supabase/admin";
import { isAdmin } from "@/lib/admin";
import { gradeAll } from "@/lib/scoring";

export async function setSpecialResult(
  betTypeId: string,
  candidate: string,
): Promise<{ error?: string }> {
  const supabase = await createClient();
  if (!(await isAdmin(supabase))) return { error: "Ikke tilgang." };

  // Service role: special_bet_results has no client write policy by design.
  const { error } = await adminClient()
    .from("special_bet_results")
    .upsert(
      { bet_type_id: betTypeId, winning_candidate: candidate, decided_at: new Date().toISOString() },
      { onConflict: "bet_type_id" },
    );
  if (error) return { error: error.message };

  revalidatePath("/admin");
  return {};
}

export async function runGrading(): Promise<{ error?: string; users?: number }> {
  const supabase = await createClient();
  if (!(await isAdmin(supabase))) return { error: "Ikke tilgang." };

  try {
    const { users } = await gradeAll(adminClient());
    revalidatePath("/admin");
    return { users };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

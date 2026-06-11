"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { adminClient } from "@/lib/supabase/admin";
import { isAdmin } from "@/lib/admin";
import { gradeAll } from "@/lib/scoring";
import { syncTournament } from "@/lib/ingest/tournament";
import { syncOdds } from "@/lib/ingest/odds";
import { makeLogCollector, type LogLine } from "@/lib/ingest/log";

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

export type SyncJob = "sync-tournament" | "odds" | "grade" | "all";

export interface SyncRunResult {
  ms: number;
  log: LogLine[];
  error?: string;
}

/**
 * Run an ingest job manually from the admin "Synkronisering" page. Same code
 * path as the daily cron, but threads a logger so the UI can show what was
 * fetched and changed. Admin-gated; jobs run with the service role.
 */
export async function runSync(job: SyncJob): Promise<SyncRunResult> {
  const supabase = await createClient();
  if (!(await isAdmin(supabase))) return { ms: 0, log: [], error: "Ikke tilgang." };

  const sb = adminClient();
  const { lines, log } = makeLogCollector();
  const started = Date.now();

  try {
    if (job === "sync-tournament" || job === "all") {
      log("info", "▶ Synkroniserer turnering");
      await syncTournament(sb, log);
    }
    if (job === "odds" || job === "all") {
      log("info", "▶ Henter odds");
      try {
        await syncOdds(sb, log);
      } catch (e) {
        // Odds are non-critical (decision-support snacks), mirror the cron route.
        log("error", `Odds feilet (ikke kritisk): ${(e as Error).message}`);
      }
    }
    if (job === "grade" || job === "all") {
      log("info", "▶ Kjører poengberegning");
      await gradeAll(sb, log);
    }
    log("ok", `Ferdig på ${((Date.now() - started) / 1000).toFixed(1)}s`);
    revalidatePath("/admin/sync");
    return { ms: Date.now() - started, log: lines };
  } catch (e) {
    log("error", (e as Error).message);
    return { ms: Date.now() - started, log: lines, error: (e as Error).message };
  }
}

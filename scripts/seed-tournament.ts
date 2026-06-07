// One-off (and re-runnable) seed: pull teams, squads and the 104-match schedule
// from football-data.org into Supabase.
//
//   npx tsx --env-file=.env.local scripts/seed-tournament.ts

import { createClient } from "@supabase/supabase-js";
import { syncTournament } from "@/lib/ingest/tournament";

async function main() {
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
  const r = await syncTournament(sb);
  console.log(`[seed] teams=${r.teams} players=${r.players} matches=${r.matches}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

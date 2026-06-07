// One-shot local ingest for development.
// Loops over every season where is_current=true in the `seasons` table.
// Usage: npm run ingest:once

import { runAllActiveSeasons } from "../lib/ingest/all-seasons";
import { recomputeAllUserFormulas } from "../lib/formulas/compute";

async function main() {
  const result = await runAllActiveSeasons();
  console.log("\nMulti-season ingest summary:");
  console.log(`  ${result.seasons.length} seasons, ${result.total_players} players, ${result.total_stats} stats, ${result.total_duration_ms}ms`);
  if (result.errors.length) console.log("  errors:", result.errors);

  for (const s of result.seasons) {
    const fSum = await recomputeAllUserFormulas(s.season_id);
    console.log(`  formulas season ${s.season_id}:`, fSum);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

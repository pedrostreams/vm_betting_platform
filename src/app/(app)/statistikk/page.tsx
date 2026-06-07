import { createClient } from "@/lib/supabase/server";
import { loadTeamInsights } from "@/lib/insights";
import { groupLabel } from "@/lib/format";
import { StatsExplorer, type Row } from "@/components/stats-explorer";

export default async function StatistikkPage() {
  const supabase = await createClient();

  const [insights, { data: teams }, { data: stats }] = await Promise.all([
    loadTeamInsights(supabase),
    supabase.from("teams").select("id, name, group_code"),
    supabase.from("team_stats").select("team_id, top_players, stats"),
  ]);

  const nameById = new Map((teams ?? []).map((t) => [t.id, t.name]));
  const groupById = new Map((teams ?? []).map((t) => [t.id, groupLabel(t.group_code)]));
  const statsById = new Map((stats ?? []).map((s) => [s.team_id, s]));

  // Team rows: every stored Sofascore stat, flattened.
  const teamRows: Row[] = (teams ?? [])
    .map((t) => {
      const s = statsById.get(t.id)?.stats as Record<string, number> | undefined;
      if (!s) return null;
      return {
        team: t.name,
        group: groupLabel(t.group_code),
        titleProb: insights[t.id]?.titleProb ?? null,
        ...s,
      } as Row;
    })
    .filter((r): r is Row => r !== null);

  // Player rows: every squad player with every stat category.
  const playerRows: Row[] = [];
  for (const s of stats ?? []) {
    const team = nameById.get(s.team_id) ?? "—";
    const group = groupById.get(s.team_id) ?? "";
    for (const p of (s.top_players ?? []) as Record<string, number | string | null>[]) {
      if (!p.name) continue;
      const { name, position, ...rest } = p;
      playerRows.push({ player: String(name), team, group, position: (position as string) ?? null, ...rest } as Row);
    }
  }

  return <StatsExplorer teamRows={teamRows} playerRows={playerRows} />;
}

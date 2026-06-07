import { cn } from "@/lib/utils";
import type { MatchView, Team } from "@/lib/types";
import type { TeamInsight } from "@/lib/insights";
import { TeamBadge } from "@/components/team-badge";
import { impliedProbabilities } from "@/lib/format";

const FORM_COLOR: Record<"W" | "D" | "L", string> = {
  W: "bg-[var(--win)] text-[var(--win-foreground)]",
  D: "bg-[var(--draw)] text-[var(--draw-foreground)]",
  L: "bg-[var(--loss)] text-[var(--loss-foreground)]",
};

function TeamInsightBlock({ team, insight }: { team: Team | null; insight?: TeamInsight }) {
  if (!team) return null;
  return (
    <div className="space-y-2 rounded-lg border p-3">
      <div className="flex items-center justify-between gap-2">
        <TeamBadge team={team} size={20} className="min-w-0 font-medium" />
        {insight?.titleProb != null && (
          <span className="shrink-0 rounded bg-primary/10 px-1.5 py-0.5 text-xs font-semibold tabular-nums text-primary">
            {(insight.titleProb * 100).toFixed(insight.titleProb < 0.1 ? 1 : 0)}% VM
          </span>
        )}
      </div>

      <div className="flex items-center gap-3 text-xs text-muted-foreground tabular-nums">
        {insight && insight.squadSize > 0 && <span>{insight.squadSize} spillere</span>}
        {insight?.avgAge != null && <span>⌀ {insight.avgAge.toFixed(1)} år</span>}
      </div>

      {insight && insight.form.recent.length > 0 ? (
        <div className="flex items-center gap-1">
          {insight.form.recent.map((r, i) => (
            <span
              key={i}
              className={cn(
                "grid size-5 place-items-center rounded text-[10px] font-bold",
                FORM_COLOR[r],
              )}
              title={`${insight.form.gf}–${insight.form.ga} mål i VM`}
            >
              {r === "W" ? "S" : r === "D" ? "U" : "T"}
            </span>
          ))}
          <span className="ml-1 text-xs text-muted-foreground tabular-nums">
            {insight.form.gf}–{insight.form.ga}
          </span>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground/70">Ingen VM-kamper spilt ennå</p>
      )}

      {insight?.detail && (
        <div className="space-y-1 border-t pt-2">
          <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
            <Stat label="Mål/kamp" value={insight.detail.goalsPerMatch?.toFixed(1)} />
            <Stat label="Baklengs/kamp" value={insight.detail.concededPerMatch?.toFixed(1)} />
            <Stat label="Besittelse" value={pct(insight.detail.possession)} />
            <Stat label="Skudd/kamp" value={insight.detail.shotsPerMatch?.toFixed(1)} />
            <Stat label="Pasning" value={pct(insight.detail.passPct)} />
            <Stat label="Rating" value={insight.detail.rating?.toFixed(2)} />
          </div>
          <p className="text-[10px] text-muted-foreground/70">
            {insight.detail.source} · {insight.detail.matches} kamper
          </p>
        </div>
      )}

      {insight && insight.keyPlayers.length > 0 && (
        <div className="space-y-1 border-t pt-2">
          <p className="text-[11px] font-medium text-muted-foreground">Nøkkelspillere</p>
          {insight.keyPlayers.map((p) => (
            <div key={p.name} className="flex items-center gap-2 text-xs">
              <span className="flex-1 truncate">{p.name}</span>
              <span className="shrink-0 tabular-nums text-muted-foreground">
                {(p.goals ?? 0) > 0 && `${p.goals}M`}
                {(p.goals ?? 0) > 0 && (p.assists ?? 0) > 0 && " "}
                {(p.assists ?? 0) > 0 && `${p.assists}A`}
              </span>
              {p.rating != null && (
                <span
                  className={cn(
                    "shrink-0 rounded px-1 py-0.5 text-[10px] font-semibold tabular-nums",
                    p.rating >= 7.5
                      ? "bg-[var(--win)] text-[var(--win-foreground)]"
                      : p.rating >= 7
                        ? "bg-[var(--draw)] text-[var(--draw-foreground)]"
                        : "bg-secondary text-muted-foreground",
                  )}
                >
                  {p.rating.toFixed(2)}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function pct(v: number | null | undefined): string | undefined {
  return v == null ? undefined : `${Math.round(v)}%`;
}

function Stat({ label, value }: { label: string; value: string | undefined }) {
  if (value == null) return null;
  return (
    <div className="flex items-baseline justify-between gap-1">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums">{value}</span>
    </div>
  );
}

export function MatchStatsPanel({
  match,
  insights,
}: {
  match: MatchView;
  insights: Record<number, TeamInsight>;
}) {
  const probs = impliedProbabilities(
    match.odds?.home_odds ?? null,
    match.odds?.draw_odds ?? null,
    match.odds?.away_odds ?? null,
  );

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-semibold">Statistikk</h2>

      {probs ? (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">Implisitt sannsynlighet (fra odds)</p>
          <div className="flex h-2.5 overflow-hidden rounded-full">
            <div className="bg-[var(--chart-1)]" style={{ width: `${probs.home * 100}%` }} />
            <div className="bg-[var(--draw)]" style={{ width: `${probs.draw * 100}%` }} />
            <div className="bg-[var(--chart-2)]" style={{ width: `${probs.away * 100}%` }} />
          </div>
          <div className="flex justify-between text-xs tabular-nums text-muted-foreground">
            <span>{Math.round(probs.home * 100)}% H</span>
            <span>{Math.round(probs.draw * 100)}% U</span>
            <span>{Math.round(probs.away * 100)}% B</span>
          </div>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">Odds ikke tilgjengelig ennå.</p>
      )}

      <div className="space-y-2">
        <TeamInsightBlock team={match.home} insight={match.home ? insights[match.home.id] : undefined} />
        <TeamInsightBlock team={match.away} insight={match.away ? insights[match.away.id] : undefined} />
      </div>

      <p className="text-[11px] text-muted-foreground/70">
        VM-vinnerodds fra Polymarket · form fra spilte VM-kamper
      </p>
    </div>
  );
}

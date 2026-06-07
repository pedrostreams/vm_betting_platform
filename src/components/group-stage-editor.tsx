"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { MatchView, Pick } from "@/lib/types";
import { TeamBadge } from "@/components/team-badge";
import { MatchStatsPanel } from "@/components/match-stats-panel";
import type { TeamInsight } from "@/lib/insights";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { formatKickoff, groupLabel } from "@/lib/format";
import { toast } from "sonner";
import { Check, Lock, ChevronRight, CircleDot } from "lucide-react";

type Picks = Record<number, Pick>;

function outcomeOf(m: MatchView): Pick | null {
  if (m.home_score == null || m.away_score == null) return null;
  if (m.home_score > m.away_score) return "H";
  if (m.home_score < m.away_score) return "B";
  return "U";
}

function countdown(lockIso: string, now: number): string {
  const ms = new Date(lockIso).getTime() - now;
  if (ms <= 0) return "Låst";
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (d > 0) return `Låses om ${d}d ${h}t`;
  if (h > 0) return `Låses om ${h}t ${m}m`;
  return `Låses om ${m}m ${sec}s`;
}

export function GroupStageEditor({
  matches,
  initialPicks,
  userId,
  insights,
}: {
  matches: MatchView[];
  initialPicks: Picks;
  userId: string;
  insights: Record<number, TeamInsight>;
}) {
  const supabase = createClient();
  const [picks, setPicks] = useState<Picks>(initialPicks);
  const [now, setNow] = useState(() => Date.now());
  const [selectedId, setSelectedId] = useState<number>(() => {
    const firstUnpicked = matches.find((m) => !initialPicks[m.id]);
    return (firstUnpicked ?? matches[0])?.id;
  });

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const groups = useMemo(() => {
    const map = new Map<string, MatchView[]>();
    for (const m of matches) {
      const key = m.group_code ?? "—";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(m);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [matches]);

  const selected = matches.find((m) => m.id === selectedId) ?? null;
  const pickedCount = matches.filter((m) => picks[m.id]).length;
  const total = matches.length;

  const isLocked = (m: MatchView) => new Date(m.lock_at).getTime() <= now;

  async function choose(m: MatchView, pick: Pick) {
    if (isLocked(m)) return toast.error("Kampen er låst.");
    const prev = picks[m.id];
    setPicks((p) => ({ ...p, [m.id]: pick })); // optimistic
    const { error } = await supabase
      .from("predictions")
      .upsert({ user_id: userId, match_id: m.id, pick, updated_at: new Date().toISOString() }, { onConflict: "user_id,match_id" });
    if (error) {
      setPicks((p) => ({ ...p, [m.id]: prev })); // revert
      toast.error("Kunne ikke lagre tipset.");
    }
  }

  function selectNextUnpicked() {
    const next = matches.find((m) => !picks[m.id] && !isLocked(m));
    if (next) setSelectedId(next.id);
    else toast.success("Alle åpne kamper er tippet! 🎉");
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Gruppespill</h1>
          <p className="text-sm text-muted-foreground">
            Tipp H/U/B på alle kamper. Hver kamp låses 15 min før avspark.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm tabular-nums text-muted-foreground">
            {pickedCount} / {total} tippet
          </span>
          <div className="w-32">
            <Progress value={(pickedCount / total) * 100} />
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[16rem_1fr_18rem]">
        {/* LEFT — group/match navigator */}
        <aside className="rounded-xl border bg-card lg:sticky lg:top-[4.5rem] lg:h-[calc(100dvh-6rem)]">
          <ScrollArea className="h-full p-2">
            {groups.map(([code, ms]) => {
              const done = ms.filter((m) => picks[m.id]).length;
              return (
                <div key={code} className="mb-2">
                  <div className="flex items-center justify-between px-2 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <span>{groupLabel(code)}</span>
                    <span className="tabular-nums">{done}/{ms.length}</span>
                  </div>
                  <div className="space-y-0.5">
                    {ms.map((m) => {
                      const picked = picks[m.id];
                      const locked = isLocked(m);
                      const active = m.id === selectedId;
                      return (
                        <button
                          key={m.id}
                          onClick={() => setSelectedId(m.id)}
                          className={cn(
                            "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors",
                            active ? "bg-secondary" : "hover:bg-secondary/50",
                          )}
                        >
                          <span className="flex size-4 shrink-0 items-center justify-center">
                            {locked ? (
                              <Lock className="size-3.5 text-muted-foreground" />
                            ) : picked ? (
                              <Check className="size-3.5 text-primary" />
                            ) : (
                              <CircleDot className="size-3.5 text-muted-foreground/40" />
                            )}
                          </span>
                          <span className="flex min-w-0 flex-1 items-center gap-1 truncate">
                            <span className="truncate">{m.home?.name ?? m.home?.tla ?? "TBD"}</span>
                            <span className="text-muted-foreground">–</span>
                            <span className="truncate">{m.away?.name ?? m.away?.tla ?? "TBD"}</span>
                          </span>
                          {picked && (
                            <span className="ml-auto rounded bg-primary/10 px-1 text-xs font-semibold text-primary">
                              {picked}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </ScrollArea>
        </aside>

        {/* CENTER — pick canvas */}
        <section className="min-h-[24rem] rounded-xl border bg-card p-5">
          {selected ? (
            <MatchCanvas
              key={selected.id}
              match={selected}
              pick={picks[selected.id] ?? null}
              locked={isLocked(selected)}
              countdownLabel={countdown(selected.lock_at, now)}
              onChoose={(p) => choose(selected, p)}
              onNext={selectNextUnpicked}
            />
          ) : (
            <p className="text-muted-foreground">Ingen kamper.</p>
          )}
        </section>

        {/* RIGHT — stats */}
        <aside className="hidden rounded-xl border bg-card p-4 lg:block">
          {selected && <MatchStatsPanel match={selected} insights={insights} />}
        </aside>
      </div>
    </div>
  );
}

function MatchCanvas({
  match,
  pick,
  locked,
  countdownLabel,
  onChoose,
  onNext,
}: {
  match: MatchView;
  pick: Pick | null;
  locked: boolean;
  countdownLabel: string;
  onChoose: (p: Pick) => void;
  onNext: () => void;
}) {
  const finished = match.status === "FINISHED" && outcomeOf(match) != null;
  const actual = outcomeOf(match);
  const odds = match.odds;

  const options: { key: Pick; label: string; odds: number | null }[] = [
    { key: "H", label: match.home?.name ?? "Hjemme", odds: odds?.home_odds ?? null },
    { key: "U", label: "Uavgjort", odds: odds?.draw_odds ?? null },
    { key: "B", label: match.away?.name ?? "Borte", odds: odds?.away_odds ?? null },
  ];

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <span>{groupLabel(match.group_code)}</span>
        <span
          className={cn(
            "flex items-center gap-1",
            locked ? "text-muted-foreground" : "text-primary",
          )}
        >
          {locked && <Lock className="size-3" />}
          {countdownLabel}
        </span>
      </div>

      <div className="mt-4 flex items-center justify-center gap-4 text-center">
        <div className="flex flex-1 flex-col items-center gap-2">
          <TeamBadge team={match.home} size={44} showName={false} />
          <span className="text-sm font-medium">{match.home?.name ?? "TBD"}</span>
        </div>
        <div className="text-center">
          {finished ? (
            <span className="text-3xl font-semibold tabular-nums">
              {match.home_score}–{match.away_score}
            </span>
          ) : (
            <span className="text-sm text-muted-foreground">{formatKickoff(match.utc_date)}</span>
          )}
        </div>
        <div className="flex flex-1 flex-col items-center gap-2">
          <TeamBadge team={match.away} size={44} showName={false} />
          <span className="text-sm font-medium">{match.away?.name ?? "TBD"}</span>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-3 gap-2">
        {options.map((o) => {
          const selected = pick === o.key;
          const isResult = finished && actual === o.key;
          return (
            <button
              key={o.key}
              disabled={locked}
              onClick={() => onChoose(o.key)}
              className={cn(
                "group flex flex-col items-center gap-1 rounded-lg border-2 px-3 py-3 transition-all",
                "disabled:cursor-not-allowed",
                selected
                  ? "border-primary bg-primary/10"
                  : "border-border hover:border-primary/40 hover:bg-secondary/50",
                isResult && "ring-2 ring-win/60",
              )}
            >
              <span
                className={cn(
                  "text-lg font-bold",
                  selected ? "text-primary" : "text-foreground",
                )}
              >
                {o.key}
              </span>
              <span className="line-clamp-1 text-xs text-muted-foreground">{o.label}</span>
              <span className="text-sm font-semibold tabular-nums">
                {o.odds != null ? o.odds.toFixed(2) : "—"}
              </span>
            </button>
          );
        })}
      </div>

      {finished && pick && (
        <p
          className={cn(
            "mt-3 text-center text-sm font-medium",
            actual === pick ? "text-win" : "text-loss",
          )}
        >
          {actual === pick ? "Riktig tipset ✓" : "Feil tips"}
        </p>
      )}

      <div className="mt-auto flex justify-end pt-6">
        <Button variant="outline" onClick={onNext} className="gap-1">
          Neste utippet
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}


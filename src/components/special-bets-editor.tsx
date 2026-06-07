"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { formatKickoff } from "@/lib/format";
import { Check, ChevronRight, Lock, CircleDot, Star, Dices, Swords } from "lucide-react";
import { toast } from "sonner";

export interface Option {
  name: string;
  prob: number | null;
  flag?: string | null;
}
export interface BetVM {
  id: string;
  name: string;
  points: number;
  kind: "team" | "player" | "keeper" | "continent" | "binary" | "duel";
  options: Option[];
  picked: string | null;
}

type Picks = Record<string, string>;

// Navigator grouping by bet kind.
const SECTIONS: { key: string; label: string; kinds: BetVM["kind"][] }[] = [
  { key: "main", label: "Hovedbets", kinds: ["team", "player", "keeper", "continent"] },
  { key: "binary", label: "Ja / nei", kinds: ["binary"] },
  { key: "duel", label: "Dueller", kinds: ["duel"] },
];

function sectionIcon(key: string) {
  if (key === "binary") return Dices;
  if (key === "duel") return Swords;
  return Star;
}

function countdown(lockIso: string, now: number): string {
  const ms = new Date(lockIso).getTime() - now;
  if (ms <= 0) return "Låst";
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `Låses om ${d}d ${h}t`;
  if (h > 0) return `Låses om ${h}t ${m}m`;
  return `Låses om ${m}m ${s % 60}s`;
}

export function SpecialBetsEditor({
  bets,
  userId,
  lockAt,
}: {
  bets: BetVM[];
  userId: string;
  lockAt: string | null;
}) {
  const supabase = createClient();
  const [picks, setPicks] = useState<Picks>(() =>
    Object.fromEntries(bets.filter((b) => b.picked).map((b) => [b.id, b.picked as string])),
  );
  const [now, setNow] = useState(() => Date.now());
  const [selectedId, setSelectedId] = useState<string>(
    () => (bets.find((b) => !b.picked) ?? bets[0])?.id,
  );

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const locked = lockAt ? new Date(lockAt).getTime() <= now : false;

  const sections = useMemo(
    () =>
      SECTIONS.map((s) => ({
        ...s,
        bets: bets.filter((b) => s.kinds.includes(b.kind)),
      })).filter((s) => s.bets.length > 0),
    [bets],
  );

  const selected = bets.find((b) => b.id === selectedId) ?? null;
  const pickedCount = bets.filter((b) => picks[b.id]).length;
  const total = bets.length;

  async function choose(bet: BetVM, candidate: string) {
    if (locked) return toast.error("Special bets er låst.");
    const prev = picks[bet.id];
    setPicks((p) => ({ ...p, [bet.id]: candidate })); // optimistic
    const { error } = await supabase.from("special_bet_picks").upsert(
      { user_id: userId, bet_type_id: bet.id, candidate, updated_at: new Date().toISOString() },
      { onConflict: "user_id,bet_type_id" },
    );
    if (error) {
      setPicks((p) => {
        const next = { ...p };
        if (prev) next[bet.id] = prev;
        else delete next[bet.id];
        return next;
      });
      toast.error("Kunne ikke lagre tipset.");
    }
  }

  function selectNextUnpicked() {
    const next = bets.find((b) => !picks[b.id]);
    if (next) setSelectedId(next.id);
    else toast.success("Alle special bets er tippet! 🎉");
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Special bets</h1>
          <p className="text-sm text-muted-foreground">
            Tipp turneringens utfall. Alle låses ved avspark i åpningskampen.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm tabular-nums text-muted-foreground">
            {pickedCount} / {total} tippet
          </span>
          <div className="w-32">
            <Progress value={total ? (pickedCount / total) * 100 : 0} />
          </div>
        </div>
      </div>

      {/* Deadline banner */}
      {lockAt && (
        <div
          className={cn(
            "flex flex-wrap items-center gap-2 rounded-xl border px-4 py-2.5 text-sm",
            locked ? "bg-muted/50 text-muted-foreground" : "bg-card",
          )}
        >
          <Lock className={cn("size-4", locked ? "" : "text-primary")} />
          <span className="font-medium">
            {locked ? "Special bets er låst" : "Frist:"}
          </span>
          {!locked && (
            <>
              <span>{formatKickoff(lockAt)}</span>
              <Badge variant="secondary" className="ml-auto tabular-nums">
                {countdown(lockAt, now)}
              </Badge>
            </>
          )}
        </div>
      )}

      {/* Mobile bet navigator — horizontal chip strip */}
      <BetStrip
        className="lg:hidden"
        sections={sections}
        picks={picks}
        selectedId={selectedId}
        onSelect={setSelectedId}
      />

      <div className="grid gap-4 lg:grid-cols-[16rem_1fr]">
        {/* LEFT — grouped navigator */}
        <aside className="hidden rounded-xl border bg-card lg:sticky lg:top-[4.5rem] lg:block lg:h-[calc(100dvh-6rem)]">
          <ScrollArea className="h-full p-2">
            {sections.map((section) => {
              const Icon = sectionIcon(section.key);
              const done = section.bets.filter((b) => picks[b.id]).length;
              return (
                <div key={section.key} className="mb-2">
                  <div className="flex items-center justify-between px-2 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <Icon className="size-3.5" />
                      {section.label}
                    </span>
                    <span className="tabular-nums">
                      {done}/{section.bets.length}
                    </span>
                  </div>
                  <div className="space-y-0.5">
                    {section.bets.map((bet) => {
                      const picked = picks[bet.id];
                      const active = bet.id === selectedId;
                      return (
                        <button
                          key={bet.id}
                          onClick={() => setSelectedId(bet.id)}
                          className={cn(
                            "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors",
                            active ? "bg-secondary" : "hover:bg-secondary/50",
                          )}
                        >
                          <span className="flex size-4 shrink-0 items-center justify-center">
                            {picked ? (
                              <Check className="size-3.5 text-primary" />
                            ) : (
                              <CircleDot className="size-3.5 text-muted-foreground/40" />
                            )}
                          </span>
                          <span className="min-w-0 flex-1 truncate">{bet.name}</span>
                          {picked && (
                            <span className="ml-auto max-w-20 truncate rounded bg-primary/10 px-1 text-xs font-semibold text-primary">
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

        {/* CENTER — bet canvas */}
        <section className="min-h-[22rem] rounded-xl border bg-card p-5">
          {selected ? (
            <BetCanvas
              key={selected.id}
              bet={selected}
              picked={picks[selected.id] ?? null}
              locked={locked}
              onChoose={(c) => choose(selected, c)}
              onNext={selectNextUnpicked}
            />
          ) : (
            <p className="text-muted-foreground">Ingen special bets.</p>
          )}
        </section>
      </div>
    </div>
  );
}

function BetStrip({
  sections,
  picks,
  selectedId,
  onSelect,
  className,
}: {
  sections: { key: string; label: string; bets: BetVM[] }[];
  picks: Picks;
  selectedId: string;
  onSelect: (id: string) => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "-mx-1 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        className,
      )}
    >
      <div className="flex w-max items-stretch gap-1.5 px-1">
        {sections.map((section) => (
          <Fragment key={section.key}>
            <div className="flex shrink-0 items-center px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {section.label}
            </div>
            {section.bets.map((bet) => {
              const picked = picks[bet.id];
              const active = bet.id === selectedId;
              return (
                <button
                  key={bet.id}
                  onClick={() => onSelect(bet.id)}
                  aria-current={active ? "true" : undefined}
                  className={cn(
                    "flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-colors",
                    active
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-card hover:bg-secondary/50",
                  )}
                >
                  {picked ? (
                    <Check className="size-3 text-primary" />
                  ) : (
                    <CircleDot className="size-3 text-muted-foreground/40" />
                  )}
                  <span className="max-w-40 truncate font-medium">{bet.name}</span>
                </button>
              );
            })}
          </Fragment>
        ))}
      </div>
    </div>
  );
}

function BetCanvas({
  bet,
  picked,
  locked,
  onChoose,
  onNext,
}: {
  bet: BetVM;
  picked: string | null;
  locked: boolean;
  onChoose: (candidate: string) => void;
  onNext: () => void;
}) {
  const isTwoChoice = bet.kind === "binary" || bet.kind === "duel";
  const isDuel = bet.kind === "duel";
  const Icon = isDuel ? Swords : bet.kind === "binary" ? Dices : Star;

  const selected =
    bet.options.find((o) => o.name === picked) ?? (picked ? { name: picked, prob: null } : null);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <Icon className="size-3.5 text-primary" />
          {bet.kind === "binary" ? "Ja / nei" : isDuel ? "Duell" : "Hovedbet"}
        </span>
        <Badge variant="secondary" className="tabular-nums">
          {bet.points} p
        </Badge>
      </div>

      <h2 className="mt-3 text-xl font-semibold tracking-tight">{bet.name}</h2>

      <div className="mt-5">
        {isTwoChoice ? (
          <div className="grid grid-cols-2 gap-3">
            {bet.options.map((o) => {
              const active = picked === o.name;
              return (
                <button
                  key={o.name}
                  disabled={locked}
                  onClick={() => onChoose(o.name)}
                  className={cn(
                    "flex flex-col items-center gap-1.5 rounded-lg border-2 px-4 py-5 transition-all disabled:cursor-not-allowed disabled:opacity-60",
                    active
                      ? "border-primary bg-primary/10"
                      : "border-border hover:border-primary/40 hover:bg-secondary/50",
                  )}
                >
                  <span
                    className={cn(
                      "line-clamp-1 font-bold",
                      isDuel ? "text-lg" : "text-2xl",
                      active ? "text-primary" : "text-foreground",
                    )}
                  >
                    {o.name}
                  </span>
                  <span className="text-sm tabular-nums text-muted-foreground">
                    {o.prob != null ? `${(o.prob * 100).toFixed(0)}%` : "—"}
                  </span>
                </button>
              );
            })}
          </div>
        ) : (
          <Command className="rounded-lg border bg-transparent" loop>
            <CommandInput placeholder="Søk …" />
            <CommandList className="max-h-[24rem]">
              <CommandEmpty>Ingen treff.</CommandEmpty>
              <CommandGroup>
                {bet.options.map((o) => {
                  const active = picked === o.name;
                  return (
                    <CommandItem
                      key={o.name}
                      value={o.name}
                      disabled={locked}
                      onSelect={() => onChoose(o.name)}
                      className={cn(active && "bg-primary/10 text-primary data-selected:bg-primary/15")}
                    >
                      <Check
                        className={cn("size-4", active ? "opacity-100 text-primary" : "opacity-0")}
                      />
                      {o.flag && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={o.flag}
                          alt=""
                          width={20}
                          height={15}
                          className="h-[15px] w-5 shrink-0 rounded-[2px] object-contain"
                        />
                      )}
                      <span className="flex-1 truncate">{o.name}</span>
                      {o.prob != null && (
                        <span
                          className={cn(
                            "text-xs tabular-nums",
                            active ? "text-primary" : "text-muted-foreground",
                          )}
                        >
                          {(o.prob * 100).toFixed(0)}%
                        </span>
                      )}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        )}
      </div>

      {selected && (
        <p className="mt-3 text-sm text-muted-foreground">
          Ditt valg: <span className="font-medium text-foreground">{selected.name}</span>
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

"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { setSpecialResult, runGrading } from "@/app/(app)/admin/actions";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Check, ChevronsUpDown, Calculator, Trophy, RefreshCw, Plus } from "lucide-react";
import { toast } from "sonner";

export interface AdminBet {
  id: string;
  name: string;
  points: number;
  /** Candidates participants actually picked, with pick counts (desc). */
  options: { name: string; count: number }[];
  winner: string | null;
}

export function AdminGrading({ bets }: { bets: AdminBet[] }) {
  const [grading, startGrading] = useTransition();

  function grade() {
    startGrading(async () => {
      const res = await runGrading();
      if (res.error) toast.error(res.error);
      else toast.success(`Poeng oppdatert for ${res.users} deltakere.`);
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Admin</h1>
          <p className="text-sm text-muted-foreground">
            Bekreft special-bet-vinnere og kjør poengberegning.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="gap-2" render={<Link href="/admin/sync" />}>
            <RefreshCw className="size-4" />
            Synkronisering
          </Button>
          <Button onClick={grade} disabled={grading} className="gap-2">
            <Calculator className="size-4" />
            {grading ? "Beregner …" : "Kjør poengberegning"}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {bets.map((bet) => (
          <ResultCard key={bet.id} bet={bet} />
        ))}
      </div>

      <p className="text-xs text-muted-foreground">
        Tips: kjør poengberegning etter at du har satt vinnere — den oppdaterer også gruppespill-
        og sluttspillpoeng fra resultatene.
      </p>
    </div>
  );
}

function ResultCard({ bet }: { bet: AdminBet }) {
  const [winner, setWinner] = useState<string | null>(bet.winner);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState("");

  async function choose(candidate: string) {
    const value = candidate.trim();
    if (!value) return;
    setOpen(false);
    setQuery("");
    const prev = winner;
    setWinner(value);
    setSaving(true);
    const res = await setSpecialResult(bet.id, value);
    setSaving(false);
    if (res.error) {
      setWinner(prev);
      toast.error(res.error);
    } else {
      toast.success(`Vinner satt: ${value}`);
    }
  }

  const q = query.trim();
  const filtered = q
    ? bet.options.filter((o) => o.name.toLowerCase().includes(q.toLowerCase()))
    : bet.options;
  // Offer free-text entry when the query doesn't exactly match a picked candidate
  // (e.g. the real winner nobody guessed). Grading only awards points on an exact
  // string match, so a manual value that matches nothing simply awards nobody.
  const exactMatch = bet.options.some((o) => o.name === q);

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Trophy className="size-4 text-primary" />
          {bet.name}
        </CardTitle>
        <Badge variant="secondary" className="tabular-nums">
          {bet.points} p
        </Badge>
      </CardHeader>
      <CardContent>
        <Popover
          open={open}
          onOpenChange={(next) => {
            setOpen(next);
            if (!next) setQuery("");
          }}
        >
          <PopoverTrigger
            render={<Button variant="outline" disabled={saving} className="w-full justify-between font-normal" />}
          >
            <span className={cn(!winner && "text-muted-foreground")}>
              {winner ?? "Sett vinner …"}
            </span>
            <ChevronsUpDown className="size-4 opacity-50" />
          </PopoverTrigger>
          <PopoverContent className="w-80 p-0" align="start">
            <Command shouldFilter={false}>
              <CommandInput
                placeholder="Søk eller skriv inn vinner …"
                value={query}
                onValueChange={setQuery}
              />
              <CommandList>
                <CommandGroup>
                  {filtered.map((o) => (
                    <CommandItem key={o.name} value={o.name} onSelect={() => choose(o.name)}>
                      <Check className={cn("size-4", winner === o.name ? "opacity-100" : "opacity-0")} />
                      <span className="flex-1 truncate">{o.name}</span>
                      <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                        {o.count} tips
                      </span>
                    </CommandItem>
                  ))}
                  {q && !exactMatch && (
                    <CommandItem value={`__freetext__${q}`} onSelect={() => choose(q)}>
                      <Plus className="size-4" />
                      <span className="flex-1 truncate">
                        Sett «{q}» som vinner
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground">ingen tips</span>
                    </CommandItem>
                  )}
                  {filtered.length === 0 && !q && (
                    <p className="px-2 py-6 text-center text-sm text-muted-foreground">
                      Ingen har tippet her ennå. Skriv inn vinneren for å sette den manuelt.
                    </p>
                  )}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </CardContent>
    </Card>
  );
}

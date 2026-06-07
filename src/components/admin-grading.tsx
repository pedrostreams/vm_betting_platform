"use client";

import { useState, useTransition } from "react";
import { setSpecialResult, runGrading } from "@/app/(app)/admin/actions";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Check, ChevronsUpDown, Calculator, Trophy } from "lucide-react";
import { toast } from "sonner";

export interface AdminBet {
  id: string;
  name: string;
  points: number;
  options: string[];
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
        <Button onClick={grade} disabled={grading} className="gap-2">
          <Calculator className="size-4" />
          {grading ? "Beregner …" : "Kjør poengberegning"}
        </Button>
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

  async function choose(candidate: string) {
    setOpen(false);
    const prev = winner;
    setWinner(candidate);
    setSaving(true);
    const res = await setSpecialResult(bet.id, candidate);
    setSaving(false);
    if (res.error) {
      setWinner(prev);
      toast.error(res.error);
    } else {
      toast.success(`Vinner satt: ${candidate}`);
    }
  }

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
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger
            render={<Button variant="outline" disabled={saving} className="w-full justify-between font-normal" />}
          >
            <span className={cn(!winner && "text-muted-foreground")}>
              {winner ?? "Sett vinner …"}
            </span>
            <ChevronsUpDown className="size-4 opacity-50" />
          </PopoverTrigger>
          <PopoverContent className="w-80 p-0" align="start">
            <Command>
              <CommandInput placeholder="Søk …" />
              <CommandList>
                <CommandEmpty>Ingen kandidater (Polymarket utilgjengelig?).</CommandEmpty>
                <CommandGroup>
                  {bet.options.map((name) => (
                    <CommandItem key={name} value={name} onSelect={() => choose(name)}>
                      <Check className={cn("size-4", winner === name ? "opacity-100" : "opacity-0")} />
                      <span className="flex-1 truncate">{name}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </CardContent>
    </Card>
  );
}

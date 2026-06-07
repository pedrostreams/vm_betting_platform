"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
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
import { Check, ChevronsUpDown, Lock, Star } from "lucide-react";
import { toast } from "sonner";

export interface Option {
  name: string;
  prob: number | null;
}
export interface BetVM {
  id: string;
  name: string;
  points: number;
  options: Option[];
  picked: string | null;
}

export function SpecialBetsEditor({
  bets,
  userId,
  locked,
}: {
  bets: BetVM[];
  userId: string;
  locked: boolean;
}) {
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Special bets</h1>
          <p className="text-sm text-muted-foreground">
            {locked
              ? "Turneringen har startet — special bets er låst."
              : "Velg dine favoritter. Låses ved VMs første avspark."}
          </p>
        </div>
        {locked && (
          <Badge variant="secondary" className="gap-1">
            <Lock className="size-3" /> Låst
          </Badge>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {bets.map((bet) => (
          <BetCard key={bet.id} bet={bet} userId={userId} locked={locked} />
        ))}
      </div>
    </div>
  );
}

function BetCard({ bet, userId, locked }: { bet: BetVM; userId: string; locked: boolean }) {
  const supabase = createClient();
  const [picked, setPicked] = useState<string | null>(bet.picked);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const selected = bet.options.find((o) => o.name === picked) ?? (picked ? { name: picked, prob: null } : null);

  async function choose(option: Option) {
    setOpen(false);
    const prev = picked;
    setPicked(option.name);
    setSaving(true);
    const row = {
      user_id: userId,
      bet_type_id: bet.id,
      candidate: option.name,
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase
      .from("special_bet_picks")
      .upsert(row, { onConflict: "user_id,bet_type_id" });
    setSaving(false);
    if (error) {
      setPicked(prev);
      toast.error(locked ? "Special bets er låst." : "Kunne ikke lagre.");
    }
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Star className="size-4 text-primary" />
          {bet.name}
        </CardTitle>
        <Badge variant="secondary" className="tabular-nums">
          {bet.points} p
        </Badge>
      </CardHeader>
      <CardContent>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger
            render={
              <Button
                variant="outline"
                disabled={locked || saving}
                className="w-full justify-between font-normal"
              />
            }
          >
            <span className={cn(!selected && "text-muted-foreground")}>
              {selected ? selected.name : "Velg …"}
            </span>
            <ChevronsUpDown className="size-4 opacity-50" />
          </PopoverTrigger>
          <PopoverContent className="w-80 p-0" align="start">
            <Command>
              <CommandInput placeholder="Søk …" />
              <CommandList>
                <CommandEmpty>Ingen treff.</CommandEmpty>
                <CommandGroup>
                  {bet.options.map((o) => (
                    <CommandItem key={o.name} value={o.name} onSelect={() => choose(o)}>
                      <Check
                        className={cn("size-4", picked === o.name ? "opacity-100" : "opacity-0")}
                      />
                      <span className="flex-1 truncate">{o.name}</span>
                      {o.prob != null && (
                        <span className="text-xs tabular-nums text-muted-foreground">
                          {(o.prob * 100).toFixed(0)}%
                        </span>
                      )}
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

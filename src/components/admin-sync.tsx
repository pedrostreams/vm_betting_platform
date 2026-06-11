"use client";

import { useState } from "react";
import Link from "next/link";
import { runSync, type SyncJob, type SyncRunResult } from "@/app/(app)/admin/actions";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  RefreshCw,
  Coins,
  Calculator,
  Play,
  Loader2,
  Terminal,
  ArrowLeft,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import type { LogLevel } from "@/lib/ingest/log";

const JOBS: { key: SyncJob; label: string; icon: typeof RefreshCw; variant?: "default" | "outline" }[] = [
  { key: "sync-tournament", label: "Synk turnering", icon: RefreshCw, variant: "outline" },
  { key: "odds", label: "Odds", icon: Coins, variant: "outline" },
  { key: "grade", label: "Poengberegning", icon: Calculator, variant: "outline" },
  { key: "all", label: "Kjør alt", icon: Play, variant: "default" },
];

const LEVEL_STYLE: Record<LogLevel, string> = {
  info: "text-muted-foreground",
  ok: "text-emerald-600 dark:text-emerald-400",
  warn: "text-amber-600 dark:text-amber-400",
  error: "text-destructive",
};

function elapsed(ms: number): string {
  return ms >= 1000 ? `+${(ms / 1000).toFixed(1)}s` : `+${ms}ms`;
}

export function AdminSync() {
  const [pending, setPending] = useState<SyncJob | null>(null);
  const [result, setResult] = useState<SyncRunResult | null>(null);

  async function run(job: SyncJob) {
    if (pending) return;
    setPending(job);
    try {
      const res = await runSync(job);
      setResult(res);
      if (res.error) toast.error(res.error);
      else toast.success(`Ferdig på ${(res.ms / 1000).toFixed(1)}s`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Synkronisering</h1>
          <p className="text-sm text-muted-foreground">
            Trigg cron-jobbene manuelt og se hva som hentes og endres. Samme kode som den daglige
            cron-en.
          </p>
        </div>
        <Button variant="ghost" size="sm" className="gap-2" render={<Link href="/admin" />}>
          <ArrowLeft className="size-4" />
          Admin
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {JOBS.map((j) => {
          const Icon = pending === j.key ? Loader2 : j.icon;
          return (
            <Button
              key={j.key}
              variant={j.variant ?? "outline"}
              onClick={() => run(j.key)}
              disabled={pending !== null}
              className="gap-2"
            >
              <Icon className={cn("size-4", pending === j.key && "animate-spin")} />
              {j.label}
            </Button>
          );
        })}
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Terminal className="size-4 text-primary" />
            Logg
            {result && (
              <span className="text-xs font-normal text-muted-foreground tabular-nums">
                {(result.ms / 1000).toFixed(1)}s · {result.log.length} linjer
              </span>
            )}
          </CardTitle>
          {result && (
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 text-muted-foreground"
              onClick={() => setResult(null)}
            >
              <Trash2 className="size-3.5" />
              Tøm
            </Button>
          )}
        </CardHeader>
        <CardContent>
          <div className="max-h-96 overflow-auto rounded-lg border bg-muted/40 p-3 font-mono text-xs leading-relaxed">
            {!result && !pending && (
              <p className="text-muted-foreground">Velg en jobb over for å starte …</p>
            )}
            {pending && (
              <p className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin" />
                Kjører {JOBS.find((j) => j.key === pending)?.label} …
              </p>
            )}
            {result?.log.map((line, i) => (
              <div key={i} className="flex gap-2 whitespace-pre-wrap break-words">
                <span className="shrink-0 text-muted-foreground/60 tabular-nums">
                  {elapsed(line.ms)}
                </span>
                <span className={LEVEL_STYLE[line.level]}>{line.msg}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { runSummary } from "@/app/(app)/admin/actions";
import type { SummarySendRow } from "@/lib/summary";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Mail, Send, Loader2, Check, Clock } from "lucide-react";
import { toast } from "sonner";

function formatSentAt(iso: string): string {
  return new Date(iso).toLocaleString("nb-NO", {
    timeZone: "Europe/Oslo",
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function AdminEmail({
  lastSend,
  sentToday,
}: {
  lastSend: SummarySendRow | null;
  sentToday: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<"test" | "all" | null>(null);

  async function send(mode: "test" | "all") {
    if (pending) return;
    if (mode === "all" && !window.confirm("Sende dagens oppsummering til ALLE deltakere nå?")) return;
    setPending(mode);
    try {
      const { error, result } = await runSummary({ test: mode === "test" });
      if (error) {
        toast.error(error);
      } else if (result && !result.sent) {
        toast.warning(result.reason ?? "Ikke sendt.");
      } else if (result) {
        toast.success(
          result.test
            ? `Test sendt til deg (${result.matches} kamper siste 24t)`
            : `Sendt til ${result.recipients} mottakere (${result.matches} kamper siste 24t)`,
        );
        router.refresh(); // pull fresh "sendt i dag?"-status
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setPending(null);
    }
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Mail className="size-4 text-primary" />
          Dagens e-post
        </CardTitle>
        {sentToday ? (
          <Badge className="gap-1 bg-emerald-600 text-white">
            <Check className="size-3" />
            Sendt i dag
          </Badge>
        ) : (
          <Badge variant="outline" className="gap-1 border-amber-500/40 text-amber-600 dark:text-amber-400">
            <Clock className="size-3" />
            Ikke sendt i dag
          </Badge>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          {lastSend ? (
            <>
              Sist sendt {formatSentAt(lastSend.sent_at)}
              {lastSend.test ? " (test)" : ` · ${lastSend.recipients} mottakere`}
              {lastSend.subject ? <> — «{lastSend.subject}»</> : null}
            </>
          ) : (
            "Ingen e-post sendt ennå."
          )}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            className="gap-2"
            disabled={pending !== null}
            onClick={() => send("test")}
          >
            {pending === "test" ? <Loader2 className="size-4 animate-spin" /> : <Mail className="size-4" />}
            Send test til meg
          </Button>
          <Button className="gap-2" disabled={pending !== null} onClick={() => send("all")}>
            {pending === "all" ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            Send til alle
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

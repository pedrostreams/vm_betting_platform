import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { loadMatches, loadUserPicks, loadFirstPoolStandings } from "@/lib/queries";
import { fetchNews } from "@/lib/news";
import { cn } from "@/lib/utils";
import { TeamBadge } from "@/components/team-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatKickoff, formatTime } from "@/lib/format";
import { RulesDialog } from "@/components/rules-dialog";
import {
  ArrowRight,
  CalendarClock,
  Newspaper,
  Trophy,
  ExternalLink,
  Shield,
} from "lucide-react";
import type { MatchView } from "@/lib/types";

function isToday(iso: string): boolean {
  const d = new Date(iso);
  const n = new Date();
  return d.toDateString() === n.toDateString();
}

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [matches, picks, profileRes, scoreRes, news, standings] = await Promise.all([
    loadMatches(supabase, { stage: "GROUP_STAGE" }),
    loadUserPicks(supabase, user!.id),
    supabase.from("profiles").select("display_name, full_name").eq("id", user!.id).single(),
    supabase.from("user_scores").select("total_points").eq("user_id", user!.id).maybeSingle(),
    fetchNews(6),
    loadFirstPoolStandings(supabase, user!.id),
  ]);

  const now = Date.now();
  const openUnpicked = matches
    .filter((m) => !picks[m.id] && new Date(m.lock_at).getTime() > now)
    .sort((a, b) => new Date(a.lock_at).getTime() - new Date(b.lock_at).getTime());
  const today = matches.filter((m) => isToday(m.utc_date));

  const firstName = (profileRes.data?.full_name ?? profileRes.data?.display_name ?? "").split(" ")[0];
  const totalPoints = scoreRes.data?.total_points ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Hei{firstName ? `, ${firstName}` : ""}
          </h1>
          <p className="text-sm text-muted-foreground">Her er det som skjer i VM-tippingen.</p>
        </div>
        <div className="flex items-center gap-2">
          <RulesDialog />
          <div className="flex items-center gap-2 rounded-lg border bg-card px-4 py-2">
            <Trophy className="size-4 text-primary" />
            <span className="text-sm text-muted-foreground">Dine poeng</span>
            <span className="text-lg font-semibold tabular-nums">{totalPoints}</span>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Actions before deadline */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarClock className="size-4 text-primary" />
              Gjøremål før deadline
            </CardTitle>
            {openUnpicked.length > 0 && (
              <Badge variant="secondary">{openUnpicked.length} utippet</Badge>
            )}
          </CardHeader>
          <CardContent>
            {openUnpicked.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                Alt er tippet — godt jobba! 🎉
              </p>
            ) : (
              <div className="space-y-1">
                {openUnpicked.slice(0, 5).map((m) => (
                  <Link
                    key={m.id}
                    href="/gruppespill"
                    className="flex items-center gap-3 rounded-lg px-2 py-2 text-sm transition-colors hover:bg-secondary/50"
                  >
                    <span className="flex min-w-0 flex-1 items-center gap-2">
                      <TeamBadge team={m.home} size={18} showName={false} />
                      <span className="truncate">{m.home?.name}</span>
                      <span className="text-muted-foreground">–</span>
                      <TeamBadge team={m.away} size={18} showName={false} />
                      <span className="truncate">{m.away?.name}</span>
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {formatKickoff(m.utc_date)}
                    </span>
                  </Link>
                ))}
                <div className="pt-2">
                  <Button
                    render={<Link href="/gruppespill" />}
                    variant="outline"
                    size="sm"
                    className="w-full"
                  >
                    Til gruppespill <ArrowRight className="size-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Standings — first pool */}
        <StandingsCard standings={standings} meId={user!.id} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Today's matches */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Dagens kamper</CardTitle>
          </CardHeader>
          <CardContent>
            {today.length === 0 ? (
              <p className="py-2 text-sm text-muted-foreground">Ingen kamper i dag.</p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {today.map((m) => (
                  <TodayMatch key={m.id} match={m} pick={picks[m.id]} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* News */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Newspaper className="size-4 text-primary" />
              Nyheter
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {news.length === 0 ? (
              <p className="text-sm text-muted-foreground">Ingen nyheter ennå.</p>
            ) : (
              news.map((n) => (
                <a
                  key={n.link}
                  href={n.link}
                  target="_blank"
                  rel="noreferrer"
                  className="group block rounded-md px-2 py-1.5 transition-colors hover:bg-secondary/50"
                >
                  <p className="line-clamp-2 text-sm font-medium leading-snug group-hover:text-primary">
                    {n.title}
                  </p>
                  <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                    {n.source}
                    <ExternalLink className="size-3" />
                  </p>
                </a>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StandingsCard({
  standings,
  meId,
}: {
  standings: Awaited<ReturnType<typeof loadFirstPoolStandings>>;
  meId: string;
}) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <Shield className="size-4 text-primary" />
          {standings ? standings.poolName : "Ligatabell"}
        </CardTitle>
        {standings && (
          <Button render={<Link href={`/liga/${standings.poolId}`} />} variant="ghost" size="sm">
            Se alle <ArrowRight className="size-4" />
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {!standings ? (
          <div className="space-y-3 py-2 text-center">
            <p className="text-sm text-muted-foreground">Du er ikke med i noen liga ennå.</p>
            <Button render={<Link href="/liga" />} variant="outline" size="sm">
              Opprett eller bli med
            </Button>
          </div>
        ) : (
          <ol className="space-y-0.5">
            {standings.rows.slice(0, 6).map((r, i) => (
              <li
                key={r.userId}
                className={cn(
                  "flex items-center gap-3 rounded-md px-2 py-1.5 text-sm",
                  r.userId === meId && "bg-primary/5",
                )}
              >
                <span className="w-5 text-center tabular-nums text-muted-foreground">{i + 1}</span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5 truncate">
                    {r.name}
                    {r.userId === meId && <span className="text-xs text-primary">(deg)</span>}
                  </span>
                  {r.fullName && (
                    <span className="block truncate text-xs text-muted-foreground">{r.fullName}</span>
                  )}
                </span>
                <span className="font-semibold tabular-nums">{r.total}</span>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}

function TodayMatch({ match, pick }: { match: MatchView; pick?: string }) {
  const finished = match.status === "FINISHED" && match.home_score != null;
  return (
    <div className="flex items-center gap-3 rounded-lg border p-3">
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-center gap-2 text-sm">
          <TeamBadge team={match.home} size={18} showName={false} />
          <span className="truncate">{match.home?.name}</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <TeamBadge team={match.away} size={18} showName={false} />
          <span className="truncate">{match.away?.name}</span>
        </div>
      </div>
      <div className="shrink-0 text-right">
        {finished ? (
          <span className="text-lg font-semibold tabular-nums">
            {match.home_score}–{match.away_score}
          </span>
        ) : (
          <span className="text-sm text-muted-foreground">{formatTime(match.utc_date)}</span>
        )}
        {pick && (
          <div className="mt-1">
            <Badge variant="secondary" className="text-xs">
              Tippet {pick}
            </Badge>
          </div>
        )}
      </div>
    </div>
  );
}

// Cron entrypoint, triggered daily by cron-job.org. Protected by CRON_SECRET
// passed as ?secret=... or "Authorization: Bearer <secret>".
//
//   /api/cron/sync-tournament   teams, squads, fixtures, results
//   /api/cron/odds              Norsk Tipping HUB odds
//   /api/cron/news              Independent RSS
//   /api/cron/grade             recompute scores
//   /api/cron/all               all of the above, in order

import { NextResponse } from "next/server";
import { adminClient } from "@/lib/supabase/admin";
import { syncTournament } from "@/lib/ingest/tournament";
import { syncOdds } from "@/lib/ingest/odds";
import { gradeAll } from "@/lib/scoring";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const url = new URL(req.url);
  const fromQuery = url.searchParams.get("secret");
  const fromHeader = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  return fromQuery === secret || fromHeader === secret;
}

const JOBS = {
  "sync-tournament": (sb: ReturnType<typeof adminClient>) => syncTournament(sb),
  odds: (sb: ReturnType<typeof adminClient>) => syncOdds(sb),
  grade: (sb: ReturnType<typeof adminClient>) => gradeAll(sb),
} as const;

export async function GET(req: Request, { params }: { params: Promise<{ job: string }> }) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { job } = await params;
  const sb = adminClient();
  const started = Date.now();

  try {
    if (job === "all") {
      const tournament = await syncTournament(sb);
      let odds: Awaited<ReturnType<typeof syncOdds>> | { error: string };
      try {
        odds = await syncOdds(sb);
      } catch (e) {
        odds = { error: (e as Error).message }; // odds is non-critical
      }
      const grade = await gradeAll(sb);
      return NextResponse.json({ job, ms: Date.now() - started, tournament, odds, grade });
    }

    const fn = JOBS[job as keyof typeof JOBS];
    if (!fn) return NextResponse.json({ error: `unknown job: ${job}` }, { status: 404 });

    const result = await fn(sb);
    return NextResponse.json({ job, ms: Date.now() - started, result });
  } catch (e) {
    return NextResponse.json({ job, error: (e as Error).message }, { status: 500 });
  }
}

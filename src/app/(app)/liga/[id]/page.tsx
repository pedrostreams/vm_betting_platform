import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { CopyInviteButton } from "@/components/copy-invite-button";
import { cn } from "@/lib/utils";

interface ScoreRow {
  total_points: number;
  group_points: number;
  knockout_points: number;
  special_points: number;
  exact_knockout_count: number;
  correct_special_count: number;
}

export default async function LeaderboardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: members } = await supabase
    .from("pool_members")
    .select("user_id")
    .eq("pool_id", id);

  if (!members || !members.some((m) => m.user_id === user!.id)) redirect("/liga");

  const ids = members.map((m) => m.user_id);
  const [{ data: pool }, { data: profiles }, { data: scores }] = await Promise.all([
    supabase.from("pools").select("name, invite_code").eq("id", id).single(),
    supabase.from("profiles").select("id, display_name, full_name").in("id", ids),
    supabase.from("user_scores").select("*").in("user_id", ids),
  ]);

  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.display_name as string]));
  const fullNameById = new Map((profiles ?? []).map((p) => [p.id, p.full_name as string | null]));
  const scoreById = new Map((scores ?? []).map((s) => [s.user_id, s as unknown as ScoreRow]));

  const rows = ids
    .map((uid) => ({
      uid,
      name: nameById.get(uid) ?? "—",
      fullName: fullNameById.get(uid) ?? null,
      s: scoreById.get(uid) ?? {
        total_points: 0,
        group_points: 0,
        knockout_points: 0,
        special_points: 0,
        exact_knockout_count: 0,
        correct_special_count: 0,
      },
    }))
    .sort(
      (a, b) =>
        b.s.total_points - a.s.total_points ||
        b.s.exact_knockout_count - a.s.exact_knockout_count ||
        b.s.correct_special_count - a.s.correct_special_count ||
        a.name.localeCompare(b.name),
    );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{pool?.name}</h1>
          <p className="text-sm text-muted-foreground">
            Invitasjonskode:{" "}
            <span className="font-mono tracking-widest text-foreground">{pool?.invite_code}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary">{rows.length} deltakere</Badge>
          {pool?.invite_code && <CopyInviteButton code={pool.invite_code} />}
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12 text-center">#</TableHead>
              <TableHead>Deltaker</TableHead>
              <TableHead className="text-right">Gruppe</TableHead>
              <TableHead className="text-right">Sluttspill</TableHead>
              <TableHead className="text-right">Special</TableHead>
              <TableHead className="text-right font-semibold">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r, i) => {
              const me = r.uid === user!.id;
              return (
                <TableRow key={r.uid} className={cn(me && "bg-primary/5")}>
                  <TableCell className="text-center tabular-nums text-muted-foreground">
                    {i + 1}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{r.name}</span>
                      {me && <span className="text-xs text-primary">(deg)</span>}
                    </div>
                    {r.fullName && (
                      <div className="text-xs text-muted-foreground">{r.fullName}</div>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {r.s.group_points}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {r.s.knockout_points}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {r.s.special_points}
                  </TableCell>
                  <TableCell className="text-right text-base font-semibold tabular-nums">
                    {r.s.total_points}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

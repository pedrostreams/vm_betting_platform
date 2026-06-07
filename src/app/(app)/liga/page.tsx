import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { LigaForms } from "@/components/liga-forms";
import { Card, CardContent } from "@/components/ui/card";
import { CopyInviteButton } from "@/components/copy-invite-button";
import { ChevronRight, Users } from "lucide-react";

export default async function LigaPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: memberships } = await supabase
    .from("pool_members")
    .select("role, pools(id, name, invite_code)")
    .eq("user_id", user!.id);

  type Pool = { id: string; name: string; invite_code: string };
  const pools = (memberships ?? [])
    .map((m) => (Array.isArray(m.pools) ? m.pools[0] : m.pools) as Pool | null)
    .filter((p): p is Pool => p != null);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Liga</h1>
        <p className="text-sm text-muted-foreground">
          Opprett en liga og del koden, eller bli med via en kode du har fått.
        </p>
      </div>

      <LigaForms />

      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-muted-foreground">Dine ligaer</h2>
        {pools.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              Du er ikke med i noen liga ennå.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-2">
            {pools.map((p) => (
              <Card key={p.id} className="transition-colors hover:bg-secondary/40">
                <CardContent className="flex items-center gap-3 py-4">
                  <Link href={`/liga/${p.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                    <span className="grid size-9 place-items-center rounded-md bg-primary/10 text-primary">
                      <Users className="size-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-medium">{p.name}</p>
                      <p className="text-xs text-muted-foreground">
                        Kode: <span className="font-mono tracking-widest">{p.invite_code}</span>
                      </p>
                    </div>
                  </Link>
                  <CopyInviteButton code={p.invite_code} label="Kopier lenke" />
                  <Link
                    href={`/liga/${p.id}`}
                    aria-label="Åpne ligatabell"
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <ChevronRight className="size-4" />
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

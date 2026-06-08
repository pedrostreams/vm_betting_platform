import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { adminClient } from "@/lib/supabase/admin";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { InviteAccept } from "@/components/invite-accept";
import { Trophy, Users } from "lucide-react";

export default async function InvitePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const upper = code.toUpperCase();

  // Read the pool name with the service role — unauthenticated visitors can't
  // read `pools` through RLS, but an invite link must show who invited them.
  const { data: pool } = await adminClient()
    .from("pools")
    .select("id, name, buy_in_nok")
    .eq("invite_code", upper)
    .maybeSingle();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!pool) {
    return (
      <Shell>
        <Card className="w-full max-w-sm text-center">
          <CardHeader>
            <CardTitle>Ugyldig invitasjon</CardTitle>
            <CardDescription>Lenken finnes ikke eller er utløpt.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button render={<Link href="/" />} variant="outline" className="w-full">
              Til forsiden
            </Button>
          </CardContent>
        </Card>
      </Shell>
    );
  }

  // Not logged in → send to registration, carrying the invite code.
  if (!user) {
    return (
      <Shell>
        <InviteCard poolName={pool.name} buyIn={pool.buy_in_nok}>
          <Button render={<Link href={`/login?invite=${upper}`} />} size="lg" className="w-full">
            Logg inn eller registrer deg
          </Button>
          <p className="mt-3 text-center text-xs text-muted-foreground">
            Du blir med i ligaen rett etter at du har registrert deg.
          </p>
        </InviteCard>
      </Shell>
    );
  }

  // Logged in but profile not set up → finish onboarding, then come back.
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, agreed_terms_at")
    .eq("id", user.id)
    .single();
  if (!profile?.display_name || !profile?.agreed_terms_at) {
    redirect(`/onboarding?invite=${upper}`);
  }

  // Already a member → straight to the table.
  const { data: existing } = await supabase
    .from("pool_members")
    .select("pool_id")
    .eq("pool_id", pool.id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (existing) redirect(`/liga/${pool.id}`);

  // Logged in, not a member → confirm join.
  return (
    <Shell>
      <InviteCard poolName={pool.name} buyIn={pool.buy_in_nok}>
        <InviteAccept code={upper} />
      </InviteCard>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-muted/30 p-4">{children}</main>
  );
}

function InviteCard({
  poolName,
  buyIn,
  children,
}: {
  poolName: string;
  buyIn: number;
  children: React.ReactNode;
}) {
  return (
    <Card className="w-full max-w-sm">
      <CardHeader className="items-center text-center">
        <span className="mb-2 grid size-12 place-items-center rounded-2xl bg-primary/10 text-primary">
          <Trophy className="size-6" />
        </span>
        <CardDescription className="uppercase tracking-[0.2em]">Du er invitert</CardDescription>
        <CardTitle className="text-2xl">{poolName}</CardTitle>
        <CardDescription className="flex items-center justify-center gap-1.5">
          <Users className="size-3.5" /> Bli med i tippeligaen for VM 2026
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-4 rounded-xl bg-muted/60 p-3 text-center text-sm text-muted-foreground">
          Innsats: <span className="font-semibold text-foreground">{buyIn} kr</span> · oppgjør
          skjer utenfor appen
        </div>
        {children}
      </CardContent>
    </Card>
  );
}

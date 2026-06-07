"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { toast } from "sonner";
import { Loader2, Trophy, Users, ListChecks, Star } from "lucide-react";

type Mode = "signin" | "signup";

const FEATURES = [
  { icon: Users, title: "Gruppespill", desc: "Tipp H/U/B på alle 72 kampene" },
  { icon: ListChecks, title: "Sluttspill", desc: "Hvem går videre, runde for runde" },
  { icon: Star, title: "Special bets", desc: "Toppscorer, vinner og mer — odds fra Polymarket" },
];

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [mode, setMode] = useState<Mode>("signin");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  async function routeAfterAuth(userId: string) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name, agreed_terms_at")
      .eq("id", userId)
      .single();
    const incomplete = !profile?.display_name || !profile?.agreed_terms_at;
    router.replace(incomplete ? "/onboarding" : "/");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    if (mode === "signup") {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName.trim() } },
      });
      if (error) {
        setLoading(false);
        return toast.error(error.message);
      }
      if (!data.session) {
        setLoading(false);
        return toast.message("Sjekk e-posten for å bekrefte kontoen.");
      }
      await supabase.from("profiles").update({ full_name: fullName.trim() }).eq("id", data.user!.id);
      return routeAfterAuth(data.user!.id);
    }

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setLoading(false);
      return toast.error("Feil e-post eller passord.");
    }
    return routeAfterAuth(data.user!.id);
  }

  function openMobile(m: Mode) {
    setMode(m);
    setMobileOpen(true);
  }

  // Shared form fields (reused on desktop and inside the mobile sheet).
  const fields = (
    <form onSubmit={submit} className="space-y-3.5">
      {mode === "signup" && (
        <div className="space-y-1.5">
          <Label htmlFor="fullName">Fullt navn</Label>
          <Input
            id="fullName"
            autoComplete="name"
            required
            placeholder="Ola Nordmann"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
          />
        </div>
      )}
      <div className="space-y-1.5">
        <Label htmlFor="email">E-post</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          required
          placeholder="navn@epost.no"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="password">Passord</Label>
        <Input
          id="password"
          type="password"
          autoComplete={mode === "signin" ? "current-password" : "new-password"}
          required
          minLength={6}
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      <Button type="submit" size="lg" className="mt-1 w-full" disabled={loading}>
        {loading && <Loader2 className="size-4 animate-spin" />}
        {mode === "signin" ? "Logg inn" : "Opprett konto"}
      </Button>
    </form>
  );

  const toggle = (
    <p className="mt-6 text-center text-sm text-muted-foreground">
      {mode === "signin" ? (
        <>
          Ny her?{" "}
          <button type="button" className="font-medium text-primary hover:underline" onClick={() => setMode("signup")}>
            Opprett konto
          </button>
        </>
      ) : (
        <>
          Har du konto?{" "}
          <button type="button" className="font-medium text-primary hover:underline" onClick={() => setMode("signin")}>
            Logg inn
          </button>
        </>
      )}
    </p>
  );

  return (
    <main className="min-h-dvh">
      {loading && (
        <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-3 bg-background/80 backdrop-blur-sm">
          <Loader2 className="size-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">
            {mode === "signin" ? "Logger inn …" : "Oppretter konto …"}
          </p>
        </div>
      )}

      {/* ════ DESKTOP: split screen ════ */}
      <div className="hidden min-h-dvh lg:grid lg:grid-cols-2">
        <section
          className="relative flex flex-col justify-between overflow-hidden p-12 text-white"
          style={{
            background:
              "radial-gradient(120% 90% at 15% 10%, rgba(74,127,208,0.28), transparent 55%), linear-gradient(155deg, #0e1a2e 0%, #16243c 55%, #1b2c4a 100%)",
          }}
        >
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.07]"
            style={{
              backgroundImage:
                "linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)",
              backgroundSize: "64px 64px",
            }}
          />
          <div className="relative flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-xl bg-white/10 ring-1 ring-white/20 backdrop-blur">
              <Trophy className="size-5" />
            </span>
            <span className="text-sm font-medium uppercase tracking-[0.3em] text-white/70">
              Fotball-VM 2026
            </span>
          </div>

          <div className="relative max-w-md space-y-8">
            <div className="space-y-4">
              <h1 className="text-6xl font-semibold leading-[0.95] tracking-tight">Tippebongen</h1>
              <p className="text-lg text-white/70">
                Guttegjengens tippekonkurranse for fotball-VM. Lag din egen liga, tipp hver kamp og
                kjemp om toppen hele sommeren.
              </p>
            </div>
            <ul className="space-y-4">
              {FEATURES.map(({ icon: Icon, title, desc }) => (
                <li key={title} className="flex items-start gap-3">
                  <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-lg bg-white/10 ring-1 ring-white/15">
                    <Icon className="size-4.5" />
                  </span>
                  <div>
                    <p className="font-medium">{title}</p>
                    <p className="text-sm text-white/60">{desc}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="relative flex items-center gap-6 text-sm text-white/60">
            <span><span className="font-semibold text-white">48</span> lag</span>
            <span className="h-3 w-px bg-white/20" />
            <span><span className="font-semibold text-white">104</span> kamper</span>
            <span className="h-3 w-px bg-white/20" />
            <span>Live odds &amp; statistikk</span>
          </div>
        </section>

        <section className="flex items-center justify-center bg-background px-6 py-12">
          <div className="w-full max-w-sm">
            <div className="mb-6 space-y-1">
              <h2 className="text-2xl font-semibold tracking-tight">
                {mode === "signin" ? "Velkommen tilbake" : "Bli med i moroa"}
              </h2>
              <p className="text-sm text-muted-foreground">
                {mode === "signin"
                  ? "Logg inn for å se bongen og tabellen din."
                  : "Opprett en konto og tipp deg til topps."}
              </p>
            </div>
            {fields}
            {toggle}
          </div>
        </section>
      </div>

      {/* ════ MOBILE: full-bleed hero + sheet ════ */}
      <div
        className="relative flex min-h-dvh flex-col justify-between overflow-hidden text-white lg:hidden"
        style={{
          background:
            "url('/bg.png') center/cover no-repeat, linear-gradient(155deg, #0e1a2e 0%, #16243c 55%, #1b2c4a 100%)",
        }}
      >
        {/* legibility scrim */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-black/45" />

        <div className="relative flex flex-1 items-start justify-center pt-20">
          <div className="flex flex-col items-center gap-2">
            <span className="grid size-12 place-items-center rounded-2xl bg-white/10 ring-1 ring-white/25 backdrop-blur">
              <Trophy className="size-6" />
            </span>
            <h1 className="text-4xl font-semibold tracking-tight drop-shadow">Tippebongen</h1>
            <p className="text-xs font-medium uppercase tracking-[0.3em] text-white/70">
              Fotball-VM 2026
            </p>
          </div>
        </div>

        <div className="relative space-y-6 p-6 pb-10">
          <div className="space-y-1 text-center">
            <h2 className="text-3xl font-semibold tracking-tight">Ikke vent.</h2>
            <p className="text-white/70">Bli med i VM-tippingen — det starter snart.</p>
          </div>

          <div className="space-y-3">
            <Button
              size="lg"
              onClick={() => openMobile("signin")}
              className="h-13 w-full rounded-full bg-white text-base font-semibold text-neutral-900 hover:bg-white/90"
            >
              Logg inn
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => openMobile("signup")}
              className="h-13 w-full rounded-full border-white/40 bg-white/10 text-base font-medium text-white backdrop-blur hover:bg-white/20 hover:text-white dark:border-white/40 dark:bg-white/10"
            >
              Har du ikke konto? Registrer deg
            </Button>
          </div>
        </div>

        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetContent side="bottom" className="gap-0 pb-8">
            <SheetHeader className="mb-4">
              <SheetTitle className="text-xl">
                {mode === "signin" ? "Velkommen tilbake" : "Bli med i moroa"}
              </SheetTitle>
              <SheetDescription>
                {mode === "signin"
                  ? "Logg inn for å se bongen og tabellen din."
                  : "Opprett en konto og tipp deg til topps."}
              </SheetDescription>
            </SheetHeader>
            {fields}
            {toggle}
          </SheetContent>
        </Sheet>
      </div>
    </main>
  );
}

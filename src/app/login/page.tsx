"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "sonner";

type Mode = "signin" | "signup";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

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
      const { data, error } = await supabase.auth.signUp({ email, password });
      setLoading(false);
      if (error) return toast.error(error.message);
      if (!data.session) {
        // "Confirm email" is still enabled in the Supabase project.
        return toast.message("Sjekk e-posten for å bekrefte kontoen.");
      }
      return routeAfterAuth(data.user!.id);
    }

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) return toast.error("Feil e-post eller passord.");
    return routeAfterAuth(data.user!.id);
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">VM 2026</CardTitle>
          <CardDescription>
            {mode === "signin" ? "Logg inn for å tippe" : "Opprett en konto"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-3">
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
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "…" : mode === "signin" ? "Logg inn" : "Registrer deg"}
            </Button>
          </form>

          <p className="mt-4 text-center text-sm text-muted-foreground">
            {mode === "signin" ? (
              <>
                Ny her?{" "}
                <button
                  type="button"
                  className="font-medium text-primary hover:underline"
                  onClick={() => setMode("signup")}
                >
                  Registrer deg
                </button>
              </>
            ) : (
              <>
                Har du konto?{" "}
                <button
                  type="button"
                  className="font-medium text-primary hover:underline"
                  onClick={() => setMode("signin")}
                >
                  Logg inn
                </button>
              </>
            )}
          </p>
        </CardContent>
      </Card>
    </main>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "sonner";

export default function OnboardingPage() {
  const router = useRouter();
  const supabase = createClient();
  const [displayName, setDisplayName] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!agreed) return toast.error("Du må godta vilkårene for å delta.");
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return router.replace("/login");
    }

    const { error } = await supabase
      .from("profiles")
      .update({ display_name: displayName.trim(), agreed_terms_at: new Date().toISOString() })
      .eq("id", user.id);

    setLoading(false);
    if (error) return toast.error(error.message);
    const invite = new URLSearchParams(window.location.search).get("invite");
    router.replace(invite ? `/invite/${invite}` : "/");
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Velkommen!</CardTitle>
          <CardDescription>Sett opp profilen din før du blir med.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={save} className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="name">Lagnavn</Label>
              <Input
                id="name"
                required
                placeholder="Hva skal laget ditt hete?"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
            </div>

            <div className="flex items-start gap-3 rounded-lg border p-3">
              <Checkbox
                id="terms"
                checked={agreed}
                onCheckedChange={(v) => setAgreed(v === true)}
                className="mt-0.5"
              />
              <Label htmlFor="terms" className="text-sm font-normal leading-snug">
                Jeg godtar vilkårene og bekrefter en innsats (buy-in) på{" "}
                <span className="font-semibold">200 kr</span>.
              </Label>
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Lagrer …" : "Bli med"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}

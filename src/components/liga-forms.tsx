"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createPool, joinPool } from "@/app/(app)/liga/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

export function LigaForms() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");

  function submit(action: (fd: FormData) => Promise<{ error?: string }>, fd: FormData, ok: string) {
    startTransition(async () => {
      const res = await action(fd);
      if (res.error) toast.error(res.error);
      else {
        toast.success(ok);
        setName("");
        setCode("");
        router.refresh();
      }
    });
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Opprett liga</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            action={(fd) => submit(createPool, fd, "Liga opprettet!")}
            className="flex gap-2"
          >
            <Input
              name="name"
              placeholder="F.eks. Super League"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
            <Button type="submit" disabled={pending}>
              Opprett
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Bli med i liga</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            action={(fd) => submit(joinPool, fd, "Du er med!")}
            className="flex gap-2"
          >
            <Input
              name="code"
              placeholder="Invitasjonskode"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              className="uppercase"
              required
            />
            <Button type="submit" variant="outline" disabled={pending}>
              Bli med
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

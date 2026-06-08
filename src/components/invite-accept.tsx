"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { joinPoolByCode } from "@/app/(app)/liga/actions";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export function InviteAccept({ code }: { code: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function join() {
    setLoading(true);
    const res = await joinPoolByCode(code);
    if (res.error) {
      setLoading(false);
      return toast.error(res.error);
    }
    toast.success("Du er med i ligaen! 🎉");
    router.replace("/");
  }

  return (
    <div className="space-y-2">
      <Button onClick={join} disabled={loading} size="lg" className="w-full">
        {loading && <Loader2 className="size-4 animate-spin" />}
        Bli med
      </Button>
      <Button render={<Link href="/" />} variant="ghost" className="w-full">
        Ikke nå
      </Button>
    </div>
  );
}

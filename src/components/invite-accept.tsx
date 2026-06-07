"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { joinPoolByCode } from "@/app/(app)/liga/actions";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export function InviteAccept({ code, poolId }: { code: string; poolId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function join() {
    setLoading(true);
    const res = await joinPoolByCode(code);
    if (res.error) {
      setLoading(false);
      return toast.error(res.error);
    }
    router.replace(`/liga/${res.poolId ?? poolId}`);
  }

  return (
    <div className="space-y-2">
      <Button onClick={join} disabled={loading} size="lg" className="w-full">
        {loading && <Loader2 className="size-4 animate-spin" />}
        Bli med
      </Button>
      <Button render={<a href="/" />} variant="ghost" className="w-full">
        Ikke nå
      </Button>
    </div>
  );
}

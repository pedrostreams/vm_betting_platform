"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Check, Link2 } from "lucide-react";

export function CopyInviteButton({
  code,
  label = "Kopier invitasjonslenke",
  variant = "outline",
  size = "sm",
}: {
  code: string;
  label?: string;
  variant?: "outline" | "secondary" | "ghost" | "default";
  size?: "sm" | "default" | "lg";
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    const url = `${window.location.origin}/invite/${code}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Invitasjonslenke kopiert!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Kunne ikke kopiere. Lenke: " + url);
    }
  }

  return (
    <Button onClick={copy} variant={variant} size={size} className="gap-1.5">
      {copied ? <Check className="size-4" /> : <Link2 className="size-4" />}
      {label}
    </Button>
  );
}

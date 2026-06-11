"use client";

import { useEffect, useState } from "react";
import { Bird, X } from "lucide-react";

// Bump the version suffix to re-show the banner to everyone after editing the copy.
const STORAGE_KEY = "vm26-announcement-chickens-v1";

export function AnnouncementBanner() {
  const [mounted, setMounted] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  // localStorage is client-only — read it after mount to avoid a hydration flash.
  useEffect(() => {
    setMounted(true);
    try {
      setDismissed(localStorage.getItem(STORAGE_KEY) === "1");
    } catch {
      // ignore (private mode / storage disabled)
    }
  }, []);

  if (!mounted || dismissed) return null;

  function dismiss() {
    setDismissed(true);
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // ignore
    }
  }

  return (
    <div className="flex items-center gap-3 rounded-xl border border-draw/40 bg-draw/15 px-4 py-3 dark:bg-draw/10">
      <span className="grid size-6 shrink-0 place-items-center rounded-full bg-draw text-draw-foreground">
        <Bird className="size-3.5" />
      </span>
      <p className="min-w-0 flex-1 text-sm">
        <span className="font-semibold text-foreground">Kyllingjakta</span>{" "}
        <span className="text-muted-foreground">
          for de to taperne kjøres i august/september.
        </span>
      </p>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Lukk"
        className="-mr-1 shrink-0 rounded-full p-1 text-muted-foreground transition-colors hover:bg-foreground/10 hover:text-foreground"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}

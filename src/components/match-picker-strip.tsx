"use client";

import { Fragment } from "react";
import { cn } from "@/lib/utils";
import type { MatchView, Pick } from "@/lib/types";
import { Check, Lock, CircleDot } from "lucide-react";

export type PickerSection = {
  key: string;
  label: string;
  matches: MatchView[];
};

/**
 * Horizontal, scrollable match navigator for narrow screens. Mirrors the
 * sticky left-hand navigator used on lg+ but lays matches out as chips so the
 * center canvas stays the focus on mobile. Render with `lg:hidden`.
 */
export function MatchPickerStrip({
  sections,
  picks,
  selectedId,
  isLocked,
  onSelect,
  className,
}: {
  sections: PickerSection[];
  picks: Record<number, Pick>;
  selectedId: number | null | undefined;
  isLocked: (m: MatchView) => boolean;
  onSelect: (id: number) => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "-mx-1 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        className
      )}
    >
      <div className="flex w-max items-stretch gap-1.5 px-1">
        {sections.map((section) => (
          <Fragment key={section.key}>
            <div className="flex shrink-0 items-center px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {section.label}
            </div>
            {section.matches.map((m) => {
              const picked = picks[m.id];
              const locked = isLocked(m);
              const active = m.id === selectedId;
              return (
                <button
                  key={m.id}
                  onClick={() => onSelect(m.id)}
                  aria-current={active ? "true" : undefined}
                  className={cn(
                    "flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-colors",
                    active
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-card hover:bg-secondary/50"
                  )}
                >
                  {locked ? (
                    <Lock className="size-3 text-muted-foreground" />
                  ) : picked ? (
                    <Check className="size-3 text-primary" />
                  ) : (
                    <CircleDot className="size-3 text-muted-foreground/40" />
                  )}
                  <span className="font-medium tabular-nums">
                    {m.home?.tla ?? m.home?.name ?? "?"}
                    <span className="mx-1 text-muted-foreground">–</span>
                    {m.away?.tla ?? m.away?.name ?? "?"}
                  </span>
                  {picked && (
                    <span className="rounded bg-primary/10 px-1 text-[10px] font-semibold text-primary">
                      {picked}
                    </span>
                  )}
                </button>
              );
            })}
          </Fragment>
        ))}
      </div>
    </div>
  );
}

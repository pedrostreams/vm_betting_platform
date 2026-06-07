"use client";

import type { MatchView } from "@/lib/types";
import type { TeamInsight } from "@/lib/insights";
import { MatchStatsPanel } from "@/components/match-stats-panel";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { BarChart3 } from "lucide-react";

/**
 * On-demand stats for narrow screens: a trigger button that opens the
 * match stats panel (otherwise the lg+ right rail) in a bottom sheet.
 * Render inside a `lg:hidden` wrapper.
 */
export function MobileStatsSheet({
  match,
  insights,
}: {
  match: MatchView;
  insights: Record<number, TeamInsight>;
}) {
  const title =
    match.home && match.away
      ? `${match.home.name} – ${match.away.name}`
      : "Statistikk";

  return (
    <Sheet>
      <SheetTrigger
        render={
          <Button variant="outline" className="w-full gap-2">
            <BarChart3 className="size-4" />
            Vis statistikk
          </Button>
        }
      />
      <SheetContent side="bottom">
        <SheetHeader className="shrink-0">
          <SheetTitle className="pr-8">{title}</SheetTitle>
        </SheetHeader>
        <div className="-mx-4 min-h-0 flex-1 overflow-y-auto overscroll-contain px-4">
          <MatchStatsPanel match={match} insights={insights} />
        </div>
      </SheetContent>
    </Sheet>
  );
}

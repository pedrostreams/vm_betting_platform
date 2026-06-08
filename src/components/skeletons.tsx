import { Skeleton } from "@/components/ui/skeleton";

/** Generic page skeleton: heading + a grid of cards. Used as the default
 *  `loading.tsx` fallback for app routes (home, liga, …). */
export function PageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-3">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
        <Skeleton className="h-9 w-40 rounded-full" />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-64 rounded-xl lg:col-span-2" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-56 rounded-xl lg:col-span-2" />
        <Skeleton className="h-56 rounded-xl" />
      </div>
    </div>
  );
}

/** Navigator + canvas skeleton for the editor-style routes (gruppespill,
 *  sluttspill, special-bets). Mirrors the real grid so nothing shifts. */
export function EditorSkeleton({ rightRail = true }: { rightRail?: boolean }) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-2">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-8 w-32" />
      </div>

      {/* mobile strip */}
      <div className="flex gap-1.5 overflow-hidden lg:hidden">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-24 shrink-0 rounded-full" />
        ))}
      </div>

      <div
        className={
          rightRail
            ? "grid gap-4 lg:grid-cols-[16rem_1fr_18rem]"
            : "grid gap-4 lg:grid-cols-[16rem_1fr]"
        }
      >
        <div className="hidden rounded-xl border bg-card p-2 lg:block">
          <div className="space-y-1.5">
            {Array.from({ length: 10 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        </div>
        <Skeleton className="h-[24rem] rounded-xl" />
        {rightRail && <Skeleton className="hidden h-[24rem] rounded-xl lg:block" />}
      </div>
    </div>
  );
}

/** Table skeleton for the stats explorer. */
export function TableSkeleton() {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <Skeleton className="h-9 w-48" />
      <div className="flex items-center gap-2">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-9 w-36" />
      </div>
      <div className="rounded-xl border bg-card p-3">
        <div className="space-y-2">
          {Array.from({ length: 12 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}

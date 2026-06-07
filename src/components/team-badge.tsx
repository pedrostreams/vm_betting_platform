import Image from "next/image";
import { cn } from "@/lib/utils";
import type { Team } from "@/lib/types";

export function TeamBadge({
  team,
  size = 20,
  className,
  showName = true,
  fallback = "TBD",
}: {
  team: Team | null;
  size?: number;
  className?: string;
  showName?: boolean;
  fallback?: string;
}) {
  return (
    <span className={cn("flex items-center gap-2", className)}>
      {team?.crest_url ? (
        <Image
          src={team.crest_url}
          alt=""
          width={size}
          height={size}
          className="shrink-0 rounded-[2px] object-contain"
          unoptimized
        />
      ) : (
        <span
          className="shrink-0 rounded-[2px] bg-muted"
          style={{ width: size, height: size }}
          aria-hidden
        />
      )}
      {showName && <span className="truncate">{team?.name ?? fallback}</span>}
    </span>
  );
}

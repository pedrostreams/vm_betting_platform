const NB = "nb-NO";

export function formatKickoff(iso: string): string {
  return new Date(iso).toLocaleString(NB, {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDay(iso: string): string {
  return new Date(iso).toLocaleDateString(NB, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(NB, { hour: "2-digit", minute: "2-digit" });
}

/** Convert decimal odds (H/D/A) to vig-removed implied probabilities (0–1). */
export function impliedProbabilities(
  home: number | null,
  draw: number | null,
  away: number | null,
): { home: number; draw: number; away: number } | null {
  if (!home || !draw || !away) return null;
  const rh = 1 / home;
  const rd = 1 / draw;
  const ra = 1 / away;
  const sum = rh + rd + ra;
  if (sum <= 0) return null;
  return { home: rh / sum, draw: rd / sum, away: ra / sum };
}

export function groupLabel(code: string | null): string {
  if (!code) return "";
  return code.replace("GROUP_", "Gruppe ");
}

// Knockout stage display order + Norwegian labels.
export const KNOCKOUT_STAGES = [
  "LAST_32",
  "LAST_16",
  "QUARTER_FINALS",
  "SEMI_FINALS",
  "THIRD_PLACE",
  "FINAL",
] as const;

const STAGE_LABELS: Record<string, string> = {
  LAST_32: "16-delsfinale",
  LAST_16: "8-delsfinale",
  QUARTER_FINALS: "Kvartfinale",
  SEMI_FINALS: "Semifinale",
  THIRD_PLACE: "Bronsefinale",
  FINAL: "Finale",
};

export function stageLabel(stage: string): string {
  return STAGE_LABELS[stage] ?? stage;
}

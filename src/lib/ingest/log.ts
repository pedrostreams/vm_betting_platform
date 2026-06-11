// Lightweight structured logger threaded into the ingest jobs so the admin
// "kjør sync" page can show exactly what was fetched and what changed. Optional
// everywhere — the daily cron route runs the same jobs without a logger.

export type LogLevel = "info" | "ok" | "warn" | "error";

export interface LogLine {
  level: LogLevel;
  msg: string;
  ms: number; // elapsed since the collector was created
}

export type Log = (level: LogLevel, msg: string) => void;

/** Collects timestamped log lines; hand `log` to ingest jobs, read `lines` after. */
export function makeLogCollector() {
  const start = Date.now();
  const lines: LogLine[] = [];
  const log: Log = (level, msg) => lines.push({ level, msg, ms: Date.now() - start });
  return { lines, log };
}

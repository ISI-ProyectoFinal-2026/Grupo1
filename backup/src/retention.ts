import { parseDumpDate } from "./dump-name";

export interface RetentionPolicy {
  daily: number;
  weekly: number;
}

export interface RetentionPlan {
  keep: string[];
  remove: string[];
}

export const DEFAULT_RETENTION: RetentionPolicy = { daily: 7, weekly: 4 };

// semana ISO 8601 (lunes a domingo, en UTC), ej. "2026-W46"
export function isoWeekKey(date: Date): string {
  const day = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const weekday = day.getUTCDay() || 7;
  // el jueves de la semana define el año ISO
  day.setUTCDate(day.getUTCDate() + 4 - weekday);
  const isoYear = day.getUTCFullYear();
  const yearStart = Date.UTC(isoYear, 0, 1);
  const week = Math.ceil(((day.getTime() - yearStart) / 86400000 + 1) / 7);
  return `${isoYear}-W${String(week).padStart(2, "0")}`;
}

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

// último dump de cada uno de los `count` períodos más recientes que tienen dumps
function newestPerPeriod(
  newestFirst: { name: string; date: Date }[],
  periodOf: (date: Date) => string,
  count: number
): string[] {
  const seen = new Set<string>();
  const picked: string[] = [];
  for (const dump of newestFirst) {
    const period = periodOf(dump.date);
    if (seen.has(period)) continue;
    if (seen.size >= count) break;
    seen.add(period);
    picked.push(dump.name);
  }
  return picked;
}

// nombres que no son dumps se ignoran: nunca se borran
export function planRetention(
  names: string[],
  policy: RetentionPolicy = DEFAULT_RETENTION
): RetentionPlan {
  const dumps = names
    .map((name) => ({ name, date: parseDumpDate(name) }))
    .filter((dump): dump is { name: string; date: Date } => dump.date !== null)
    .sort((a, b) => b.date.getTime() - a.date.getTime());

  const keep = new Set([
    ...newestPerPeriod(dumps, dayKey, policy.daily),
    ...newestPerPeriod(dumps, isoWeekKey, policy.weekly),
  ]);

  return {
    keep: dumps.filter((dump) => keep.has(dump.name)).map((dump) => dump.name),
    remove: dumps.filter((dump) => !keep.has(dump.name)).map((dump) => dump.name),
  };
}

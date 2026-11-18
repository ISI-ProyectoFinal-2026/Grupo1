// nombre de los dumps: patitas-YYYYMMDDTHHMMSSZ.dump (UTC, ordenable como texto)
const DUMP_PATTERN = /^patitas-(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z\.dump$/;

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

export function dumpFileName(date: Date): string {
  const stamp =
    `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}` +
    `T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`;
  return `patitas-${stamp}.dump`;
}

export function parseDumpDate(name: string): Date | null {
  const match = DUMP_PATTERN.exec(name);
  if (!match) return null;
  const [year, month, day, hour, minute, second] = match.slice(1).map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  // descarta fechas inválidas que Date normaliza (ej. mes 13)
  return dumpFileName(date) === name ? date : null;
}

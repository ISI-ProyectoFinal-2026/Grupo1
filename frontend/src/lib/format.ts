const DAY_MS = 24 * 60 * 60 * 1000;

const relative = new Intl.RelativeTimeFormat("es-AR", { numeric: "auto" });
const shortDate = new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "short" });

/**
 * Fecha "humana" para tarjetas: hoy, ayer, hace N días; pasada la semana, la
 * fecha corta (ej. "20 sept").
 */
export function formatRelativeDate(value: string, now: Date = new Date()): string {
  const date = new Date(value);
  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOf(now) - startOf(date)) / DAY_MS);

  if (days >= 0 && days < 7) {
    return relative.format(-days, "day");
  }
  return shortDate.format(date);
}

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

const longDate = new Intl.DateTimeFormat("es-AR", { year: "numeric", month: "long", day: "numeric" });

// fecha completa, ej. "1 de diciembre de 2026"
export function formatLongDate(value: string): string {
  return longDate.format(new Date(value));
}

const shortDay = new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "short", timeZone: "UTC" });

// día "YYYY-MM-DD" sin hora (ej. "1 nov"); en UTC para que no se corra un día
export function formatShortDay(isoDate: string): string {
  return shortDay.format(new Date(isoDate));
}

const longDay = new Intl.DateTimeFormat("es-AR", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });

// día "YYYY-MM-DD" sin hora, ej. "1 de septiembre de 2026"
export function formatLongDay(isoDate: string): string {
  return longDay.format(new Date(isoDate));
}

// la app usa solo la hora de Argentina (piloto en AR), igual que el backend
const argentinaDay = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Argentina/Buenos_Aires",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

// hoy como "YYYY-MM-DD" en Argentina (en-CA ya formatea así)
export function todayInArgentina(now: Date = new Date()): string {
  return argentinaDay.format(now);
}

const percent = new Intl.NumberFormat("es-AR", { style: "percent", minimumFractionDigits: 1, maximumFractionDigits: 1 });

// proporción 0..1 como porcentaje, ej. 0.05 -> "5,0%"
export function formatPercent(ratio: number): string {
  return percent.format(ratio);
}

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

// día y mes abreviado, ej. "5 nov"
export function formatShortDate(value: string): string {
  return shortDate.format(new Date(value));
}

const time = new Intl.DateTimeFormat("es-AR", { hour: "2-digit", minute: "2-digit" });

// solo la hora, ej. "09:07 a. m."
export function formatTime(value: string): string {
  return time.format(new Date(value));
}

const shortDateTime = new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

// día, mes y hora, ej. "5/11, 09:07 a. m."
export function formatShortDateTime(value: string): string {
  return shortDateTime.format(new Date(value));
}

const dateTime = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

// fecha completa y hora, ej. "05/11/2026, 09:07 a. m."
export function formatDateTime(value: string): string {
  return dateTime.format(new Date(value));
}

const longDateTime = new Intl.DateTimeFormat("es-AR", { dateStyle: "long", timeStyle: "short" });

// fecha larga y hora, ej. "5 de noviembre de 2026 a las 9:07 a. m."
export function formatLongDateTime(value: string): string {
  return longDateTime.format(new Date(value));
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

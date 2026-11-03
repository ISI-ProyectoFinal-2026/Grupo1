import { createHash } from "crypto";
import path from "path";
import { GlobalFonts, Image, Path2D, SKRSContext2D, createCanvas, loadImage } from "@napi-rs/canvas";
import { prisma } from "../db/client";
import { ReportDTO, ReportTag } from "./reports.service";
import * as storageService from "./storage.service";

// 1080x1920 (9:16) banda superior e inferior
const WIDTH = 1080;
const HEIGHT = 1920;
const SAFE_TOP = 250;
const SAFE_BOTTOM = 250;

const BANNER_HEIGHT = 340;
const FOOTER_HEIGHT = 130;
const PHOTO_Y_START = BANNER_HEIGHT;
const FOOTER_Y_START = HEIGHT - SAFE_BOTTOM - FOOTER_HEIGHT;
// Peor caso (#259): offset 80 + título 2 líneas (128) + gap 20 + descripción
// 2 líneas (88) + gap 20 + 4 filas con ícono (4 × 52) ≈ 544, más descendentes.
const PANEL_TEXT_BUDGET = 570;
const PANEL_Y_START = FOOTER_Y_START - PANEL_TEXT_BUDGET;
const PHOTO_Y_END = PANEL_Y_START;

const PLATFORM_NAME = "PATITAS";
const PLATFORM_TAGLINE = "Ayudamos a reencontrar mascotas · patitas.app";
const FONT_BOLD = "PatitasFlyerSansBold";
const FONT_REGULAR = "PatitasFlyerSansRegular";

/**
 * El nombre lógico "sans-serif" no resuelve a ningún font en @napi-rs/canvas
 * (a diferencia del CSS de un navegador) y cae en un fallback sin acentos ni
 * ñ. Se empaqueta una fuente propia y se registra a mano para que el flyer
 * se vea igual en Windows (dev) y en el server de producción (que no tiene
 * por qué tener ninguna fuente del sistema instalada).
 *
 * Los dos pesos se registran bajo nombres sin guion ("Bold"/"Regular" como
 * sufijo pegado, no "-regular"): con un guion, el matcher de fuentes de
 * napi-rs/canvas lo interpreta como sufijo de estilo de la MISMA familia y
 * termina resolviendo mal el glyph de la ñ en el peso regular.
 */
function registerFlyerFonts(): void {
  if (GlobalFonts.has(FONT_BOLD)) return;
  const fontsDir = path.dirname(require.resolve("@fontsource/inter/package.json"));
  GlobalFonts.registerFromPath(path.join(fontsDir, "files/inter-latin-700-normal.woff2"), FONT_BOLD);
  GlobalFonts.registerFromPath(path.join(fontsDir, "files/inter-latin-400-normal.woff2"), FONT_REGULAR);
}
registerFlyerFonts();

/**
 * La foto del reporte es una URL externa (R2) que puede estar caída o ya no
 * existir. Nunca debe tirar abajo la generación del flyer: se usa un fondo
 * liso como placeholder si la descarga o el decode fallan.
 */
async function fetchPetImage(imageUrl: string | null): Promise<Image | null> {
  if (!imageUrl) return null;
  // fuera del bucket no se descarga (SSRF, #229): sale el placeholder
  const r2ImageUrl = storageService.normalizeR2PublicUrl(imageUrl);
  if (!r2ImageUrl) return null;
  try {
    return await loadImage(r2ImageUrl, { maxRedirects: 0 });
  } catch {
    return null;
  }
}

type Measure = (text: string) => number;

// recorta hasta que el texto con "…" entre en el ancho
function withEllipsis(text: string, maxWidth: number, measure: Measure): string {
  let chars = Array.from(text);
  while (chars.length > 0 && measure(`${chars.join("")}…`) > maxWidth) {
    chars = chars.slice(0, -1);
  }
  return `${chars.join("").trimEnd()}…`;
}

// parte una palabra más ancha que la línea
function splitLongWord(word: string, maxWidth: number, measure: Measure): string[] {
  if (measure(word) <= maxWidth) return [word];
  const parts: string[] = [];
  let part = "";
  for (const char of Array.from(word)) {
    if (part && measure(part + char) > maxWidth) {
      parts.push(part);
      part = char;
    } else {
      part += char;
    }
  }
  if (part) parts.push(part);
  return parts;
}

// líneas que entran en el ancho; si sobra texto, la última cierra con "…"
export function wrapLines(text: string, maxWidth: number, maxLines: number, measure: Measure): string[] {
  const words = text
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .flatMap((word) => splitLongWord(word, maxWidth, measure));
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (line && measure(candidate) > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  if (lines.length <= maxLines) return lines;
  const kept = lines.slice(0, maxLines);
  kept[maxLines - 1] = withEllipsis(kept[maxLines - 1], maxWidth, measure);
  return kept;
}

function wrapText(
  ctx: SKRSContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines: number
): number {
  let cursorY = y;
  for (const line of wrapLines(text, maxWidth, maxLines, (value) => ctx.measureText(value).width)) {
    ctx.fillText(line, x, cursorY);
    cursorY += lineHeight;
  }
  return cursorY;
}

// datos fuera del reporte que se imprimen en el flyer (#259)
export interface FlyerDetails {
  petName: string | null;
  petBreed: string | null;
  petColor: string | null;
  // solo con consentimiento del autor (showPhoneOnFlyer)
  phone: string | null;
}

const NO_DETAILS: FlyerDetails = { petName: null, petBreed: null, petColor: null, phone: null };

export type FlyerIcon = "paw" | "pin" | "calendar" | "phone";

export interface FlyerInfoRow {
  icon: FlyerIcon;
  text: string;
}

// íconos 24x24 como paths: no dependen de fuentes del sistema
const ICON_PATHS: Record<FlyerIcon, string> = {
  paw:
    "M12 12.5c-3 0-6 3.6-6 6.2 0 1.6 1.3 2.3 2.8 2.3 1.3 0 2.1-.7 3.2-.7s1.9.7 3.2.7c1.5 0 2.8-.7 2.8-2.3 0-2.6-3-6.2-6-6.2z" +
    "M2.5 10.5a2 2.5 0 1 0 4 0a2 2.5 0 1 0-4 0z" +
    "M17.5 10.5a2 2.5 0 1 0 4 0a2 2.5 0 1 0-4 0z" +
    "M6.5 5a2 2.5 0 1 0 4 0a2 2.5 0 1 0-4 0z" +
    "M13.5 5a2 2.5 0 1 0 4 0a2 2.5 0 1 0-4 0z",
  pin: "M12 2C8.1 2 5 5.1 5 9c0 5.2 7 13 7 13s7-7.8 7-13c0-3.9-3.1-7-7-7zm0 4.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5z",
  calendar: "M7 2h2v2h6V2h2v2h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2zM5 9v11h14V9z",
  phone:
    "M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25c1.1.37 2.3.57 3.6.57a1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.57a1 1 0 0 1-.25 1z",
};

const EVENT_LABEL: Record<ReportDTO["reportType"], string> = {
  lost: "Se perdió el",
  found: "Se encontró el",
};

const EVENT_DATE_FORMAT = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "America/Argentina/Buenos_Aires",
});

// fecha del suceso; los reportes anteriores sin fecha usan la de creación
function eventDateText(report: ReportDTO): string {
  if (report.eventDate) {
    const [year, month, day] = report.eventDate.split("-");
    return `${day}/${month}/${year}`;
  }
  return EVENT_DATE_FORMAT.format(new Date(report.createdAt));
}

function present(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

// filas con ícono; un dato faltante no deja hueco
export function flyerInfoRows(report: ReportDTO, details: FlyerDetails): FlyerInfoRow[] {
  const rows: FlyerInfoRow[] = [];
  const pet = [details.petName, details.petBreed, details.petColor].map(present).filter(Boolean).join(" · ");
  if (pet) rows.push({ icon: "paw", text: pet });
  const zone = present(report.locationAddress);
  if (zone) rows.push({ icon: "pin", text: zone });
  rows.push({ icon: "calendar", text: `${EVENT_LABEL[report.reportType]} ${eventDateText(report)}` });
  const phone = present(details.phone);
  if (phone) rows.push({ icon: "phone", text: phone });
  return rows;
}

function drawIcon(ctx: SKRSContext2D, icon: FlyerIcon, x: number, y: number, size: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 24, size / 24);
  ctx.fill(new Path2D(ICON_PATHS[icon]), "evenodd");
  ctx.restore();
}

// una sola línea, recortada con "…" si no entra
function fitText(ctx: SKRSContext2D, text: string, maxWidth: number): string {
  const measure = (value: string) => ctx.measureText(value).width;
  return measure(text) <= maxWidth ? text : withEllipsis(text, maxWidth, measure);
}

const ROW_HEIGHT = 52;
const ICON_SIZE = 36;
const ROW_TEXT_X = 40 + ICON_SIZE + 18;

export function composeFlyer(report: ReportDTO, petImage: Image | null, details: FlyerDetails = NO_DETAILS): Buffer {
  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext("2d");
  const tag: ReportTag = report.tag;

  // Fondo
  ctx.fillStyle = "#111827";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Foto de la mascota
  const photoHeight = PHOTO_Y_END - PHOTO_Y_START;
  if (petImage) {
    const scale = Math.max(WIDTH / petImage.width, photoHeight / petImage.height);
    const drawWidth = petImage.width * scale;
    const drawHeight = petImage.height * scale;
    ctx.drawImage(
      petImage,
      (WIDTH - drawWidth) / 2,
      PHOTO_Y_START + (photoHeight - drawHeight) / 2,
      drawWidth,
      drawHeight
    );
  } else {
    ctx.fillStyle = tag.color;
    ctx.fillRect(0, PHOTO_Y_START, WIDTH, photoHeight);
    ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
    drawIcon(ctx, "paw", (WIDTH - 240) / 2, PHOTO_Y_START + (photoHeight - 240) / 2, 240);
  }

  // Banda superior con el estado (PERDIDO / ENCONTRADO / RESUELTO).
  ctx.fillStyle = tag.color;
  ctx.fillRect(0, 0, WIDTH, BANNER_HEIGHT);
  ctx.fillStyle = "#FFFFFF";
  drawIcon(ctx, "paw", 40, SAFE_TOP + 45 - 30, 60);
  ctx.font = `64px ${FONT_BOLD}`;
  ctx.textBaseline = "middle";
  ctx.fillText(tag.label, 40 + 60 + 20, SAFE_TOP + 45);

  // Panel con los datos del reporte, ocupa hasta el fondo del canvas para no
  // dejar un corte raro, pero todo el texto (incluido el pie de marca) vive
  // por encima de SAFE_BOTTOM.
  ctx.fillStyle = "#111827";
  ctx.fillRect(0, PANEL_Y_START, WIDTH, HEIGHT - PANEL_Y_START);
  ctx.fillStyle = tag.color;
  ctx.fillRect(0, PANEL_Y_START, WIDTH, 8);

  ctx.fillStyle = "#FFFFFF";
  ctx.font = `56px ${FONT_BOLD}`;
  ctx.textBaseline = "alphabetic";
  let cursorY = PANEL_Y_START + 80;
  cursorY = wrapText(ctx, report.title, 40, cursorY, WIDTH - 80, 64, 2);

  const description = present(report.description);
  if (description) {
    ctx.font = `36px ${FONT_REGULAR}`;
    ctx.fillStyle = "#D1D5DB";
    // Máximo 2 líneas: el peor caso tiene que entrar en PANEL_TEXT_BUDGET.
    cursorY = wrapText(ctx, description, 40, cursorY + 20, WIDTH - 80, 44, 2);
  }

  // filas con ícono: mascota, zona, fecha del suceso y teléfono (#259)
  ctx.font = `34px ${FONT_REGULAR}`;
  let rowY = cursorY + 20;
  for (const row of flyerInfoRows(report, details)) {
    ctx.fillStyle = tag.color;
    drawIcon(ctx, row.icon, 40, rowY - ICON_SIZE + 6, ICON_SIZE);
    ctx.fillStyle = "#E5E7EB";
    ctx.fillText(fitText(ctx, row.text, WIDTH - 40 - ROW_TEXT_X), ROW_TEXT_X, rowY);
    rowY += ROW_HEIGHT;
  }

  // Pie de marca
  ctx.fillStyle = tag.color;
  ctx.fillRect(0, FOOTER_Y_START, WIDTH, FOOTER_HEIGHT);
  ctx.fillStyle = "#FFFFFF";
  ctx.font = `34px ${FONT_BOLD}`;
  ctx.fillText(PLATFORM_NAME, 40, FOOTER_Y_START + 55);
  ctx.font = `26px ${FONT_REGULAR}`;
  ctx.fillText(PLATFORM_TAGLINE, 40, FOOTER_Y_START + 95);

  return canvas.toBuffer("image/png");
}

function flyerObjectKey(reportId: number): string {
  return `flyers/report-${reportId}.png`;
}

// Subir este número cuando cambie el diseño de composeFlyer, para invalidar
// todos los flyers ya generados con el layout anterior.
const FLYER_LAYOUT_VERSION = 2;
const FLYER_VERSION_METADATA_KEY = "flyer-version";
// Presente solo si el flyer se compuso con el placeholder porque la foto del
// reporte no se pudo bajar. Guarda cuándo (ISO 8601).
const FLYER_DEGRADED_AT_METADATA_KEY = "flyer-degraded-at";
// Cuánto se sirve un flyer degradado desde el cache antes de volver a
// intentar bajar la foto. Evita recomponer y subir a R2 en cada request
// mientras la foto esté caída, sin dejar el placeholder para siempre.
const DEGRADED_FLYER_RETRY_MS = 10 * 60 * 1000;
// Largo del prefijo de la versión que va en el `?v=` de la URL: alcanza para
// distinguir versiones sin hacer la URL innecesariamente larga.
const URL_VERSION_LENGTH = 12;

/**
 * Huella de todo lo que el flyer dibuja. Si cambia cualquiera de estos
 * campos (o el layout), el PNG guardado quedó viejo. Se usa un hash del
 * contenido y no `updatedAt` a propósito: cambios que el flyer no muestra
 * (ubicación, customFlyerUrl, etc.) no fuerzan una regeneración, y un UPDATE
 * por SQL crudo que no toque `updated_at` no deja un flyer desactualizado.
 */
function flyerVersion(report: ReportDTO, details: FlyerDetails): string {
  const renderedFields = [
    FLYER_LAYOUT_VERSION,
    report.title,
    report.description,
    report.locationAddress,
    report.imageUrl,
    report.tag.label,
    report.tag.color,
    report.reportType,
    new Date(report.createdAt).toISOString(),
    report.eventDate,
    details.petName,
    details.petBreed,
    details.petColor,
    present(details.phone),
  ];
  return createHash("sha256").update(JSON.stringify(renderedFields)).digest("hex");
}

/**
 * Un flyer degradado (con placeholder) se sirve desde el cache hasta que
 * vence DEGRADED_FLYER_RETRY_MS. Una marca ilegible se trata como vencida.
 */
function isDegradedRetryDue(degradedAt: string, now: number): boolean {
  const degradedAtMs = Date.parse(degradedAt);
  return Number.isNaN(degradedAtMs) || now - degradedAtMs >= DEGRADED_FLYER_RETRY_MS;
}

/**
 * La key en R2 es fija, así que la URL pública sola no cambia al regenerar y
 * el navegador (o un CDN) puede seguir mostrando el PNG viejo. El `?v=` lleva
 * la huella del contenido; en un flyer degradado suma además el momento de la
 * degradación, para que la URL del placeholder nunca coincida con la del
 * flyer bueno que lo reemplace.
 */
function versionedFlyerUrl(publicUrl: string, version: string, degradedAt?: string): string {
  const shortVersion = version.slice(0, URL_VERSION_LENGTH);
  const token = degradedAt ? `${shortVersion}-d${Date.parse(degradedAt)}` : shortVersion;
  return `${publicUrl}?v=${token}`;
}

/**
 * Devuelve la URL del flyer del reporte, generándolo solo si hace falta. El
 * PNG vive en R2 en una key fija por reporte y lleva en su metadata la
 * versión del contenido con la que se compuso. Si esa versión coincide con
 * la actual, se devuelve la URL sin recomponer el canvas ni volver a subir
 * nada; si no, se regenera y se pisa el objeto. Así no hace falta una columna
 * nueva en la tabla de reportes. La URL devuelta va versionada (`?v=`), ver
 * versionedFlyerUrl.
 *
 * Dos primeras requests concurrentes pueden regenerar el mismo flyer a la
 * vez: es idempotente (mismo contenido ⇒ mismo PNG y misma key) y, si el
 * reporte cambió en el medio, la próxima request detecta la versión vieja y
 * se corrige sola.
 */
// mascota vinculada y teléfono del autor (solo si lo autorizó)
async function loadFlyerDetails(report: ReportDTO): Promise<FlyerDetails> {
  const [pet, user] = await Promise.all([
    report.petId !== null
      ? prisma.pet.findUnique({ where: { id: report.petId }, select: { name: true, breed: true, color: true } })
      : null,
    report.showPhoneOnFlyer
      ? prisma.user.findUnique({ where: { id: report.userId }, select: { phone: true } })
      : null,
  ]);
  return {
    petName: pet?.name ?? null,
    petBreed: pet?.breed ?? null,
    petColor: pet?.color ?? null,
    phone: user?.phone ?? null,
  };
}

export async function getOrCreateFlyerUrl(report: ReportDTO): Promise<string> {
  const key = flyerObjectKey(report.id);
  const details = await loadFlyerDetails(report);
  const version = flyerVersion(report, details);

  const stored = await storageService.getObjectMetadata(key);
  if (stored?.[FLYER_VERSION_METADATA_KEY] === version) {
    const storedDegradedAt = stored[FLYER_DEGRADED_AT_METADATA_KEY];
    if (!storedDegradedAt) {
      return versionedFlyerUrl(storageService.publicObjectUrl(key), version);
    }
    if (!isDegradedRetryDue(storedDegradedAt, Date.now())) {
      return versionedFlyerUrl(storageService.publicObjectUrl(key), version, storedDegradedAt);
    }
    // flyer degradado con la ventana vencida: se reintenta bajar la foto
  }

  const petImage = await fetchPetImage(report.imageUrl);
  const buffer = composeFlyer(report, petImage, details);

  // Si el reporte tiene foto pero no se pudo bajar, el flyer sale con el
  // placeholder: se sube igual para no dejar al usuario sin flyer, marcado
  // como degradado para que se sirva desde el cache solo hasta que venza
  // DEGRADED_FLYER_RETRY_MS (y no se recomponga en cada request).
  const photoMissing = Boolean(report.imageUrl) && petImage === null;
  const degradedAt = photoMissing ? new Date().toISOString() : undefined;
  const metadata: Record<string, string> = { [FLYER_VERSION_METADATA_KEY]: version };
  if (degradedAt) {
    metadata[FLYER_DEGRADED_AT_METADATA_KEY] = degradedAt;
  }

  const publicUrl = await storageService.uploadBuffer(key, buffer, "image/png", metadata);
  return versionedFlyerUrl(publicUrl, version, degradedAt);
}

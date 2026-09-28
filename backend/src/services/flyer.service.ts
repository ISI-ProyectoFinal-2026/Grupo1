import { createHash } from "crypto";
import path from "path";
import { GlobalFonts, Image, createCanvas, loadImage } from "@napi-rs/canvas";
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
// Peor caso de texto entre el título y el pie de marca: título a 2 líneas
// (128px) + gap (20) + descripción a 2 líneas (88) + gap (20) + línea de
// zona (~30 con descendentes) ≈ 286px medidos desde el offset inicial de
// 80px del título ⇒ ~366px. 380 deja margen sin pisar el pie de marca.
const PANEL_TEXT_BUDGET = 380;
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
  try {
    return await loadImage(imageUrl);
  } catch {
    return null;
  }
}

function wrapText(
  ctx: ReturnType<ReturnType<typeof createCanvas>["getContext"]>,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines: number
): number {
  const words = text.split(/\s+/);
  let line = "";
  let lines = 0;
  let cursorY = y;

  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (ctx.measureText(candidate).width > maxWidth && line) {
      ctx.fillText(line, x, cursorY);
      line = word;
      cursorY += lineHeight;
      lines += 1;
      if (lines >= maxLines - 1) {
        break;
      }
    } else {
      line = candidate;
    }
  }
  if (lines < maxLines) {
    ctx.fillText(line, x, cursorY);
    cursorY += lineHeight;
  }
  return cursorY;
}

export function composeFlyer(report: ReportDTO, petImage: Image | null): Buffer {
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
  }

  // Banda superior con el estado (PERDIDO / ENCONTRADO / RESUELTO).
  ctx.fillStyle = tag.color;
  ctx.fillRect(0, 0, WIDTH, BANNER_HEIGHT);
  ctx.fillStyle = "#FFFFFF";
  ctx.font = `64px ${FONT_BOLD}`;
  ctx.textBaseline = "middle";
  ctx.fillText(tag.label, 40, SAFE_TOP + 45);

  // Panel con los datos del reporte, ocupa hasta el fondo del canvas para no
  // dejar un corte raro, pero todo el texto (incluido el pie de marca) vive
  // por encima de SAFE_BOTTOM.
  ctx.fillStyle = "#111827";
  ctx.fillRect(0, PANEL_Y_START, WIDTH, HEIGHT - PANEL_Y_START);

  ctx.fillStyle = "#FFFFFF";
  ctx.font = `56px ${FONT_BOLD}`;
  ctx.textBaseline = "alphabetic";
  let cursorY = PANEL_Y_START + 80;
  cursorY = wrapText(ctx, report.title, 40, cursorY, WIDTH - 80, 64, 2);

  if (report.description) {
    ctx.font = `36px ${FONT_REGULAR}`;
    ctx.fillStyle = "#D1D5DB";
    // Máximo 2 líneas (no 3): con título de 2 líneas + descripción, el peor
    // caso tiene que seguir entrando antes de FOOTER_Y_START sin pisar nada.
    cursorY = wrapText(ctx, report.description, 40, cursorY + 20, WIDTH - 80, 44, 2);
  }

  if (report.locationAddress) {
    ctx.font = `32px ${FONT_REGULAR}`;
    ctx.fillStyle = "#9CA3AF";
    ctx.fillText(`Zona: ${report.locationAddress}`, 40, cursorY + 20);
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
const FLYER_LAYOUT_VERSION = 1;
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
function flyerVersion(report: ReportDTO): string {
  const renderedFields = [
    FLYER_LAYOUT_VERSION,
    report.title,
    report.description,
    report.locationAddress,
    report.imageUrl,
    report.tag.label,
    report.tag.color,
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
export async function getOrCreateFlyerUrl(report: ReportDTO): Promise<string> {
  const key = flyerObjectKey(report.id);
  const version = flyerVersion(report);

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
  const buffer = composeFlyer(report, petImage);

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

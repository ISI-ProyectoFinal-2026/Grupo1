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

/**
 * Genera (o regenera) el flyer del reporte y lo deja en R2 en una key fija
 * por reporte, así el link es estable y sirve tanto para descargar como para
 * compartir en redes sin necesitar una columna nueva en la tabla de reportes.
 */
export async function getOrCreateFlyerUrl(report: ReportDTO): Promise<string> {
  const petImage = await fetchPetImage(report.imageUrl);
  const buffer = composeFlyer(report, petImage);
  return storageService.uploadBuffer(flyerObjectKey(report.id), buffer, "image/png");
}
import { createHash } from "crypto";
import path from "path";
import { GlobalFonts, Image, Path2D, SKRSContext2D, createCanvas, loadImage } from "@napi-rs/canvas";
import { prisma } from "../db/client";
import { ReportDTO, ReportTag } from "./reports.service";
import * as storageService from "./storage.service";

// 1080x1920 (9:16), mundo "Filete de barrio"
const WIDTH = 1080;
const HEIGHT = 1920;
const MARGIN = 72;
const CONTENT_WIDTH = WIDTH - MARGIN * 2;

// alturas fijas; la foto absorbe el resto
const HEADER_HEIGHT = 290;
const FOOTER_HEIGHT = 200;
const THUMB_GAP = 24;
const THUMB_SIZE = (CONTENT_WIDTH - THUMB_GAP * 2) / 3;
const THUMBS_HEIGHT = THUMB_SIZE + 20;
const MAX_EXTRA_IMAGES = 3;

// paleta (DESIGN.md)
const COLOR = {
  surface: "#F8EDEA",
  paper: "#FFFFFF",
  ink: "#2A1F1A",
  inkMuted: "#6E584E",
  line: "#EEDFD4",
  signal: "#F4B43E",
  caramel: "#C98042",
  caramelSoft: "#F6D6B2",
};

const PLATFORM_NAME = "PATITAS";
const PLATFORM_TAGLINE = "Ayudamos a reencontrar mascotas · patitas.app";
const FONT_DISPLAY = "PatitasFlyerDisplay";
const FONT_BOLD = "PatitasFlyerSansBold";
const FONT_REGULAR = "PatitasFlyerSansRegular";

/**
 * El nombre lógico "sans-serif" no resuelve a ningún font en @napi-rs/canvas
 * y cae en un fallback sin acentos ni ñ: se registran fuentes empaquetadas.
 * Nombres sin guion: con guion, napi-rs/canvas los toma como estilos de la
 * misma familia y resuelve mal la ñ.
 */
function registerFlyerFonts(): void {
  if (GlobalFonts.has(FONT_BOLD)) return;
  const fontFile = (pkg: string, file: string) =>
    path.join(path.dirname(require.resolve(`@fontsource/${pkg}/package.json`)), "files", file);
  GlobalFonts.registerFromPath(fontFile("abril-fatface", "abril-fatface-latin-400-normal.woff2"), FONT_DISPLAY);
  GlobalFonts.registerFromPath(
    fontFile("atkinson-hyperlegible", "atkinson-hyperlegible-latin-700-normal.woff2"),
    FONT_BOLD
  );
  GlobalFonts.registerFromPath(
    fontFile("atkinson-hyperlegible", "atkinson-hyperlegible-latin-400-normal.woff2"),
    FONT_REGULAR
  );
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

// huella rellena del wordmark (misma del empapelado de la app)
const PAW_FILLED =
  "M12 11.5c-2.6 0-5.5 3.4-5.5 6 0 1.6 1.2 2.5 2.7 2.5 1.2 0 1.8-.6 2.8-.6s1.6.6 2.8.6c1.5 0 2.7-.9 2.7-2.5 0-2.6-2.9-6-5.5-6z" +
  "M3.2 10a2.3 2.3 0 1 0 4.6 0a2.3 2.3 0 1 0-4.6 0zM7.2 5.5a2.3 2.3 0 1 0 4.6 0a2.3 2.3 0 1 0-4.6 0z" +
  "M12.2 5.5a2.3 2.3 0 1 0 4.6 0a2.3 2.3 0 1 0-4.6 0zM16.2 10a2.3 2.3 0 1 0 4.6 0a2.3 2.3 0 1 0-4.6 0z";

// íconos de línea 24x24 (trazo, estilo lucide): no dependen de fuentes del sistema
const ICON_PATHS: Record<FlyerIcon, string> = {
  paw: PAW_FILLED,
  pin:
    "M20 10c0 5-5.54 10.19-7.4 11.8a1 1 0 0 1-1.2 0C9.54 20.19 4 15 4 10a8 8 0 0 1 16 0z" +
    "M9 10a3 3 0 1 0 6 0a3 3 0 1 0-6 0z",
  calendar: "M8 2v4M16 2v4M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM3 10h18",
  phone:
    "M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67" +
    "A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6" +
    "l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z",
};

// tonos del sistema para las etiquetas conocidas (como tag-tone.ts del front)
const TAG_TONES: Record<string, string> = {
  PERDIDO: "#C4342B",
  ENCONTRADO: "#2457A6",
  RESUELTO: "#1F7A4D",
};

export function flyerTone(tag: Pick<ReportTag, "color"> & { label: string }): string {
  return TAG_TONES[tag.label.trim().toUpperCase()] ?? tag.color;
}

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

function strokeIcon(ctx: SKRSContext2D, icon: FlyerIcon, x: number, y: number, size: number, color: string): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 24, size / 24);
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.stroke(new Path2D(ICON_PATHS[icon]));
  ctx.restore();
}

function fillPaw(ctx: SKRSContext2D, x: number, y: number, size: number, color: string): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 24, size / 24);
  ctx.fillStyle = color;
  ctx.fill(new Path2D(PAW_FILLED));
  ctx.restore();
}

// una sola línea, recortada con "…" si no entra
function fitText(ctx: SKRSContext2D, text: string, maxWidth: number): string {
  const measure = (value: string) => ctx.measureText(value).width;
  return measure(text) <= maxWidth ? text : withEllipsis(text, maxWidth, measure);
}

export interface FlyerBox {
  y: number;
  height: number;
}

export interface FlyerLayout {
  header: FlyerBox;
  photo: FlyerBox;
  thumbs: FlyerBox | null;
  info: FlyerBox;
  footer: FlyerBox;
}

// reparto vertical sin huecos: la foto se queda con lo que sobra
export function flyerLayout({ hasExtras, infoHeight }: { hasExtras: boolean; infoHeight: number }): FlyerLayout {
  const thumbsHeight = hasExtras ? THUMBS_HEIGHT : 0;
  const photoHeight = HEIGHT - HEADER_HEIGHT - thumbsHeight - infoHeight - FOOTER_HEIGHT;
  const header = { y: 0, height: HEADER_HEIGHT };
  const photo = { y: HEADER_HEIGHT, height: photoHeight };
  const thumbs = hasExtras ? { y: photo.y + photo.height, height: thumbsHeight } : null;
  const info = { y: photo.y + photo.height + thumbsHeight, height: infoHeight };
  const footer = { y: info.y + info.height, height: FOOTER_HEIGHT };
  return { header, photo, thumbs, info, footer };
}

// tipografía del bloque de información
const TITLE = { size: 60, line: 70, maxLines: 2 };
const BODY = { size: 38, line: 52 };
const ROW = { size: 38, line: 64, icon: 42, phoneSize: 44 };
const INFO_PAD_TOP = 44;
const INFO_PAD_BOTTOM = 28;
const DESC_GAP = 14;
const ROWS_GAP = 26;
const ROW_TEXT_X = MARGIN + ROW.icon + 22;

interface InfoPlan {
  titleLines: string[];
  descLines: string[];
  rows: FlyerInfoRow[];
  height: number;
}

function planInfo(ctx: SKRSContext2D, report: ReportDTO, details: FlyerDetails, hasExtras: boolean): InfoPlan {
  const measure = (value: string) => ctx.measureText(value).width;
  ctx.font = `${TITLE.size}px ${FONT_BOLD}`;
  const titleLines = wrapLines(report.title, CONTENT_WIDTH, TITLE.maxLines, measure);
  ctx.font = `${BODY.size}px ${FONT_REGULAR}`;
  // con miniaturas la descripción cede una línea a la foto
  const descLines = wrapLines(present(report.description) ?? "", CONTENT_WIDTH, hasExtras ? 2 : 3, measure);
  const rows = flyerInfoRows(report, details);
  const height =
    INFO_PAD_TOP +
    titleLines.length * TITLE.line +
    (descLines.length ? DESC_GAP + descLines.length * BODY.line : 0) +
    ROWS_GAP +
    rows.length * ROW.line +
    INFO_PAD_BOTTOM;
  return { titleLines, descLines, rows, height };
}

// empapelado de barrio: huellas y huesitos muy tenues (como el body de la app)
// el texto queda sobre revoque liso
function drawWallpaper(ctx: SKRSContext2D, textBox: FlyerBox): void {
  const tile = 280;
  const k = tile / 140;
  ctx.save();
  const clip = new Path2D();
  clip.rect(0, 0, WIDTH, HEIGHT);
  clip.rect(0, textBox.y, WIDTH, textBox.height);
  ctx.clip(clip, "evenodd");
  ctx.fillStyle = "rgba(42, 31, 26, 0.05)";
  for (let ty = 0; ty < HEIGHT; ty += tile) {
    for (let tx = 0; tx < WIDTH; tx += tile) {
      ctx.save();
      ctx.translate(tx + 18 * k, ty + 20 * k);
      ctx.rotate((-18 * Math.PI) / 180);
      ctx.scale(k, k);
      ctx.fill(new Path2D(PAW_FILLED));
      ctx.restore();
      ctx.save();
      ctx.translate(tx + 78 * k, ty + 88 * k);
      ctx.rotate((28 * Math.PI) / 180);
      ctx.scale(k, k);
      ctx.fill(
        new Path2D(
          "M6 3h16a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" +
            "M1.5 3.5a3 3 0 1 0 6 0a3 3 0 1 0-6 0zM1.5 8.5a3 3 0 1 0 6 0a3 3 0 1 0-6 0z" +
            "M20.5 3.5a3 3 0 1 0 6 0a3 3 0 1 0-6 0zM20.5 8.5a3 3 0 1 0 6 0a3 3 0 1 0-6 0z"
        )
      );
      ctx.restore();
    }
  }
  ctx.restore();
}

// filete: doble línea dorada con un rombo al centro
function drawFilete(ctx: SKRSContext2D, y: number, accent: string): void {
  const cx = WIDTH / 2;
  const gap = 34;
  ctx.save();
  ctx.fillStyle = COLOR.signal;
  ctx.fillRect(MARGIN, y - 4, cx - gap - MARGIN, 5);
  ctx.fillRect(cx + gap, y - 4, WIDTH - MARGIN - cx - gap, 5);
  ctx.fillRect(MARGIN, y + 6, cx - gap - MARGIN, 2);
  ctx.fillRect(cx + gap, y + 6, WIDTH - MARGIN - cx - gap, 2);
  ctx.beginPath();
  ctx.moveTo(cx, y - 18);
  ctx.lineTo(cx + 20, y + 2);
  ctx.lineTo(cx, y + 22);
  ctx.lineTo(cx - 20, y + 2);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.arc(cx, y + 2, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// foto pegada sobre papel: borde blanco y sombra suave
function drawPaperFrame(ctx: SKRSContext2D, x: number, y: number, w: number, h: number, blur: number): void {
  ctx.save();
  ctx.shadowColor = "rgba(42, 31, 26, 0.18)";
  ctx.shadowBlur = blur;
  ctx.shadowOffsetY = blur / 3;
  ctx.fillStyle = COLOR.paper;
  ctx.fillRect(x, y, w, h);
  ctx.restore();
}

// recorte "cover" dentro del rectángulo
function drawCover(ctx: SKRSContext2D, image: Image, x: number, y: number, w: number, h: number): void {
  const scale = Math.max(w / image.width, h / image.height);
  const sw = w / scale;
  const sh = h / scale;
  ctx.drawImage(image, (image.width - sw) / 2, (image.height - sh) / 2, sw, sh, x, y, w, h);
}

// perro de la app (DogFace) para el reporte sin foto
function drawDogFace(ctx: SKRSContext2D, cx: number, cy: number, width: number): void {
  const k = width / 80;
  ctx.save();
  ctx.translate(cx - 48 * k, cy - 45 * k);
  ctx.scale(k, k);
  ctx.lineJoin = "round";
  ctx.strokeStyle = COLOR.ink;
  ctx.lineWidth = 2.5;
  for (const ear of ["M33 28C24 20 12 24 12 36c0 10 6 16 12 14 5-8 8-14 9-22Z", "M63 28c9-8 21-4 21 8 0 10-6 16-12 14-5-8-8-14-9-22Z"]) {
    const p = new Path2D(ear);
    ctx.fillStyle = COLOR.caramel;
    ctx.fill(p);
    ctx.stroke(p);
  }
  ctx.beginPath();
  ctx.ellipse(48, 46, 22, 21, 0, 0, Math.PI * 2);
  ctx.fillStyle = COLOR.caramelSoft;
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(48, 53, 11, 8, 0, 0, Math.PI * 2);
  ctx.fillStyle = COLOR.paper;
  ctx.fill();
  ctx.fillStyle = COLOR.ink;
  ctx.beginPath();
  ctx.arc(40, 41, 2.8, 0, Math.PI * 2);
  ctx.arc(56, 41, 2.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(48, 50, 4.5, 3.2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// chapita de collar con argolla (como .tag-sticker)
function drawNameTag(ctx: SKRSContext2D, name: string, x: number, centerY: number, tone: string): void {
  const height = 84;
  const ring = 13;
  ctx.font = `44px ${FONT_BOLD}`;
  const text = fitText(ctx, name, CONTENT_WIDTH - 160);
  const textWidth = ctx.measureText(text).width;
  const width = 30 + ring * 2 + 18 + textWidth + 36;
  const y = centerY - height / 2;
  ctx.save();
  ctx.shadowColor = "rgba(42, 31, 26, 0.22)";
  ctx.shadowBlur = 18;
  ctx.shadowOffsetY = 6;
  ctx.fillStyle = tone;
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, height / 2);
  ctx.fill();
  ctx.restore();
  ctx.save();
  ctx.fillStyle = COLOR.paper;
  ctx.strokeStyle = "rgba(0, 0, 0, 0.18)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(x + 30 + ring, centerY, ring, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = COLOR.paper;
  ctx.textBaseline = "middle";
  ctx.fillText(text, x + 30 + ring * 2 + 18, centerY + 2);
  ctx.restore();
}

function drawHeader(ctx: SKRSContext2D, box: FlyerBox, label: string, tone: string): void {
  const ruleY = box.y + box.height - 46;
  const word = label.trim().toUpperCase();
  let size = 200;
  ctx.font = `${size}px ${FONT_DISPLAY}`;
  while (size > 80 && ctx.measureText(word).width > CONTENT_WIDTH) {
    size -= 4;
    ctx.font = `${size}px ${FONT_DISPLAY}`;
  }
  const metrics = ctx.measureText(word);
  const capHeight = metrics.actualBoundingBoxAscent;
  // centrado óptico entre el borde y el filete
  const top = box.y + 70;
  const baseline = top + (ruleY - 34 - top + capHeight) / 2;
  ctx.save();
  ctx.fillStyle = tone;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(word, WIDTH / 2, baseline);
  ctx.restore();
  drawFilete(ctx, ruleY, tone);
}

function drawPhoto(
  ctx: SKRSContext2D,
  box: FlyerBox,
  petImage: Image | null,
  petName: string | null,
  tone: string
): void {
  const border = 16;
  // espacio bajo la foto para la mitad de la chapita
  const bottom = petName ? 56 : 12;
  const frame = { x: MARGIN, y: box.y + 12, w: CONTENT_WIDTH, h: box.height - 12 - bottom };
  drawPaperFrame(ctx, frame.x, frame.y, frame.w, frame.h, 36);
  const inner = { x: frame.x + border, y: frame.y + border, w: frame.w - border * 2, h: frame.h - border * 2 };
  if (petImage) {
    drawCover(ctx, petImage, inner.x, inner.y, inner.w, inner.h);
  } else {
    ctx.fillStyle = COLOR.caramelSoft;
    ctx.fillRect(inner.x, inner.y, inner.w, inner.h);
    drawDogFace(ctx, WIDTH / 2, inner.y + inner.h / 2, Math.min(inner.w, inner.h) * 0.5);
  }
  if (petName) drawNameTag(ctx, petName, frame.x + 40, frame.y + frame.h, tone);
}

function drawThumbs(ctx: SKRSContext2D, box: FlyerBox, images: Image[]): void {
  const border = 8;
  const total = images.length * THUMB_SIZE + (images.length - 1) * THUMB_GAP;
  let x = (WIDTH - total) / 2;
  const y = box.y + box.height - THUMB_SIZE;
  for (const image of images) {
    drawPaperFrame(ctx, x, y, THUMB_SIZE, THUMB_SIZE, 22);
    drawCover(ctx, image, x + border, y + border, THUMB_SIZE - border * 2, THUMB_SIZE - border * 2);
    x += THUMB_SIZE + THUMB_GAP;
  }
}

function drawInfo(ctx: SKRSContext2D, box: FlyerBox, plan: InfoPlan, tone: string): void {
  ctx.save();
  ctx.textBaseline = "middle";
  let y = box.y + INFO_PAD_TOP;
  ctx.fillStyle = COLOR.ink;
  ctx.font = `${TITLE.size}px ${FONT_BOLD}`;
  for (const line of plan.titleLines) {
    ctx.fillText(line, MARGIN, y + TITLE.line / 2);
    y += TITLE.line;
  }
  if (plan.descLines.length) {
    y += DESC_GAP;
    ctx.fillStyle = COLOR.inkMuted;
    ctx.font = `${BODY.size}px ${FONT_REGULAR}`;
    for (const line of plan.descLines) {
      ctx.fillText(line, MARGIN, y + BODY.line / 2);
      y += BODY.line;
    }
  }
  y += ROWS_GAP;
  for (const row of plan.rows) {
    const mid = y + ROW.line / 2;
    strokeIcon(ctx, row.icon, MARGIN, mid - ROW.icon / 2, ROW.icon, tone);
    // el teléfono es la acción: más grande y en negrita
    const isPhone = row.icon === "phone";
    ctx.font = isPhone ? `${ROW.phoneSize}px ${FONT_BOLD}` : `${ROW.size}px ${FONT_REGULAR}`;
    ctx.fillStyle = COLOR.ink;
    ctx.fillText(fitText(ctx, row.text, WIDTH - MARGIN - ROW_TEXT_X), ROW_TEXT_X, mid + 1);
    y += ROW.line;
  }
  ctx.restore();
}

// wordmark de la app: chapita dorada con huella + PATITAS
function drawFooter(ctx: SKRSContext2D, box: FlyerBox): void {
  ctx.save();
  ctx.fillStyle = COLOR.line;
  ctx.fillRect(MARGIN, box.y + 10, CONTENT_WIDTH, 2);
  const badge = 72;
  ctx.font = `64px ${FONT_DISPLAY}`;
  const wordWidth = ctx.measureText(PLATFORM_NAME).width;
  const rowWidth = badge + 22 + wordWidth;
  const left = (WIDTH - rowWidth) / 2;
  const midY = box.y + 74;
  ctx.save();
  ctx.translate(left + badge / 2, midY);
  ctx.rotate((-6 * Math.PI) / 180);
  ctx.fillStyle = COLOR.signal;
  ctx.beginPath();
  ctx.arc(0, 0, badge / 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = COLOR.paper;
  ctx.strokeStyle = "rgba(42, 31, 26, 0.7)";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(0, -badge / 2 + 2, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  fillPaw(ctx, -20, -18, 40, COLOR.ink);
  ctx.restore();
  ctx.fillStyle = COLOR.ink;
  ctx.textBaseline = "middle";
  ctx.fillText(PLATFORM_NAME, left + badge + 22, midY + 4);
  ctx.font = `30px ${FONT_REGULAR}`;
  ctx.fillStyle = COLOR.inkMuted;
  ctx.textAlign = "center";
  ctx.fillText(PLATFORM_TAGLINE, WIDTH / 2, box.y + 138);
  ctx.restore();
}

export function composeFlyer(
  report: ReportDTO,
  petImage: Image | null,
  details: FlyerDetails = NO_DETAILS,
  extraImages: Image[] = []
): Buffer {
  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext("2d");
  const tone = flyerTone(report.tag);
  const thumbs = extraImages.slice(0, MAX_EXTRA_IMAGES);
  const hasExtras = thumbs.length > 0;

  const plan = planInfo(ctx, report, details, hasExtras);
  const layout = flyerLayout({ hasExtras, infoHeight: plan.height });

  ctx.fillStyle = COLOR.surface;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  drawWallpaper(ctx, { y: layout.info.y, height: layout.info.height + 130 });

  drawHeader(ctx, layout.header, report.tag.label, tone);
  if (layout.thumbs) drawThumbs(ctx, layout.thumbs, thumbs);
  drawPhoto(ctx, layout.photo, petImage, present(details.petName), tone);
  drawInfo(ctx, layout.info, plan, tone);
  drawFooter(ctx, layout.footer);

  return canvas.toBuffer("image/png");
}

function flyerObjectKey(reportId: number): string {
  return `flyers/report-${reportId}.png`;
}

// Subir este número cuando cambie el diseño de composeFlyer, para invalidar
// todos los flyers ya generados con el layout anterior.
const FLYER_LAYOUT_VERSION = 3;
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
    (report.extraImageUrls ?? []).slice(0, MAX_EXTRA_IMAGES),
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

// fotos extra: mismas reglas que la principal; la que falla se omite
async function fetchExtraImages(urls: string[] | undefined): Promise<Image[]> {
  const images = await Promise.all((urls ?? []).slice(0, MAX_EXTRA_IMAGES).map(fetchPetImage));
  return images.filter((image): image is Image => image !== null);
}

// compone el PNG; photoMissing indica foto principal que no se pudo bajar
export async function renderFlyer(
  report: ReportDTO,
  details: FlyerDetails
): Promise<{ buffer: Buffer; photoMissing: boolean }> {
  const [petImage, extraImages] = await Promise.all([
    fetchPetImage(report.imageUrl),
    fetchExtraImages(report.extraImageUrls),
  ]);
  const buffer = composeFlyer(report, petImage, details, extraImages);
  return { buffer, photoMissing: Boolean(report.imageUrl) && petImage === null };
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

  const { buffer, photoMissing } = await renderFlyer(report, details);

  // Si el reporte tiene foto pero no se pudo bajar, el flyer sale con el
  // placeholder: se sube igual para no dejar al usuario sin flyer, marcado
  // como degradado para que se sirva desde el cache solo hasta que venza
  // DEGRADED_FLYER_RETRY_MS (y no se recomponga en cada request).
  const degradedAt = photoMissing ? new Date().toISOString() : undefined;
  const metadata: Record<string, string> = { [FLYER_VERSION_METADATA_KEY]: version };
  if (degradedAt) {
    metadata[FLYER_DEGRADED_AT_METADATA_KEY] = degradedAt;
  }

  const publicUrl = await storageService.uploadBuffer(key, buffer, "image/png", metadata);
  return versionedFlyerUrl(publicUrl, version, degradedAt);
}

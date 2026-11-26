import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { ReportStatus } from "@prisma/client";
import { passwordSchema } from "../validators/auth.validator";

// helpers del seed de demo (#371)
export const DEMO_ASSETS_DIR = path.resolve(__dirname, "../../demo-assets");

const ALLOWED_LICENSES = new Set(["Public domain", "CC0 1.0"]);

export function assertDemoSeedAllowed(env: NodeJS.ProcessEnv = process.env): string {
  if (env.NODE_ENV === "production") {
    throw new Error("El seed de demo no corre con NODE_ENV=production");
  }
  const password = env.SEED_DEMO_PASSWORD?.trim();
  if (!password) {
    throw new Error("Falta SEED_DEMO_PASSWORD: definí la contraseña de los usuarios de demo en backend/.env");
  }
  if (!passwordSchema.safeParse(password).success) {
    throw new Error("SEED_DEMO_PASSWORD no cumple la regla del registro: 8 caracteres, mayúscula, minúscula y número");
  }
  return password;
}

export interface DemoAsset {
  file: string;
  body: Buffer;
  sha256: string;
}

interface ManifestImage {
  file?: string;
  license?: string;
  source?: string;
  sha256?: string;
}

export function loadDemoAssets(dir: string = DEMO_ASSETS_DIR): Map<string, DemoAsset> {
  const manifest = JSON.parse(readFileSync(path.join(dir, "manifest.json"), "utf8")) as { images: ManifestImage[] };
  const assets = new Map<string, DemoAsset>();
  for (const image of manifest.images) {
    if (!image.file || !image.source || !image.license || !ALLOWED_LICENSES.has(image.license)) {
      throw new Error(`${image.file ?? "imagen"}: falta la fuente o la licencia (dominio público o CC0) en el manifiesto`);
    }
    const body = readFileSync(path.join(dir, image.file));
    const sha256 = createHash("sha256").update(body).digest("hex");
    if (sha256 !== image.sha256) {
      throw new Error(`${image.file}: el sha256 no coincide con el manifiesto`);
    }
    assets.set(image.file, { file: image.file, body, sha256 });
  }
  return assets;
}

export interface DemoStorage {
  getObjectMetadata(key: string): Promise<Record<string, string> | null>;
  uploadBuffer(key: string, body: Buffer, contentType: string): Promise<string>;
  publicObjectUrl(key: string): string;
}

// clave por contenido: re-ejecutar no duplica objetos en R2
export async function uploadDemoAssets(assets: Map<string, DemoAsset>, storage: DemoStorage): Promise<Map<string, string>> {
  const urls = new Map<string, string>();
  for (const asset of assets.values()) {
    const key = `demo/${asset.sha256}.jpg`;
    const exists = (await storage.getObjectMetadata(key)) !== null;
    urls.set(asset.file, exists ? storage.publicObjectUrl(key) : await storage.uploadBuffer(key, asset.body, "image/jpeg"));
  }
  return urls;
}

export interface WaitOptions {
  timeoutMs: number;
  intervalMs: number;
}

export async function waitForReportStatus(
  readStatus: () => Promise<ReportStatus | null>,
  { timeoutMs, intervalMs }: WaitOptions
): Promise<ReportStatus> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const status = await readStatus();
    if (status === null) throw new Error("El reporte no existe");
    if (status !== "pending") return status;
    if (Date.now() >= deadline) {
      throw new Error(`El reporte sigue pending después de ${timeoutMs / 1000} s: revisá el Backend IA y R2`);
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}

export interface DemoScores {
  pair: number | null;
  negative: number | null;
  negativeMatched: boolean;
}

export function checkDemoScores(
  scores: DemoScores,
  thresholds: { matchThreshold: number; notifyThreshold: number }
): string[] {
  const problems: string[] = [];
  if (scores.pair === null) {
    problems.push("El par de la misma mascota no generó coincidencia");
  } else if (scores.pair < thresholds.notifyThreshold) {
    problems.push(`El par dio ${scores.pair.toFixed(3)}, por debajo de ${thresholds.notifyThreshold}`);
  }
  if (scores.negativeMatched) {
    problems.push("El caso negativo generó una coincidencia");
  } else if (scores.negative === null || scores.negative >= thresholds.matchThreshold) {
    problems.push(`El caso negativo dio ${scores.negative?.toFixed(3) ?? "sin embedding"}, no queda por debajo de ${thresholds.matchThreshold}`);
  }
  return problems;
}

import { HeadBucketCommand } from "@aws-sdk/client-s3";
import { pingAiService } from "../config/ai-service";
import { prisma } from "../db/client";
import { AppError } from "../errors/app-error";
import { createMailSender } from "../services/mail";
import { SmtpMailSender } from "../services/mail/smtp-mail-sender";
import { DEFAULT_USER_AGENT } from "../services/reverse-geocode.service";
import { assertR2Configured, getS3Client } from "../services/storage.service";

// preflight de la demo (#370)
export type CheckStatus = "OK" | "WARN" | "FAIL";

export interface CheckOutcome {
  status: CheckStatus;
  message: string;
}

export interface CheckResult extends CheckOutcome {
  name: string;
}

export interface PreflightCheck {
  name: string;
  run: () => Promise<CheckOutcome>;
}

export interface PreflightOptions {
  checkTimeoutMs?: number;
  globalTimeoutMs?: number;
}

const CHECK_TIMEOUT_MS = 8_000;
const GLOBAL_TIMEOUT_MS = 30_000;
const OSM_TILE_URL = "https://tile.openstreetmap.org/0/0/0.png";

const ok = (message: string): CheckOutcome => ({ status: "OK", message });
const warn = (message: string): CheckOutcome => ({ status: "WARN", message });
const fail = (message: string): CheckOutcome => ({ status: "FAIL", message });

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message || error.name : String(error);
}

function requestSignal(): AbortSignal {
  return AbortSignal.timeout(CHECK_TIMEOUT_MS);
}

export async function checkR2(env: NodeJS.ProcessEnv = process.env): Promise<CheckOutcome> {
  try {
    assertR2Configured(env);
  } catch (error) {
    const missing = (error as AppError).details as { missingEnvVars?: string[] } | undefined;
    return fail(`Faltan variables de R2: ${missing?.missingEnvVars?.join(", ") ?? errorMessage(error)}`);
  }

  try {
    await getS3Client(env).send(new HeadBucketCommand({ Bucket: env.R2_BUCKET_NAME }));
  } catch (error) {
    return fail(`No se pudo acceder al bucket ${env.R2_BUCKET_NAME}: ${errorMessage(error)} (revisá R2_ENDPOINT y las credenciales)`);
  }

  const objectKey = env.PREFLIGHT_R2_OBJECT_KEY?.trim();
  if (!objectKey) {
    return warn(
      "Bucket accesible, pero no se verificó la URL pública: definí PREFLIGHT_R2_OBJECT_KEY con la clave de un objeto existente"
    );
  }

  const publicUrl = `${env.R2_PUBLIC_URL}/${objectKey}`;
  try {
    const response = await fetch(publicUrl, { method: "HEAD", signal: requestSignal() });
    if (!response.ok) return fail(`La URL pública ${publicUrl} respondió ${response.status} (revisá R2_PUBLIC_URL)`);
  } catch (error) {
    return fail(`No se pudo acceder a la URL pública ${publicUrl}: ${errorMessage(error)}`);
  }
  return ok("Bucket accesible y URL pública respondiendo");
}

export async function checkInternalKey(env: NodeJS.ProcessEnv = process.env): Promise<CheckOutcome> {
  const baseUrl = env.AI_SERVICE_URL?.trim();
  if (!baseUrl) return fail("AI_SERVICE_URL no está configurada en el backend");
  if (!env.INTERNAL_API_KEY) return fail("INTERNAL_API_KEY no está configurada en el backend");

  let status: number;
  try {
    // cuerpo vacío: la clave se valida antes que el cuerpo, no consume R2 ni modelos
    const response = await fetch(`${baseUrl}/images/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Internal-Key": env.INTERNAL_API_KEY },
      signal: requestSignal(),
    });
    status = response.status;
  } catch (error) {
    return fail(`No se pudo contactar al Backend IA en ${baseUrl}: ${errorMessage(error)}`);
  }

  if (status === 422) return ok("La clave interna coincide con la del Backend IA");
  if (status === 401) {
    return fail("Las claves no coinciden: INTERNAL_API_KEY tiene que ser igual en backend/.env y backend-ia/.env");
  }
  return warn(`Respuesta inesperada del Backend IA (${status}) al validar la clave interna`);
}

export async function checkAiService(env: NodeJS.ProcessEnv = process.env): Promise<CheckOutcome> {
  const status = await pingAiService(env);
  if (status === "ok") return ok("El Backend IA responde en /health");
  if (status === "not_configured") {
    return fail("AI_SERVICE_URL no está configurada: los reportes con foto quedan en pending");
  }
  return fail(`El Backend IA no responde en ${env.AI_SERVICE_URL}/health: los reportes con foto quedan en pending`);
}

export async function checkOsmTiles(env: NodeJS.ProcessEnv = process.env): Promise<CheckOutcome> {
  const userAgent = env.NOMINATIM_USER_AGENT || DEFAULT_USER_AGENT;
  try {
    const response = await fetch(OSM_TILE_URL, {
      method: "HEAD",
      headers: { "User-Agent": userAgent },
      signal: requestSignal(),
    });
    if (response.ok) return ok("Los tiles de OpenStreetMap responden");
    return fail(`Los tiles de OpenStreetMap respondieron ${response.status}: el mapa se verá gris`);
  } catch (error) {
    return fail(`No se pudo acceder a OpenStreetMap (${errorMessage(error)}): el mapa se verá gris`);
  }
}

export async function checkSmtp(env: NodeJS.ProcessEnv = process.env): Promise<CheckOutcome> {
  if (!env.SMTP_HOST) {
    if (env.NODE_ENV === "production") {
      return fail("Falta SMTP_HOST con NODE_ENV=production: el registro y el reset de contraseña responden 503");
    }
    return warn("Modo consola: los mails se imprimen en los logs del backend (docker compose logs backend)");
  }

  try {
    await (createMailSender(env) as SmtpMailSender).verify();
  } catch (error) {
    return fail(`El servidor SMTP ${env.SMTP_HOST} rechazó la conexión: ${errorMessage(error)}`);
  }
  return ok(`El servidor SMTP ${env.SMTP_HOST} acepta la conexión`);
}

// versión mínima con índices HNSW (ADR-0032, #336)
const PGVECTOR_MIN_VERSION = [0, 5, 0];

async function readPgvectorVersion(): Promise<string | null> {
  const rows = await prisma.$queryRaw<{ extversion: string }[]>`
    SELECT extversion FROM pg_extension WHERE extname = 'vector'
  `;
  return rows[0]?.extversion ?? null;
}

function isAtLeast(version: string, minimum: number[]): boolean {
  const parts = version.split(".").map((part) => parseInt(part, 10) || 0);
  for (let i = 0; i < minimum.length; i++) {
    if ((parts[i] ?? 0) !== minimum[i]) return (parts[i] ?? 0) > minimum[i];
  }
  return true;
}

export async function checkPgvector(readVersion: () => Promise<string | null> = readPgvectorVersion): Promise<CheckOutcome> {
  let version: string | null;
  try {
    version = await readVersion();
  } catch (error) {
    return fail(`No se pudo consultar la base de datos: ${errorMessage(error)}`);
  }
  const minimum = PGVECTOR_MIN_VERSION.join(".");
  if (!version) return fail("La extensión pgvector no está instalada (revisá la imagen docker/postgres)");
  if (!isAtLeast(version, PGVECTOR_MIN_VERSION)) {
    return fail(`pgvector ${version} no soporta índices HNSW; se requiere ${minimum} o superior`);
  }
  return ok(`pgvector ${version} instalado`);
}

export function defaultChecks(env: NodeJS.ProcessEnv = process.env): PreflightCheck[] {
  return [
    { name: "pgvector", run: () => checkPgvector() },
    { name: "R2", run: () => checkR2(env) },
    { name: "INTERNAL_API_KEY", run: () => checkInternalKey(env) },
    { name: "Backend IA", run: () => checkAiService(env) },
    { name: "OpenStreetMap", run: () => checkOsmTiles(env) },
    { name: "SMTP", run: () => checkSmtp(env) },
  ];
}

function timeout(ms: number, message: string): { promise: Promise<CheckOutcome>; cancel: () => void } {
  let timer: NodeJS.Timeout | undefined;
  const promise = new Promise<CheckOutcome>((resolve) => {
    timer = setTimeout(() => resolve(fail(message)), ms);
  });
  return { promise, cancel: () => clearTimeout(timer) };
}

async function runCheck(check: PreflightCheck, timeoutMs: number): Promise<CheckOutcome> {
  const limit = timeout(timeoutMs, `sin respuesta en ${timeoutMs / 1000} s`);
  try {
    return await Promise.race([check.run(), limit.promise]);
  } catch (error) {
    return fail(errorMessage(error));
  } finally {
    limit.cancel();
  }
}

export async function runPreflight(checks: PreflightCheck[], options: PreflightOptions = {}): Promise<CheckResult[]> {
  const checkTimeoutMs = options.checkTimeoutMs ?? CHECK_TIMEOUT_MS;
  const globalTimeoutMs = options.globalTimeoutMs ?? GLOBAL_TIMEOUT_MS;
  const outcomes: (CheckOutcome | undefined)[] = checks.map(() => undefined);

  const all = Promise.all(
    checks.map(async (check, index) => {
      outcomes[index] = await runCheck(check, checkTimeoutMs);
    })
  );
  const limit = timeout(globalTimeoutMs, "");
  await Promise.race([all, limit.promise]);
  limit.cancel();

  return checks.map((check, index) => ({
    name: check.name,
    ...(outcomes[index] ?? fail(`sin respuesta antes del tope global de ${globalTimeoutMs / 1000} s`)),
  }));
}

export function preflightExitCode(results: CheckResult[]): number {
  return results.some((result) => result.status === "FAIL") ? 1 : 0;
}

export function formatPreflightReport(results: CheckResult[]): string {
  const nameWidth = Math.max(...results.map((result) => result.name.length));
  return results
    .map((result) => `${result.status.padEnd(4)}  ${result.name.padEnd(nameWidth)}  ${result.message}`)
    .join("\n");
}

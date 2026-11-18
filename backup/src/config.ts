export type Env = Record<string, string | undefined>;

export interface R2Config {
  endpoint: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
}

export interface BackupConfig {
  databaseUrl: string;
  backupDir: string;
  backupHour: number;
  sourceImagesBucket: string;
  r2: R2Config;
}

const R2_VARS = [
  "BACKUP_R2_ENDPOINT",
  "BACKUP_R2_ACCESS_KEY_ID",
  "BACKUP_R2_SECRET_ACCESS_KEY",
  "BACKUP_R2_BUCKET",
] as const;

const BACKUP_VARS = ["DATABASE_URL", ...R2_VARS, "SOURCE_IMAGES_BUCKET"] as const;

export const DEFAULT_BACKUP_DIR = "/backups";
const DEFAULT_BACKUP_HOUR = 3;

export class ConfigError extends Error {
  constructor(
    message: string,
    readonly missing: string[] = []
  ) {
    super(message);
    this.name = "ConfigError";
  }
}

// mismo criterio que storage.service.ts del backend: un error que nombra lo que falta
function assertPresent(env: Env, names: readonly string[]): void {
  const missing = names.filter((name) => !env[name]);
  if (missing.length > 0) {
    throw new ConfigError(
      `Faltan variables de entorno para el backup: ${missing.join(", ")}`,
      missing
    );
  }
}

function parseHour(raw: string | undefined): number {
  if (raw === undefined || raw === "") return DEFAULT_BACKUP_HOUR;
  const hour = Number(raw);
  if (!/^\d{1,2}$/.test(raw) || hour > 23) {
    throw new ConfigError(`BACKUP_HOUR debe ser un entero entre 0 y 23 (valor: "${raw}")`);
  }
  return hour;
}

export function loadR2Config(env: Env): R2Config {
  assertPresent(env, R2_VARS);
  return {
    endpoint: env.BACKUP_R2_ENDPOINT as string,
    accessKeyId: env.BACKUP_R2_ACCESS_KEY_ID as string,
    secretAccessKey: env.BACKUP_R2_SECRET_ACCESS_KEY as string,
    bucket: env.BACKUP_R2_BUCKET as string,
  };
}

export function loadBackupConfig(env: Env): BackupConfig {
  assertPresent(env, BACKUP_VARS);
  return {
    databaseUrl: env.DATABASE_URL as string,
    backupDir: env.BACKUP_DIR || DEFAULT_BACKUP_DIR,
    backupHour: parseHour(env.BACKUP_HOUR),
    sourceImagesBucket: env.SOURCE_IMAGES_BUCKET as string,
    r2: loadR2Config(env),
  };
}

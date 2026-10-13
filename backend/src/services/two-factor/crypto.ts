import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "crypto";
import { AppError } from "../../errors/app-error";

const KEY_ENV_VAR = "TWO_FACTOR_ENCRYPTION_KEY";
const KEY_BYTES = 32;
const IV_BYTES = 12;
const TAG_BYTES = 16;
const VERSION = "v1";
const HKDF_INFO = "patitas-2fa-v1";

function notConfigured(reason: string): AppError {
  return new AppError(
    503,
    `El segundo factor no está configurado (${reason} ${KEY_ENV_VAR})`,
    { missingEnvVars: [KEY_ENV_VAR] },
    "TWO_FACTOR_NOT_CONFIGURED"
  );
}

function parseKey(raw: string): Buffer | null {
  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    return Buffer.from(raw, "hex");
  }
  if (/^[A-Za-z0-9+/]{43}=?$/.test(raw)) {
    const key = Buffer.from(raw, "base64");
    return key.length === KEY_BYTES ? key : null;
  }
  return null;
}

/**
 * Clave de 32 bytes para cifrar los secretos TOTP. Se resuelve en cada llamada
 * (no al arrancar) para que el login sin 2FA y el registro funcionen aunque
 * falte. En producción es obligatoria; en el resto, si no está, se deriva de
 * JWT_SECRET. Una clave presente pero inválida falla siempre.
 */
export function resolveTwoFactorKey(env: NodeJS.ProcessEnv = process.env): Buffer {
  const raw = env[KEY_ENV_VAR]?.trim();

  if (raw) {
    const key = parseKey(raw);
    if (!key) {
      throw notConfigured("el valor es inválido, debe ser 32 bytes en hex o base64:");
    }
    return key;
  }

  if (env.NODE_ENV === "production" || !env.JWT_SECRET) {
    throw notConfigured("falta");
  }
  return Buffer.from(hkdfSync("sha256", env.JWT_SECRET, "", HKDF_INFO, KEY_BYTES));
}

export function assertTwoFactorConfigured(env: NodeJS.ProcessEnv = process.env): void {
  resolveTwoFactorKey(env);
}

function aad(userId: number): Buffer {
  return Buffer.from(`user:${userId}`);
}

/** AES-256-GCM atado al usuario dueño: `v1.iv.tag.ct`, todo en base64url. */
export function encryptSecret(plain: string, userId: number): string {
  const key = resolveTwoFactorKey();
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(aad(userId));
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const parts = [VERSION, iv, cipher.getAuthTag(), ct].map((part) =>
    typeof part === "string" ? part : part.toString("base64url")
  );
  return parts.join(".");
}

export function decryptSecret(payload: string, userId: number): string {
  const key = resolveTwoFactorKey();
  try {
    const [version, ivText, tagText, ctText, ...rest] = payload.split(".");
    if (version !== VERSION || !ivText || !tagText || !ctText || rest.length > 0) {
      throw new Error("Formato de secreto desconocido");
    }
    const iv = Buffer.from(ivText, "base64url");
    const tag = Buffer.from(tagText, "base64url");
    if (iv.length !== IV_BYTES || tag.length !== TAG_BYTES) {
      throw new Error("IV o tag con largo inválido");
    }
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAAD(aad(userId));
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(Buffer.from(ctText, "base64url")), decipher.final()]).toString("utf8");
  } catch (error) {
    console.error(`[2fa] no se pudo descifrar el secreto del usuario ${userId}:`, error);
    throw notConfigured("no se pudo descifrar el secreto, revisar");
  }
}

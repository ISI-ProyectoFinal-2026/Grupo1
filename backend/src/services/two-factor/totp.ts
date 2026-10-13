import { createHmac, randomBytes, timingSafeEqual } from "crypto";

const STEP_SECONDS = 30;
const DIGITS = 6;
const WINDOW = 1;
const SECRET_BYTES = 20;
const ISSUER = "PATITAS";
const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32Encode(bytes: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    out += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }
  return out;
}

export function base32Decode(text: string): Buffer {
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const char of text.replace(/=+$/, "")) {
    const index = BASE32_ALPHABET.indexOf(char);
    if (index === -1) {
      throw new Error("Carácter inválido en base32");
    }
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

export function generateTotpSecret(): string {
  return base32Encode(randomBytes(SECRET_BYTES));
}

export function currentStep(nowMs: number): number {
  return Math.floor(nowMs / 1000 / STEP_SECONDS);
}

/** Código HOTP (RFC 4226) del contador `step` con truncado dinámico. */
export function totpAt(secret: string, step: number): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const hmac = createHmac("sha1", base32Decode(secret)).update(counter).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary = hmac.readUInt32BE(offset) & 0x7fffffff;
  return String(binary % 10 ** DIGITS).padStart(DIGITS, "0");
}

/**
 * Devuelve el paso al que corresponde el código, o null. Acepta el paso actual
 * y ±1, y descarta los pasos menores o iguales a `lastStep` (replay). Compara
 * los tres candidatos sin cortar antes para no filtrar por tiempo cuál acertó.
 */
export function matchTotpStep(
  secret: string,
  code: string,
  { nowMs, lastStep }: { nowMs: number; lastStep: number | null }
): number | null {
  if (!/^\d{6}$/.test(code)) {
    return null;
  }

  const given = Buffer.from(code);
  const current = currentStep(nowMs);
  let matched: number | null = null;
  for (let step = current - WINDOW; step <= current + WINDOW; step++) {
    const equal = timingSafeEqual(given, Buffer.from(totpAt(secret, step)));
    if (equal && matched === null && (lastStep === null || step > lastStep)) {
      matched = step;
    }
  }
  return matched;
}

export function buildOtpauthUri(secret: string, email: string): string {
  const label = encodeURIComponent(`${ISSUER}:${email}`);
  const params = new URLSearchParams({
    secret,
    issuer: ISSUER,
    algorithm: "SHA1",
    digits: String(DIGITS),
    period: String(STEP_SECONDS),
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}

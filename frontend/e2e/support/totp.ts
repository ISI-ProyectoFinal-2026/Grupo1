/**
 * RFC 6238 TOTP (SHA-1, 6 digits, 30 s) on node:crypto, so the journeys can play
 * the authenticator app without adding a dependency. Same parameters the
 * backend advertises in the otpauth URI.
 */
import { createHmac } from 'node:crypto'

const PERIOD_SECONDS = 30
const DIGITS = 6
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

function base32Decode(input: string): Buffer {
  const clean = input.replace(/[\s=-]/g, '').toUpperCase()
  const bytes: number[] = []
  let buffer = 0
  let bits = 0
  for (const char of clean) {
    const value = BASE32_ALPHABET.indexOf(char)
    if (value === -1) throw new Error(`totp: invalid base32 character "${char}"`)
    buffer = (buffer << 5) | value
    bits += 5
    if (bits >= 8) {
      bits -= 8
      bytes.push((buffer >> bits) & 0xff)
    }
  }
  return Buffer.from(bytes)
}

/** The code for one 30 s step (RFC 4226 HOTP with the step as the counter). */
export function totpAt(secret: string, step: number): string {
  const counter = Buffer.alloc(8)
  counter.writeBigUInt64BE(BigInt(step))
  const digest = createHmac('sha1', base32Decode(secret)).update(counter).digest()
  const offset = digest[digest.length - 1] & 0x0f
  const binary =
    ((digest[offset] & 0x7f) << 24) |
    (digest[offset + 1] << 16) |
    (digest[offset + 2] << 8) |
    digest[offset + 3]
  return String(binary % 10 ** DIGITS).padStart(DIGITS, '0')
}

function stepAt(nowMs: number): number {
  return Math.floor(nowMs / 1000 / PERIOD_SECONDS)
}

/** The code the app shows right now. */
export function totpNow(secret: string, nowMs = Date.now()): string {
  return totpAt(secret, stepAt(nowMs))
}

/**
 * A well-formed code the backend will reject: it differs from every code in the
 * +-1 step window it accepts, even if the 30 s boundary passes mid-test.
 */
export function wrongTotp(secret: string, nowMs = Date.now()): string {
  const step = stepAt(nowMs)
  const accepted = new Set([-2, -1, 0, 1, 2].map((offset) => totpAt(secret, step + offset)))
  for (let candidate = 0; candidate < 10 ** DIGITS; candidate++) {
    const code = String(candidate).padStart(DIGITS, '0')
    if (!accepted.has(code)) return code
  }
  throw new Error('totp: no code left outside the window')
}

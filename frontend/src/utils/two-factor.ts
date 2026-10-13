import { getApiErrorCode, getApiErrorDetails } from '@/services/api'
import { TWO_FACTOR_LOCKED } from '@/types/auth'

export type SecondFactorMode = 'totp' | 'recovery'

/**
 * Deja el código listo para mandarlo. El TOTP se pega a veces con espacios
 * ("123 456"); el de recuperación solo se recorta, porque el backend ya ignora
 * mayúsculas, guion y espacios.
 */
export function normalizeSecondFactorCode(mode: SecondFactorMode, raw: string): string {
  return mode === 'totp' ? raw.replace(/\s+/g, '') : raw.trim()
}

/**
 * Segundos de espera que manda el backend en `error.details` de un 429. Ese
 * campo es un arreglo en los errores de validación y un objeto acá, por eso se
 * lee sin confiar en el tipo.
 */
export function getRetryAfterSeconds(error: unknown): number | undefined {
  const details: unknown = getApiErrorDetails(error)
  if (typeof details !== 'object' || details === null || !('retryAfterSeconds' in details)) {
    return undefined
  }
  const seconds = details.retryAfterSeconds
  return typeof seconds === 'number' && seconds > 0 ? seconds : undefined
}

export function formatWaitMessage(seconds: number): string {
  const minutes = Math.ceil(seconds / 60)
  return `Probá de nuevo en ${minutes} ${minutes === 1 ? 'minuto' : 'minutos'}`
}

export function formatResetDate(iso: string): string {
  return new Date(iso).toLocaleString('es-AR', { dateStyle: 'long', timeStyle: 'short' })
}

/**
 * Texto de un error del segundo factor. El bloqueo por intentos fallidos
 * explica cuánto esperar; el resto (código o contraseña incorrectos, límite por
 * IP) ya viene redactado por el backend.
 */
export function getSecondFactorErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) return 'Error inesperado, intentá de nuevo'

  if (getApiErrorCode(error) === TWO_FACTOR_LOCKED) {
    const waitSeconds = getRetryAfterSeconds(error)
    if (waitSeconds) return `Demasiados intentos fallidos. ${formatWaitMessage(waitSeconds)}`
  }
  return error.message
}

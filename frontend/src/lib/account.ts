import { getApiErrorCode, getApiErrorStatus } from '@/services/api'
import {
  ACCOUNT_SANCTION_OPEN,
  ACTIVE_PREMIUM_BUSINESS,
  INVALID_PASSWORD,
  INVALID_TWO_FACTOR_CODE,
  LAST_ADMIN,
  TWO_FACTOR_CODE_REQUIRED,
  TWO_FACTOR_LOCKED,
} from '@/types/auth'
import { getSecondFactorErrorMessage } from '@/lib/two-factor'

const TOO_MANY_REQUESTS = 429
const DEFAULT_ERROR_MESSAGE = 'Error inesperado, intentá de nuevo'

const DELETE_ERROR_MESSAGES: Record<string, string> = {
  [INVALID_PASSWORD]: 'La contraseña es incorrecta.',
  [TWO_FACTOR_CODE_REQUIRED]:
    'Tu cuenta tiene la verificación en dos pasos activa: ingresá un código de tu app o uno de recuperación.',
  [INVALID_TWO_FACTOR_CODE]: 'El código es incorrecto o ya venció. Probá con uno nuevo.',
  [ACCOUNT_SANCTION_OPEN]:
    'No podés eliminar tu cuenta mientras tengas una sanción vigente o en revisión.',
  [LAST_ADMIN]:
    'Sos el único administrador activo. Asigná el rol a otra persona antes de eliminar tu cuenta.',
  [ACTIVE_PREMIUM_BUSINESS]:
    'Tu comercio tiene el plan Premium vigente. Vas a poder eliminar tu cuenta cuando venza.',
}

// texto de un error de DELETE /auth/me
export function getAccountDeleteErrorMessage(error: unknown): string {
  const code = getApiErrorCode(error)
  if (code === TWO_FACTOR_LOCKED) return getSecondFactorErrorMessage(error)
  if (code && DELETE_ERROR_MESSAGES[code]) return DELETE_ERROR_MESSAGES[code]
  if (getApiErrorStatus(error) === TOO_MANY_REQUESTS) {
    return 'Hiciste demasiados intentos. Esperá unos minutos y probá de nuevo.'
  }
  return error instanceof Error ? error.message : DEFAULT_ERROR_MESSAGE
}

// texto de un error de PATCH /auth/me
export function getProfileErrorMessage(error: unknown): string {
  if (getApiErrorStatus(error) === TOO_MANY_REQUESTS) {
    return 'Hiciste demasiados cambios seguidos. Esperá unos minutos y probá de nuevo.'
  }
  return error instanceof Error ? error.message : DEFAULT_ERROR_MESSAGE
}

// la respuesta es un Blob: el mensaje del backend no llega, se decide por status
export function getExportErrorMessage(error: unknown): string {
  if (getApiErrorStatus(error) === TOO_MANY_REQUESTS) {
    return 'Ya descargaste tus datos varias veces en la última hora. Probá de nuevo más tarde.'
  }
  return 'No pudimos descargar tus datos. Probá de nuevo.'
}

// mismo criterio que backend/src/validators/profile.validator.ts
const PHONE_CHARS = /^\+?[0-9 ()-]+$/
const PHONE_MIN_DIGITS = 8
const PHONE_MAX_DIGITS = 15
const PHONE_MAX_LENGTH = 30

// null si es válido; vacío también vale (borra el teléfono)
export function getPhoneError(raw: string): string | null {
  const value = raw.trim()
  if (value === '') return null
  if (value.length > PHONE_MAX_LENGTH) {
    return `El teléfono puede tener hasta ${PHONE_MAX_LENGTH} caracteres`
  }
  if (!PHONE_CHARS.test(value)) {
    return 'Usá solo números, espacios, guiones, paréntesis y un + al principio'
  }
  const digits = value.replace(/\D/g, '').length
  if (digits < PHONE_MIN_DIGITS || digits > PHONE_MAX_DIGITS) {
    return `El teléfono debe tener entre ${PHONE_MIN_DIGITS} y ${PHONE_MAX_DIGITS} dígitos`
  }
  return null
}

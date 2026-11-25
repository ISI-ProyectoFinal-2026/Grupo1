// Replica la regla de contraseña del backend (registro y reset): validarla acá
// evita gastar un intento del rate limit, o un token de un solo uso, en un
// error que ya se sabía de antemano.
const PASSWORD_RULES: Array<{ test: (value: string) => boolean; message: string }> = [
  { test: (value) => value.length >= 8, message: "mínimo 8 caracteres" },
  { test: (value) => /[a-z]/.test(value), message: "al menos una minúscula" },
  { test: (value) => /[A-Z]/.test(value), message: "al menos una mayúscula" },
  { test: (value) => /[0-9]/.test(value), message: "al menos un número" },
];

export function getPasswordErrors(password: string): string[] {
  return PASSWORD_RULES.filter((rule) => !rule.test(password)).map((rule) => rule.message);
}

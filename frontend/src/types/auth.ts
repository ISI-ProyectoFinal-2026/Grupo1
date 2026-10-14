// Valores segun el enum `Role` de Prisma. El backend lo devuelve en el `user`
// de POST /api/auth/login y resuelve el rol contra la base en cada request
// (`requireRole`), asi que esto solo gobierna que ve la UI, nunca el permiso.
export type Role = "usuario_regular" | "moderador" | "admin";

export interface AuthUser {
  id: number;
  email: string;
  fullName: string | null;
  phone: string | null;
  role: Role;
  // ISO si el usuario verificó su email, null si todavía no. Una sesión guardada
  // antes de este campo no lo trae (undefined): se lee como "no se sabe".
  emailVerifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
  // Opcional a propósito: las sesiones guardadas antes del 2FA (y los fixtures
  // de test) no lo traen. Ausente se lee como "no se sabe", no como apagado.
  twoFactorEnabled?: boolean;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface RegisterInput {
  email: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  user: AuthUser;
}

// Con 2FA activo, la contraseña sola no da sesión: el backend contesta con un
// desafío opaco (no es un JWT) que solo vale para el segundo paso.
export interface TwoFactorChallenge {
  twoFactorRequired: true;
  twoFactorToken: string;
  // ISO: cuándo se completa el reinicio de 2FA pendiente, si hay uno.
  resetEffectiveAt?: string;
}

export type LoginResponse = AuthResponse | TwoFactorChallenge;

export function isTwoFactorChallenge(response: LoginResponse): response is TwoFactorChallenge {
  return "twoFactorRequired" in response;
}

export interface TwoFactorLoginInput {
  twoFactorToken: string;
  // TOTP de 6 dígitos o código de recuperación: el backend distingue cuál es.
  code: string;
}

export interface TwoFactorResetRequestInput {
  twoFactorToken: string;
  password: string;
}

export interface TwoFactorResetConfirmResponse extends MessageResponse {
  resetEffectiveAt: string;
}

export interface TwoFactorStatus {
  enabled: boolean;
  recoveryCodesRemaining: number;
  // ISO: cuándo se completa un reinicio pendiente, o null si no hay.
  resetEffectiveAt: string | null;
}

// Se devuelven una sola vez, al iniciar la activación: no se guardan en ningún lado.
export interface TwoFactorSetup {
  secret: string;
  otpauthUri: string;
}

export interface TwoFactorEnableInput {
  code: string;
}

export interface TwoFactorDisableInput {
  password: string;
  // TOTP de 6 dígitos o código de recuperación.
  code: string;
}

export interface TwoFactorRegenerateInput {
  // Solo TOTP: un código de recuperación no sirve para generar otros.
  code: string;
}

// Enable y regenerate renuevan la sesión (suben tokenVersion) y entregan los
// códigos de recuperación en claro, una única vez.
export interface RecoveryCodesResponse extends AuthResponse {
  recoveryCodes: string[];
}

export interface ApiErrorDetail {
  path: string;
  message: string;
}

export interface MessageResponse {
  message: string;
}

export interface ResetPasswordInput {
  token: string;
  password: string;
}

// Códigos de máquina que manda el backend en `error.code`. La UI decide con
// ellos, nunca parseando el mensaje en español.
export const EMAIL_NOT_VERIFIED = "EMAIL_NOT_VERIFIED";
export const TWO_FACTOR_LOCKED = "TWO_FACTOR_LOCKED";
export const TWO_FACTOR_CHALLENGE_INVALID = "TWO_FACTOR_CHALLENGE_INVALID";

export interface ApiErrorResponse {
  error: {
    message: string;
    code?: string;
    details?: ApiErrorDetail[];
  };
}

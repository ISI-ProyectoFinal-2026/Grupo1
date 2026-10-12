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
export const RESEND_COOLDOWN = "RESEND_COOLDOWN";
export const MAIL_NOT_CONFIGURED = "MAIL_NOT_CONFIGURED";

export interface ApiErrorResponse {
  error: {
    message: string;
    code?: string;
    details?: ApiErrorDetail[];
  };
}

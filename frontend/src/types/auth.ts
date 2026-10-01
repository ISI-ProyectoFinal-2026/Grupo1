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

export interface ApiErrorResponse {
  error: {
    message: string;
    details?: ApiErrorDetail[];
  };
}

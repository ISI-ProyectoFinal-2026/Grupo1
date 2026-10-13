import { Role, User } from "@prisma/client";

/**
 * Forma del usuario que la API le devuelve a su dueño (registro, login, /me).
 * Es una lista blanca: un campo nuevo en `User` no se filtra al frontend hasta
 * que se agregue acá. Nunca incluye passwordHash ni tokenVersion.
 */
export interface PublicUser {
  id: number;
  email: string;
  fullName: string | null;
  phone: string | null;
  role: Role;
  emailVerifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    phone: user.phone,
    role: user.role,
    emailVerifiedAt: user.emailVerifiedAt?.toISOString() ?? null,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

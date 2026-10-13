import { Role, User } from "@prisma/client";
import bcrypt from "bcryptjs";
import { prisma } from "../../src/db/client";
import { signAccessToken } from "../../src/utils/jwt";

const TEST_SALT_ROUNDS = 4;

interface CreateTestUserOptions {
  /** Prefijo del email; se le agrega un sufijo único para que las suites no choquen. */
  prefix: string;
  /** Por defecto verificado: los tests de rutas con gate no son sobre el email. */
  verified?: boolean;
  role?: Role;
  /** Si se pasa, el usuario queda con un hash bcrypt real (costo 4) de esta contraseña. */
  password?: string;
}

/**
 * Crea un usuario real en la base y un JWT firmado con `signAccessToken`, así
 * `sub` y `tv` coinciden con la fila y `requireAuth` lo acepta. No firmar
 * tokens a mano con un `sub` inventado: requireAuth valida contra la base.
 */
export async function createTestUser({ prefix, verified = true, role, password }: CreateTestUserOptions): Promise<{
  user: User;
  token: string;
}> {
  const user = await prisma.user.create({
    data: {
      email: `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`,
      passwordHash: password ? bcrypt.hashSync(password, TEST_SALT_ROUNDS) : "test-hash",
      emailVerifiedAt: verified ? new Date() : null,
      ...(role ? { role } : {}),
    },
  });

  return { user, token: signAccessToken(user) };
}

import "dotenv/config";
import bcrypt from "bcryptjs";
import { prisma } from "../src/db/client";

// Mismo costo que auth.service.ts para que el hash del admin semilla sea
// indistinguible de uno generado por el registro normal.
const SALT_ROUNDS = 12;

const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL || "admin@patitas.local";
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD || "patitas-dev-admin-2026";

async function main() {
  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, SALT_ROUNDS);

  const admin = await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: { role: "admin" },
    create: {
      email: ADMIN_EMAIL,
      passwordHash,
      role: "admin",
      emailVerifiedAt: new Date(),
    },
  });

  // El admin semilla nunca recibe el mail de verificación: se lo marca como
  // verificado. Con updateMany y el filtro por null, re-ejecutar el seed no
  // pisa la fecha original.
  await prisma.user.updateMany({
    where: { id: admin.id, emailVerifiedAt: null },
    data: { emailVerifiedAt: new Date() },
  });

  console.log(`Admin inicial listo: ${admin.email} (id ${admin.id}, role ${admin.role})`);
}

main()
  .catch((error) => {
    console.error("Error al ejecutar el seed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

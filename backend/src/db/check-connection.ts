import { prisma } from "./client";

/**
 * Verifica que la conexión a PostgreSQL (y las extensiones requeridas)
 * funcione correctamente. Uso: `npm run db:check`.
 * Cumple el criterio de aceptación "Conexión funcionando exitosamente".
 */
async function main(): Promise<void> {
  await prisma.$queryRaw`SELECT 1`;

  const extensions = await prisma.$queryRaw<Array<{ extname: string }>>`
    SELECT extname FROM pg_extension WHERE extname IN ('postgis', 'vector')
  `;
  const found = extensions.map((e: { extname: string }) => e.extname).sort();
  const missing = ["postgis", "vector"].filter((ext) => !found.includes(ext));

  if (missing.length > 0) {
    throw new Error(`Faltan extensiones requeridas en la base de datos: ${missing.join(", ")}`);
  }

  console.log("✅ Conexión a PostgreSQL exitosa. Extensiones activas:", found.join(", "));
}

main()
  .catch((error) => {
    console.error("❌ No se pudo conectar a la base de datos:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

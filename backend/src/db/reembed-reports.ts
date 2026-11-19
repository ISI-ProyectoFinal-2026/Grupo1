import { prisma } from "./client";
import { regenerateReportEmbedding } from "../services/matching.service";
import { findAndStoreMatches } from "../services/report-matching.service";

/**
 * Regenera el embedding (y los matches) de todos los reportes con imagen.
 * Hace falta al cambiar el modelo de embeddings: vectores de modelos distintos
 * no se pueden comparar. Uso: `npm run reembed:reports [-- --all]`
 * (por defecto solo publicados; `--all` incluye todos los que tienen imagen).
 *
 * Dos pasadas: primero todos los embeddings, después los matches, cuando todos
 * los vectores ya son del mismo modelo. Un match pending cuyo nuevo puntaje
 * queda debajo de MATCH_THRESHOLD no se borra: borrar los pending viejos antes.
 */
async function main(includeAll: boolean): Promise<void> {
  const reports = await prisma.report.findMany({
    where: { imageUrl: { not: null }, ...(includeAll ? {} : { status: "published" as const }) },
    select: { id: true, imageUrl: true },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });

  console.log(`re-embedding ${reports.length} reports`);
  const embedded: number[] = [];
  for (const report of reports) {
    try {
      const outcome = await regenerateReportEmbedding(report.id, report.imageUrl as string);
      console.log(`  report ${report.id}: ${outcome}`);
      if (outcome === "saved") embedded.push(report.id);
    } catch (error) {
      // una imagen rota no corta el lote
      console.log(`  report ${report.id}: FAILED (${error})`);
    }
  }

  console.log(`re-matching ${embedded.length} reports`);
  for (const reportId of embedded) {
    const count = await findAndStoreMatches(reportId);
    if (count) console.log(`  report ${reportId}: ${count} matches`);
  }
}

main(process.argv.includes("--all"))
  .catch((error) => {
    console.error("❌ Falló el re-embedding de reportes:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

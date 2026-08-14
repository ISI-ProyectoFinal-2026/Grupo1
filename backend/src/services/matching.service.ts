/**
 * Dispara la generación de embedding en el Backend IA para un reporte
 * recién creado. Fire-and-forget: no se espera la inferencia de ML, la
 * creación del reporte nunca queda bloqueada ni falla por esto.
 *
 * Nota: el body usa `image_url` (snake_case) porque así lo espera el
 * endpoint `POST /reports/{report_id}/embedding` del Backend IA
 * (Pydantic model `EmbeddingRequest.image_url`, ver backend-ia/app/main.py).
 */
export function triggerEmbeddingGeneration(reportId: number, imageUrl: string): void {
  const baseUrl = process.env.AI_SERVICE_URL;
  if (!baseUrl) return;

  fetch(`${baseUrl}/reports/${reportId}/embedding`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image_url: imageUrl }),
  }).catch((error) => {
    console.error(`[matching] fallo al generar embedding para report ${reportId}:`, error);
  });
}

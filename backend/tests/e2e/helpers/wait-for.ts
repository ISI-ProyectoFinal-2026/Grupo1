import request from "supertest";
import type { Express } from "express";

export interface WaitForOptions {
  timeoutMs?: number;
  intervalMs?: number;
  description?: string;
}

/**
 * Reintenta `probe` hasta que devuelva algo distinto de `undefined` o se acabe
 * el tiempo. Hace falta porque la moderación corre fire-and-forget después de
 * POST /reports: la respuesta llega antes que el veredicto.
 */
export async function waitFor<T>(probe: () => Promise<T | undefined>, options: WaitForOptions = {}): Promise<T> {
  const { timeoutMs = 5_000, intervalMs = 50, description = "la condición" } = options;
  const deadline = Date.now() + timeoutMs;
  let lastError: unknown;

  while (Date.now() < deadline) {
    try {
      const result = await probe();
      if (result !== undefined) return result;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  const reason = lastError instanceof Error ? `: ${lastError.message}` : "";
  throw new Error(`[wait-for] se agotaron ${timeoutMs}ms esperando ${description}${reason}`);
}

/**
 * Espera por la API (GET /api/reports/:id) a que el reporte llegue a `status`.
 * Se pasa el token del dueño porque un reporte pending/rejected solo lo ve él.
 */
export async function waitForReportStatus(
  app: Express,
  reportId: number,
  status: string,
  token?: string,
  options: WaitForOptions = {}
) {
  return waitFor(
    async () => {
      const req = request(app).get(`/api/reports/${reportId}`);
      const res = token ? await req.set("Authorization", `Bearer ${token}`) : await req;
      return res.status === 200 && res.body.status === status ? res.body : undefined;
    },
    { description: `que el reporte ${reportId} quede ${status}`, ...options }
  );
}

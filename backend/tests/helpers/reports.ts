import request from "supertest";
import { app } from "../../src/app";
import { prisma } from "../../src/db/client";
import * as matchingService from "../../src/services/matching.service";

export const TEST_R2_PUBLIC_URL = "https://pub-test.r2.dev";
export const TEST_IMAGE_URL = `${TEST_R2_PUBLIC_URL}/pets/hallazgo.jpg`;

// Moderación de imagen mockeada: sin llamadas de red al Backend IA (restaurar con jest.restoreAllMocks)
export function mockImageModeration(): void {
  process.env.R2_PUBLIC_URL = TEST_R2_PUBLIC_URL;
  jest.spyOn(matchingService, "analyzeImage").mockResolvedValue("animal");
  jest.spyOn(matchingService, "triggerEmbeddingGeneration").mockResolvedValue(undefined);
}

// Simula el veredicto "animal" del Backend IA: el reporte pasa de pending a published
export async function publishReport(id: number): Promise<void> {
  await prisma.report.update({ where: { id }, data: { status: "published", publishedAt: new Date() } });
}

// POST /api/reports con foto válida y publica el reporte directo en la base
export async function createPublishedReport(
  token: string,
  data: Record<string, unknown>
): Promise<{ id: number; [key: string]: any }> {
  const res = await request(app)
    .post("/api/reports")
    .set("Authorization", `Bearer ${token}`)
    .send({ imageUrl: TEST_IMAGE_URL, ...data });
  if (res.status !== 201) {
    throw new Error(`createPublishedReport falló (${res.status}): ${JSON.stringify(res.body)}`);
  }
  await publishReport(res.body.id);
  return { ...res.body, status: "published" };
}

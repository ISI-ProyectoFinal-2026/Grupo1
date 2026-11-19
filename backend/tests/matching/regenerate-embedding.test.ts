import { prisma } from "../../src/db/client";
import { regenerateReportEmbedding } from "../../src/services/matching.service";
import * as reportMatchingService from "../../src/services/report-matching.service";

// re-embedding de reportes existentes (script reembed-reports, #307)
describe("matching.service regenerateReportEmbedding", () => {
  const originalEnv = { ...process.env };
  const IMAGE_URL = "https://pub-test.r2.dev/pets/foto.jpg";
  const VECTOR = Array.from({ length: 768 }, (_, i) => i / 768);
  let fetchMock: jest.Mock;
  let saveSpy: jest.SpyInstance;
  let findMatchesSpy: jest.SpyInstance;
  let updateManySpy: jest.SpyInstance;

  beforeEach(() => {
    process.env.AI_SERVICE_URL = "http://localhost:8000";
    process.env.R2_PUBLIC_URL = "https://pub-test.r2.dev";
    fetchMock = jest.fn();
    global.fetch = fetchMock;
    saveSpy = jest.spyOn(reportMatchingService, "saveReportEmbedding").mockResolvedValue(true);
    findMatchesSpy = jest.spyOn(reportMatchingService, "findAndStoreMatches").mockResolvedValue(0);
    updateManySpy = jest.spyOn(prisma.report, "updateMany").mockResolvedValue({ count: 1 });
    jest.spyOn(console, "error").mockImplementation(() => {});
    jest.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    jest.restoreAllMocks();
  });

  test("con mascota guarda el embedding sin tocar el estado ni buscar matches", async () => {
    fetchMock.mockResolvedValue({ status: 200, json: async () => ({ has_animal: true, embedding: VECTOR }) });

    await expect(regenerateReportEmbedding(7, IMAGE_URL)).resolves.toBe("saved");

    expect(fetchMock).toHaveBeenCalledWith("http://localhost:8000/images/embedding", expect.objectContaining({ method: "POST" }));
    expect(saveSpy).toHaveBeenCalledWith(7, IMAGE_URL, VECTOR);
    expect(findMatchesSpy).not.toHaveBeenCalled();
    expect(updateManySpy).not.toHaveBeenCalled();
  });

  test("sin mascota no guarda nada", async () => {
    fetchMock.mockResolvedValue({ status: 200, json: async () => ({ has_animal: false, embedding: null }) });

    await expect(regenerateReportEmbedding(7, IMAGE_URL)).resolves.toBe("no_animal");
    expect(saveSpy).not.toHaveBeenCalled();
  });

  test("si el reporte cambió de imagen no cuenta como guardado", async () => {
    fetchMock.mockResolvedValue({ status: 200, json: async () => ({ has_animal: true, embedding: VECTOR }) });
    saveSpy.mockResolvedValue(false);

    await expect(regenerateReportEmbedding(7, IMAGE_URL)).resolves.toBe("failed");
  });

  test.each([401, 422, 400])("un %i es una falla", async (status) => {
    fetchMock.mockResolvedValue({ status });

    await expect(regenerateReportEmbedding(7, IMAGE_URL)).resolves.toBe("failed");
    expect(saveSpy).not.toHaveBeenCalled();
  });

  test("una URL fuera del bucket es una falla sin request", async () => {
    await expect(regenerateReportEmbedding(7, "https://evil.com/foto.jpg")).resolves.toBe("failed");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("sin AI_SERVICE_URL es una falla sin request", async () => {
    delete process.env.AI_SERVICE_URL;

    await expect(regenerateReportEmbedding(7, IMAGE_URL)).resolves.toBe("failed");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

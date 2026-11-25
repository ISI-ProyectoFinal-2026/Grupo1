import { processReportPipeline } from "../../src/services/matching.service";
import * as notificationsService from "../../src/services/notifications.service";
import * as reportMatchingService from "../../src/services/report-matching.service";
import { prisma } from "../../src/db/client";

const VECTOR = Array.from({ length: 768 }, (_, i) => i / 768);
const IMAGE_URL = "https://pub-test.r2.dev/pets/foto.jpg";

// pipeline del worker de la cola (#177): un solo intento, los reintentos los hace BullMQ
describe("matching.service processReportPipeline", () => {
  const originalEnv = { ...process.env };
  let fetchMock: jest.Mock;
  let updateManySpy: jest.SpyInstance;
  let saveEmbeddingSpy: jest.SpyInstance;

  beforeEach(() => {
    process.env.R2_PUBLIC_URL = "https://pub-test.r2.dev";
    process.env.AI_SERVICE_URL = "http://localhost:8000";
    fetchMock = jest.fn();
    global.fetch = fetchMock;
    // id 42 mockeado: puede existir en la base de desarrollo compartida
    updateManySpy = jest.spyOn(prisma.report, "updateMany").mockResolvedValue({ count: 1 });
    jest.spyOn(notificationsService, "createForStatusChange").mockResolvedValue(null);
    jest.spyOn(notificationsService, "createForNearbyReport").mockResolvedValue([]);
    saveEmbeddingSpy = jest.spyOn(reportMatchingService, "saveReportEmbedding").mockResolvedValue(true);
    jest.spyOn(reportMatchingService, "findAndStoreMatches").mockResolvedValue(0);
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    jest.restoreAllMocks();
  });

  test("con mascota guarda el embedding y publica, en un solo request", async () => {
    fetchMock.mockResolvedValue({ status: 200, json: async () => ({ has_animal: true, embedding: VECTOR }) });

    await processReportPipeline(42, IMAGE_URL);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(saveEmbeddingSpy).toHaveBeenCalledWith(42, IMAGE_URL, VECTOR);
    expect(updateManySpy).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "published" }) })
    );
  });

  test("un 5xx del Backend IA rechaza sin reintentar en memoria", async () => {
    fetchMock.mockResolvedValue({ status: 503, json: async () => ({}) });

    await expect(processReportPipeline(42, IMAGE_URL)).rejects.toThrow("503");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(updateManySpy).not.toHaveBeenCalled();
  });

  test("una falla de red rechaza para que la cola reintente", async () => {
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));

    await expect(processReportPipeline(42, IMAGE_URL)).rejects.toThrow("fetch failed");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test("un 4xx es definitivo: no rechaza y el reporte queda en pending", async () => {
    fetchMock.mockResolvedValue({ status: 422, json: async () => ({}) });
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);

    await expect(processReportPipeline(42, IMAGE_URL)).resolves.toBeUndefined();
    expect(updateManySpy).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("pending"));
  });

  test("sin AI_SERVICE_URL no llama al Backend IA", async () => {
    delete process.env.AI_SERVICE_URL;

    await processReportPipeline(42, IMAGE_URL);

    expect(fetchMock).not.toHaveBeenCalled();
  });
});

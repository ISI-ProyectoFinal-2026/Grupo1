// sin Redis real: bullmq e ioredis mockeados
const mockAdd = jest.fn();
const mockGetJob = jest.fn();
const mockQueueClose = jest.fn();
const mockWorkerOn = jest.fn();
const mockWorkerClose = jest.fn();
const MockQueue = jest.fn();
const MockWorker = jest.fn();

jest.mock("bullmq", () => ({
  Queue: MockQueue,
  Worker: MockWorker,
}));
jest.mock("ioredis", () => ({
  Redis: class {
    on() {}
    async quit() {
      return "OK";
    }
  },
}));

import * as matchingService from "../../src/services/matching.service";
import {
  ENQUEUE_TIMEOUT_MS,
  REPORT_PIPELINE_JOB_OPTIONS,
  REPORT_PIPELINE_QUEUE,
  closeReportPipeline,
  enqueueReportPipeline,
  reportPipelineJobId,
  startReportPipelineWorker,
} from "../../src/services/report-pipeline.service";

const IMAGE_URL = "https://pub-test.r2.dev/pets/foto.jpg";

describe("report-pipeline.service (#177)", () => {
  const originalEnv = { ...process.env };
  let triggerSpy: jest.SpyInstance;

  beforeEach(() => {
    MockQueue.mockImplementation(() => ({ add: mockAdd, getJob: mockGetJob, close: mockQueueClose }));
    MockWorker.mockImplementation(() => ({ on: mockWorkerOn, close: mockWorkerClose }));
    mockAdd.mockResolvedValue({ id: "report-42" });
    mockGetJob.mockResolvedValue(undefined);
    mockQueueClose.mockResolvedValue(undefined);
    mockWorkerClose.mockResolvedValue(undefined);
    triggerSpy = jest.spyOn(matchingService, "triggerEmbeddingGeneration").mockResolvedValue(undefined);
    process.env.AI_SERVICE_URL = "http://localhost:8000";
  });

  afterEach(async () => {
    await closeReportPipeline();
    process.env = { ...originalEnv };
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  describe("enqueueReportPipeline", () => {
    test("con REDIS_URL encola un job con reportId e imagen, sin llamar al Backend IA", async () => {
      process.env.REDIS_URL = "redis://localhost:6379";

      await enqueueReportPipeline(42, IMAGE_URL);

      expect(MockQueue).toHaveBeenCalledWith(REPORT_PIPELINE_QUEUE, expect.any(Object));
      expect(mockAdd).toHaveBeenCalledWith(
        REPORT_PIPELINE_QUEUE,
        { reportId: 42, imageUrl: IMAGE_URL },
        expect.objectContaining({ jobId: "report-42" })
      );
      expect(triggerSpy).not.toHaveBeenCalled();
    });

    test("los jobs reintentan con backoff exponencial", async () => {
      process.env.REDIS_URL = "redis://localhost:6379";

      await enqueueReportPipeline(42, IMAGE_URL);

      const options = mockAdd.mock.calls[0][2];
      expect(options.attempts).toBeGreaterThan(1);
      expect(options.backoff).toEqual({ type: "exponential", delay: expect.any(Number) });
      expect(options).toEqual(expect.objectContaining(REPORT_PIPELINE_JOB_OPTIONS));
    });

    test("sin REDIS_URL corre el pipeline en proceso (fallback)", async () => {
      delete process.env.REDIS_URL;

      await enqueueReportPipeline(42, IMAGE_URL);

      expect(triggerSpy).toHaveBeenCalledWith(42, IMAGE_URL);
      expect(MockQueue).not.toHaveBeenCalled();
    });

    test("sin AI_SERVICE_URL no encola nada", async () => {
      process.env.REDIS_URL = "redis://localhost:6379";
      delete process.env.AI_SERVICE_URL;

      await enqueueReportPipeline(42, IMAGE_URL);

      expect(mockAdd).not.toHaveBeenCalled();
    });

    test("si Redis no acepta el job cae al pipeline en proceso y lo loguea", async () => {
      process.env.REDIS_URL = "redis://localhost:6379";
      mockAdd.mockRejectedValue(new Error("Connection is closed"));
      const errorSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);

      await enqueueReportPipeline(42, IMAGE_URL);

      expect(triggerSpy).toHaveBeenCalledWith(42, IMAGE_URL);
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("report 42"), expect.any(Error));
    });
  });

  test("si Redis no responde a tiempo cae al pipeline en proceso", async () => {
    process.env.REDIS_URL = "redis://localhost:6379";
    jest.useFakeTimers();
    mockAdd.mockReturnValue(new Promise(() => undefined));
    jest.spyOn(console, "error").mockImplementation(() => undefined);

    try {
      const done = enqueueReportPipeline(42, IMAGE_URL);
      await jest.advanceTimersByTimeAsync(ENQUEUE_TIMEOUT_MS);
      await done;

      expect(triggerSpy).toHaveBeenCalledWith(42, IMAGE_URL);
    } finally {
      jest.useRealTimers();
    }
  });

  describe("idempotencia (jobId = reportId)", () => {
    beforeEach(() => {
      process.env.REDIS_URL = "redis://localhost:6379";
    });

    test("el jobId se deriva solo del reportId", () => {
      expect(reportPipelineJobId(42)).toBe("report-42");
    });

    test("encolar dos veces el mismo reporte usa el mismo jobId y no borra el job existente", async () => {
      const existing = { data: { reportId: 42, imageUrl: IMAGE_URL }, getState: jest.fn(), remove: jest.fn() };
      mockGetJob.mockResolvedValueOnce(undefined).mockResolvedValueOnce(existing);

      await enqueueReportPipeline(42, IMAGE_URL);
      await enqueueReportPipeline(42, IMAGE_URL);

      expect(mockAdd).toHaveBeenCalledTimes(2);
      expect(mockAdd.mock.calls.map((call) => call[2].jobId)).toEqual(["report-42", "report-42"]);
      expect(existing.remove).not.toHaveBeenCalled();
    });

    test("un job en espera con otra foto se reemplaza por el de la foto nueva", async () => {
      const existing = {
        data: { reportId: 42, imageUrl: "https://pub-test.r2.dev/pets/vieja.jpg" },
        getState: jest.fn().mockResolvedValue("delayed"),
        remove: jest.fn().mockResolvedValue(undefined),
      };
      mockGetJob.mockResolvedValue(existing);

      await enqueueReportPipeline(42, IMAGE_URL);

      expect(existing.remove).toHaveBeenCalled();
      expect(mockAdd).toHaveBeenCalledWith(
        REPORT_PIPELINE_QUEUE,
        { reportId: 42, imageUrl: IMAGE_URL },
        expect.objectContaining({ jobId: "report-42" })
      );
    });

    test("un job activo con otra foto no se toca (queda para la reconciliación)", async () => {
      const existing = {
        data: { reportId: 42, imageUrl: "https://pub-test.r2.dev/pets/vieja.jpg" },
        getState: jest.fn().mockResolvedValue("active"),
        remove: jest.fn(),
      };
      mockGetJob.mockResolvedValue(existing);

      await enqueueReportPipeline(42, IMAGE_URL);

      expect(existing.remove).not.toHaveBeenCalled();
    });
  });

  describe("startReportPipelineWorker", () => {
    test("sin REDIS_URL no arranca ningún worker", () => {
      delete process.env.REDIS_URL;

      expect(startReportPipelineWorker()).toBeNull();
      expect(MockWorker).not.toHaveBeenCalled();
    });

    test("el worker procesa el job corriendo el pipeline IA de un solo intento", async () => {
      process.env.REDIS_URL = "redis://localhost:6379";
      const processSpy = jest.spyOn(matchingService, "processReportPipeline").mockResolvedValue(undefined);

      startReportPipelineWorker();
      const [queueName, processor] = MockWorker.mock.calls[0];
      await processor({ data: { reportId: 42, imageUrl: IMAGE_URL } });

      expect(queueName).toBe(REPORT_PIPELINE_QUEUE);
      expect(processSpy).toHaveBeenCalledWith(42, IMAGE_URL);
    });

    test("un fallo del Backend IA rechaza el job para que BullMQ lo reintente", async () => {
      process.env.REDIS_URL = "redis://localhost:6379";
      jest.spyOn(matchingService, "processReportPipeline").mockRejectedValue(new Error("Backend IA respondió 503"));

      startReportPipelineWorker();
      const [, processor] = MockWorker.mock.calls[0];

      await expect(processor({ data: { reportId: 42, imageUrl: IMAGE_URL } })).rejects.toThrow("503");
    });

    test("loguea cada fallo y avisa cuando se agotan los reintentos", () => {
      process.env.REDIS_URL = "redis://localhost:6379";
      const errorSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);

      startReportPipelineWorker();
      const onFailed = mockWorkerOn.mock.calls.find(([event]) => event === "failed")[1];
      const attempts = REPORT_PIPELINE_JOB_OPTIONS.attempts;
      onFailed({ data: { reportId: 42 }, attemptsMade: 1, opts: { attempts } }, new Error("503"));
      onFailed({ data: { reportId: 42 }, attemptsMade: attempts, opts: { attempts } }, new Error("503"));

      expect(errorSpy).toHaveBeenCalledTimes(2);
      expect(errorSpy.mock.calls[0][0]).toEqual(expect.stringContaining("reintenta"));
      expect(errorSpy.mock.calls[1][0]).toEqual(expect.stringContaining("pending"));
    });
  });
});

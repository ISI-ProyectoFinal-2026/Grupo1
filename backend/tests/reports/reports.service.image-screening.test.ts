import { prisma } from "../../src/db/client";
import { AppError } from "../../src/errors/app-error";
import * as reportsService from "../../src/services/reports.service";
import * as matchingService from "../../src/services/matching.service";

/**
 * Upfront image screening in create(). Prisma is stubbed (no database needed):
 * the focus is the decision taken from analyzeImage's verdict.
 */
describe("reports.service create() image screening", () => {
  const NO_ANIMAL_MESSAGE =
    "Su publicación no se puede subir debido a que no se detectan animales. Posible SPAM";

  const reportData = {
    userId: 7,
    reportType: "lost" as const,
    title: "Perro perdido",
    location: { lat: -34.6, lng: -58.38 },
    imageUrl: "https://pub-test.r2.dev/pets/photo.jpg",
  };

  let reportCreate: jest.Mock;
  let reportUpdate: jest.Mock;
  let analyzeSpy: jest.SpyInstance;
  let triggerSpy: jest.SpyInstance;

  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.R2_PUBLIC_URL = "https://pub-test.r2.dev";
    reportCreate = jest.fn().mockResolvedValue({ id: 99 });
    reportUpdate = jest.fn().mockResolvedValue({ id: 99 });
    // reporte editable y sin denuncias pendientes
    const fakeTx = {
      report: { create: reportCreate, update: reportUpdate },
      reportFlag: { count: jest.fn().mockResolvedValue(0) },
      $executeRaw: jest.fn().mockResolvedValue(1),
      $queryRaw: jest.fn().mockResolvedValue([{ status: "published" }]),
    };
    jest.spyOn(prisma.reportFlag, "count").mockResolvedValue(0);
    jest
      .spyOn(prisma, "$transaction")
      .mockImplementation((async (callback: (tx: unknown) => Promise<unknown>) => callback(fakeTx)) as never);
    jest.spyOn(prisma, "$queryRaw").mockResolvedValue([
      {
        id: 99,
        userId: 7,
        petId: null,
        reportType: "lost",
        status: "pending",
        title: "Perro perdido",
        description: null,
        imageUrl: reportData.imageUrl,
        customFlyerUrl: null,
        locationAddress: null,
        lat: -34.6,
        lng: -58.38,
        createdAt: new Date(),
        updatedAt: new Date(),
        publishedAt: null,
      },
    ] as never);
    analyzeSpy = jest.spyOn(matchingService, "analyzeImage");
    triggerSpy = jest.spyOn(matchingService, "triggerEmbeddingGeneration").mockResolvedValue();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    jest.restoreAllMocks();
  });

  test("rejects with 422 and the SPAM message when no animal is detected, creating nothing", async () => {
    analyzeSpy.mockResolvedValue("no_animal");

    const promise = reportsService.create(reportData);

    await expect(promise).rejects.toBeInstanceOf(AppError);
    await expect(promise).rejects.toMatchObject({ statusCode: 422, message: NO_ANIMAL_MESSAGE });
    expect(analyzeSpy).toHaveBeenCalledWith(reportData.imageUrl);
    expect(reportCreate).not.toHaveBeenCalled();
    expect(triggerSpy).not.toHaveBeenCalled();
  });

  test("creates the report as pending and triggers the embedding pipeline when an animal is detected", async () => {
    analyzeSpy.mockResolvedValue("animal");

    const report = await reportsService.create(reportData);

    expect(analyzeSpy).toHaveBeenCalledWith(reportData.imageUrl);
    expect(report.id).toBe(99);
    expect(reportCreate).toHaveBeenCalledWith({ data: expect.objectContaining({ status: "pending" }) });
    expect(triggerSpy).toHaveBeenCalledWith(99, reportData.imageUrl);
  });

  // Low quality is only a warning shown on upload (#212): it never blocks the report.
  test("creates the report as pending when the photo is flagged as low quality", async () => {
    analyzeSpy.mockResolvedValue("animal_low_quality");

    const report = await reportsService.create(reportData);

    expect(report.id).toBe(99);
    expect(reportCreate).toHaveBeenCalledWith({ data: expect.objectContaining({ status: "pending" }) });
    expect(triggerSpy).toHaveBeenCalledWith(99, reportData.imageUrl);
  });

  test("still creates the report as pending when the analysis is unavailable", async () => {
    analyzeSpy.mockResolvedValue("unavailable");

    const report = await reportsService.create(reportData);

    expect(report.id).toBe(99);
    expect(reportCreate).toHaveBeenCalledWith({ data: expect.objectContaining({ status: "pending" }) });
    expect(triggerSpy).toHaveBeenCalledWith(99, reportData.imageUrl);
  });

  // A synchronous verdict for arbitrary hosts would be an SSRF oracle: images
  // outside the R2 bucket keep the pre-existing async moderation path.
  test("skips the upfront screening for images outside the R2 bucket and creates the report as pending", async () => {
    analyzeSpy.mockResolvedValue("no_animal");

    const report = await reportsService.create({ ...reportData, imageUrl: "https://cdn.example.com/photo.jpg" });

    expect(report.id).toBe(99);
    expect(analyzeSpy).not.toHaveBeenCalled();
    expect(reportCreate).toHaveBeenCalledWith({ data: expect.objectContaining({ status: "pending" }) });
    expect(triggerSpy).toHaveBeenCalled();
  });

  test("never stamps publishedAt on creation: moderation publishes it later", async () => {
    analyzeSpy.mockResolvedValue("animal");

    await reportsService.create(reportData);

    expect(reportCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ status: "pending", publishedAt: null }),
    });
  });

  describe("create() extra photos", () => {
    const extras = ["https://pub-test.r2.dev/pets/extra-1.jpg", "https://pub-test.r2.dev/pets/extra-2.jpg"];

    test("screens every extra photo and persists them", async () => {
      analyzeSpy.mockResolvedValue("animal");

      await reportsService.create({ ...reportData, extraImageUrls: extras });

      expect(analyzeSpy).toHaveBeenCalledWith(extras[0]);
      expect(analyzeSpy).toHaveBeenCalledWith(extras[1]);
      expect(reportCreate).toHaveBeenCalledWith({ data: expect.objectContaining({ extraImageUrls: extras }) });
    });

    test("rejects with 422 when an extra photo has no animal, creating nothing", async () => {
      analyzeSpy.mockImplementation(async (url: string) => (url === extras[1] ? "no_animal" : "animal"));

      await expect(reportsService.create({ ...reportData, extraImageUrls: extras })).rejects.toMatchObject({
        statusCode: 422,
      });
      expect(reportCreate).not.toHaveBeenCalled();
    });

    test("defaults to no extra photos", async () => {
      analyzeSpy.mockResolvedValue("animal");

      await reportsService.create(reportData);

      expect(reportCreate).toHaveBeenCalledWith({ data: expect.objectContaining({ extraImageUrls: [] }) });
    });
  });

  // Editing must not become a way around the screening: a report published with
  // a dog photo could otherwise swap it for an unrelated image (PR #195 review).
  describe("update() image screening", () => {
    const newImageUrl = "https://pub-test.r2.dev/pets/new-photo.jpg";

    test("rejects with 422 and the SPAM message when the new image has no animal, updating nothing", async () => {
      analyzeSpy.mockResolvedValue("no_animal");

      const promise = reportsService.update(99, 7, { imageUrl: newImageUrl });

      await expect(promise).rejects.toMatchObject({ statusCode: 422, message: NO_ANIMAL_MESSAGE });
      expect(analyzeSpy).toHaveBeenCalledWith(newImageUrl);
      expect(reportUpdate).not.toHaveBeenCalled();
      expect(triggerSpy).not.toHaveBeenCalled();
    });

    test.each(["animal", "animal_low_quality", "unavailable"] as const)(
      "sends the report back to pending and re-runs the async moderation when the new image is %s",
      async (verdict) => {
        analyzeSpy.mockResolvedValue(verdict);

        await reportsService.update(99, 7, { imageUrl: newImageUrl });

        expect(reportUpdate).toHaveBeenCalledWith({
          where: { id: 99 },
          data: expect.objectContaining({ imageUrl: newImageUrl, status: "pending", publishedAt: null }),
        });
        expect(triggerSpy).toHaveBeenCalledWith(99, newImageUrl);
      }
    );

    test("re-moderates a new image outside the R2 bucket through the async pipeline only", async () => {
      const externalUrl = "https://cdn.example.com/photo.jpg";

      await reportsService.update(99, 7, { imageUrl: externalUrl });

      expect(analyzeSpy).not.toHaveBeenCalled();
      expect(reportUpdate).toHaveBeenCalledWith({
        where: { id: 99 },
        data: expect.objectContaining({ status: "pending", publishedAt: null }),
      });
      expect(triggerSpy).toHaveBeenCalledWith(99, externalUrl);
    });

    // A resolved report is closed: re-moderating it would publish it again.
    test("rejects with 409 a new image on a resolved report, updating nothing", async () => {
      jest.spyOn(prisma, "$queryRaw").mockResolvedValue([
        {
          id: 99,
          userId: 7,
          petId: null,
          reportType: "lost",
          status: "resolved",
          title: "Perro perdido",
          description: null,
          imageUrl: reportData.imageUrl,
          customFlyerUrl: null,
          locationAddress: null,
          lat: -34.6,
          lng: -58.38,
          createdAt: new Date(),
          updatedAt: new Date(),
          publishedAt: new Date(),
        },
      ] as never);

      await expect(reportsService.update(99, 7, { imageUrl: newImageUrl })).rejects.toMatchObject({ statusCode: 409 });
      expect(analyzeSpy).not.toHaveBeenCalled();
      expect(reportUpdate).not.toHaveBeenCalled();
    });

    // Otherwise "resolved" would be silently replaced by "pending".
    test("rejects with 409 a new image sent together with status resolved", async () => {
      await expect(
        reportsService.update(99, 7, { imageUrl: newImageUrl, status: "resolved" })
      ).rejects.toMatchObject({ statusCode: 409 });
      expect(reportUpdate).not.toHaveBeenCalled();
    });

    test.each([
      ["the image is unchanged", { title: "Nuevo título", imageUrl: reportData.imageUrl }],
      ["no image is sent", { title: "Nuevo título" }],
    ])("keeps the status and skips moderation when %s", async (_case, changes) => {
      await reportsService.update(99, 7, changes);

      expect(analyzeSpy).not.toHaveBeenCalled();
      expect(reportUpdate).toHaveBeenCalledWith({ where: { id: 99 }, data: expect.not.objectContaining({ status: "pending" }) });
      expect(triggerSpy).not.toHaveBeenCalled();
    });

    // D4: cambiar las fotos extra re-modera igual que cambiar la principal
    describe("extra photos", () => {
      const currentExtra = "https://pub-test.r2.dev/pets/extra-1.jpg";
      const newExtra = "https://pub-test.r2.dev/pets/extra-new.jpg";

      beforeEach(() => {
        jest.spyOn(prisma, "$queryRaw").mockResolvedValue([
          {
            id: 99,
            userId: 7,
            petId: null,
            reportType: "lost",
            status: "published",
            title: "Perro perdido",
            description: null,
            imageUrl: reportData.imageUrl,
            extraImageUrls: [currentExtra],
            customFlyerUrl: null,
            locationAddress: null,
            lat: -34.6,
            lng: -58.38,
            createdAt: new Date(),
            updatedAt: new Date(),
            publishedAt: new Date(),
          },
        ] as never);
      });

      test("screens only the new extra photos and sends the report back to pending", async () => {
        analyzeSpy.mockResolvedValue("animal");

        await reportsService.update(99, 7, { extraImageUrls: [currentExtra, newExtra] });

        expect(analyzeSpy).toHaveBeenCalledTimes(1);
        expect(analyzeSpy).toHaveBeenCalledWith(newExtra);
        expect(reportUpdate).toHaveBeenCalledWith({
          where: { id: 99 },
          data: expect.objectContaining({
            extraImageUrls: [currentExtra, newExtra],
            status: "pending",
            publishedAt: null,
          }),
        });
        expect(triggerSpy).toHaveBeenCalledWith(99, reportData.imageUrl);
      });

      test("removing an extra photo also sends the report back to pending", async () => {
        await reportsService.update(99, 7, { extraImageUrls: [] });

        expect(analyzeSpy).not.toHaveBeenCalled();
        expect(reportUpdate).toHaveBeenCalledWith({
          where: { id: 99 },
          data: expect.objectContaining({ extraImageUrls: [], status: "pending", publishedAt: null }),
        });
        expect(triggerSpy).toHaveBeenCalledWith(99, reportData.imageUrl);
      });

      test("rejects with 422 when a new extra photo has no animal, updating nothing", async () => {
        analyzeSpy.mockResolvedValue("no_animal");

        await expect(reportsService.update(99, 7, { extraImageUrls: [newExtra] })).rejects.toMatchObject({
          statusCode: 422,
        });
        expect(reportUpdate).not.toHaveBeenCalled();
        expect(triggerSpy).not.toHaveBeenCalled();
      });

      test("keeps the status when the extra photos are unchanged", async () => {
        await reportsService.update(99, 7, { title: "Nuevo", extraImageUrls: [currentExtra] });

        expect(analyzeSpy).not.toHaveBeenCalled();
        expect(reportUpdate).toHaveBeenCalledWith({ where: { id: 99 }, data: expect.not.objectContaining({ status: "pending" }) });
        expect(triggerSpy).not.toHaveBeenCalled();
      });

      test("only reordering the extra photos keeps the status", async () => {
        jest.spyOn(prisma, "$queryRaw").mockResolvedValue([
          { ...(await reportsService.getById(99)), extraImageUrls: [currentExtra, newExtra], lat: -34.6, lng: -58.38 },
        ] as never);

        await reportsService.update(99, 7, { extraImageUrls: [newExtra, currentExtra] });

        expect(analyzeSpy).not.toHaveBeenCalled();
        expect(reportUpdate).toHaveBeenCalledWith({ where: { id: 99 }, data: expect.not.objectContaining({ status: "pending" }) });
        expect(triggerSpy).not.toHaveBeenCalled();
      });

      test("rejects with 409 changing extra photos of a resolved report", async () => {
        await expect(
          reportsService.update(99, 7, { extraImageUrls: [newExtra], status: "resolved" })
        ).rejects.toMatchObject({ statusCode: 409 });
        expect(reportUpdate).not.toHaveBeenCalled();
      });
    });
  });
});

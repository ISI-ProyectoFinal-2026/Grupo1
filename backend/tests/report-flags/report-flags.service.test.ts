import { prisma } from "../../src/db/client";
import { AppError } from "../../src/errors/app-error";
import * as reportFlagsService from "../../src/services/report-flags.service";

describe("report-flags.service", () => {
  let userId: number;
  let reporterId: number;
  let reportId: number;
  const createdFlagIds: number[] = [];

  beforeAll(async () => {
    const user = await prisma.user.create({
      data: { email: `report-flags-service-test-${Date.now()}@example.com`, passwordHash: "test-hash" },
    });
    userId = user.id;

    const reporter = await prisma.user.create({
      data: { email: `report-flags-service-test-reporter-${Date.now()}@example.com`, passwordHash: "test-hash" },
    });
    reporterId = reporter.id;

    const report = await prisma.report.create({
      data: {
        userId,
        reportType: "found",
        status: "published",
        title: "Perrito encontrado en Plaza de Mayo",
      },
    });
    reportId = report.id;
  });

  afterEach(async () => {
    while (createdFlagIds.length > 0) {
      const id = createdFlagIds.pop()!;
      await prisma.reportFlag.deleteMany({ where: { id } });
    }
  });

  afterAll(async () => {
    await prisma.reportFlag.deleteMany({ where: { reportId } });
    await prisma.report.delete({ where: { id: reportId } });
    await prisma.user.delete({ where: { id: userId } });
    await prisma.user.delete({ where: { id: reporterId } });
    await prisma.$disconnect();
  });

  test("create() crea un reporte de moderación con status pending", async () => {
    const flag = await reportFlagsService.create(reportId, { userId: reporterId, reason: "Contenido falso" });
    createdFlagIds.push(flag.id);

    expect(flag.id).toBeDefined();
    expect(flag.reportId).toBe(reportId);
    expect(flag.userId).toBe(reporterId);
    expect(flag.reason).toBe("Contenido falso");
    expect(flag.status).toBe("pending");
  });

  test("create() lanza AppError 404 si el reporte no existe", async () => {
    await expect(
      reportFlagsService.create(999999999, { userId: reporterId, reason: "Contenido falso" })
    ).rejects.toMatchObject(new AppError(404, "Reporte no encontrado"));
  });

  test("create() lanza AppError 409 si el mismo usuario reporta la misma publicación dos veces", async () => {
    const flag = await reportFlagsService.create(reportId, { userId: reporterId, reason: "Contenido falso" });
    createdFlagIds.push(flag.id);

    await expect(
      reportFlagsService.create(reportId, { userId: reporterId, reason: "Otra vez" })
    ).rejects.toMatchObject({ statusCode: 409 });
  });
});

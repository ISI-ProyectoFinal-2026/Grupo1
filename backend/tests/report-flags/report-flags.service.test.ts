import { prisma } from "../../src/db/client";
import { AppError } from "../../src/errors/app-error";
import * as reportFlagsService from "../../src/services/report-flags.service";

describe("report-flags.service", () => {
  let userId: number;
  let reporterId: number;
  let secondReporterId: number;
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

    const secondReporter = await prisma.user.create({
      data: { email: `report-flags-service-test-reporter2-${Date.now()}@example.com`, passwordHash: "test-hash" },
    });
    secondReporterId = secondReporter.id;

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
    await prisma.notification.deleteMany({ where: { reportId } });
    await prisma.report.update({ where: { id: reportId }, data: { status: "published" } });
  });

  afterAll(async () => {
    await prisma.reportFlag.deleteMany({ where: { reportId } });
    await prisma.report.delete({ where: { id: reportId } });
    await prisma.user.delete({ where: { id: userId } });
    await prisma.user.delete({ where: { id: reporterId } });
    await prisma.user.delete({ where: { id: secondReporterId } });
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

  test("create() lanza AppError 403 si quien denuncia es el dueño del reporte", async () => {
    await expect(
      reportFlagsService.create(reportId, { userId, reason: "Contenido falso" })
    ).rejects.toMatchObject(new AppError(403, "No podés denunciar tu propia publicación"));
  });

  test.each(["pending", "rejected", "resolved"] as const)(
    "create() lanza AppError 404 si el reporte está %s",
    async (status) => {
      await prisma.report.update({ where: { id: reportId }, data: { status } });

      await expect(
        reportFlagsService.create(reportId, { userId: reporterId, reason: "Contenido falso" })
      ).rejects.toMatchObject(new AppError(404, "Reporte no encontrado"));
    }
  );

  describe("list()", () => {
    test("por defecto devuelve solo flags pending, con el contexto del reporte", async () => {
      const flag = await reportFlagsService.create(reportId, { userId: reporterId, reason: "Contenido falso" });
      createdFlagIds.push(flag.id);

      const flags = await reportFlagsService.list();
      const found = flags.find((f) => f.id === flag.id);

      expect(found).toBeDefined();
      expect(found?.status).toBe("pending");
      expect(found?.report.id).toBe(reportId);
      expect(found?.report.title).toBe("Perrito encontrado en Plaza de Mayo");
      expect(flags.every((f) => f.status === "pending")).toBe(true);
    });

    test("status=reviewed filtra solo los flags aceptados", async () => {
      const flag = await reportFlagsService.create(reportId, { userId: reporterId, reason: "Contenido falso" });
      createdFlagIds.push(flag.id);
      await reportFlagsService.resolve(flag.id, "accept");

      const flags = await reportFlagsService.list({ status: "reviewed" });

      expect(flags.some((f) => f.id === flag.id)).toBe(true);
      expect(flags.every((f) => f.status === "reviewed")).toBe(true);
    });

    test("status=dismissed filtra solo los flags descartados", async () => {
      const flag = await reportFlagsService.create(reportId, { userId: reporterId, reason: "Contenido falso" });
      createdFlagIds.push(flag.id);
      await reportFlagsService.resolve(flag.id, "dismiss");

      const flags = await reportFlagsService.list({ status: "dismissed" });

      expect(flags.some((f) => f.id === flag.id)).toBe(true);
      expect(flags.every((f) => f.status === "dismissed")).toBe(true);
    });
  });

  describe("resolve()", () => {
    const ownerNotifications = () =>
      prisma.notification.findMany({ where: { userId, reportId, type: "report_status_change" } });

    test("accept marca el flag reviewed y oculta el reporte", async () => {
      const flag = await reportFlagsService.create(reportId, { userId: reporterId, reason: "Contenido falso" });
      createdFlagIds.push(flag.id);

      const resolved = await reportFlagsService.resolve(flag.id, "accept");

      expect(resolved.status).toBe("reviewed");
      expect(resolved.report.status).toBe("rejected");
    });

    test("accept cierra las demás denuncias pendientes del mismo reporte", async () => {
      const flag = await reportFlagsService.create(reportId, { userId: reporterId, reason: "Contenido falso" });
      const other = await reportFlagsService.create(reportId, { userId: secondReporterId, reason: "Es spam" });
      createdFlagIds.push(flag.id, other.id);

      await reportFlagsService.resolve(flag.id, "accept");

      const closed = await prisma.reportFlag.findUniqueOrThrow({ where: { id: other.id } });
      expect(closed.status).toBe("reviewed");
    });

    test("accept avisa al autor una sola vez que su reporte se ocultó", async () => {
      const flag = await reportFlagsService.create(reportId, { userId: reporterId, reason: "Contenido falso" });
      const other = await reportFlagsService.create(reportId, { userId: secondReporterId, reason: "Es spam" });
      createdFlagIds.push(flag.id, other.id);

      await reportFlagsService.resolve(flag.id, "accept");

      const notifications = await ownerNotifications();
      expect(notifications).toHaveLength(1);
      expect(notifications[0]).toMatchObject({ title: "Tu reporte fue ocultado" });
      expect(notifications[0].message).toContain("Perrito encontrado en Plaza de Mayo");
    });

    test("accept no avisa al autor si desactivó los cambios de estado", async () => {
      await prisma.notificationPreference.upsert({
        where: { userId },
        create: { userId, notifyStatusChange: false },
        update: { notifyStatusChange: false },
      });
      const flag = await reportFlagsService.create(reportId, { userId: reporterId, reason: "Contenido falso" });
      createdFlagIds.push(flag.id);

      await reportFlagsService.resolve(flag.id, "accept");

      expect(await ownerNotifications()).toHaveLength(0);
      await prisma.notificationPreference.delete({ where: { userId } });
    });

    test("dismiss marca el flag dismissed y deja el reporte publicado, sin avisar al autor", async () => {
      const flag = await reportFlagsService.create(reportId, { userId: reporterId, reason: "Contenido falso" });
      createdFlagIds.push(flag.id);

      const resolved = await reportFlagsService.resolve(flag.id, "dismiss");

      expect(resolved.status).toBe("dismissed");
      expect(resolved.report.status).toBe("published");
      expect(await ownerNotifications()).toHaveLength(0);
    });

    test("dismiss no toca las demás denuncias pendientes del reporte", async () => {
      const flag = await reportFlagsService.create(reportId, { userId: reporterId, reason: "Contenido falso" });
      const other = await reportFlagsService.create(reportId, { userId: secondReporterId, reason: "Es spam" });
      createdFlagIds.push(flag.id, other.id);

      await reportFlagsService.resolve(flag.id, "dismiss");

      const pending = await prisma.reportFlag.findUniqueOrThrow({ where: { id: other.id } });
      expect(pending.status).toBe("pending");
    });

    test.each(["accept", "dismiss"] as const)("lanza AppError 409 si el flag ya fue revisado (%s)", async (action) => {
      const flag = await reportFlagsService.create(reportId, { userId: reporterId, reason: "Contenido falso" });
      createdFlagIds.push(flag.id);

      await reportFlagsService.resolve(flag.id, "dismiss");
      await expect(reportFlagsService.resolve(flag.id, action)).rejects.toMatchObject({ statusCode: 409 });
    });

    test("lanza AppError 404 si el flag no existe", async () => {
      await expect(reportFlagsService.resolve(999999999, "accept")).rejects.toMatchObject(
        new AppError(404, "Reporte de moderación no encontrado")
      );
    });
  });
});

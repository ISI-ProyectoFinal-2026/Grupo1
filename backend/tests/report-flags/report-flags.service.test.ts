import { prisma } from "../../src/db/client";
import { AppError } from "../../src/errors/app-error";
import * as reportFlagsService from "../../src/services/report-flags.service";
import * as notificationsService from "../../src/services/notifications.service";

describe("report-flags.service", () => {
  let userId: number;
  let reporterId: number;
  let secondReporterId: number;
  let reportId: number;
  const createdFlagIds: number[] = [];
  const extraUserIds: number[] = [];

  async function makeUsers(count: number, role: "usuario_regular" | "moderador" = "usuario_regular"): Promise<number[]> {
    const ids: number[] = [];
    for (let i = 0; i < count; i++) {
      const user = await prisma.user.create({
        data: {
          email: `report-flags-service-extra-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`,
          passwordHash: "test-hash",
          role,
        },
      });
      ids.push(user.id);
      extraUserIds.push(user.id);
    }
    return ids;
  }

  // el flag de cada usuario se crea en serie: el umbral depende del conteo
  async function flagAll(userIds: number[]) {
    for (const flagger of userIds) {
      await reportFlagsService.create(reportId, { userId: flagger, reason: "spam" });
    }
  }

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
    createdFlagIds.length = 0;
    jest.restoreAllMocks();
    delete process.env.REPORT_FLAG_THRESHOLD;
    await prisma.reportFlag.deleteMany({ where: { reportId } });
    await prisma.notification.deleteMany({ where: { reportId } });
    await prisma.notificationPreference.deleteMany({ where: { userId } });
    await prisma.accountSanction.deleteMany({ where: { userId: { in: extraUserIds } } });
    await prisma.report.update({
      where: { id: reportId },
      data: { status: "published", flagCycle: 0, contentEditedAt: null },
    });
  });

  afterAll(async () => {
    await prisma.reportFlag.deleteMany({ where: { reportId } });
    await prisma.report.delete({ where: { id: reportId } });
    await prisma.user.delete({ where: { id: userId } });
    await prisma.user.delete({ where: { id: reporterId } });
    await prisma.user.delete({ where: { id: secondReporterId } });
    await prisma.user.deleteMany({ where: { id: { in: extraUserIds } } });
    await prisma.$disconnect();
  });

  test("create() crea un reporte de moderación con status pending", async () => {
    const flag = await reportFlagsService.create(reportId, { userId: reporterId, reason: "false_info" });
    createdFlagIds.push(flag.id);

    expect(flag.id).toBeDefined();
    expect(flag.reportId).toBe(reportId);
    expect(flag.userId).toBe(reporterId);
    expect(flag.reason).toBe("false_info");
    expect(flag.cycle).toBe(0);
    expect(flag.status).toBe("pending");
  });

  test("create() lanza AppError 404 si el reporte no existe", async () => {
    await expect(
      reportFlagsService.create(999999999, { userId: reporterId, reason: "false_info" })
    ).rejects.toMatchObject(new AppError(404, "Reporte no encontrado"));
  });

  test("create() lanza AppError 409 si el mismo usuario reporta la misma publicación dos veces", async () => {
    const flag = await reportFlagsService.create(reportId, { userId: reporterId, reason: "false_info" });
    createdFlagIds.push(flag.id);

    await expect(
      reportFlagsService.create(reportId, { userId: reporterId, reason: "spam" })
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  test("create() lanza AppError 403 si quien denuncia es el dueño del reporte", async () => {
    await expect(
      reportFlagsService.create(reportId, { userId, reason: "false_info" })
    ).rejects.toMatchObject(new AppError(403, "No podés denunciar tu propia publicación"));
  });

  test.each(["pending", "rejected", "resolved", "hidden"] as const)(
    "create() lanza AppError 404 si el reporte está %s",
    async (status) => {
      await prisma.report.update({ where: { id: reportId }, data: { status } });

      await expect(
        reportFlagsService.create(reportId, { userId: reporterId, reason: "false_info" })
      ).rejects.toMatchObject(new AppError(404, "Reporte no encontrado"));
    }
  );

  describe("create(): ocultamiento por umbral (#218)", () => {
    const ownerNotifications = () =>
      prisma.notification.findMany({ where: { userId, reportId, type: "report_status_change" } });
    const reportState = () => prisma.report.findUniqueOrThrow({ where: { id: reportId } });

    test("guarda el motivo tipado y el detalle", async () => {
      const flag = await reportFlagsService.create(reportId, {
        userId: reporterId,
        reason: "other",
        detail: "No es una mascota",
      });

      expect(flag).toMatchObject({ reason: "other", detail: "No es una mascota", cycle: 0, status: "pending" });
    });

    test("la 5ª denuncia de usuarios distintos oculta el reporte una sola vez y avisa al dueño", async () => {
      const flaggers = await makeUsers(5);
      await flagAll(flaggers.slice(0, 4));
      expect((await reportState()).status).toBe("published");
      expect(await ownerNotifications()).toHaveLength(0);

      await flagAll(flaggers.slice(4));

      const report = await reportState();
      expect(report.status).toBe("hidden");
      const notifications = await ownerNotifications();
      expect(notifications).toHaveLength(1);
      expect(notifications[0].message).toContain("varias denuncias");
    });

    test("conserva el publishedAt y no sanciona al autor", async () => {
      const publishedAt = new Date("2026-01-01T00:00:00.000Z");
      await prisma.report.update({ where: { id: reportId }, data: { publishedAt } });
      await flagAll(await makeUsers(5));

      const report = await reportState();
      expect(report.publishedAt).toEqual(publishedAt);
      expect(await prisma.accountSanction.count({ where: { userId } })).toBe(0);
    });

    test("REPORT_FLAG_THRESHOLD=3 oculta con 3 denuncias", async () => {
      process.env.REPORT_FLAG_THRESHOLD = "3";
      await flagAll(await makeUsers(2));
      expect((await reportState()).status).toBe("published");

      await flagAll(await makeUsers(1));
      expect((await reportState()).status).toBe("hidden");
    });

    test("la denuncia de un usuario suspendido cuenta", async () => {
      const [suspended, ...others] = await makeUsers(5);
      await prisma.accountSanction.create({
        data: {
          userId: suspended,
          severity: "mild",
          kind: "temporary",
          status: "active",
          reason: "test",
          triggeringReportIds: [],
          startsAt: new Date(Date.now() - 3_600_000),
          endsAt: new Date(Date.now() + 86_400_000),
        },
      });

      await flagAll([suspended, ...others]);

      expect((await reportState()).status).toBe("hidden");
    });

    test("la denuncia de un moderador cuenta como una: 3 + moderador no oculta, 4 + moderador sí", async () => {
      const [moderator] = await makeUsers(1, "moderador");
      await flagAll(await makeUsers(3));
      await flagAll([moderator]);
      expect((await reportState()).status).toBe("published");

      await flagAll(await makeUsers(1));
      expect((await reportState()).status).toBe("hidden");
    });

    test("dos denuncias concurrentes con 4 previas dejan el reporte hidden y avisan una sola vez", async () => {
      await flagAll(await makeUsers(4));
      const [first, second] = await makeUsers(2);

      const results = await Promise.allSettled([
        reportFlagsService.create(reportId, { userId: first, reason: "spam" }),
        reportFlagsService.create(reportId, { userId: second, reason: "spam" }),
      ]);

      expect(results.some((r) => r.status === "fulfilled")).toBe(true);
      expect((await reportState()).status).toBe("hidden");
      expect(await ownerNotifications()).toHaveLength(1);
    });

    test("si falla el aviso, el reporte queda oculto igual", async () => {
      jest.spyOn(console, "error").mockImplementation(() => {});
      jest.spyOn(notificationsService, "createForStatusChange").mockRejectedValue(new Error("fallo"));

      await flagAll(await makeUsers(5));

      expect((await reportState()).status).toBe("hidden");
    });
  });

  describe("create(): volver a denunciar tras restaurar o descartar (#218)", () => {
    // simula un restore: ciclo 1 y flags previos cerrados
    async function closeCycle(flaggerIds: number[], resolvedAt: Date) {
      await prisma.reportFlag.updateMany({
        where: { reportId, userId: { in: flaggerIds } },
        data: { status: "dismissed", resolvedAt },
      });
      await prisma.report.update({ where: { id: reportId }, data: { flagCycle: 1, status: "published" } });
    }

    test("quien ya denunció recibe 409 mientras el autor no edite", async () => {
      await reportFlagsService.create(reportId, { userId: reporterId, reason: "spam" });
      await closeCycle([reporterId], new Date("2026-02-01T00:00:00.000Z"));

      await expect(
        reportFlagsService.create(reportId, { userId: reporterId, reason: "spam" })
      ).rejects.toMatchObject({ statusCode: 409 });
    });

    test("tras la edición del autor, el mismo usuario puede denunciar y el conteo del ciclo es 1", async () => {
      await reportFlagsService.create(reportId, { userId: reporterId, reason: "spam" });
      await closeCycle([reporterId], new Date("2026-02-01T00:00:00.000Z"));
      await prisma.report.update({
        where: { id: reportId },
        data: { contentEditedAt: new Date("2026-02-02T00:00:00.000Z") },
      });

      const flag = await reportFlagsService.create(reportId, { userId: reporterId, reason: "spam" });

      expect(flag.cycle).toBe(1);
      expect(await prisma.reportFlag.count({ where: { reportId, cycle: 1, status: "pending" } })).toBe(1);
    });

    test("una edición anterior al cierre no habilita la re-denuncia", async () => {
      await reportFlagsService.create(reportId, { userId: reporterId, reason: "spam" });
      await closeCycle([reporterId], new Date("2026-02-01T00:00:00.000Z"));
      await prisma.report.update({
        where: { id: reportId },
        data: { contentEditedAt: new Date("2026-01-15T00:00:00.000Z") },
      });

      await expect(
        reportFlagsService.create(reportId, { userId: reporterId, reason: "spam" })
      ).rejects.toMatchObject({ statusCode: 409 });
    });

    test("un usuario nuevo puede denunciar sin edición del autor", async () => {
      await reportFlagsService.create(reportId, { userId: reporterId, reason: "spam" });
      await closeCycle([reporterId], new Date("2026-02-01T00:00:00.000Z"));

      const flag = await reportFlagsService.create(reportId, { userId: secondReporterId, reason: "spam" });

      expect(flag.cycle).toBe(1);
    });
  });

  describe("list()", () => {
    test("por defecto devuelve solo flags pending, con el contexto del reporte", async () => {
      const flag = await reportFlagsService.create(reportId, { userId: reporterId, reason: "false_info" });
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
      const flag = await reportFlagsService.create(reportId, { userId: reporterId, reason: "false_info" });
      createdFlagIds.push(flag.id);
      await reportFlagsService.resolve(flag.id, "accept");

      const flags = await reportFlagsService.list({ status: "reviewed" });

      expect(flags.some((f) => f.id === flag.id)).toBe(true);
      expect(flags.every((f) => f.status === "reviewed")).toBe(true);
    });

    test("status=dismissed filtra solo los flags descartados", async () => {
      const flag = await reportFlagsService.create(reportId, { userId: reporterId, reason: "false_info" });
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

    test("accept marca el flag reviewed y deja el reporte hidden", async () => {
      const flag = await reportFlagsService.create(reportId, { userId: reporterId, reason: "false_info" });
      createdFlagIds.push(flag.id);

      const resolved = await reportFlagsService.resolve(flag.id, "accept");

      expect(resolved.status).toBe("reviewed");
      expect(resolved.report.status).toBe("hidden");
    });

    test("accept deja pendientes las demás denuncias del mismo reporte", async () => {
      const flag = await reportFlagsService.create(reportId, { userId: reporterId, reason: "false_info" });
      const other = await reportFlagsService.create(reportId, { userId: secondReporterId, reason: "spam" });
      createdFlagIds.push(flag.id, other.id);

      await reportFlagsService.resolve(flag.id, "accept");

      const untouched = await prisma.reportFlag.findUniqueOrThrow({ where: { id: other.id } });
      expect(untouched.status).toBe("pending");
    });

    test("accept avisa al autor una sola vez que su reporte se ocultó", async () => {
      const flag = await reportFlagsService.create(reportId, { userId: reporterId, reason: "false_info" });
      const other = await reportFlagsService.create(reportId, { userId: secondReporterId, reason: "spam" });
      createdFlagIds.push(flag.id, other.id);

      await reportFlagsService.resolve(flag.id, "accept");

      const notifications = await ownerNotifications();
      expect(notifications).toHaveLength(1);
      expect(notifications[0]).toMatchObject({ title: "Tu reporte fue ocultado" });
      expect(notifications[0].message).toContain("revisa");
      expect(notifications[0].message).toContain("Perrito encontrado en Plaza de Mayo");
    });

    test("accept avisa al autor aunque haya desactivado los cambios de estado", async () => {
      await prisma.notificationPreference.upsert({
        where: { userId },
        create: { userId, notifyStatusChange: false },
        update: { notifyStatusChange: false },
      });
      const flag = await reportFlagsService.create(reportId, { userId: reporterId, reason: "false_info" });
      createdFlagIds.push(flag.id);

      await reportFlagsService.resolve(flag.id, "accept");

      expect(await ownerNotifications()).toHaveLength(1);
    });

    test("dismiss marca el flag dismissed y deja el reporte publicado, sin avisar al autor", async () => {
      const flag = await reportFlagsService.create(reportId, { userId: reporterId, reason: "false_info" });
      createdFlagIds.push(flag.id);

      const resolved = await reportFlagsService.resolve(flag.id, "dismiss");

      expect(resolved.status).toBe("dismissed");
      expect(resolved.report.status).toBe("published");
      expect(await ownerNotifications()).toHaveLength(0);
    });

    test("dismiss no toca las demás denuncias pendientes del reporte", async () => {
      const flag = await reportFlagsService.create(reportId, { userId: reporterId, reason: "false_info" });
      const other = await reportFlagsService.create(reportId, { userId: secondReporterId, reason: "spam" });
      createdFlagIds.push(flag.id, other.id);

      await reportFlagsService.resolve(flag.id, "dismiss");

      const pending = await prisma.reportFlag.findUniqueOrThrow({ where: { id: other.id } });
      expect(pending.status).toBe("pending");
    });

    test.each(["accept", "dismiss"] as const)("lanza AppError 409 si el flag ya fue revisado (%s)", async (action) => {
      const flag = await reportFlagsService.create(reportId, { userId: reporterId, reason: "false_info" });
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

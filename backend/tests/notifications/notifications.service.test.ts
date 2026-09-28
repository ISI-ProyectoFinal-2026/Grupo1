import { prisma } from "../../src/db/client";
import { createForStatusChange } from "../../src/services/notifications.service";

describe("notifications.service createForStatusChange (#182)", () => {
  let userId: number;
  let reportId: number;

  beforeAll(async () => {
    const user = await prisma.user.create({
      data: { email: `notifications-service-test-${Date.now()}@example.com`, passwordHash: "test-hash" },
    });
    userId = user.id;

    const report = await prisma.report.create({
      data: { userId, reportType: "lost", status: "published", title: "Perra perdida en Caballito" },
    });
    reportId = report.id;
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await prisma.notification.deleteMany({ where: { userId } });
  });

  afterAll(async () => {
    await prisma.report.delete({ where: { id: reportId } });
    await prisma.user.delete({ where: { id: userId } });
    await prisma.$disconnect();
  });

  test("published: avisa al dueño que su reporte ya es visible", async () => {
    const notification = await createForStatusChange(reportId, "published");

    expect(notification).toMatchObject({
      userId,
      type: "report_status_change",
      title: "Tu reporte fue publicado",
      message: '"Perra perdida en Caballito" ya es visible para la comunidad.',
      reportId,
      isRead: false,
    });
    await expect(prisma.notification.count({ where: { userId } })).resolves.toBe(1);
  });

  test("rejected: avisa al dueño que su reporte no pasó la moderación", async () => {
    const notification = await createForStatusChange(reportId, "rejected");

    expect(notification).toMatchObject({
      userId,
      type: "report_status_change",
      title: "Tu reporte no fue publicado",
      message: '"Perra perdida en Caballito" no pasó la moderación de contenido y no es visible para la comunidad.',
      reportId,
    });
    await expect(prisma.notification.count({ where: { userId } })).resolves.toBe(1);
  });

  test("si el reporte ya no existe devuelve null sin lanzar ni crear nada", async () => {
    const createSpy = jest.spyOn(prisma.notification, "create");

    await expect(createForStatusChange(999999999, "published")).resolves.toBeNull();
    expect(createSpy).not.toHaveBeenCalled();
  });
});
